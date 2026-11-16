export interface CleanSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  ready: boolean;
}

export interface CleanStationSprite extends CleanSprite {
  portXOffsetFrac: number;
  portYOffsetFrac: number;
}

export type CharacterKey = 'Director' | 'Armstrong' | 'Aldrin' | 'Collins';
export type ExpressionKey =
  | 'neutro'
  | 'transicion'
  | 'hablando1'
  | 'hablando2'
  | 'hablando3';
export type CharacterSpriteSheet = Record<
  CharacterKey,
  Record<ExpressionKey, CleanSprite>
>;

export interface Mk11RocketSprites {
  idle: CleanSprite;
  flying: CleanSprite;
  mainFlame: CleanSprite;
  separation: CleanSprite;
  undocked: CleanSprite;
  desacopleBody: CleanSprite;
  desacopleFlame: CleanSprite;
  spentCore: CleanSprite;
  fairingL: CleanSprite;
  fairingR: CleanSprite;
  partCore: CleanSprite;
  partBoosterL: CleanSprite;
  partBoosterR: CleanSprite;
  partFairing: CleanSprite;
  partTower: CleanSprite;
}

export const CHARACTER_SHEET_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_14.48.46_a7dc0083.jpeg';

export const DIRECTOR_SHEET_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_14.51.10_2cbd1a28.jpeg';

export const VAN_SPRITE_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_14.51.32_f3ec69b8.jpeg';

export const PARADE_CAR_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_14.15.12_22acd6b8.jpeg';

export const MK11_ROCKET_SHEET_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_14.59.47_b8f65922.jpeg';

export const DESACOPLE_ROCKET_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_15.35.23_c54470bd.jpeg';

export const SUN_SPRITE_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_09.42.28_c02848ec.jpeg';

export const LAUNCH_SUN_SPRITE_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_10.24.02_9d4aa5cb.jpeg';

export const EARTH_TEXTURE_SRC = '/assets/game/earth_day.png';

export const BIROME_SPRITE_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_22.21.08_ef81e2f0.jpeg';

export const STATION_SPRITE_SHEET_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_11.00.27_2139854f.jpeg';

export const STATION_DOCK_CLOSEUP_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-15_at_11.01.08_a0ba3bbb.jpeg';

export const COUPLED_SHIP_SPRITE_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_13.41.58__1__a24d9db9.jpeg';

export interface CleanSunSprite extends CleanSprite {
  coreRadiusFrac: number;
}

/**
 * Loads the textured pixel-art Sun sprite. When includeCoronaRings is false,
 * trims strictly to the yellow/amber solar photosphere so zero red rings appear.
 */
export function loadCleanSunSprite(
  src: string = SUN_SPRITE_SRC,
  includeCoronaRings = false
): CleanSunSprite {
  const outCanvas = document.createElement('canvas');
  const sprite: CleanSunSprite = {
    canvas: outCanvas,
    width: 1,
    height: 1,
    ready: false,
    coreRadiusFrac: 0.355,
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const sw = img.naturalWidth;
    const ch = img.naturalHeight;
    if (!sw || !ch) return;

    const work = document.createElement('canvas');
    work.width = sw;
    work.height = ch;
    const wctx = work.getContext('2d');
    if (!wctx) return;

    wctx.drawImage(img, 0, 0, sw, ch);
    const imgData = wctx.getImageData(0, 0, sw, ch);
    const d = imgData.data;

    // Sample corner background color (#121b28)
    const cOffsets = [
      0,
      (sw - 1) * 4,
      (ch - 1) * sw * 4,
      ((ch - 1) * sw + (sw - 1)) * 4,
    ];
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    for (const off of cOffsets) {
      bgR += d[off];
      bgG += d[off + 1];
      bgB += d[off + 2];
    }
    bgR /= 4;
    bgG /= 4;
    bgB /= 4;

    // Measure bright yellow/amber photosphere radius along center scanlines (excluding crimson rings)
    const midY = Math.floor(ch * 0.5);
    let minCoreX = sw;
    let maxCoreX = -1;
    for (let x = 0; x < sw; x++) {
      const i = (midY * sw + x) * 4;
      if (d[i] > 210 && d[i + 1] > 110) {
        if (x < minCoreX) minCoreX = x;
        if (x > maxCoreX) maxCoreX = x;
      }
    }
    if (maxCoreX > minCoreX) {
      sprite.coreRadiusFrac = Math.max(
        0.25,
        Math.min(0.46, (maxCoreX - minCoreX + 1) / (2 * sw))
      );
    }

    const halfW = sw * 0.5;
    const halfH = ch * 0.5;
    const coreNormR = sprite.coreRadiusFrac * 2;

    for (let y = 0; y < ch; y++) {
      const ny = (y + 0.5 - halfH) / halfH;
      for (let x = 0; x < sw; x++) {
        const nx = (x + 0.5 - halfW) / halfW;
        const normR = Math.hypot(nx, ny);
        const i = (y * sw + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        if (!includeCoronaRings) {
          // Strip outer red/crimson rings completely, leaving crisp textured yellow/amber photosphere
          const trimEdge = coreNormR * 0.985;
          if (normR > trimEdge || (normR > coreNormR * 0.90 && g < 92)) {
            d[i + 3] = 0;
            continue;
          }
          const edgeAlpha = Math.max(0, Math.min(1, (trimEdge - normR) / 0.025));
          d[i + 3] = Math.round(edgeAlpha * 255);
          continue;
        }

        if (normR >= 0.965) {
          d[i + 3] = 0;
          continue;
        }
        if (normR <= coreNormR * 0.99 || (r > 205 && g > 105)) {
          d[i + 3] = 255;
          continue;
        }

        const warmR = Math.max(0, r - bgR);
        const warmDiff = r - b;
        if (warmR < 10 || warmDiff < 6) {
          d[i + 3] = 0;
          continue;
        }

        const radialFade = Math.max(0, Math.min(1, (0.965 - normR) / 0.14));
        const rawAlpha = Math.max(0, Math.min(1, (warmR - 8) / 145)) * radialFade;
        if (rawAlpha <= 0.02) {
          d[i + 3] = 0;
          continue;
        }

        const invA = 1 / Math.max(0.14, rawAlpha);
        d[i] = Math.min(255, Math.max(0, Math.round((r - bgR * (1 - rawAlpha)) * invA)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round((g - bgG * (1 - rawAlpha)) * invA)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round((b - bgB * (1 - rawAlpha)) * invA)));
        d[i + 3] = Math.min(255, Math.round(rawAlpha * 255));
      }
    }

    wctx.putImageData(imgData, 0, 0);
    outCanvas.width = sw;
    outCanvas.height = ch;
    const octx = outCanvas.getContext('2d');
    if (octx) {
      octx.drawImage(work, 0, 0);
      sprite.width = sw;
      sprite.height = ch;
      sprite.ready = true;
    }
  };
  img.src = src;

  return sprite;
}

/**
 * Extracts ONLY the crisp pixel-art circular Launch Sun ball ("la bolita"),
 * stripping out all 8 pixel rays, the outer dithered aureola, sky blue, and corner clouds.
 */
export function loadCleanLaunchSunSprite(
  src: string = LAUNCH_SUN_SPRITE_SRC
): CleanSunSprite {
  const outCanvas = document.createElement('canvas');
  const sprite: CleanSunSprite = {
    canvas: outCanvas,
    width: 1,
    height: 1,
    ready: false,
    coreRadiusFrac: 0.48,
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const rawW = img.naturalWidth;
    const rawH = img.naturalHeight;
    if (!rawW || !rawH) return;

    const work = document.createElement('canvas');
    work.width = rawW;
    work.height = rawH;
    const wctx = work.getContext('2d');
    if (!wctx) return;

    wctx.drawImage(img, 0, 0, rawW, rawH);
    const fullData = wctx.getImageData(0, 0, rawW, rawH).data;

    // Scan outward along a ray-free angle (22.5 deg, halfway between 0 and 45 deg rays)
    // to find the exact pixel outer radius of the solid Sun ball (white core + orange/yellow ring)
    const cx = rawW * 0.5;
    const cy = rawH * 0.5;
    const dirX = Math.cos((22.5 * Math.PI) / 180);
    const dirY = Math.sin((22.5 * Math.PI) / 180);
    const maxScan = Math.floor(Math.min(rawW, rawH) * 0.36);
    let ballRadius = Math.floor(Math.min(rawW, rawH) * 0.215);

    for (let rStep = Math.floor(maxScan * 0.25); rStep <= maxScan; rStep++) {
      const px = Math.min(rawW - 1, Math.max(0, Math.round(cx + dirX * rStep)));
      const py = Math.min(rawH - 1, Math.max(0, Math.round(cy + dirY * rStep)));
      const i = (py * rawW + px) * 4;
      const r = fullData[i];
      const g = fullData[i + 1];
      const b = fullData[i + 2];
      // Outside the crisp yellow outer ring, blue channel jumps above 138 into pale cream dither / sky
      if (b > 138 && !(r > 240 && g > 240 && b > 240)) {
        ballRadius = Math.max(8, rStep - 1);
        break;
      }
    }

    const pad = 2;
    const sw = ballRadius * 2 + pad * 2;
    const ch = ballRadius * 2 + pad * 2;
    const sx = Math.max(0, Math.floor(cx - ballRadius - pad));
    const sy = Math.max(0, Math.floor(cy - ballRadius - pad));

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sw;
    cropCanvas.height = ch;
    const cctx = cropCanvas.getContext('2d');
    if (!cctx) return;

    cctx.drawImage(work, sx, sy, sw, ch, 0, 0, sw, ch);
    const imgData = cctx.getImageData(0, 0, sw, ch);
    const d = imgData.data;

    const halfW = sw * 0.5;
    const halfH = ch * 0.5;
    const clipNormR = ballRadius / halfW;

    for (let y = 0; y < ch; y++) {
      const ny = (y + 0.5 - halfH) / halfH;
      for (let x = 0; x < sw; x++) {
        const nx = (x + 0.5 - halfW) / halfW;
        const distR = Math.hypot(nx, ny);
        const i = (y * sw + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        // Strictly remove rays, dither aureola & sky outside the exact ball radius
        if (distR > clipNormR) {
          d[i + 3] = 0;
          continue;
        }
        if (b - r > 32) {
          d[i + 3] = 0;
          continue;
        }

        const edgeSoft = Math.max(0, Math.min(1, (clipNormR - distR) / 0.045));
        d[i + 3] = Math.round(edgeSoft * 255);
      }
    }

    cctx.putImageData(imgData, 0, 0);
    outCanvas.width = sw;
    outCanvas.height = ch;
    const octx = outCanvas.getContext('2d');
    if (octx) {
      octx.drawImage(cropCanvas, 0, 0);
      sprite.width = sw;
      sprite.height = ch;
      sprite.coreRadiusFrac = ballRadius / sw;
      sprite.ready = true;
    }
  };
  img.src = src;

  return sprite;
}

export function getRocketVisualTier(
  capacityKg: number
): 'light' | 'heavy' {
  return capacityKg <= 800 ? 'light' : 'heavy';
}

/**
 * Flood-fills outer sheet background pixels from image borders to transparent
 * while strictly protecting dark black outlines and enclosed suit/skin pixels.
 */
function keyOutDarkBackground(
  canvas: HTMLCanvasElement,
  bgThreshold = 28,
  protectDarkOutlines = true,
  skipBottomSeed = false,
  fringeDelta = 10
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const sw = canvas.width;
  const ch = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || sw <= 0 || ch <= 0) return null;

  const imgData = ctx.getImageData(0, 0, sw, ch);
  const data = imgData.data;

  // Sample top-left corner background color
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  const bgLuma = bgR + bgG + bgB;

  const isBgLike = (idx: number, threshold: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    if (protectDarkOutlines && r + g + b < bgLuma - 18) {
      return false;
    }
    const dr = Math.abs(r - bgR);
    const dg = Math.abs(g - bgG);
    const db = Math.abs(b - bgB);
    return dr + dg + db <= threshold;
  };

  const visited = new Uint8Array(sw * ch);
  const queue = new Int32Array(sw * ch);
  let qHead = 0;
  let qTail = 0;

  const pushIfBg = (x: number, y: number) => {
    const p = y * sw + x;
    if (visited[p]) return;
    if (isBgLike(p * 4, bgThreshold)) {
      visited[p] = 1;
      queue[qTail++] = p;
    }
  };

  for (let x = 0; x < sw; x++) {
    pushIfBg(x, 0);
    if (!skipBottomSeed) {
      pushIfBg(x, ch - 1);
    }
  }
  for (let y = 0; y < ch; y++) {
    pushIfBg(0, y);
    pushIfBg(sw - 1, y);
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % sw;
    const y = (p - x) / sw;
    data[p * 4 + 3] = 0;

    if (x > 0) pushIfBg(x - 1, y);
    if (x < sw - 1) pushIfBg(x + 1, y);
    if (y > 0) pushIfBg(x, y - 1);
    if (y < ch - 1) pushIfBg(x, y + 1);
  }

  // Only soften outer 1px anti-aliased fringe if strictly lighter/matching background (never dark hair/outlines)
  if (fringeDelta > 0) {
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const p = y * sw + x;
        if (visited[p]) continue;
        const nearCleared =
          visited[p - 1] || visited[p + 1] || visited[p - sw] || visited[p + sw];
        if (nearCleared && isBgLike(p * 4, bgThreshold + fringeDelta)) {
          data[p * 4 + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  let minX = sw;
  let minY = ch;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < sw; x++) {
      const a = data[(y * sw + x) * 4 + 3];
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Loads a JPEG/PNG sprite, crops optional bands, keys out outer dark background,
 * and trims transparent margins to a tight bounding box.
 */
export function loadCleanSprite(
  src: string,
  cropTopFrac = 0,
  cropBottomFrac = 1,
  cropLeftFrac = 0,
  cropRightFrac = 1,
  bgThreshold = 34
): CleanSprite {
  const outCanvas = document.createElement('canvas');
  const sprite: CleanSprite = {
    canvas: outCanvas,
    width: 1,
    height: 1,
    ready: false,
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const rawW = img.naturalWidth;
    const rawH = img.naturalHeight;
    if (!rawW || !rawH) return;

    const sx = Math.max(0, Math.floor(rawW * cropLeftFrac));
    const ex = Math.min(rawW, Math.ceil(rawW * cropRightFrac));
    const sy = Math.max(0, Math.floor(rawH * cropTopFrac));
    const ey = Math.min(rawH, Math.ceil(rawH * cropBottomFrac));
    const sw = Math.max(1, ex - sx);
    const ch = Math.max(1, ey - sy);

    const work = document.createElement('canvas');
    work.width = sw;
    work.height = ch;
    const wctx = work.getContext('2d');
    if (!wctx) return;

    wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);
    const box = keyOutDarkBackground(work, bgThreshold, true);
    if (!box) return;

    const tw = box.maxX - box.minX + 1;
    const th = box.maxY - box.minY + 1;
    outCanvas.width = tw;
    outCanvas.height = th;
    const octx = outCanvas.getContext('2d');
    if (octx) {
      octx.drawImage(work, box.minX, box.minY, tw, th, 0, 0, tw, th);
      sprite.width = tw;
      sprite.height = th;
      sprite.ready = true;
    }
  };
  img.src = src;

  return sprite;
}

/**
 * Extracts the pixel-art Space Station cleanly from Frame 1 of the 4x2 docking sheet,
 * keying out the dark-purple nebula and filtering out stray background stars.
 */
export function loadCleanSpaceStationSprite(
  src: string = STATION_SPRITE_SHEET_SRC,
  onLoaded?: () => void
): CleanStationSprite {
  const outCanvas = document.createElement('canvas');
  const sprite: CleanStationSprite = {
    canvas: outCanvas,
    width: 1,
    height: 1,
    ready: false,
    portXOffsetFrac: -0.49,
    portYOffsetFrac: 0.048,
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const rawW = img.naturalWidth;
    const rawH = img.naturalHeight;
    if (!rawW || !rawH) return;

    // Frame 1 right side: isolated Space Station (zero Eagle overlap, zero cell borders)
    const sx = Math.floor(rawW * 0.095);
    const ex = Math.ceil(rawW * 0.246);
    const sy = Math.floor(rawH * 0.038);
    const ey = Math.ceil(rawH * 0.465);
    const sw = Math.max(1, ex - sx);
    const ch = Math.max(1, ey - sy);

    const work = document.createElement('canvas');
    work.width = sw;
    work.height = ch;
    const wctx = work.getContext('2d');
    if (!wctx) return;

    wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);
    const imgData = wctx.getImageData(0, 0, sw, ch);
    const d = imgData.data;

    // Sample corner background color
    const bgR = d[0];
    const bgG = d[1];
    const bgB = d[2];
    const bgLuma = bgR + bgG + bgB;

    // Precompute bright foreground proximity so only real hull outlines are protected (not dark nebula patches)
    const hasBrightNeighbor = new Uint8Array(sw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        if (Math.max(d[i], d[i + 1], d[i + 2]) >= 54) {
          for (let dy = -2; dy <= 2; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= ch) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= sw) continue;
              hasBrightNeighbor[ny * sw + nx] = 1;
            }
          }
        }
      }
    }

    const isSpaceBg = (p: number) => {
      const idx = p * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];
      // Protect crisp black outlines ONLY if adjacent to actual bright station hull/panels
      if (hasBrightNeighbor[p] && r < 30 && g < 30 && b < 36) {
        return false;
      }
      const dr = Math.abs(r - bgR);
      const dg = Math.abs(g - bgG);
      const db = Math.abs(b - bgB);
      if (dr + dg + db <= 46) return true;
      if (r <= 46 && g <= 42 && b <= 78 && Math.max(r, g, b) <= 68) return true;
      const isPurpleSpace = b >= g + 5 && r <= 72 && g <= 48 && b <= 96;
      return isPurpleSpace;
    };

    const visited = new Uint8Array(sw * ch);
    const queue = new Int32Array(sw * ch);
    let qHead = 0;
    let qTail = 0;

    const pushBg = (x: number, y: number) => {
      const p = y * sw + x;
      if (visited[p]) return;
      if (isSpaceBg(p)) {
        visited[p] = 1;
        queue[qTail++] = p;
      }
    };

    for (let x = 0; x < sw; x++) {
      pushBg(x, 0);
      pushBg(x, ch - 1);
    }
    for (let y = 0; y < ch; y++) {
      pushBg(0, y);
      pushBg(sw - 1, y);
    }

    while (qHead < qTail) {
      const p = queue[qHead++];
      const x = p % sw;
      const y = (p - x) / sw;
      d[p * 4 + 3] = 0;
      if (x > 0) pushBg(x - 1, y);
      if (x < sw - 1) pushBg(x + 1, y);
      if (y > 0) pushBg(x, y - 1);
      if (y < ch - 1) pushBg(x, y + 1);
    }

    // Keep only the largest 8-connected foreground component (eliminates all isolated stars & dark blobs)
    const compVisited = new Uint8Array(sw * ch);
    const compQueue = new Int32Array(sw * ch);
    let bestComponent: number[] = [];

    for (let p0 = 0; p0 < sw * ch; p0++) {
      if (compVisited[p0] || d[p0 * 4 + 3] === 0) continue;
      let cHead = 0;
      let cTail = 0;
      compVisited[p0] = 1;
      compQueue[cTail++] = p0;
      const pixels: number[] = [];

      while (cHead < cTail) {
        const p = compQueue[cHead++];
        pixels.push(p);
        const x = p % sw;
        const y = (p - x) / sw;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= ch) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= sw) continue;
            const np = ny * sw + nx;
            if (!compVisited[np] && d[np * 4 + 3] > 0) {
              compVisited[np] = 1;
              compQueue[cTail++] = np;
            }
          }
        }
      }
      if (pixels.length > bestComponent.length) {
        bestComponent = pixels;
      }
    }

    const keepMask = new Uint8Array(sw * ch);
    for (const p of bestComponent) {
      keepMask[p] = 1;
    }

    let minX = sw;
    let minY = ch;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < sw; x++) {
        const p = y * sw + x;
        if (!keepMask[p]) {
          d[p * 4 + 3] = 0;
        } else if (d[p * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return;
    wctx.putImageData(imgData, 0, 0);

    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;
    outCanvas.width = tw;
    outCanvas.height = th;
    const octx = outCanvas.getContext('2d');
    if (octx) {
      octx.drawImage(work, minX, minY, tw, th, 0, 0, tw, th);

      // Measure exact leftmost docking collar port X and vertical Y center directly on trimmed outCanvas
      const outData = octx.getImageData(0, 0, tw, th).data;
      const bandTop = Math.floor(th * 0.36);
      const bandBot = Math.min(th - 1, Math.ceil(th * 0.68));
      let collarEdgeX = 0;
      let foundEdge = false;
      for (let x = 0; x < Math.min(tw, Math.ceil(tw * 0.14)); x++) {
        let opaqueRows = 0;
        for (let y = bandTop; y <= bandBot; y++) {
          if (outData[(y * tw + x) * 4 + 3] > 80) opaqueRows++;
        }
        if (opaqueRows >= 6) {
          collarEdgeX = x;
          foundEdge = true;
          break;
        }
      }
      if (foundEdge) {
        let cMinY = th;
        let cMaxY = -1;
        const scanEndX = Math.min(tw - 1, collarEdgeX + 6);
        for (let x = collarEdgeX; x <= scanEndX; x++) {
          for (let y = bandTop; y <= bandBot; y++) {
            if (outData[(y * tw + x) * 4 + 3] > 80) {
              if (y < cMinY) cMinY = y;
              if (y > cMaxY) cMaxY = y;
            }
          }
        }
        if (cMaxY >= cMinY) {
          sprite.portXOffsetFrac = collarEdgeX / tw - 0.5;
          sprite.portYOffsetFrac = (cMinY + cMaxY) / (2 * th) - 0.5;
        }
      }

      sprite.width = tw;
      sprite.height = th;
      sprite.ready = true;
      onLoaded?.();
    }
  };
  img.src = src;

  return sprite;
}

export interface StationDockingTextures {
  leftCollar: CleanSprite;
  rightBulkhead: CleanSprite;
  tabCyan: CleanSprite;
  tabAmber: CleanSprite;
}

/**
 * Extracts crisp pixel-art textures from Image 3 (PREPARAR ACOPLAMIENTO mockup)
 * for the close-up Level 2 docking alignment & ring insertion view.
 */
export function loadStationDockingTextures(
  src: string = STATION_DOCK_CLOSEUP_SRC,
  onLoaded?: () => void
): StationDockingTextures {
  const textures: StationDockingTextures = {
    leftCollar: makeEmptySprite(),
    rightBulkhead: makeEmptySprite(),
    tabCyan: makeEmptySprite(),
    tabAmber: makeEmptySprite(),
  };

  const keyOutSpaceEdge = (
    canvas: HTMLCanvasElement,
    seedEdges: ('left' | 'right' | 'top' | 'bottom')[]
  ) => {
    const sw = canvas.width;
    const ch = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, sw, ch);
    const d = imgData.data;

    const hasBright = new Uint8Array(sw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        if (Math.max(d[i], d[i + 1], d[i + 2]) >= 66) {
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= ch) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= sw) continue;
              hasBright[ny * sw + nx] = 1;
            }
          }
        }
      }
    }

    const isSpace = (p: number) => {
      const i = p * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (hasBright[p] && r < 34 && g < 34 && b < 42) return false;
      // Dark purple starry backdrop in Image 3 (low-to-mid blue purple, or dim white star dots in space)
      const isPurpleSpace = b >= g + 4 && r <= 70 && g <= 48 && b <= 96;
      const isDeepDark = r <= 34 && g <= 28 && b <= 56;
      return isPurpleSpace || isDeepDark;
    };

    const visited = new Uint8Array(sw * ch);
    const queue = new Int32Array(sw * ch);
    let qH = 0;
    let qT = 0;

    const trySeed = (x: number, y: number) => {
      const p = y * sw + x;
      if (!visited[p] && isSpace(p)) {
        visited[p] = 1;
        queue[qT++] = p;
      }
    };

    if (seedEdges.includes('left')) {
      for (let y = 0; y < ch; y++) trySeed(0, y);
    }
    if (seedEdges.includes('right')) {
      for (let y = 0; y < ch; y++) trySeed(sw - 1, y);
    }
    if (seedEdges.includes('top')) {
      for (let x = 0; x < sw; x++) trySeed(x, 0);
    }
    if (seedEdges.includes('bottom')) {
      for (let x = 0; x < sw; x++) trySeed(x, ch - 1);
    }

    while (qH < qT) {
      const p = queue[qH++];
      const x = p % sw;
      const y = (p - x) / sw;
      d[p * 4 + 3] = 0;
      if (x > 0) trySeed(x - 1, y);
      if (x < sw - 1) trySeed(x + 1, y);
      if (y > 0) trySeed(x, y - 1);
      if (y < ch - 1) trySeed(x, y + 1);
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const rw = img.naturalWidth;
    const rh = img.naturalHeight;
    if (!rw || !rh) return;

    // 1) Left spacecraft hull & docking ring (normalized to 1600x900)
    {
      const sx = Math.round(rw * (280 / 1600));
      const sy = Math.round(rh * (150 / 900));
      const sw = Math.round(rw * (500 / 1600));
      const ch = Math.round(rh * (490 / 900));
      const work = document.createElement('canvas');
      work.width = sw;
      work.height = ch;
      const wctx = work.getContext('2d');
      if (wctx) {
        wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);
        // Cleanly patch out the 3 baked movable tabs along the ring bevel by cloning nearby ring arc pixels
        const id = wctx.getImageData(0, 0, sw, ch);
        const orig = new Uint8ClampedArray(id.data);
        const cx = sw * (290 / 500);
        const cy = ch * (243 / 490);
        const rx = sw * (152 / 500);
        const ry = ch * (174 / 490);

        const patchSector = (
          xMin: number,
          xMax: number,
          yMin: number,
          yMax: number,
          deltaRad: number
        ) => {
          const x0 = Math.max(0, Math.floor(sw * (xMin / 500)));
          const x1 = Math.min(sw - 1, Math.ceil(sw * (xMax / 500)));
          const y0 = Math.max(0, Math.floor(ch * (yMin / 490)));
          const y1 = Math.min(ch - 1, Math.ceil(ch * (yMax / 490)));
          const cosD = Math.cos(deltaRad);
          const sinD = Math.sin(deltaRad);
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              const i = (y * sw + x) * 4;
              const r = orig[i];
              const g = orig[i + 1];
              const b = orig[i + 2];
              const isCyanTab = g > 140 && b > 115 && r < 110;
              const isAmberTab = r > 175 && g > 95 && b < 110;
              const nx = (x - cx) / rx;
              const ny = (y - cy) / ry;
              const ellR = Math.hypot(nx, ny);
              // Patch tab colors or protruding bevel edge near ring
              if (ellR >= 0.72 && (isCyanTab || isAmberTab || ellR <= 1.15)) {
                const snx = nx * cosD - ny * sinD;
                const sny = nx * sinD + ny * cosD;
                const srcX = Math.max(0, Math.min(sw - 1, Math.round(cx + snx * rx)));
                const srcY = Math.max(0, Math.min(ch - 1, Math.round(cy + sny * ry)));
                const si = (srcY * sw + srcX) * 4;
                id.data[i] = orig[si];
                id.data[i + 1] = orig[si + 1];
                id.data[i + 2] = orig[si + 2];
              }
            }
          }
        };

        // Top cyan tab (~ -90 deg), Bottom-left cyan tab (~ +118 deg), Right amber tab (~ 0 deg)
        patchSector(276, 352, 22, 108, -0.62);
        patchSector(228, 308, 332, 428, -0.65);
        patchSector(390, 495, 174, 298, -0.58);
        wctx.putImageData(id, 0, 0);

        keyOutSpaceEdge(work, ['right', 'top', 'bottom']);
        textures.leftCollar.canvas.width = sw;
        textures.leftCollar.canvas.height = ch;
        textures.leftCollar.canvas.getContext('2d')?.drawImage(work, 0, 0);
        textures.leftCollar.width = sw;
        textures.leftCollar.height = ch;
        textures.leftCollar.ready = true;
      }
    }

    // 2) Right Space Station bulkhead & receiving ring (MK11 //)
    {
      const sx = Math.round(rw * (824 / 1600));
      const sy = Math.round(rh * (145 / 900));
      const sw = Math.round(rw * (484 / 1600));
      const ch = Math.round(rh * (492 / 900));
      const work = document.createElement('canvas');
      work.width = sw;
      work.height = ch;
      const wctx = work.getContext('2d');
      if (wctx) {
        wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);
        keyOutSpaceEdge(work, ['left', 'top', 'bottom']);
        textures.rightBulkhead.canvas.width = sw;
        textures.rightBulkhead.canvas.height = ch;
        textures.rightBulkhead.canvas.getContext('2d')?.drawImage(work, 0, 0);
        textures.rightBulkhead.width = sw;
        textures.rightBulkhead.height = ch;
        textures.rightBulkhead.ready = true;
      }
    }

    // 3) Movable Cyan Tab sprite extracted from top tab of Image 3
    {
      const sx = Math.round(rw * (566 / 1600));
      const sy = Math.round(rh * (178 / 900));
      const sw = Math.round(rw * (58 / 1600));
      const ch = Math.round(rh * (70 / 900));
      const work = document.createElement('canvas');
      work.width = sw;
      work.height = ch;
      const wctx = work.getContext('2d');
      if (wctx) {
        wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);
        const id = wctx.getImageData(0, 0, sw, ch);
        const d = id.data;
        for (let p = 0; p < sw * ch; p++) {
          const i = p * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          // Keep teal/cyan body and dark outline; fade out grey ring & purple space
          const isTeal = g > 115 && b > 95 && r < 110;
          const isDarkEdge = Math.max(r, g, b) < 42;
          if (!isTeal && !isDarkEdge) {
            d[i + 3] = 0;
          }
        }
        wctx.putImageData(id, 0, 0);
        const box = keyOutDarkBackground(work, 26, false);
        if (box) {
          const tw = box.maxX - box.minX + 1;
          const th = box.maxY - box.minY + 1;
          textures.tabCyan.canvas.width = tw;
          textures.tabCyan.canvas.height = th;
          textures.tabCyan.canvas
            .getContext('2d')
            ?.drawImage(work, box.minX, box.minY, tw, th, 0, 0, tw, th);
          textures.tabCyan.width = tw;
          textures.tabCyan.height = th;
          textures.tabCyan.ready = true;
        }
      }
    }

    // 4) Movable Amber Connector Key sprite extracted from Image 3
    {
      const sx = Math.round(rw * (674 / 1600));
      const sy = Math.round(rh * (330 / 900));
      const sw = Math.round(rw * (96 / 1600));
      const ch = Math.round(rh * (114 / 900));
      const work = document.createElement('canvas');
      work.width = sw;
      work.height = ch;
      const wctx = work.getContext('2d');
      if (wctx) {
        wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);
        const id = wctx.getImageData(0, 0, sw, ch);
        const d = id.data;
        for (let p = 0; p < sw * ch; p++) {
          const i = p * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const isAmber = r > 140 && g > 75 && b < 115;
          const isDarkEdge = Math.max(r, g, b) < 40;
          if (!isAmber && !isDarkEdge) {
            d[i + 3] = 0;
          }
        }
        wctx.putImageData(id, 0, 0);
        const box = keyOutDarkBackground(work, 26, false);
        if (box) {
          const tw = box.maxX - box.minX + 1;
          const th = box.maxY - box.minY + 1;
          textures.tabAmber.canvas.width = tw;
          textures.tabAmber.canvas.height = th;
          textures.tabAmber.canvas
            .getContext('2d')
            ?.drawImage(work, box.minX, box.minY, tw, th, 0, 0, tw, th);
          textures.tabAmber.width = tw;
          textures.tabAmber.height = th;
          textures.tabAmber.ready = true;
        }
      }
    }

    onLoaded?.();
  };
  img.src = src;

  return textures;
}

function makeEmptySprite(): CleanSprite {
  return {
    canvas: document.createElement('canvas'),
    width: 1,
    height: 1,
    ready: false,
  };
}

/**
 * Slices the 4x5 character expression sprite sheet AND Jeremy's dedicated
 * Director de Vuelo sheet using exact per-row seam coordinates so no neighboring
 * shoulder bleeds into another expression and heads stay crisp & jitter-free.
 */
export function loadCharacterSpriteSheet(
  src: string = CHARACTER_SHEET_SRC,
  onLoaded?: () => void
): CharacterSpriteSheet {
  const sheet: CharacterSpriteSheet = {
    Director: {
      neutro: makeEmptySprite(),
      transicion: makeEmptySprite(),
      hablando1: makeEmptySprite(),
      hablando2: makeEmptySprite(),
      hablando3: makeEmptySprite(),
    },
    Armstrong: {
      neutro: makeEmptySprite(),
      transicion: makeEmptySprite(),
      hablando1: makeEmptySprite(),
      hablando2: makeEmptySprite(),
      hablando3: makeEmptySprite(),
    },
    Aldrin: {
      neutro: makeEmptySprite(),
      transicion: makeEmptySprite(),
      hablando1: makeEmptySprite(),
      hablando2: makeEmptySprite(),
      hablando3: makeEmptySprite(),
    },
    Collins: {
      neutro: makeEmptySprite(),
      transicion: makeEmptySprite(),
      hablando1: makeEmptySprite(),
      hablando2: makeEmptySprite(),
      hablando3: makeEmptySprite(),
    },
  };

  const expKeys: ExpressionKey[] = [
    'neutro',
    'transicion',
    'hablando1',
    'hablando2',
    'hablando3',
  ];

  type RowSpec = {
    key: CharacterKey;
    top: number;
    bottom: number;
    seams: [number, number, number, number, number, number];
  };

  const sliceRowFromImage = (img: HTMLImageElement, r: RowSpec) => {
    const rawW = img.naturalWidth;
    const rawH = img.naturalHeight;
    if (!rawW || !rawH) return;

    const sy = Math.floor(rawH * r.top);
    const ey = Math.ceil(rawH * r.bottom);
    const ch = Math.max(1, ey - sy);

    const processed: {
      exp: ExpressionKey;
      work: HTMLCanvasElement;
      box: { minX: number; minY: number; maxX: number; maxY: number };
    }[] = [];

    let maxW = 1;
    let maxH = 1;

    for (let cIdx = 0; cIdx < expKeys.length; cIdx++) {
      const exp = expKeys[cIdx];
      const sx = Math.floor(rawW * r.seams[cIdx]);
      const ex = Math.ceil(rawW * r.seams[cIdx + 1]);
      const sw = Math.max(1, ex - sx);
      const work = document.createElement('canvas');
      work.width = sw + 2;
      work.height = ch + 1;
      const wctx = work.getContext('2d');
      if (!wctx) continue;

      wctx.drawImage(img, sx, sy, sw, ch, 1, 1, sw, ch);
      const bgSample = wctx.getImageData(1, 1, 1, 1).data;
      wctx.fillStyle = `rgb(${bgSample[0]}, ${bgSample[1]}, ${bgSample[2]})`;
      wctx.fillRect(0, 0, work.width, 1);
      wctx.fillRect(0, 0, 1, work.height);
      wctx.fillRect(work.width - 1, 0, 1, work.height);

      const box = keyOutDarkBackground(work, 18, true, true, 3);
      if (!box) continue;

      const w = box.maxX - box.minX + 1;
      const h = box.maxY - box.minY + 1;
      if (w > maxW) maxW = w;
      if (h > maxH) maxH = h;
      processed.push({ exp, work, box });
    }

    if (processed.length === 0) return;
    const unifiedW = maxW + 4;
    const unifiedH = maxH + 2;

    for (const item of processed) {
      const target = sheet[r.key][item.exp];
      const bw = item.box.maxX - item.box.minX + 1;
      const bh = item.box.maxY - item.box.minY + 1;
      target.canvas.width = unifiedW;
      target.canvas.height = unifiedH;
      const tctx = target.canvas.getContext('2d');
      if (tctx) {
        tctx.clearRect(0, 0, unifiedW, unifiedH);
        tctx.drawImage(
          item.work,
          item.box.minX,
          item.box.minY,
          bw,
          bh,
          Math.round((unifiedW - bw) / 2),
          unifiedH - bh,
          bw,
          bh
        );
        target.width = unifiedW;
        target.height = unifiedH;
        target.ready = true;
      }
    }
  };

  // Astronaut crew rows from the 3x5 crew sprite sheet (1600x533)
  // Cut bottom right above feathered bust fade so chest hems stay straight and never touch row below
  const crewRowSpecs: RowSpec[] = [
    {
      key: 'Armstrong',
      top: 0.015,
      bottom: 0.321,
      seams: [0.2522, 0.3947, 0.5244, 0.6525, 0.7856, 0.9240],
    },
    {
      key: 'Aldrin',
      top: 0.330,
      bottom: 0.625,
      seams: [0.2559, 0.3987, 0.5281, 0.6544, 0.7869, 0.9240],
    },
    {
      key: 'Collins',
      top: 0.634,
      bottom: 0.959,
      seams: [0.2556, 0.4019, 0.5306, 0.6584, 0.7897, 0.9220],
    },
  ];

  // Dedicated DIR. DE VUELO (JEREMY) sheet (1600x534)
  const directorRowSpec: RowSpec = {
    key: 'Director',
    top: 0.375,
    bottom: 0.781,
    seams: [0.2378, 0.3887, 0.5325, 0.6781, 0.8269, 0.9800],
  };

  const crewImg = new Image();
  crewImg.crossOrigin = 'anonymous';
  crewImg.onload = () => {
    for (const r of crewRowSpecs) {
      sliceRowFromImage(crewImg, r);
    }
    onLoaded?.();
  };
  crewImg.src = src;

  const dirImg = new Image();
  dirImg.crossOrigin = 'anonymous';
  dirImg.onload = () => {
    sliceRowFromImage(dirImg, directorRowSpec);
    onLoaded?.();
  };
  dirImg.src = DIRECTOR_SHEET_SRC;

  return sheet;
}

/**
 * Extracts all phases of the user's MK11 rocket sprite sheet AND the standalone
 * DESACOPLE (Eagle + CSM) upper stage with separated body & exhaust flame sprites
 * so fire can be animated independently at 60 fps.
 */
export function loadMk11RocketSprites(
  src: string = MK11_ROCKET_SHEET_SRC,
  onLoaded?: () => void
): Mk11RocketSprites {
  const sprites: Mk11RocketSprites = {
    idle: makeEmptySprite(),
    flying: makeEmptySprite(),
    mainFlame: makeEmptySprite(),
    separation: makeEmptySprite(),
    undocked: makeEmptySprite(),
    desacopleBody: makeEmptySprite(),
    desacopleFlame: makeEmptySprite(),
    spentCore: makeEmptySprite(),
    fairingL: makeEmptySprite(),
    fairingR: makeEmptySprite(),
    partCore: makeEmptySprite(),
    partBoosterL: makeEmptySprite(),
    partBoosterR: makeEmptySprite(),
    partFairing: makeEmptySprite(),
    partTower: makeEmptySprite(),
  };

  const extractSub = (
    img: HTMLImageElement,
    target: CleanSprite,
    l: number,
    r: number,
    t: number,
    b: number,
    trimSideFlamesForIdle = false,
    threshold = 32
  ) => {
    const rawW = img.naturalWidth;
    const rawH = img.naturalHeight;
    const sx = Math.floor(rawW * l);
    const ex = Math.ceil(rawW * r);
    const sy = Math.floor(rawH * t);
    const ey = Math.ceil(rawH * b);
    const sw = Math.max(1, ex - sx);
    const ch = Math.max(1, ey - sy);

    const work = document.createElement('canvas');
    work.width = sw;
    work.height = ch;
    const wctx = work.getContext('2d');
    if (!wctx) return;

    wctx.drawImage(img, sx, sy, sw, ch, 0, 0, sw, ch);

    if (trimSideFlamesForIdle) {
      // Mask out side-booster flame wisps below side nozzles while keeping center nozzle intact
      const imgData = wctx.getImageData(0, 0, sw, ch);
      const d = imgData.data;
      const bgR = d[0];
      const bgG = d[1];
      const bgB = d[2];
      const sideCutY = Math.floor(ch * 0.968);
      const centerMinX = Math.floor(sw * 0.34);
      const centerMaxX = Math.floor(sw * 0.66);
      for (let y = sideCutY; y < ch; y++) {
        for (let x = 0; x < sw; x++) {
          if (x < centerMinX || x > centerMaxX) {
            const i = (y * sw + x) * 4;
            d[i] = bgR;
            d[i + 1] = bgG;
            d[i + 2] = bgB;
          }
        }
      }
      wctx.putImageData(imgData, 0, 0);
    }

    const box = keyOutDarkBackground(work, threshold, true);
    if (!box) return;

    const tw = box.maxX - box.minX + 1;
    const th = box.maxY - box.minY + 1;
    target.canvas.width = tw;
    target.canvas.height = th;
    const tctx = target.canvas.getContext('2d');
    if (tctx) {
      tctx.drawImage(work, box.minX, box.minY, tw, th, 0, 0, tw, th);
      target.width = tw;
      target.height = th;
      target.ready = true;
    }
  };

  let loadedCount = 0;
  const markDone = () => {
    loadedCount += 1;
    if (loadedCount >= 2) {
      onLoaded?.();
    }
  };

  const sliceIdleIntoAssemblyParts = (idle: CleanSprite) => {
    if (!idle.ready) return;
    const tw = idle.width;
    const th = idle.height;
    const ictx = idle.canvas.getContext('2d');
    if (!ictx) return;

    const srcData = ictx.getImageData(0, 0, tw, th).data;

    // 1) Detect where the narrow escape tower spire meets the widening fairing nose cone
    let yTowerCut = Math.round(th * 0.135);
    let consecutiveWide = 0;
    for (let y = Math.round(th * 0.04); y < Math.round(th * 0.24); y++) {
      let minX = tw;
      let maxX = -1;
      for (let x = 0; x < tw; x++) {
        if (srcData[(y * tw + x) * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      const rowW = maxX >= minX ? maxX - minX + 1 : 0;
      if (rowW > tw * 0.17) {
        consecutiveWide++;
        if (consecutiveWide >= 3) {
          yTowerCut = Math.max(2, y - 2);
          break;
        }
      } else {
        consecutiveWide = 0;
      }
    }

    // 2) Detect top edge of the core stage red band (separating upper fairing/cofia from core stage)
    let yFairingCut = Math.round(th * 0.435);
    for (let y = Math.round(th * 0.34); y < Math.round(th * 0.56); y++) {
      let redCount = 0;
      for (let x = Math.round(tw * 0.25); x < Math.round(tw * 0.75); x++) {
        const idx = (y * tw + x) * 4;
        if (
          srcData[idx + 3] > 120 &&
          srcData[idx] > 150 &&
          srcData[idx + 1] < 85 &&
          srcData[idx + 2] < 85
        ) {
          redCount++;
        }
      }
      if (redCount >= Math.max(4, Math.round(tw * 0.08))) {
        yFairingCut = Math.max(yTowerCut + 8, y - Math.max(2, Math.round(th * 0.018)));
        break;
      }
    }

    // 3) Measure core cylinder [coreMinX, coreMaxX] right below the fairing cut and above side boosters
    const sampleMins: number[] = [];
    const sampleMaxs: number[] = [];
    const sampleY0 = Math.min(th - 2, yFairingCut + Math.max(2, Math.round(th * 0.025)));
    const sampleY1 = Math.min(th - 1, yFairingCut + Math.max(5, Math.round(th * 0.075)));
    for (let y = sampleY0; y <= sampleY1; y++) {
      let rMin = tw;
      let rMax = -1;
      for (let x = 0; x < tw; x++) {
        if (srcData[(y * tw + x) * 4 + 3] > 20) {
          if (x < rMin) rMin = x;
          if (x > rMax) rMax = x;
        }
      }
      if (rMax > rMin) {
        sampleMins.push(rMin);
        sampleMaxs.push(rMax);
      }
    }
    sampleMins.sort((a, b) => a - b);
    sampleMaxs.sort((a, b) => a - b);
    const coreMinX =
      sampleMins.length > 0
        ? sampleMins[Math.floor(sampleMins.length / 2)]
        : Math.round(tw * 0.28);
    const coreMaxX =
      sampleMaxs.length > 0
        ? sampleMaxs[Math.floor(sampleMaxs.length / 2)]
        : Math.round(tw * 0.72);

    const buildMaskedLayer = (
      target: CleanSprite,
      predicate: (x: number, y: number) => boolean
    ) => {
      target.canvas.width = tw;
      target.canvas.height = th;
      const tctx = target.canvas.getContext('2d');
      if (!tctx) return;
      const out = tctx.createImageData(tw, th);
      const dst = out.data;
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const i = (y * tw + x) * 4;
          if (srcData[i + 3] > 0 && predicate(x, y)) {
            dst[i] = srcData[i];
            dst[i + 1] = srcData[i + 1];
            dst[i + 2] = srcData[i + 2];
            dst[i + 3] = srcData[i + 3];
          }
        }
      }
      tctx.putImageData(out, 0, 0);
      target.width = tw;
      target.height = th;
      target.ready = true;
    };

    buildMaskedLayer(sprites.partTower, (_x, y) => y < yTowerCut);
    buildMaskedLayer(sprites.partFairing, (_x, y) => y >= yTowerCut && y < yFairingCut);
    buildMaskedLayer(
      sprites.partCore,
      (x, y) => y >= yFairingCut && x >= coreMinX && x <= coreMaxX
    );
    buildMaskedLayer(
      sprites.partBoosterL,
      (x, y) => y >= yFairingCut && x < coreMinX
    );
    buildMaskedLayer(
      sprites.partBoosterR,
      (x, y) => y >= yFairingCut && x > coreMaxX
    );
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      extractSub(img, sprites.idle, 0.085, 0.258, 0.125, 0.861, true, 32);
      sliceIdleIntoAssemblyParts(sprites.idle);
      extractSub(img, sprites.flying, 0.085, 0.258, 0.125, 0.999, false, 32);
      extractSub(img, sprites.mainFlame, 0.085, 0.258, 0.860, 0.999, false, 30);
      extractSub(img, sprites.separation, 0.382, 0.616, 0.175, 0.968, false, 32);
      extractSub(img, sprites.undocked, 0.738, 0.900, 0.145, 0.478, false, 32);
      extractSub(img, sprites.spentCore, 0.770, 0.868, 0.558, 0.962, false, 32);
      extractSub(img, sprites.fairingL, 0.692, 0.778, 0.328, 0.515, false, 32);
      extractSub(img, sprites.fairingR, 0.862, 0.946, 0.328, 0.515, false, 32);
    }
    markDone();
  };
  img.src = src;

  const imgDesacople = new Image();
  imgDesacople.crossOrigin = 'anonymous';
  imgDesacople.onload = () => {
    if (imgDesacople.naturalWidth && imgDesacople.naturalHeight) {
      extractSub(imgDesacople, sprites.desacopleBody, 0.430, 0.585, 0.174, 0.698, false, 30);
      extractSub(imgDesacople, sprites.desacopleFlame, 0.430, 0.585, 0.698, 0.945, false, 30);
    }
    markDone();
  };
  imgDesacople.src = DESACOPLE_ROCKET_SRC;

  return sprites;
}

export interface ParadeCarSprites {
  body: CleanSprite;
  leftFlag: CleanSprite;
  rightFlag: CleanSprite;
  leftFlagRectFrac: { x: number; y: number; w: number; h: number };
  rightFlagRectFrac: { x: number; y: number; w: number; h: number };
  ready: boolean;
}

/**
 * Loads the final parade vehicle sprite, strips the outer background & bottom crowd strip,
 * and splits out the front and rear US flags so they can ripple smoothly in the wind at 60fps.
 */
export function loadAnimatedParadeCarSprites(
  src: string = PARADE_CAR_SRC,
  onLoaded?: () => void
): ParadeCarSprites {
  const bundle: ParadeCarSprites = {
    body: makeEmptySprite(),
    leftFlag: makeEmptySprite(),
    rightFlag: makeEmptySprite(),
    leftFlagRectFrac: { x: 0, y: 0.245, w: 0.071, h: 0.135 },
    rightFlagRectFrac: { x: 0.929, y: 0.305, w: 0.071, h: 0.135 },
    ready: false,
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const rawW = img.naturalWidth;
    const rawH = img.naturalHeight;
    if (!rawW || !rawH) return;

    // Crop cleanly above the bottom crowd strip (0..0.80)
    const ch = Math.max(1, Math.floor(rawH * 0.80));
    const sw = rawW;

    const work = document.createElement('canvas');
    work.width = sw;
    work.height = ch;
    const wctx = work.getContext('2d');
    if (!wctx) return;

    wctx.drawImage(img, 0, 0, sw, ch, 0, 0, sw, ch);
    const box = keyOutDarkBackground(work, 28, true);
    if (!box) return;

    const tw = box.maxX - box.minX + 1;
    const th = box.maxY - box.minY + 1;

    bundle.body.canvas.width = tw;
    bundle.body.canvas.height = th;
    const bctx = bundle.body.canvas.getContext('2d');
    if (!bctx) return;

    bctx.drawImage(work, box.minX, box.minY, tw, th, 0, 0, tw, th);
    bundle.body.width = tw;
    bundle.body.height = th;
    bundle.body.ready = true;

    const extractFlagSlice = (
      rectFrac: { x: number; y: number; w: number; h: number },
      target: CleanSprite
    ) => {
      const fx = Math.max(0, Math.floor(tw * rectFrac.x));
      const fy = Math.max(0, Math.floor(th * rectFrac.y));
      const fw = Math.max(1, Math.min(tw - fx, Math.ceil(tw * rectFrac.w)));
      const fh = Math.max(1, Math.min(th - fy, Math.ceil(th * rectFrac.h)));
      target.canvas.width = fw;
      target.canvas.height = fh;
      const tctx = target.canvas.getContext('2d');
      if (tctx) {
        tctx.drawImage(bundle.body.canvas, fx, fy, fw, fh, 0, 0, fw, fh);
        target.width = fw;
        target.height = fh;
        target.ready = true;
      }
      bctx.clearRect(fx, fy, fw, fh);
    };

    extractFlagSlice(bundle.leftFlagRectFrac, bundle.leftFlag);
    extractFlagSlice(bundle.rightFlagRectFrac, bundle.rightFlag);

    bundle.ready = true;
    onLoaded?.();
  };
  img.src = src;

  return bundle;
}
