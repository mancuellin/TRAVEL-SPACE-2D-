import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Cable,
  CheckCircle2,
  Compass,
  PenTool,
  Wind,
  Wrench,
} from 'lucide-react';
import { MinigameKind } from '../engine/missionOperation';
import { ThemePalette } from '../types/game';
import { DirectorReaction } from './DirectorHud';
import {
  BIROME_SPRITE_SRC,
  COUPLED_SHIP_SPRITE_SRC,
  STATION_DOCK_CLOSEUP_SRC,
  STATION_SPRITE_SHEET_SRC,
  loadCleanSpaceStationSprite,
  loadCleanSprite,
  loadStationDockingTextures,
} from '../utils/spriteLoader';
import { useLanguage } from '../i18n/LanguageContext';
import { playDockingConnectSfx } from '../utils/uiAudio';

const EAGLE_INTERIOR_BG = '/assets/aistudio/imagen_1_c0ce89fa.jpg';

interface OperationMinigamesProps {
  kind: MinigameKind;
  theme: ThemePalette;
  onComplete: (kind: MinigameKind) => void;
  onDirectorReaction?: (cue: DirectorReaction) => void;
}

export const OperationMinigames: React.FC<OperationMinigamesProps> = ({
  kind,
  theme,
  onComplete,
  onDirectorReaction,
}) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const onReactionRef = useRef(onDirectorReaction);
  onReactionRef.current = onDirectorReaction;

  const emitReaction = useCallback((cue: DirectorReaction) => {
    onReactionRef.current?.(cue);
  }, []);

  const completeCables = useCallback(() => onCompleteRef.current('cables'), []);
  const completeBirome = useCallback(() => onCompleteRef.current('birome'), []);
  const completeOxygen = useCallback(() => onCompleteRef.current('oxygen'), []);
  const completeDocking = useCallback(() => onCompleteRef.current('docking'), []);
  const completeStationDocking = useCallback(
    () => onCompleteRef.current('station_docking'),
    []
  );

  const isEagleInterior =
    kind === 'cables' || kind === 'birome' || kind === 'oxygen';
  const isWideModal = kind === 'station_docking';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/25 p-4 pb-28 md:pb-24">
      <div
        className={`relative w-full ${
          isWideModal ? 'max-w-3xl' : 'max-w-xl'
        } bg-[#0a0f1d]/45 backdrop-blur-[2px] border-2 border-[#d69638] shadow-[0_0_0_2px_#07090d,0_16px_42px_rgba(0,0,0,0.55)] overflow-hidden`}
      >
        {isEagleInterior && (
          <>
            <img
              src={EAGLE_INTERIOR_BG}
              alt={en ? 'Interior of the Eagle lunar module' : 'Interior del módulo lunar Eagle'}
              className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#090d18]/40 via-[#090d18]/18 to-[#090d18]/45 pointer-events-none" />
          </>
        )}

        <div className="relative z-10">
          {kind === 'cables' && (
            <CablesMinigame
              theme={theme}
              onDone={completeCables}
              onReact={emitReaction}
            />
          )}
          {kind === 'birome' && (
            <BiromeMinigame
              theme={theme}
              onDone={completeBirome}
              onReact={emitReaction}
            />
          )}
          {kind === 'oxygen' && (
            <OxygenMinigame
              theme={theme}
              onDone={completeOxygen}
              onReact={emitReaction}
            />
          )}
          {kind === 'docking' && (
            <DockingMinigame
              theme={theme}
              onDone={completeDocking}
              onReact={emitReaction}
            />
          )}
          {kind === 'station_docking' && (
            <StationDockingMinigame
              theme={theme}
              onDone={completeStationDocking}
              onReact={emitReaction}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CUADRITO EN LA ESQUINA SUPERIOR DERECHA ("QUÉ ARREGLAR")
// ============================================================================
const FixObjectiveBox: React.FC<{
  title?: string;
  task: string;
  progress?: string;
  tone?: 'amber' | 'rose' | 'sky' | 'emerald';
}> = ({ title, task, progress, tone = 'amber' }) => {
  const { lang } = useLanguage();
  const resolvedTitle = title ?? (lang === 'en' ? 'WHAT TO FIX' : 'QUÉ ARREGLAR');
  const toneBorder =
    tone === 'rose'
      ? '#e05368'
      : tone === 'sky'
        ? '#38bdf8'
        : tone === 'emerald'
          ? '#34d399'
          : '#f6cf6e';

  return (
    <div
      className="shrink-0 max-w-[205px] bg-[#0a0f1d]/55 backdrop-blur-[2px] border-2 px-2.5 py-2"
      style={{ borderColor: toneBorder }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-pixel text-[9px] font-bold tracking-wider uppercase"
          style={{ color: toneBorder }}
        >
          {resolvedTitle}
        </span>
        {progress && (
          <span className="font-mono-tech text-[10px] font-bold text-[#f3f0e6] bg-[#232834] border border-[#3c4252] px-1.5 py-0.5">
            {progress}
          </span>
        )}
      </div>
      <div className="font-display text-xs font-medium text-[#f3f0e6] leading-tight mt-1">
        {task}
      </div>
    </div>
  );
};

// ============================================================================
// 1) MINIJUEGO DE CABLES (SPRITE OPCIÓN 3 · INTERIOR DEL EAGLE)
// ============================================================================
const CABLES_PANEL_SPRITE = '/assets/game/cables_panel.jpg';

const WIRE_PAIRS = [
  {
    id: 'power',
    label: 'Bus Principal',
    labelEn: 'Main Bus',
    code: 'PWR-01',
    color: '#3b82f6',
    highlight: '#93c5fd',
    yPx: 123.5,
    yPct: 19.76,
  },
  {
    id: 'telemetry',
    label: 'Telemetría AGC',
    labelEn: 'AGC Telemetry',
    code: 'TLM-02',
    color: '#22d3ee',
    highlight: '#a5f3fc',
    yPx: 254.5,
    yPct: 40.72,
  },
  {
    id: 'ignition',
    label: 'Ignición Ascenso',
    labelEn: 'Ascent Ignition',
    code: 'IGN-03',
    color: '#a855f7',
    highlight: '#e9d5ff',
    yPx: 381.0,
    yPct: 60.96,
  },
  {
    id: 'control',
    label: 'Control RCS',
    labelEn: 'RCS Control',
    code: 'RCS-04',
    color: '#cbd5e1',
    highlight: '#f8fafc',
    yPx: 512.0,
    yPct: 81.92,
  },
];

// Orden cruzado en el riel derecho para el rompecabezas de conexión por color
const RIGHT_ORDER = ['ignition', 'power', 'control', 'telemetry'];

const CablesMinigame: React.FC<{
  theme: ThemePalette;
  onDone: () => void;
  onReact: (cue: DirectorReaction) => void;
}> = ({ theme, onDone, onReact }) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pointerSvg, setPointerSvg] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const doneSentRef = useRef(false);
  const selectedLeftRef = useRef<string | null>(null);

  const selectLeft = useCallback((id: string | null) => {
    selectedLeftRef.current = id;
    setSelectedLeft(id);
  }, []);

  const rightList = useMemo(
    () =>
      RIGHT_ORDER.map((id, idx) => ({
        wire: WIRE_PAIRS.find((w) => w.id === id)!,
        slotYPx: WIRE_PAIRS[idx].yPx,
        slotYPct: WIRE_PAIRS[idx].yPct,
      })),
    []
  );

  const allDone = connected.length === WIRE_PAIRS.length;

  useEffect(() => {
    onReact({
      mood: 'bad',
      text: en
        ? 'Attention crew! The Eagle wiring harness was severed. Connect each left terminal to its matching color pair.'
        : '¡Atención tripulación! Se cortó el haz de cables del Eagle. Conecta cada terminal izquierdo con su par del mismo color.',
    });
  }, [en, onReact]);

  const triggerDone = useCallback(() => {
    if (doneSentRef.current) return;
    doneSentRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!allDone) return;
    const t = window.setTimeout(triggerDone, 650);
    return () => window.clearTimeout(t);
  }, [allDone, triggerDone]);

  const handleRightClick = useCallback(
    (rightId: string) => {
      const currentLeft = selectedLeftRef.current;
      if (!currentLeft || connected.includes(rightId)) return;
      selectedLeftRef.current = null;
      setSelectedLeft(null);
      setPointerSvg(null);

      if (currentLeft === rightId) {
        const next = [...connected, rightId];
        setConnected(next);
        setErrorMsg(null);
        const wire = WIRE_PAIRS.find((w) => w.id === rightId);
        if (next.length === WIRE_PAIRS.length) {
          onReact({
            mood: 'good',
            text: en
              ? 'Excellent! All internal wiring on the Eagle is restored. Continuing the operation.'
              : '¡Excelente! Todo el cableado interno del Eagle está restablecido. Seguimos con la operación.',
          });
        } else {
          onReact({
            mood: 'good',
            text: en
              ? `Well done, line ${wire?.code ?? ''} reconnected (${next.length}/${WIRE_PAIRS.length}).`
              : `Bien hecho, línea ${wire?.code ?? ''} reconectada (${next.length}/${WIRE_PAIRS.length}).`,
          });
        }
      } else {
        setErrorMsg(
          en
            ? 'Wrong polarity: match each wire to its receiver of the same color and code.'
            : 'Polaridad incorrecta: une cada cable con su receptor del mismo color y código.'
        );
        onReact({
          mood: 'bad',
          text: en
            ? 'Careful, crossed polarity! That could cause a short circuit; double-check the color.'
            : '¡Cuidado, polaridad cruzada! Eso puede generar un corto; revisa bien el color.',
        });
      }
    },
    [connected, en, onReact]
  );

  const updatePointerPos = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectedLeftRef.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 672;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 625;
    setPointerSvg({
      x: Math.max(85, Math.min(585, x)),
      y: Math.max(25, Math.min(600, y)),
    });
  };

  const activeLeftWire = selectedLeft
    ? WIRE_PAIRS.find((w) => w.id === selectedLeft) ?? null
    : null;

  return (
    <div className="p-5 md:p-6 space-y-3.5">
      <div className="flex items-start justify-between gap-3 border-b-2 border-[#353b4a] pb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 pixel-slot-gold flex items-center justify-center shrink-0">
            <Cable className="w-5 h-5 text-[#f8d274]" />
          </div>
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-[#f8d274]">
              {en ? 'Eagle Interior · MK11 Emergency' : 'Interior del Eagle · Emergencia MK11'}
            </div>
            <h3 className="font-display text-xl font-bold text-[#f3f0e6]">
              {en ? 'Reconnect Electrical Panel' : 'Reconectar Panel Eléctrico'}
            </h3>
          </div>
        </div>

        {/* Cuadrito superior derecho con lo que hay que arreglar */}
        <FixObjectiveBox
          task={en ? 'Connect all 4 matching colored wires' : 'Unir los 4 cables del mismo color'}
          progress={`${connected.length}/${WIRE_PAIRS.length}`}
          tone={allDone ? 'emerald' : 'amber'}
        />
      </div>

      <p className="font-display text-sm text-[#d4d8e4] leading-snug">
        {en
          ? 'Vibration shook loose the 4 main conductors (blue, cyan, purple, and gray). Click or drag from a left terminal to its matching colored port on the right.'
          : 'La vibración soltó los 4 conductores principales (azul, celeste, violeta y gris). Haz clic o arrastra desde un conector izquierdo hasta su par derecho del mismo color.'}
      </p>

      {/* Interactive sprite board using OPCIÓN 3 cables panel */}
      <div className="flex justify-center">
        <div
          ref={boardRef}
          onPointerMove={updatePointerPos}
          onPointerLeave={() => setPointerSvg(null)}
          className="relative w-full max-w-[390px] aspect-[672/625] overflow-hidden border-2 border-[#080a0f] shadow-[0_4px_0_#080a0f] select-none bg-[#0b101d]/65 backdrop-blur-[2px]"
        >
          <img
            src={CABLES_PANEL_SPRITE}
            alt={en ? 'Eagle electrical wiring panel' : 'Panel eléctrico de cables del Eagle'}
            className="w-full h-full object-fill pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* SVG animated/connected pixel-styled braided cables */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            viewBox="0 0 672 625"
            preserveAspectRatio="none"
          >
            {connected.map((id) => {
              const leftWire = WIRE_PAIRS.find((w) => w.id === id);
              const rightSlot = rightList.find((r) => r.wire.id === id);
              if (!leftWire || !rightSlot) return null;
              const x1 = 112;
              const y1 = leftWire.yPx;
              const x2 = 552;
              const y2 = rightSlot.slotYPx;
              const d = `M ${x1} ${y1} C 280 ${y1}, 390 ${y2}, ${x2} ${y2}`;
              return (
                <g key={id}>
                  <path
                    d={d}
                    stroke="#090d16"
                    strokeWidth="20"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d={d}
                    stroke={leftWire.color}
                    strokeWidth="13"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d={d}
                    stroke={leftWire.highlight}
                    strokeWidth="3.5"
                    strokeDasharray="10 8"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.9"
                  />
                  <circle cx={x1} cy={y1} r="8" fill="#fef08a" opacity="0.85" />
                  <circle cx={x2} cy={y2} r="8" fill="#fef08a" opacity="0.85" />
                </g>
              );
            })}

            {/* Live dragged / hovered preview wire from selected left terminal */}
            {activeLeftWire && pointerSvg && (
              <g>
                <path
                  d={`M 112 ${activeLeftWire.yPx} C 245 ${activeLeftWire.yPx}, ${(112 + pointerSvg.x) * 0.55} ${pointerSvg.y}, ${pointerSvg.x} ${pointerSvg.y}`}
                  stroke="#090d16"
                  strokeWidth="18"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.7"
                />
                <path
                  d={`M 112 ${activeLeftWire.yPx} C 245 ${activeLeftWire.yPx}, ${(112 + pointerSvg.x) * 0.55} ${pointerSvg.y}, ${pointerSvg.x} ${pointerSvg.y}`}
                  stroke={activeLeftWire.color}
                  strokeWidth="11"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle
                  cx={pointerSvg.x}
                  cy={pointerSvg.y}
                  r="9"
                  fill={activeLeftWire.highlight}
                />
              </g>
            )}
          </svg>

          {/* Left rail interactive terminals (Azúl, Celeste, Violeta, Gris) */}
          {WIRE_PAIRS.map((w) => {
            const isConn = connected.includes(w.id);
            const isSel = selectedLeft === w.id;
            return (
              <button
                key={`L-${w.id}`}
                type="button"
                disabled={isConn}
                onPointerDown={(e) => {
                  if (isConn) return;
                  setErrorMsg(null);
                  selectLeft(w.id);
                  if (boardRef.current) {
                    const rect = boardRef.current.getBoundingClientRect();
                    setPointerSvg({
                      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * 672,
                      y: w.yPx,
                    });
                  }
                }}
                style={{
                  top: `${w.yPct}%`,
                  transform: 'translateY(-50%)',
                  borderColor: isSel
                    ? '#fef08a'
                    : isConn
                      ? w.highlight
                      : 'rgba(255,255,255,0.28)',
                  boxShadow: isSel
                    ? `0 0 16px ${w.color}`
                    : isConn
                      ? `0 0 10px ${w.color}88`
                      : undefined,
                }}
                className="absolute left-[2.5%] z-20 w-[23%] h-[11.5%] border-2 bg-[#131722]/90 hover:bg-[#1e2436] flex items-center justify-between px-2 transition cursor-pointer disabled:cursor-default"
                title={`${en ? w.labelEn : w.label} (${w.code})`}
              >
                <span className="font-mono-tech text-[10px] font-bold text-white drop-shadow">
                  {w.code}
                </span>
                <span
                  className="w-3.5 h-3.5 border border-white/70 shrink-0"
                  style={{ backgroundColor: w.color }}
                />
              </button>
            );
          })}

          {/* Right rail color-matched interactive sockets positioned over the board's 4 copper tips */}
          {rightList.map(({ wire: w, slotYPct }) => {
            const isConn = connected.includes(w.id);
            const canClick = Boolean(selectedLeft) && !isConn;
            return (
              <button
                key={`R-${w.id}`}
                type="button"
                disabled={!canClick && !isConn}
                onPointerUp={() => {
                  if (canClick) handleRightClick(w.id);
                }}
                onClick={() => {
                  if (canClick) handleRightClick(w.id);
                }}
                style={{
                  top: `${slotYPct}%`,
                  transform: 'translateY(-50%)',
                  backgroundColor: isConn ? `${w.color}cc` : `${w.color}38`,
                  borderColor: isConn
                    ? w.highlight
                    : canClick
                      ? w.color
                      : 'rgba(255,255,255,0.28)',
                  boxShadow: isConn
                    ? `0 0 10px ${w.color}`
                    : canClick
                      ? `0 0 8px ${w.color}66`
                      : undefined,
                }}
                className="absolute right-[2.5%] z-20 w-[24%] h-[11.5%] border-2 flex items-center justify-between px-2 transition cursor-pointer disabled:cursor-default"
                title={en ? `Connect ${w.code}` : `Conectar ${w.code}`}
              >
                <span
                  className="w-3.5 h-3.5 border border-white/80 shrink-0"
                  style={{ backgroundColor: w.color }}
                />
                <span className="font-mono-tech text-[10px] font-bold text-white drop-shadow">
                  {isConn ? 'OK' : w.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="font-display text-xs text-[#ffdce1] bg-[#591620] border-2 border-[#e05368] px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#fda4af]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {allDone && (
        <button
          type="button"
          onClick={triggerDone}
          className="w-full py-3 pixel-btn-gold font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {en ? 'Power Restored · Continue' : 'Energía Restablecida · Continuar'}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 2) CAMEO APOLO 11: PALANCA ROTA + BIROME (INTERIOR DEL EAGLE)
// ============================================================================
function getCabinItems(en: boolean) {
  return [
    {
      id: 'manual',
      name: en ? 'MK11 Flight Manual' : 'Manual de Vuelo MK11',
      hint: en
        ? 'Laminated checklist paper. Too soft and too wide for the circuit breaker.'
        : 'Papel laminado de listas de verificación. Es demasiado blando y ancho para el disyuntor.',
      correct: false,
    },
    {
      id: 'glove',
      name: en ? 'Pressurized EVA Glove' : 'Guante EVA Presurizado',
      hint: en
        ? 'Far too bulky to fit into the 3 mm slot where the lever snapped off.'
        : 'Demasiado voluminoso para entrar en la ranura de 3 mm donde se rompió la palanca.',
      correct: false,
    },
    {
      id: 'birome',
      name: en ? 'Cabin Ballpoint Pen' : 'Birome de cabina',
      hint: en
        ? 'Exact match! A sturdy fine-tip ballpoint pen fits right into the broken breaker contact.'
        : '¡Exacto! Un bolígrafo de punta fina resistente que entra perfecto en el contacto del interruptor roto.',
      correct: true,
    },
    {
      id: 'bag',
      name: en ? 'Lunar Sample Bag' : 'Bolsa de Muestras Lunares',
      hint: en
        ? 'Contains sealed lunar regolith. Cannot push the internal mechanism.'
        : 'Contiene regolito lunar sellado. No puede empujar el mecanismo interno.',
      correct: false,
    },
  ];
}

const BiromeSpriteCanvas: React.FC<{
  width?: number;
  height?: number;
  className?: string;
}> = ({ width = 188, height = 52, className = '' }) => {
  const { lang } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sprite = useMemo(
    () => loadCleanSprite(BIROME_SPRITE_SRC, 0, 1, 0, 1, 38),
    []
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (sprite.ready) return;
    let id = 0;
    const poll = () => {
      if (sprite.ready) {
        setTick((v) => v + 1);
      } else {
        id = requestAnimationFrame(poll);
      }
    };
    id = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(id);
  }, [sprite]);

  useEffect(() => {
    void tick;
    const canvas = canvasRef.current;
    if (!canvas || !sprite.ready) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    // Pen diagonal runs from bottom-left (metal tip) to top-right (blue cap).
    // Rotating clockwise by atan2(H, W) aligns tip straight left (-x) and cap right (+x).
    const rotRad = Math.atan2(sprite.height, sprite.width);
    const diagLen = Math.hypot(sprite.width, sprite.height);
    const scale = Math.min((width * 0.94) / Math.max(1, diagLen), 1.4);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(rotRad);
    ctx.scale(scale, scale);
    ctx.drawImage(
      sprite.canvas,
      -sprite.width * 0.5,
      -sprite.height * 0.5,
      sprite.width,
      sprite.height
    );
    ctx.restore();
  }, [sprite, tick, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, imageRendering: 'pixelated' }}
      className={className}
      aria-label={lang === 'en' ? 'Cabin BIC ballpoint pen' : 'Bolígrafo BIC de cabina'}
    />
  );
};

const BiromeMinigame: React.FC<{
  theme: ThemePalette;
  onDone: () => void;
  onReact: (cue: DirectorReaction) => void;
}> = ({ onDone, onReact }) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const cabinItems = useMemo(() => getCabinItems(en), [en]);
  const [foundBirome, setFoundBirome] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const doneSentRef = useRef(false);

  useEffect(() => {
    onReact({
      mood: 'bad',
      text: en
        ? 'Alert! The ascent engine circuit-breaker switch snapped off in the Eagle. Find something thin in the cabin to push it.'
        : '¡Alerta! Se quebró la palanca del disyuntor del motor de ascenso en el Eagle. Busquen algo fino en la cabina para accionarlo.',
    });
  }, [en, onReact]);

  const triggerDone = useCallback(() => {
    if (doneSentRef.current) return;
    doneSentRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!activated) return;
    const t = window.setTimeout(triggerDone, 780);
    return () => window.clearTimeout(t);
  }, [activated, triggerDone]);

  const handleInsert = () => {
    if (activated) {
      triggerDone();
      return;
    }
    setActivated(true);
    onReact({
      mood: 'good',
      text: en
        ? 'Breaker armed successfully with the BIC pen! Ascent engine responds nominally.'
        : '¡Disyuntor armado con éxito gracias al birome BIC! El motor de ascenso responde nominalmente.',
    });
  };

  return (
    <div className="p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b-2 border-[#353b4a] pb-3.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 pixel-slot flex items-center justify-center shrink-0 border-[#e05368]">
            <Wrench className="w-5 h-5 text-[#fda4af]" />
          </div>
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-[#fda4af]">
              {en ? 'Eagle Interior · Apollo 11 Cameo' : 'Interior del Eagle · Cameo Apolo 11'}
            </div>
            <h3 className="font-display text-xl font-bold text-[#f3f0e6]">
              {en ? 'Broken Engine Breaker Switch' : 'Palanca del Motor Rota'}
            </h3>
          </div>
        </div>

        {/* Cuadrito superior derecho con lo que hay que arreglar */}
        <FixObjectiveBox
          task={
            activated
              ? en
                ? 'Breaker properly armed'
                : 'Disyuntor armado correctamente'
              : foundBirome
                ? en
                  ? 'Insert the ballpoint pen into the broken breaker'
                  : 'Insertar el birome en el disyuntor roto'
                : en
                  ? 'Find a thin object (ballpoint pen) in the cabin'
                  : 'Buscar un objeto fino (birome) en cabina'
          }
          progress={activated ? (en ? 'READY' : 'LISTO') : foundBirome ? '2/2' : '1/2'}
          tone={activated ? 'emerald' : 'rose'}
        />
      </div>

      <p className="font-display text-sm text-[#d4d8e4] leading-snug">
        {en
          ? 'Inside the Eagle cabin, the circuit-breaker toggle that arms the lunar ascent engine snapped off. Just like on Apollo 11, find an everyday object to push it.'
          : 'Dentro de la cabina del Eagle se quebró la palanca del disyuntor que arma el motor de ascenso lunar. Como ocurrió en el Apolo 11, encuentra un objeto útil para accionarlo.'}
      </p>

      {!foundBirome ? (
        <div className="space-y-3">
          <div className="font-pixel text-[10px] uppercase tracking-wider text-[#9aa4bd]">
            {en ? 'Step 1 · Search items inside the Eagle' : 'Paso 1 · Revisar objetos dentro del Eagle'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cabinItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFeedback(item.hint);
                  if (item.correct) {
                    setFoundBirome(true);
                    onReact({
                      mood: 'good',
                      text: en
                        ? 'Great, you found the BIC ballpoint pen! Now insert it into the ascent engine circuit breaker.'
                        : '¡Genial, encontraron el birome BIC! Ahora insértenlo en el disyuntor del motor de ascenso.',
                    });
                  } else {
                    onReact({
                      mood: 'bad',
                      text: en
                        ? `Negative, ${item.name} won't fit that slot. Keep searching the cabin.`
                        : `Negativo, ${item.name} no sirve para esa ranura. Sigan buscando en la cabina.`,
                    });
                  }
                }}
                className="p-3.5 bg-[#121829]/55 hover:bg-[#1b243b]/70 backdrop-blur-[2px] border-2 border-[#4d5466]/90 shadow-[0_3px_0_#07090d] transition-colors text-left cursor-pointer"
              >
                <div className="font-display font-bold text-sm text-[#f3f0e6] flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-[#7dd3fc]" />
                  {item.name}
                </div>
                <div className="font-pixel text-[9px] text-[#9aa4bd] mt-1">
                  {en ? 'INSPECT ITEM' : 'EXAMINAR OBJETO'}
                </div>
              </button>
            ))}
          </div>
          {feedback && (
            <div className="font-display text-xs text-[#fde68a] bg-[#3b2c15]/75 backdrop-blur-[2px] border-2 border-[#d69638] px-3 py-2">
              {feedback}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="font-display text-xs text-[#dcfce7] bg-[#195e3d]/75 backdrop-blur-[2px] border-2 border-[#4ade80] px-3 py-2">
            {feedback}
          </div>

          <div className="bg-[#0b101d]/65 backdrop-blur-[2px] border-2 border-[#3c4252] p-5 flex flex-col items-center gap-4">
            <div className="font-pixel text-[10px] tracking-wider text-[#9aa4bd] uppercase">
              {en ? 'BREAKER · ASCENT ENGINE ARM' : 'DISYUNTOR · ASCENT ENGINE ARM'}
            </div>

            <div className="relative flex items-center justify-center py-2 px-3 w-full max-w-md">
              {/* Broken circuit-breaker socket */}
              <div
                className={`relative w-32 h-24 border-2 flex flex-col items-center justify-center transition-all duration-300 ${
                  activated
                    ? 'border-[#4ade80] bg-[#195e3d]/70 shadow-[0_0_22px_rgba(74,222,128,0.35)]'
                    : 'border-[#e05368] bg-[#591620]/65'
                }`}
              >
                {/* 3mm slot on right edge where the BIC pen tip inserts */}
                <div
                  className={`w-10 h-4 border-2 mb-1.5 flex items-center justify-end pr-0.5 transition-colors ${
                    activated
                      ? 'bg-[#0b3b24] border-[#86efac]'
                      : 'bg-[#080a0f] border-[#64748b]'
                  }`}
                >
                  <div
                    className={`w-2.5 h-1.5 rounded-xs transition-all ${
                      activated ? 'bg-[#4ade80] shadow-[0_0_8px_#4ade80]' : 'bg-[#e05368]/60'
                    }`}
                  />
                </div>
                <span
                  className={`font-pixel text-[10px] font-bold ${
                    activated ? 'text-[#86efac]' : 'text-[#fda4af]'
                  }`}
                >
                  {activated ? (en ? 'ARMED' : 'ARMADO') : en ? 'BROKEN' : 'ROTO'}
                </span>
              </div>

              {/* Interactive BIC Pen Sprite sliding cleanly into the breaker slot */}
              <button
                type="button"
                onClick={handleInsert}
                title={
                  activated
                    ? en
                      ? 'BIC pen inserted'
                      : 'Birome BIC insertado'
                    : en
                      ? 'Click to insert the BIC pen'
                      : 'Haz clic para insertar el birome BIC'
                }
                className={`group relative flex items-center cursor-pointer transition-all duration-300 ease-out focus:outline-none ${
                  activated
                    ? '-translate-x-11 scale-[1.03]'
                    : 'translate-x-2 hover:-translate-x-1 hover:scale-[1.04]'
                }`}
              >
                <BiromeSpriteCanvas
                  width={186}
                  height={56}
                  className="drop-shadow-[0_4px_12px_rgba(251,146,60,0.45)]"
                />
                {!activated && (
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-[8px] text-[#f8d274] opacity-85 group-hover:opacity-100">
                    {en ? '◄ INSERT BIC PEN' : '◄ INSERTAR BIROME BIC'}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleInsert}
              className={`w-full py-3 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${
                activated ? 'pixel-btn-emerald' : 'pixel-btn-gold'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {activated
                ? en
                  ? 'Breaker Armed! Continuing...'
                  : '¡Disyuntor Armado! Continuando...'
                : en
                  ? 'Insert Pen & Arm Breaker'
                  : 'Insertar Birome y Armar Disyuntor'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3) MINIJUEGO OBLIGATORIO DE ACOPLAMIENTO EN ÓRBITA (ASCENSO <-> RETORNO)
// ============================================================================
const DockingMinigame: React.FC<{
  theme: ThemePalette;
  onDone: () => void;
  onReact: (cue: DirectorReaction) => void;
}> = ({ theme, onDone, onReact }) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [offset, setOffset] = useState({ x: 64, y: -44 });
  const [docked, setDocked] = useState(false);
  const doneSentRef = useRef(false);
  const prevAlignedRef = useRef(false);

  const distance = Math.hypot(offset.x, offset.y);
  const aligned = distance <= 14;

  useEffect(() => {
    onReact({
      mood: 'neutral',
      text: en
        ? 'Mandatory orbital docking maneuver. Align the 3 docking latches with Pilot Christina.'
        : 'Maniobra obligatoria de unión en órbita. Alinea los 3 pestillos de acoplamiento con la Pilota Christina.',
    });
  }, [en, onReact]);

  useEffect(() => {
    if (docked) return;
    if (aligned && !prevAlignedRef.current) {
      prevAlignedRef.current = true;
      onReact({
        mood: 'good',
        text: en
          ? 'Perfect alignment on the docking ring! Press Dock Union Parts now.'
          : '¡Alineación perfecta en el anillo de unión! Pulsa Acoplar Partes de Unión ahora.',
      });
    } else if (!aligned && prevAlignedRef.current) {
      prevAlignedRef.current = false;
      onReact({
        mood: 'bad',
        text: en
          ? 'Center alignment lost! Correct course with the RCS thrusters.'
          : '¡Se perdió la alineación central! Corrige con los propulsores RCS.',
      });
    }
  }, [aligned, docked, en, onReact]);

  const triggerDone = useCallback(() => {
    if (doneSentRef.current) return;
    doneSentRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (docked || aligned) return;
    const id = window.setInterval(() => {
      setOffset((prev) => ({
        x: Math.max(-90, Math.min(90, prev.x + Math.sin(Date.now() / 500) * 1.4)),
        y: Math.max(-75, Math.min(75, prev.y + Math.cos(Date.now() / 620) * 1.2)),
      }));
    }, 90);
    return () => window.clearInterval(id);
  }, [docked, aligned]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (docked) return;
      setOffset((prev) => ({
        x: Math.max(-95, Math.min(95, prev.x + dx)),
        y: Math.max(-80, Math.min(80, prev.y + dy)),
      }));
    },
    [docked]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (docked) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        nudge(0, -10);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        nudge(0, 10);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        nudge(-10, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        nudge(10, 0);
      } else if ((e.code === 'Space' || e.code === 'Enter') && aligned) {
        e.preventDefault();
        setDocked(true);
        playDockingConnectSfx();
        onReact({
          mood: 'good',
          text: en
            ? 'Hard dock confirmed! Firing engines back toward Earth.'
            : '¡Acople duro confirmado! Encendemos motores de regreso hacia la Tierra.',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docked, aligned, en, nudge, onReact]);

  useEffect(() => {
    if (!docked) return;
    const t = window.setTimeout(triggerDone, 650);
    return () => window.clearTimeout(t);
  }, [docked, triggerDone]);

  return (
    <div className="p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b-2 border-[#353b4a] pb-3.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 pixel-slot-gold flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-[#7dd3fc]" />
          </div>
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-[#7dd3fc]">
              {en ? 'Lunar Orbit · Mandatory Maneuver' : 'Órbita Lunar · Maniobra Obligatoria'}
            </div>
            <h3 className="font-display text-xl font-bold text-[#f3f0e6]">
              {en ? 'Dock Union Parts (Eagle ↔ Return)' : 'Acoplar Partes de Unión (Eagle ↔ Retorno)'}
            </h3>
          </div>
        </div>

        <FixObjectiveBox
          task={en ? 'Align ring to center and dock' : 'Alinear anillo al centro y acoplar'}
          progress={`${distance.toFixed(0)} px`}
          tone={docked || aligned ? 'emerald' : 'sky'}
        />
      </div>

      <p className="font-display text-sm text-[#d4d8e4] leading-snug">
        {en
          ? 'Use the thrusters (arrow keys or buttons) to align the Eagle’s 3 docking latches with the return module and begin the trip back to Earth.'
          : 'Usa los propulsores (flechas o botones) para alinear los 3 pestillos de unión del Eagle con el módulo de retorno y emprender el regreso a la Tierra.'}
      </p>

      <div className="relative h-52 bg-[#0a0f1d]/45 backdrop-blur-[2px] border-2 border-[#3c4252]/90 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-x-0 h-[2px] bg-[#262c3a]" />
        <div className="absolute inset-y-0 w-[2px] bg-[#262c3a]" />

        <div
          className={`relative w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${
            aligned ? 'border-[#4ade80]' : 'border-[#38bdf8]/70'
          }`}
        >
          {[0, 120, 240].map((deg) => (
            <div
              key={deg}
              className="absolute w-3.5 h-3.5 border-2 border-[#7dd3fc] bg-[#0ea5e9]/40"
              style={{
                transform: `rotate(${deg}deg) translateY(-64px)`,
              }}
            />
          ))}
          <span className="font-pixel text-[9px] text-[#7dd3fc]/80">
            {en ? 'RETURN' : 'RETORNO'}
          </span>
        </div>

        <div
          className={`absolute w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-100 ${
            docked
              ? 'border-[#86efac] bg-[#2f9e66]/25 scale-110'
              : aligned
                ? 'border-[#4ade80] bg-[#2f9e66]/15'
                : 'border-[#f8d274] bg-[#d69638]/15'
          }`}
          style={{
            transform: docked
              ? 'translate(0px, 0px)'
              : `translate(${offset.x}px, ${offset.y}px)`,
          }}
        >
          {[0, 120, 240].map((deg) => (
            <div
              key={deg}
              className={`absolute w-3 h-3 border-2 ${
                aligned
                  ? 'bg-[#4ade80] border-white'
                  : 'bg-[#f8d274] border-[#080a0f]'
              }`}
              style={{
                transform: `rotate(${deg}deg) translateY(-48px)`,
              }}
            />
          ))}
          <span className="font-pixel text-[9px] font-bold text-white">
            EAGLE
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-2 w-36 shrink-0">
          <div />
          <button
            type="button"
            onClick={() => nudge(0, -12)}
            className="h-9 pixel-btn flex items-center justify-center cursor-pointer"
            aria-label={en ? 'Up' : 'Arriba'}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div />
          <button
            type="button"
            onClick={() => nudge(-12, 0)}
            className="h-9 pixel-btn flex items-center justify-center cursor-pointer"
            aria-label={en ? 'Left' : 'Izquierda'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div aria-hidden="true" />
          <button
            type="button"
            onClick={() => nudge(12, 0)}
            className="h-9 pixel-btn flex items-center justify-center cursor-pointer"
            aria-label={en ? 'Right' : 'Derecha'}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div />
          <button
            type="button"
            onClick={() => nudge(0, 12)}
            className="h-9 pixel-btn flex items-center justify-center cursor-pointer"
            aria-label={en ? 'Down' : 'Abajo'}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <div />
        </div>

        <button
          type="button"
          disabled={!aligned || docked}
          onClick={() => {
            setDocked(true);
            playDockingConnectSfx();
            onReact({
              mood: 'good',
              text: en
                ? 'Hard dock confirmed! Firing engines back toward Earth.'
                : '¡Acople duro confirmado! Encendemos motores de regreso hacia la Tierra.',
            });
          }}
          className={`flex-1 w-full py-3.5 px-5 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            aligned ? 'pixel-btn-emerald' : 'pixel-btn-gold'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {docked
            ? en
              ? 'Modules Docked! Returning...'
              : '¡Módulos Acoplados! Regresando...'
            : aligned
              ? en
                ? 'Dock Union Parts'
                : 'Acoplar Partes de Unión'
              : en
                ? 'Align to center to dock'
                : 'Alinea al centro para acoplar'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 3B) MINIJUEGO ANIMADO DE ACOPLAMIENTO CON ESTACIÓN ESPACIAL (NAVE COMPLETA)
// ============================================================================
type StationDockStep = 1 | 2 | 3 | 4;

const StationDockingMinigame: React.FC<{
  theme: ThemePalette;
  onDone: () => void;
  onReact: (cue: DirectorReaction) => void;
}> = ({ onDone, onReact }) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [step, setStep] = useState<StationDockStep>(1);
  const [ringAngleDeg, setRingAngleDeg] = useState(36);
  const [offsetY, setOffsetY] = useState(-20);
  const [insertingPhase, setInsertingPhase] = useState<
    'idle' | 'ring_anim' | 'ship_anim' | 'inserted'
  >('idle');
  const [lockingAnim, setLockingAnim] = useState(false);
  const [checkingSeal, setCheckingSeal] = useState(false);
  const [sealVerified, setSealVerified] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneSentRef = useRef(false);
  const prevReadyRef = useRef(false);

  const sprCoupled = useMemo(
    () => loadCleanSprite(COUPLED_SHIP_SPRITE_SRC, 0.3, 0.85),
    []
  );
  const sprStation = useMemo(
    () => loadCleanSpaceStationSprite(STATION_SPRITE_SHEET_SRC),
    []
  );
  const dockTextures = useMemo(
    () => loadStationDockingTextures(STATION_DOCK_CLOSEUP_SRC),
    []
  );

  // Normalize angular error strictly modulo 360 deg (never 120 deg, since tabs are at -90, +90, 0)
  const normAngleErr = useMemo(() => {
    let a = ((ringAngleDeg % 360) + 360) % 360;
    if (a > 180) a -= 360;
    return a;
  }, [ringAngleDeg]);

  const absAngErr = Math.abs(normAngleErr);
  const absYErr = Math.abs(offsetY);

  const tabTopAligned = absAngErr <= 6;
  const tabBottomAligned = absAngErr <= 6 && absYErr <= 8;
  const connectorAligned = absYErr <= 5 && absAngErr <= 8;
  const alignedCount =
    Number(tabTopAligned) + Number(tabBottomAligned) + Number(connectorAligned);
  const allAligned = alignedCount === 3;

  const simRef = useRef({
    smoothAngleDeg: 36,
    smoothOffsetY: -20,
    ringInsertT: 0,
    shipInsertT: 0,
    lockT: 0,
    sealT: 0,
  });

  const stateRef = useRef({
    step,
    ringAngleDeg,
    offsetY,
    insertingPhase,
    lockingAnim,
    checkingSeal,
    sealVerified,
    allAligned,
    tabTopAligned,
    tabBottomAligned,
    connectorAligned,
  });
  stateRef.current = {
    step,
    ringAngleDeg,
    offsetY,
    insertingPhase,
    lockingAnim,
    checkingSeal,
    sealVerified,
    allAligned,
    tabTopAligned,
    tabBottomAligned,
    connectorAligned,
  };

  useEffect(() => {
    onReact({
      mood: 'neutral',
      text: en
        ? 'Approaching Space Station MK-II. Rotate the collar and align all 3 tabs before inserting the full craft.'
        : 'Aproximación a la Estación Espacial MK-II. Gira el aro y alinea las 3 pestañas antes de insertar la nave completa.',
    });
  }, [en, onReact]);

  useEffect(() => {
    if (step !== 1) return;
    if (allAligned && !prevReadyRef.current) {
      prevReadyRef.current = true;
      onReact({
        mood: 'good',
        text: en
          ? '3 of 3 tabs aligned with the slots! Press INSERT to dock the full spacecraft.'
          : '¡3 de 3 pestañas alineadas con las ranuras! Pulsa INSERTAR para acoplar la nave completa.',
      });
    } else if (!allAligned && prevReadyRef.current) {
      prevReadyRef.current = false;
    }
  }, [allAligned, step, en, onReact]);

  const triggerDone = useCallback(() => {
    if (doneSentRef.current) return;
    doneSentRef.current = true;
    onDone();
  }, [onDone]);

  const rotateRing = useCallback((deltaDeg: number) => {
    if (stateRef.current.step !== 1) return;
    setRingAngleDeg((prev) => prev + deltaDeg);
  }, []);

  const moveVertical = useCallback((deltaPx: number) => {
    if (stateRef.current.step !== 1) return;
    setOffsetY((prev) => Math.max(-36, Math.min(36, prev + deltaPx)));
  }, []);

  const handleInsert = useCallback(() => {
    const s = stateRef.current;
    if (s.step !== 1 || !s.allAligned) return;
    setStep(2);
    setInsertingPhase('ring_anim');
    simRef.current.ringInsertT = 0;
    simRef.current.shipInsertT = 0;
    onReact({
      mood: 'good',
      text: en
        ? 'Inserting connector! Firing full-spacecraft thrusters toward the station port.'
        : '¡Insertando conector! Encendiendo propulsores de la nave completa hacia el puerto de la estación.',
    });
  }, [en, onReact]);

  const handleLock = useCallback(() => {
    const s = stateRef.current;
    if (s.step !== 3 || s.lockingAnim) return;
    setLockingAnim(true);
    simRef.current.lockT = 0;
    onReact({
      mood: 'good',
      text: en
        ? 'Securing mechanical latches around the docking collar...'
        : 'Asegurando pestillos mecánicos alrededor del collar de unión...',
    });
  }, [en, onReact]);

  const handleCheckSeal = useCallback(() => {
    const s = stateRef.current;
    if (s.step !== 4 || s.checkingSeal || s.sealVerified) return;
    setCheckingSeal(true);
    simRef.current.sealT = 0;
    onReact({
      mood: 'good',
      text: en
        ? 'Checking pressure and airtight seal between the full spacecraft and the space station...'
        : 'Comprobando presión y sello hermético entre la nave completa y la estación espacial...',
    });
  }, [en, onReact]);

  // Sequence timers driven by 60fps canvas animation progress
  useEffect(() => {
    if (insertingPhase === 'ring_anim') {
      const t = window.setTimeout(() => {
        setInsertingPhase('ship_anim');
      }, 900);
      return () => window.clearTimeout(t);
    }
    if (insertingPhase === 'ship_anim') {
      const t = window.setTimeout(() => {
        setInsertingPhase('inserted');
        playDockingConnectSfx();
        setStep(3);
        onReact({
          mood: 'good',
          text: en
            ? 'Full spacecraft inserted into the station! Now press LOCK to secure the ring.'
            : '¡Nave completa insertada en la estación! Ahora pulsa BLOQUEAR para asegurar el anillo.',
        });
      }, 2650);
      return () => window.clearTimeout(t);
    }
  }, [insertingPhase, en, onReact]);

  useEffect(() => {
    if (!lockingAnim) return;
    const t = window.setTimeout(() => {
      setLockingAnim(false);
      setStep(4);
      onReact({
        mood: 'good',
        text: en
          ? 'Ring locked! Press CHECK SEAL to verify airtight integrity and begin photography.'
          : '¡Anillo bloqueado! Pulsa COMPROBAR SELLO para confirmar hermeticidad y empezar las fotos.',
      });
    }, 950);
    return () => window.clearTimeout(t);
  }, [lockingAnim, en, onReact]);

  useEffect(() => {
    if (!checkingSeal) return;
    const t = window.setTimeout(() => {
      setCheckingSeal(false);
      setSealVerified(true);
      onReact({
        mood: 'good',
        text: en
          ? 'Airtight seal 100% verified! Crew entering Space Station MK-II.'
          : '¡Sello hermético 100% confirmado! Tripulación entrando a la Estación Espacial MK-II.',
      });
    }, 1050);
    return () => window.clearTimeout(t);
  }, [checkingSeal, en, onReact]);

  useEffect(() => {
    if (!sealVerified) return;
    const t = window.setTimeout(triggerDone, 900);
    return () => window.clearTimeout(t);
  }, [sealVerified, triggerDone]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.step === 1) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          rotateRing(-6);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          rotateRing(6);
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          moveVertical(-4);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          moveVertical(4);
        } else if ((e.code === 'Space' || e.code === 'Enter') && s.allAligned) {
          e.preventDefault();
          handleInsert();
        }
      } else if (e.code === 'Space' || e.code === 'Enter') {
        if (s.step === 3 && !s.lockingAnim) {
          e.preventDefault();
          handleLock();
        } else if (s.step === 4 && !s.checkingSeal && !s.sealVerified) {
          e.preventDefault();
          handleCheckSeal();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotateRing, moveVertical, handleInsert, handleLock, handleCheckSeal]);

  // 60fps Pixel-Art Canvas Renderer for Close-up Alignment + Full-Spacecraft External Insertion
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 560;
    const H = 264;
    canvas.width = W;
    canvas.height = H;

    // Deterministic pixel stars
    const stars: { x: number; y: number; r: number; ph: number; col: string }[] = [];
    let seed = 73;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 72; i++) {
      stars.push({
        x: Math.floor(rnd() * W),
        y: Math.floor(rnd() * H),
        r: i % 7 === 0 ? 2 : 1,
        ph: rnd() * 6.28,
        col: i % 5 === 0 ? '#fde68a' : i % 3 === 0 ? '#bae6fd' : '#ffffff',
      });
    }

    let rafId = 0;
    let last = performance.now();

    const drawPixelRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      stroke?: string
    ) => {
      ctx.fillStyle = fill;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          Math.round(x) + 0.5,
          Math.round(y) + 0.5,
          Math.round(w) - 1,
          Math.round(h) - 1
        );
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tSec = now / 1000;
      const st = stateRef.current;
      const sim = simRef.current;

      // Smooth interpolation
      const blend = 1 - Math.exp(-dt * 14);
      sim.smoothAngleDeg += (st.ringAngleDeg - sim.smoothAngleDeg) * blend;
      sim.smoothOffsetY += (st.offsetY - sim.smoothOffsetY) * blend;

      if (st.insertingPhase === 'ring_anim') {
        sim.ringInsertT = Math.min(1, sim.ringInsertT + dt / 0.85);
      } else if (st.insertingPhase === 'ship_anim') {
        sim.ringInsertT = 1;
        sim.shipInsertT = Math.min(1, sim.shipInsertT + dt / 2.55);
      } else if (st.insertingPhase === 'inserted') {
        sim.ringInsertT = 1;
        sim.shipInsertT = 1;
      } else {
        sim.ringInsertT = 0;
        sim.shipInsertT = 0;
      }

      if (st.lockingAnim) {
        sim.lockT = Math.min(1, sim.lockT + dt / 0.9);
      } else if (st.step >= 4) {
        sim.lockT = 1;
      } else {
        sim.lockT = 0;
      }

      if (st.checkingSeal) {
        sim.sealT = Math.min(1, sim.sealT + dt / 1.0);
      } else if (st.sealVerified) {
        sim.sealT = 1;
      } else {
        sim.sealT = 0;
      }

      // 1) Starry deep purple space backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#090616');
      bgGrad.addColorStop(0.5, '#130b28');
      bgGrad.addColorStop(1, '#080514');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle purple nebula wash
      const neb = ctx.createRadialGradient(W * 0.52, H * 0.45, 20, W * 0.52, H * 0.45, 260);
      neb.addColorStop(0, 'rgba(139, 92, 246, 0.14)');
      neb.addColorStop(0.6, 'rgba(88, 28, 135, 0.08)');
      neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      for (const star of stars) {
        const tw = 0.45 + 0.55 * Math.sin(tSec * 2.4 + star.ph);
        ctx.fillStyle = star.col;
        ctx.globalAlpha = tw;
        ctx.fillRect(star.x, star.y, star.r, star.r);
      }
      ctx.globalAlpha = 1;

      const showExternalScene =
        st.insertingPhase === 'ship_anim' || st.insertingPhase === 'inserted';

      if (!showExternalScene) {
        // ============================================================
        // CLOSE-UP DOCKING RING ALIGNMENT & CONNECTOR INSERTION VIEW
        // Uses authentic pixel-art textures extracted from Image 3!
        // ============================================================
        const insEase =
          sim.ringInsertT * sim.ringInsertT * (3 - 2 * sim.ringInsertT);
        const cy = H * 0.5;
        const leftShiftX = insEase * 142;
        const shiftY = sim.smoothOffsetY * (1 - insEase);

        if (dockTextures.leftCollar.ready && dockTextures.rightBulkhead.ready) {
          const leftW = 248;
          const leftH = leftW * (dockTextures.leftCollar.height / Math.max(1, dockTextures.leftCollar.width));
          const leftDrawX = -6 + leftShiftX;
          const leftDrawY = cy - leftH * 0.5 + shiftY;

          const rightW = 240;
          const rightH = rightW * (dockTextures.rightBulkhead.height / Math.max(1, dockTextures.rightBulkhead.width));
          const rightDrawX = W - rightW + 4;
          const rightDrawY = cy - rightH * 0.5;

          // 1) Draw Right Station Bulkhead & Receiving Ring texture (MK11 //)
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(dockTextures.rightBulkhead.canvas, rightDrawX, rightDrawY, rightW, rightH);
          ctx.restore();

          // Highlight aligned/misaligned target slots on Right Ring
          const topSlotX = rightDrawX + rightW * 0.295;
          const topSlotY = rightDrawY + rightH * 0.144;
          const botSlotX = rightDrawX + rightW * 0.295;
          const botSlotY = rightDrawY + rightH * 0.819;
          const reticleX = rightDrawX + rightW * 0.490;
          const reticleY = rightDrawY + rightH * 0.486;

          ctx.save();
          if (st.tabTopAligned) {
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.strokeRect(topSlotX - 13, topSlotY - 12, 26, 22);
          }
          if (st.tabBottomAligned) {
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.strokeRect(botSlotX - 13, botSlotY - 10, 26, 22);
          }
          if (st.connectorAligned) {
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.strokeRect(reticleX - 16, reticleY - 18, 32, 36);
          }
          ctx.restore();

          // 2) Alignment laser from Left Connector Key tip -> Right Target Reticle
          const ringCx = leftDrawX + leftW * 0.630;
          const ringCy = leftDrawY + leftH * 0.490;
          const ringRx = leftW * 0.254;
          const ringRy = leftH * 0.361;
          const rotRad = (sim.smoothAngleDeg * Math.PI) / 180;
          const keyX = ringCx + Math.cos(rotRad) * ringRx;
          const keyY = ringCy + Math.sin(rotRad) * ringRy;

          if (insEase < 0.9) {
            ctx.save();
            ctx.setLineDash([7, 6]);
            ctx.lineDashOffset = -tSec * 28;
            ctx.strokeStyle = st.allAligned ? '#4ade80' : '#f59e0b';
            ctx.lineWidth = st.allAligned ? 2.8 : 2;
            ctx.beginPath();
            ctx.moveTo(keyX + 12, keyY);
            ctx.lineTo(reticleX - 8, keyY);
            ctx.stroke();
            if (!st.connectorAligned || !st.tabTopAligned) {
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.38)';
              ctx.beginPath();
              ctx.moveTo(reticleX - 8, keyY);
              ctx.lineTo(reticleX - 8, reticleY);
              ctx.stroke();
            }
            ctx.restore();
          }

          // 3) Draw Left Spacecraft Collar & Hull texture
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(dockTextures.leftCollar.canvas, leftDrawX, leftDrawY, leftW, leftH);
          ctx.restore();

          // 4) Draw 3 extracted pixel-art Tabs orbiting around the Left Ring ellipse
          const cyanW = 28;
          const cyanH = dockTextures.tabCyan.ready
            ? cyanW * (dockTextures.tabCyan.height / Math.max(1, dockTextures.tabCyan.width))
            : 30;
          const amberW = 36;
          const amberH = dockTextures.tabAmber.ready
            ? amberW * (dockTextures.tabAmber.height / Math.max(1, dockTextures.tabAmber.width))
            : 44;

          const drawTabAt = (baseDeg: number, isAmberKey: boolean, isAligned: boolean) => {
            const rad = (baseDeg * Math.PI) / 180 + rotRad;
            const tx = ringCx + Math.cos(rad) * ringRx;
            const ty = ringCy + Math.sin(rad) * ringRy;
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(rad - (baseDeg * Math.PI) / 180);
            ctx.imageSmoothingEnabled = false;
            if (isAmberKey && dockTextures.tabAmber.ready) {
              if (isAligned) {
                ctx.shadowColor = '#4ade80';
                ctx.shadowBlur = 10;
              }
              ctx.drawImage(
                dockTextures.tabAmber.canvas,
                -amberW * 0.5,
                -amberH * 0.5,
                amberW,
                amberH
              );
            } else if (!isAmberKey && dockTextures.tabCyan.ready) {
              if (isAligned) {
                ctx.shadowColor = '#4ade80';
                ctx.shadowBlur = 8;
              }
              ctx.drawImage(
                dockTextures.tabCyan.canvas,
                -cyanW * 0.5,
                -cyanH * 0.5,
                cyanW,
                cyanH
              );
            } else {
              drawPixelRect(-10, -10, 20, 20, isAmberKey ? '#f59e0b' : '#2dd4bf', '#080a0f');
            }
            ctx.restore();
          };

          drawTabAt(-90, false, st.tabTopAligned);
          drawTabAt(90, false, st.tabBottomAligned);
          drawTabAt(0, true, st.connectorAligned && st.allAligned);

          if (insEase > 0.72) {
            for (let k = 0; k < 8; k++) {
              const spA = (k / 8) * Math.PI * 2 + tSec * 6;
              const spR = 24 + (insEase - 0.72) * 140;
              const sx = rightDrawX + rightW * 0.35 + Math.cos(spA) * spR * 0.55;
              const sy = reticleY + Math.sin(spA) * spR;
              ctx.fillStyle = k % 2 === 0 ? '#fde68a' : '#5eead4';
              ctx.fillRect(sx - 2, sy - 2, 4, 4);
            }
          }
        } else {
          // Fallback procedural rings while textures finish decoding
          const leftCenterX = 166 + leftShiftX;
          const leftCenterY = cy + shiftY;
          const rightCenterX = 398;
          const rightCenterY = cy;
          drawPixelRect(435, 14, 125, H - 28, '#282b3e', '#080a0f');
          drawPixelRect(0, leftCenterY - 76, leftCenterX - 38, 152, '#34394e', '#080a0f');
          ctx.strokeStyle = '#6e7696';
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.ellipse(leftCenterX, leftCenterY, 48, 88, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(rightCenterX, rightCenterY, 48, 88, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // ============================================================
        // EXTERNAL FULL-SPACECRAFT INSERTION TO SPACE STATION (IMAGE 2)
        // Uses LA NAVE COMPLETA (sprCoupled) aligned dead-center with port!
        // ============================================================
        const p = sim.shipInsertT;
        const stationX = W * 0.68;
        const stationY = H * 0.51;
        const stationW = 216;
        const stationH = sprStation.ready
          ? stationW * (sprStation.height / Math.max(1, sprStation.width))
          : 180;

        // Exact measured Space Station left docking collar center
        const dockCollarX = sprStation.ready
          ? stationX + stationW * sprStation.portXOffsetFrac
          : stationX - stationW * 0.49;
        const dockCollarY = sprStation.ready
          ? stationY + stationH * sprStation.portYOffsetFrac
          : stationY + stationH * 0.048;

        // Full Spacecraft (sprCoupled: CSM engine on left, Eagle nose on right)
        const shipW = 152;
        const shipH = sprCoupled.ready
          ? shipW * (sprCoupled.height / Math.max(1, sprCoupled.width))
          : 74;

        // Approach path: 0..0.35 aligns level; 0.35..0.68 closes in; 0.68..1.0 blue thruster pushes nose INTO port!
        const finalDockedX = dockCollarX - shipW * 0.435;
        let shipX = finalDockedX;
        let shipY = dockCollarY;
        let shipAngle = 0;
        let showBlueThrust = false;

        if (p < 0.35) {
          const u = p / 0.35;
          const ease = u * u * (3 - 2 * u);
          const startX = 86;
          const approachX = dockCollarX - shipW * 0.88;
          shipX = startX + (approachX - startX) * ease;
          shipY = dockCollarY + (1 - ease) * -14;
          shipAngle = (-14 * (1 - ease) * Math.PI) / 180;
        } else if (p < 0.68) {
          const u = (p - 0.35) / 0.33;
          const ease = u * u * (3 - 2 * u);
          const approachX = dockCollarX - shipW * 0.88;
          const waitX = dockCollarX - shipW * 0.64;
          shipX = approachX + (waitX - approachX) * ease;
          shipY = dockCollarY;
          shipAngle = 0;
        } else if (p < 1) {
          const u = (p - 0.68) / 0.32;
          const ease = 1 - Math.pow(1 - u, 2);
          const waitX = dockCollarX - shipW * 0.64;
          shipX = waitX + (finalDockedX - waitX) * ease;
          shipY = dockCollarY;
          shipAngle = 0;
          showBlueThrust = true;
        } else {
          shipX = finalDockedX;
          shipY = dockCollarY;
        }

        // Draw Space Station first
        if (sprStation.ready) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            sprStation.canvas,
            stationX - stationW * 0.5,
            stationY - stationH * 0.5,
            stationW,
            stationH
          );
          ctx.restore();
        } else {
          drawPixelRect(stationX - 80, stationY - 60, 160, 120, '#475569', '#94a3b8');
        }

        // Blue/Cyan Thruster Plume from the LEFT engine bell of LA NAVE COMPLETA (sprCoupled)
        if (showBlueThrust) {
          const flameLen = 30 + Math.sin(tSec * 42) * 8;
          const bellX = shipX - shipW * 0.48;
          const bellY = shipY;
          const fg = ctx.createLinearGradient(bellX, bellY, bellX - flameLen, bellY);
          fg.addColorStop(0, 'rgba(224, 242, 254, 0.98)');
          fg.addColorStop(0.35, 'rgba(56, 189, 248, 0.92)');
          fg.addColorStop(1, 'rgba(37, 99, 235, 0)');
          ctx.save();
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.moveTo(bellX, bellY - 10);
          ctx.lineTo(bellX - flameLen, bellY);
          ctx.lineTo(bellX, bellY + 10);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Draw LA NAVE COMPLETA (sprCoupled)
        if (sprCoupled.ready) {
          ctx.save();
          ctx.translate(shipX, shipY);
          ctx.rotate(shipAngle);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            sprCoupled.canvas,
            -shipW * 0.5,
            -shipH * 0.5,
            shipW,
            shipH
          );
          ctx.restore();
        } else {
          drawPixelRect(shipX - 55, shipY - 22, 110, 44, '#cbd5e1', '#f59e0b');
        }

        // Collar clamp & lock ring visuals centered right on the docked joint (Step 3 & Step 4)
        const collarX = dockCollarX + 2;
        const collarY = dockCollarY;
        if (st.step >= 3) {
          const locked = sim.lockT > 0.7;
          ctx.save();
          ctx.strokeStyle = locked ? '#4ade80' : '#f59e0b';
          ctx.lineWidth = locked ? 3 : 2;
          const ringPulse = st.lockingAnim
            ? 15 + Math.sin(sim.lockT * Math.PI * 3) * 4
            : 16;
          ctx.beginPath();
          ctx.arc(collarX, collarY, ringPulse, 0, Math.PI * 2);
          ctx.stroke();

          if (st.lockingAnim || st.step >= 4) {
            ctx.fillStyle = '#4ade80';
            for (const ang of [-0.6, 0.6, Math.PI - 0.6, Math.PI + 0.6]) {
              const cxp = collarX + Math.cos(ang) * 18;
              const cyp = collarY + Math.sin(ang) * 18;
              ctx.fillRect(cxp - 2, cyp - 2, 5, 5);
            }
          }
          ctx.restore();
        }

        // Pressure Seal Scan & Green Checkmark (Step 4)
        if (st.checkingSeal || st.sealVerified) {
          if (st.checkingSeal) {
            const scanR = 12 + sim.sealT * 38;
            ctx.save();
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(collarX, collarY, scanR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          if (st.sealVerified || sim.sealT > 0.85) {
            const bx = collarX;
            const by = collarY - 36;
            ctx.save();
            ctx.fillStyle = '#16a34a';
            ctx.beginPath();
            ctx.arc(bx, by, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#bbf7d0';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(bx - 6, by + 1);
            ctx.lineTo(bx - 1, by + 6);
            ctx.lineTo(bx + 7, by - 5);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Crisp labels
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fde68a';
        ctx.fillText(
          en ? 'COMPLETE CRAFT MK-II' : 'NAVE COMPLETA MK-II',
          Math.max(14, shipX - 64),
          shipY + shipH * 0.56 + 14
        );
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(
          en ? 'SPACE STATION' : 'ESTACIÓN ESPACIAL',
          stationX - 58,
          stationY - stationH * 0.52
        );
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [sprCoupled, sprStation, dockTextures, en]);

  const sealLabel = sealVerified
    ? en
      ? 'AIRTIGHT'
      : 'HERMÉTICO'
    : checkingSeal
      ? en
        ? 'TESTING...'
        : 'PROBANDO...'
      : step >= 4
        ? en
          ? 'LOCKED'
          : 'BLOQUEADO'
        : step === 3
          ? en
            ? 'DOCKED'
            : 'ACOPLADO'
          : insertingPhase !== 'idle'
            ? en
              ? 'INSERTING'
              : 'INSERTANDO'
            : en
              ? 'OPEN'
              : 'ABIERTO';

  const stepperItems: { num: StationDockStep; label: string }[] = [
    { num: 1, label: en ? 'ALIGN' : 'ALINEAR' },
    { num: 2, label: en ? 'INSERT' : 'INSERTAR' },
    { num: 3, label: en ? 'LOCK' : 'BLOQUEAR' },
    { num: 4, label: en ? 'CHECK SEAL' : 'COMPROBAR SELLO' },
  ];

  return (
    <div className="p-4 md:p-5 space-y-3.5">
      {/* Header + FixObjectiveBox */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-[#353b4a] pb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 pixel-slot-gold flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-[#f8d274]" />
          </div>
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-[#7dd3fc]">
              {en
                ? 'Earth Orbit · Space Station MK-II'
                : 'Órbita Terrestre · Estación Espacial MK-II'}
            </div>
            <h3 className="font-display text-xl font-bold text-[#f3f0e6]">
              {en ? 'PREPARE DOCKING' : 'PREPARAR ACOPLAMIENTO'}
            </h3>
          </div>
        </div>

        <FixObjectiveBox
          task={
            step === 1
              ? en
                ? 'Align 3 tabs & insert full spacecraft'
                : 'Alinear 3 pestañas e insertar nave completa'
              : step === 2
                ? en
                  ? 'Inserting full spacecraft into station...'
                  : 'Insertando nave completa en la estación...'
                : step === 3
                  ? en
                    ? 'Lock the docking ring'
                    : 'Bloquear el anillo de unión'
                  : en
                    ? 'Check airtight seal'
                    : 'Comprobar sello hermético'
          }
          progress={`${step}/4`}
          tone={sealVerified || allAligned ? 'emerald' : 'amber'}
        />
      </div>

      <p className="font-display text-xs sm:text-sm text-[#d4d8e4] leading-snug">
        {en
          ? 'Move the tabs until each one aligns with its slot. Then insert, lock, and verify the airtight seal between the full spacecraft and the space station.'
          : 'Mueve las pestañas hasta alinear cada una con su ranura. Luego inserta, bloquea y comprueba el sello de la nave completa con la estación espacial.'}
      </p>

      {/* Main 3-Zone Docking Console (Left Controls · Center Canvas · Right Telemetry) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
        {/* Left Control Column */}
        <div className="md:col-span-3 pixel-panel p-3 flex flex-col justify-center gap-3">
          <div className="space-y-1.5">
            <div className="font-pixel text-[9px] text-center tracking-wider text-[#f8d274] uppercase">
              {en ? 'Rotate Ring' : 'Girar Aro'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={step !== 1}
                onClick={() => rotateRing(-6)}
                aria-label={en ? 'Rotate ring left' : 'Girar aro izquierda'}
                className="h-10 pixel-btn flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={step !== 1}
                onClick={() => rotateRing(6)}
                aria-label={en ? 'Rotate ring right' : 'Girar aro derecha'}
                className="h-10 pixel-btn flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-[2px] bg-[#353b4a]" />

          <div className="space-y-1.5">
            <div className="font-pixel text-[9px] text-center tracking-wider text-[#f8d274] uppercase">
              {en ? 'Move Tab' : 'Mover Pestaña'}
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={step !== 1}
                onClick={() => moveVertical(-4)}
                aria-label={en ? 'Move tab up' : 'Mover pestaña arriba'}
                className="w-full h-10 pixel-btn flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={step !== 1}
                onClick={() => moveVertical(4)}
                aria-label={en ? 'Move tab down' : 'Mover pestaña abajo'}
                className="w-full h-10 pixel-btn flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Center 60fps Animated Docking Viewport */}
        <div className="md:col-span-6 relative border-2 border-[#3c4252] bg-[#080514] overflow-hidden flex items-center justify-center shadow-[inset_0_0_24px_rgba(0,0,0,0.75)]">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ imageRendering: 'pixelated', aspectRatio: '560 / 264' }}
          />
        </div>

        {/* Right Telemetry Cards */}
        <div className="md:col-span-3 flex flex-col justify-center gap-3">
          <div className="pixel-panel p-3 text-center space-y-1">
            <div
              className={`font-mono-tech text-lg font-bold leading-none ${
                allAligned ? 'text-[#4ade80]' : 'text-[#f8d274]'
              }`}
            >
              {alignedCount} {en ? 'OF' : 'DE'} 3
            </div>
            <div className="font-pixel text-[9px] tracking-wider text-[#e2e8f0] uppercase leading-tight">
              {en ? 'Tabs Aligned' : 'Pestañas Alineadas'}
            </div>
          </div>

          <div className="pixel-panel p-3 text-center space-y-1">
            <div className="font-pixel text-[9px] tracking-wider text-[#9aa4bd] uppercase">
              {en ? 'Seal:' : 'Sello:'}
            </div>
            <div
              className={`font-mono-tech text-sm font-bold tracking-wider uppercase ${
                sealVerified
                  ? 'text-[#4ade80]'
                  : step >= 3
                    ? 'text-[#7dd3fc]'
                    : 'text-[#f8d274]'
              }`}
            >
              {sealLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 4-Step Sequence Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stepperItems.map((it) => {
          const isCurrent = step === it.num && !sealVerified;
          const isCompleted = step > it.num || sealVerified;
          return (
            <div
              key={it.num}
              className={`px-2.5 py-2 border-2 flex items-center gap-2 font-pixel text-[9px] tracking-wider uppercase ${
                isCompleted
                  ? 'bg-[#143d2b]/85 border-[#4ade80] text-[#86efac]'
                  : isCurrent
                    ? 'bg-[#3b2a10]/85 border-[#f8d274] text-[#fde68a]'
                    : 'bg-[#121622]/75 border-[#353b4a] text-[#94a3b8]'
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center font-mono-tech text-[11px] font-bold border ${
                  isCompleted
                    ? 'bg-[#22c55e] text-[#052e16] border-[#86efac]'
                    : isCurrent
                      ? 'bg-[#f59e0b] text-[#1a1004] border-[#fde68a]'
                      : 'bg-[#1e2433] text-[#94a3b8] border-[#475569]'
                }`}
              >
                {it.num}
              </span>
              <span className="truncate">{it.label}</span>
            </div>
          );
        })}
      </div>

      {/* Primary Action Button */}
      {step === 1 && (
        <button
          type="button"
          disabled={!allAligned}
          onClick={handleInsert}
          className={`w-full py-3.5 px-5 font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            allAligned ? 'pixel-btn-gold' : 'pixel-btn'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {allAligned
            ? en
              ? 'INSERT FULL SPACECRAFT'
              : 'INSERTAR NAVE COMPLETA'
            : en
              ? `INSERT (ALIGN ${3 - alignedCount} MORE TAB${3 - alignedCount === 1 ? '' : 'S'})`
              : `INSERTAR (ALINEA ${3 - alignedCount} PESTAÑA${3 - alignedCount === 1 ? '' : 'S'} MÁS)`}
        </button>
      )}

      {step === 2 && (
        <div className="w-full py-3.5 px-5 pixel-panel-gold font-pixel text-xs tracking-wider uppercase text-center text-[#fde68a]">
          {en
            ? 'Inserting full spacecraft into Space Station MK-II...'
            : 'Insertando nave completa en la Estación Espacial MK-II...'}
        </div>
      )}

      {step === 3 && (
        <button
          type="button"
          disabled={lockingAnim}
          onClick={handleLock}
          className="w-full py-3.5 px-5 pixel-btn-gold font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <CheckCircle2 className="w-4 h-4" />
          {lockingAnim
            ? en
              ? 'LOCKING RING...'
              : 'BLOQUEANDO ANILLO...'
            : en
              ? 'LOCK DOCKING RING'
              : 'BLOQUEAR ANILLO DE ACOPLAMIENTO'}
        </button>
      )}

      {step === 4 && (
        <button
          type="button"
          disabled={checkingSeal || sealVerified}
          onClick={handleCheckSeal}
          className={`w-full py-3.5 px-5 font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 ${
            sealVerified ? 'pixel-btn-emerald' : 'pixel-btn-gold'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {sealVerified
            ? en
              ? 'AIRTIGHT SEAL VERIFIED! CONTINUING...'
              : '¡SELLO HERMÉTICO VERIFICADO! CONTINUANDO...'
            : checkingSeal
              ? en
                ? 'CHECKING AIRTIGHT SEAL...'
                : 'COMPROBANDO SELLO HERMÉTICO...'
              : en
                ? 'CHECK AIRTIGHT SEAL'
                : 'COMPROBAR SELLO HERMÉTICO'}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 4) MINIJUEGO ALEATORIO DE FUGA DE OXÍGENO (INTERIOR DEL EAGLE)
// ============================================================================
const O2_STATION_SPRITE =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_16.12.50_e92ff264.jpeg';
const O2_HOSE_BROKEN = '/assets/game/oxygen/hose_broken.png';
const O2_HOSE_FIXED = '/assets/game/oxygen/hose_fixed.png';

function getO2Tools(en: boolean) {
  return [
    {
      id: 'tape' as const,
      name: en ? 'Sealing Tape' : 'Venda Selladora',
      actionLabel: en ? 'Seal the tear' : 'Sellar la grieta',
      sprite: '/assets/game/oxygen/tool_tape.png',
      isCorrect: true,
      hint: en
        ? 'Exact match! Pressurized sealing tape completely sealed the oxygen hose tear.'
        : '¡Exacto! La venda presurizada selló por completo la rotura de la manguera de oxígeno.',
    },
    {
      id: 'clamp' as const,
      name: en ? 'Clamp' : 'Abrazadera',
      actionLabel: en ? 'Metal clamp ring' : 'Aro metálico',
      sprite: '/assets/game/oxygen/tool_clamp.png',
      isCorrect: false,
      hint: en
        ? 'The metal clamp does not cover the open tear; use Sealing Tape first.'
        : 'La abrazadera metálica no tapa la grieta abierta; usa primero la Venda Selladora.',
    },
    {
      id: 'coupling' as const,
      name: en ? 'Threaded Coupling' : 'Acople de Rosca',
      actionLabel: en ? 'Rigid connector' : 'Conector rígido',
      sprite: '/assets/game/oxygen/tool_coupling.png',
      isCorrect: false,
      hint: en
        ? 'That connector is for rigid nozzles, not for sealing the flexible hose. Choose Sealing Tape.'
        : 'Ese conector es para boquillas rígidas, no sirve para sellar el tubo flexible. Elige la Venda Selladora.',
    },
  ];
}

const OxygenMinigame: React.FC<{
  theme: ThemePalette;
  onDone: () => void;
  onReact: (cue: DirectorReaction) => void;
}> = ({ theme, onDone, onReact }) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const tools = useMemo(() => getO2Tools(en), [en]);
  const [repaired, setRepaired] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'tape' | 'clamp' | 'coupling' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const doneSentRef = useRef(false);

  const o2Percent = repaired ? 100 : 64;

  useEffect(() => {
    onReact({
      mood: 'bad',
      text: en
        ? 'Life-support alarm! The Eagle oxygen (O₂) hose cracked. Apply sealing tape over the tear right away.'
        : '¡Alarma de soporte vital! Se fisuró la manguera de oxígeno (O₂) del Eagle. Aplica la venda selladora sobre la grieta cuanto antes.',
    });
  }, [en, onReact]);

  const triggerDone = useCallback(() => {
    if (doneSentRef.current) return;
    doneSentRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!repaired) return;
    const t = window.setTimeout(triggerDone, 750);
    return () => window.clearTimeout(t);
  }, [repaired, triggerDone]);

  const applyTool = (toolId: 'tape' | 'clamp' | 'coupling') => {
    if (repaired) return;
    const tool = tools.find((t) => t.id === toolId)!;
    if (!tool.isCorrect) {
      setSelectedTool(null);
      setErrorMsg(tool.hint);
      onReact({
        mood: 'bad',
        text: tool.hint,
      });
      return;
    }

    setRepaired(true);
    setSelectedTool(null);
    setErrorMsg(null);
    onReact({
      mood: 'good',
      text: en
        ? 'Leak sealed with tape! Oxygen pressure at 100% nominal inside the Eagle.'
        : '¡Fuga sellada con la venda! Presión de oxígeno al 100% nominal en el Eagle.',
    });
  };

  const handleHoseTargetClick = () => {
    if (repaired) return;
    if (!selectedTool) {
      setErrorMsg(
        en
          ? 'Select Sealing Tape below and apply it over the hose.'
          : 'Elige la Venda Selladora debajo y aplícala sobre la manguera.'
      );
      return;
    }
    applyTool(selectedTool);
  };

  return (
    <div className="p-5 md:p-6 space-y-3.5">
      <div className="flex items-start justify-between gap-3 border-b-2 border-[#353b4a] pb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 pixel-slot-gold flex items-center justify-center shrink-0">
            <Wind className="w-5 h-5 text-[#67e8f9]" />
          </div>
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-[#67e8f9]">
              {en ? 'Eagle Interior · O₂ Life Support' : 'Interior del Eagle · Soporte Vital O₂'}
            </div>
            <h3 className="font-display text-xl font-bold text-[#f3f0e6]">
              {en ? 'Repair Oxygen Leak' : 'Reparar Fuga de Oxígeno'}
            </h3>
          </div>
        </div>

        <FixObjectiveBox
          task={
            repaired
              ? en
                ? 'Hose sealed with tape'
                : 'Manguera sellada con la venda'
              : en
                ? 'Apply sealing tape to the leak'
                : 'Colocar la venda selladora en la fuga'
          }
          progress={repaired ? '1/1' : '0/1'}
          tone={repaired ? 'emerald' : 'sky'}
        />
      </div>

      {/* Main inspection layout: O2 Tank Station + Close-up Interactive Hose */}
      <div className="grid grid-cols-1 sm:grid-cols-[155px_1fr] gap-3 items-stretch">
        {/* Tank station monitor card */}
        <div className="bg-[#0b101d]/50 backdrop-blur-[2px] border-2 border-[#3c4252]/90 p-2.5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[9px] uppercase tracking-wider text-[#d4d8e4]">
              {en ? 'O₂ TANK' : 'TANQUE O₂'}
            </span>
            <span
              className={`font-pixel text-[8px] px-1.5 py-0.5 border font-bold ${
                repaired
                  ? 'bg-[#195e3d]/85 border-[#4ade80] text-[#dcfce7]'
                  : 'bg-[#7d1f2d]/85 border-[#e05368] text-[#ffdce1]'
              }`}
            >
              {repaired ? 'OK' : en ? 'LEAK' : 'FUGA'}
            </span>
          </div>

          <div className="relative flex-1 min-h-[105px] overflow-hidden bg-[#101522]/55 border border-[#3c4252]/80 flex items-center justify-center">
            <img
              src={O2_STATION_SPRITE}
              alt={en ? 'Eagle O2 oxygen tank and system' : 'Sistema y tanque de oxígeno O2 del Eagle'}
              className="w-full h-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between font-mono-tech text-[10px]">
              <span className="text-[#9aa4bd]">{en ? 'O₂ PRESSURE' : 'PRESIÓN O₂'}</span>
              <span className={repaired ? 'text-[#4ade80] font-bold' : 'text-[#67e8f9] font-bold'}>
                {o2Percent}%
              </span>
            </div>
            <div className="w-full h-2.5 pixel-bar-track overflow-hidden">
              <div
                className="h-full pixel-bar-fill transition-all duration-300"
                style={{
                  width: `${o2Percent}%`,
                  backgroundColor: repaired ? '#34d399' : '#f59e0b',
                }}
              />
            </div>
          </div>
        </div>

        {/* Interactive Broken -> Sealed Hose */}
        <button
          type="button"
          onClick={handleHoseTargetClick}
          className={`relative p-3 flex flex-col items-center justify-center min-h-[185px] backdrop-blur-[2px] border-2 transition cursor-pointer group ${
            selectedTool && !repaired
              ? 'bg-[#2b2a26]/65 border-[#d5973b]'
              : repaired
                ? 'bg-[#0b101d]/48 border-[#4ade80] cursor-default'
                : 'bg-[#0b101d]/48 border-[#3c4252]/90 hover:border-[#67e8f9]'
          }`}
        >
          <div className="absolute top-2 left-3 font-pixel text-[9px] uppercase tracking-wider text-[#d4d8e4]">
            {repaired
              ? en
                ? 'O₂ HOSE 100% SEALED'
                : 'MANGUERA O₂ SELLADA AL 100%'
              : en
                ? 'O₂ LINE · TEAR DETECTED'
                : 'CONDUCTO O₂ · ROTURA DETECTADA'}
          </div>

          <div className="relative mt-3 flex items-center justify-center">
            <img
              src={repaired ? O2_HOSE_FIXED : O2_HOSE_BROKEN}
              alt={
                repaired
                  ? en
                    ? 'Oxygen hose sealed with tape'
                    : 'Manguera de oxígeno sellada con venda'
                  : en
                    ? 'Torn oxygen hose'
                    : 'Manguera de oxígeno rota'
              }
              className="h-36 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              style={{ imageRendering: 'pixelated' }}
            />

            {!repaired && (
              <span className="absolute right-[10%] top-[44%] w-8 h-8 border-2 border-[#67e8f9] animate-ping pointer-events-none" />
            )}
          </div>

          <span className="mt-1 font-display text-xs text-[#a5f3fc]">
            {repaired
              ? en
                ? 'Tape applied · Oxygen flow stabilized'
                : 'Venda aplicada · Flujo de oxígeno estabilizado'
              : selectedTool
                ? en
                  ? 'Click here on the hose to seal'
                  : 'Haz clic aquí sobre la manguera para sellar'
                : en
                  ? 'Select tape below and apply it to the hose'
                  : 'Selecciona la venda debajo y aplícala en la manguera'}
          </span>
        </button>
      </div>

      {/* 3 Pixel-art tools */}
      <div className="grid grid-cols-3 gap-3">
        {tools.map((tool) => {
          const isSelected = selectedTool === tool.id;
          const isApplied = repaired && tool.isCorrect;
          return (
            <button
              key={tool.id}
              type="button"
              disabled={repaired}
              onClick={() => {
                setErrorMsg(null);
                if (isSelected) {
                  applyTool(tool.id);
                } else {
                  setSelectedTool(tool.id);
                }
              }}
              className={`p-2.5 flex flex-col items-center gap-1.5 text-center cursor-pointer disabled:cursor-default backdrop-blur-[2px] border-2 shadow-[0_3px_0_#07090d] transition-colors ${
                isApplied
                  ? 'bg-[#173328]/70 border-[#4ade80]'
                  : isSelected
                    ? 'bg-[#2b2a26]/70 border-[#d5973b]'
                    : 'bg-[#121829]/52 hover:bg-[#1a2238]/65 border-[#4d5466]/90'
              }`}
            >
              <img
                src={tool.sprite}
                alt={tool.name}
                className="w-12 h-12 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="text-xs font-display font-bold text-[#f3f0e6] leading-tight">
                {tool.name}
              </div>
              <div className="font-pixel text-[8px] text-[#a5f3fc] leading-tight">
                {isApplied
                  ? en
                    ? 'APPLIED'
                    : 'APLICADA'
                  : isSelected
                    ? en
                      ? 'CLICK ON HOSE'
                      : 'CLIC EN MANGUERA'
                    : tool.actionLabel}
              </div>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="font-display text-xs text-[#ffdce1] bg-[#591620] border-2 border-[#e05368] px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#fda4af]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {repaired && (
        <button
          type="button"
          onClick={triggerDone}
          className="w-full py-3 pixel-btn-emerald font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {en ? 'Oxygen Restored · Continue' : 'Oxígeno Restablecido · Continuar'}
        </button>
      )}
    </div>
  );
};
