import React, { useEffect, useRef } from 'react';
import { REAL_LUNAR_PHYSICS } from '../data/gameData';
import { useLanguage } from '../i18n/LanguageContext';
import {
  LaunchAbortReason,
  LaunchOutcome,
  LaunchTelemetry,
  MissionResult,
  RocketAssemblyState,
} from '../types/game';
import {
  CleanSprite,
  EARTH_TEXTURE_SRC,
  LAUNCH_SUN_SPRITE_SRC,
  MK11_ROCKET_SHEET_SRC,
  SUN_SPRITE_SRC,
  getRocketVisualTier,
  loadCleanLaunchSunSprite,
  loadCleanSunSprite,
  loadMk11RocketSprites,
} from '../utils/spriteLoader';
import { PostProcessPipeline } from '../utils/postProcess';

const LAUNCH_BASE_BG =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_14.40.58_9059f59e.jpeg';

const COUNTDOWN_SECONDS = 10;
const IGNITION_LEAD_SECONDS = 1.2;
const ASCENT_SECONDS = 12;
const CIRC_SECONDS = 4;
const SEPARATION_P = 0.45;
const GRAVITY = REAL_LUNAR_PHYSICS.earthGravityMs2;
const PAD_TOP = 0.4;
const UNITS_PER_KM = 0.2;

const DEFAULT_ASSEMBLY: RocketAssemblyState = {
  hasCore: true,
  hasBoosters: true,
  hasFairing: true,
  hasAvionics: true,
};

enum Stage {
  Countdown = 'Countdown',
  PadAbort = 'PadAbort',
  Ascent = 'Ascent',
  Falling = 'Falling',
  Exploded = 'Exploded',
  Circularizing = 'Circularizing',
  StrandedOrbit = 'StrandedOrbit',
}

interface LaunchCanvasProps {
  launcherCapacityKg: number;
  showRocket?: boolean;
  assembly?: RocketAssemblyState;
  launchCommand: {
    id: number;
    action: 'prepare' | 'launch';
    result?: MissionResult;
    orbitName?: string;
    assembly?: RocketAssemblyState;
    disableFailures?: boolean;
  };
  onTelemetry: (t: LaunchTelemetry) => void;
}

interface DetachedPart {
  x: number;
  y: number;
  angDeg: number;
  vx: number;
  vy: number;
  spin: number;
  age: number;
}

interface SepParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  life: number;
  kind: 'spark' | 'smoke' | 'ember';
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function inverseLerp(a: number, b: number, v: number): number {
  if (a === b) return 0;
  return clamp01((v - a) / (b - a));
}

function smoothStep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function pathPos(p: number): { x: number; y: number } {
  const y = 200 * UNITS_PER_KM * Math.pow(p, 1.8);
  const x = 0.5 * y * p;
  return { x, y };
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

const CLOUD_BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function cloudHash(ix: number, iy: number, seed: number): number {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function cloudNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = cloudHash(x0, y0, seed);
  const n10 = cloudHash(x0 + 1, y0, seed);
  const n01 = cloudHash(x0, y0 + 1, seed);
  const n11 = cloudHash(x0 + 1, y0 + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function buildPixelCloudSprites(): HTMLCanvasElement[] {
  // 4 sculpted cumulus towers + 2 elongated wispy stratocumulus/cirrus forms
  const blueprints: Array<{
    w: number;
    h: number;
    seed: number;
    flatBase: number;
    puffs: Array<[number, number, number, number]>; // [cx, cy, rx, ry] in normalized 0..1 coords
  }> = [
    {
      w: 104,
      h: 46,
      seed: 101,
      flatBase: 0.74,
      puffs: [
        [0.24, 0.64, 0.19, 0.24],
        [0.40, 0.44, 0.21, 0.34],
        [0.57, 0.50, 0.22, 0.30],
        [0.76, 0.65, 0.18, 0.22],
        [0.48, 0.68, 0.36, 0.20],
      ],
    },
    {
      w: 112,
      h: 48,
      seed: 207,
      flatBase: 0.75,
      puffs: [
        [0.20, 0.68, 0.16, 0.20],
        [0.36, 0.54, 0.19, 0.27],
        [0.54, 0.38, 0.22, 0.34],
        [0.72, 0.56, 0.18, 0.26],
        [0.84, 0.68, 0.13, 0.18],
        [0.52, 0.70, 0.38, 0.18],
      ],
    },
    {
      w: 92,
      h: 42,
      seed: 313,
      flatBase: 0.74,
      puffs: [
        [0.28, 0.60, 0.21, 0.26],
        [0.48, 0.42, 0.24, 0.34],
        [0.68, 0.58, 0.20, 0.26],
        [0.48, 0.68, 0.32, 0.20],
      ],
    },
    {
      w: 118,
      h: 44,
      seed: 421,
      flatBase: 0.76,
      puffs: [
        [0.18, 0.68, 0.15, 0.20],
        [0.34, 0.48, 0.18, 0.30],
        [0.50, 0.56, 0.20, 0.28],
        [0.66, 0.42, 0.19, 0.32],
        [0.82, 0.65, 0.15, 0.21],
        [0.50, 0.71, 0.41, 0.17],
      ],
    },
    {
      w: 120,
      h: 28,
      seed: 547,
      flatBase: 0.72,
      puffs: [
        [0.24, 0.56, 0.21, 0.24],
        [0.46, 0.48, 0.24, 0.30],
        [0.72, 0.54, 0.22, 0.24],
      ],
    },
    {
      w: 108,
      h: 26,
      seed: 653,
      flatBase: 0.72,
      puffs: [
        [0.28, 0.54, 0.22, 0.26],
        [0.54, 0.48, 0.24, 0.28],
        [0.76, 0.58, 0.18, 0.22],
      ],
    },
  ];

  // 5-tone sunlit pixel-art cloud palette (warm sunlit rim -> sky-lit azure -> cool base shadow)
  const palette: Array<[number, number, number]> = [
    [114, 152, 207], // 0: cool base shadow
    [156, 192, 236], // 1: mid shadow
    [207, 227, 252], // 2: sky-lit midtone
    [241, 246, 255], // 3: bright cloud body
    [255, 254, 247], // 4: sunlit cream highlight
  ];

  return blueprints.map((bp) => {
    const c = document.createElement('canvas');
    c.width = bp.w;
    c.height = bp.h;
    const cctx = c.getContext('2d');
    if (!cctx) return c;
    const img = cctx.createImageData(bp.w, bp.h);
    const d = img.data;

    for (let y = 0; y < bp.h; y++) {
      const ny = (y + 0.5) / bp.h;
      for (let x = 0; x < bp.w; x++) {
        const nx = (x + 0.5) / bp.w;

        // Smooth union across puffs with multi-octave cloud turbulence
        let bestDensity = -9;
        let domCx = 0.5;
        let domCy = 0.5;
        let domRx = 0.2;
        let domRy = 0.2;
        for (const [cx, cy, rx, ry] of bp.puffs) {
          const dx = (nx - cx) / rx;
          const dy = (ny - cy) / ry;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const dens = 1 - dist;
          if (dens > bestDensity) {
            bestDensity = dens;
            domCx = cx;
            domCy = cy;
            domRx = rx;
            domRy = ry;
          }
        }

        const turb =
          (cloudNoise(nx * 10, ny * 6, bp.seed) - 0.5) * 0.24 +
          (cloudNoise(nx * 22, ny * 14, bp.seed + 17) - 0.5) * 0.12;
        const density = bestDensity + turb;

        // Gentle wind-sheared flat base
        const baseShear = (ny - bp.flatBase) / 0.14;
        if (density <= 0.04 || baseShear > 1.0) continue;

        const baseAtten = baseShear > 0 ? 1 - baseShear : 1;
        if (density * baseAtten <= 0.05) continue;

        // Directional illumination from upper-left sun
        const localNx = (nx - domCx) / domRx;
        const localNy = (ny - domCy) / domRy;
        const sunDot = -localNx * 0.45 - localNy * 0.65;
        const verticalLit = 1 - ny;
        const shadeVal = clamp01(
          0.22 + verticalLit * 0.54 + sunDot * 0.28 + Math.min(0.24, density * 0.28) - Math.max(0, baseShear) * 0.35
        );

        const bayer = (CLOUD_BAYER_4X4[y & 3][x & 3] / 16 - 0.5) * 0.19;
        const levelFloat = clamp01(shadeVal + bayer) * 4;
        const toneIdx = Math.max(0, Math.min(4, Math.round(levelFloat)));
        const [r, g, b] = palette[toneIdx];

        // Soft feathered pixel-art alpha at thin outer fringes
        const edgeAlpha = clamp01((density * baseAtten - 0.05) / 0.16);
        const alpha = edgeAlpha > 0.72 ? 255 : Math.round(edgeAlpha * 235);

        const idx = (y * bp.w + x) * 4;
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = alpha;
      }
    }

    cctx.putImageData(img, 0, 0);
    return c;
  });
}

interface NozzleSpec {
  leftX: number;
  leftY: number;
  centerX: number;
  centerY: number;
  rightX: number;
  rightY: number;
}

function detectStage1Nozzles(idle: CleanSprite): NozzleSpec {
  const fallback: NozzleSpec = {
    leftX: 0.20,
    leftY: 0.962,
    centerX: 0.50,
    centerY: 0.988,
    rightX: 0.80,
    rightY: 0.962,
  };
  if (!idle.ready) return fallback;
  const w = idle.width;
  const h = idle.height;
  const ictx = idle.canvas.getContext('2d');
  if (!ictx) return fallback;
  const data = ictx.getImageData(0, 0, w, h).data;

  const scanBand = (x0Frac: number, x1Frac: number, defX: number, defY: number) => {
    const x0 = Math.max(0, Math.floor(w * x0Frac));
    const x1 = Math.min(w - 1, Math.ceil(w * x1Frac));
    const yStart = Math.floor(h * 0.82);
    let maxY = -1;
    let sumX = 0;
    let countX = 0;
    for (let x = x0; x <= x1; x++) {
      let colMax = -1;
      for (let y = h - 1; y >= yStart; y--) {
        if (data[(y * w + x) * 4 + 3] > 35) {
          colMax = y;
          break;
        }
      }
      if (colMax > maxY) {
        maxY = colMax;
        sumX = x;
        countX = 1;
      } else if (colMax >= maxY - 2 && colMax > 0) {
        sumX += x;
        countX++;
      }
    }
    if (maxY <= yStart || countX === 0) return { x: defX, y: defY };
    return {
      x: (sumX / countX + 0.5) / w,
      y: Math.min(0.995, (maxY + 0.5) / h),
    };
  };

  const left = scanBand(0.06, 0.30, fallback.leftX, fallback.leftY);
  const center = scanBand(0.36, 0.64, fallback.centerX, fallback.centerY);
  const right = scanBand(0.70, 0.94, fallback.rightX, fallback.rightY);
  return {
    leftX: left.x,
    leftY: left.y,
    centerX: center.x,
    centerY: center.y,
    rightX: right.x,
    rightY: right.y,
  };
}

function detectSingleNozzle(spr: CleanSprite): { x: number; y: number } {
  const fallback = { x: 0.48, y: 0.985 };
  if (!spr.ready) return fallback;
  const w = spr.width;
  const h = spr.height;
  const sctx = spr.canvas.getContext('2d');
  if (!sctx) return fallback;
  const data = sctx.getImageData(0, 0, w, h).data;
  const yStart = Math.floor(h * 0.86);
  let maxY = -1;
  let sumX = 0;
  let countX = 0;
  for (let x = Math.floor(w * 0.25); x <= Math.ceil(w * 0.75); x++) {
    let colMax = -1;
    for (let y = h - 1; y >= yStart; y--) {
      if (data[(y * w + x) * 4 + 3] > 35) {
        colMax = y;
        break;
      }
    }
    if (colMax > maxY) {
      maxY = colMax;
      sumX = x;
      countX = 1;
    } else if (colMax >= maxY - 2 && colMax > 0) {
      sumX += x;
      countX++;
    }
  }
  if (maxY <= yStart || countX === 0) return fallback;
  return {
    x: (sumX / countX + 0.5) / w,
    y: Math.min(0.995, (maxY + 0.5) / h),
  };
}

function buildMultiFramePlumeSet(
  w: number,
  h: number,
  frameCount: number,
  seed: number,
  variant: 'core' | 'booster' | 'vacuum'
): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  // High-contrast pixel-art thermal flame palette (crimson -> orange -> gold -> solar yellow -> incandescent white)
  const pal: Array<[number, number, number]> = [
    [153, 27, 27],   // 0: deep crimson ember
    [220, 38, 38],   // 1: red flame
    [249, 115, 22],  // 2: fiery orange
    [251, 146, 60],  // 3: bright amber
    [250, 204, 21],  // 4: solar yellow
    [254, 240, 138], // 5: hot cream yellow
    [255, 253, 232], // 6: incandescent white core
  ];

  for (let f = 0; f < frameCount; f++) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const fctx = c.getContext('2d');
    if (!fctx) {
      frames.push(c);
      continue;
    }
    const img = fctx.createImageData(w, h);
    const d = img.data;
    const phase = (f / frameCount) * Math.PI * 2;
    const diamondShift = (f / frameCount) * 0.22;

    for (let y = 0; y < h; y++) {
      // Leave clean bottom margin so flame tips & embers never clip flat
      const ny = y / (h - 1);
      if (ny > 0.97) continue;

      // Flowing wave sweeping downward across frames
      const waveA = Math.sin(ny * 14.5 - phase + seed);
      const waveB = Math.cos(ny * 25.0 - phase * 2 + seed * 1.7);
      const lateralSway = waveA * 0.045 * ny + waveB * 0.025 * Math.pow(ny, 1.3);

      // Envelope width: full inside nozzle throat (ny near 0), subtle Mach bulge, sharp tapered point
      const topWidth = variant === 'core' ? 0.36 : variant === 'vacuum' ? 0.34 : 0.33;
      const swell =
        variant === 'vacuum'
          ? Math.sin(Math.min(1, ny * 1.35) * Math.PI) * 0.14
          : Math.sin(Math.min(1, ny * 1.55) * Math.PI) * 0.08;
      const taper = Math.pow(Math.max(0, 1 - ny / 0.90), 0.78);
      const halfW = (topWidth + swell) * taper + (ny < 0.08 ? topWidth * 0.18 : 0);

      // Mach shock diamonds pulsing downward inside inner core
      const shockPulse =
        0.5 + 0.5 * Math.cos((ny - diamondShift) * Math.PI * 6.0);

      for (let x = 0; x < w; x++) {
        const nx = (x + 0.5) / w - 0.5 - lateralSway;
        const distNorm = Math.abs(nx) / Math.max(0.02, halfW);

        // Jagged pixel-art tongue edge perturbation
        const edgeJitter =
          (cloudNoise((x + f * 3.1) * 0.48, (y - f * 4.5) * 0.38, seed + f * 13) - 0.5) *
          (0.28 + ny * 0.36);

        const heat = 1.0 - distNorm + edgeJitter - ny * 0.32 + (ny < 0.45 ? shockPulse * 0.18 : 0);

        let colorIdx = -1;
        let alpha = 0;

        if (heat > 0.08 && ny < 0.88 + waveB * 0.05) {
          const temp = clamp01((heat - 0.08) / 0.92 + (1 - ny) * 0.24 + (ny < 0.2 ? 0.28 : 0));
          colorIdx = Math.min(6, Math.max(0, Math.round(temp * 6)));
          alpha = temp > 0.16 ? 255 : 210;
        } else if (ny >= 0.58 && ny < 0.96 && Math.abs(nx) < halfW * 1.35 + 0.09) {
          // Animated detached pixel sparks/embers streaming downward across frames
          const scrollY = (y - f * Math.max(2, Math.round(h * 0.085)) + h * 10) % h;
          const sparkHash = cloudHash(Math.floor(x / 1.5), Math.floor(scrollY / 2), seed + 91);
          const sparkThreshold = ny > 0.84 ? 0.93 : 0.958;
          if (sparkHash > sparkThreshold) {
            colorIdx = sparkHash > 0.982 ? 4 : sparkHash > 0.965 ? 2 : 1;
            alpha = Math.round(255 * clamp01((0.97 - ny) / 0.18));
          }
        }

        if (colorIdx >= 0 && alpha > 0) {
          const [r, g, b] = pal[colorIdx];
          const p = (y * w + x) * 4;
          d[p] = r;
          d[p + 1] = g;
          d[p + 2] = b;
          d[p + 3] = alpha;
        }
      }
    }

    fctx.putImageData(img, 0, 0);
    frames.push(c);
  }
  return frames;
}

export const LaunchCanvas: React.FC<LaunchCanvasProps> = ({
  launcherCapacityKg,
  showRocket = true,
  assembly = DEFAULT_ASSEMBLY,
  launchCommand,
  onTelemetry,
}) => {
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const showRocketRef = useRef(showRocket);
  const prevShowRocketRef = useRef(showRocket);
  const spawnGlowRef = useRef(0);

  const assemblyRef = useRef<RocketAssemblyState>(assembly);
  assemblyRef.current = assembly;

  const shownAssemblyRef = useRef<RocketAssemblyState>({
    hasCore: false,
    hasBoosters: false,
    hasFairing: false,
    hasAvionics: false,
  });

  const partAnimsRef = useRef({
    core: { active: false, p: 0, delay: 0 },
    boosters: { active: false, p: 0, delay: 0 },
    fairing: { active: false, p: 0, delay: 0 },
    avionics: { active: false, p: 0, delay: 0 },
  });

  const anims = partAnimsRef.current;
  if (!assembly.hasCore) {
    shownAssemblyRef.current.hasCore = false;
    anims.core = { active: false, p: 0, delay: 0 };
  }
  if (!assembly.hasBoosters) {
    shownAssemblyRef.current.hasBoosters = false;
    anims.boosters = { active: false, p: 0, delay: 0 };
  }
  if (!assembly.hasFairing) {
    shownAssemblyRef.current.hasFairing = false;
    anims.fairing = { active: false, p: 0, delay: 0 };
  }
  if (!assembly.hasAvionics) {
    shownAssemblyRef.current.hasAvionics = false;
    anims.avionics = { active: false, p: 0, delay: 0 };
  }

  if (showRocket) {
    const prevShown = shownAssemblyRef.current;
    let queueOrder = 0;

    const syncPart = (
      key: keyof RocketAssemblyState,
      animKey: keyof typeof anims
    ) => {
      const want = assembly[key];
      const had = prevShown[key];
      if (want && !had) {
        anims[animKey] = { active: true, p: 0, delay: queueOrder * 0.36 };
        queueOrder++;
      } else if (want && had && !anims[animKey].active) {
        anims[animKey] = { active: true, p: 1, delay: 0 };
      }
    };

    syncPart('hasCore', 'core');
    syncPart('hasBoosters', 'boosters');
    syncPart('hasFairing', 'fairing');
    syncPart('hasAvionics', 'avionics');

    shownAssemblyRef.current = { ...assembly };
    if (!prevShowRocketRef.current && queueOrder > 0) {
      spawnGlowRef.current = 1;
    }
  }
  prevShowRocketRef.current = showRocket;
  showRocketRef.current = showRocket;

  const stateRef = useRef({
    outcome: LaunchOutcome.Idle,
    phase: lang === 'en' ? 'Ready to launch' : 'Listo para lanzar',
    resultMessage: '',
    abortReason: null as LaunchAbortReason | null,
    altitudeKm: 0,
    speedKms: 0,
    deltaVBurned: 0,
    deltaVRequired: 0,
    stage: Stage.Countdown,
    res: null as MissionResult | null,
    orbitName: '',
    t: 0,
    tCirc: 0,
    circStartAngDeg: -37.87,
    tAbort: 0,
    tOrbit: 0,
    orbitCenterX: 0,
    orbitCenterY: 0,
    orbitRadius: 4.4,
    orbitAngleRad: 0,
    willAbortOnPad: false,
    willFailLaunch: false,
    willFailOrbit: false,
    separated: false,
    sepFlashT: -1,
    failP: 1,
    rocketX: 0,
    rocketY: PAD_TOP,
    rocketAngDeg: 0,
    rocketVisible: true,
    lastVelX: 0,
    lastVelY: 0,
    fallVelX: 0,
    fallVelY: 0,
    spinDeg: 0,
    flame1On: false,
    flame2On: false,
    detachedStage1: null as DetachedPart | null,
    detachedFairing: null as DetachedPart | null,
    detachedFairingL: null as DetachedPart | null,
    sepParticles: [] as SepParticle[],
    exhaustParticles: [] as SepParticle[],
    trail: [] as { x: number; y: number }[],
    ascentP: 0,
    camLockX: 0,
    camLockY: 0,
    camLocked: false,
    explosion: null as { x: number; y: number; t: number } | null,
    capacityKg: launcherCapacityKg,
  });

  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  useEffect(() => {
    const s = stateRef.current;
    if (s.outcome === LaunchOutcome.Idle) {
      s.phase = lang === 'en' ? 'Ready to launch' : 'Listo para lanzar';
      onTelemetryRef.current({
        outcome: s.outcome,
        phase: s.phase,
        resultMessage: s.resultMessage,
        altitudeKm: s.altitudeKm,
        speedKms: s.speedKms,
        deltaVBurned: s.deltaVBurned,
        deltaVRequired: s.deltaVRequired,
        countdownRemaining: COUNTDOWN_SECONDS,
        abortReason: s.abortReason,
      });
    }
  }, [lang]);

  useEffect(() => {
    const s = stateRef.current;
    if (launchCommand.action === 'prepare') {
      if (s.outcome === LaunchOutcome.Running) return;
      s.outcome = LaunchOutcome.Idle;
      s.phase = langRef.current === 'en' ? 'Ready to launch' : 'Listo para lanzar';
      s.resultMessage = '';
      s.abortReason = null;
      s.altitudeKm = 0;
      s.speedKms = 0;
      s.deltaVBurned = 0;
      s.stage = Stage.Countdown;
      s.willAbortOnPad = false;
      s.rocketX = 0;
      s.rocketY = PAD_TOP;
      s.rocketAngDeg = 0;
      s.rocketVisible = true;
      s.flame1On = false;
      s.flame2On = false;
      s.separated = false;
      s.sepFlashT = -1;
      s.detachedStage1 = null;
      s.detachedFairing = null;
      s.detachedFairingL = null;
      s.sepParticles = [];
      s.exhaustParticles = [];
      s.trail = [];
      s.circStartAngDeg = 0;
      s.ascentP = 0;
      s.camLocked = false;
      s.explosion = null;
      s.capacityKg = launcherCapacityKg;
      onTelemetryRef.current({
        outcome: s.outcome,
        phase: s.phase,
        resultMessage: s.resultMessage,
        altitudeKm: s.altitudeKm,
        speedKms: s.speedKms,
        deltaVBurned: s.deltaVBurned,
        deltaVRequired: s.deltaVRequired,
        countdownRemaining: COUNTDOWN_SECONDS,
        abortReason: null,
      });
    } else if (launchCommand.action === 'launch' && launchCommand.result) {
      if (s.outcome !== LaunchOutcome.Idle) return;
      const res = launchCommand.result;
      const asm = launchCommand.assembly ?? assemblyRef.current;
      const hasFuel = res.fuelMassKg > 0;
      const isComplete =
        asm.hasCore && asm.hasBoosters && asm.hasFairing && asm.hasAvionics;

      const noFail = Boolean(launchCommand.disableFailures);
      s.res = res;
      s.orbitName = launchCommand.orbitName || '';
      s.deltaVRequired = res.deltaVRequired;
      s.deltaVBurned = 0;
      s.willAbortOnPad = !hasFuel || !isComplete;
      s.willFailLaunch =
        !noFail && !s.willAbortOnPad && res.totalMassKg > res.launcherCapacityKg;
      const k =
        res.totalMassKg > 0
          ? Math.min(1, res.launcherCapacityKg / res.totalMassKg)
          : 0;
      const requiredTargetDv = Math.max(100, res.deltaVRequired);
      s.failP = lerp(0.2, 0.92, inverseLerp(0.4, 1, k));
      s.willFailOrbit =
        !noFail &&
        !s.willAbortOnPad &&
        !s.willFailLaunch &&
        (res.fuelMassKg <= 0 || res.deltaVAvailable < requiredTargetDv);
      s.abortReason = !hasFuel
        ? 'no_fuel'
        : !isComplete
          ? 'incomplete'
          : s.willFailLaunch
            ? 'overweight'
            : s.willFailOrbit
              ? 'low_dv'
              : null;
      s.t = 0;
      s.tAbort = 0;
      s.separated = false;
      s.sepFlashT = -1;
      s.detachedStage1 = null;
      s.detachedFairing = null;
      s.detachedFairingL = null;
      s.sepParticles = [];
      s.exhaustParticles = [];
      s.trail = [];
      s.circStartAngDeg = 0;
      s.ascentP = 0;
      s.camLocked = false;
      s.explosion = null;
      s.rocketX = 0;
      s.rocketY = PAD_TOP;
      s.rocketAngDeg = 0;
      s.rocketVisible = true;
      s.flame1On = false;
      s.flame2On = false;
      s.outcome = LaunchOutcome.Running;
      s.capacityKg = res.launcherCapacityKg;
      const en = langRef.current === 'en';
      if (s.willAbortOnPad) {
        s.stage = Stage.PadAbort;
        s.tAbort = 0;
        s.phase =
          s.abortReason === 'no_fuel'
            ? en
              ? 'Out of fuel! Pad abort'
              : '¡Sin combustible! Aborto en plataforma'
            : en
              ? 'Incomplete rocket! Launch aborted'
              : '¡Cohete incompleto! Despegue abortado';
        for (let i = 0; i < 16; i++) {
          const ang = Math.PI * (0.1 + 0.8 * Math.random());
          const spd = 1.0 + Math.random() * 2.0;
          s.sepParticles.push({
            x: (Math.random() - 0.5) * 0.6,
            y: PAD_TOP + 0.25,
            vx: Math.cos(ang) * spd * (Math.random() < 0.5 ? -1 : 1),
            vy: Math.sin(ang) * spd * 0.55,
            size: 0.22 + Math.random() * 0.18,
            age: 0,
            life: 0.85 + Math.random() * 0.45,
            kind: 'smoke',
          });
        }
        onTelemetryRef.current({
          outcome: s.outcome,
          phase: s.phase,
          resultMessage: s.resultMessage,
          altitudeKm: 0,
          speedKms: 0,
          deltaVBurned: 0,
          deltaVRequired: s.deltaVRequired,
          countdownRemaining: 0,
          abortReason: s.abortReason,
        });
      } else {
        s.stage = Stage.Countdown;
        s.phase = en ? 'Countdown' : 'Cuenta regresiva';
      }
    }
  }, [launchCommand, launcherCapacityKg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };

    const pipeline = new PostProcessPipeline();

    const imgBase = loadImg(LAUNCH_BASE_BG);
    const imgEarth = loadImg(EARTH_TEXTURE_SRC);
    const sprLaunchSun = loadCleanLaunchSunSprite(LAUNCH_SUN_SPRITE_SRC);
    const sprSpaceSun = loadCleanSunSprite(SUN_SPRITE_SRC, false);
    const baseCleanCanvas = document.createElement('canvas');
    let baseCleanReady = false;
    let baseStripLeftW = 0;
    let baseStripRightX = 0;

    imgBase.onload = () => {
      const bw = imgBase.naturalWidth;
      const bh = imgBase.naturalHeight;
      if (!bw || !bh) return;
      baseCleanCanvas.width = bw;
      baseCleanCanvas.height = bh;
      const bctx = baseCleanCanvas.getContext('2d');
      if (!bctx) return;
      bctx.drawImage(imgBase, 0, 0);
      const idata = bctx.getImageData(0, 0, bw, bh);
      const d = idata.data;
      const skyBottomY = Math.floor(bh * 0.854);
      const cloudBottomY = Math.floor(bh * 0.685);

      const isSkyOrCloud = (x: number, y: number): boolean => {
        if (y >= skyBottomY) return false;
        const i = (y * bw + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        // Open sky blue (strictly saturated blue, excludes grey-blue concrete & dark outlines)
        const isBlueSky = b > r + 26 && b > 104 && b >= g + 8;
        // Upper painted static clouds in the original sky asset
        const isStaticCloud =
          y < cloudBottomY &&
          r > 176 &&
          g > 192 &&
          b > 208 &&
          Math.abs(b - r) < 64;
        return isBlueSky || isStaticCloud;
      };

      // 1) Exterior-seeded BFS flood fill so enclosed concrete pad, pipes, ladder & ramp stay 100% opaque
      const skyMask = new Uint8Array(bw * bh);
      const queue = new Int32Array(bw * bh);
      let head = 0;
      let tail = 0;

      const tryEnqueue = (x: number, y: number) => {
        if (x < 0 || x >= bw || y < 0 || y >= skyBottomY) return;
        const idx = y * bw + x;
        if (skyMask[idx]) return;
        if (isSkyOrCloud(x, y)) {
          skyMask[idx] = 1;
          queue[tail++] = idx;
        }
      };

      for (let x = 0; x < bw; x++) {
        tryEnqueue(x, 0);
      }
      for (let y = 1; y < skyBottomY; y++) {
        tryEnqueue(0, y);
        tryEnqueue(bw - 1, y);
      }

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % bw;
        const cy = (cur - cx) / bw;
        tryEnqueue(cx - 1, cy);
        tryEnqueue(cx + 1, cy);
        tryEnqueue(cx, cy - 1);
        tryEnqueue(cx, cy + 1);
      }

      // 2) Also key enclosed vivid sky pockets strictly inside red gantry tower lattice & swing arms
      const towerX0 = Math.floor(bw * 0.315);
      const towerArmX1 = Math.floor(bw * 0.525);
      const towerColX1 = Math.floor(bw * 0.405);
      const armBottomY = Math.floor(bh * 0.66);
      const towerY1 = Math.floor(bh * 0.838);
      for (let y = 0; y < towerY1; y++) {
        const maxX = y < armBottomY ? towerArmX1 : towerColX1;
        for (let x = towerX0; x <= maxX; x++) {
          const idx = y * bw + x;
          if (skyMask[idx]) continue;
          const i = idx * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const isVividSkyHole = b > r + 60 && b > 132 && b > g + 22;
          const isTowerCloudHole =
            y < cloudBottomY && r > 188 && g > 200 && b > 214 && b >= r;
          if (isVividSkyHole || isTowerCloudHole) {
            skyMask[idx] = 1;
          }
        }
      }

      // Small enclosed sky triangle under the diagonal launch ramp strut on the right
      const rampX0 = Math.floor(bw * 0.65);
      const rampX1 = Math.floor(bw * 0.74);
      const rampY0 = Math.floor(bh * 0.68);
      const rampY1 = Math.floor(bh * 0.795);
      for (let y = rampY0; y <= rampY1; y++) {
        for (let x = rampX0; x <= rampX1; x++) {
          const idx = y * bw + x;
          if (skyMask[idx]) continue;
          const i = idx * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          if (b > r + 62 && b > 138 && b > g + 24) {
            skyMask[idx] = 1;
          }
        }
      }

      // Apply transparency to skyMask pixels
      for (let idx = 0; idx < skyMask.length; idx++) {
        if (skyMask[idx]) {
          d[idx * 4 + 3] = 0;
        }
      }

      // 3) Neighbor-only edge spill softening (never touches interior concrete/metal pixels!)
      for (let y = 1; y < skyBottomY - 1; y++) {
        for (let x = 1; x < bw - 1; x++) {
          const idx = y * bw + x;
          if (skyMask[idx]) continue;
          const touchesSky =
            skyMask[idx - 1] ||
            skyMask[idx + 1] ||
            skyMask[idx - bw] ||
            skyMask[idx + bw];
          if (!touchesSky) continue;
          const i = idx * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const blueExcess = b - Math.max(r, g * 0.92);
          if (blueExcess > 28 && b > 120 && b > g + 12) {
            const spillK = clamp01((blueExcess - 28) / 36);
            d[i + 3] = Math.round(255 * (1 - spillK * 0.55));
            d[i + 2] = Math.round(b - blueExcess * 0.48);
          }
        }
      }

      bctx.putImageData(idata, 0, 0);
      baseStripLeftW = Math.floor(bw * 0.14);
      baseStripRightX = Math.floor(bw * 0.86);
      baseCleanReady = true;
    };

    let cachedNozzles: NozzleSpec | null = null;
    let cachedDesacopleNozzle: { x: number; y: number } | null = null;
    const plumeFrames = {
      core: buildMultiFramePlumeSet(34, 72, 8, 19, 'core'),
      boosterL: buildMultiFramePlumeSet(24, 56, 8, 53, 'booster'),
      boosterR: buildMultiFramePlumeSet(24, 56, 8, 89, 'booster'),
      vacuum: buildMultiFramePlumeSet(30, 62, 8, 131, 'vacuum'),
    };

    const mk11Sprites = loadMk11RocketSprites(MK11_ROCKET_SHEET_SRC, () => {
      cachedNozzles = detectStage1Nozzles(mk11Sprites.idle);
      cachedDesacopleNozzle = detectSingleNozzle(mk11Sprites.desacopleBody);
    });

    const getStage1Nozzles = (): NozzleSpec => {
      if (!cachedNozzles && mk11Sprites.idle.ready) {
        cachedNozzles = detectStage1Nozzles(mk11Sprites.idle);
      }
      return (
        cachedNozzles ?? {
          leftX: 0.20,
          leftY: 0.962,
          centerX: 0.50,
          centerY: 0.988,
          rightX: 0.80,
          rightY: 0.962,
        }
      );
    };

    const getDesacopleNozzle = (): { x: number; y: number } => {
      if (!cachedDesacopleNozzle && mk11Sprites.desacopleBody.ready) {
        cachedDesacopleNozzle = detectSingleNozzle(mk11Sprites.desacopleBody);
      }
      return cachedDesacopleNozzle ?? { x: 0.48, y: 0.985 };
    };

    const sprites = {
      light: {
        s1: loadImg('/assets/game/cohetes/cohete_ligero_etapa1.png'),
        s2: loadImg('/assets/game/cohetes/cohete_ligero_etapa2.png'),
        f1: loadImg('/assets/game/cohetes/cohete_ligero_llama.png'),
        f2: loadImg('/assets/game/cohetes/cohete_ligero_llama.png'),
        fairing: null as HTMLImageElement | null,
      },
      heavy: {
        s1: loadImg('/assets/game/cohetes/cohete_pesado_etapa1_alta.png'),
        s2: loadImg('/assets/game/cohetes/cohete_pesado_etapa2.png'),
        f1: loadImg('/assets/game/cohetes/cohete_pesado_llama.png'),
        f2: loadImg('/assets/game/cohetes/cohete_ligero_llama.png'),
        fairing: loadImg('/assets/game/cohetes/cohete_pesado_cofia.png'),
      },
    };

    const cloudSprites = buildPixelCloudSprites();

    let seed = 7;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const clouds: {
      x: number;
      y: number;
      w: number;
      h: number;
      speed: number;
      layer: number;
      spriteIdx: number;
      flip: boolean;
    }[] = [];
    for (let i = 0; i < 16; i++) {
      const layer = i % 3;
      const spriteIdx = layer === 0 && i % 2 === 0 ? 4 + (i % 2) : i % 4;
      const isWispy = spriteIdx >= 4;
      const baseW = (isWispy ? 5.6 : 4.2) + rand() * 3.8 + layer * 0.85;
      const aspect =
        cloudSprites[spriteIdx].height / Math.max(1, cloudSprites[spriteIdx].width);
      clouds.push({
        x: rand() * 68 - 34,
        y: (isWispy ? 5.0 : 2.1) + rand() * (isWispy ? 5.8 : 6.6),
        w: baseW,
        h: baseW * aspect,
        speed:
          (0.14 + rand() * 0.20) * (layer === 0 ? 0.5 : layer === 1 ? 0.86 : 1.28),
        layer,
        spriteIdx,
        flip: rand() > 0.5,
      });
    }
    const starTints = [
      '255, 255, 255',
      '196, 228, 255',
      '255, 244, 214',
      '224, 231, 255',
    ];
    const stars: { x: number; y: number; s: number; phase: number; tint: string; isHero: boolean }[] = [];
    for (let i = 0; i < 130; i++) {
      stars.push({
        x: rand() * 140 - 60,
        y: 9 + rand() * 92,
        s: 0.075 + rand() * 0.135,
        phase: rand() * Math.PI * 2,
        tint: starTints[i % starTints.length],
        isHero: i % 11 === 0,
      });
    }

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(parent.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(parent.clientHeight * dpr));
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTime = performance.now();
    let lastPush = 0;

    const drawCleanFitHeight = (
      spr: CleanSprite,
      cx: number,
      cy: number,
      heightPx: number
    ) => {
      if (!spr.ready) return false;
      const aspect = spr.width / Math.max(1, spr.height);
      const wPx = heightPx * aspect;
      const prevSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr.canvas, cx - wPx / 2, cy - heightPx / 2, wPx, heightPx);
      ctx.imageSmoothingEnabled = prevSmooth;
      return true;
    };

    const drawSpriteFitHeight = (
      img: HTMLImageElement | null,
      cx: number,
      cy: number,
      heightPx: number,
      fallbackColor: string,
      fallbackWidthPx: number
    ) => {
      if (img && img.complete && img.naturalWidth > 0) {
        const aspect = img.naturalWidth / img.naturalHeight;
        const wPx = heightPx * aspect;
        const prevSmooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, cx - wPx / 2, cy - heightPx / 2, wPx, heightPx);
        ctx.imageSmoothingEnabled = prevSmooth;
      } else {
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(cx - fallbackWidthPx / 2, cy - heightPx / 2, fallbackWidthPx, heightPx);
      }
    };

    const drawFlameGlow = (cx: number, cy: number, radiusPx: number, intensity = 1) => {
      const glow = ctx.createRadialGradient(cx, cy, radiusPx * 0.08, cx, cy, radiusPx);
      glow.addColorStop(0, `rgba(255, 240, 175, ${(0.56 * intensity).toFixed(3)})`);
      glow.addColorStop(0.42, `rgba(249, 115, 22, ${(0.28 * intensity).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      ctx.fill();
    };

    // Renders a multi-frame pixel-art animated flame anchored cleanly inside a nozzle bell
    const drawMultiFramePlume = (
      frames: HTMLCanvasElement[],
      nozzleX: number,
      nozzleY: number,
      baseHeightPx: number,
      widthMult: number,
      nowMs: number,
      ramp = 1,
      frameOffset = 0
    ) => {
      if (frames.length === 0 || ramp <= 0.02) return;
      const frameIdx = (Math.floor(nowMs / 44) + frameOffset) % frames.length;
      const frameCanvas = frames[frameIdx];
      const aspect = frameCanvas.width / Math.max(1, frameCanvas.height);
      const baseWPx = baseHeightPx * aspect * widthMult;

      const wave = 0.5 + 0.5 * Math.sin(nowMs * 0.048 + frameOffset);
      const scaleY = (0.94 + 0.14 * wave) * (0.38 + 0.65 * ramp);
      const scaleX = (0.95 + 0.08 * Math.cos(nowMs * 0.072 + frameOffset)) * (0.72 + 0.30 * ramp);

      // Overlap flame origin slightly upward inside nozzle lip so fire clearly pours out with zero gap
      const overlapUpPx = Math.max(3, baseHeightPx * 0.075);

      drawFlameGlow(
        nozzleX,
        nozzleY + baseHeightPx * 0.36 * scaleY,
        Math.max(baseWPx, baseHeightPx) * 0.85 * scaleY,
        ramp
      );

      const prevSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(nozzleX, nozzleY - overlapUpPx);
      ctx.scale(scaleX, scaleY);
      ctx.drawImage(frameCanvas, -baseWPx / 2, 0, baseWPx, baseHeightPx);
      ctx.restore();
      ctx.imageSmoothingEnabled = prevSmooth;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const s = stateRef.current;

      // Update detached pieces (smooth ballistic drift & tumble)
      if (s.detachedStage1) {
        s.detachedStage1.age += dt;
        s.detachedStage1.vy -= GRAVITY * 0.58 * dt;
        s.detachedStage1.x += s.detachedStage1.vx * dt;
        s.detachedStage1.y += s.detachedStage1.vy * dt;
        s.detachedStage1.angDeg += s.detachedStage1.spin * dt;
        if (s.detachedStage1.age < 2.1 && Math.random() < 0.75) {
          const rad = (-s.detachedStage1.angDeg * Math.PI) / 180;
          s.sepParticles.push({
            x: s.detachedStage1.x + Math.sin(rad) * 3.1 + (Math.random() - 0.5) * 0.28,
            y: s.detachedStage1.y + Math.cos(rad) * 3.1,
            vx: s.detachedStage1.vx * 0.4 + (Math.random() - 0.5) * 1.1,
            vy: s.detachedStage1.vy * 0.4 - 0.8,
            size: 0.15 + Math.random() * 0.16,
            age: 0,
            life: 0.55 + Math.random() * 0.35,
            kind: Math.random() < 0.4 ? 'ember' : 'smoke',
          });
        }
        if (s.detachedStage1.y <= 0.3 || s.detachedStage1.age > 4.6) {
          s.detachedStage1 = null;
        }
      }
      if (s.detachedFairing) {
        s.detachedFairing.age += dt;
        s.detachedFairing.vy -= GRAVITY * 0.55 * dt;
        s.detachedFairing.x += s.detachedFairing.vx * dt;
        s.detachedFairing.y += s.detachedFairing.vy * dt;
        s.detachedFairing.angDeg += s.detachedFairing.spin * dt;
        if (s.detachedFairing.y <= 0.3 || s.detachedFairing.age > 4.2) {
          s.detachedFairing = null;
        }
      }
      if (s.detachedFairingL) {
        s.detachedFairingL.age += dt;
        s.detachedFairingL.vy -= GRAVITY * 0.55 * dt;
        s.detachedFairingL.x += s.detachedFairingL.vx * dt;
        s.detachedFairingL.y += s.detachedFairingL.vy * dt;
        s.detachedFairingL.angDeg += s.detachedFairingL.spin * dt;
        if (s.detachedFairingL.y <= 0.3 || s.detachedFairingL.age > 4.2) {
          s.detachedFairingL = null;
        }
      }
      if (s.sepFlashT >= 0) {
        s.sepFlashT += dt;
        if (s.sepFlashT > 0.9) s.sepFlashT = -1;
      }
      for (let i = s.sepParticles.length - 1; i >= 0; i--) {
        const pt = s.sepParticles[i];
        pt.age += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy -= (pt.kind === 'smoke' ? 0.6 : 2.8) * dt;
        if (pt.age >= pt.life) {
          s.sepParticles.splice(i, 1);
        }
      }

      // Live exhaust fire sparks & smoke trails
      for (let i = s.exhaustParticles.length - 1; i >= 0; i--) {
        const pt = s.exhaustParticles[i];
        pt.age += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.kind === 'smoke') {
          pt.vx *= 0.985;
          pt.vy *= 0.985;
        }
        if (pt.age >= pt.life) {
          s.exhaustParticles.splice(i, 1);
        }
      }

      if (s.explosion) {
        s.explosion.t += dt;
        if (s.explosion.t >= 0.9) s.explosion = null;
      }

      const isLight = getRocketVisualTier(s.capacityKg) === 'light';
      const bodyH = isLight ? 5.6 : 6.4;
      const cfg = isLight
        ? {
            set: sprites.light,
            s1H: 2.1,
            s1Y: 1.05,
            s2H: 2.0,
            s2Y: 2.95,
            f1BaseY: 0,
            f1H: 1.4,
            f1W: 1.0,
            f2BaseY: 1.95,
            f2H: 0.8,
            f2W: 0.5,
            scale: 0.9,
          }
        : {
            set: sprites.heavy,
            s1H: 3.4,
            s1Y: 1.7,
            s2H: 2.3,
            s2Y: 4.25,
            f1BaseY: 0,
            f1H: 2.5,
            f1W: 2.2,
            f2BaseY: 3.1,
            f2H: 1.1,
            f2W: 0.7,
            scale: 1.35,
          };

      // Simulation step
      if (s.outcome === LaunchOutcome.Running) {
        s.t += dt;

        if (s.stage === Stage.Countdown) {
          const remaining = COUNTDOWN_SECONDS - s.t;
          const displaySec = Math.ceil(Math.max(remaining, 0));
          const cdProg = clamp01(s.t / COUNTDOWN_SECONDS);
          const en = langRef.current === 'en';
          s.phase = en
            ? `Countdown: T-${String(displaySec).padStart(2, '0')}`
            : `Cuenta regresiva: T-${String(displaySec).padStart(2, '0')}`;

          // Pre-launch cryogenic / exhaust smoke billowing from the pad starting at T-10
          const smokeChance = lerp(0.45, 0.95, cdProg);
          const spawnCount = cdProg > 0.65 ? 2 : 1;
          for (let k = 0; k < spawnCount; k++) {
            if (Math.random() < smokeChance) {
              const dir = Math.random() < 0.5 ? -1 : 1;
              const lateralSpeed = (0.75 + Math.random() * 1.45) * (0.65 + cdProg * 0.95);
              s.exhaustParticles.push({
                x: (Math.random() - 0.5) * 0.55,
                y: PAD_TOP + 0.04 + Math.random() * 0.14,
                vx: dir * lateralSpeed,
                vy: 0.22 + Math.random() * 0.58 + cdProg * 0.35,
                size: 0.28 + Math.random() * 0.26 + cdProg * 0.20,
                age: 0,
                life: 1.25 + Math.random() * 0.95,
                kind: 'smoke',
              });
            }
          }

          // Only ignite engines if the rocket is actually going to lift off (never show fire if it won't launch)
          if (remaining <= IGNITION_LEAD_SECONDS) {
            if (s.willAbortOnPad) {
              s.flame1On = false;
            } else {
              s.flame1On = true;
              s.rocketX = (Math.random() - 0.5) * 0.05;
            }
          }
          if (remaining <= 0) {
            if (s.willAbortOnPad) {
              s.stage = Stage.PadAbort;
              s.tAbort = s.t;
              s.flame1On = false;
              s.rocketX = 0;
              s.rocketY = PAD_TOP;
              s.altitudeKm = 0;
              s.speedKms = 0;
              const en = langRef.current === 'en';
              s.phase =
                s.abortReason === 'no_fuel'
                  ? en
                    ? 'Out of fuel! Pad abort'
                    : '¡Sin combustible! Aborto en plataforma'
                  : en
                    ? 'Incomplete rocket! Launch aborted'
                    : '¡Cohete incompleto! Despegue abortado';
              for (let i = 0; i < 18; i++) {
                const ang = Math.PI * (0.1 + 0.8 * Math.random());
                const spd = 1.1 + Math.random() * 2.2;
                s.sepParticles.push({
                  x: (Math.random() - 0.5) * 0.6,
                  y: PAD_TOP + 0.25,
                  vx: Math.cos(ang) * spd * (Math.random() < 0.5 ? -1 : 1),
                  vy: Math.sin(ang) * spd * 0.6,
                  size: 0.24 + Math.random() * 0.2,
                  age: 0,
                  life: 0.9 + Math.random() * 0.5,
                  kind: 'smoke',
                });
              }
            } else {
              s.stage = Stage.Ascent;
            }
          }
        } else if (s.stage === Stage.PadAbort) {
          const elapsedAbort = s.t - s.tAbort;
          s.flame1On = false;
          s.rocketX = elapsedAbort < 0.25 ? (Math.random() - 0.5) * 0.06 : 0;
          s.rocketY = PAD_TOP;
          s.altitudeKm = 0;
          s.speedKms = 0;
          if (elapsedAbort >= 0.85) {
            const en = langRef.current === 'en';
            s.outcome = LaunchOutcome.LaunchFailed;
            s.phase = en ? 'Launch aborted on pad' : 'Despegue abortado en plataforma';
            s.resultMessage =
              s.abortReason === 'no_fuel'
                ? en
                  ? 'Out of fuel: the MK11 rocket could not ignite its engines or lift off the pad.'
                  : 'Sin combustible: el cohete MK11 no pudo encender sus motores ni despegar de la plataforma.'
                : en
                  ? 'Incomplete rocket: essential structural modules are missing on MK11; control ordered a pad abort.'
                  : 'Cohete incompleto: faltan módulos esenciales en la estructura de MK11; el control ordenó abortar en plataforma.';
          }
        } else if (s.stage === Stage.Ascent) {
          const p = clamp01((s.t - COUNTDOWN_SECONDS) / ASCENT_SECONDS);
          s.ascentP = p;
          const pEnd = s.willFailLaunch ? s.failP : 1;

          const moveRocket = (pv: number) => {
            const pos = pathPos(pv);
            const pPlus = pathPos(Math.min(1, pv + 0.002));
            const pMinus = pathPos(Math.max(0, pv - 0.002));
            const dx = (pPlus.x - pMinus.x) / 0.004;
            const dy = (pPlus.y - pMinus.y) / 0.004;
            const ang =
              dx * dx + dy * dy > 0.0001
                ? (-Math.atan2(dx, dy) * 180) / Math.PI
                : 0;
            s.rocketX = pos.x;
            s.rocketY = PAD_TOP + pos.y;
            s.rocketAngDeg = ang;
            s.lastVelX = dx / ASCENT_SECONDS;
            s.lastVelY = dy / ASCENT_SECONDS;
            s.altitudeKm = 200 * Math.pow(pv, 1.8);
            s.speedKms = REAL_LUNAR_PHYSICS.leoVelocityKms * Math.pow(pv, 1.05);
          };

          if (p >= pEnd) {
            moveRocket(pEnd);
            if (s.willFailLaunch) {
              s.stage = Stage.Falling;
              s.fallVelX = s.lastVelX;
              s.fallVelY = s.lastVelY;
              s.spinDeg = Math.random() * 140 - 70;
              s.flame1On = false;
              s.flame2On = false;
              s.phase = langRef.current === 'en' ? 'Thrust loss!' : '¡Pérdida de empuje!';
            } else {
              const en = langRef.current === 'en';
              s.stage = Stage.Circularizing;
              s.tCirc = s.t;
              s.circStartAngDeg = s.rocketAngDeg;
              s.phase =
                (s.res?.deltaVRequired ?? 3588) >= 3000
                  ? en
                    ? `Translunar injection · ${REAL_LUNAR_PHYSICS.tliVelocityKms} km/s`
                    : `Inyección translunar · ${REAL_LUNAR_PHYSICS.tliVelocityKms} km/s`
                  : en
                    ? `Orbital insertion · ${REAL_LUNAR_PHYSICS.leoVelocityKms} km/s`
                    : `Inserción en órbita · ${REAL_LUNAR_PHYSICS.leoVelocityKms} km/s`;
            }
          } else {
            moveRocket(p);
            if (!s.separated && p >= SEPARATION_P) {
              s.separated = true;
              s.sepFlashT = 0;
              s.flame1On = false;
              s.flame2On = true;

              const upRad = (-s.rocketAngDeg * Math.PI) / 180;
              const upX = Math.sin(upRad);
              const upY = Math.cos(upRad);
              const rightX = Math.cos(upRad);
              const rightY = -Math.sin(upRad);

              // First stage starts at EXACT pre-separation coordinate so there is zero snap/jump
              s.detachedStage1 = {
                x: s.rocketX,
                y: s.rocketY,
                angDeg: s.rocketAngDeg,
                vx: s.lastVelX * 0.86 - upX * 0.65 - rightX * 0.28,
                vy: s.lastVelY * 0.86 - upY * 0.65 - 0.6,
                spin: 14,
                age: 0,
              };

              // Fairing halves start docked cleanly around the upper Eagle shroud and peel apart smoothly
              const fairOriginX = s.rocketX + upX * (bodyH * 0.72);
              const fairOriginY = s.rocketY + upY * (bodyH * 0.72);
              s.detachedFairing = {
                x: fairOriginX + rightX * 0.24,
                y: fairOriginY + rightY * 0.24,
                angDeg: s.rocketAngDeg,
                vx: s.lastVelX * 0.90 + rightX * 2.4,
                vy: s.lastVelY * 0.90 + rightY * 2.4 + 0.7,
                spin: -68,
                age: 0,
              };
              s.detachedFairingL = {
                x: fairOriginX - rightX * 0.24,
                y: fairOriginY - rightY * 0.24,
                angDeg: s.rocketAngDeg,
                vx: s.lastVelX * 0.90 - rightX * 2.4,
                vy: s.lastVelY * 0.90 - rightY * 2.4 + 0.7,
                spin: 68,
                age: 0,
              };

              // Interstage pyro ring sparks & cold-gas venting ring right at the joint
              const jointX = s.rocketX + upX * (bodyH * 0.51);
              const jointY = s.rocketY + upY * (bodyH * 0.51);
              for (let i = 0; i < 34; i++) {
                const a = (i / 34) * Math.PI * 2 + Math.random() * 0.2;
                const spd = 1.6 + Math.random() * 3.4;
                const originX = i % 2 === 0 ? fairOriginX : jointX;
                const originY = i % 2 === 0 ? fairOriginY : jointY;
                s.sepParticles.push({
                  x: originX,
                  y: originY,
                  vx: s.lastVelX * 0.8 + Math.cos(a) * spd,
                  vy: s.lastVelY * 0.8 + Math.sin(a) * spd,
                  size: i % 3 === 0 ? 0.20 : 0.12,
                  age: 0,
                  life: i % 3 === 0 ? 0.8 : 0.55,
                  kind: i % 3 === 0 ? 'smoke' : 'spark',
                });
              }
            }
            if (!s.separated) {
              const en = langRef.current === 'en';
              s.phase = isLight
                ? en
                  ? 'Saturn IB · Stage 1 Ignition'
                  : 'Ignición Saturno IB · Etapa 1'
                : en
                  ? 'Saturn V · Stage 1 Ignition'
                  : 'Ignición Saturno V · Etapa 1';
            } else if (s.t - (COUNTDOWN_SECONDS + SEPARATION_P * ASCENT_SECONDS) < 1.8) {
              const en = langRef.current === 'en';
              s.phase = isLight
                ? en
                  ? 'Stage 1 Separation · Capsule Detachment'
                  : 'Separación de Etapa 1 · Desacople de cápsula'
                : en
                  ? 'Fairing & S-IC Separation · Eagle Detachment'
                  : 'Separación de cofia y Etapa S-IC · Desacople Eagle';
            } else {
              s.phase =
                langRef.current === 'en'
                  ? 'Ascent · Stage 2 (7.8 km/s)'
                  : 'Ascenso · Etapa 2 (7.8 km/s)';
            }
          }
        } else if (s.stage === Stage.Falling) {
          if (s.abortReason === 'low_dv') {
            s.tOrbit += dt;
            s.fallVelY -= GRAVITY * 0.35 * dt;
            s.rocketX += s.fallVelX * dt;
            s.rocketY += s.fallVelY * dt;
            s.rocketAngDeg += s.spinDeg * dt;
            s.altitudeKm = Math.max(120, (s.rocketY - PAD_TOP) / UNITS_PER_KM);
            s.speedKms = Math.max(0.8, s.speedKms - 1.6 * dt);
            if (s.tOrbit >= 2.4 && s.outcome === LaunchOutcome.Running) {
              const en = langRef.current === 'en';
              const res = s.res!;
              const req = Math.max(100, res.deltaVRequired);
              s.outcome = LaunchOutcome.OrbitFailed;
              s.phase = en
                ? `Insufficient velocity (< ${req.toFixed(0)} m/s)`
                : `Velocidad insuficiente (< ${req.toFixed(0)} m/s)`;
              s.resultMessage = en
                ? `The craft lifted off into space, but with ${res.deltaVAvailable.toFixed(0)} m/s (< ${req.toFixed(0)} m/s required) it could not complete the required velocity for ${s.orbitName} and fell in space.`
                : `La nave despegó al espacio, pero con ${res.deltaVAvailable.toFixed(0)} m/s (< ${req.toFixed(0)} m/s requeridos) no completó la velocidad necesaria hacia ${s.orbitName} y quedó cayendo en el espacio.`;
            }
          } else {
            s.fallVelY -= GRAVITY * dt;
            s.rocketX += s.fallVelX * dt;
            s.rocketY += s.fallVelY * dt;
            s.rocketAngDeg += s.spinDeg * dt;
            s.altitudeKm = Math.max(0, (s.rocketY - PAD_TOP) / UNITS_PER_KM);
            s.speedKms = Math.max(0, s.speedKms - 2.2 * dt);
            if (s.rocketY <= PAD_TOP) {
              const en = langRef.current === 'en';
              s.rocketVisible = false;
              s.explosion = { x: s.rocketX, y: Math.max(s.rocketY, PAD_TOP), t: 0 };
              s.stage = Stage.Exploded;
              const res = s.res!;
              const rocketName = isLight
                ? en
                  ? 'Saturn IB'
                  : 'Saturno IB'
                : en
                  ? 'Saturn V'
                  : 'Saturno V';
              s.outcome = LaunchOutcome.LaunchFailed;
              s.phase = en
                ? 'Overweight fall · Crew safe!'
                : 'Caída por exceso de peso · ¡Tripulación a salvo!';
              s.resultMessage = en
                ? `Excess weight: total mass (${res.totalMassKg.toFixed(0)} kg) exceeds ${rocketName} capacity (${res.launcherCapacityKg.toFixed(0)} kg). The rocket lifted off and fell, but thankfully the crew survived!`
                : `Exceso de peso: la masa total (${res.totalMassKg.toFixed(0)} kg) supera la capacidad del ${rocketName} (${res.launcherCapacityKg.toFixed(0)} kg). El cohete despegó y cayó, ¡pero por suerte la tripulación se salvó!`;
            }
          }
        } else if (s.stage === Stage.Circularizing && s.res) {
          const q = (s.t - s.tCirc) / CIRC_SECONDS;
          const req = Math.max(100, s.res.deltaVRequired);
          const isTranslunar = req >= 3000;
          const qEnd = s.willFailOrbit
            ? Math.max(0.22, clamp01(s.res.deltaVAvailable / req))
            : 1;
          const burnFrac = clamp01(Math.min(q, qEnd));
          const easeBurn = smoothStep(burnFrac);
          s.deltaVBurned =
            Math.min(q / Math.max(0.01, qEnd), 1) *
            Math.min(s.res.deltaVAvailable, req);
          s.speedKms = lerp(
            REAL_LUNAR_PHYSICS.leoVelocityKms,
            isTranslunar ? REAL_LUNAR_PHYSICS.tliVelocityKms : 8.4,
            easeBurn
          );
          // Match Ascent 30 km/s exit slope cleanly at q=0 so altitude never stalls
          s.altitudeKm =
            200 + (s.willFailOrbit ? 48 * easeBurn : 120 * burnFrac + 90 * easeBurn);
          s.flame2On = q < qEnd || !s.willFailOrbit;

          // Seamless velocity (7.60 u/s) and smooth prograde pitch handoff from Ascent
          const contSpeed = s.willFailOrbit
            ? lerp(7.60, 3.2, easeBurn)
            : lerp(7.60, 12.6, easeBurn);
          const targetPitch = s.willFailOrbit ? -56 : isTranslunar ? -68 : -64;
          s.rocketAngDeg = lerp(s.circStartAngDeg, targetPitch, easeBurn);

          const upRad = (-s.rocketAngDeg * Math.PI) / 180;
          s.lastVelX = Math.sin(upRad) * contSpeed;
          s.lastVelY = Math.cos(upRad) * contSpeed;
          s.rocketX += s.lastVelX * dt;
          s.rocketY += s.lastVelY * dt;

          if (s.willFailOrbit) {
            if (q >= qEnd) {
              const en = langRef.current === 'en';
              s.stage = Stage.Falling;
              s.tOrbit = 0;
              s.fallVelX = s.lastVelX * 0.45;
              s.fallVelY = Math.min(1.6, s.lastVelY * 0.45);
              s.spinDeg = s.rocketAngDeg >= 0 ? 52 : -52;
              s.flame1On = false;
              s.flame2On = false;
              s.phase = en
                ? `Insufficient velocity (< ${req.toFixed(0)} m/s) · Falling in space!`
                : `¡Velocidad insuficiente (< ${req.toFixed(0)} m/s) · Cayendo en el espacio!`;
            }
          } else if (q >= 1) {
            const en = langRef.current === 'en';
            s.outcome = LaunchOutcome.Success;
            s.camLockX = s.rocketX;
            s.camLockY = s.rocketY;
            s.camLocked = true;
            s.flame2On = true;
            s.speedKms = isTranslunar ? REAL_LUNAR_PHYSICS.tliVelocityKms : 8.4;
            s.deltaVBurned = Math.min(s.res.deltaVAvailable, req);
            s.phase = isTranslunar
              ? en
                ? `Bound for the Moon (${REAL_LUNAR_PHYSICS.tliVelocityKms} km/s)!`
                : `¡Rumbo a la Luna (${REAL_LUNAR_PHYSICS.tliVelocityKms} km/s)!`
              : en
                ? `Orbital insertion confirmed (${req.toFixed(0)} m/s)!`
                : `¡Inserción orbital confirmada (${req.toFixed(0)} m/s)!`;
            s.resultMessage = en
              ? `Maneuver to ${s.orbitName} confirmed! Remaining ΔV margin: ${(s.res.deltaVAvailable - req).toFixed(0)} m/s.`
              : `¡Maniobra hacia ${s.orbitName} confirmada! Margen de ΔV restante: ${(s.res.deltaVAvailable - req).toFixed(0)} m/s.`;
          }
        } else if (s.stage === Stage.StrandedOrbit && s.res) {
          s.tOrbit += dt;
          s.flame2On = false;
          s.orbitAngleRad -= 0.28 * dt;
          s.rocketX = s.orbitCenterX + Math.cos(s.orbitAngleRad) * s.orbitRadius;
          s.rocketY = s.orbitCenterY + Math.sin(s.orbitAngleRad) * s.orbitRadius;
          const tangX = Math.sin(s.orbitAngleRad);
          const tangY = -Math.cos(s.orbitAngleRad);
          const targetAng = (-Math.atan2(tangX, tangY) * 180) / Math.PI;
          let diff = ((targetAng - s.rocketAngDeg + 180) % 360) - 180;
          if (diff < -180) diff += 360;
          s.rocketAngDeg += diff * Math.min(1, dt * 2.8);

          if (s.tOrbit >= 2.6 && s.outcome === LaunchOutcome.Running) {
            const en = langRef.current === 'en';
            const req = Math.max(100, s.res.deltaVRequired);
            s.outcome = LaunchOutcome.OrbitFailed;
            s.phase = en
              ? `Insufficient ΔV (< ${req.toFixed(0)} m/s)`
              : `ΔV insuficiente (< ${req.toFixed(0)} m/s)`;
            s.resultMessage = en
              ? `The craft lifted off, but with ${s.res.deltaVAvailable.toFixed(0)} m/s (< ${req.toFixed(0)} m/s required) it could not reach target orbit ${s.orbitName}.`
              : `La nave despegó, pero con ${s.res.deltaVAvailable.toFixed(0)} m/s (< ${req.toFixed(0)} m/s requeridos) no alcanzó la órbita objetivo de ${s.orbitName}.`;
          }
        }
      } else if (s.outcome === LaunchOutcome.Success && s.rocketVisible) {
        // Keep spacecraft centered in departing camera framing and gliding continuously during dissolve
        const upRad = (-s.rocketAngDeg * Math.PI) / 180;
        const glideSpeed = 12.6;
        s.rocketX += Math.sin(upRad) * glideSpeed * dt;
        s.rocketY += Math.cos(upRad) * glideSpeed * dt;
        s.camLockX = s.rocketX;
        s.camLockY = s.rocketY;
        s.altitudeKm = Math.min(480, s.altitudeKm + 52 * dt);
        s.flame2On = true;
      } else if (
        s.outcome === LaunchOutcome.OrbitFailed &&
        s.stage === Stage.Falling
      ) {
        // Keep spacecraft visibly drifting/tumbling in space behind the translucent failure alert
        s.tOrbit += dt;
        s.rocketAngDeg += s.spinDeg * 0.42 * dt;
        s.rocketX += s.fallVelX * 0.12 * dt;
        s.rocketY += Math.max(-0.4, s.fallVelY * 0.06) * dt;
        s.altitudeKm = Math.max(120, s.altitudeKm);
      } else if (
        s.outcome === LaunchOutcome.OrbitFailed &&
        s.stage === Stage.StrandedOrbit
      ) {
        // Keep spacecraft visibly orbiting Earth behind the failure glass alert
        s.tOrbit += dt;
        s.orbitAngleRad -= 0.22 * dt;
        s.rocketX = s.orbitCenterX + Math.cos(s.orbitAngleRad) * s.orbitRadius;
        s.rocketY = s.orbitCenterY + Math.sin(s.orbitAngleRad) * s.orbitRadius;
        const tangX = Math.sin(s.orbitAngleRad);
        const tangY = -Math.cos(s.orbitAngleRad);
        const targetAng = (-Math.atan2(tangX, tangY) * 180) / Math.PI;
        let diff = ((targetAng - s.rocketAngDeg + 180) % 360) - 180;
        if (diff < -180) diff += 360;
        s.rocketAngDeg += diff * Math.min(1, dt * 2.5);
      }

      // Compute continuous Stage 2 separation timings & smooth glide easing
      const sepElapsed = s.separated
        ? Math.max(0, s.t - (COUNTDOWN_SECONDS + SEPARATION_P * ASCENT_SECONDS))
        : 0;
      const pullEase = s.separated ? smoothStep(sepElapsed / 1.15) : 0;
      const desacopleH = bodyH * 0.55;
      const desacopleCenterLocalY = lerp(-bodyH * 0.77, -bodyH * 0.45, pullEase);
      const desacopleNoz = getDesacopleNozzle();
      const desacopleAspect = mk11Sprites.desacopleBody.ready
        ? mk11Sprites.desacopleBody.width / Math.max(1, mk11Sprites.desacopleBody.height)
        : 0.42;
      const desacopleNozzleLocalX = (desacopleNoz.x - 0.5) * desacopleH * desacopleAspect;
      const desacopleNozzleLocalY = desacopleCenterLocalY + (desacopleNoz.y - 0.5) * desacopleH;
      const stage2FlameRamp = s.separated && s.flame2On ? clamp01((sepElapsed - 0.10) / 0.34) : 0;
      const stage1FlameRamp =
        !s.separated && s.flame1On
          ? clamp01((s.t - (COUNTDOWN_SECONDS - IGNITION_LEAD_SECONDS)) / 0.52)
          : 0;

      // Spawn continuous dynamic exhaust sparks & glowing embers right from active nozzles
      if ((s.outcome === LaunchOutcome.Running || s.outcome === LaunchOutcome.Success) && s.rocketVisible) {
        const upRad = (-s.rocketAngDeg * Math.PI) / 180;
        const upX = Math.sin(upRad);
        const upY = Math.cos(upRad);
        const rightX = Math.cos(upRad);
        const rightY = -Math.sin(upRad);

        if (s.flame1On && !s.separated && stage1FlameRamp > 0.08) {
          const noz = getStage1Nozzles();
          const idleAspect = mk11Sprites.idle.ready
            ? mk11Sprites.idle.width / Math.max(1, mk11Sprites.idle.height)
            : 0.25;
          const fullWorldW = bodyH * idleAspect;
          const emitters = [
            { xOff: (noz.leftX - 0.5) * fullWorldW, yOff: (1 - noz.leftY) * bodyH - 0.32, isCore: false },
            { xOff: (noz.centerX - 0.5) * fullWorldW, yOff: (1 - noz.centerY) * bodyH - 0.42, isCore: true },
            { xOff: (noz.rightX - 0.5) * fullWorldW, yOff: (1 - noz.rightY) * bodyH - 0.32, isCore: false },
          ];
          for (const em of emitters) {
            if (Math.random() < 0.72) {
              const exX = s.rocketX + rightX * em.xOff + upX * em.yOff;
              const exY = s.rocketY + rightY * em.xOff + upY * em.yOff;
              const spd = (5.6 + Math.random() * 4.4) * (0.6 + 0.5 * stage1FlameRamp);
              const spread = (Math.random() - 0.5) * 1.15;
              s.exhaustParticles.push({
                x: exX,
                y: exY,
                vx: -upX * spd + rightX * spread,
                vy: -upY * spd + rightY * spread,
                size: em.isCore ? 0.14 + Math.random() * 0.14 : 0.10 + Math.random() * 0.10,
                age: 0,
                life: 0.28 + Math.random() * 0.25,
                kind: Math.random() < 0.75 ? 'spark' : 'ember',
              });
            }
          }
        } else if (s.flame2On && s.separated && stage2FlameRamp > 0.15) {
          for (let k = 0; k < 2; k++) {
            const nozzleDistUp = -desacopleNozzleLocalY - 0.28;
            const exX = s.rocketX + upX * nozzleDistUp + rightX * desacopleNozzleLocalX;
            const exY = s.rocketY + upY * nozzleDistUp + rightY * desacopleNozzleLocalX;
            const spd = (6.2 + Math.random() * 4.5) * stage2FlameRamp;
            const spread = (Math.random() - 0.5) * 1.05;
            s.exhaustParticles.push({
              x: exX,
              y: exY,
              vx: -upX * spd + rightX * spread,
              vy: -upY * spd + rightY * spread,
              size: 0.11 + Math.random() * 0.11,
              age: 0,
              life: 0.26 + Math.random() * 0.22,
              kind: Math.random() < 0.65 ? 'spark' : 'ember',
            });
          }
        }
      }

      if (
        (s.outcome === LaunchOutcome.Running || s.outcome === LaunchOutcome.Success) &&
        s.rocketVisible &&
        s.altitudeKm >= 95
      ) {
        const lastPt = s.trail[s.trail.length - 1];
        if (!lastPt || Math.hypot(s.rocketX - lastPt.x, s.rocketY - lastPt.y) >= 0.35) {
          s.trail.push({ x: s.rocketX, y: s.rocketY });
          if (s.trail.length > 44) s.trail.shift();
        }
      }

      // Render — camera smoothly lifts & widens during high-altitude space exit
      const w = canvas.width;
      const h = canvas.height;
      const orthoSize = 5.1;
      const pxPerUnit = h / (orthoSize * 2);

      const focusX = !s.rocketVisible
        ? s.explosion
          ? s.explosion.x
          : 0
        : s.camLocked
          ? s.camLockX
          : s.rocketX;
      const focusY = !s.rocketVisible
        ? s.explosion
          ? s.explosion.y
          : PAD_TOP
        : s.camLocked
          ? s.camLockY
          : s.rocketY;

      const spaceFlightK = smoothStep(inverseLerp(18, 320, s.altitudeKm));
      const camOffsetX =
        s.stage === Stage.StrandedOrbit ? 0 : lerp(0, -1.05, spaceFlightK);
      const camOffsetY =
        s.stage === Stage.StrandedOrbit ? 0.5 : lerp(3.0, -0.55, spaceFlightK);
      const camX = focusX + camOffsetX;
      const camY = Math.max(focusY + camOffsetY, 3.6);
      const rocketVisScale =
        s.stage === Stage.StrandedOrbit
          ? 0.72
          : lerp(1.0, 0.56, smoothStep(inverseLerp(0.32, 1.0, spaceFlightK)));

      const toPx = (wx: number, wy: number) => ({
        x: w / 2 + (wx - camX) * pxPerUnit,
        y: h / 2 - (wy - camY) * pxPerUnit,
      });

      // Multi-stop Rayleigh atmospheric sky -> deep cosmic space transition
      const skyK = clamp01(s.altitudeKm / 85);
      const topR = Math.round(lerp(8, 3, skyK));
      const topG = Math.round(lerp(48, 6, skyK));
      const topB = Math.round(lerp(158, 16, skyK));
      const upperR = Math.round(lerp(20, 5, skyK));
      const upperG = Math.round(lerp(88, 9, skyK));
      const upperB = Math.round(lerp(204, 22, skyK));
      const midR = Math.round(lerp(56, 7, skyK));
      const midG = Math.round(lerp(142, 12, skyK));
      const midB = Math.round(lerp(235, 28, skyK));
      const botR = Math.round(lerp(112, 9, skyK));
      const botG = Math.round(lerp(178, 14, skyK));
      const botB = Math.round(lerp(232, 32, skyK));
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, `rgb(${topR}, ${topG}, ${topB})`);
      skyGrad.addColorStop(0.32, `rgb(${upperR}, ${upperG}, ${upperB})`);
      skyGrad.addColorStop(0.68, `rgb(${midR}, ${midG}, ${midB})`);
      skyGrad.addColorStop(1, `rgb(${botR}, ${botG}, ${botB})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Soft diffused atmospheric horizon haze & luminous solar scatter in unobstructed top-left sky
      const sunX = w * 0.135;
      const sunY = h * 0.175;

      if (skyK < 0.72) {
        const atmoVis = 1 - skyK / 0.72;

        // Warm atmospheric horizon glow (fades cleanly to 0 at bottom edge — zero cutoff line)
        const horGlow = ctx.createLinearGradient(0, h * 0.52, 0, h);
        horGlow.addColorStop(0, 'rgba(186, 230, 253, 0)');
        horGlow.addColorStop(0.55, `rgba(224, 242, 254, ${(0.20 * atmoVis).toFixed(3)})`);
        horGlow.addColorStop(0.84, `rgba(254, 243, 199, ${(0.12 * atmoVis).toFixed(3)})`);
        horGlow.addColorStop(1, 'rgba(254, 243, 199, 0)');
        ctx.fillStyle = horGlow;
        ctx.fillRect(0, h * 0.52, w, h * 0.48);

        // Wide diffused atmospheric solar scatter (soft radial falloff across upper-left sky)
        const sunRadius = Math.max(w, h) * 0.58;
        const sunGlow = ctx.createRadialGradient(
          sunX,
          sunY,
          Math.max(6, w * 0.01),
          sunX,
          sunY,
          sunRadius
        );
        sunGlow.addColorStop(0, `rgba(255, 252, 224, ${(0.88 * atmoVis).toFixed(3)})`);
        sunGlow.addColorStop(0.06, `rgba(254, 240, 165, ${(0.52 * atmoVis).toFixed(3)})`);
        sunGlow.addColorStop(0.18, `rgba(254, 234, 175, ${(0.26 * atmoVis).toFixed(3)})`);
        sunGlow.addColorStop(0.42, `rgba(186, 230, 253, ${(0.14 * atmoVis).toFixed(3)})`);
        sunGlow.addColorStop(0.75, `rgba(125, 211, 252, ${(0.05 * atmoVis).toFixed(3)})`);
        sunGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, w, h);
      }

      // Animated Solar Disc: crisp Launch Sun ball ("la bolita") seamlessly morphing into Space Sun when exiting Earth
      {
        const sunMorph = smoothStep(inverseLerp(0.32, 0.90, skyK));
        const sunPulse = Math.sin(sunMorph * Math.PI);
        const sunCoreR = Math.max(20, Math.min(w, h) * lerp(0.044, 0.036, skyK));
        const glowRadius = sunCoreR * (3.1 + sunPulse * 1.4);

        const spaceHalo = ctx.createRadialGradient(
          sunX,
          sunY,
          sunCoreR * 0.32,
          sunX,
          sunY,
          glowRadius
        );
        spaceHalo.addColorStop(0, `rgba(255, 250, 205, ${(0.54 + sunPulse * 0.34).toFixed(3)})`);
        spaceHalo.addColorStop(0.38, `rgba(253, 224, 71, ${(0.24 + sunPulse * 0.18).toFixed(3)})`);
        spaceHalo.addColorStop(0.72, 'rgba(251, 191, 36, 0.07)');
        spaceHalo.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = spaceHalo;
        ctx.beginPath();
        ctx.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        if (sprLaunchSun.ready && sunMorph < 0.995) {
          ctx.save();
          ctx.globalAlpha = 1 - sunMorph;
          ctx.imageSmoothingEnabled = false;
          const lScale = 1 + sunMorph * 0.14;
          const drawHalf =
            sunCoreR * lScale * (0.5 / Math.max(0.25, sprLaunchSun.coreRadiusFrac));
          ctx.drawImage(
            sprLaunchSun.canvas,
            sunX - drawHalf,
            sunY - drawHalf,
            drawHalf * 2,
            drawHalf * 2
          );
          ctx.restore();
        }

        if (sprSpaceSun.ready && sunMorph > 0.005) {
          ctx.save();
          ctx.globalAlpha = sunMorph;
          ctx.imageSmoothingEnabled = false;
          const sScale = lerp(1.16, 1.0, sunMorph);
          const drawHalf =
            sunCoreR * sScale * (0.5 / Math.max(0.25, sprSpaceSun.coreRadiusFrac));
          ctx.drawImage(
            sprSpaceSun.canvas,
            sunX - drawHalf,
            sunY - drawHalf,
            drawHalf * 2,
            drawHalf * 2
          );
          ctx.restore();
        }
      }

      // High-altitude Cosmic Nebula & Spectral Stars (fade in cleanly during ascent)
      const starBaseAlpha = clamp01((skyK - 0.10) * 1.45);
      if (starBaseAlpha > 0.01) {
        const spaceNeb = ctx.createRadialGradient(
          w * 0.65,
          h * 0.34,
          w * 0.05,
          w * 0.65,
          h * 0.34,
          Math.max(w, h) * 0.65
        );
        spaceNeb.addColorStop(0, `rgba(56, 189, 248, ${(0.14 * starBaseAlpha).toFixed(3)})`);
        spaceNeb.addColorStop(0.5, `rgba(49, 46, 129, ${(0.12 * starBaseAlpha).toFixed(3)})`);
        spaceNeb.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = spaceNeb;
        ctx.fillRect(0, 0, w, h);

        for (const st of stars) {
          const p = toPx(st.x, st.y);
          if (p.x >= -12 && p.x <= w + 12 && p.y >= -12 && p.y <= h + 12) {
            const twinkle = 0.62 + 0.38 * Math.sin(now * 0.003 + st.phase);
            const alpha = starBaseAlpha * twinkle;
            const sz = Math.max(2, Math.round(st.s * pxPerUnit * 0.65));
            const px = Math.round(p.x);
            const py = Math.round(p.y);
            if (st.isHero && sz >= 2) {
              const arm = sz * 2;
              ctx.fillStyle = `rgba(${st.tint}, ${(alpha * 0.72).toFixed(3)})`;
              ctx.fillRect(px - arm, py, arm * 2 + 1, 1);
              ctx.fillRect(px, py - arm, 1, arm * 2 + 1);
              ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.05).toFixed(3)})`;
              ctx.fillRect(px - 1, py - 1, 3, 3);
            } else {
              ctx.fillStyle = `rgba(${st.tint}, ${(0.92 * alpha).toFixed(3)})`;
              ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
            }
          }
        }
      }

      // Curved Earth Limb & Rayleigh Ozone Atmosphere — exponential perspective recession below-left of spacecraft
      if (s.altitudeKm > 16) {
        const limbAlpha = smoothStep(inverseLerp(16, 62, s.altitudeKm));
        const recedeEase =
          s.stage === Stage.StrandedOrbit
            ? 0.56
            : smoothStep(inverseLerp(16, 410, s.altitudeKm));

        const maxDim = Math.max(w, h);
        const minDim = Math.min(w, h);
        const rStart = maxDim * 2.15;
        const rEnd = minDim * 0.145;
        const earthR = rStart * Math.pow(rEnd / rStart, recedeEase);
        const earthCx =
          s.stage === Stage.StrandedOrbit
            ? toPx(s.orbitCenterX, s.orbitCenterY).x
            : lerp(w * 0.46, w * 0.24, recedeEase);
        const limbTopY =
          s.stage === Stage.StrandedOrbit
            ? toPx(s.orbitCenterX, s.orbitCenterY).y - earthR
            : lerp(h * 0.80, h * 0.54 - rEnd, Math.pow(recedeEase, 1.15));
        const earthCy = limbTopY + earthR;

        ctx.save();
        ctx.globalAlpha = limbAlpha;

        // Outer diffused Rayleigh ozone scattering halo (smooth fade, no hard ring)
        const atmoOuterR = earthR * lerp(1.075, 1.18, recedeEase);
        const atmo = ctx.createRadialGradient(
          earthCx,
          earthCy,
          earthR * 0.96,
          earthCx,
          earthCy,
          atmoOuterR
        );
        atmo.addColorStop(0, 'rgba(186, 230, 253, 0.58)');
        atmo.addColorStop(0.28, 'rgba(56, 189, 248, 0.34)');
        atmo.addColorStop(0.65, 'rgba(37, 99, 235, 0.12)');
        atmo.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = atmo;
        ctx.beginPath();
        ctx.arc(earthCx, earthCy, atmoOuterR, 0, Math.PI * 2);
        ctx.fill();

        // Spherical Earth body textured with earth_day.png + sunlit atmospheric curvature shading
        ctx.save();
        ctx.beginPath();
        ctx.arc(earthCx, earthCy, earthR, 0, Math.PI * 2);
        ctx.clip();

        const planetGrad = ctx.createRadialGradient(
          earthCx - earthR * 0.25,
          earthCy - earthR * 0.55,
          earthR * 0.08,
          earthCx,
          earthCy,
          earthR * 1.05
        );
        planetGrad.addColorStop(0, '#60a5fa');
        planetGrad.addColorStop(0.32, '#2563eb');
        planetGrad.addColorStop(0.72, '#1e3a8a');
        planetGrad.addColorStop(1, '#07122e');
        ctx.fillStyle = planetGrad;
        ctx.fillRect(
          earthCx - earthR - 2,
          earthCy - earthR - 2,
          earthR * 2 + 4,
          earthR * 2 + 4
        );

        if (imgEarth.complete && imgEarth.naturalWidth > 0) {
          ctx.save();
          ctx.translate(earthCx, earthCy);
          ctx.rotate(-0.14 + (now / 1000) * 0.003);
          ctx.imageSmoothingEnabled = false;
          const texR = earthR * 1.02;
          ctx.drawImage(imgEarth, -texR, -texR, texR * 2, texR * 2);
          ctx.restore();

          // Gentle sunlit-top-left spherical shading terminator over Earth texture
          const dayNightShade = ctx.createRadialGradient(
            earthCx - earthR * 0.34,
            earthCy - earthR * 0.42,
            earthR * 0.18,
            earthCx,
            earthCy,
            earthR * 1.04
          );
          dayNightShade.addColorStop(0, 'rgba(224, 242, 254, 0.08)');
          dayNightShade.addColorStop(0.55, 'rgba(0, 0, 0, 0.06)');
          dayNightShade.addColorStop(0.84, 'rgba(4, 10, 28, 0.34)');
          dayNightShade.addColorStop(1, 'rgba(3, 7, 22, 0.62)');
          ctx.fillStyle = dayNightShade;
          ctx.fillRect(
            earthCx - earthR - 2,
            earthCy - earthR - 2,
            earthR * 2 + 4,
            earthR * 2 + 4
          );
        }

        // Soft atmospheric limb scattering inside the sphere edge (replaces hard line stroke)
        const innerAtmo = ctx.createRadialGradient(
          earthCx,
          earthCy,
          earthR * 0.88,
          earthCx,
          earthCy,
          earthR
        );
        innerAtmo.addColorStop(0, 'rgba(125, 211, 252, 0)');
        innerAtmo.addColorStop(0.78, 'rgba(56, 189, 248, 0.24)');
        innerAtmo.addColorStop(1, 'rgba(224, 242, 254, 0.58)');
        ctx.fillStyle = innerAtmo;
        ctx.fillRect(
          earthCx - earthR - 2,
          earthCy - earthR - 2,
          earthR * 2 + 4,
          earthR * 2 + 4
        );
        ctx.restore();

        // Subtle orbital ring dashed path when stranded in orbit
        if (s.stage === Stage.StrandedOrbit) {
          const oc = toPx(s.orbitCenterX, s.orbitCenterY);
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(oc.x, oc.y, s.orbitRadius * pxPerUnit, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // Animated Multi-Layer Drifting Bayer-Dithered Pixel-Art Clouds (behind gantry tower)
      const cloudVis = clamp01(1 - skyK * 1.35);
      if (cloudVis > 0.01) {
        const tSec = now / 1000;
        const wrapSpan = 68;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (let layerPass = 0; layerPass <= 2; layerPass++) {
          for (const cl of clouds) {
            if (cl.layer !== layerPass) continue;
            const worldX =
              ((((cl.x + tSec * cl.speed) % wrapSpan) + wrapSpan) % wrapSpan) -
              wrapSpan / 2;
            const bobY = cl.y + Math.sin(tSec * 0.35 + cl.x) * 0.04;
            const p = toPx(worldX, bobY);
            const cw = cl.w * pxPerUnit;
            const ch = cl.h * pxPerUnit;
            if (
              p.x + cw * 0.6 < -60 ||
              p.x - cw * 0.6 > w + 60 ||
              p.y + ch * 0.6 < -60 ||
              p.y - ch * 0.6 > h + 60
            ) {
              continue;
            }
            const layerAlpha =
              cloudVis * (cl.layer === 0 ? 0.56 : cl.layer === 1 ? 0.80 : 0.96);
            const spr = cloudSprites[cl.spriteIdx];
            ctx.save();
            ctx.globalAlpha = layerAlpha;
            ctx.translate(Math.round(p.x), Math.round(p.y));
            if (cl.flip) ctx.scale(-1, 1);
            ctx.drawImage(spr, -cw * 0.5, -ch * 0.5, cw, ch);
            ctx.restore();
          }
        }
        ctx.restore();

        // Subtle high-altitude drifting contrail / distant pixel jet
        const jetCycle = ((tSec * 0.55) % 44) - 22;
        const jp = toPx(jetCycle, 8.9);
        if (jp.y > 0 && jp.y < h * 0.55) {
          const cGrad = ctx.createLinearGradient(jp.x - 105, jp.y, jp.x, jp.y);
          cGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          cGrad.addColorStop(1, `rgba(255, 255, 255, ${(0.36 * cloudVis).toFixed(3)})`);
          ctx.fillStyle = cGrad;
          ctx.fillRect(jp.x - 105, jp.y, 105, 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.8 * cloudVis).toFixed(3)})`;
          ctx.fillRect(jp.x, jp.y - 1, 5, 3);
        }
      }

      // Pixel-art Launchpad Base grounded firmly beneath rocket nozzles + Full-Width Extended Wings
      const padPos = toPx(0, 0.2);
      const baseAlpha = clamp01(1 - skyK * 1.6);
      if (imgBase.complete && imgBase.naturalWidth > 0 && baseAlpha > 0.01) {
        const aspect = imgBase.naturalWidth / imgBase.naturalHeight;
        const baseWorldH = 10.6;
        const baseWorldW = baseWorldH * aspect;
        const baseLeftWorld = -0.525 * baseWorldW;
        const baseTopWorld = PAD_TOP + 0.831 * baseWorldH;
        const baseBottomWorld = baseTopWorld - baseWorldH;
        const tl = toPx(baseLeftWorld, baseTopWorld);
        const bwPx = baseWorldW * pxPerUnit;
        const bhPx = baseWorldH * pxPerUnit;

        const horizonPx = toPx(0, baseBottomWorld + baseWorldH * 0.13).y;
        const fenceTopPx = toPx(0, baseBottomWorld + baseWorldH * 0.19).y;
        const grassTopPx = toPx(0, baseBottomWorld + baseWorldH * 0.095).y;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = baseAlpha;

        // 0) Distant Coastal Atlantic Ocean Shimmer & Cape Horizon Ridge
        if (horizonPx < h + 20) {
          const coastY = horizonPx - Math.max(8, pxPerUnit * 0.22);
          const oceanGrad = ctx.createLinearGradient(0, coastY, 0, horizonPx + 6);
          oceanGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
          oceanGrad.addColorStop(1, 'rgba(30, 64, 175, 0.55)');
          ctx.fillStyle = oceanGrad;
          ctx.fillRect(0, coastY, w, horizonPx - coastY + 6);

          // Subtle coastal treeline silhouette
          ctx.fillStyle = '#1e3a34';
          ctx.fillRect(0, horizonPx - Math.max(4, pxPerUnit * 0.08), w, Math.max(5, pxPerUnit * 0.1));

          const gGrad = ctx.createLinearGradient(0, grassTopPx, 0, h);
          gGrad.addColorStop(0, '#38623d');
          gGrad.addColorStop(0.5, '#26492d');
          gGrad.addColorStop(1, '#142619');
          ctx.fillStyle = gGrad;
          ctx.fillRect(0, grassTopPx, w, h - grassTopPx + 24);
        }

        const drawWingStrip = (startX: number, endX: number, useRightSample: boolean) => {
          if (endX <= startX) return;
          if (baseCleanReady && baseStripLeftW > 4) {
            const sx = useRightSample ? baseStripRightX : 0;
            const sw = useRightSample
              ? imgBase.naturalWidth - baseStripRightX
              : baseStripLeftW;
            const sy = Math.floor(imgBase.naturalHeight * 0.858);
            const sh = imgBase.naturalHeight - sy;
            const tileW = Math.max(40, (sw / imgBase.naturalWidth) * bwPx);
            const destY = tl.y + bhPx * 0.858;
            const destH = bhPx * 0.142;
            for (let x = startX; x < endX; x += tileW) {
              const drawW = Math.min(tileW + 1, endX - x + 1);
              ctx.drawImage(
                baseCleanCanvas,
                sx,
                sy,
                sw,
                sh,
                x,
                destY,
                drawW,
                destH
              );
            }
          } else {
            ctx.fillStyle = '#534c46';
            ctx.fillRect(startX, fenceTopPx, endX - startX, grassTopPx - fenceTopPx);
          }
        };

        // Left & Right Ground Extensions
        drawWingStrip(0, Math.ceil(tl.x) + 2, false);
        drawWingStrip(Math.floor(tl.x + bwPx) - 2, w, true);

        // 2) Extended Space Center Pixel-Art Structures on Left & Right Flanks
        const u = Math.max(2, pxPerUnit * 0.12);
        // Left flank: VAB Hangar Complex
        const vabX = tl.x - u * 30;
        const groundY = horizonPx + u * 0.4;
        if (vabX + u * 24 > -20) {
          // Main Hangar block
          ctx.fillStyle = '#1b2434';
          ctx.fillRect(vabX - 2, groundY - u * 16 - 2, u * 18 + 4, u * 16 + 2);
          ctx.fillStyle = '#8b97ab';
          ctx.fillRect(vabX, groundY - u * 16, u * 18, u * 16);
          ctx.fillStyle = '#5f6c82';
          ctx.fillRect(vabX + u * 12, groundY - u * 16, u * 6, u * 16);
          // Hangar vertical door bay
          ctx.fillStyle = '#242c3d';
          ctx.fillRect(vabX + u * 3, groundY - u * 11, u * 6, u * 11);
          // Roof crane & red blinking beacon
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(vabX + u * 2, groundY - u * 18, u * 1.2, u * 2);
          if (Math.sin(now * 0.0045) > 0.1) {
            ctx.fillStyle = '#ff4d4f';
            ctx.fillRect(vabX + u * 1.8, groundY - u * 19, u * 1.6, u * 1.4);
          }
          // Fuel piping running toward pad
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(vabX + u * 18, groundY - u * 2.2, tl.x - (vabX + u * 18) + u * 4, u * 1.1);
        }

        // Right flank: Cryogenic Storage Spheres + Rotating Deep-Space Radar Dish
        const tankX = tl.x + bwPx + u * 7;
        if (tankX < w + 20) {
          // Cryogenic spheres
          for (let k = 0; k < 2; k++) {
            const cx = tankX + k * u * 11;
            const cy = groundY - u * 5.2;
            ctx.fillStyle = '#334155';
            ctx.fillRect(cx - u * 2.5, cy, u * 0.9, u * 5.2);
            ctx.fillRect(cx + u * 1.6, cy, u * 0.9, u * 5.2);
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(cx, cy, u * 3.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(cx, cy, u * 3.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(cx - u * 3.2, cy + u * 0.4, u * 6.4, u * 0.9);
          }
          // Tracking Dish Mast with subtle oscillating dish
          const dishX = tankX + u * 24;
          const dishBaseY = groundY - u * 8.5;
          ctx.fillStyle = '#475569';
          ctx.fillRect(dishX - u * 1.1, dishBaseY, u * 2.2, u * 8.5);
          const tiltAngle = -0.55 + Math.sin(now * 0.0009) * 0.24;
          ctx.save();
          ctx.translate(dishX, dishBaseY);
          ctx.rotate(tiltAngle);
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(0, 0, u * 4.2, Math.PI * 0.85, Math.PI * 1.85);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-u * 0.5, -u * 3.6, u, u);
          ctx.restore();
        }

        // 3) Main Detailed Launchpad Base & Red Gantry Tower (sky keyed out so animated clouds pass behind!)
        if (baseCleanReady) {
          ctx.drawImage(baseCleanCanvas, tl.x, tl.y, bwPx, bhPx);
        } else {
          ctx.drawImage(imgBase, tl.x, tl.y, bwPx, bhPx);
        }

        // 4) Blinking red aviation warning light on top of the red gantry spire
        const spireX = tl.x + bwPx * 0.359;
        const spireY = tl.y + bhPx * 0.032;
        if (Math.sin(now * 0.0055) > 0.15) {
          const bGlow = ctx.createRadialGradient(spireX, spireY, 1, spireX, spireY, u * 4.2);
          bGlow.addColorStop(0, 'rgba(255, 120, 120, 0.98)');
          bGlow.addColorStop(0.4, 'rgba(255, 50, 50, 0.45)');
          bGlow.addColorStop(1, 'rgba(255, 40, 40, 0)');
          ctx.fillStyle = bGlow;
          ctx.beginPath();
          ctx.arc(spireX, spireY, u * 4.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 5) Ambient cryogenic boil-off vapor wisps on the pad (soft radial plumes)
        if (showRocketRef.current && s.altitudeKm < 0.8) {
          const tSec = now / 1000;
          for (let v = 0; v < 5; v++) {
            const phase = (tSec * 0.42 + v * 0.2) % 1;
            const vx = padPos.x + (0.28 + phase * 1.55) * pxPerUnit;
            const vy =
              padPos.y -
              (1.8 + phase * 1.05 + Math.sin(tSec * 2 + v) * 0.12) * pxPerUnit;
            const vr = (0.22 + phase * 0.34) * pxPerUnit;
            const va = Math.sin(phase * Math.PI) * 0.32 * baseAlpha;
            const vGrad = ctx.createRadialGradient(vx, vy, vr * 0.1, vx, vy, vr);
            vGrad.addColorStop(0, `rgba(241, 245, 249, ${va.toFixed(3)})`);
            vGrad.addColorStop(0.55, `rgba(226, 232, 240, ${(va * 0.5).toFixed(3)})`);
            vGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
            ctx.fillStyle = vGrad;
            ctx.beginPath();
            ctx.arc(vx, vy, vr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // Pre-launch countdown steam/smoke billowing from T-10 + ignition glow when flame1On
      const isCountingDown =
        s.outcome === LaunchOutcome.Running && s.stage === Stage.Countdown;
      if ((isCountingDown || s.flame1On) && s.altitudeKm < 2.5) {
        const cdFrac = isCountingDown ? clamp01(s.t / COUNTDOWN_SECONDS) : 1;
        const altFade = clamp01(1 - s.altitudeKm / 2.5);
        const smokeAlpha =
          (s.flame1On ? 0.74 : lerp(0.32, 0.62, cdFrac)) * altFade;

        if (s.flame1On) {
          const padGlow = ctx.createRadialGradient(
            padPos.x,
            padPos.y,
            pxPerUnit * 0.2,
            padPos.x,
            padPos.y,
            pxPerUnit * 4.2
          );
          padGlow.addColorStop(0, `rgba(255, 200, 105, ${(smokeAlpha * 0.65).toFixed(3)})`);
          padGlow.addColorStop(0.5, `rgba(249, 115, 22, ${(smokeAlpha * 0.32).toFixed(3)})`);
          padGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
          ctx.fillStyle = padGlow;
          ctx.beginPath();
          ctx.arc(padPos.x, padPos.y, pxPerUnit * 4.2, 0, Math.PI * 2);
          ctx.fill();
        }

        const puffRange = s.flame1On ? 4 : Math.max(2, Math.round(lerp(2, 4, cdFrac)));
        for (let i = -puffRange; i <= puffRange; i++) {
          const spreadScale = s.flame1On ? 0.56 : lerp(0.34, 0.52, cdFrac);
          const sx = padPos.x + i * spreadScale * pxPerUnit + Math.sin(now * 0.008 + i) * 10;
          const sy =
            padPos.y -
            (s.flame1On ? 0.10 : 0.06) * pxPerUnit +
            Math.cos(now * 0.01 + i) * 5;
          const sr =
            ((s.flame1On ? 0.64 : lerp(0.38, 0.58, cdFrac)) + (Math.abs(i) % 2) * 0.22) *
            pxPerUnit;
          const puff = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr);
          if (s.flame1On && Math.abs(i) <= 1) {
            puff.addColorStop(0, `rgba(255, 238, 204, ${(smokeAlpha * 0.92).toFixed(3)})`);
            puff.addColorStop(0.55, `rgba(254, 215, 170, ${(smokeAlpha * 0.52).toFixed(3)})`);
          } else {
            puff.addColorStop(0, `rgba(248, 250, 252, ${(smokeAlpha * 0.82).toFixed(3)})`);
            puff.addColorStop(0.55, `rgba(226, 232, 240, ${(smokeAlpha * 0.44).toFixed(3)})`);
          }
          puff.addColorStop(1, 'rgba(226, 232, 240, 0)');
          ctx.fillStyle = puff;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const flicker = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.045));

      // Decoupler blast shockwave & radial flash
      if (s.sepFlashT >= 0 && s.sepFlashT < 0.9) {
        const fk = s.sepFlashT / 0.9;
        const upRad = (-s.rocketAngDeg * Math.PI) / 180;
        const sp = toPx(
          s.rocketX + Math.sin(upRad) * (bodyH * 0.52),
          s.rocketY + Math.cos(upRad) * (bodyH * 0.52)
        );
        ctx.save();
        ctx.strokeStyle = `rgba(253, 224, 71, ${(1 - fk) * 0.72})`;
        ctx.lineWidth = Math.max(1.5, (1 - fk) * 4);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, (0.35 + fk * 3.8) * pxPerUnit, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Luminous orbital departure wake trail in upper space flight
      if (spaceFlightK > 0.24 && s.trail.length > 2) {
        const wakeVis = smoothStep(inverseLerp(0.24, 0.72, spaceFlightK));
        ctx.save();
        for (let i = 1; i < s.trail.length; i++) {
          const p0 = toPx(s.trail[i - 1].x, s.trail[i - 1].y);
          const p1 = toPx(s.trail[i].x, s.trail[i].y);
          const frac = i / s.trail.length;
          ctx.strokeStyle = `rgba(125, 211, 252, ${(frac * 0.52 * wakeVis).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.5, frac * 3.2 * rocketVisScale);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Live rocket exhaust fire embers, sparks & pre-launch pad smoke clouds
      for (const pt of s.exhaustParticles) {
        const pp = toPx(pt.x, pt.y);
        const lifeFrac = clamp01(pt.age / pt.life);
        if (pt.kind === 'smoke') {
          const fade = Math.sin(lifeFrac * Math.PI) * 0.72;
          const rPx = Math.max(4, pt.size * (0.9 + lifeFrac * 1.45) * pxPerUnit);
          const sg = ctx.createRadialGradient(pp.x, pp.y, rPx * 0.12, pp.x, pp.y, rPx);
          sg.addColorStop(0, `rgba(248, 250, 252, ${(fade * 0.85).toFixed(3)})`);
          sg.addColorStop(0.55, `rgba(226, 232, 240, ${(fade * 0.46).toFixed(3)})`);
          sg.addColorStop(1, 'rgba(203, 213, 225, 0)');
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, rPx, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const alpha = clamp01(1 - lifeFrac);
        const rPx =
          Math.max(2, pt.size * (1.2 - lifeFrac * 0.5) * pxPerUnit) *
          rocketVisScale;
        const eg = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rPx);
        if (pt.kind === 'spark') {
          eg.addColorStop(0, `rgba(255, 251, 210, ${(alpha * 0.92).toFixed(3)})`);
          eg.addColorStop(0.45, `rgba(254, 240, 138, ${(alpha * 0.58).toFixed(3)})`);
          eg.addColorStop(1, 'rgba(254, 240, 138, 0)');
        } else {
          eg.addColorStop(0, `rgba(253, 186, 116, ${(alpha * 0.85).toFixed(3)})`);
          eg.addColorStop(0.5, `rgba(249, 115, 22, ${(alpha * 0.48).toFixed(3)})`);
          eg.addColorStop(1, 'rgba(249, 115, 22, 0)');
        }
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, rPx, 0, Math.PI * 2);
        ctx.fill();
      }

      // Detached Stage 1 (Spent Core) — exact anatomical alignment (0 .. -0.545 * bodyH)
      if (s.detachedStage1) {
        const dp = toPx(s.detachedStage1.x, s.detachedStage1.y);
        const fadeOut =
          s.detachedStage1.age > 3.6 ? clamp01((4.6 - s.detachedStage1.age) / 1.0) : 1;
        const coreH = bodyH * 0.546;
        ctx.save();
        ctx.globalAlpha = fadeOut;
        ctx.translate(dp.x, dp.y);
        ctx.rotate((-s.detachedStage1.angDeg * Math.PI) / 180);
        if (!drawCleanFitHeight(mk11Sprites.spentCore, 0, -(coreH * 0.5) * pxPerUnit, coreH * pxPerUnit)) {
          drawSpriteFitHeight(
            cfg.set.s1,
            0,
            -cfg.s1Y * pxPerUnit,
            cfg.s1H * pxPerUnit,
            '#e2e8f0',
            0.9 * cfg.scale * pxPerUnit
          );
        }
        ctx.restore();
      }

      // Detached Right Fairing Shell
      if (s.detachedFairing) {
        const fp = toPx(s.detachedFairing.x, s.detachedFairing.y);
        const fadeOut =
          s.detachedFairing.age > 3.2 ? clamp01((4.2 - s.detachedFairing.age) / 1.0) : 1;
        ctx.save();
        ctx.globalAlpha = fadeOut;
        ctx.translate(fp.x, fp.y);
        ctx.rotate((-s.detachedFairing.angDeg * Math.PI) / 180);
        drawCleanFitHeight(mk11Sprites.fairingR, 0, 0, bodyH * 0.27 * pxPerUnit);
        ctx.restore();
      }

      // Detached Left Fairing Shell
      if (s.detachedFairingL) {
        const fp = toPx(s.detachedFairingL.x, s.detachedFairingL.y);
        const fadeOut =
          s.detachedFairingL.age > 3.2 ? clamp01((4.2 - s.detachedFairingL.age) / 1.0) : 1;
        ctx.save();
        ctx.globalAlpha = fadeOut;
        ctx.translate(fp.x, fp.y);
        ctx.rotate((-s.detachedFairingL.angDeg * Math.PI) / 180);
        drawCleanFitHeight(mk11Sprites.fairingL, 0, 0, bodyH * 0.27 * pxPerUnit);
        ctx.restore();
      }

      // Separation sparks & venting gas particles (soft radial puffs)
      for (const pt of s.sepParticles) {
        const pp = toPx(pt.x, pt.y);
        const alpha = clamp01(1 - pt.age / pt.life);
        if (pt.kind === 'smoke') {
          const rPx = pt.size * (1.25 + pt.age * 1.55) * pxPerUnit;
          const sg = ctx.createRadialGradient(pp.x, pp.y, rPx * 0.1, pp.x, pp.y, rPx);
          sg.addColorStop(0, `rgba(226, 232, 240, ${(alpha * 0.60).toFixed(3)})`);
          sg.addColorStop(1, 'rgba(226, 232, 240, 0)');
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, rPx, 0, Math.PI * 2);
          ctx.fill();
        } else if (pt.kind === 'ember') {
          const rPx = pt.size * 1.35 * pxPerUnit;
          const eg = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rPx);
          eg.addColorStop(0, `rgba(255, 237, 213, ${(alpha * 0.95).toFixed(3)})`);
          eg.addColorStop(0.5, `rgba(251, 146, 60, ${(alpha * 0.72).toFixed(3)})`);
          eg.addColorStop(1, 'rgba(251, 146, 60, 0)');
          ctx.fillStyle = eg;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, rPx, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(254, 240, 138, ${alpha.toFixed(3)})`;
          const sz = Math.max(2, pt.size * 1.6 * pxPerUnit);
          ctx.fillRect(pp.x - sz / 2, pp.y - sz / 2, sz, sz);
        }
      }

      if (spawnGlowRef.current > 0) {
        spawnGlowRef.current = Math.max(0, spawnGlowRef.current - dt * 2.2);
      }

      // Advance modular construction storyboard animations when visible on pad
      if (showRocketRef.current) {
        const anims = partAnimsRef.current;
        const stepAnim = (entry: { active: boolean; p: number; delay: number }) => {
          if (!entry.active || entry.p >= 1) return;
          if (entry.delay > 0) {
            entry.delay = Math.max(0, entry.delay - dt);
            return;
          }
          entry.p = Math.min(1, entry.p + dt / 0.52);
        };
        stepAnim(anims.core);
        stepAnim(anims.boosters);
        stepAnim(anims.fairing);
        stepAnim(anims.avionics);
      }

      // Active Rocket — crisp modular sprite assembly + animated fire plumes
      if (s.rocketVisible && showRocketRef.current) {
        const rp = toPx(s.rocketX, s.rocketY);
        if (spawnGlowRef.current > 0.02) {
          const g = spawnGlowRef.current;
          const aura = ctx.createRadialGradient(
            rp.x,
            rp.y - bodyH * 0.45 * pxPerUnit,
            10,
            rp.x,
            rp.y - bodyH * 0.45 * pxPerUnit,
            bodyH * 0.72 * pxPerUnit
          );
          aura.addColorStop(0, `rgba(248, 210, 116, ${(g * 0.45).toFixed(3)})`);
          aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y - bodyH * 0.45 * pxPerUnit, bodyH * 0.72 * pxPerUnit, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.translate(rp.x, rp.y);
        ctx.rotate((-s.rocketAngDeg * Math.PI) / 180);
        ctx.scale(rocketVisScale, rocketVisScale);

        let drawnCustom = false;
        const asm = assemblyRef.current;
        const anims = partAnimsRef.current;
        const partsReady =
          mk11Sprites.partCore.ready &&
          mk11Sprites.partBoosterL.ready &&
          mk11Sprites.partBoosterR.ready &&
          mk11Sprites.partFairing.ready &&
          mk11Sprites.partTower.ready;

        if (!s.separated && mk11Sprites.idle.ready) {
          // 3 nozzle-anchored 8-frame pixel-art plumes drawn behind rocket nozzles
          if (s.flame1On && stage1FlameRamp > 0.02) {
            const noz = getStage1Nozzles();
            const idleAspect = mk11Sprites.idle.width / Math.max(1, mk11Sprites.idle.height);
            const fullPxH = bodyH * pxPerUnit;
            const fullPxW = fullPxH * idleAspect;

            if (asm.hasBoosters) {
              drawMultiFramePlume(
                plumeFrames.boosterL,
                (noz.leftX - 0.5) * fullPxW,
                (noz.leftY - 1.0) * fullPxH,
                fullPxH * 0.25,
                0.76,
                now,
                stage1FlameRamp,
                1
              );
              drawMultiFramePlume(
                plumeFrames.boosterR,
                (noz.rightX - 0.5) * fullPxW,
                (noz.rightY - 1.0) * fullPxH,
                fullPxH * 0.25,
                0.76,
                now,
                stage1FlameRamp,
                4
              );
            }
            drawMultiFramePlume(
              plumeFrames.core,
              (noz.centerX - 0.5) * fullPxW,
              (noz.centerY - 1.0) * fullPxH,
              fullPxH * 0.33,
              0.92,
              now,
              stage1FlameRamp,
              0
            );
          }

          if (partsReady) {
            const baseCenterY = -(bodyH * 0.5) * pxPerUnit;
            const fullH = bodyH * pxPerUnit;

            // 1. Core Stage (Estructura CSM / Eagle) — rises vertically out of the pad pit
            if (asm.hasCore) {
              const k = easeOutCubic(anims.core.p);
              const riseOffsetPx = (1 - k) * bodyH * 0.56 * pxPerUnit;
              if (k < 1) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-fullH, -fullH * 1.6, fullH * 2, fullH * 1.6);
                ctx.clip();
                drawCleanFitHeight(mk11Sprites.partCore, 0, baseCenterY + riseOffsetPx, fullH);
                ctx.restore();
              } else {
                drawCleanFitHeight(mk11Sprites.partCore, 0, baseCenterY, fullH);
              }
            }

            // 2. Side Boosters (Tanques de propelente) — glide horizontally inward from both sides
            if (asm.hasBoosters) {
              const k = easeOutCubic(anims.boosters.p);
              const slidePx = (1 - k) * 2.6 * pxPerUnit;
              ctx.save();
              ctx.globalAlpha = Math.min(1, 0.25 + k * 0.75);
              drawCleanFitHeight(mk11Sprites.partBoosterL, -slidePx, baseCenterY, fullH);
              drawCleanFitHeight(mk11Sprites.partBoosterR, slidePx, baseCenterY, fullH);
              ctx.restore();
            }

            // 3. Upper Stage / Fairing (Energía y Carga útil) — lowers from above onto core
            if (asm.hasFairing) {
              const k = easeOutCubic(anims.fairing.p);
              const dropPx = -(1 - k) * 2.8 * pxPerUnit;
              ctx.save();
              ctx.globalAlpha = Math.min(1, 0.2 + k * 0.8);
              drawCleanFitHeight(mk11Sprites.partFairing, 0, baseCenterY + dropPx, fullH);
              ctx.restore();
            }

            // 4. Escape Tower / Nose Tip (Computadora AGC y Antena) — drops onto fairing tip
            if (asm.hasAvionics) {
              const k = easeOutCubic(anims.avionics.p);
              const dropPx = -(1 - k) * 2.2 * pxPerUnit;
              ctx.save();
              ctx.globalAlpha = Math.min(1, 0.2 + k * 0.8);
              drawCleanFitHeight(mk11Sprites.partTower, 0, baseCenterY + dropPx, fullH);
              ctx.restore();
            }
            drawnCustom = true;
          } else {
            drawnCustom = drawCleanFitHeight(
              mk11Sprites.idle,
              0,
              -(bodyH * 0.5) * pxPerUnit,
              bodyH * pxPerUnit
            );
          }
        } else if (s.separated && (mk11Sprites.desacopleBody.ready || mk11Sprites.undocked.ready)) {
          if (mk11Sprites.desacopleBody.ready) {
            // Smooth ignition of 8-frame pixel-art vacuum flame anchored directly inside CSM bell nozzle
            if (s.flame2On && stage2FlameRamp > 0.02) {
              drawMultiFramePlume(
                plumeFrames.vacuum,
                desacopleNozzleLocalX * pxPerUnit,
                desacopleNozzleLocalY * pxPerUnit,
                desacopleH * 0.56 * pxPerUnit,
                0.85,
                now,
                stage2FlameRamp,
                2
              );
            }
            drawnCustom = drawCleanFitHeight(
              mk11Sprites.desacopleBody,
              0,
              desacopleCenterLocalY * pxPerUnit,
              desacopleH * pxPerUnit
            );
          } else {
            if (s.flame2On) {
              drawFlameGlow(0, (desacopleCenterLocalY + 1.2) * pxPerUnit, 1.45 * flicker * pxPerUnit);
            }
            drawnCustom = drawCleanFitHeight(
              mk11Sprites.undocked,
              0,
              desacopleCenterLocalY * pxPerUnit,
              3.7 * pxPerUnit
            );
          }
        }

        if (!drawnCustom) {
          if (!s.separated) {
            if (s.flame1On) {
              const fh = cfg.f1H * flicker;
              const flameCenterY = -(cfg.f1BaseY - fh / 2) * pxPerUnit;
              drawFlameGlow(0, flameCenterY, fh * pxPerUnit * 1.1);
              drawSpriteFitHeight(
                cfg.set.f1,
                0,
                flameCenterY,
                fh * pxPerUnit,
                'rgb(255, 140, 26)',
                cfg.f1W * pxPerUnit
              );
            }
            drawSpriteFitHeight(
              cfg.set.s1,
              0,
              -cfg.s1Y * pxPerUnit,
              cfg.s1H * pxPerUnit,
              '#ebebf5',
              0.9 * cfg.scale * pxPerUnit
            );
          }
          if (s.flame2On) {
            const fh = cfg.f2H * flicker;
            const flameCenterY = -(cfg.f2BaseY - fh / 2) * pxPerUnit;
            drawFlameGlow(0, flameCenterY, fh * pxPerUnit * 1.1);
            drawSpriteFitHeight(
              cfg.set.f2,
              0,
              flameCenterY,
              fh * pxPerUnit,
              'rgb(255, 153, 38)',
              cfg.f2W * pxPerUnit
            );
          }
          drawSpriteFitHeight(
            cfg.set.s2,
            0,
            -cfg.s2Y * pxPerUnit,
            cfg.s2H * pxPerUnit,
            '#c7cce6',
            0.7 * cfg.scale * pxPerUnit
          );
        }

        ctx.restore();
      }

      // Volumetric Multi-Layer Fireball Explosion
      if (s.explosion) {
        const ep = toPx(s.explosion.x, s.explosion.y);
        const k = clamp01(s.explosion.t / 0.9);
        const rPx = lerp(0.8, 7.6, k) * 0.52 * pxPerUnit;
        const fade = 1 - k;
        const expGrad = ctx.createRadialGradient(ep.x, ep.y, rPx * 0.08, ep.x, ep.y, rPx);
        expGrad.addColorStop(0, `rgba(255, 250, 210, ${(fade * 0.95).toFixed(3)})`);
        expGrad.addColorStop(0.35, `rgba(251, 146, 60, ${(fade * 0.85).toFixed(3)})`);
        expGrad.addColorStop(0.75, `rgba(220, 38, 38, ${(fade * 0.45).toFixed(3)})`);
        expGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
        ctx.fillStyle = expGrad;
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, rPx, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dynamic Post-Processing Pipeline (blooms engine plumes, sun shafts, stars, Earth limb & smooths sky)
      const activeFlareBoost =
        (s.flame1On || s.flame2On ? 0.32 : 0) +
        (s.sepFlashT >= 0 && s.sepFlashT < 0.7 ? (1 - s.sepFlashT / 0.7) * 0.45 : 0) +
        (s.explosion ? (1 - clamp01(s.explosion.t / 0.9)) * 0.6 : 0);

      pipeline.apply(ctx, canvas, {
        preset: skyK > 0.55 ? 'space' : 'launch_day',
        spaceBlend: skyK,
        bloomStrength: lerp(0.44, 0.56, skyK),
        bloomPreDim: lerp(0.78, 1.0, skyK),
        thresholdPasses: skyK > 0.45 ? 2 : 3,
        anamorphicStrength: lerp(0.18, 0.24, skyK),
        vignetteStrength: lerp(0.30, 0.46, skyK),
        grainStrength: 0.036,
        gradeStrength: 0.34,
        flareBoost: clamp01(activeFlareBoost),
      });

      if (now - lastPush > 50) {
        lastPush = now;
        const countdownRem =
          s.outcome === LaunchOutcome.Idle
            ? COUNTDOWN_SECONDS
            : s.outcome === LaunchOutcome.Running && s.stage === Stage.Countdown
              ? Math.max(0, COUNTDOWN_SECONDS - s.t)
              : 0;
        onTelemetryRef.current({
          outcome: s.outcome,
          phase: s.phase,
          resultMessage: s.resultMessage,
          altitudeKm: s.altitudeKm,
          speedKms: s.speedKms,
          deltaVBurned: s.deltaVBurned,
          deltaVRequired: s.deltaVRequired,
          countdownRemaining: countdownRem,
          abortReason: s.abortReason,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
