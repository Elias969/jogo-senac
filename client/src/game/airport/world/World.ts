import { aabbIntersects, getColliderRect } from '../core/Collision';
import type { GameObject, NPC, Rect, Vector2D, Zone } from '../types';
import { isGate, isNPC } from '../types';

/** Contêiner do cenário: zonas de piso, objetos e ponto de chegada. */
export class World {
  readonly npcs: readonly NPC[];
  private readonly byId = new Map<string, GameObject>();

  constructor(
    readonly width: number,
    readonly height: number,
    readonly zones: readonly Zone[],
    readonly objects: GameObject[],
    /** Ao tocar nesta área o jogador vence. */
    readonly goal: Rect,
  ) {
    for (const o of objects) this.byId.set(o.id, o);
    this.npcs = objects.filter(isNPC);
  }

  getById(id: string): GameObject | undefined {
    return this.byId.get(id);
  }

  /** Objetos com Collider ativo cuja caixa intersecta `area`. */
  queryColliders(area: Rect, exclude?: GameObject): GameObject[] {
    const result: GameObject[] = [];
    for (const o of this.objects) {
      if (o === exclude) continue;
      const box = getColliderRect(o);
      if (box && aabbIntersects(box, area)) result.push(o);
    }
    return result;
  }

  /** Destrói o Collider do portão e marca-o como aberto. */
  unlockGate(gateId: string): boolean {
    const gate = this.byId.get(gateId);
    if (!gate || !isGate(gate)) return false;
    gate.collider = null;
    gate.unlocked = true;
    return true;
  }

  getZoneAt(p: Vector2D): Zone | undefined {
    return this.zones.find(
      (z) =>
        p.x >= z.rect.x &&
        p.x < z.rect.x + z.rect.width &&
        p.y >= z.rect.y &&
        p.y < z.rect.y + z.rect.height,
    );
  }
}
