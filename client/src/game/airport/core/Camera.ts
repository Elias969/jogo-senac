import type { GameObject, Rect } from '../types';

/**
 * Câmera 2D: o offset segue o centro do alvo e é "clampado" com
 * Math.max/Math.min para nunca mostrar nada fora do mapa [0, mundo].
 */
type MutableRect = { -readonly [K in keyof Rect]: Rect[K] };

export class Camera {
  private readonly _viewport: MutableRect;

  constructor(
    viewWidth: number,
    viewHeight: number,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {
    this._viewport = { x: 0, y: 0, width: viewWidth, height: viewHeight };
  }

  get x(): number {
    return this._viewport.x;
  }
  get y(): number {
    return this._viewport.y;
  }
  /** Retângulo visível em coordenadas de mundo (não modifique). */
  get viewport(): Readonly<Rect> {
    return this._viewport;
  }

  resize(viewWidth: number, viewHeight: number): void {
    this._viewport.width = viewWidth;
    this._viewport.height = viewHeight;
  }

  follow(target: GameObject): void {
    const cx = target.position.x + target.size.width / 2;
    const cy = target.position.y + target.size.height / 2;

    const maxX = this.worldWidth - this._viewport.width;
    const maxY = this.worldHeight - this._viewport.height;

    // clamp: 0 <= offset <= (mundo - viewport). Arredondado para evitar "costuras" no canvas.
    this._viewport.x = Math.round(Math.max(0, Math.min(cx - this._viewport.width / 2, maxX)));
    this._viewport.y = Math.round(Math.max(0, Math.min(cy - this._viewport.height / 2, maxY)));
  }

  /** Interseção entre um retângulo do mundo e o viewport atual. */
  intersects(rect: Rect): boolean {
    const v = this._viewport;
    return (
      rect.x < v.x + v.width &&
      rect.x + rect.width > v.x &&
      rect.y < v.y + v.height &&
      rect.y + rect.height > v.y
    );
  }
}
