import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Game } from "@/game/airport/Game";
import type { NPC, Quest } from "@/game/airport/types";
import type { AirportUiState } from "@/game/airport/ui-adapter";

type HudState = Extract<AirportUiState, { type: "hud" }>;
type GuidanceState = Extract<AirportUiState, { type: "guidance" }>;
const initial: HudState = { type: "hud", zone: "Vestíbulo de check-in", objective: "Explora el aeropuerto y encuentra al primer encargado.", done: 0, total: 4 };
const initialGuidance: GuidanceState = { type: "guidance", visible: false, angle: 0, label: "", detail: "" };
const profile = "/assets/catalina-profile_f0381987.png";
const catalinaFront = "/assets/catalina-front-full_5063d7a9.png";
const eliasSmile = "/assets/elias-conversation_34d71a23.png";
const eliasLaugh = "/assets/elias-laugh_f84b436f.png";
const eliasSprite = "/assets/elias-character-v3_cb34918e.png";

type EncounterStage = 0 | 1 | 2 | 3;
export default function AirportGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState(initial);
  const [guidance, setGuidance] = useState(initialGuidance);
  const [hint, setHint] = useState(false);
  const [toast, setToast] = useState("");
  const [quest, setQuest] = useState<{ npc: NPC; data: Quest; feedback?: string } | null>(null);
  const [victory, setVictory] = useState<(() => void) | null>(null);
  const [encounter, setEncounter] = useState(false);
  const [encounterStage, setEncounterStage] = useState<EncounterStage>(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [togetherOpen, setTogetherOpen] = useState(false);
  const loveMessages = [
    "Cada día pienso en ti y en la suerte que tengo de compartir mi vida contigo.",
    "Sé que elegí a la persona correcta, una y otra vez, todos los días.",
    "Te amo más de lo que cualquier aeropuerto podría contener.",
    "Eres la mujer de mi vida y mi destino favorito.",
    "Gracias por encontrarme. Contigo, cualquier viaje vale la pena.",
  ];

  useEffect(() => {
    const onUi = (event: Event) => {
      const detail = (event as CustomEvent<AirportUiState>).detail;
      if (detail.type === "hud") setHud((old) => ({ ...old, ...detail }));
      if (detail.type === "guidance") setGuidance(detail);
      if (detail.type === "hint") setHint(detail.visible);
      if (detail.type === "toast") { setToast(detail.message); window.setTimeout(() => setToast(""), 3600); }
      if (detail.type === "quest") {
        if (!detail.open) setQuest(null);
        else if (detail.npc && detail.quest) setQuest({ npc: detail.npc, data: detail.quest });
        else if (detail.feedback) setQuest((old) => old ? { ...old, feedback: detail.feedback } : old);
      }
      if (detail.type === "encounter") { setEncounter(detail.open); setEncounterStage(0); setChoice(null); }
      if (detail.type === "victory") setVictory(detail.open ? detail.restart || (() => undefined) : null);
    };
    window.addEventListener("airport-game:ui", onUi);
    return () => window.removeEventListener("airport-game:ui", onUi);
  }, []);
  useEffect(() => {
    if (celebration === null) return;
    const timer = window.setInterval(() => setCelebration((current) => {
      if (current === null) return null;
      if (current === loveMessages.length - 1) {
        setTogetherOpen(true);
        return null;
      }
      return current + 1;
    }), 4200);
    return () => window.clearInterval(timer);
  }, [celebration, loveMessages.length]);
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.start();
    return () => { gameRef.current = null; };
  }, [started]);
  const answer = (index: number) => window.dispatchEvent(new CustomEvent("airport-game:answer", { detail: index }));
  const closeQuest = () => window.dispatchEvent(new CustomEvent("airport-game:close-quest"));
  const advanceEncounter = () => setEncounterStage((stage) => Math.min(3, stage + 1) as EncounterStage);
  const selectReply = (text: string) => { setChoice(text); setEncounterStage(3); };
  const closeEncounter = () => { setEncounter(false); setCelebration(0); window.dispatchEvent(new CustomEvent("airport-game:close-encounter")); };
  const previousMessage = () => setCelebration((current) => current === null ? 0 : (current - 1 + loveMessages.length) % loveMessages.length);
  const nextMessage = () => setCelebration((current) => {
    if (current === null) return 0;
    if (current === loveMessages.length - 1) { setTogetherOpen(true); return null; }
    return current + 1;
  });
  const startGame = () => { setTogetherOpen(false); setDetailsOpen(false); setStarted(true); };
  const closeDetails = () => { setDetailsOpen(false); gameRef.current?.resumeAfterOverlay(); };
  const handleCanvasTap = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!started || detailsOpen || encounter || celebration !== null || togetherOpen) return;
    if (gameRef.current?.isPlayerAtScreenPoint(event.clientX, event.clientY, event.currentTarget)) {
      gameRef.current.pauseForOverlay();
      setDetailsOpen(true);
    }
  };
  const mobileDirection = (x: number, y: number) => window.dispatchEvent(new CustomEvent("airport-game:mobile-direction", { detail: { x, y } }));
  const mobileInteract = () => window.dispatchEvent(new CustomEvent("airport-game:mobile-interact"));
  const holdDirection = (x: number, y: number) => (event: ReactPointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); mobileDirection(x, y); };
  const releaseDirection = (event: ReactPointerEvent<HTMLButtonElement>) => { event.preventDefault(); mobileDirection(0, 0); };
  return <main className={`airport-shell${started ? " is-started" : ""}`}>
    <canvas ref={canvasRef} className="airport-canvas" onPointerUp={handleCanvasTap} aria-label="Mapa superior del aeropuerto" />
    {!started && <section className="airport-start-screen"><div className="airport-start-card"><span className="airport-kicker">EL ENCUENTRO · UNA HISTORIA DE AMOR</span><img src={profile} alt="Card de perfil de Catalina" /><h1>Catalina</h1><p>Una pequeña aventura para reencontrarse con la persona que ama.</p><button onClick={startGame}>INICIAR EL VIAJE <b>→</b></button><small>Optimizado para celular y computadora</small></div></section>}
    <header className="airport-topbar"><div><span className="airport-kicker">EL ENCUENTRO · PUERTA DE EMBARQUE</span><h1>Diario de viaje</h1></div><aside className="airport-profile"><img src={profile} alt="Catalina" /><div><b>CATALINA</b><span>Chile → Brasil</span></div><strong>♥</strong></aside></header>
    {guidance.visible && <section className="airport-guidance" aria-live="polite"><div className="guidance-arrow" style={{ transform: `rotate(${guidance.angle || 0}deg)` }}>↑</div><div><strong>{guidance.label}</strong><small>{guidance.detail}</small></div></section>}
    <section className="mobile-controls" aria-label="Controles para celular"><div className="mobile-dpad"><button aria-label="Mover hacia arriba" onPointerDown={holdDirection(0,-1)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection} onLostPointerCapture={releaseDirection}>▲</button><div><button aria-label="Mover hacia la izquierda" onPointerDown={holdDirection(-1,0)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection} onLostPointerCapture={releaseDirection}>◀</button><button aria-label="Mover hacia abajo" onPointerDown={holdDirection(0,1)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection} onLostPointerCapture={releaseDirection}>▼</button><button aria-label="Mover hacia la derecha" onPointerDown={holdDirection(1,0)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection} onLostPointerCapture={releaseDirection}>▶</button></div></div><button className="mobile-action" aria-label="Interactuar" onPointerDown={(event) => { event.preventDefault(); mobileInteract(); }}>E<small>HABLAR</small></button></section>
    {hint && <div className="airport-hint">Presiona <b>E</b> para conversar</div>}
    {toast && <div className="airport-toast">{toast}</div>}
    {quest && <div className="airport-modal"><section className="airport-quest"><button className="airport-close" onClick={closeQuest}>×</button><div className="airport-npc"><span>✦</span><div><small>{quest.data.title}</small><h2>{quest.npc.name}</h2><p>{quest.npc.role}</p></div></div><p className="airport-intro">{quest.data.intro}</p><h3>{quest.data.question}</h3><ol>{quest.data.options.map((option, index) => <li key={option}><button onClick={() => answer(index)}><b>{index + 1}</b>{option}</button></li>)}</ol>{quest.feedback && <div className="airport-feedback">{quest.feedback}</div>}<small className="airport-foot">Elige una respuesta o usa las teclas 1 a 4 · Esc cierra</small></section></div>}
    {encounter && <div className="airport-modal encounter-modal"><section className="encounter-card encounter-visual-novel">
      <div className="encounter-full-scene"><div className="encounter-lights" /><img className="encounter-elias-large" src={encounterStage >= 2 ? eliasLaugh : eliasSmile} alt="Elias sonriendo en el aeropuerto" /></div>
      <div className="encounter-bottom-dialogue">
        <span className="encounter-label">ELIAS</span>
        {encounterStage === 0 && <p>Me encontraste, ¿ah?</p>}
        {encounterStage === 1 && <p>Sabía que llegarías hasta aquí. Te estaba esperando.</p>}
        {encounterStage === 2 && <><p>Después de todo esto... ¿qué quieres decirme?</p><h3>Elige una respuesta</h3><div className="encounter-choices"><button onClick={() => selectReply("Nunca dejaría de buscarte.")}>“Nunca dejaría de buscarte.”</button><button onClick={() => selectReply("Ahora comienza nuestro viaje.")}>“Ahora comienza nuestro viaje.”</button></div></>}
        {encounterStage === 3 && <><p>{choice} <strong>♥</strong></p><div className="encounter-ending">Después de tanta distancia, por fin compartimos el mismo destino.</div><button className="encounter-next" onClick={closeEncounter}>JUNTOS <b>♥</b></button></>}
        {encounterStage < 2 && <button className="encounter-next" onClick={advanceEncounter}>CONTINUAR <b>→</b></button>}
      </div>
    </section></div>}
    {detailsOpen && <div className="details-modal"><section className="details-card"><button className="details-close" onClick={closeDetails} aria-label="Cerrar detalles">×</button><span className="celebration-kicker">CONOCE A CATALINA</span><h2>La protagonista de este viaje</h2><div className="details-characters"><div className="details-profile"><img src={profile} alt="Card de perfil de Catalina" /><strong>CATALINA</strong><small>Chile → Brasil</small></div><div className="details-sprite"><img src={catalinaFront} alt="Catalina de frente" /><span>Su look de aventurera</span></div></div><p>Haz clic en la X cuando quieras volver a la aventura.</p></section></div>}
    {celebration !== null && <div className="celebration-modal"><section className="celebration-card"><span className="celebration-kicker">PARA CATALINA</span><div className="celebration-hearts">♥　♥　♥</div><p>{loveMessages[celebration]}</p><div className="celebration-dots">{loveMessages.map((_, index) => <button key={index} className={index === celebration ? "active" : ""} aria-label={`Mensaje ${index + 1}`} onClick={() => setCelebration(index)} />)}</div><div className="celebration-actions"><button onClick={previousMessage} aria-label="Mensaje anterior">←</button><span>{celebration + 1} / {loveMessages.length}</span><button onClick={nextMessage} aria-label="Siguiente mensaje">→</button></div><button className="celebration-finish" onClick={nextMessage}>VER NUESTRO FINAL <b>♥</b></button><small>Con amor, Elias</small></section></div>}
    {togetherOpen && <div className="together-modal"><section className="together-card"><button className="details-close" onClick={() => setTogetherOpen(false)} aria-label="Cerrar final">×</button><span className="celebration-kicker">EL MISMO DESTINO</span><h2>Juntos, por fin</h2><div className="together-characters"><div><img src={catalinaFront} alt="Catalina" /><strong>CATALINA</strong></div><div className="together-heart">♥</div><div><img src={eliasSprite} alt="Elias" /><strong>ELIAS</strong></div></div><p>Dos corazones, un viaje y toda una vida por delante.</p><small>Con amor, siempre.</small></section></div>}
    {victory && <div className="airport-modal"><section className="airport-quest airport-victory"><span className="airport-kicker">DESTINO ALCANZADO</span><h2>Embarque autorizado</h2><p>Pasaste por el check-in, la seguridad y la puerta.</p><button onClick={victory}>JUGAR DE NUEVO</button></section></div>}
  </main>;
}
