import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Award, Film, Home, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  PARADE_CAR_SRC,
  ParadeCarSprites,
  loadAnimatedParadeCarSprites,
} from '../utils/spriteLoader';

interface FinalParadeViewProps {
  isMuted?: boolean;
  masterVolume?: number;
  onReturnToMenu: () => void;
  onViewPaperAgain?: () => void;
}

interface Spectator {
  x: number;
  yOffset: number;
  shirt: string;
  pants: string;
  hair: string;
  skin: string;
  phase: number;
  speed: number;
  hasFlag: boolean;
  flagColor: string;
  hasHat: boolean;
  scale: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  phase: number;
}

interface BuildingDef {
  width: number;
  height: number;
  wallColor: string;
  trimColor: string;
  windowLitColor: string;
  bannerText?: string;
  bannerColor?: string;
}

const VIRTUAL_HEIGHT = 360;
const PARADE_HOLD_SECONDS = 8.4;
const FADE_DURATION_SECONDS = 4.6;
const TOTAL_PARADE_SECONDS = PARADE_HOLD_SECONDS + FADE_DURATION_SECONDS;

const BUILDINGS: BuildingDef[] = [
  {
    width: 118,
    height: 152,
    wallColor: '#374863',
    trimColor: '#566d91',
    windowLitColor: '#fde68a',
    bannerText: '¡BIENVENIDOS!',
    bannerColor: '#b91c1c',
  },
  {
    width: 96,
    height: 128,
    wallColor: '#5c4338',
    trimColor: '#856252',
    windowLitColor: '#bae6fd',
  },
  {
    width: 132,
    height: 168,
    wallColor: '#2d3c54',
    trimColor: '#4a6287',
    windowLitColor: '#fef08a',
    bannerText: 'HÉROES MK11',
    bannerColor: '#1d4ed8',
  },
  {
    width: 104,
    height: 138,
    wallColor: '#485263',
    trimColor: '#6f7d94',
    windowLitColor: '#fde68a',
  },
  {
    width: 124,
    height: 158,
    wallColor: '#4d3a4b',
    trimColor: '#755872',
    windowLitColor: '#bae6fd',
    bannerText: 'TRAVEL MK11',
    bannerColor: '#d97706',
  },
];

const SHIRT_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#10b981', '#f97316', '#ec4899', '#cbd5e1', '#8b5cf6'];
const HAIR_COLORS = ['#1e1b18', '#4a3222', '#8c5832', '#d6b46b', '#64748b'];
const SKIN_COLORS = ['#f5cba7', '#e0ac69', '#c68642', '#8d5524', '#fad7b8'];
const CONFETTI_COLORS = ['#fde047', '#38bdf8', '#f87171', '#4ade80', '#f8fafc', '#fb923c'];

function createSpectators(count: number, spanWidth: number): Spectator[] {
  const list: Spectator[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    list.push({
      x: t * spanWidth + ((i * 37) % 15),
      yOffset: (i % 3) * 3,
      shirt: SHIRT_COLORS[i % SHIRT_COLORS.length],
      pants: i % 2 === 0 ? '#1e293b' : '#334155',
      hair: HAIR_COLORS[(i * 3) % HAIR_COLORS.length],
      skin: SKIN_COLORS[(i * 7) % SKIN_COLORS.length],
      phase: (i * 1.37) % (Math.PI * 2),
      speed: 7.2 + (i % 5) * 0.75,
      hasFlag: i % 5 === 0,
      flagColor: i % 10 === 0 ? '#ef4444' : '#38bdf8',
      hasHat: i % 4 === 1,
      scale: 1,
    });
  }
  return list;
}

function createConfetti(count: number): ConfettiPiece[] {
  const items: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      x: (i * 73) % 900,
      y: (i * 41) % 320,
      vx: -18 - (i % 4) * 7,
      vy: 26 + (i % 5) * 8,
      size: i % 3 === 0 ? 3 : 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      phase: i * 0.9,
    });
  }
  return items;
}

const PARADE_CHEERING_AUDIO_SRC =
  '/assets/aistudio/861527__kevp888__250603_201156-11_fr_long_cheering.wav_-_merged_a791c4fc.mp3';

/**
 * Plays the crowd cheering audio during the final parade animation,
 * fading in gently and fading down cleanly alongside the fade-to-black curtain.
 */
function startParadeCheeringAudio(
  isMuted: boolean,
  masterVolume: number
): {
  update: (nextMuted: boolean, nextVol: number, fadeFactor: number) => void;
  stop: () => void;
} {
  if (typeof Audio === 'undefined') {
    return { update: () => {}, stop: () => {} };
  }

  const audio = new Audio(PARADE_CHEERING_AUDIO_SRC);
  audio.loop = true;
  audio.preload = 'auto';
  audio.muted = isMuted;
  audio.volume = Math.max(0, Math.min(1, 0.58 * masterVolume));

  if (!isMuted && masterVolume > 0.01) {
    audio.play().catch(() => {});
  }

  return {
    update: (nextMuted: boolean, nextVol: number, fadeFactor: number) => {
      audio.muted = nextMuted;
      const targetVol = Math.max(
        0,
        Math.min(1, 0.58 * Math.max(0, Math.min(1, nextVol)) * Math.max(0, Math.min(1, fadeFactor)))
      );
      audio.volume = targetVol;
      if (!nextMuted && targetVol > 0.005 && audio.paused) {
        audio.play().catch(() => {});
      } else if ((nextMuted || targetVol <= 0.002) && !audio.paused) {
        audio.pause();
      }
    },
    stop: () => {
      audio.pause();
      audio.src = '';
    },
  };
}

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawSpectator(
  ctx: CanvasRenderingContext2D,
  s: Spectator,
  drawX: number,
  baseY: number,
  time: number,
  foreground = false
) {
  const clapWave = Math.sin(time * s.speed + s.phase);
  const handsTogether = clapWave > 0.22;
  const hop = Math.max(0, Math.sin(time * (s.speed * 0.45) + s.phase)) > 0.88 ? -2 : 0;
  const x = Math.round(drawX);
  const y = Math.round(baseY + s.yOffset + hop);
  const sc = foreground ? 2 : 1;

  // Shadow
  drawPixelRect(ctx, x - 4 * sc, y - 1 * sc, 9 * sc, 2 * sc, 'rgba(0,0,0,0.4)');

  // Legs
  drawPixelRect(ctx, x - 3 * sc, y - 8 * sc, 3 * sc, 7 * sc, s.pants);
  drawPixelRect(ctx, x + 1 * sc, y - 8 * sc, 3 * sc, 7 * sc, s.pants);

  // Torso
  drawPixelRect(ctx, x - 4 * sc, y - 16 * sc, 9 * sc, 8 * sc, s.shirt);

  // Head
  drawPixelRect(ctx, x - 3 * sc, y - 22 * sc, 7 * sc, 6 * sc, s.skin);
  // Hair or cap
  drawPixelRect(ctx, x - 3 * sc, y - 23 * sc, 7 * sc, 2 * sc, s.hair);
  if (s.hasHat) {
    drawPixelRect(ctx, x - 4 * sc, y - 24 * sc, 9 * sc, 2 * sc, '#f8fafc');
  }

  // Clapping arms & hands
  if (handsTogether) {
    // Both arms angled inward to clap right in front / above shoulder
    drawPixelRect(ctx, x - 4 * sc, y - 15 * sc, 2 * sc, 4 * sc, s.shirt);
    drawPixelRect(ctx, x + 3 * sc, y - 15 * sc, 2 * sc, 4 * sc, s.shirt);
    drawPixelRect(ctx, x - 2 * sc, y - 18 * sc, 5 * sc, 3 * sc, s.skin);
    // Tiny pixel clap spark
    if (!foreground) {
      drawPixelRect(ctx, x, y - 20 * sc, 1, 1, '#fef08a');
      drawPixelRect(ctx, x - 2, y - 19 * sc, 1, 1, '#fef08a');
      drawPixelRect(ctx, x + 2, y - 19 * sc, 1, 1, '#fef08a');
    }
  } else {
    // Hands raised open between claps
    drawPixelRect(ctx, x - 6 * sc, y - 17 * sc, 2 * sc, 5 * sc, s.shirt);
    drawPixelRect(ctx, x + 5 * sc, y - 17 * sc, 2 * sc, 5 * sc, s.shirt);
    drawPixelRect(ctx, x - 6 * sc, y - 19 * sc, 2 * sc, 2 * sc, s.skin);
    drawPixelRect(ctx, x + 5 * sc, y - 19 * sc, 2 * sc, 2 * sc, s.skin);
  }

  // Optional handheld flag waving
  if (s.hasFlag && !foreground) {
    const sway = Math.round(Math.sin(time * 6 + s.phase) * 1.5);
    drawPixelRect(ctx, x + 6, y - 29, 1, 12, '#e2e8f0');
    drawPixelRect(ctx, x + 7, y - 29 + sway, 6, 4, s.flagColor);
    drawPixelRect(ctx, x + 8, y - 28 + sway, 2, 1, '#f8fafc');
  }
}

export const FinalParadeView: React.FC<FinalParadeViewProps> = ({
  isMuted = false,
  masterVolume = 1,
  onReturnToMenu,
  onViewPaperAgain,
}) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [spritesTick, setSpritesTick] = useState(0);
  const [showCredits, setShowCredits] = useState(false);
  const [creditsElapsed, setCreditsElapsed] = useState(0);
  const skippedRef = useRef(false);

  const paradeSprites = useMemo<ParadeCarSprites>(
    () =>
      loadAnimatedParadeCarSprites(PARADE_CAR_SRC, () =>
        setSpritesTick((v) => v + 1)
      ),
    []
  );
  void spritesTick;

  const spectatorsBack = useMemo(() => createSpectators(56, 980), []);
  const spectatorsFront = useMemo(() => createSpectators(18, 980), []);
  const confetti = useMemo(() => createConfetti(75), []);

  const cheeringAudioRef = useRef<ReturnType<typeof startParadeCheeringAudio> | null>(null);

  // Crowd cheering audio while parade runs
  useEffect(() => {
    const ctrl = startParadeCheeringAudio(isMuted, masterVolume);
    cheeringAudioRef.current = ctrl;
    return () => {
      ctrl.stop();
      if (cheeringAudioRef.current === ctrl) {
        cheeringAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const ctrl = cheeringAudioRef.current;
    if (!ctrl) return;
    const fadeIn = Math.min(1, elapsed / 0.8);
    const fadeOut =
      elapsed <= PARADE_HOLD_SECONDS
        ? 1
        : Math.max(0, 1 - (elapsed - PARADE_HOLD_SECONDS) / FADE_DURATION_SECONDS);
    ctrl.update(isMuted, masterVolume, fadeIn * fadeOut);
  }, [elapsed, isMuted, masterVolume]);

  // Main 60fps Parade Animation + Fade-to-Black Clock
  useEffect(() => {
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      if (skippedRef.current) return;
      const t = (now - start) / 1000;
      setElapsed(t);
      if (t < TOTAL_PARADE_SECONDS + 1.5 && !skippedRef.current) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Progressive reveal timer when Credits view is active
  useEffect(() => {
    if (!showCredits) {
      setCreditsElapsed(0);
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setCreditsElapsed(t);
      if (t < 9.0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [showCredits]);

  const darkness =
    elapsed <= PARADE_HOLD_SECONDS
      ? 0
      : Math.min(1, (elapsed - PARADE_HOLD_SECONDS) / FADE_DURATION_SECONDS);
  const easedDarkness = darkness * darkness * (3 - 2 * darkness);
  const isCompletelyBlack = elapsed >= TOTAL_PARADE_SECONDS;
  const endScreenOpacity = isCompletelyBlack
    ? Math.min(1, (elapsed - TOTAL_PARADE_SECONDS) / 1.1)
    : 0;

  // Render pixel-art parade frame onto canvas while screen is still visible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCompletelyBlack) return;

    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 16 / 9;
    const vw = Math.max(460, Math.min(800, Math.round(VIRTUAL_HEIGHT * aspect)));
    const vh = VIRTUAL_HEIGHT;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const t = elapsed;
    const roadScroll = t * 52;

    // 1. Celebratory Afternoon Sky with subtle pixel dither bands
    const skyColors = ['#183766', '#254e8a', '#386db0', '#5a94cf', '#8ac2ea'];
    const bandH = Math.ceil(200 / skyColors.length);
    skyColors.forEach((c, idx) => {
      drawPixelRect(ctx, 0, idx * bandH, vw, bandH + 2, c);
    });

    // Distant warm sun glow & pixel clouds
    drawPixelRect(ctx, vw * 0.14 - 16, 28, 32, 32, '#fde68a');
    drawPixelRect(ctx, vw * 0.14 - 12, 32, 24, 24, '#fef9c3');

    const cloudOffsets = [60, 210, 390, 560, 740];
    cloudOffsets.forEach((baseX, idx) => {
      const cx = ((baseX - t * 6) % (vw + 120) + (vw + 120)) % (vw + 120) - 60;
      const cy = 34 + (idx % 3) * 18;
      drawPixelRect(ctx, cx, cy, 46, 10, '#e0f2fe');
      drawPixelRect(ctx, cx + 8, cy - 6, 28, 8, '#f8fafc');
    });

    // 2. Distant City Skyline Silhouette
    const skylineScroll = roadScroll * 0.18;
    for (let x = -40; x < vw + 60; x += 38) {
      const idx = Math.floor((x + skylineScroll) / 38);
      const sx = Math.round(x - (skylineScroll % 38));
      const bh = 42 + ((Math.abs(idx * 29) % 5) * 14);
      drawPixelRect(ctx, sx, 198 - bh, 34, bh, '#233859');
      drawPixelRect(ctx, sx + 4, 198 - bh - 6, 10, 6, '#233859');
    }

    // 3. Midground Parade Buildings + Banners
    const totalBuildingsSpan = BUILDINGS.reduce((sum, b) => sum + b.width + 6, 0);
    const bScroll = roadScroll * 0.55;
    const startLoop = Math.floor(bScroll / totalBuildingsSpan) - 1;
    let cursorX = startLoop * totalBuildingsSpan - bScroll;

    while (cursorX < vw + 160) {
      for (let i = 0; i < BUILDINGS.length; i++) {
        const b = BUILDINGS[i];
        const bx = Math.round(cursorX);
        const by = 212 - b.height;
        if (bx + b.width >= -20 && bx <= vw + 20) {
          // Main facade
          drawPixelRect(ctx, bx, by, b.width, b.height, b.wallColor);
          // Roof cornice
          drawPixelRect(ctx, bx - 2, by, b.width + 4, 6, b.trimColor);
          drawPixelRect(ctx, bx, by + 6, b.width, 3, '#111827');

          // Windows grid
          const cols = Math.floor((b.width - 18) / 18);
          const rows = Math.floor((b.height - 46) / 22);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const wx = bx + 11 + c * 18;
              const wy = by + 16 + r * 22;
              drawPixelRect(ctx, wx, wy, 10, 14, '#0f172a');
              const lit = (r + c + i) % 3 !== 0;
              drawPixelRect(
                ctx,
                wx + 1,
                wy + 1,
                8,
                12,
                lit ? b.windowLitColor : '#334155'
              );
            }
          }

          // Street-level awning
          drawPixelRect(ctx, bx + 4, 184, b.width - 8, 28, '#1e293b');
          drawPixelRect(ctx, bx + 2, 180, b.width - 4, 5, b.trimColor);

          // Celebratory Street Banner on building
          if (b.bannerText && b.bannerColor) {
            const label =
              en && b.bannerText === '¡BIENVENIDOS!'
                ? 'WELCOME!'
                : en && b.bannerText === 'HÉROES MK11'
                  ? 'MK11 HEROES'
                  : b.bannerText;
            drawPixelRect(ctx, bx + 10, by + 26, b.width - 20, 18, '#0b101b');
            drawPixelRect(ctx, bx + 11, by + 27, b.width - 22, 16, b.bannerColor);
            ctx.fillStyle = '#fef9c3';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(label, bx + b.width / 2, by + 38);
          }
        }
        cursorX += b.width + 6;
      }
    }

    // 4. Overhead Festive Pennant Garlands strung across street
    const garlandStep = 140;
    const gScroll = roadScroll * 0.55;
    for (let gx = -garlandStep; gx < vw + garlandStep; gx += garlandStep) {
      const drawGx = Math.round(gx - (gScroll % garlandStep));
      for (let px = 0; px < garlandStep; px += 12) {
        const sag = Math.round(Math.sin((px / garlandStep) * Math.PI) * 14);
        const flagC = CONFETTI_COLORS[(px / 12) % CONFETTI_COLORS.length];
        drawPixelRect(ctx, drawGx + px, 64 + sag, 6, 5, flagC);
      }
    }

    // 5. Sidewalks & Asphalt Avenue
    // Back sidewalk
    drawPixelRect(ctx, 0, 210, vw, 28, '#94a3b8');
    drawPixelRect(ctx, 0, 236, vw, 4, '#facc15'); // Yellow street curb

    // Parade street asphalt
    drawPixelRect(ctx, 0, 240, vw, 82, '#1e2533');
    drawPixelRect(ctx, 0, 240, vw, 3, '#111827');

    // Dashed white center lane markings scrolling past
    const laneScroll = roadScroll % 44;
    for (let lx = -44; lx < vw + 44; lx += 44) {
      drawPixelRect(ctx, lx - laneScroll, 278, 22, 4, '#e2e8f0');
    }

    // Front sidewalk curb
    drawPixelRect(ctx, 0, 322, vw, 4, '#facc15');
    drawPixelRect(ctx, 0, 326, vw, 34, '#334155');

    // 6. Clapping Spectators on Back Sidewalk
    const specSpan = 980;
    const specScroll = roadScroll * 0.85;
    for (const sp of spectatorsBack) {
      const sx =
        ((sp.x - specScroll) % specSpan + specSpan) % specSpan - 40;
      if (sx >= -20 && sx <= vw + 20) {
        drawSpectator(ctx, sp, sx, 234, t, false);
      }
    }

    // 7. Ceremonial Parade Car ("HÉROES MK11") with All 4 Heroes Riding & Waving
    // Slides smoothly in from left edge during first 1.8s, then cruises proudly center-stage
    const enterEase = Math.min(1, t / 1.8);
    const enterSmooth = 1 - Math.pow(1 - enterEase, 3);
    const carriageX = Math.round(
      vw * (-0.28 + enterSmooth * 0.78 + Math.min(0.14, t * 0.008))
    );
    const cobbleBounce =
      Math.sin(t * 14) * 1.1 + Math.sin(t * 27) * 0.35;
    const carTiltRad = Math.sin(t * 7.2) * 0.012;
    const wheelSpin = roadScroll * 0.14;

    if (paradeSprites.ready && paradeSprites.body.ready) {
      const targetH = 122;
      const targetW = Math.round(
        targetH * (paradeSprites.body.width / Math.max(1, paradeSprites.body.height))
      );
      const carLeft = Math.round(carriageX - targetW * 0.5);
      const carBottomY = Math.round(308 + cobbleBounce);
      const carTop = carBottomY - targetH;

      // Ground contact shadow beneath tires
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(
        carriageX,
        307,
        targetW * 0.41,
        6,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      // Trailing soft exhaust wisps from tailpipe
      for (let pIdx = 0; pIdx < 4; pIdx++) {
        const cycle = (t * 2.1 + pIdx * 0.25) % 1;
        const px = carLeft + targetW * 0.02 - cycle * 42;
        const py = carTop + targetH * 0.81 - cycle * 11;
        const pr = 2.5 + cycle * 4.5;
        ctx.save();
        ctx.globalAlpha = Math.sin(cycle * Math.PI) * 0.42;
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Warm headlight beam projecting forward onto the avenue asphalt
      ctx.save();
      const beamX = carLeft + targetW * 0.985;
      const beamY = carTop + targetH * 0.69;
      const beamGrad = ctx.createLinearGradient(beamX, beamY, beamX + 86, beamY);
      beamGrad.addColorStop(0, 'rgba(254, 249, 195, 0.46)');
      beamGrad.addColorStop(0.55, 'rgba(254, 240, 138, 0.14)');
      beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(beamX, beamY - 5);
      ctx.lineTo(beamX + 86, beamY - 17);
      ctx.lineTo(beamX + 86, beamY + 19);
      ctx.lineTo(beamX, beamY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Draw vehicle body + rippling flags + rotating wheel spokes with celebratory suspension tilt
      const pivotX = carLeft + targetW * 0.22;
      const pivotY = carTop + targetH * 0.84;

      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(carTiltRad);
      ctx.translate(-pivotX, -pivotY);
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(
        paradeSprites.body.canvas,
        carLeft,
        carTop,
        targetW,
        targetH
      );

      // Column-rippling flag helper anchored at the pole side (u=0 -> 0 wave, u=1 -> full ripple)
      const drawRipplingFlag = (
        flagSprite: ParadeCarSprites['leftFlag'],
        rectFrac: ParadeCarSprites['leftFlagRectFrac'],
        poleSide: 'left' | 'right',
        phaseOffset: number
      ) => {
        if (!flagSprite.ready) return;
        const fx = carLeft + rectFrac.x * targetW;
        const fy = carTop + rectFrac.y * targetH;
        const fw = rectFrac.w * targetW;
        const fh = rectFrac.h * targetH;
        const slices = Math.max(6, Math.round(fw / 2));

        for (let i = 0; i < slices; i++) {
          const frac0 = i / slices;
          const frac1 = (i + 1) / slices;
          const srcX = frac0 * flagSprite.width;
          const srcW = Math.max(1, (frac1 - frac0) * flagSprite.width);
          const dstX = fx + frac0 * fw;
          const dstW = (frac1 - frac0) * fw + 0.35;
          const distFromPole = poleSide === 'left' ? frac0 : 1 - frac1;
          const waveY =
            Math.sin(t * 11.5 - distFromPole * 4.4 + phaseOffset) *
            2.1 *
            distFromPole;

          ctx.drawImage(
            flagSprite.canvas,
            srcX,
            0,
            srcW,
            flagSprite.height,
            dstX,
            fy + waveY,
            dstW,
            fh
          );
        }
      };

      drawRipplingFlag(
        paradeSprites.leftFlag,
        paradeSprites.leftFlagRectFrac,
        'right',
        0
      );
      drawRipplingFlag(
        paradeSprites.rightFlag,
        paradeSprites.rightFlagRectFrac,
        'left',
        1.7
      );

      // Animated spinning spokes overlaid inside both gold wheel rims
      const wheelSpecs = [
        { cxFrac: 0.2161, cyFrac: 0.8367 },
        { cxFrac: 0.8174, cyFrac: 0.8367 },
      ];
      wheelSpecs.forEach((ws) => {
        const wx = carLeft + ws.cxFrac * targetW;
        const wy = carTop + ws.cyFrac * targetH;
        const spokeR = 7.2;
        for (let k = 0; k < 2; k++) {
          const ang = wheelSpin + k * (Math.PI * 0.5);
          const dx = Math.cos(ang) * spokeR;
          const dy = Math.sin(ang) * spokeR;
          drawPixelRect(ctx, wx + dx - 1.5, wy + dy - 1.5, 3, 3, '#92400e');
          drawPixelRect(ctx, wx - dx - 1.5, wy - dy - 1.5, 3, 3, '#92400e');
        }
        drawPixelRect(ctx, wx - 2, wy - 2, 4, 4, '#1e293b');
      });

      // Subtle periodic golden glint sweeping across the gold rail & sign
      const glintCycle = (t * 0.65) % 1;
      if (glintCycle < 0.45) {
        const glintU = glintCycle / 0.45;
        const gx = carLeft + targetW * (0.28 + glintU * 0.46);
        const gy = carTop + targetH * 0.62;
        drawPixelRect(ctx, gx - 1, gy - 2, 3, 4, '#fef9c3');
        drawPixelRect(ctx, gx - 2, gy - 1, 5, 2, '#fef08a');
      }

      ctx.restore();
    }

    // 8. Foreground Clapping Crowd along bottom sidewalk (gives depth & framing)
    const fgScroll = roadScroll * 1.15;
    for (const sp of spectatorsFront) {
      const sx =
        ((sp.x - fgScroll) % specSpan + specSpan) % specSpan - 40;
      if (sx >= -30 && sx <= vw + 30) {
        drawSpectator(ctx, sp, sx, 368, t, true);
      }
    }

    // 9. Ticker-Tape & Confetti Shower across the Avenue
    confetti.forEach((c) => {
      const cx =
        ((c.x + c.vx * t + Math.sin(t * 3 + c.phase) * 10) % (vw + 40) +
          (vw + 40)) %
          (vw + 40) -
        20;
      const cy = ((c.y + c.vy * t) % (vh + 20)) - 10;
      drawPixelRect(ctx, cx, cy, c.size, c.size + 1, c.color);
    });
  }, [elapsed, isCompletelyBlack, paradeSprites, spectatorsBack, spectatorsFront, confetti, en]);

  return (
    <div className="fixed inset-0 z-30 bg-black overflow-hidden select-none">
      {/* Pixel-Art Ticker-Tape Parade Canvas */}
      {!isCompletelyBlack && (
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {/* Subtle Parade Caption Header (fades smoothly with the screen) */}
      {!isCompletelyBlack && (
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center px-4"
          style={{
            opacity: Math.max(
              0,
              Math.min(1, elapsed / 0.9) * (1 - easedDarkness)
            ),
          }}
        >
          <div className="pixel-panel-gold px-5 py-2 inline-flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#f8d274]" />
            <span className="font-pixel text-[11px] md:text-xs uppercase tracking-[0.18em] text-[#f8d274] whitespace-nowrap">
              {en
                ? 'Victory Parade · MK11 Crew & Flight Control'
                : 'Desfile Triunfal · Tripulación MK11 y Dirección de Vuelo'}
            </span>
          </div>
        </div>
      )}

      {/* Subtle Skip Button during parade */}
      {!isCompletelyBlack && (
        <button
          type="button"
          onClick={() => {
            skippedRef.current = true;
            setElapsed(TOTAL_PARADE_SECONDS + 1.2);
          }}
          style={{ opacity: Math.max(0, 0.85 * (1 - easedDarkness)) }}
          className="absolute bottom-5 right-5 z-20 px-3.5 py-2 pixel-btn text-xs font-display font-bold cursor-pointer whitespace-nowrap"
        >
          {en ? 'Continue »' : 'Continuar »'}
        </button>
      )}

      {/* Gradual Fade-to-Black Curtain ("poco a poco se vuelve cada vez más negro") */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-10"
        style={{ opacity: easedDarkness }}
      />

      {/* Final Pure-Black Screen: "FIN", "Gracias por jugar Travel MK11", + Options */}
      {isCompletelyBlack && (
        <div
          className="relative z-30 w-full h-full bg-black flex flex-col items-center justify-center p-6 overflow-y-auto"
          style={{ opacity: endScreenOpacity }}
        >
          {!showCredits ? (
            <div className="w-full max-w-xl text-center flex flex-col items-center gap-6">
              <div className="space-y-3">
                <h1
                  className="font-serif font-black text-6xl sm:text-7xl md:text-8xl tracking-[0.22em] text-[#f8d274] uppercase leading-none pl-[0.22em]"
                  style={{
                    textShadow: '0 0 28px rgba(248, 210, 116, 0.25)',
                  }}
                >
                  {en ? 'THE END' : 'FIN'}
                </h1>
                <p className="font-display text-lg sm:text-2xl font-medium text-[#f3f0e6] tracking-wide">
                  {en ? 'Thank you for playing Travel MK11' : 'Gracias por jugar Travel MK11'}
                </p>
              </div>

              <div className="w-24 h-[1px] bg-[#f8d274]/35" />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full pt-2">
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="px-6 py-3 pixel-btn-gold text-sm font-display font-bold cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap min-w-[230px]"
                >
                  <Home className="w-4 h-4" />
                  {en ? 'Return to main menu' : 'Volver al menú principal'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCredits(true)}
                  className="px-6 py-3 pixel-btn text-sm font-display font-bold text-[#f3f0e6] cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap min-w-[190px]"
                >
                  <Film className="w-4 h-4 text-[#7dd3fc]" />
                  {en ? 'View credits' : 'Ver créditos'}
                </button>
              </div>

              {onViewPaperAgain && (
                <button
                  type="button"
                  onClick={onViewPaperAgain}
                  className="mt-2 text-xs font-display text-[#94a3b8] hover:text-[#f8d274] underline underline-offset-4 cursor-pointer"
                >
                  {en ? 'Read El Diario Global again' : 'Leer nuevamente El Diario Global'}
                </button>
              )}
            </div>
          ) : (
            <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center text-center py-6 space-y-7 my-auto">
              {(() => {
                const revealStyle = (delaySec: number, durationSec = 1.05): React.CSSProperties => {
                  const p = Math.max(0, Math.min(1, (creditsElapsed - delaySec) / durationSec));
                  const eased = 1 - Math.pow(1 - p, 3);
                  return {
                    opacity: eased,
                    transform: `translateY(${((1 - eased) * 18).toFixed(1)}px)`,
                  };
                };

                const creditEntries = [
                  { role: 'Director', names: 'Lucas Mancuello', delay: 0.9 },
                  {
                    role: en ? 'Graphic Designers' : 'Diseñadores Gráficos',
                    names: 'Ian Valenzuela · Roland Rivaldi',
                    delay: 2.1,
                  },
                  { role: en ? 'Script' : 'Guion', names: 'Roland Rivaldi', delay: 3.3 },
                  { role: en ? 'Programming' : 'Programación', names: 'Lucas Mancuello', delay: 4.5 },
                  { role: en ? 'Sound' : 'Sonido', names: 'Ian Valenzuela', delay: 5.7 },
                ];

                return (
                  <>
                    <div className="space-y-1.5" style={revealStyle(0.0, 0.9)}>
                      <div className="font-pixel text-[10px] tracking-[0.26em] uppercase text-[#7dd3fc]">
                        Travel MK11
                      </div>
                      <h2 className="font-serif font-black text-3xl sm:text-4xl text-[#f8d274] tracking-[0.16em] uppercase">
                        {en ? 'Credits' : 'Créditos'}
                      </h2>
                      <div className="w-20 h-[1px] bg-[#f8d274]/40 mx-auto mt-2" />
                    </div>

                    <div className="w-full space-y-5 py-2">
                      {creditEntries.map((entry) => (
                        <div
                          key={entry.role}
                          className="space-y-1"
                          style={revealStyle(entry.delay, 1.05)}
                        >
                          <div className="font-pixel text-[11px] uppercase tracking-[0.2em] text-[#f8d274]">
                            {entry.role}
                          </div>
                          <div className="font-display text-lg sm:text-xl font-semibold text-[#f3f0e6]">
                            {entry.names}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="pt-2 space-y-5 w-full flex flex-col items-center"
                      style={revealStyle(6.8, 1.0)}
                    >
                      <div className="w-20 h-[1px] bg-[#f8d274]/30" />
                      <p className="font-display text-sm text-[#cbd5e1] italic">
                        {en ? 'Thank you for playing Travel MK11' : 'Gracias por jugar Travel MK11'}
                      </p>
                    </div>

                    <div
                      className="flex flex-wrap items-center justify-center gap-3 pt-1"
                      style={revealStyle(0.4, 0.8)}
                    >
                      <button
                        type="button"
                        onClick={() => setShowCredits(false)}
                        className="px-5 py-2.5 pixel-btn text-xs font-display font-bold cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {en ? 'Back' : 'Volver'}
                      </button>
                      <button
                        type="button"
                        onClick={onReturnToMenu}
                        className="px-5 py-2.5 pixel-btn-gold text-xs font-display font-bold cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <Award className="w-4 h-4" />
                        {en ? 'Return to main menu' : 'Volver al menú principal'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
