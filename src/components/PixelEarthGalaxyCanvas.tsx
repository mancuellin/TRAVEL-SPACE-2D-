import React, { useEffect, useRef } from 'react';
import { SPACE_BG_SRC, StarDot, drawAnimatedSpaceBackground } from './AnimatedSpaceBg';
import { PostProcessPipeline } from '../utils/postProcess';

interface PixelEarthGalaxyCanvasProps {
  highlightColor?: string;
  accentColor?: string;
}

const TEX_W = 512;
const TEX_H = 256;
const GLOBE_PX = 144; // Crisp 144x144 pixel-art sphere buffer scaled up with nearest-neighbor

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Deterministic 2D hash & value noise for procedural pixel-art Moon maria, highlands & craters
function hash2(ix: number, iy: number, seed: number): number {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function tileNoise(u: number, v: number, periodX: number, periodY: number, seed: number): number {
  const x = ((u % periodX) + periodX) % periodX;
  const y = Math.max(0, Math.min(periodY - 0.001, v));
  const x0 = Math.floor(x) % periodX;
  const x1 = (x0 + 1) % periodX;
  const y0 = Math.floor(y);
  const y1 = Math.min(periodY - 1, y0 + 1);
  const fx = x - Math.floor(x);
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbmWrap(u01: number, v01: number, baseFreqX: number, baseFreqY: number, seed: number): number {
  let val = 0;
  let amp = 0.5;
  let fx = baseFreqX;
  let fy = baseFreqY;
  for (let o = 0; o < 4; o++) {
    val += amp * tileNoise(u01 * fx, v01 * fy, fx, fy, seed + o * 31);
    fx *= 2;
    fy *= 2;
    amp *= 0.5;
  }
  return val;
}

// Lunar Maria (dark basaltic seas) mask matching recognizable near-side & far-side lunar basins
function lunarMariaMask(lonDeg: number, latDeg: number): number {
  const maria: Array<[number, number, number, number, number]> = [
    // Oceanus Procellarum
    [-46, 16, 26, 28, 0.52],
    // Mare Imbrium
    [-18, 34, 18, 16, 0.54],
    // Mare Serenitatis
    [18, 28, 14, 13, 0.50],
    // Mare Tranquillitatis (MK11 landing region)
    [30, 8, 15, 12, 0.52],
    // Mare Fecunditatis
    [52, -6, 11, 13, 0.44],
    // Mare Crisium
    [58, 17, 8, 7, 0.48],
    // Mare Nubium & Humorum
    [-18, -21, 16, 13, 0.45],
    [-38, -24, 9, 8, 0.42],
    // Mare Moscoviense & Orientale (far side basins)
    [146, 26, 12, 11, 0.44],
    [-95, -19, 13, 12, 0.42],
    [122, -32, 16, 13, 0.36],
  ];

  let boost = 0;
  for (const [cx, cy, rx, ry, w] of maria) {
    let dl = lonDeg - cx;
    if (dl > 180) dl -= 360;
    if (dl < -180) dl += 360;
    const dx = dl / rx;
    const dy = (latDeg - cy) / ry;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1.35) {
      boost = Math.max(boost, w * (1 - d2 / 1.35));
    }
  }
  return boost;
}

interface MoonCrater {
  lonDeg: number;
  latDeg: number;
  radiusDeg: number;
  hasRays: boolean;
}

function buildMoonCraters(): MoonCrater[] {
  const craters: MoonCrater[] = [
    { lonDeg: -11, latDeg: -43, radiusDeg: 7.5, hasRays: true }, // Tycho
    { lonDeg: -20, latDeg: 10, radiusDeg: 6.8, hasRays: true }, // Copernicus
    { lonDeg: -38, latDeg: 8, radiusDeg: 4.5, hasRays: true }, // Kepler
    { lonDeg: -9, latDeg: 51, radiusDeg: 5.5, hasRays: false }, // Plato
    { lonDeg: 35, latDeg: -38, radiusDeg: 6.0, hasRays: false },
    { lonDeg: 112, latDeg: 18, radiusDeg: 7.2, hasRays: true },
    { lonDeg: -138, latDeg: -28, radiusDeg: 8.0, hasRays: false },
    { lonDeg: 162, latDeg: -14, radiusDeg: 6.5, hasRays: true },
  ];

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 64; i++) {
    craters.push({
      lonDeg: rand() * 360 - 180,
      latDeg: (rand() * 2 - 1) * 74,
      radiusDeg: 2.2 + rand() * 4.8,
      hasRays: false,
    });
  }
  return craters;
}

interface MoonTextures {
  dayRgba: Uint8ClampedArray;
  nightRgba: Uint8ClampedArray;
}

function buildMoonTextures(): MoonTextures {
  const dayRgba = new Uint8ClampedArray(TEX_W * TEX_H * 4);
  const nightRgba = new Uint8ClampedArray(TEX_W * TEX_H * 4);
  const craters = buildMoonCraters();

  for (let y = 0; y < TEX_H; y++) {
    const v01 = y / (TEX_H - 1);
    const latDeg = 90 - v01 * 180;
    const cosLat = Math.max(0.28, Math.cos((latDeg * Math.PI) / 180));

    for (let x = 0; x < TEX_W; x++) {
      const u01 = x / TEX_W;
      const lonDeg = u01 * 360 - 180;

      const mareMask = lunarMariaMask(lonDeg, latDeg);
      const macroNoise = fbmWrap(u01, v01, 6, 3, 211);
      const microNoise = fbmWrap(u01, v01, 20, 10, 419);
      const regolith = macroNoise * 0.62 + microNoise * 0.38;

      // Base stepped lunar regolith value (0 = deep basalt mare, 1 = bright highland)
      let lum = 0.62 + (regolith - 0.5) * 0.36 - mareMask * 0.72;

      // Apply pixel-art craters (dark inner floor + sunlit rim highlight)
      for (let c = 0; c < craters.length; c++) {
        const cr = craters[c];
        let dl = lonDeg - cr.lonDeg;
        if (dl > 180) dl -= 360;
        if (dl < -180) dl += 360;
        const dx = dl * cosLat;
        const dy = latDeg - cr.latDeg;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = cr.radiusDeg;

        if (dist < r * 1.25) {
          const rn = dist / r;
          if (rn < 0.72) {
            // Crater floor shadow (stronger toward top-left inner wall)
            const shadowBias = (-dx - dy) / Math.max(0.1, r);
            lum -= 0.16 + Math.max(0, shadowBias) * 0.08;
          } else if (rn < 1.05) {
            // Raised crater rim (brighter on sunlit side)
            const rimSun = (-dx - dy) / Math.max(0.1, r);
            lum += rimSun > 0 ? 0.19 : -0.10;
          }
        } else if (cr.hasRays && dist < r * 3.8) {
          const ang = Math.atan2(dy, dx);
          const ray = Math.sin(ang * 7 + c) * Math.cos(ang * 4 - c);
          if (ray > 0.45) {
            lum += (1 - dist / (r * 3.8)) * 0.16;
          }
        }
      }

      // Quantize to crisp pixel-art lunar grey-blue palette
      let dr: number;
      let dg: number;
      let db: number;
      if (lum > 0.74) {
        dr = 232;
        dg = 237;
        db = 245;
      } else if (lum > 0.58) {
        dr = 196;
        dg = 204;
        db = 216;
      } else if (lum > 0.43) {
        dr = 152;
        dg = 162;
        db = 178;
      } else if (lum > 0.30) {
        dr = 112;
        dg = 123;
        db = 140;
      } else if (lum > 0.18) {
        dr = 82;
        dg = 92;
        db = 110;
      } else {
        dr = 58;
        dg = 67;
        db = 84;
      }

      const idx = (y * TEX_W + x) * 4;
      dayRgba[idx] = dr;
      dayRgba[idx + 1] = dg;
      dayRgba[idx + 2] = db;
      dayRgba[idx + 3] = 255;

      // Subtle cool earthshine on the night hemisphere
      nightRgba[idx] = Math.round(dr * 0.12 + 8);
      nightRgba[idx + 1] = Math.round(dg * 0.14 + 10);
      nightRgba[idx + 2] = Math.round(db * 0.20 + 16);
      nightRgba[idx + 3] = 255;
    }
  }

  return { dayRgba, nightRgba };
}

interface SpherePixel {
  offset: number;
  px: number;
  py: number;
  uBase: number;
  vIdx: number;
  sunLight: number;
  r2: number;
}

function buildSphereLUT(): SpherePixel[] {
  const pixels: SpherePixel[] = [];
  const half = GLOBE_PX / 2;
  const radius = half - 2;
  const tilt = 0.24;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  // Sun coming from upper-left/front-left for dramatic lunar crater relief & crescent lighting
  const lx = -0.64;
  const ly = -0.28;
  const lz = 0.715;

  for (let py = 0; py < GLOBE_PX; py++) {
    for (let px = 0; px < GLOBE_PX; px++) {
      const nx = (px + 0.5 - half) / radius;
      const ny = (py + 0.5 - half) / radius;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1.0) continue;

      const nz = Math.sqrt(Math.max(0, 1.0 - r2));
      const sunLight = nx * lx + ny * ly + nz * lz;

      // Apply axial tilt around X-axis
      const ty = ny * cosT - nz * sinT;
      const tz = ny * sinT + nz * cosT;
      const tx = nx;

      const lon = Math.atan2(tx, tz); // -PI..PI
      const lat = Math.asin(Math.max(-1, Math.min(1, ty))); // -PI/2..PI/2

      const uBase = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * TEX_W) % TEX_W;
      const vIdx = Math.max(0, Math.min(TEX_H - 1, Math.floor(((lat + Math.PI / 2) / Math.PI) * (TEX_H - 1))));

      pixels.push({
        offset: (py * GLOBE_PX + px) * 4,
        px,
        py,
        uBase,
        vIdx,
        sunLight,
        r2,
      });
    }
  }

  return pixels;
}

export const PixelEarthGalaxyCanvas: React.FC<PixelEarthGalaxyCanvasProps> = ({
  highlightColor = '#38bdf8',
  accentColor = '#f59e0b',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef({ highlightColor, accentColor });
  colorsRef.current = { highlightColor, accentColor };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgBg = new Image();
    imgBg.src = SPACE_BG_SRC;

    const textures = buildMoonTextures();
    const sphereLUT = buildSphereLUT();

    const pipeline = new PostProcessPipeline();

    const globeCanvas = document.createElement('canvas');
    globeCanvas.width = GLOBE_PX;
    globeCanvas.height = GLOBE_PX;
    const globeCtx = globeCanvas.getContext('2d');
    if (!globeCtx) return;
    const globeImgData = globeCtx.createImageData(GLOBE_PX, GLOBE_PX);

    // Rich galaxy starfield with hero diffraction stars
    const stars: StarDot[] = [];
    let seed = 42;
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
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: rand(),
        y: rand(),
        phase: rand() * 6.28,
        size: i % 7 === 0 ? 3 : 2,
        speed: 0.35 + rand() * 0.9,
        tint: tints[i % tints.length],
        isHero: i % 12 === 0,
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
    const tick = (now: number) => {
      const tSec = now / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio || 1;

      // 1. Galaxy background + drifting stars + meteor
      drawAnimatedSpaceBackground(ctx, w, h, tSec, imgBg, stars, 0.92, 0.85);

      // Subtle deep galaxy nebula wash behind the Moon
      const nebGrad = ctx.createRadialGradient(
        w * 0.62,
        h * 0.48,
        w * 0.04,
        w * 0.62,
        h * 0.48,
        Math.max(w, h) * 0.68
      );
      nebGrad.addColorStop(0, 'rgba(148, 163, 184, 0.16)');
      nebGrad.addColorStop(0.42, 'rgba(30, 58, 138, 0.14)');
      nebGrad.addColorStop(1, 'rgba(4, 6, 14, 0.56)');
      ctx.fillStyle = nebGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle distant solar flare on upper-left limb direction
      const sunGlint = ctx.createRadialGradient(
        w * 0.14,
        h * 0.20,
        2,
        w * 0.14,
        h * 0.20,
        Math.max(w, h) * 0.28
      );
      sunGlint.addColorStop(0, 'rgba(255, 245, 210, 0.18)');
      sunGlint.addColorStop(0.35, 'rgba(125, 211, 252, 0.06)');
      sunGlint.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGlint;
      ctx.fillRect(0, 0, w, h);

      // 2. Render rotating 3D pixel-art Moon into 144x144 pixel buffer with ordered Bayer dithering
      const data = globeImgData.data;
      data.fill(0);

      const rotShift = Math.floor(tSec * 6.5) % TEX_W;

      for (let i = 0; i < sphereLUT.length; i++) {
        const p = sphereLUT[i];
        const ux = (p.uBase + rotShift) % TEX_W;
        const texIdx = p.vIdx * TEX_W + ux;
        const rgbaIdx = texIdx * 4;
        const bayer = (BAYER_4X4[p.py & 3][p.px & 3] / 16 - 0.5) * 0.14;
        const lit = p.sunLight + bayer;

        let r: number;
        let g: number;
        let b: number;

        if (lit > 0.24) {
          // Bright sunlit lunar surface
          r = textures.dayRgba[rgbaIdx];
          g = textures.dayRgba[rgbaIdx + 1];
          b = textures.dayRgba[rgbaIdx + 2];
        } else if (lit > 0.04) {
          // Mid-terminator gradient band
          r = Math.round(textures.dayRgba[rgbaIdx] * 0.62 + 8);
          g = Math.round(textures.dayRgba[rgbaIdx + 1] * 0.64 + 10);
          b = Math.round(textures.dayRgba[rgbaIdx + 2] * 0.70 + 16);
        } else if (lit > -0.10) {
          // Deep twilight terminator band
          r = Math.round(textures.dayRgba[rgbaIdx] * 0.30 + 10);
          g = Math.round(textures.dayRgba[rgbaIdx + 1] * 0.33 + 13);
          b = Math.round(textures.dayRgba[rgbaIdx + 2] * 0.42 + 20);
        } else {
          // Night hemisphere illuminated gently by cool blue Earthshine
          r = textures.nightRgba[rgbaIdx];
          g = textures.nightRgba[rgbaIdx + 1];
          b = Math.min(255, textures.nightRgba[rgbaIdx + 2] + 8);
        }

        // Smooth sunlit lunar limb scattering & subtle shadow rim (no jagged snap)
        if (p.r2 > 0.86) {
          const edgeK = Math.max(0, Math.min(1, (p.r2 - 0.86) / 0.14));
          const sunRimK = Math.max(0, Math.min(1, (p.sunLight + 0.18) / 0.55));
          const rimMix = edgeK * sunRimK * 0.65;
          r = Math.round(r + (242 - r) * rimMix);
          g = Math.round(g + (246 - g) * rimMix);
          b = Math.round(b + (255 - b) * rimMix);
        }

        // Anti-aliased outer pixel edge for crisp, artifact-free silhouette
        const edgeAlpha = p.r2 > 0.96 ? Math.round(255 * Math.max(0.25, (1.0 - p.r2) / 0.04)) : 255;

        data[p.offset] = r;
        data[p.offset + 1] = g;
        data[p.offset + 2] = b;
        data[p.offset + 3] = edgeAlpha;
      }

      globeCtx.putImageData(globeImgData, 0, 0);

      // Position Moon center-right on wide screens, center on narrow screens
      const isWide = w / Math.max(1, dpr) >= 900;
      const globeScreenSize = Math.round(
        Math.min(w, h) * (isWide ? 0.62 : 0.46)
      );
      const gx = Math.round(w * (isWide ? 0.63 : 0.5) - globeScreenSize / 2);
      const gy = Math.round(h * (isWide ? 0.51 : 0.46) - globeScreenSize / 2);
      const moonCx = gx + globeScreenSize * 0.5;
      const moonCy = gy + globeScreenSize * 0.5;
      const moonVisR = globeScreenSize * 0.485;

      // Soft silver-pearl & sapphire lunar halo behind the pixel Moon
      const haloX = gx + globeScreenSize * 0.46;
      const haloY = gy + globeScreenSize * 0.47;
      const halo = ctx.createRadialGradient(
        haloX,
        haloY,
        globeScreenSize * 0.35,
        haloX,
        haloY,
        globeScreenSize * 0.78
      );
      halo.addColorStop(0, 'rgba(226, 232, 240, 0.28)');
      halo.addColorStop(0.45, 'rgba(125, 211, 252, 0.11)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(haloX, haloY, globeScreenSize * 0.78, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting light geometry (3D tilted orbit with true Moon occlusion)
      const satAngle = tSec * 0.46;
      const orbitRx = globeScreenSize * 0.64;
      const orbitRy = globeScreenSize * 0.17;
      const orbitTilt = -0.18;
      const cosTilt = Math.cos(orbitTilt);
      const sinTilt = Math.sin(orbitTilt);

      const evalOrbitLight = (ang: number) => {
        const lx = Math.cos(ang) * orbitRx;
        const ly = Math.sin(ang) * orbitRy;
        const x = moonCx + lx * cosTilt - ly * sinTilt;
        const y = moonCy + lx * sinTilt + ly * cosTilt;
        const inFront = Math.sin(ang) >= 0;
        const distFromMoon = Math.hypot(x - moonCx, y - moonCy);
        const occluded = !inFront && distFromMoon < moonVisR;
        return { x, y, inFront, occluded };
      };

      const drawOrbitLightPass = (drawBackPass: boolean) => {
        const pulse = 0.85 + 0.15 * Math.sin(tSec * 4.2);
        const tailSteps = 14;
        // Soft fading orbital wake
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let s = tailSteps; s >= 1; s--) {
          const frac = 1 - s / (tailSteps + 1);
          const p0 = evalOrbitLight(satAngle - s * 0.032);
          const p1 = evalOrbitLight(satAngle - (s - 1) * 0.032);
          if (p0.inFront !== drawBackPass && p1.inFront !== drawBackPass) {
            if (p0.occluded && p1.occluded) continue;
            ctx.strokeStyle = `rgba(253, 230, 138, ${(frac * frac * 0.35).toFixed(3)})`;
            ctx.lineWidth = Math.max(1.4, (1.2 + frac * 1.8) * dpr);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
        }

        // Pure luminous orbiting beacon light (no boxy sprite)
        const head = evalOrbitLight(satAngle);
        if (head.inFront !== drawBackPass && !head.occluded) {
          const glowR = Math.max(12, 13 * dpr) * pulse;
          const glint = ctx.createRadialGradient(head.x, head.y, 0.5, head.x, head.y, glowR);
          glint.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
          glint.addColorStop(0.22, 'rgba(254, 240, 138, 0.72)');
          glint.addColorStop(0.55, 'rgba(125, 211, 252, 0.24)');
          glint.addColorStop(1, 'rgba(125, 211, 252, 0)');
          ctx.fillStyle = glint;
          ctx.beginPath();
          ctx.arc(head.x, head.y, glowR, 0, Math.PI * 2);
          ctx.fill();

          // Tiny delicate 4-point starlight cross-flare
          const arm = Math.max(5, 5.5 * dpr) * pulse;
          ctx.strokeStyle = 'rgba(255, 251, 235, 0.78)';
          ctx.lineWidth = Math.max(1, 1.1 * dpr);
          ctx.beginPath();
          ctx.moveTo(head.x - arm, head.y);
          ctx.lineTo(head.x + arm, head.y);
          ctx.moveTo(head.x, head.y - arm);
          ctx.lineTo(head.x, head.y + arm);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(head.x, head.y, Math.max(1.8, 2.0 * dpr), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      // Behind-Moon pass
      drawOrbitLightPass(true);

      // Draw crisp nearest-neighbor pixel Moon
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(globeCanvas, gx, gy, globeScreenSize, globeScreenSize);
      ctx.restore();

      // In-front-of-Moon pass
      drawOrbitLightPass(false);

      // Gentle bottom scrim for menu text contrast (no heavy top/bottom crushing)
      const vignette = ctx.createLinearGradient(0, 0, 0, h);
      vignette.addColorStop(0, 'rgba(6, 8, 15, 0.34)');
      vignette.addColorStop(0.30, 'rgba(6, 8, 15, 0)');
      vignette.addColorStop(0.72, 'rgba(6, 8, 15, 0.08)');
      vignette.addColorStop(1, 'rgba(6, 8, 15, 0.72)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // Post-processing pipeline (multi-scale bloom, anamorphic glint, filmic grading, vignette, grain)
      pipeline.apply(ctx, canvas, {
        preset: 'space',
        bloomStrength: 0.54,
        thresholdPasses: 2,
        anamorphicStrength: 0.22,
        vignetteStrength: 0.36,
        grainStrength: 0.036,
        gradeStrength: 0.32,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};
