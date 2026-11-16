import React, { useEffect, useRef } from 'react';
import { REAL_LUNAR_PHYSICS } from '../data/gameData';
import { useLanguage } from '../i18n/LanguageContext';
import { LunarDestination, LunarTelemetry, OperationStage } from '../types/game';
import {
  COUPLED_SHIP_SPRITE_SRC,
  CleanSprite,
  EARTH_TEXTURE_SRC,
  STATION_SPRITE_SHEET_SRC,
  SUN_SPRITE_SRC,
  loadCleanSpaceStationSprite,
  loadCleanSprite,
} from '../utils/spriteLoader';
import { loadCleanSunSprite } from '../utils/spriteLoader';
import { PostProcessPipeline } from '../utils/postProcess';
import { StarDot, drawAnimatedSpaceBackground, SPACE_BG_SRC } from './AnimatedSpaceBg';

interface OrbitMapCanvasProps {
  destination: LunarDestination | null;
  solarWatts: number;
  rtgWatts: number;
  consumptionWatts: number;
  batteryCapacityWh: number;
  speedMultiplier: number;
  offline: boolean;
  designResetKey: number;
  panelFraction?: number;
  operationWaiting?: boolean;
  operationStage?: OperationStage;
  operationProgress?: number;
  operationTotalSteps?: number;
  operationStepsPerSecond?: number;
  operationSpeedMultiplier?: number;
  operationPaused?: boolean;
  onTelemetry?: (t: LunarTelemetry) => void;
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function cubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number; dx: number; dy: number } {
  const u = 1 - t;
  const x =
    u * u * u * p0.x +
    3 * u * u * t * p1.x +
    3 * u * t * t * p2.x +
    t * t * t * p3.x;
  const y =
    u * u * u * p0.y +
    3 * u * u * t * p1.y +
    3 * u * t * t * p2.y +
    t * t * t * p3.y;
  const dx =
    3 * u * u * (p1.x - p0.x) +
    6 * u * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const dy =
    3 * u * u * (p1.y - p0.y) +
    6 * u * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  return { x, y, dx, dy };
}

function buildFigure8Geometry(
  earthX: number,
  earthY: number,
  earthR: number,
  moonX: number,
  moonY: number,
  moonR: number
) {
  const earthOrbitR = earthR * 1.46;
  const lunarOrbitR = moonR * 1.72;
  const alpha = (56 * Math.PI) / 180;
  const sinA = Math.sin(alpha);
  const cosA = Math.cos(alpha);

  // Tangent departure/arrival points on Earth & Moon parking orbits
  const eLeave = {
    x: earthX + earthOrbitR * cosA,
    y: earthY - earthOrbitR * sinA,
  };
  const eReturn = {
    x: earthX + earthOrbitR * cosA,
    y: earthY + earthOrbitR * sinA,
  };
  const mEnter = {
    x: moonX - lunarOrbitR * cosA,
    y: moonY + lunarOrbitR * sinA,
  };
  const mLeave = {
    x: moonX - lunarOrbitR * cosA,
    y: moonY - lunarOrbitR * sinA,
  };

  // Central crossover point placed naturally between Earth & Moon
  const cross = {
    x: earthX + (moonX - earthX) * 0.54,
    y: (earthY + moonY) * 0.5,
  };

  // Unit tangents on orbits:
  // Earth clockwise at -alpha -> (+sinA, +cosA); at +alpha -> (-sinA, +cosA)
  // Moon CCW at (PI - alpha) -> (+sinA, +cosA); at -(PI - alpha) -> (-sinA, +cosA)
  const tOut = { x: sinA, y: cosA };
  const tRet = { x: -sinA, y: cosA };

  // Crossover tangents (classic ~30 deg crossing)
  const beta = (30 * Math.PI) / 180;
  const dOut = { x: Math.cos(beta), y: Math.sin(beta) };
  const dRet = { x: -Math.cos(beta), y: Math.sin(beta) };

  const distEL = Math.hypot(cross.x - eLeave.x, cross.y - eLeave.y);
  const distMR = Math.hypot(mEnter.x - cross.x, mEnter.y - cross.y);

  const out1 = {
    p0: eLeave,
    p1: { x: eLeave.x + tOut.x * distEL * 0.36, y: eLeave.y + tOut.y * distEL * 0.36 },
    p2: { x: cross.x - dOut.x * distEL * 0.38, y: cross.y - dOut.y * distEL * 0.38 },
    p3: cross,
  };
  const out2 = {
    p0: cross,
    p1: { x: cross.x + dOut.x * distMR * 0.38, y: cross.y + dOut.y * distMR * 0.38 },
    p2: { x: mEnter.x - tOut.x * distMR * 0.36, y: mEnter.y - tOut.y * distMR * 0.36 },
    p3: mEnter,
  };

  const ret1 = {
    p0: mLeave,
    p1: { x: mLeave.x + tRet.x * distMR * 0.36, y: mLeave.y + tRet.y * distMR * 0.36 },
    p2: { x: cross.x - dRet.x * distMR * 0.38, y: cross.y - dRet.y * distMR * 0.38 },
    p3: cross,
  };
  const ret2 = {
    p0: cross,
    p1: { x: cross.x + dRet.x * distEL * 0.38, y: cross.y + dRet.y * distEL * 0.38 },
    p2: { x: eReturn.x - tRet.x * distEL * 0.36, y: eReturn.y - tRet.y * distEL * 0.36 },
    p3: eReturn,
  };

  const splitOut = distEL / Math.max(1, distEL + distMR);
  const splitRet = distMR / Math.max(1, distEL + distMR);

  const evalOutbound = (u: number) => {
    const cu = Math.max(0, Math.min(1, u));
    return cu < splitOut
      ? cubicBezier(out1.p0, out1.p1, out1.p2, out1.p3, cu / splitOut)
      : cubicBezier(out2.p0, out2.p1, out2.p2, out2.p3, (cu - splitOut) / (1 - splitOut));
  };

  const evalReturn = (u: number) => {
    const cu = Math.max(0, Math.min(1, u));
    return cu < splitRet
      ? cubicBezier(ret1.p0, ret1.p1, ret1.p2, ret1.p3, cu / splitRet)
      : cubicBezier(ret2.p0, ret2.p1, ret2.p2, ret2.p3, (cu - splitRet) / (1 - splitRet));
  };

  const lunarRadStart = Math.PI - alpha;
  const lunarRadEnd = -3 * Math.PI + alpha;

  return {
    earthOrbitR,
    lunarOrbitR,
    alpha,
    cross,
    out1,
    out2,
    ret1,
    ret2,
    evalOutbound,
    evalReturn,
    lunarRadStart,
    lunarRadEnd,
  };
}

export const OrbitMapCanvas: React.FC<OrbitMapCanvasProps> = ({
  destination,
  solarWatts,
  rtgWatts,
  consumptionWatts,
  batteryCapacityWh,
  speedMultiplier,
  offline,
  designResetKey,
  panelFraction = 0.25,
  operationWaiting = false,
  operationStage,
  operationProgress,
  operationTotalSteps = 40,
  operationStepsPerSecond = 2.8,
  operationSpeedMultiplier = 1,
  operationPaused = false,
  onTelemetry,
}) => {
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef({
    simTimeMinutes: 0,
    tripProgress: 0,
    orbitAngleDeg: 180,
    batteryWh: batteryCapacityWh,
    powerFailure: false,
    smoothOpProg: 0,
    transitU: 0,
    smoothSatAngle: 0,
    hasAngle: false,
    camMoonXFrac: 0.78,
    camMoonYFrac: 0.48,
    camMoonRFrac: 0.085,
    hasCamMoon: false,
    lastOpStage: undefined as OperationStage | undefined,
    opStageTimeSec: 0,
    trail: [] as { x: number; y: number }[],
  });

  const propsRef = useRef({
    destination,
    solarWatts,
    rtgWatts,
    consumptionWatts,
    batteryCapacityWh,
    speedMultiplier,
    offline,
    panelFraction,
    operationWaiting,
    operationStage,
    operationProgress,
    operationTotalSteps,
    operationStepsPerSecond,
    operationSpeedMultiplier,
    operationPaused,
    onTelemetry,
  });
  propsRef.current = {
    destination,
    solarWatts,
    rtgWatts,
    consumptionWatts,
    batteryCapacityWh,
    speedMultiplier,
    offline,
    panelFraction,
    operationWaiting,
    operationStage,
    operationProgress,
    operationTotalSteps,
    operationStepsPerSecond,
    operationSpeedMultiplier,
    operationPaused,
    onTelemetry,
  };

  useEffect(() => {
    simRef.current.batteryWh = batteryCapacityWh;
    simRef.current.powerFailure = false;
    simRef.current.simTimeMinutes = 0;
    simRef.current.tripProgress = 0;
    simRef.current.orbitAngleDeg = 180;
    simRef.current.smoothOpProg = 0;
    simRef.current.transitU = 0;
    simRef.current.smoothSatAngle = 0;
    simRef.current.hasAngle = false;
    simRef.current.hasCamMoon = false;
    simRef.current.lastOpStage = undefined;
    simRef.current.opStageTimeSec = 0;
    simRef.current.trail = [];
  }, [designResetKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgDay = new Image();
    imgDay.src = EARTH_TEXTURE_SRC;
    const imgMoon = new Image();
    imgMoon.src = '/assets/aistudio/WhatsApp_Image_2026-11-14_at_12.23.04_190d54e8.jpeg';
    const sprSun = loadCleanSunSprite(SUN_SPRITE_SRC, false);
    const imgBg = new Image();
    imgBg.src = SPACE_BG_SRC;

    // User-supplied pixel-art spacecraft sprites (cropped & background-cleaned)
    const sprCsmFlame = loadCleanSprite(
      '/assets/aistudio/WhatsApp_Image_2026-11-14_at_13.41.58__3__b176f9ac.jpeg',
      0,
      1
    );
    const sprCsmIdle = loadCleanSprite(
      '/assets/aistudio/WhatsApp_Image_2026-11-14_at_13.41.58__2__d2bc704e.jpeg',
      0,
      1
    );
    const sprCoupled = loadCleanSprite(
      COUPLED_SHIP_SPRITE_SRC,
      0.3,
      0.85
    );
    const sprStation = loadCleanSpaceStationSprite(STATION_SPRITE_SHEET_SRC);
    const sprLmLander = loadCleanSprite(
      '/assets/aistudio/WhatsApp_Image_2026-11-14_at_13.41.58_ec7accb8.jpeg',
      0.28,
      0.85,
      0.04,
      0.98
    );

    const pipeline = new PostProcessPipeline();

    // Deterministic 95 spectral-tinted stars with parallax speeds & hero diffraction spikes
    const stars: StarDot[] = [];
    let seed = 11;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const tints = [
      '255, 255, 255',
      '196, 228, 255',
      '255, 244, 214',
      '224, 231, 255',
    ];
    for (let i = 0; i < 95; i++) {
      stars.push({
        x: rand(),
        y: rand(),
        phase: rand() * 6.28,
        size: i % 4 === 0 ? 3 : 2,
        speed: 0.4 + rand() * 0.9,
        tint: tints[i % tints.length],
        isHero: i % 10 === 0,
      });
    }

    let rafId = 0;
    let lastTime = performance.now();
    let lastTelemetryPush = 0;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(parent.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(parent.clientHeight * dpr));
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const {
        destination: curDest,
        solarWatts: curSolar,
        rtgWatts: curRtg,
        consumptionWatts: curCons,
        batteryCapacityWh: curCap,
        offline: _curOffline,
        panelFraction: curPanelFrac,
        operationWaiting: curOpWaiting,
        operationStage: curOpStage,
        operationProgress: curOpProgress,
        operationTotalSteps: curOpTotalSteps,
        operationStepsPerSecond: curOpStepsPerSec,
        operationSpeedMultiplier: curOpSpeedMult,
        operationPaused: curOpPaused,
        onTelemetry: curOnTelemetry,
      } = propsRef.current;
      void _curOffline;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Animated Space Background
      const tSec = now / 1000;
      const bgAlpha =
        curOpStage === 'landing_closeup' ||
        curOpStage === 'problem_cables' ||
        curOpStage === 'problem_birome' ||
        curOpStage === 'problem_oxygen'
          ? 0.55
          : 0.92;
      const driftSpeed = curOpStage === 'transit' ? 1.85 : curOpStage === 'return' ? -1.6 : 1;
      drawAnimatedSpaceBackground(ctx, w, h, tSec, imgBg, stars, bgAlpha, driftSpeed);

      // Helper to render a cleaned pixel-art sprite crisply at desired width
      const drawSprite = (
        spr: CleanSprite,
        x: number,
        y: number,
        targetW: number,
        angleRad = 0,
        flipX = false,
        dimmed = false
      ) => {
        if (!spr.ready) return false;
        const aspect = spr.height / Math.max(1, spr.width);
        const targetH = targetW * aspect;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angleRad);
        if (flipX) ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;
        if (dimmed) ctx.globalAlpha = 0.55;
        ctx.drawImage(spr.canvas, -targetW / 2, -targetH / 2, targetW, targetH);
        ctx.restore();
        return true;
      };

      const drawThrusterPlume = (
        x: number,
        y: number,
        dirX: number,
        dirY: number,
        lengthPx: number,
        colorRgb = '251, 191, 36'
      ) => {
        const len = lengthPx * (0.78 + 0.32 * Math.sin(tSec * 28));
        const grad = ctx.createLinearGradient(x, y, x + dirX * len, y + dirY * len);
        grad.addColorStop(0, `rgba(${colorRgb}, 0.9)`);
        grad.addColorStop(1, `rgba(${colorRgb}, 0)`);
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(3, lengthPx * 0.28);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dirX * len, y + dirY * len);
        ctx.stroke();
        ctx.restore();
      };

      const pushAndDrawTrail = (x: number, y: number, colorRgb = '56, 189, 248') => {
        const trail = simRef.current.trail;
        const lastPt = trail[trail.length - 1];
        if (!lastPt || Math.hypot(x - lastPt.x, y - lastPt.y) > 2.5) {
          trail.push({ x, y });
          if (trail.length > 48) trail.shift();
        }
        if (trail.length > 2) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          // Soft outer luminous bloom pass
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 1; i < trail.length; i++) {
            const k = i / trail.length;
            ctx.strokeStyle = `rgba(${colorRgb}, ${(k * 0.24).toFixed(3)})`;
            ctx.lineWidth = 3 + k * 4.5;
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
          }
          // Crisp core trail
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 1; i < trail.length; i++) {
            const k = i / trail.length;
            ctx.strokeStyle = `rgba(${colorRgb}, ${(k * 0.65).toFixed(3)})`;
            ctx.lineWidth = 1.2 + k * 2.1;
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
          }
          ctx.restore();
        }
      };

      const smoothSatAngle = (rawAngle: number): number => {
        if (!simRef.current.hasAngle) {
          simRef.current.smoothSatAngle = rawAngle;
          simRef.current.hasAngle = true;
          return rawAngle;
        }
        const blend = 1 - Math.exp(-dt * 14);
        simRef.current.smoothSatAngle = lerpAngle(
          simRef.current.smoothSatAngle,
          rawAngle,
          blend
        );
        return simRef.current.smoothSatAngle;
      };

      const drawPixelSun = (sunX: number, sunY: number, sunR: number) => {
        const sunGlow = ctx.createRadialGradient(
          sunX,
          sunY,
          sunR * 0.42,
          sunX,
          sunY,
          sunR * 3.1
        );
        sunGlow.addColorStop(0, 'rgba(255, 240, 170, 0.56)');
        sunGlow.addColorStop(0.38, 'rgba(251, 191, 36, 0.24)');
        sunGlow.addColorStop(0.74, 'rgba(245, 158, 11, 0.07)');
        sunGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR * 3.1, 0, Math.PI * 2);
        ctx.fill();

        if (sprSun.ready) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          const drawHalf = sunR * (0.5 / Math.max(0.25, sprSun.coreRadiusFrac));
          ctx.drawImage(
            sprSun.canvas,
            sunX - drawHalf,
            sunY - drawHalf,
            drawHalf * 2,
            drawHalf * 2
          );
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgb(255, 224, 92)';
          ctx.beginPath();
          ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      if (curDest) {
        const rightStart = w * curPanelFrac;
        const rightWidth = w - rightStart;
        const minDim = Math.min(rightWidth, h);
        const isStationMission = curDest.profile === 'station';
        const isEarthOrbitTest =
          curDest.profile === 'orbit' && curDest.distanceKm < 100000;
        const isLunarReconOrbit =
          curDest.profile === 'orbit' && curDest.distanceKm >= 100000;
        const effectiveStage: OperationStage =
          curOpWaiting || !curOpStage ? 'transit' : curOpStage;

        if (curOpWaiting) {
          simRef.current.smoothOpProg = 0;
          simRef.current.transitU = 0;
          simRef.current.hasAngle = false;
          simRef.current.hasCamMoon = false;
          simRef.current.lastOpStage = undefined;
          simRef.current.opStageTimeSec = 0;
          simRef.current.trail = [];
        } else {
          if (simRef.current.lastOpStage !== effectiveStage) {
            const prevStage = simRef.current.lastOpStage;
            simRef.current.lastOpStage = effectiveStage;
            simRef.current.opStageTimeSec = 0;
            // Preserve trail during Earth-orbit tests, MK-III orbit -> return, and transit -> landing_closeup
            if (
              !isEarthOrbitTest &&
              !(isStationMission && (effectiveStage === 'station_docking' || effectiveStage === 'station_ops')) &&
              !(prevStage === 'transit' && effectiveStage === 'landing_closeup') &&
              !(isLunarReconOrbit && prevStage === 'transit' && effectiveStage === 'return')
            ) {
              simRef.current.trail = [];
            }
          } else {
            simRef.current.opStageTimeSec += dt;
          }

          const targetProg = Math.max(0, Math.min(1, curOpProgress ?? 0));
          const totalSteps = Math.max(1, curOpTotalSteps);

          // Reset smoothing cleanly when restarting an operation
          if (targetProg <= 0.03 && simRef.current.smoothOpProg > 0.35) {
            simRef.current.smoothOpProg = 0;
            simRef.current.transitU = 0;
            simRef.current.hasAngle = false;
            simRef.current.hasCamMoon = false;
          } else if (curOpPaused) {
            const pauseBlend = 1 - Math.exp(-dt * 8);
            simRef.current.smoothOpProg +=
              (targetProg - simRef.current.smoothOpProg) * pauseBlend;
          } else if (targetProg >= 1) {
            const endBlend = 1 - Math.exp(-dt * 8);
            simRef.current.smoothOpProg +=
              (1 - simRef.current.smoothOpProg) * endBlend;
          } else {
            // Integrate at constant 60fps rate synced to per-level step pacing (zero speed ripples)
            const stepsPerSec = Math.max(0.2, curOpStepsPerSec || 2.8);
            const stepRate = (stepsPerSec * Math.max(0.25, curOpSpeedMult)) / totalSteps;
            const expectedMid = Math.min(1, targetProg + 0.5 / totalSteps);
            simRef.current.smoothOpProg += stepRate * dt;
            const err = expectedMid - simRef.current.smoothOpProg;
            simRef.current.smoothOpProg += err * Math.min(1, dt * 0.9);
            const minBound = Math.max(0, targetProg - 0.15 / totalSteps);
            const maxBound = Math.min(1, targetProg + 1.15 / totalSteps);
            simRef.current.smoothOpProg = Math.max(
              minBound,
              Math.min(maxBound, simRef.current.smoothOpProg)
            );
          }
        }
        const prog = simRef.current.smoothOpProg;

        // Smooth continuous 0..1 progress for Earth->Moon zoom so Day 1 -> Day 2 has zero snap
        if (curOpWaiting) {
          simRef.current.transitU = 0;
        } else if (isLunarReconOrbit) {
          if (effectiveStage === 'return') {
            simRef.current.transitU = 1;
          } else {
            simRef.current.transitU = Math.max(0, Math.min(1, prog / (8 / 24)));
          }
        } else if (effectiveStage === 'transit') {
          simRef.current.transitU = Math.max(0, Math.min(1, prog / 0.225));
        } else if (effectiveStage === 'landing_closeup') {
          const finishBlend = 1 - Math.exp(-dt * 6);
          simRef.current.transitU += (1 - simRef.current.transitU) * finishBlend;
          if (simRef.current.transitU > 0.996) simRef.current.transitU = 1;
        } else {
          simRef.current.transitU = 1;
        }

        const drawCroppedMoon = (mx: number, my: number, mr: number, rimAlpha = 0.45) => {
          const glow = ctx.createRadialGradient(mx, my, mr * 0.85, mx, my, mr * 1.32);
          glow.addColorStop(0, 'rgba(226, 232, 240, 0.24)');
          glow.addColorStop(1, 'rgba(226, 232, 240, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(mx, my, mr * 1.32, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.arc(mx, my, mr, 0, Math.PI * 2);
          ctx.clip();
          if (imgMoon.complete && imgMoon.naturalWidth > 0) {
            const cropR = mr * 1.32;
            ctx.drawImage(imgMoon, mx - cropR, my - cropR, cropR * 2, cropR * 2);
          } else {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
          }
          const shade = ctx.createLinearGradient(mx, my - mr, mx, my + mr);
          shade.addColorStop(0, 'rgba(255,255,255,0.06)');
          shade.addColorStop(0.62, 'rgba(0,0,0,0.08)');
          shade.addColorStop(1, 'rgba(6,10,20,0.68)');
          ctx.fillStyle = shade;
          ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
          ctx.restore();

          ctx.strokeStyle = `rgba(226, 232, 240, ${rimAlpha})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(mx, my, mr, 0, Math.PI * 2);
          ctx.stroke();
        };

        const drawCroppedEarth = (ex: number, ey: number, er: number, rimAlpha = 0.72) => {
          const earthAtmo = ctx.createRadialGradient(
            ex,
            ey,
            er * 0.92,
            ex,
            ey,
            er * 1.34
          );
          earthAtmo.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
          earthAtmo.addColorStop(0.5, 'rgba(37, 99, 235, 0.14)');
          earthAtmo.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = earthAtmo;
          ctx.beginPath();
          ctx.arc(ex, ey, er * 1.34, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.arc(ex, ey, er, 0, Math.PI * 2);
          ctx.clip();
          if (imgDay.complete && imgDay.naturalWidth > 0) {
            ctx.drawImage(imgDay, ex - er, ey - er, er * 2, er * 2);
          } else {
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
          }
          const earthShade = ctx.createLinearGradient(ex, ey - er, ex, ey + er);
          earthShade.addColorStop(0, 'rgba(224,242,254,0.12)');
          earthShade.addColorStop(0.55, 'rgba(0,0,0,0.10)');
          earthShade.addColorStop(1, 'rgba(4,8,24,0.78)');
          ctx.fillStyle = earthShade;
          ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
          ctx.restore();

          ctx.strokeStyle = `rgba(125, 211, 252, ${rimAlpha})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(ex, ey, er + 1.5, 0, Math.PI * 2);
          ctx.stroke();
        };

        const drawEagleLander = (ex: number, ey: number, sizeW: number, alertColor?: string) => {
          if (alertColor) {
            ctx.save();
            const pulse = 0.45 + 0.4 * Math.sin(tSec * 6);
            ctx.strokeStyle = alertColor;
            ctx.globalAlpha = pulse;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(ex, ey, sizeW * 0.72, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          if (!drawSprite(sprLmLander, ex, ey, sizeW, 0, false)) {
            ctx.save();
            ctx.translate(ex, ey);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-sizeW * 0.35, -sizeW * 0.25, sizeW * 0.7, sizeW * 0.5);
            ctx.restore();
          }
        };

        // Smooth camera target for Moon position/size across operation stages
        let targetMoonXFrac = 0.5;
        let targetMoonYFrac = 0.51;
        let targetMoonRFrac = isLunarReconOrbit ? 0.34 : 0.43;
        if (isLunarReconOrbit) {
          if (effectiveStage === 'return') {
            targetMoonXFrac = 0.78;
            targetMoonYFrac = 0.48;
            targetMoonRFrac = 0.09;
          } else {
            const u = simRef.current.transitU;
            const ease = u * u * (3 - 2 * u);
            targetMoonXFrac = 0.78 + (0.5 - 0.78) * ease;
            targetMoonYFrac = 0.48 + (0.5 - 0.48) * ease;
            targetMoonRFrac = 0.085 + (0.34 - 0.085) * ease;
          }
        } else if (
          effectiveStage === 'transit' ||
          (effectiveStage === 'landing_closeup' && simRef.current.transitU < 0.995)
        ) {
          const u = simRef.current.transitU;
          const ease = u * u * (3 - 2 * u);
          targetMoonXFrac = 0.78 + (0.5 - 0.78) * ease;
          targetMoonYFrac = 0.48 + (0.51 - 0.48) * ease;
          targetMoonRFrac = 0.085 + (0.43 - 0.085) * ease;
        } else if (effectiveStage === 'ascent_docking') {
          targetMoonXFrac = 0.52;
          targetMoonYFrac = 0.95;
          targetMoonRFrac = 0.57;
        } else if (effectiveStage === 'return') {
          targetMoonXFrac = 0.78;
          targetMoonYFrac = 0.48;
          targetMoonRFrac = 0.09;
        }

        if (!simRef.current.hasCamMoon) {
          simRef.current.camMoonXFrac = targetMoonXFrac;
          simRef.current.camMoonYFrac = targetMoonYFrac;
          simRef.current.camMoonRFrac = targetMoonRFrac;
          simRef.current.hasCamMoon = true;
        } else {
          const camBlend = 1 - Math.exp(-dt * 4.5);
          simRef.current.camMoonXFrac += (targetMoonXFrac - simRef.current.camMoonXFrac) * camBlend;
          simRef.current.camMoonYFrac += (targetMoonYFrac - simRef.current.camMoonYFrac) * camBlend;
          simRef.current.camMoonRFrac += (targetMoonRFrac - simRef.current.camMoonRFrac) * camBlend;
        }

        let statusText = '';

        if (isStationMission) {
          // Nivel 2 · MK-II: Estación Espacial (encuentro, acoplamiento con nave completa, datos, fotos de la Tierra y regreso)
          const earthX = rightStart + rightWidth * 0.49;
          const earthY = h * 0.54;
          const earthR = minDim * 0.155;
          const orbitRx = Math.min(rightWidth * 0.36, earthR * 2.05);
          const orbitRy = Math.min(h * 0.34, earthR * 1.76);

          const dprOp = window.devicePixelRatio || 1;
          const opSunX = Math.max(
            rightStart + Math.min(rightWidth * 0.42, 372 * dprOp),
            rightStart + rightWidth * 0.275
          );
          drawPixelSun(opSunX, h * 0.135, minDim * 0.044);

          // Cono de sombra terrestre (35 min eclipse)
          const earthShadowGrad = ctx.createLinearGradient(earthX, earthY, earthX, earthY + orbitRy * 1.45);
          earthShadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.52)');
          earthShadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = earthShadowGrad;
          ctx.beginPath();
          ctx.moveTo(earthX - earthR, earthY);
          ctx.lineTo(earthX + earthR, earthY);
          ctx.lineTo(earthX + earthR * 0.78, earthY + orbitRy * 1.45);
          ctx.lineTo(earthX - earthR * 0.78, earthY + orbitRy * 1.45);
          ctx.closePath();
          ctx.fill();

          // Anillo orbital de la estación y arco de eclipse
          ctx.save();
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.40)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.ellipse(earthX, earthY, orbitRx, orbitRy, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          const shadowRatio = curDest.eclipseMinutes / Math.max(1, curDest.periodMinutes);
          const eclipseHalfRad = shadowRatio * Math.PI;
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(
            earthX,
            earthY,
            orbitRx,
            orbitRy,
            0,
            Math.PI / 2 - eclipseHalfRad,
            Math.PI / 2 + eclipseHalfRad
          );
          ctx.stroke();
          ctx.restore();

          drawCroppedEarth(earthX, earthY, earthR, 0.75);

          // Posición orbital de la Estación Espacial MK-II (pasa por eclipse en paso ~11)
          const stationAng = -0.32 * Math.PI + prog * Math.PI * 1.19;
          const stationX = earthX + Math.cos(stationAng) * orbitRx;
          const stationY = earthY + Math.sin(stationAng) * orbitRy;
          const stationW = Math.max(82, minDim * 0.17);
          const stationAspect = sprStation.ready ? sprStation.height / Math.max(1, sprStation.width) : 0.72;
          const stationH = stationW * stationAspect;
          const portX = sprStation.ready
            ? stationX + stationW * sprStation.portXOffsetFrac
            : stationX - stationW * 0.49;
          const portY = sprStation.ready
            ? stationY + stationH * sprStation.portYOffsetFrac
            : stationY + stationH * 0.048;

          const normStAng = ((stationAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const inOrbEclipse =
            normStAng >= Math.PI / 2 - eclipseHalfRad &&
            normStAng <= Math.PI / 2 + eclipseHalfRad;

          // Dibujar Estación Espacial MK-II
          if (!drawSprite(sprStation, stationX, stationY, stationW, 0, false)) {
            ctx.save();
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(stationX - stationW * 0.4, stationY - 8, stationW * 0.8, 16);
            ctx.restore();
          }

          const coupledW = Math.max(52, minDim * 0.105);
          const labelFont = `600 ${Math.max(11, Math.round(h * 0.016))}px "JetBrains Mono", ui-monospace, monospace`;

          if (effectiveStage === 'transit') {
            const uTrans = Math.max(0, Math.min(1, prog / (5 / 16)));
            const eTrans = 1 - Math.pow(1 - uTrans, 1.35);
            const p0 = { x: earthX - orbitRx * 0.76, y: earthY + orbitRy * 0.14 };
            const p3 = { x: portX - coupledW * 0.92, y: portY };
            const p1 = { x: earthX - orbitRx * 0.74, y: earthY - orbitRy * 1.06 };
            const p2 = {
              x: (earthX + p3.x) * 0.52,
              y: Math.min(earthY - orbitRy * 1.1, portY - orbitRy * 0.24),
            };

            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
            ctx.stroke();
            ctx.restore();

            const pt = cubicBezier(p0, p1, p2, p3, eTrans);
            if (!curOpWaiting) {
              pushAndDrawTrail(pt.x, pt.y, '56, 189, 248');
            }
            const tangentAng = Math.atan2(pt.dy, pt.dx);
            const blendToDock = Math.max(0, (uTrans - 0.72) / 0.28);
            const targetAng = lerpAngle(tangentAng, 0, blendToDock * blendToDock);
            const shipAngle = smoothSatAngle(targetAng);

            if (!curOpWaiting && uTrans < 0.95) {
              const dLen = Math.hypot(pt.dx, pt.dy) || 1;
              drawThrusterPlume(
                pt.x,
                pt.y,
                -pt.dx / dLen,
                -pt.dy / dLen,
                coupledW * 0.48,
                '56, 189, 248'
              );
            }
            drawSprite(sprCoupled, pt.x, pt.y, coupledW, shipAngle, false);
          } else if (effectiveStage === 'station_docking') {
            const dockX = portX - coupledW * 0.88 + Math.sin(tSec * 1.4) * 2.5;
            const dockY = portY + Math.cos(tSec * 1.1) * 1.8;
            const pulse = 0.55 + 0.45 * Math.sin(tSec * 6.5);

            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = `rgba(251, 191, 36, ${pulse.toFixed(2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dockX + coupledW * 0.42, dockY);
            ctx.lineTo(portX, portY);
            ctx.stroke();

            ctx.strokeStyle = `rgba(251, 191, 36, ${(pulse * 0.9).toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(portX, portY, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            drawThrusterPlume(dockX - coupledW * 0.45, dockY, -1, 0, 14, '56, 189, 248');
            drawSprite(sprCoupled, dockX, dockY, coupledW, 0, false);
          } else if (effectiveStage === 'station_ops') {
            // Nave completa acoplada directamente al puerto izquierdo de la estación
            const shipX = portX - coupledW * 0.435;
            const shipY = portY;

            // Sello verde de acoplamiento hermético
            ctx.save();
            const lockGlow = 0.65 + 0.35 * Math.sin(tSec * 4);
            ctx.strokeStyle = `rgba(52, 211, 153, ${lockGlow.toFixed(2)})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(portX, portY, 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            drawSprite(sprCoupled, shipX, shipY, coupledW, 0, false);

            // Animación de recolección de datos + fotos hacia la Tierra
            if (prog >= 6 / 16) {
              const dirEx = earthX - stationX;
              const dirEy = earthY - stationY;
              const distE = Math.hypot(dirEx, dirEy) || 1;
              const ux = dirEx / distE;
              const uy = dirEy / distE;
              const baseAng = Math.atan2(uy, ux);

              // Ondas de telemetría hacia la Tierra
              for (let wIdx = 0; wIdx < 2; wIdx++) {
                const waveP = (tSec * 1.15 + wIdx * 0.5) % 1;
                const arcR = 16 + waveP * Math.min(85, distE * 0.48);
                ctx.save();
                ctx.strokeStyle = `rgba(52, 211, 153, ${((1 - waveP) * 0.72).toFixed(2)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(stationX, stationY, arcR, baseAng - 0.38, baseAng + 0.38);
                ctx.stroke();
                ctx.restore();
              }

              // Haz de cámara fotografiando la Tierra (paso 8-12)
              if (prog >= 8 / 16) {
                const camOriginX = shipX + coupledW * 0.15;
                const camOriginY = shipY;
                const flashCycle = (tSec * 0.75) % 1;
                const flashAlpha = flashCycle < 0.16 ? (1 - flashCycle / 0.16) * 0.48 : 0.12;
                const perpX = -uy;
                const perpY = ux;
                const targetSpotX = earthX + ux * -earthR * 0.25;
                const targetSpotY = earthY + uy * -earthR * 0.25;

                ctx.save();
                const coneGrad = ctx.createLinearGradient(
                  camOriginX,
                  camOriginY,
                  targetSpotX,
                  targetSpotY
                );
                coneGrad.addColorStop(0, `rgba(56, 189, 248, ${(flashAlpha + 0.16).toFixed(2)})`);
                coneGrad.addColorStop(1, `rgba(250, 204, 21, ${(flashAlpha * 0.65).toFixed(2)})`);
                ctx.fillStyle = coneGrad;
                ctx.beginPath();
                ctx.moveTo(camOriginX, camOriginY);
                ctx.lineTo(targetSpotX + perpX * earthR * 0.42, targetSpotY + perpY * earthR * 0.42);
                ctx.lineTo(targetSpotX - perpX * earthR * 0.42, targetSpotY - perpY * earthR * 0.42);
                ctx.closePath();
                ctx.fill();

                // Retícula de foto sobre la Tierra
                ctx.strokeStyle = `rgba(250, 204, 21, ${(0.45 + flashAlpha).toFixed(2)})`;
                ctx.lineWidth = 1.6;
                ctx.strokeRect(targetSpotX - 11, targetSpotY - 11, 22, 22);
                ctx.restore();
              }
            }
          } else {
            // Reentrada: desacople de la nave completa y amerizaje en el Pacífico
            const retU = Math.max(0, Math.min(1, (prog - 13 / 16) / (3 / 16)));
            const eRet = retU * retU * (3 - 2 * retU);
            const p0 = { x: portX - coupledW * 0.435, y: portY };
            const p3 = { x: earthX + earthR * 0.12, y: earthY - earthR * 0.08 };
            const p1 = { x: p0.x - orbitRx * 0.55, y: p0.y + orbitRy * 0.35 };
            const p2 = { x: earthX - earthR * 0.95, y: earthY - earthR * 0.85 };

            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
            ctx.stroke();
            ctx.restore();

            const pt = cubicBezier(p0, p1, p2, p3, eRet);
            pushAndDrawTrail(pt.x, pt.y, '245, 158, 11');
            const angle = smoothSatAngle(Math.atan2(pt.dy, pt.dx));
            if (retU < 0.88) {
              const dLen = Math.hypot(pt.dx, pt.dy) || 1;
              drawThrusterPlume(
                pt.x,
                pt.y,
                -pt.dx / dLen,
                -pt.dy / dLen,
                coupledW * 0.5,
                '245, 158, 11'
              );
            }
            drawSprite(sprCoupled, pt.x, pt.y, coupledW, angle, false);

            if (retU > 0.84) {
              const splashR = 8 + ((tSec * 24) % 18);
              ctx.save();
              ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(p3.x, p3.y, splashR, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }

          const en = langRef.current === 'en';
          ctx.font = labelFont;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(125, 211, 252, 0.95)';
          ctx.fillText(
            en ? 'SPACE STATION MK-II' : 'ESTACIÓN ESPACIAL MK-II',
            stationX,
            stationY - stationH * 0.56 - 6
          );
          ctx.fillStyle = 'rgba(147, 197, 253, 0.92)';
          ctx.fillText(en ? 'EARTH · PACIFIC' : 'TIERRA · PACÍFICO', earthX, earthY + earthR + 22);
          ctx.fillStyle = inOrbEclipse ? 'rgba(251, 191, 36, 0.95)' : 'rgba(125, 211, 252, 0.9)';
          ctx.fillText(
            inOrbEclipse
              ? en
                ? `ECLIPSE ZONE (${curDest.eclipseMinutes} MIN)`
                : `ZONA DE ECLIPSE (${curDest.eclipseMinutes} MIN)`
              : en
                ? 'SUNLIT ORBIT (420 KM)'
                : 'ÓRBITA ILUMINADA (420 KM)',
            earthX,
            earthY + orbitRy + 26
          );
          ctx.textAlign = 'left';

          statusText = curOpWaiting
            ? en
              ? 'MK-II · SPACE STATION RENDEZVOUS (420 KM)'
              : 'MK-II · ENCUENTRO CON ESTACIÓN ESPACIAL (420 KM)'
            : effectiveStage === 'station_docking'
              ? en
                ? 'MK-II · DOCKING FULL SPACECRAFT ↔ SPACE STATION'
                : 'MK-II · ACOPLAMIENTO NAVE COMPLETA ↔ ESTACIÓN ESPACIAL'
              : effectiveStage === 'station_ops'
                ? en
                  ? 'MK-II · SPACE STATION: DATA & EARTH PHOTOGRAPHY'
                  : 'MK-II · ESTACIÓN ESPACIAL: RECOLECCIÓN DE DATOS Y FOTOS DE LA TIERRA'
                : effectiveStage === 'return'
                  ? en
                    ? 'MK-II · UNDOCKING & REENTRY TO PACIFIC OCEAN'
                    : 'MK-II · DESACOPLE Y REENTRADA AL OCÉANO PACÍFICO'
                  : en
                    ? 'MK-II · TRANSIT TO SPACE STATION'
                    : 'MK-II · TRÁNSITO HACIA LA ESTACIÓN ESPACIAL';
        } else if (isEarthOrbitTest) {
          // Nivel 1 (MK-I LEO): Órbita alrededor de la Tierra con paso por sombra/eclipse
          const earthX = rightStart + rightWidth * 0.52;
          const earthY = h * 0.53;
          const earthR = minDim * 0.175;
          const orbitRx = earthR * 1.72;
          const orbitRy = earthR * 1.66;

          // Sol limpio (sin aro rojo) en la esquina superior izquierda visible
          const dprOp = window.devicePixelRatio || 1;
          const opSunX = Math.max(
            rightStart + Math.min(rightWidth * 0.42, 372 * dprOp),
            rightStart + rightWidth * 0.275
          );
          drawPixelSun(opSunX, h * 0.135, minDim * 0.044);

          // Cono de sombra terrestre
          const earthShadowGrad = ctx.createLinearGradient(earthX, earthY, earthX, earthY + orbitRy * 1.45);
          earthShadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.52)');
          earthShadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = earthShadowGrad;
          ctx.beginPath();
          ctx.moveTo(earthX - earthR, earthY);
          ctx.lineTo(earthX + earthR, earthY);
          ctx.lineTo(earthX + earthR * 0.78, earthY + orbitRy * 1.45);
          ctx.lineTo(earthX - earthR * 0.78, earthY + orbitRy * 1.45);
          ctx.closePath();
          ctx.fill();

          // Anillo orbital y zona de eclipse
          ctx.save();
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.ellipse(earthX, earthY, orbitRx, orbitRy, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          const shadowRatio = curDest.eclipseMinutes / Math.max(1, curDest.periodMinutes);
          const eclipseHalfRad = shadowRatio * Math.PI;
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(
            earthX,
            earthY,
            orbitRx,
            orbitRy,
            0,
            Math.PI / 2 - eclipseHalfRad,
            Math.PI / 2 + eclipseHalfRad
          );
          ctx.stroke();
          ctx.restore();

          // Planeta Tierra con halo atmosférico Rayleigh
          drawCroppedEarth(earthX, earthY, earthR, 0.72);

          // Nave orbitando o reentrando suavemente sin saltos de radio ni rotación brusca
          const orbitsCount = 1.45;
          const retStart = 0.875;
          const evalEarthOrbitPos = (p: number) => {
            const ang = -Math.PI / 2 + p * Math.PI * 2 * orbitsCount;
            const rFrac = Math.max(0, Math.min(1, (p - retStart) / (1 - retStart)));
            const rEase = rFrac * rFrac * rFrac * (rFrac * (rFrac * 6 - 15) + 10);
            const shrink = 1 - rEase * 0.54;
            return {
              x: earthX + Math.cos(ang) * orbitRx * shrink,
              y: earthY + Math.sin(ang) * orbitRy * shrink,
              ang,
            };
          };
          const curPos = evalEarthOrbitPos(prog);
          const nextPos = evalEarthOrbitPos(Math.min(1, prog + 0.0025));
          const sx = curPos.x;
          const sy = curPos.y;
          const orbAngle = curPos.ang;
          const isReturning = prog >= retStart || effectiveStage === 'return';
          // Sprites sprCsmIdle/sprCsmFlame apuntan hacia la izquierda (-x), por eso restamos PI
          const rawShipAngle =
            Math.atan2(nextPos.y - curPos.y, nextPos.x - curPos.x) - Math.PI;
          const shipAngle = smoothSatAngle(rawShipAngle);

          if (!curOpWaiting) {
            pushAndDrawTrail(sx, sy, isReturning ? '245, 158, 11' : '56, 189, 248');
          }
          const shipW = Math.max(46, minDim * 0.1);
          const normAngle = ((orbAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const inOrbEclipse =
            normAngle >= Math.PI / 2 - eclipseHalfRad &&
            normAngle <= Math.PI / 2 + eclipseHalfRad;

          drawSprite(
            isReturning ? sprCsmFlame : sprCsmIdle,
            sx,
            sy,
            shipW,
            shipAngle,
            false
          );

          const en = langRef.current === 'en';
          const labelFont = `600 ${Math.max(11, Math.round(h * 0.016))}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.font = labelFont;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(147, 197, 253, 0.92)';
          ctx.fillText(en ? 'EARTH · PACIFIC' : 'TIERRA · PACÍFICO', earthX, earthY + earthR + 22);
          ctx.fillStyle = inOrbEclipse ? 'rgba(251, 191, 36, 0.95)' : 'rgba(125, 211, 252, 0.9)';
          ctx.fillText(
            inOrbEclipse
              ? en
                ? `ECLIPSE ZONE (${curDest.eclipseMinutes} MIN)`
                : `ZONA DE ECLIPSE (${curDest.eclipseMinutes} MIN)`
              : en
                ? 'SUNLIT ORBIT'
                : 'ÓRBITA ILUMINADA',
            earthX,
            earthY + orbitRy + 26
          );
          ctx.textAlign = 'left';

          statusText = curOpWaiting
            ? en
              ? 'MK-I · LOW ORBIT 400 KM · ORBITAL INSERTION'
              : 'MK-I · ÓRBITA BAJA 400 KM · INSERCIÓN ORBITAL'
            : isReturning
              ? en
                ? 'MK-I · REENTRY & PACIFIC SPLASHDOWN'
                : 'MK-I · REENTRADA Y AMERIZAJE EN EL PACÍFICO'
              : en
                ? `MK-I · LOW ORBIT 400 KM · ${inOrbEclipse ? 'IN SHADOW (BATTERY)' : 'SOLAR ILLUMINATION'}`
                : `MK-I · ÓRBITA BAJA 400 KM · ${inOrbEclipse ? 'EN SOMBRA (BATERÍA)' : 'ILUMINACIÓN SOLAR'}`;
        } else if (
          effectiveStage === 'transit' ||
          (effectiveStage === 'landing_closeup' && simRef.current.transitU < 0.995)
        ) {
          // Día 1 -> inicio Día 2 (y órbita completa de reconocimiento MK-III): Transición fluida 60fps
          const u = simRef.current.transitU;
          const ease = u * u * (3 - 2 * u);

          const earthX = rightStart + rightWidth * (0.20 - 0.34 * ease);
          const earthY = h * (0.52 + 0.04 * ease);
          const earthR = minDim * (0.13 - 0.04 * ease);
          const earthAlpha = Math.max(0, 1 - ease * 1.35);

          const moonX = rightStart + rightWidth * simRef.current.camMoonXFrac;
          const moonY = h * simRef.current.camMoonYFrac;
          const moonR = minDim * simRef.current.camMoonRFrac;

          const dprOpTr = window.devicePixelRatio || 1;
          const trSunX = Math.max(
            rightStart + Math.min(rightWidth * 0.42, 372 * dprOpTr),
            rightStart + rightWidth * 0.275
          );
          drawPixelSun(trSunX, h * 0.135, minDim * 0.04);

          if (earthAlpha > 0.02 && earthX + earthR * 1.35 > rightStart - 30) {
            ctx.save();
            ctx.globalAlpha = earthAlpha;
            drawCroppedEarth(earthX, earthY, earthR, 0.6);
            ctx.restore();
          }

          drawCroppedMoon(moonX, moonY, moonR, 0.45 + 0.1 * ease);

          const lunarOrbitR = moonR * (isLunarReconOrbit ? 1.72 : 1.65);
          const alpha = (56 * Math.PI) / 180;
          const sinA = Math.sin(alpha);
          const cosA = Math.cos(alpha);
          const lunarRadStart = Math.PI - alpha;
          const lunarRadEnd = -3 * Math.PI + alpha;

          const p0 = {
            x: earthX + earthR * 1.1,
            y: earthY - earthR * 0.25,
          };
          const p3 = isLunarReconOrbit
            ? {
                x: moonX - lunarOrbitR * cosA,
                y: moonY + lunarOrbitR * sinA,
              }
            : { x: moonX + moonR * 0.16, y: moonY - moonR * 0.14 };
          const distTrans = Math.hypot(p3.x - p0.x, p3.y - p0.y);
          const p1 = { x: p0.x + (p3.x - p0.x) * 0.35, y: h * 0.24 };
          const p2 = isLunarReconOrbit
            ? {
                x: p3.x - sinA * Math.max(lunarOrbitR * 0.95, distTrans * 0.24),
                y: p3.y - cosA * Math.max(lunarOrbitR * 0.95, distTrans * 0.24),
              }
            : { x: p0.x + (p3.x - p0.x) * 0.74, y: h * 0.28 };

          ctx.save();
          ctx.globalAlpha = Math.max(0.06, 1 - ease * 0.9);
          ctx.setLineDash([7, 6]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
          ctx.stroke();
          ctx.restore();

          if (ease > 0.25) {
            ctx.save();
            ctx.globalAlpha = isLunarReconOrbit
              ? Math.min(0.72, (ease - 0.25) * 1.1)
              : Math.min(0.65, (ease - 0.25) * 1.1) * (1 - Math.max(0, ease - 0.85) * 4);
            ctx.strokeStyle = 'rgba(77, 191, 255, 0.75)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(moonX, moonY, lunarOrbitR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          if (isLunarReconOrbit && prog >= 1 / 3) {
            // Nivel 3 · MK-III: Órbita lunar G1-continua desde mEnter (lunarRadStart) hasta mLeave (lunarRadEnd)
            const orbitFrac = Math.max(
              0,
              Math.min(1, (prog - 1 / 3) / (20 / 24 - 1 / 3))
            );
            const orbAng = lunarRadStart + (lunarRadEnd - lunarRadStart) * orbitFrac;
            const ox = moonX + Math.cos(orbAng) * lunarOrbitR;
            const oy = moonY + Math.sin(orbAng) * lunarOrbitR;
            // Sentido antihorario (orbAng decrece): tangente (sin(orbAng), -cos(orbAng)), menos PI para sprite izq.
            const rawAngle = Math.atan2(-Math.cos(orbAng), Math.sin(orbAng)) - Math.PI;
            const oAngle = smoothSatAngle(rawAngle);
            const orbShipW = Math.max(48, minDim * 0.11);
            pushAndDrawTrail(ox, oy, '56, 189, 248');
            drawSprite(sprCsmIdle, ox, oy, orbShipW, oAngle, false);
            ctx.font = `600 ${Math.max(11, Math.round(h * 0.016))}px "JetBrains Mono", ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(125, 211, 252, 0.95)';
            ctx.fillText(
              langRef.current === 'en'
                ? 'MK-III · LUNAR ORBIT 110 KM (NO LANDING)'
                : 'MK-III · ÓRBITA LUNAR 110 KM (SIN ALUNIZAJE)',
              moonX,
              moonY + moonR + 28
            );
            ctx.textAlign = 'left';
          } else {
            // Progreso estrictamente hacia adelante al salir de la Tierra (sin retroceso al inicio del tránsito)
            const curveT = Math.min(1, 1 - Math.pow(1 - u, 1.32));
            const pt = cubicBezier(p0, p1, p2, p3, curveT);
            const shipW = Math.max(46, minDim * (0.095 + 0.04 * ease));
            const rawAngle = isLunarReconOrbit
              ? Math.atan2(pt.dy, pt.dx) - Math.PI
              : Math.atan2(pt.dy, pt.dx);
            const angle = isLunarReconOrbit ? smoothSatAngle(rawAngle) : rawAngle;

            if (!curOpWaiting && (isLunarReconOrbit || ease < 0.92)) {
              pushAndDrawTrail(pt.x, pt.y, '56, 189, 248');
            } else if (!isLunarReconOrbit && ease >= 0.92) {
              simRef.current.trail = [];
            }

            const approachShipAlpha = isLunarReconOrbit
              ? 1
              : Math.max(0, Math.min(1, (1 - ease) * 8));
            if (approachShipAlpha > 0.02) {
              ctx.save();
              ctx.globalAlpha = approachShipAlpha;
              const dLen = Math.hypot(pt.dx, pt.dy) || 1;
              drawThrusterPlume(
                pt.x,
                pt.y,
                -pt.dx / dLen,
                -pt.dy / dLen,
                shipW * 0.55,
                '56, 189, 248'
              );
              const shipSprite = isLunarReconOrbit ? sprCsmIdle : sprCoupled;
              if (!drawSprite(shipSprite, pt.x, pt.y, shipW, angle, false)) {
                ctx.save();
                ctx.translate(pt.x, pt.y);
                ctx.rotate(angle);
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(-10, -6, 20, 12);
                ctx.restore();
              }
              ctx.restore();
            }

            if (!isLunarReconOrbit && ease > 0.82) {
              const landerU = Math.min(1, (ease - 0.82) / 0.175);
              const landerEase = 1 - Math.pow(1 - landerU, 3);
              const dropStartX = moonX - moonR * 0.55;
              const dropStartY = moonY - moonR * 1.15;
              const lx = dropStartX + (p3.x - dropStartX) * landerEase;
              const ly = dropStartY + (p3.y - dropStartY) * landerEase;
              ctx.save();
              ctx.globalAlpha = Math.min(1, landerU * 1.4);
              if (landerU < 0.95) {
                drawThrusterPlume(lx, ly + 14, 0, 1, 18, '251, 191, 36');
              }
              drawEagleLander(lx, ly, Math.max(54, moonR * 0.25));
              ctx.restore();
            }
          }

          const en = langRef.current === 'en';
          const numLocale = en ? 'en-US' : 'es-ES';
          statusText = isLunarReconOrbit
            ? prog >= 1 / 3
              ? en
                ? `MK-III · LUNAR ORBIT RECONNAISSANCE (${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} KM/S)`
                : `MK-III · RECONOCIMIENTO EN ÓRBITA LUNAR (${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} KM/S)`
              : en
                ? `MK-III · LUNAR TRANSIT · ${Math.round(curDest.distanceKm * u).toLocaleString(numLocale)} KM`
                : `MK-III · TRÁNSITO LUNAR · ${Math.round(curDest.distanceKm * u).toLocaleString(numLocale)} KM`
            : effectiveStage === 'landing_closeup'
              ? en
                ? `LUNAR CLOSE-UP · GRAVITY ${REAL_LUNAR_PHYSICS.moonGravityMs2} M/S² · SAMPLING & HABITABILITY`
                : `PRIMER PLANO LUNAR · GRAVEDAD ${REAL_LUNAR_PHYSICS.moonGravityMs2} M/S² · RECOLECCIÓN Y HABITABILIDAD`
              : en
                ? `MK11 · FIGURE-8 TRAJECTORY (${REAL_LUNAR_PHYSICS.tliVelocityKms} KM/S) · ${Math.round(curDest.distanceKm * u).toLocaleString(numLocale)} KM`
                : `MK11 · TRAYECTORIA EN 8 (${REAL_LUNAR_PHYSICS.tliVelocityKms} KM/S) · ${Math.round(curDest.distanceKm * u).toLocaleString(numLocale)} KM`;
        } else if (
          effectiveStage === 'landing_closeup' ||
          effectiveStage === 'problem_cables' ||
          effectiveStage === 'problem_birome' ||
          effectiveStage === 'problem_oxygen'
        ) {
          // Días 2-4: SOLO LA LUNA EN PRIMER PLANO
          const moonX = rightStart + rightWidth * simRef.current.camMoonXFrac;
          const moonY = h * simRef.current.camMoonYFrac;
          const moonR = minDim * simRef.current.camMoonRFrac;

          drawCroppedMoon(moonX, moonY, moonR, 0.55);

          const eagleX = moonX + moonR * 0.16;
          const eagleY = moonY - moonR * 0.14;
          const alertColor =
            effectiveStage === 'problem_cables'
              ? '#f59e0b'
              : effectiveStage === 'problem_birome'
                ? '#f43f5e'
                : effectiveStage === 'problem_oxygen'
                  ? '#22d3ee'
                  : undefined;

          drawEagleLander(eagleX, eagleY, Math.max(54, moonR * 0.25), alertColor);

          const en = langRef.current === 'en';
          ctx.font = `600 ${Math.max(11, Math.round(h * 0.016))}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.fillStyle = alertColor ?? 'rgba(52, 211, 153, 0.95)';
          ctx.fillText(
            en ? 'EAGLE / MK11 · LUNAR SURFACE' : 'EAGLE / MK11 · SUPERFICIE LUNAR',
            eagleX + moonR * 0.16,
            eagleY - 8
          );

          statusText =
            effectiveStage === 'problem_cables'
              ? en
                ? 'LUNAR CLOSE-UP · ELECTRICAL FAULT IN MK11 MODULE'
                : 'PRIMER PLANO LUNAR · FALLA ELÉCTRICA EN EL MÓDULO MK11'
              : effectiveStage === 'problem_birome'
                ? en
                  ? 'LUNAR CLOSE-UP · ENGINE BREAKER SNAPPED (FIND PEN)'
                  : 'PRIMER PLANO LUNAR · PALANCA DEL MOTOR ROTA (BUSCAR BIROME)'
                : effectiveStage === 'problem_oxygen'
                  ? en
                    ? 'LUNAR CLOSE-UP · OXYGEN (O₂) LEAK IN EAGLE CABIN'
                    : 'PRIMER PLANO LUNAR · FUGA DE OXÍGENO (O₂) EN CABINA DEL EAGLE'
                  : en
                    ? `LUNAR CLOSE-UP · GRAVITY ${REAL_LUNAR_PHYSICS.moonGravityMs2} M/S² · SAMPLING & HABITABILITY`
                    : `PRIMER PLANO LUNAR · GRAVEDAD ${REAL_LUNAR_PHYSICS.moonGravityMs2} M/S² · RECOLECCIÓN Y HABITABILIDAD`;
        } else if (effectiveStage === 'ascent_docking') {
          // Día 5a: Subida fluida desde la Luna hasta el módulo de retorno en órbita
          const moonX = rightStart + rightWidth * simRef.current.camMoonXFrac;
          const moonY = h * simRef.current.camMoonYFrac;
          const moonR = minDim * simRef.current.camMoonRFrac;
          drawCroppedMoon(moonX, moonY, moonR, 0.5);

          const dockElapsed = simRef.current.opStageTimeSec;
          const csmGlide = 1 - Math.exp(-dockElapsed * 1.4);
          const columbiaX = rightStart + rightWidth * (0.56 + 0.08 * csmGlide);
          const columbiaY = h * (0.24 + 0.04 * csmGlide) + Math.sin(tSec * 0.9) * 2.5;
          const csmW = Math.max(66, minDim * 0.14);

          drawSprite(sprCsmIdle, columbiaX, columbiaY, csmW, 0, false);

          const launchX = moonX - moonR * 0.28;
          const launchY = moonY - moonR * 0.72;
          const dockWaitX = columbiaX - csmW * 0.82;
          const dockWaitY = columbiaY + 6;
          const arcCtrlX = rightStart + rightWidth * 0.36;
          const arcCtrlY = h * 0.30;

          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(launchX, launchY);
          ctx.quadraticCurveTo(arcCtrlX, arcCtrlY, dockWaitX, dockWaitY);
          ctx.stroke();
          ctx.restore();

          // Smooth single ascent from Moon surface to station-keeping beside CSM (no jarring oscillation)
          const rawAsc = Math.min(1, dockElapsed / 2.8);
          const ascEase = 1 - Math.pow(1 - rawAsc, 3);
          const invA = 1 - ascEase;
          const floatX = rawAsc >= 0.95 ? Math.sin(tSec * 1.2) * 2.0 : 0;
          const floatY = rawAsc >= 0.95 ? Math.cos(tSec * 1.0) * 1.8 : 0;
          const ex = invA * invA * launchX + 2 * invA * ascEase * arcCtrlX + ascEase * ascEase * dockWaitX + floatX;
          const ey = invA * invA * launchY + 2 * invA * ascEase * arcCtrlY + ascEase * ascEase * dockWaitY + floatY;

          if (rawAsc < 0.92) {
            drawThrusterPlume(ex, ey + 14, 0, 1, 20, '251, 191, 36');
          }
          drawEagleLander(ex, ey, Math.max(46, minDim * 0.1), '#38bdf8');

          const en = langRef.current === 'en';
          ctx.font = `600 ${Math.max(11, Math.round(h * 0.016))}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.fillStyle = 'rgba(147, 197, 253, 0.95)';
          ctx.fillText(
            en ? 'MK11 RETURN MODULE' : 'MÓDULO RETORNO MK11',
            columbiaX - csmW * 0.65,
            columbiaY - csmW * 0.42
          );
          ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
          ctx.fillText(
            en ? 'EAGLE / MK11 (ASCENT)' : 'EAGLE / MK11 (ASCENSO)',
            ex - 55,
            ey + 44
          );

          statusText = en
            ? `LUNAR ORBIT (${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} KM/S) · LUNAR ESCAPE ${REAL_LUNAR_PHYSICS.lunarEscapeVelocityKms} KM/S`
            : `ÓRBITA LUNAR (${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} KM/S) · ESCAPE LUNAR ${REAL_LUNAR_PHYSICS.lunarEscapeVelocityKms} KM/S`;
        } else {
          // Día 5b / MK-III retorno: Regreso hacia el océano Pacífico
          const earthX = rightStart + rightWidth * 0.22;
          const earthY = h * 0.50;
          const earthR = minDim * 0.14;
          const moonX = rightStart + rightWidth * simRef.current.camMoonXFrac;
          const moonY = h * simRef.current.camMoonYFrac;
          const moonR = minDim * simRef.current.camMoonRFrac;

          const dprOpRet = window.devicePixelRatio || 1;
          const retSunX = Math.max(
            rightStart + Math.min(rightWidth * 0.42, 372 * dprOpRet),
            rightStart + rightWidth * 0.275
          );
          drawPixelSun(retSunX, h * 0.135, minDim * 0.042);
          drawCroppedMoon(moonX, moonY, moonR);

          drawCroppedEarth(earthX, earthY, earthR, 0.65);

          // Return path matching the clean G1-continuous geometry
          const fig8Ret = buildFigure8Geometry(
            earthX,
            earthY,
            earthR,
            moonX,
            moonY,
            moonR
          );

          ctx.save();
          ctx.setLineDash([7, 6]);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.78)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(fig8Ret.ret1.p0.x, fig8Ret.ret1.p0.y);
          ctx.bezierCurveTo(
            fig8Ret.ret1.p1.x,
            fig8Ret.ret1.p1.y,
            fig8Ret.ret1.p2.x,
            fig8Ret.ret1.p2.y,
            fig8Ret.ret1.p3.x,
            fig8Ret.ret1.p3.y
          );
          ctx.bezierCurveTo(
            fig8Ret.ret2.p1.x,
            fig8Ret.ret2.p1.y,
            fig8Ret.ret2.p2.x,
            fig8Ret.ret2.p2.y,
            fig8Ret.ret2.p3.x,
            fig8Ret.ret2.p3.y
          );
          ctx.stroke();
          ctx.restore();

          const retU = isLunarReconOrbit
            ? Math.max(0, Math.min(1, (prog - 20 / 24) / (4 / 24)))
            : Math.max(0, Math.min(1, (prog - 0.85) / 0.15));
          const pt = fig8Ret.evalReturn(retU);
          pushAndDrawTrail(pt.x, pt.y, '245, 158, 11');
          const rawRetAngle = Math.atan2(pt.dy, pt.dx) - Math.PI;
          const angle = smoothSatAngle(rawRetAngle);
          drawSprite(sprCsmFlame, pt.x, pt.y, Math.max(54, minDim * 0.11), angle, false);

          const en = langRef.current === 'en';
          const labelFont = `600 ${Math.max(11, Math.round(h * 0.016))}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.font = labelFont;
          ctx.fillStyle = 'rgba(147, 197, 253, 0.92)';
          ctx.textAlign = 'center';
          ctx.fillText(en ? 'EARTH · PACIFIC' : 'TIERRA · PACÍFICO', earthX, earthY + earthR + 20);
          ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
          ctx.fillText(en ? 'MOON' : 'LUNA', moonX, moonY + moonR + 20);
          ctx.textAlign = 'left';

          statusText =
            retU > 0.85
              ? `${isLunarReconOrbit ? 'MK-III' : 'MK11'} · ${en ? 'SPLASHDOWN IN THE PACIFIC OCEAN' : 'AMERIZAJE EN EL OCÉANO PACÍFICO'}`
              : `${isLunarReconOrbit ? 'MK-III' : 'MK11'} · ${en ? 'RETURN TO EARTH' : 'RETORNO HACIA LA TIERRA'} (${REAL_LUNAR_PHYSICS.tliVelocityKms} KM/S)`;
        }

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `600 ${Math.max(11, Math.round(h * 0.017))}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.fillText(statusText, rightStart + 18, h - 18);

        if (curOnTelemetry && now - lastTelemetryPush > 60) {
          lastTelemetryPush = now;
          curOnTelemetry({
            periodMinutes: curDest.periodMinutes,
            eclipseMinutes: curDest.eclipseMinutes,
            simTimeMinutes: simRef.current.simTimeMinutes,
            distanceFromEarthKm: curDest.distanceKm,
            tripPhaseName: statusText,
            inEclipse: false,
            batteryWh: curCap,
            batteryCapacityWh: curCap,
            generationW: curSolar + curRtg,
            consumptionW: curCons,
            powerFailure: false,
            lightingPhaseName: langRef.current === 'en' ? 'Active operation' : 'Operación activa',
          });
        }
      }

      // Apply post-processing pipeline (multi-scale bloom, anamorphic star/sun flare, grading, vignette, anti-banding grain)
      pipeline.apply(ctx, canvas, {
        preset: 'space',
        bloomStrength: 0.50,
        thresholdPasses: 2,
        anamorphicStrength: 0.20,
        vignetteStrength: 0.46,
        grainStrength: 0.038,
        gradeStrength: 0.34,
      });

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
