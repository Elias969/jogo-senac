import type { Vector2D } from '../types';

type Dir = 'up' | 'down' | 'left' | 'right';

const KEY_TO_DIR: Readonly<Record<string, Dir>> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Teclado → vetor de direção normalizado (WASD/setas) + tecla de interação (E). */
export class InputManager {
  /** Vetor de direção atual. Diagonais são normalizadas (comprimento 1). */
  readonly direction: Vector2D = { x: 0, y: 0 };

  private readonly held = new Set<string>();
  private interactQueued = false;
  private virtualDirection: Vector2D = { x: 0, y: 0 };

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.reset);
  }

  /** Retorna true uma única vez por pressionamento de E. */
  consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  /** Limpa teclas presas (ao pausar, trocar de aba, etc.). */
  readonly reset = (): void => {
    this.held.clear();
    this.interactQueued = false;
    this.virtualDirection = { x: 0, y: 0 };
    this.recompute();
  };

  setVirtualDirection(x: number, y: number): void {
    this.virtualDirection = { x: Math.sign(x), y: Math.sign(y) };
    this.recompute();
  }

  queueInteract(): void { this.interactQueued = true; }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.reset);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code in KEY_TO_DIR) {
      e.preventDefault();
      this.held.add(e.code);
      this.recompute();
    } else if (e.code === 'KeyE' && !e.repeat) {
      this.interactQueued = true;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.held.delete(e.code)) this.recompute();
  };

  private recompute(): void {
    let x = 0;
    let y = 0;
    this.held.forEach((code) => {
      switch (KEY_TO_DIR[code]) {
        case 'left': x -= 1; break;
        case 'right': x += 1; break;
        case 'up': y -= 1; break;
        case 'down': y += 1; break;
      }
    });
    x = Math.sign(x);
    y = Math.sign(y);
    x += this.virtualDirection.x;
    y += this.virtualDirection.y;
    x = Math.sign(x);
    y = Math.sign(y);
    const len = Math.hypot(x, y);
    this.direction.x = len > 0 ? x / len : 0;
    this.direction.y = len > 0 ? y / len : 0;
  }
}
