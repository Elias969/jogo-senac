import { MAX_DELTA_TIME } from '../config';

export interface GameLoopCallbacks {
  /** `deltaTime` em segundos. */
  update(deltaTime: number): void;
  /** `elapsed` = tempo acumulado (s) em que o loop esteve rodando. */
  render(elapsed: number): void;
}

/**
 * Loop baseado em requestAnimationFrame com deltaTime.
 * `pause()` cancela o rAF de fato: nada é atualizado nem renderizado até `resume()`.
 */
export class GameLoop {
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private running = false;
  private _elapsed = 0;
  private _fps = 60;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  get isRunning(): boolean {
    return this.running;
  }
  get elapsed(): number {
    return this._elapsed;
  }
  get fps(): number {
    return this._fps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // Reinicia o relógio: o tempo em pausa nunca vira um deltaTime gigante.
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  resume(): void {
    this.start();
  }

  private readonly tick = (timestamp: number): void => {
    if (!this.running) return;

    const deltaTime = clampDelta((timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this._elapsed += deltaTime;
    if (deltaTime > 0) this._fps += (1 / deltaTime - this._fps) * 0.1;

    this.callbacks.update(deltaTime);
    this.callbacks.render(this._elapsed);

    this.rafId = requestAnimationFrame(this.tick);
  };
}

const clampDelta = (dt: number): number => Math.max(0, Math.min(dt, MAX_DELTA_TIME));
