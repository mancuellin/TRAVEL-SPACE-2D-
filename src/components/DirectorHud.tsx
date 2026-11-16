import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  CHARACTER_SHEET_SRC,
  CleanSprite,
  ExpressionKey,
  loadCharacterSpriteSheet,
} from '../utils/spriteLoader';

export type DirectorMood = 'good' | 'bad' | 'neutral';

export interface DirectorReaction {
  mood: DirectorMood;
  text: string;
}

interface DirectorHudProps {
  mood: DirectorMood;
  text: string;
  phaseLabel?: string;
  bottomOffsetClass?: string;
}

const PortraitCanvas: React.FC<{ sprite: CleanSprite | null | undefined }> = ({
  sprite,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ready = Boolean(sprite?.ready);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !sprite || !sprite.ready) return;
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.canvas, 0, 0);
  }, [sprite, ready, sprite?.width, sprite?.height]);

  return (
    <canvas
      ref={ref}
      className="max-h-full max-w-full w-auto h-auto object-contain drop-shadow-[0_2px_0_rgba(5,8,16,0.95)]"
      style={{
        imageRendering: 'pixelated',
        aspectRatio:
          sprite && sprite.ready ? `${sprite.width} / ${sprite.height}` : undefined,
      }}
    />
  );
};

const PixelTransmissionIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="18"
    height="14"
    viewBox="0 0 18 14"
    fill="none"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className="shrink-0"
  >
    {/* Center dot */}
    <rect x="8" y="6" width="2" height="2" fill={color} />
    {/* Inner waves */}
    <rect x="5" y="4" width="2" height="6" fill={color} />
    <rect x="11" y="4" width="2" height="6" fill={color} />
    {/* Outer waves */}
    <rect x="2" y="3" width="2" height="8" fill={color} />
    <rect x="14" y="3" width="2" height="8" fill={color} />
    <rect x="3" y="2" width="1" height="1" fill={color} />
    <rect x="3" y="11" width="1" height="1" fill={color} />
    <rect x="14" y="2" width="1" height="1" fill={color} />
    <rect x="14" y="11" width="1" height="1" fill={color} />
  </svg>
);

export const DirectorHud: React.FC<DirectorHudProps> = ({
  mood,
  text,
  bottomOffsetClass = 'bottom-4',
}) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [tick, setTick] = useState(0);
  const [animStep, setAnimStep] = useState(0);

  const sheet = useMemo(
    () =>
      loadCharacterSpriteSheet(CHARACTER_SHEET_SRC, () =>
        setTick((v) => v + 1)
      ),
    []
  );
  void tick;

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimStep((v) => (v + 1) % 6);
    }, 240);
    return () => window.clearInterval(id);
  }, []);

  let expression: ExpressionKey = 'neutro';
  if (mood === 'bad') {
    const cycle: ExpressionKey[] = [
      'hablando3',
      'hablando2',
      'hablando3',
      'transicion',
      'hablando2',
      'hablando3',
    ];
    expression = cycle[animStep % cycle.length];
  } else if (mood === 'good') {
    const cycle: ExpressionKey[] = [
      'hablando1',
      'neutro',
      'hablando1',
      'hablando1',
      'neutro',
      'hablando1',
    ];
    expression = cycle[animStep % cycle.length];
  } else {
    const cycle: ExpressionKey[] = [
      'neutro',
      'transicion',
      'hablando1',
      'neutro',
      'hablando1',
      'neutro',
    ];
    expression = cycle[animStep % cycle.length];
  }

  const portrait = sheet.Director?.[expression];

  const palette =
    mood === 'bad'
      ? {
          stroke: '#ff1f1f',
          glow: 'rgba(255, 31, 31, 0.35)',
          textColor: '#ff4d4d',
          badgeText: en ? 'CRITICAL' : 'CRÍTICA',
          hasTopNotch: true,
          hasTopDots: true,
          hasBottomTab: true,
          bottomSlashes: 4,
          hasPortraitReticles: true,
          hasCornerBracket: true,
        }
      : mood === 'good'
        ? {
            stroke: '#22ff44',
            glow: 'rgba(34, 255, 68, 0.28)',
            textColor: '#4ade80',
            badgeText: en ? 'ACTIVE' : 'ACTIVA',
            hasTopNotch: false,
            hasTopDots: false,
            hasBottomTab: false,
            bottomSlashes: 0,
            hasPortraitReticles: false,
            hasCornerBracket: false,
          }
        : {
            stroke: '#facc15',
            glow: 'rgba(250, 204, 21, 0.32)',
            textColor: '#fde047',
            badgeText: en ? 'ACTIVE' : 'ACTIVA',
            hasTopNotch: true,
            hasTopDots: false,
            hasBottomTab: true,
            bottomSlashes: 3,
            hasPortraitReticles: false,
            hasCornerBracket: false,
          };

  const c = palette.stroke;

  // Pixel chamfered outer polygon path (viewBox 380 x 120)
  // Chamfered corners (cut 8px on corners)
  const outerShape =
    'M 10,8 L 370,8 L 376,14 L 376,104 L 370,110 L 10,110 L 4,104 L 4,14 Z';

  return (
    <div
      className={`fixed ${bottomOffsetClass} right-4 z-50 w-[390px] max-w-[calc(100vw-2rem)] pointer-events-none select-none transition-all duration-300`}
      style={{
        filter: `drop-shadow(0 0 12px ${palette.glow}) drop-shadow(0 6px 14px rgba(0,0,0,0.85))`,
      }}
    >
      <div className="relative w-full min-h-[126px]">
        {/* Pixel-Art Chamfered HUD Frame SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 380 120"
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          {/* Semi-transparent deep space fill inside the chamfered border */}
          <path d={outerShape} fill="rgba(5, 9, 22, 0.88)" />

          {/* Top-left protruding notch tab with /// diagonal slashes (Yellow & Red) */}
          {palette.hasTopNotch && (
            <g>
              <path
                d="M 48,8 L 54,2 L 104,2 L 110,8 Z"
                fill="rgba(5, 9, 22, 0.94)"
                stroke={c}
                strokeWidth="2.5"
              />
              <path d="M 64,7 L 69,3" stroke={c} strokeWidth="2.2" />
              <path d="M 76,7 L 81,3" stroke={c} strokeWidth="2.2" />
              <path d="M 88,7 L 93,3" stroke={c} strokeWidth="2.2" />
            </g>
          )}

          {/* Top-right 3 pixel squares (Red Critical) */}
          {palette.hasTopDots && (
            <g fill={c}>
              <rect x="330" y="2" width="4" height="4" />
              <rect x="339" y="2" width="4" height="4" />
              <rect x="348" y="2" width="4" height="4" />
            </g>
          )}

          {/* Bottom protruding tab with /// or //// diagonal slashes */}
          {palette.hasBottomTab && (
            <g>
              <path
                d={
                  palette.bottomSlashes === 4
                    ? 'M 150,110 L 156,117 L 236,117 L 242,110 Z'
                    : 'M 256,110 L 262,117 L 330,117 L 336,110 Z'
                }
                fill="rgba(5, 9, 22, 0.94)"
                stroke={c}
                strokeWidth="2.5"
              />
              {palette.bottomSlashes === 4 ? (
                <>
                  <path d="M 168,116 L 173,111" stroke={c} strokeWidth="2.2" />
                  <path d="M 182,116 L 187,111" stroke={c} strokeWidth="2.2" />
                  <path d="M 196,116 L 201,111" stroke={c} strokeWidth="2.2" />
                  <path d="M 210,116 L 215,111" stroke={c} strokeWidth="2.2" />
                </>
              ) : (
                <>
                  <path d="M 276,116 L 281,111" stroke={c} strokeWidth="2.2" />
                  <path d="M 290,116 L 295,111" stroke={c} strokeWidth="2.2" />
                  <path d="M 304,116 L 309,111" stroke={c} strokeWidth="2.2" />
                </>
              )}
            </g>
          )}

          {/* Main pixel chamfered outer border */}
          <path
            d={outerShape}
            fill="none"
            stroke={c}
            strokeWidth="2.8"
          />

          {/* Bottom-right decorative corner bracket on Critical Red */}
          {palette.hasCornerBracket && (
            <path
              d="M 358,103 L 368,103 L 368,93"
              fill="none"
              stroke={c}
              strokeWidth="2"
            />
          )}

          {/* Left Portrait Chamfered Box */}
          <path
            d="M 18,20 L 90,20 L 95,25 L 95,93 L 90,98 L 18,98 L 13,93 L 13,25 Z"
            fill="rgba(10, 16, 32, 0.72)"
            stroke={c}
            strokeWidth="2.2"
          />

          {/* Inner reticle brackets inside portrait box on Critical Red */}
          {palette.hasPortraitReticles && (
            <g fill="none" stroke={c} strokeWidth="1.6">
              <path d="M 18,30 L 18,25 L 23,25" />
              <path d="M 85,25 L 90,25 L 90,30" />
              <path d="M 18,88 L 18,93 L 23,93" />
              <path d="M 85,93 L 90,93 L 90,88" />
            </g>
          )}

          {/* Vertical separator bar between portrait and text */}
          <line x1="106" y1="20" x2="106" y2="98" stroke={c} strokeWidth="2.2" />
        </svg>

        {/* Foreground Content Layer aligned to SVG 380x120 coordinates */}
        <div className="relative z-10 w-full h-[126px]">
          {/* Left Portrait Slot: exact match for SVG box x=13..95 (3.42%..25%), y=20..98 (16.67%..81.67%) */}
          <div
            className="absolute flex items-center justify-center overflow-hidden p-1.5"
            style={{
              left: '3.42%',
              top: '16.67%',
              width: '21.58%',
              height: '65%',
            }}
          >
            {portrait?.ready ? (
              <PortraitCanvas sprite={portrait} />
            ) : (
              <div className="w-12 h-14 bg-white/5" />
            )}
          </div>

          {/* Right Header + Message: x=114..368 (30%..96.8%), y=16..102 (13.3%..85%) */}
          <div
            className="absolute flex flex-col justify-between"
            style={{
              left: '30%',
              right: '3.4%',
              top: '14.5%',
              bottom: '13.5%',
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <PixelTransmissionIcon color={c} />
                  <span
                    className="font-pixel text-[12px] tracking-[0.1em] uppercase font-bold truncate"
                    style={{ color: palette.textColor }}
                  >
                    {en ? 'TRANSMISSION' : 'TRANSMISIÓN'}
                  </span>
                </div>

                {/* Chamfered Pixel Status Pill (ACTIVA / CRÍTICA) */}
                <span
                  className="font-pixel text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border-2 shrink-0"
                  style={{
                    color: palette.textColor,
                    borderColor: c,
                    backgroundColor: 'rgba(5, 9, 22, 0.75)',
                  }}
                >
                  {palette.badgeText}
                </span>
              </div>

              {/* Crisp horizontal rule */}
              <div
                className="w-full h-[2px] mb-1"
                style={{ backgroundColor: c }}
              />
            </div>

            <p
              className="font-display text-[13px] font-medium leading-snug line-clamp-3"
              style={{
                color: mood === 'bad' ? '#fecaca' : mood === 'good' ? '#bbf7d0' : '#fef3c7',
              }}
            >
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

