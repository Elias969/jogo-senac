import { PLAYER_SIZE, PLAYER_SPEED, WALL_ELEVATION, WALL_THICKNESS } from '../config';
import type {
  Collider,
  GameObject,
  NPC,
  NpcOutfit,
  Player,
  ProgressGate,
  PropKind,
} from '../types';

/** Colisão de "pés": só a base do sprite bloqueia, o que dá o efeito 2.5D. */
const FEET_COLLIDER: Collider = {
  offset: { x: 4, y: 34 },
  size: { width: 24, height: 14 },
};

interface PropDef {
  readonly width: number;
  readonly height: number;
  readonly elevation: number;
  readonly solid: boolean;
}

const PROP_DEFS: Readonly<Record<PropKind, PropDef>> = {
  elias: { width: 84, height: 54, elevation: 210, solid: false },
  plant: { width: 28, height: 20, elevation: 40, solid: true },
  pillar: { width: 40, height: 40, elevation: 90, solid: true },
  desk: { width: 150, height: 40, elevation: 34, solid: true },
  bench: { width: 120, height: 28, elevation: 40, solid: true },
  luggage: { width: 30, height: 20, elevation: 26, solid: true },
  scanner: { width: 110, height: 50, elevation: 40, solid: true },
  board: { width: 120, height: 16, elevation: 120, solid: true },
  plane: { width: 800, height: 60, elevation: 110, solid: true },
  mat: { width: 120, height: 40, elevation: 0, solid: false },
};

const fullCollider = (width: number, height: number): Collider => ({
  offset: { x: 0, y: 0 },
  size: { width, height },
});

let sequence = 0;
const nextId = (prefix: string): string => `${prefix}-${++sequence}`;

export function createProp(
  kind: PropKind,
  x: number,
  y: number,
  opts: { variant?: number; width?: number } = {},
): GameObject {
  const def = PROP_DEFS[kind];
  const width = opts.width ?? def.width;
  return {
    id: nextId(kind),
    kind,
    layer: kind === 'mat' ? 'ground' : 'sorted',
    position: { x, y },
    size: { width, height: def.height },
    elevation: def.elevation,
    variant: opts.variant ?? 0,
    collider: def.solid ? fullCollider(width, def.height) : null,
  };
}

export function createWall(x: number, y: number, width: number): GameObject {
  return {
    id: nextId('wall'),
    kind: 'wall',
    layer: 'sorted',
    position: { x, y },
    size: { width, height: WALL_THICKNESS },
    elevation: WALL_ELEVATION,
    variant: 0,
    collider: fullCollider(width, WALL_THICKNESS),
  };
}

export function createGate(opts: {
  id: string;
  questId: string;
  x: number;
  y: number;
  width: number;
  label: string;
}): ProgressGate {
  return {
    id: opts.id,
    kind: 'gate',
    layer: 'sorted',
    position: { x: opts.x, y: opts.y },
    size: { width: opts.width, height: WALL_THICKNESS },
    elevation: WALL_ELEVATION,
    variant: 0,
    collider: fullCollider(opts.width, WALL_THICKNESS),
    questId: opts.questId,
    label: opts.label,
    unlocked: false,
    openProgress: 0,
    update(dt: number): void {
      if (this.unlocked && this.openProgress < 1) {
        this.openProgress = Math.min(1, this.openProgress + dt / 0.7);
      }
    },
  };
}

export function createNPC(opts: {
  id: string;
  name: string;
  role: string;
  outfit: NpcOutfit;
  questId: string;
  x: number;
  y: number;
  doneLine: string;
  radius?: number;
}): NPC {
  return {
    id: opts.id,
    kind: 'npc',
    layer: 'sorted',
    position: { x: opts.x, y: opts.y },
    size: { ...PLAYER_SIZE },
    elevation: 24, // espaço para o balão "!" acima da cabeça
    variant: 0,
    collider: FEET_COLLIDER,
    name: opts.name,
    role: opts.role,
    outfit: opts.outfit,
    questId: opts.questId,
    trigger: { radius: opts.radius ?? 120 },
    doneLine: opts.doneLine,
    completed: false,
    animTime: 0,
    update(dt: number): void {
      this.animTime += dt;
    },
  };
}

export function createPlayer(x: number, y: number): Player {
  return {
    id: 'player',
    kind: 'player',
    layer: 'sorted',
    position: { x, y },
    size: { ...PLAYER_SIZE },
    elevation: 0,
    variant: 0,
    collider: FEET_COLLIDER,
    speed: PLAYER_SPEED,
    direction: { x: 0, y: 0 },
    facing: 'down',
    isMoving: false,
    animTime: 0,
    update(dt: number): void {
      if (this.isMoving) this.animTime += dt;
    },
  };
}
