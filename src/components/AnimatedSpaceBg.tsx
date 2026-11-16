import React, { useEffect, useRef } from 'react';
import { PostProcessPipeline } from '../utils/postProcess';

export const SPACE_BG_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_13.56.23_96360910.jpeg';

export interface StarDot {
  x: number;
  y: number;
  phase: number;
  size: number;
  speed: number;
  tint?: string;
  isHero?: boolean;
}

const STAR_TINTS = [
  '255, 255, 255', // Pure white
  '196, 228, 255', // O/B blue-white
  '255, 244, 214', // G warm ivory
  '254, 215, 170', // K soft gold
  '224, 231, 255', // A crisp ice-blue
];

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function hash2(ix: number, iy: number, seed: number): number {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function tileNoise(
  u: number,
  v: number,
  periodX: number,
  periodY: number,
  seed: number
): number {
  const x = ((u % periodX) + periodX) % periodX;
  const y = ((v % periodY) + periodY) % periodY;
  const x0 = Math.floor(x) % periodX;
  const x1 = (x0 + 1) % periodX;
  const y0 = Math.floor(y) % periodY;
  const y1 = (y0 + 1) % periodY;
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
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

function fbmToroidal(
  u01: number,
  v01: number,
  baseFreqX: number,
  baseFreqY: number,
  seed: number
): number {
  let val = 0;
  let amp = 0.52;
  let fx = baseFreqX;
  let fy = baseFreqY;
  for (let o = 0; o < 4; o++) {
    val += amp * tileNoise(u01 * fx, v01 * fy, fx, fy, seed + o * 59);
    fx *= 2;
    fy *= 2;
    amp *= 0.48;
  }
  return val;
}

let cachedNebulaCanvas: HTMLCanvasElement | null = null;
let cachedFarStars:
  | Array<{ x: number; y: number; size: number; tint: string; alpha: number }>
  | null = null;

function getSeamlessNebulaCanvas(): HTMLCanvasElement {
  if (cachedNebulaCanvas) return cachedNebulaCanvas;
  const nw = 480;
  const nh = 270;
  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const nctx = canvas.getContext('2d');
  if (!nctx) return canvas;

  const img = nctx.createImageData(nw, nh);
  const d = img.data;

  for (let y = 0; y < nh; y++) {
    const v01 = y / nh;
    for (let x = 0; x < nw; x++) {
      const u01 = x / nw;

      // Seamless periodic galactic band diagonal wave
      const diag = Math.sin((u01 + v01) * Math.PI * 2) * 0.5 + 0.5;
      const n1 = fbmToroidal(u01, v01, 4, 3, 101);
      const n2 = fbmToroidal(u01 + 0.37, v01 + 0.19, 6, 4, 313);
      const rift = fbmToroidal(u01, v01, 8, 5, 739);

      const band = Math.max(0, Math.min(1, diag * 0.48 + n1 * 0.65 - 0.18));
      const dustCut = rift > 0.54 ? Math.max(0.28, 1 - (rift - 0.54) * 2.1) : 1;
      const neb = Math.pow(band, 1.55) * dustCut;
      const cyanWisp = Math.pow(Math.max(0, n2 - 0.42) * 1.85, 1.6) * dustCut;

      // Subtle ordered Bayer dither to keep pixel-art character with smooth gradients
      const bayer = (BAYER_4X4[y & 3][x & 3] / 16 - 0.5) * 4.5;

      const r = Math.max(
        3,
        Math.min(255, Math.round(5 + neb * 24 + cyanWisp * 14 + bayer))
      );
      const g = Math.max(
        5,
        Math.min(255, Math.round(7 + neb * 28 + cyanWisp * 44 + bayer))
      );
      const b = Math.max(
        13,
        Math.min(255, Math.round(16 + neb * 72 + cyanWisp * 82 + bayer))
      );

      const idx = (y * nw + x) * 4;
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;
    }
  }
  nctx.putImageData(img, 0, 0);
  cachedNebulaCanvas = canvas;
  return canvas;
}

function getFarStars() {
  if (cachedFarStars) return cachedFarStars;
  const list: Array<{
    x: number;
    y: number;
    size: number;
    tint: string;
    alpha: number;
  }> = [];
  let seed = 8081;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 180; i++) {
    list.push({
      x: rand(),
      y: rand(),
      size: i % 9 === 0 ? 2 : 1.5,
      tint: STAR_TINTS[i % STAR_TINTS.length],
      alpha: 0.25 + rand() * 0.5,
    });
  }
  cachedFarStars = list;
  return list;
}

const seamlessTileCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

function getSeamlessStarfieldTile(img: HTMLImageElement): HTMLCanvasElement {
  const cached = seamlessTileCache.get(img);
  if (cached) return cached;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const padX = Math.max(24, Math.floor(iw * 0.16));
  const padY = Math.max(24, Math.floor(ih * 0.16));
  const tw = Math.max(64, iw - padX);
  const th = Math.max(64, ih - padY);

  // Bake toroidal seamless tile by cross-fading overlapping margin strips
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const tctx = c.getContext('2d');
  if (!tctx) return c;

  tctx.drawImage(img, 0, 0, tw, th, 0, 0, tw, th);
  const dstData = tctx.getImageData(0, 0, tw, th);
  const dst = dstData.data;

  const fullC = document.createElement('canvas');
  fullC.width = iw;
  fullC.height = ih;
  const fctx = fullC.getContext('2d');
  if (fctx) {
    fctx.drawImage(img, 0, 0);
    const src = fctx.getImageData(0, 0, iw, ih).data;

    // Horizontal wrap blend over [0 .. padX)
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < padX; x++) {
        const t = x / padX;
        const smooth = t * t * (3 - 2 * t);
        const di = (y * tw + x) * 4;
        const si = (y * iw + (tw + x)) * 4;
        dst[di] = Math.round(src[si] * (1 - smooth) + dst[di] * smooth);
        dst[di + 1] = Math.round(src[si + 1] * (1 - smooth) + dst[di + 1] * smooth);
        dst[di + 2] = Math.round(src[si + 2] * (1 - smooth) + dst[di + 2] * smooth);
      }
    }
    // Vertical wrap blend over [0 .. padY)
    for (let y = 0; y < padY; y++) {
      const t = y / padY;
      const smooth = t * t * (3 - 2 * t);
      for (let x = 0; x < tw; x++) {
        const di = (y * tw + x) * 4;
        const si = ((th + y) * iw + x) * 4;
        dst[di] = Math.round(src[si] * (1 - smooth) + dst[di] * smooth);
        dst[di + 1] = Math.round(src[si + 1] * (1 - smooth) + dst[di + 1] * smooth);
        dst[di + 2] = Math.round(src[si + 2] * (1 - smooth) + dst[di + 2] * smooth);
      }
    }
    tctx.putImageData(dstData, 0, 0);
  }

  seamlessTileCache.set(img, c);
  return c;
}

export function drawAnimatedSpaceBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tSec: number,
  imgBg: HTMLImageElement,
  stars: StarDot[],
  alpha = 0.9,
  driftMultiplier = 1
) {
  // 1. Deep cosmic obsidian base
  ctx.fillStyle = '#04060e';
  ctx.fillRect(0, 0, w, h);

  // 2. Seamless procedural Milky Way nebula backdrop (zero mirror seams!)
  const nebCanvas = getSeamlessNebulaCanvas();
  const nebTileW = Math.max(w, h * (16 / 9));
  const nebTileH = nebTileW * (9 / 16);
  const nebScrollX = (((tSec * 6 * driftMultiplier) % nebTileW) + nebTileW) % nebTileW;
  const nebScrollY = (((tSec * 2 * driftMultiplier) % nebTileH) + nebTileH) % nebTileH;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * 0.95);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  for (let nx = -nebScrollX; nx < w; nx += nebTileW) {
    for (let ny = -nebScrollY; ny < h; ny += nebTileH) {
      ctx.drawImage(nebCanvas, nx, ny, nebTileW + 1, nebTileH + 1);
    }
  }
  ctx.restore();

  // 3. Softly blend seamlessly wrapped starry nebula texture (no mirror symmetry or seams)
  if (imgBg.complete && imgBg.naturalWidth > 0) {
    const tile = getSeamlessStarfieldTile(imgBg);
    const aspect = tile.width / Math.max(1, tile.height);
    const viewAspect = w / Math.max(1, h);
    let tileW = w;
    let tileH = h;
    if (viewAspect > aspect) {
      tileW = w * 1.15;
      tileH = tileW / aspect;
    } else {
      tileH = h * 1.15;
      tileW = tileH * aspect;
    }

    const scrollX = (((tSec * 10 * driftMultiplier) % tileW) + tileW) % tileW;
    const scrollY = (((tSec * 3.5 * driftMultiplier) % tileH) + tileH) % tileH;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha * 0.46;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    for (let dx = -scrollX; dx < w; dx += tileW) {
      for (let dy = -scrollY; dy < h; dy += tileH) {
        ctx.drawImage(tile, dx, dy, tileW + 1, tileH + 1);
      }
    }
    ctx.restore();
  }

  // 4. Distant glowing nebula clouds & subtle star cluster washes
  const pulse = 0.5 + 0.5 * Math.sin(tSec * 0.35);
  const wash1 = ctx.createRadialGradient(
    w * 0.24,
    h * 0.32,
    w * 0.02,
    w * 0.24,
    h * 0.32,
    Math.max(w, h) * 0.42
  );
  wash1.addColorStop(0, `rgba(56, 189, 248, ${(0.08 + 0.03 * pulse).toFixed(3)})`);
  wash1.addColorStop(0.5, 'rgba(30, 64, 175, 0.05)');
  wash1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = wash1;
  ctx.fillRect(0, 0, w, h);

  const wash2 = ctx.createRadialGradient(
    w * 0.78,
    h * 0.68,
    w * 0.02,
    w * 0.78,
    h * 0.68,
    Math.max(w, h) * 0.38
  );
  wash2.addColorStop(0, `rgba(139, 92, 246, ${(0.07 + 0.025 * (1 - pulse)).toFixed(3)})`);
  wash2.addColorStop(0.5, 'rgba(49, 46, 129, 0.04)');
  wash2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = wash2;
  ctx.fillRect(0, 0, w, h);

  // 5. Far deep-field micro-stars (slow parallax)
  const farStars = getFarStars();
  const farAlphaBoost = Math.min(1, alpha + 0.12);
  for (let i = 0; i < farStars.length; i++) {
    const fs = farStars[i];
    const sx = (((fs.x + tSec * 0.0012 * driftMultiplier) % 1) + 1) % 1;
    const sy = (((fs.y + tSec * 0.0004 * driftMultiplier) % 1) + 1) % 1;
    ctx.fillStyle = `rgba(${fs.tint}, ${(fs.alpha * farAlphaBoost).toFixed(3)})`;
    ctx.fillRect(Math.round(sx * w), Math.round(sy * h), fs.size, fs.size);
  }

  // 6. Mid & Hero twinkling stars with spectral colors + 4-point diffraction flares
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const sx = (((s.x + tSec * 0.0042 * s.speed * driftMultiplier) % 1) + 1) % 1;
    const sy = (((s.y + tSec * 0.0016 * s.speed * driftMultiplier) % 1) + 1) % 1;
    const px = Math.round(sx * w);
    const py = Math.round(sy * h);
    const tw = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin(tSec * 2.4 + s.phase));
    const tint = s.tint ?? STAR_TINTS[i % STAR_TINTS.length];
    const starA = tw * Math.min(1, alpha + 0.12);
    const isHero = s.isHero ?? (i % 11 === 0 && s.size >= 3);

    if (isHero) {
      // Soft halo + crisp 4-point pixel star flare
      const haloR = s.size * 4.5;
      const g = ctx.createRadialGradient(px, py, 0.5, px, py, haloR);
      g.addColorStop(0, `rgba(${tint}, ${(starA * 0.72).toFixed(3)})`);
      g.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, haloR, 0, Math.PI * 2);
      ctx.fill();

      const arm = Math.round(s.size * 2.6 * (0.8 + 0.25 * tw));
      ctx.fillStyle = `rgba(${tint}, ${(starA * 0.85).toFixed(3)})`;
      ctx.fillRect(px - arm, py, arm * 2 + 1, 1);
      ctx.fillRect(px, py - arm, 1, arm * 2 + 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, starA * 1.15).toFixed(3)})`;
      ctx.fillRect(px - 1, py - 1, 3, 3);
    } else {
      ctx.fillStyle = `rgba(${tint}, ${starA.toFixed(3)})`;
      ctx.fillRect(px, py, s.size, s.size);
    }
  }

  // 7. Periodic luminous shooting stars
  const meteorCycle = tSec % 7.5;
  if (meteorCycle < 0.8) {
    const k = meteorCycle / 0.8;
    const mx = w * (0.86 - k * 0.44);
    const my = h * (0.11 + k * 0.23);
    const tail = Math.max(36, w * 0.065);
    const tx = mx + tail;
    const ty = my - tail * 0.52;
    const grad = ctx.createLinearGradient(mx, my, tx, ty);
    grad.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * (1 - k)).toFixed(3)})`);
    grad.addColorStop(0.22, `rgba(125, 211, 252, ${(0.82 * (1 - k)).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 255, 255, ${(0.95 * (1 - k)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

interface AnimatedSpaceBgProps {
  alpha?: number;
  driftMultiplier?: number;
  postProcess?: boolean;
  className?: string;
}

export const AnimatedSpaceBg: React.FC<AnimatedSpaceBgProps> = ({
  alpha = 0.85,
  driftMultiplier = 1,
  postProcess = true,
  className = 'absolute inset-0 w-full h-full pointer-events-none',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ alpha, driftMultiplier, postProcess });
  propsRef.current = { alpha, driftMultiplier, postProcess };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgBg = new Image();
    imgBg.src = SPACE_BG_SRC;

    const pipeline = new PostProcessPipeline();

    const stars: StarDot[] = [];
    let seed = 23;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: rand(),
        y: rand(),
        phase: rand() * 6.28,
        size: i % 6 === 0 ? 3 : 2,
        speed: 0.4 + rand() * 0.95,
        tint: STAR_TINTS[i % STAR_TINTS.length],
        isHero: i % 10 === 0,
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
      drawAnimatedSpaceBackground(
        ctx,
        canvas.width,
        canvas.height,
        tSec,
        imgBg,
        stars,
        propsRef.current.alpha,
        propsRef.current.driftMultiplier
      );

      if (propsRef.current.postProcess) {
        pipeline.apply(ctx, canvas, {
          preset: 'space',
          bloomStrength: 0.48,
          thresholdPasses: 2,
          anamorphicStrength: 0.16,
          vignetteStrength: 0.48,
          grainStrength: 0.04,
          gradeStrength: 0.34,
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

  return <canvas ref={canvasRef} className={className} />;
};
