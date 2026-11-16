export type PostProcessPreset = 'space' | 'launch_day' | 'lunar';

export interface PostProcessOptions {
  preset?: PostProcessPreset;
  /** 0..1 overall bloom intensity */
  bloomStrength?: number;
  /** Number of self-multiply luminance threshold passes (1 = soft/wide, 2 = crisp bright-only, 3 = highlights only) */
  thresholdPasses?: number;
  /** 0..1 pre-dim factor before thresholding (prevents bright daytime skies from blooming) */
  bloomPreDim?: number;
  /** 0..1 subtle horizontal anamorphic streak intensity on bright highlights */
  anamorphicStrength?: number;
  /** 0..1 radial vignette strength */
  vignetteStrength?: number;
  /** 0..1 subtle anti-banding film grain / micro-dither strength */
  grainStrength?: number;
  /** 0..1 color grading saturation/contrast boost */
  gradeStrength?: number;
  /** 0..1 dynamic flash/ignition boost (e.g. during rocket launch or separation) */
  flareBoost?: number;
  /** Optional blend factor 0..1 from launch_day toward space during ascent */
  spaceBlend?: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function createOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/**
 * Reusable high-performance 2D Canvas post-processing pipeline:
 * 1) Multi-scale pyramid bloom (1/4 -> 1/8 -> 1/16) with GPU self-multiply luminance thresholding
 * 2) Optional subtle horizontal anamorphic flare & warm optical halation
 * 3) Filmic color grading (deep cool shadows, luminous highlights)
 * 4) Smooth radial vignette
 * 5) Tileable anti-banding micro-grain pattern
 */
export class PostProcessPipeline {
  private qCanvas: HTMLCanvasElement;
  private qCtx: CanvasRenderingContext2D | null;
  private eCanvas: HTMLCanvasElement;
  private eCtx: CanvasRenderingContext2D | null;
  private sCanvas: HTMLCanvasElement;
  private sCtx: CanvasRenderingContext2D | null;
  private hStreakCanvas: HTMLCanvasElement;
  private hStreakCtx: CanvasRenderingContext2D | null;

  private grainPattern: CanvasPattern | null = null;
  private vignetteCanvas: HTMLCanvasElement | null = null;
  private lastW = 0;
  private lastH = 0;
  private lastVignetteKey = '';

  constructor() {
    this.qCanvas = createOffscreenCanvas(2, 2);
    this.qCtx = this.qCanvas.getContext('2d');
    this.eCanvas = createOffscreenCanvas(2, 2);
    this.eCtx = this.eCanvas.getContext('2d');
    this.sCanvas = createOffscreenCanvas(2, 2);
    this.sCtx = this.sCanvas.getContext('2d');
    this.hStreakCanvas = createOffscreenCanvas(2, 2);
    this.hStreakCtx = this.hStreakCanvas.getContext('2d');
  }

  private ensureSize(w: number, h: number) {
    if (this.lastW === w && this.lastH === h) return;
    this.lastW = w;
    this.lastH = h;

    const qw = Math.max(2, Math.floor(w / 4));
    const qh = Math.max(2, Math.floor(h / 4));
    this.qCanvas.width = qw;
    this.qCanvas.height = qh;

    const ew = Math.max(2, Math.floor(w / 8));
    const eh = Math.max(2, Math.floor(h / 8));
    this.eCanvas.width = ew;
    this.eCanvas.height = eh;

    const sw = Math.max(2, Math.floor(w / 16));
    const sh = Math.max(2, Math.floor(h / 16));
    this.sCanvas.width = sw;
    this.sCanvas.height = sh;

    // Wide horizontal / thin vertical buffer for subtle anamorphic star/flame streaks
    this.hStreakCanvas.width = Math.max(2, Math.floor(w / 6));
    this.hStreakCanvas.height = Math.max(2, Math.floor(h / 24));
  }

  private ensureGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.grainPattern) return this.grainPattern;
    const size = 128;
    const gc = createOffscreenCanvas(size, size);
    const gctx = gc.getContext('2d');
    if (!gctx) return null;

    const img = gctx.createImageData(size, size);
    const d = img.data;
    let seed = 918273;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < d.length; i += 4) {
      // Triangular noise distribution centered at mid-grey for soft-light / overlay anti-banding
      const n = (rand() + rand()) * 0.5;
      const v = Math.round(n * 255);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = Math.min(255, v + 6);
      d[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    this.grainPattern = ctx.createPattern(gc, 'repeat');
    return this.grainPattern;
  }

  private ensureVignette(w: number, h: number, strength: number): HTMLCanvasElement | null {
    const qStrength = Math.round(strength * 100);
    const key = `${w}x${h}_${qStrength}`;
    if (this.vignetteCanvas && this.lastVignetteKey === key) {
      return this.vignetteCanvas;
    }
    this.lastVignetteKey = key;

    if (!this.vignetteCanvas) {
      this.vignetteCanvas = createOffscreenCanvas(w, h);
    } else {
      this.vignetteCanvas.width = w;
      this.vignetteCanvas.height = h;
    }
    const vctx = this.vignetteCanvas.getContext('2d');
    if (!vctx) return null;

    const cx = w * 0.5;
    const cy = h * 0.5;
    const outerR = Math.hypot(cx, cy);
    const grad = vctx.createRadialGradient(cx, cy, outerR * 0.42, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(4, 7, 15, 0)');
    grad.addColorStop(0.65, `rgba(4, 7, 15, ${(strength * 0.24).toFixed(3)})`);
    grad.addColorStop(1, `rgba(3, 5, 12, ${(strength * 0.86).toFixed(3)})`);

    vctx.clearRect(0, 0, w, h);
    vctx.fillStyle = grad;
    vctx.fillRect(0, 0, w, h);
    return this.vignetteCanvas;
  }

  public apply(
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    options: PostProcessOptions = {}
  ) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    if (w < 8 || h < 8) return;

    this.ensureSize(w, h);

    const preset = options.preset ?? 'space';
    const spaceBlend = clamp01(options.spaceBlend ?? (preset === 'space' ? 1 : 0));
    const flareBoost = clamp01(options.flareBoost ?? 0);
    const bloomStrength = clamp01((options.bloomStrength ?? 0.5) + flareBoost * 0.35);
    const thresholdPasses = Math.max(1, Math.min(3, options.thresholdPasses ?? 2));
    const bloomPreDim = clamp01(
      options.bloomPreDim ?? (preset === 'launch_day' && spaceBlend < 0.5 ? 0.78 : 1.0)
    );
    const anamorphicStrength = clamp01(
      (options.anamorphicStrength ?? 0.18) + flareBoost * 0.25
    );
    const vignetteStrength = clamp01(options.vignetteStrength ?? 0.52);
    const grainStrength = clamp01(options.grainStrength ?? 0.045);
    const gradeStrength = clamp01(options.gradeStrength ?? 0.38);

    // ------------------------------------------------------------------------
    // 1. MULTI-SCALE PYRAMID BLOOM WITH GPU SELF-MULTIPLY THRESHOLDING
    // ------------------------------------------------------------------------
    if (
      bloomStrength > 0.01 &&
      this.qCtx &&
      this.eCtx &&
      this.sCtx
    ) {
      const qw = this.qCanvas.width;
      const qh = this.qCanvas.height;
      const ew = this.eCanvas.width;
      const eh = this.eCanvas.height;
      const sw = this.sCanvas.width;
      const sh = this.sCanvas.height;

      // Downsample source -> 1/4 (pre-dimmed against black if needed so midtone sky won't bloom)
      this.qCtx.save();
      this.qCtx.globalCompositeOperation = 'source-over';
      this.qCtx.imageSmoothingEnabled = true;
      this.qCtx.imageSmoothingQuality = 'medium';
      this.qCtx.fillStyle = '#000000';
      this.qCtx.fillRect(0, 0, qw, qh);
      this.qCtx.globalAlpha = bloomPreDim;
      this.qCtx.drawImage(sourceCanvas, 0, 0, qw, qh);
      this.qCtx.globalAlpha = 1;

      // Self-multiply squares RGB values -> smooth HDR luminance threshold (dark stays black)
      this.qCtx.globalCompositeOperation = 'multiply';
      for (let p = 0; p < thresholdPasses; p++) {
        this.qCtx.drawImage(this.qCanvas, 0, 0, qw, qh);
      }
      this.qCtx.restore();

      // Downsample 1/4 -> 1/8
      this.eCtx.save();
      this.eCtx.globalCompositeOperation = 'source-over';
      this.eCtx.imageSmoothingEnabled = true;
      this.eCtx.clearRect(0, 0, ew, eh);
      this.eCtx.drawImage(this.qCanvas, 0, 0, ew, eh);
      this.eCtx.restore();

      // Downsample 1/8 -> 1/16
      this.sCtx.save();
      this.sCtx.globalCompositeOperation = 'source-over';
      this.sCtx.imageSmoothingEnabled = true;
      this.sCtx.clearRect(0, 0, sw, sh);
      this.sCtx.drawImage(this.eCanvas, 0, 0, sw, sh);
      this.sCtx.restore();

      // Subtle anamorphic streak buffer from thresholded highlights
      if (anamorphicStrength > 0.01 && this.hStreakCtx) {
        const hw = this.hStreakCanvas.width;
        const hh = this.hStreakCanvas.height;
        this.hStreakCtx.save();
        this.hStreakCtx.globalCompositeOperation = 'source-over';
        this.hStreakCtx.imageSmoothingEnabled = true;
        this.hStreakCtx.clearRect(0, 0, hw, hh);
        this.hStreakCtx.drawImage(this.eCanvas, 0, 0, hw, hh);
        this.hStreakCtx.restore();
      }

      // Composite Bloom layers back onto main canvas
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Tight core bloom (1/8) via 'screen' (prevents clipping)
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp01(bloomStrength * 0.62);
      ctx.drawImage(this.eCanvas, 0, 0, w, h);

      // Wide atmospheric halo (1/16) via 'lighter' for luminous space/engine glow
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp01(bloomStrength * 0.44);
      ctx.drawImage(this.sCanvas, 0, 0, w, h);

      // Subtle horizontal anamorphic flare on bright lights (Sun, flames, stars)
      if (anamorphicStrength > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp01(anamorphicStrength * 0.28);
        ctx.drawImage(this.hStreakCanvas, 0, 0, w, h);
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // 2. FILMIC COLOR GRADING (Deep Sapphire Shadows + Luminous Highlights)
    // ------------------------------------------------------------------------
    if (gradeStrength > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = gradeStrength;

      const gradeGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (preset === 'launch_day' && spaceBlend < 0.5) {
        const k = 1 - spaceBlend * 2;
        gradeGrad.addColorStop(0, `rgba(186, 230, 253, ${(0.38 * k).toFixed(3)})`);
        gradeGrad.addColorStop(0.55, `rgba(254, 243, 199, ${(0.22 * k).toFixed(3)})`);
        gradeGrad.addColorStop(1, `rgba(15, 23, 42, ${(0.52 * k).toFixed(3)})`);
      } else if (preset === 'lunar') {
        gradeGrad.addColorStop(0, 'rgba(148, 163, 184, 0.25)');
        gradeGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.22)');
        gradeGrad.addColorStop(1, 'rgba(7, 10, 22, 0.55)');
      } else {
        // Space preset: rich deep indigo-teal shadows + subtle warm highlight lift
        gradeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
        gradeGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.24)');
        gradeGrad.addColorStop(1, 'rgba(6, 9, 24, 0.58)');
      }
      ctx.fillStyle = gradeGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // 3. CINEMATIC RADIAL VIGNETTE
    // ------------------------------------------------------------------------
    if (vignetteStrength > 0.01) {
      const vig = this.ensureVignette(w, h, vignetteStrength);
      if (vig) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(vig, 0, 0, w, h);
        ctx.restore();
      }
    }

    // ------------------------------------------------------------------------
    // 4. ANTI-BANDING FILM GRAIN / MICRO-DITHER PATTERN
    // ------------------------------------------------------------------------
    if (grainStrength > 0.005) {
      const pat = this.ensureGrainPattern(ctx);
      if (pat) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = grainStrength;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
  }
}
