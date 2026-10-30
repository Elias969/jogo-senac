import type { Collider, GameObject, Rect, Size, Vector2D } from '../types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** Interseção AABB (caixas alinhadas aos eixos). Bordas que apenas se tocam não contam. */
export function aabbIntersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function colliderRectOf(o: GameObject, c: Collider): Rect {
  return {
    x: o.position.x + c.offset.x,
    y: o.position.y + c.offset.y,
    width: c.size.width,
    height: c.size.height,
  };
}

/** Caixa de colisão em coordenadas de mundo (ou null se o Collider foi destruído). */
export function getColliderRect(o: GameObject): Rect | null {
  return o.collider ? colliderRectOf(o, o.collider) : null;
}

/** Caixa visual (pegada + elevação). Usada para o culling. */
export function getBounds(o: GameObject): Rect {
  return {
    x: o.position.x,
    y: o.position.y - o.elevation,
    width: o.size.width,
    height: o.size.height + o.elevation,
  };
}

export function inflate(r: Rect, margin: number): Rect {
  return {
    x: r.x - margin,
    y: r.y - margin,
    width: r.width + margin * 2,
    height: r.height + margin * 2,
  };
}

export function centerOf(o: GameObject): Vector2D {
  return {
    x: o.position.x + o.size.width / 2,
    y: o.position.y + o.size.height / 2,
  };
}

/**
 * Move o objeto resolvendo cada eixo separadamente (permite "deslizar" em paredes)
 * e o mantém dentro dos limites do mundo.
 */
export function moveWithCollisions(
  mover: GameObject,
  delta: Vector2D,
  solids: readonly GameObject[],
  world: Size,
): void {
  const c = mover.collider;
  if (!c) {
    mover.position.x += delta.x;
    mover.position.y += delta.y;
    return;
  }

  // Eixo X
  mover.position.x += delta.x;
  for (const solid of solids) {
    const other = getColliderRect(solid);
    if (!other || !aabbIntersects(colliderRectOf(mover, c), other)) continue;
    if (delta.x > 0) mover.position.x = other.x - c.offset.x - c.size.width;
    else if (delta.x < 0) mover.position.x = other.x + other.width - c.offset.x;
  }

  // Eixo Y
  mover.position.y += delta.y;
  for (const solid of solids) {
    const other = getColliderRect(solid);
    if (!other || !aabbIntersects(colliderRectOf(mover, c), other)) continue;
    if (delta.y > 0) mover.position.y = other.y - c.offset.y - c.size.height;
    else if (delta.y < 0) mover.position.y = other.y + other.height - c.offset.y;
  }

  // Limites absolutos do mapa
  mover.position.x = clamp(mover.position.x, -c.offset.x, world.width - c.offset.x - c.size.width);
  mover.position.y = clamp(mover.position.y, -c.offset.y, world.height - c.offset.y - c.size.height);
}
