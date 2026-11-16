export const UI_HOVER_SFX_SRC =
  '/assets/aistudio/soundshelfstudio-sci-fi-ui-hover-596257_14ff4d1c.mp3';
export const UI_CLICK_SFX_SRC =
  '/assets/aistudio/mixkit-sci-fi-click-900_54c192b2.wav';
export const LAUNCH_FAIL_SFX_SRC =
  '/assets/aistudio/830171__mariov360__bae-125-800a-takeoff.mp3_-_merged__1__362efa5c.mp3';
export const DOCKING_CONNECT_SFX_SRC =
  '/assets/aistudio/859154__qubodup__loud-bang-crashing-metal-chunk-dropped-in-metal-dumpster__1__70554c8a.flac';

let uiMasterVolume = 1;

function createSfxPool(src: string, baseVolume: number, size = 3): () => void {
  const pool: HTMLAudioElement[] = [];
  let cursor = 0;
  let initialized = false;

  const ensurePool = () => {
    if (initialized || typeof Audio === 'undefined') return;
    initialized = true;
    for (let i = 0; i < size; i++) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = Math.max(0, Math.min(1, baseVolume * uiMasterVolume));
      pool.push(a);
    }
  };

  return () => {
    if (uiMasterVolume <= 0.001) return;
    ensurePool();
    if (pool.length === 0) return;
    const audio = pool[cursor % pool.length];
    cursor = (cursor + 1) % pool.length;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, baseVolume * uiMasterVolume));
      audio.play().catch(() => {
        // Ignore browser autoplay restrictions prior to first gesture
      });
    } catch {
      // Ignore audio playback errors
    }
  };
}

const triggerHover = createSfxPool(UI_HOVER_SFX_SRC, 0.5, 3);
const triggerClick = createSfxPool(UI_CLICK_SFX_SRC, 0.22, 3);
const triggerDockingConnect = createSfxPool(DOCKING_CONNECT_SFX_SRC, 0.68, 2);

let lastHoverTs = 0;

export function setUiSfxVolume(volume: number): void {
  uiMasterVolume = Math.max(0, Math.min(1, volume));
}

export function preloadUiSfx(): void {
  if (typeof Audio === 'undefined') return;
  const h = new Audio(UI_HOVER_SFX_SRC);
  h.preload = 'auto';
  const c = new Audio(UI_CLICK_SFX_SRC);
  c.preload = 'auto';
  const d = new Audio(DOCKING_CONNECT_SFX_SRC);
  d.preload = 'auto';
}

export function playUiHoverSfx(): void {
  const now = performance.now();
  if (now - lastHoverTs < 35) return;
  lastHoverTs = now;
  triggerHover();
}

export function playUiClickSfx(): void {
  triggerClick();
}

export function playDockingConnectSfx(): void {
  triggerDockingConnect();
}
