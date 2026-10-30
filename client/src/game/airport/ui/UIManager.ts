import type { NPC, Quest } from "../types";
import { emitAirportUi, type AirportUiState } from "../ui-adapter";
export interface QuestViewCallbacks { onAnswer(index: number): void; onClose(): void }
export { type AirportUiState };
export class UIManager {
  private callbacks: QuestViewCallbacks | null = null;
  setZone(name: string): void { emitAirportUi({ type: "hud", zone: name }); }
  updateProgress(done: number, total: number, objective: string): void { emitAirportUi({ type: "hud", done, total, objective }); }
  setHint(visible: boolean): void { emitAirportUi({ type: "hint", visible }); }
  setGuidance(visible: boolean, angle = 0, label = "", detail = ""): void { emitAirportUi({ type: "guidance", visible, angle, label, detail }); }
  toast(message: string, _durationMs = 3600): void { emitAirportUi({ type: "toast", message }); }
  setDebug(visible: boolean, message = ""): void { emitAirportUi({ type: "debug", visible, message }); }
  showQuest(npc: NPC, quest: Quest, callbacks: QuestViewCallbacks): void { this.callbacks = callbacks; emitAirportUi({ type: "quest", open: true, npc, quest }); }
  showWrongAnswer(_optionIndex: number, hint: string): void { emitAirportUi({ type: "quest", open: true, feedback: `Respuesta incorrecta. ${hint}` }); }
  hideQuest(): void { this.callbacks = null; emitAirportUi({ type: "quest", open: false }); }
  showVictory(onRestart: () => void): void { emitAirportUi({ type: "victory", open: true, restart: onRestart }); }
  hideVictory(): void { emitAirportUi({ type: "victory", open: false }); }
  showEncounter(): void { emitAirportUi({ type: "encounter", open: true }); }
  answer(index: number): void { this.callbacks?.onAnswer(index); }
  close(): void { this.callbacks?.onClose(); }
}
