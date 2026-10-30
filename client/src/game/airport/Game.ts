import { Camera } from './core/Camera';
import {
  aabbIntersects,
  centerOf,
  getColliderRect,
  inflate,
  moveWithCollisions,
} from './core/Collision';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { Renderer } from './rendering/Renderer';
import { QuestSystem } from './systems/QuestSystem';
import type { GameObject, NPC, Player, Quest } from './types';
import { isNPC } from './types';
import { UIManager } from './ui/UIManager';
import { createAirportLevel } from './world/airportLevel';
import type { World } from './world/World';

/** Orquestra os módulos: entrada → movimento/colisão → câmera → culling → interação → render. */
export class Game {
  private readonly renderer: Renderer;
  private readonly input = new InputManager();
  private readonly ui = new UIManager();
  private readonly loop: GameLoop;

  private world!: World;
  private player!: Player;
  private camera!: Camera;
  private quests!: QuestSystem;
  private elias!: GameObject;

  private visible: GameObject[] = [];
  private nearbyNpc: NPC | null = null;
  private zoneId = '';
  private finished = false;
  private planeHintShown = false;
  private debugEnabled = false;
  private debugTimer = 0;
  private guidanceSignature = '';

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (t) => this.render(t),
    });

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('airport-game:answer', this.handleDomAnswer);
    window.addEventListener('airport-game:close-quest', this.handleDomClose);
    window.addEventListener('airport-game:close-encounter', this.handleDomCloseEncounter);
    window.addEventListener('airport-game:mobile-direction', this.handleMobileDirection);
    window.addEventListener('airport-game:mobile-interact', this.handleMobileInteract);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugEnabled = !this.debugEnabled;
        this.renderer.debug = this.debugEnabled;
        this.ui.setDebug(this.debugEnabled, '');
        if (!this.loop.isRunning) this.renderFrame();
      }
    });

    this.loadLevel();
    this.handleResize();
  }

  private readonly handleDomAnswer = (event: Event): void => {
    const index = (event as CustomEvent<number>).detail;
    if (Number.isInteger(index)) this.ui.answer(index);
  };

  private readonly handleDomClose = (): void => this.ui.close();
  private readonly handleDomCloseEncounter = (): void => { this.input.reset(); this.loop.resume(); };
  private readonly handleMobileDirection = (event: Event): void => {
    const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
    this.input.setVirtualDirection(x, y);
  };
  private readonly handleMobileInteract = (): void => this.input.queueInteract();

  start(): void {
    this.loop.start();
  }

  pauseForOverlay(): void {
    this.input.reset();
    this.loop.pause();
  }

  resumeAfterOverlay(): void {
    this.input.reset();
    this.loop.resume();
  }

  isPlayerAtScreenPoint(clientX: number, clientY: number, canvas: HTMLCanvasElement): boolean {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const worldX = this.camera.x + ((clientX - rect.left) / rect.width) * this.camera.viewport.width;
    const worldY = this.camera.y + ((clientY - rect.top) / rect.height) * this.camera.viewport.height;
    const playerCenter = centerOf(this.player);
    const hitRadius = Math.max(this.player.size.width, this.player.size.height) * 1.05;
    return Math.hypot(worldX - playerCenter.x, worldY - playerCenter.y) <= hitRadius;
  }

  /* ---------------- ciclo de vida ---------------- */

  private loadLevel(): void {
    const level = createAirportLevel();
    this.world = level.world;
    this.player = level.player;
    this.quests = new QuestSystem(level.quests);
    this.elias = this.world.objects.find((object) => object.kind === 'elias') as GameObject;
    this.elias.position = { x: -1000, y: -1000 };
    this.quests.onCompleted(this.handleQuestCompleted);
    this.camera = new Camera(window.innerWidth, window.innerHeight, this.world.width, this.world.height);
    this.camera.follow(this.player);

    this.visible = [];
    this.nearbyNpc = null;
    this.zoneId = '';
    this.finished = false;
    this.guidanceSignature = '';
    this.input.reset();
    this.ui.setHint(false);
    this.ui.setGuidance(false);
    this.refreshProgress();
  }

  private restart(): void {
    this.ui.hideVictory();
    this.loadLevel();
    this.handleResize();
    this.loop.resume();
  }

  private readonly handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.camera.resize(w, h);
    this.camera.follow(this.player);
    if (!this.loop.isRunning) this.renderFrame(); // pausado: redesenha o quadro estático
  };

  private renderFrame(): void {
    this.visible = this.renderer.cull(this.world.objects, this.camera);
    this.renderer.render(this.world, this.camera, this.visible, this.loop.elapsed);
  }

  /* ---------------- update / render ---------------- */

  private update(dt: number): void {
    this.movePlayer(dt);
    this.camera.follow(this.player);

    // Culling: só o que está no viewport é atualizado (e depois renderizado).
    this.visible = this.renderer.cull(this.world.objects, this.camera);
    for (const obj of this.visible) obj.update?.(dt);

    this.updateZone();
    this.updateInteraction();
    this.updateGuidance();
    this.checkGoal();
    this.updateDebug(dt);
  }

  private render(elapsed: number): void {
    this.renderer.render(this.world, this.camera, this.visible, elapsed);
  }

  private movePlayer(dt: number): void {
    const p = this.player;
    const dir = this.input.direction;
    p.direction.x = dir.x;
    p.direction.y = dir.y;
    p.isMoving = dir.x !== 0 || dir.y !== 0;
    if (!p.isMoving) return;

    p.facing =
      Math.abs(dir.x) > Math.abs(dir.y)
        ? dir.x > 0 ? 'right' : 'left'
        : dir.y > 0 ? 'down' : 'up';

    // deslocamento = direção × velocidade × deltaTime → independe do FPS
    const delta = { x: dir.x * p.speed * dt, y: dir.y * p.speed * dt };

    const box = getColliderRect(p);
    const solids = box ? this.world.queryColliders(inflate(box, 64), p) : [];
    moveWithCollisions(p, delta, solids, this.world);
  }

  /* ---------------- interação e quests ---------------- */

  private updateInteraction(): void {
    const interact = this.input.consumeInteract();
    const pc = centerOf(this.player);

    let nearest: NPC | null = null;
    let best = Infinity;
    for (const npc of this.world.npcs) {
      const nc = centerOf(npc);
      const dist = Math.hypot(pc.x - nc.x, pc.y - nc.y);
      if (dist <= npc.trigger.radius && dist < best) {
        nearest = npc;
        best = dist;
      }
    }

    if (nearest !== this.nearbyNpc) {
      this.nearbyNpc = nearest;
      this.ui.setHint(nearest !== null);
    }

    const allQuestionsDone = this.quests.completedCount === this.quests.total;
    const eliasDistance = allQuestionsDone ? Math.hypot(pc.x - (this.elias.position.x + this.elias.size.width / 2), pc.y - (this.elias.position.y + this.elias.size.height / 2)) : Infinity;
    const eliasNearby = eliasDistance <= 145;
    if (eliasNearby && !nearest) this.ui.setHint(true);
    if (interact && eliasNearby) {
      this.loop.pause();
      this.input.reset();
      this.ui.setHint(false);
      this.ui.showEncounter();
      return;
    }

    if (!interact || !nearest) return;
    if (nearest.completed) {
      this.ui.toast(`${nearest.name}: ${nearest.doneLine}`);
    } else {
      this.openQuest(nearest);
    }
  }

  private updateGuidance(): void {
    if (this.finished) {
      if (this.guidanceSignature !== 'hidden') {
        this.guidanceSignature = 'hidden';
        this.ui.setGuidance(false);
      }
      return;
    }

    const playerCenter = centerOf(this.player);
    const allQuestionsDone = this.quests.completedCount === this.quests.total;
    let target: { x: number; y: number } | null = null;
    let label = '';
    let detail = '';

    if (allQuestionsDone) {
      target = { x: this.elias.position.x + this.elias.size.width / 2, y: this.elias.position.y + this.elias.size.height / 2 };
      label = 'VUELVE AL INICIO';
      detail = 'Elias te está esperando';
    } else {
      const next = this.quests.nextPending;
      const npc = next ? this.world.getById(next.npcId) : undefined;
      if (npc && isNPC(npc)) {
        target = centerOf(npc);
        label = `VE CON ${npc.name.toUpperCase()}`;
        detail = npc.role;
      }
    }

    if (!target) return;
    const dx = target.x - playerCenter.x;
    const dy = target.y - playerCenter.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    const distanceBand = Math.round(Math.hypot(dx, dy) / 32);
    const signature = `${label}|${Math.round(angle)}|${distanceBand}`;
    if (signature === this.guidanceSignature) return;
    this.guidanceSignature = signature;
    this.ui.setGuidance(true, angle, label, detail);
  }

  private openQuest(npc: NPC): void {
    const quest = this.quests.get(npc.questId);
    if (!quest || quest.status === 'completed') return;

    this.loop.pause(); // congela update e render
    this.input.reset();
    this.nearbyNpc = null;
    this.ui.setHint(false);
    this.ui.showQuest(npc, quest, {
      onAnswer: (index) => this.handleAnswer(quest, index),
      onClose: () => this.closeQuest(),
    });
  }

  private handleAnswer(quest: Quest, optionIndex: number): void {
    const result = this.quests.submitAnswer(quest.id, optionIndex);
    if (!result.correct) this.ui.showWrongAnswer(optionIndex, quest.wrongHint);
    // se correta, `handleQuestCompleted` (evento do QuestSystem) faz o resto
  }

  private readonly handleQuestCompleted = (quest: Quest): void => {
    this.ui.hideQuest();
    this.world.unlockGate(quest.gateId); // destrói o Collider do portão
    const npc = this.world.getById(quest.npcId);
    if (npc && isNPC(npc)) npc.completed = true;

    this.refreshProgress();
    this.ui.toast(quest.explanation, 4800);
    if (this.quests.completedCount === this.quests.total) {
      this.elias.position = { x: this.world.width / 2 + 55, y: 1835 };
      this.planeHintShown = true;
      this.ui.updateProgress(this.quests.completedCount, this.quests.total, 'Olvidaste algo... vuelve al inicio.');
      this.ui.toast('Olvidaste algo... vuelve al inicio. Elias te está esperando.', 6200);
    }
    this.input.reset();
    this.loop.resume();
  };

  private closeQuest(): void {
    this.ui.hideQuest();
    this.input.reset();
    this.loop.resume();
  }

  private refreshProgress(): void {
    const next = this.quests.nextPending;
    const npc = next ? this.world.getById(next.npcId) : undefined;
    const objective =
      next && npc && isNPC(npc)
        ? `Habla con ${npc.name} (${npc.role}).`
        : 'Todas las puertas están abiertas: ve hacia la pista de embarque.';
    this.ui.updateProgress(this.quests.completedCount, this.quests.total, objective);
  }

  /* ---------------- objetivo e HUD ---------------- */

  private checkGoal(): void {
    if (this.finished) return;
    const box = getColliderRect(this.player);
    if (box && aabbIntersects(box, this.world.goal)) {
      if (this.quests.completedCount < this.quests.total) return;
      if (!this.planeHintShown) {
        this.planeHintShown = true;
        this.ui.updateProgress(this.quests.completedCount, this.quests.total, 'Vuelve al inicio: Elias te está esperando.');
        this.ui.toast('Olvidaste algo... vuelve al inicio. Elias te está esperando.', 6200);
        this.elias.position = { x: this.world.width / 2 + 55, y: 1835 };
      }
    }
  }

  private updateZone(): void {
    const zone = this.world.getZoneAt(centerOf(this.player));
    if (zone && zone.id !== this.zoneId) {
      this.zoneId = zone.id;
      this.ui.setZone(zone.name);
    }
  }

  private updateDebug(dt: number): void {
    if (!this.debugEnabled) return;
    this.debugTimer += dt;
    if (this.debugTimer < 0.25) return;
    this.debugTimer = 0;
    this.ui.setDebug(
      true,
      `${Math.round(this.loop.fps)} FPS · ${this.visible.length}/${this.world.objects.length} objetos visíveis · câmera (${this.camera.x}, ${this.camera.y})`,
    );
  }
}
