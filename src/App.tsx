import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Battery,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  DollarSign,
  FlaskConical,
  Fuel,
  Globe,
  Info,
  Layers,
  Lightbulb,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Radio,
  Rocket,
  RotateCcw,
  Scale,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Unlock,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  AVAILABLE_PARTS,
  LAUNCHERS,
  PART_UNLOCK_LEVEL_MAP,
  PROGRESSION_LEVELS,
  THEMES,
  getLocalizedLauncherName,
  getLocalizedLevel,
  getLocalizedLevels,
  getLocalizedPartName,
  getPartKeyStat,
  getShortPartSummary,
} from './data/gameData';
import { Language, useLanguage } from './i18n/LanguageContext';
import { calculateMission } from './engine/missionCalculator';
import { MissionOperation, buildEndingMeta } from './engine/missionOperation';
import {
  DesignHelperKey,
  LaunchAbortReason,
  LaunchOutcome,
  LaunchTelemetry,
  LogKind,
  MissionEndingMeta,
  PartData,
  PartType,
  ProgressionLevel,
  ProgressionState,
  RocketAssemblyState,
} from './types/game';
import { OrbitMapCanvas } from './components/OrbitMapCanvas';
import { LaunchCanvas } from './components/LaunchCanvas';
import { StoryIntroView } from './components/StoryIntroView';
import {
  ElDiarioGlobalPaper,
  EndingLevelInfo,
  StoryEndingView,
} from './components/StoryEndingView';
import { OperationMinigames } from './components/OperationMinigames';
import { PixelEarthGalaxyCanvas } from './components/PixelEarthGalaxyCanvas';
import { DirectorHud, DirectorReaction } from './components/DirectorHud';
import { SevenSegmentCounter } from './components/SevenSegmentCounter';
import {
  LAUNCH_FAIL_SFX_SRC,
  playUiClickSfx,
  playUiHoverSfx,
  preloadUiSfx,
  setUiSfxVolume,
} from './utils/uiAudio';

const OPERATION_STEPS_PER_SECOND = 2.8;
function getStepsPerSecondForLevel(level: number): number {
  if (level === 1) return 0.55; // 8 pasos ≈ 14.5s (3h por paso)
  if (level === 2) return 1.05; // 16 pasos ≈ 15.2s
  if (level === 3) return 1.45; // 24 pasos ≈ 16.5s
  return OPERATION_STEPS_PER_SECOND; // Nivel 4: 40 pasos ≈ 14.3s + minijuegos
}
const OP_SPEED_LABELS = ['x1', 'x3', 'x10'];
const OP_SPEED_MULTIPLIERS = [1, 3, 10];
const TRANSITION_DURATION_MS = 1150;
const INTRO_TRANSITION_MS = 1450;
const PROGRESSION_STORAGE_KEY = 'mk11_progression_v1';
const BGM_STORAGE_KEY = 'mk11_bgm_muted_v1';
const VOLUME_STORAGE_KEY = 'mk11_master_volume_v1';
const BGM_SRC = '/assets/aistudio/WhatsApp_Audio_2026-11-15_at_09.30.18_a11b8338.mpeg';
const WIN_MUSIC_SRC = '/assets/aistudio/WhatsApp_Audio_2026-11-15_at_11.42.47_8856ff38.mpeg';
const LOSE_MUSIC_SRC = '/assets/aistudio/WhatsApp_Audio_2026-11-15_at_11.21.07_f4eb4e9b.mpeg';
const LAUNCH_COUNTDOWN_AUDIO_SRC =
  '/assets/aistudio/667728__falisca__el-falkon8.wav_-_Selected_audio_091b6fbc.mp3';

function getIdleLaunchTelemetry(en: boolean): LaunchTelemetry {
  return {
    outcome: LaunchOutcome.Idle,
    phase: en ? 'Ready to launch' : 'Listo para lanzar',
    resultMessage: '',
    altitudeKm: 0,
    speedKms: 0,
    deltaVBurned: 0,
    deltaVRequired: 0,
    countdownRemaining: 10,
    abortReason: null,
  };
}

const DEFAULT_PROGRESSION: ProgressionState = {
  maxUnlockedLevel: 1,
  activeLevel: 1,
  completedLevels: [],
  firstLiftoffDone: false,
};

function loadProgressionState(): ProgressionState {
  try {
    const raw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESSION;
    const parsed = JSON.parse(raw) as Partial<ProgressionState>;
    const maxUnlocked = Math.max(
      1,
      Math.min(PROGRESSION_LEVELS.length, Number(parsed.maxUnlockedLevel) || 1)
    );
    const active = Math.max(
      1,
      Math.min(maxUnlocked, Number(parsed.activeLevel) || maxUnlocked)
    );
    const completed = Array.isArray(parsed.completedLevels)
      ? parsed.completedLevels.filter(
          (n): n is number =>
            typeof n === 'number' && n >= 1 && n <= PROGRESSION_LEVELS.length
        )
      : [];
    return {
      maxUnlockedLevel: maxUnlocked,
      activeLevel: active,
      completedLevels: completed,
      firstLiftoffDone: Boolean(parsed.firstLiftoffDone),
    };
  } catch {
    return DEFAULT_PROGRESSION;
  }
}

type ScreenMode = 'menu' | 'story' | 'simulator' | 'ending';
type GamePhase = 'launch' | 'transition' | 'operation';

function buildImprovementHints(
  res: ReturnType<typeof calculateMission>,
  parts: PartData[],
  level: ProgressionLevel,
  op: MissionOperation | null,
  lang: Language = 'es'
): string[] {
  const en = lang === 'en';
  const hints: string[] = [];
  const hasStructure = parts.some((p) => p.type === PartType.Structure);
  const hasFuel = res.fuelMassKg > 0;
  const hasComputer = parts.some((p) => p.type === PartType.Computer);
  const hasShielding = parts.some((p) => p.type === PartType.Shielding);
  const hasAntenna = parts.some((p) => p.type === PartType.Antenna);
  const hasCamera = parts.some((p) => p.id === 'camara-hd');
  const hasEASEP = parts.some((p) => p.id === 'paquete-easep');

  if (!hasStructure) {
    hints.push(
      en
        ? 'Install the CSM / Eagle Structure to give structural strength to the entire rocket.'
        : 'Instala la Estructura CSM / Eagle para dar resistencia estructural a toda la nave.'
    );
  }
  if (!hasFuel) {
    hints.push(
      en
        ? 'Add at least one Propellant Tank (TLI/DPS) for thrust and ΔV.'
        : 'Añade al menos un Tanque de propelente (TLI/DPS) para tener empuje y ΔV.'
    );
  }
  if (res.totalMassKg > res.launcherCapacityKg) {
    const excess = Math.ceil(res.totalMassKg - res.launcherCapacityKg);
    hints.push(
      en
        ? `Reduce total mass by ${excess} kg (current: ${res.totalMassKg.toFixed(0)} kg / max: ${res.launcherCapacityKg.toFixed(0)} kg) by removing extra tanks or modules.`
        : `Reduce ${excess} kg de masa total (actual: ${res.totalMassKg.toFixed(0)} kg / máximo: ${res.launcherCapacityKg.toFixed(0)} kg) quitando tanques o módulos extra.`
    );
  }
  if (hasFuel && res.deltaVAvailable < res.deltaVRequired) {
    const missingDv = Math.ceil(res.deltaVRequired - res.deltaVAvailable);
    hints.push(
      en
        ? `Missing ${missingDv} m/s of ΔV (${res.deltaVAvailable.toFixed(0)} / ${res.deltaVRequired.toFixed(0)} m/s): add another Propellant Tank or reduce dry mass.`
        : `Faltan ${missingDv} m/s de ΔV (${res.deltaVAvailable.toFixed(0)} / ${res.deltaVRequired.toFixed(0)} m/s): añade otro Tanque de propelente o reduce peso seco.`
    );
  }
  const genW = res.solarWatts + res.rtgWatts;
  if (genW < res.consumptionWatts) {
    hints.push(
      en
        ? `Increase power generation: producing ${genW.toFixed(0)} W while systems draw ${res.consumptionWatts.toFixed(0)} W (add Solar Panels or RTG).`
        : `Aumenta la generación eléctrica: generas ${genW.toFixed(0)} W y los sistemas consumen ${res.consumptionWatts.toFixed(0)} W (añade Paneles solares o RTG).`
    );
  }
  if (level.level >= 2 && res.energyNeededInEclipseWh > res.batteryWh) {
    hints.push(
      en
        ? `You need more Battery capacity for eclipse shadow (${res.batteryWh.toFixed(0)} / ${res.energyNeededInEclipseWh.toFixed(0)} Wh required).`
        : `Necesitas más capacidad de Batería para el eclipse (${res.batteryWh.toFixed(0)} / ${res.energyNeededInEclipseWh.toFixed(0)} Wh requeridos).`
    );
  }
  if (level.level >= 3 && (!hasComputer || !hasShielding || op?.lostAllComputersInFlight)) {
    hints.push(
      en
        ? 'Equip Heat Shield / armor and an AGC Computer (ideally Redundant AGC) to withstand solar storms.'
        : 'Equipa Escudo térmico / blindaje y una Computadora AGC (idealmente AGC redundante) para resistir tormentas solares.'
    );
  }
  if (!hasAntenna || (op && op.outageStepsTotal > 0)) {
    hints.push(
      en
        ? 'Equip an S-Band Antenna (or dual antennas) to prevent link outages and transmit all science.'
        : 'Equipa una Antena Banda S (o doble antena) para evitar cortes de enlace y transmitir toda la ciencia.'
    );
  }
  if (level.level >= 2 && !hasCamera) {
    hints.push(
      en
        ? 'Equip the Hasselblad Camera to take photos and meet the science objective.'
        : 'Equipa la Cámara Hasselblad para fotografiar y cumplir el objetivo científico.'
    );
  }
  if (level.level >= 4 && !hasEASEP) {
    hints.push(
      en
        ? 'Include the EASEP Package and Lunar Samples to complete surface exploration.'
        : 'Incluye el Paquete EASEP y Muestras lunares para completar la exploración de superficie.'
    );
  }
  if (res.totalCost > res.budget) {
    hints.push(
      en
        ? `Over budget ($${res.totalCost.toFixed(1)}M / $${res.budget.toFixed(0)}M): optimize modules to lower cost.`
        : `Superas el presupuesto ($${res.totalCost.toFixed(1)}M / $${res.budget.toFixed(0)}M): optimiza módulos para bajar el costo.`
    );
  }
  return hints;
}

export default function App() {
  const { lang, setLang } = useLanguage();
  const en = lang === 'en';
  const [screen, setScreen] = useState<ScreenMode>('menu');
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cheatCode, setCheatCode] = useState('');
  const [cheatFeedback, setCheatFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('launch');
  const [designMenuOpen, setDesignMenuOpen] = useState(false);
  const [showOpDetails, setShowOpDetails] = useState(false);

  // Fullscreen state synchronized with browser fullscreenchange
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setFullscreenError(null);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    setFullscreenError(null);
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          setFullscreenError(
            en
              ? 'Your browser does not support fullscreen mode.'
              : 'Tu navegador no admite pantalla completa.'
          );
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreenError(
        en
          ? 'The current browser or frame does not allow fullscreen mode.'
          : 'El navegador o marco actual no permite pantalla completa.'
      );
    }
  }, [en]);

  // Persistent background music & master volume across menu, story, simulator, and ending
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(BGM_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [masterVolume, setMasterVolume] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      if (raw === null) return 1;
      const num = Number(raw);
      return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 1;
    } catch {
      return 1;
    }
  });
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const outcomeAudioRef = useRef<HTMLAudioElement | null>(null);
  const launchAudioRef = useRef<HTMLAudioElement | null>(null);
  const launchFailAudioRef = useRef<HTMLAudioElement | null>(null);
  const failSfxFiredLaunchIdRef = useRef<number>(0);
  const launchFadeRafRef = useRef<number | null>(null);
  const activeMusicTrackRef = useRef<'bgm' | 'win' | 'lose'>('bgm');
  const isMusicMutedRef = useRef(isMusicMuted);
  isMusicMutedRef.current = isMusicMuted;
  const masterVolumeRef = useRef(masterVolume);
  masterVolumeRef.current = masterVolume;

  const stopLaunchFailAudio = useCallback(() => {
    const fa = launchFailAudioRef.current;
    if (!fa) return;
    fa.pause();
    fa.src = '';
    launchFailAudioRef.current = null;
  }, []);

  const stopLaunchAudio = useCallback(() => {
    if (launchFadeRafRef.current !== null) {
      cancelAnimationFrame(launchFadeRafRef.current);
      launchFadeRafRef.current = null;
    }
    const la = launchAudioRef.current;
    if (!la) return;
    la.pause();
    la.src = '';
    launchAudioRef.current = null;
  }, []);

  useEffect(() => {
    const audio = new Audio(BGM_SRC);
    audio.loop = true;
    audio.volume = 0.42 * masterVolumeRef.current;
    audio.muted = isMusicMutedRef.current;
    bgmAudioRef.current = audio;

    const tryStart = () => {
      if (
        !bgmAudioRef.current ||
        isMusicMutedRef.current ||
        activeMusicTrackRef.current !== 'bgm'
      ) {
        return;
      }
      bgmAudioRef.current.play().catch(() => {
        // Autoplay policy will unlock on first user interaction
      });
    };

    tryStart();

    const unlockOnGesture = () => {
      tryStart();
      if (bgmAudioRef.current && !bgmAudioRef.current.paused) {
        window.removeEventListener('pointerdown', unlockOnGesture);
        window.removeEventListener('keydown', unlockOnGesture);
      }
    };

    window.addEventListener('pointerdown', unlockOnGesture);
    window.addEventListener('keydown', unlockOnGesture);

    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
      audio.pause();
      audio.src = '';
      bgmAudioRef.current = null;
      if (outcomeAudioRef.current) {
        outcomeAudioRef.current.pause();
        outcomeAudioRef.current.src = '';
        outcomeAudioRef.current = null;
      }
      if (launchFadeRafRef.current !== null) {
        cancelAnimationFrame(launchFadeRafRef.current);
        launchFadeRafRef.current = null;
      }
      if (launchAudioRef.current) {
        launchAudioRef.current.pause();
        launchAudioRef.current.src = '';
        launchAudioRef.current = null;
      }
      if (launchFailAudioRef.current) {
        launchFailAudioRef.current.pause();
        launchFailAudioRef.current.src = '';
        launchFailAudioRef.current = null;
      }
    };
  }, []);

  // Preload & play sci-fi hover (1st sound) and click (2nd sound) across menu options & UI buttons
  useEffect(() => {
    preloadUiSfx();
    let lastHoveredBtn: Element | null = null;

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const target = e.target as HTMLElement | null;
      const btn =
        target?.closest('button:not(:disabled), [role="button"]:not([aria-disabled="true"])') ??
        null;
      if (btn !== lastHoveredBtn) {
        lastHoveredBtn = btn;
        if (btn) {
          playUiHoverSfx();
        }
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(
        'button:not(:disabled), [role="button"]:not([aria-disabled="true"])'
      );
      if (btn) {
        playUiClickSfx();
      }
    };

    window.addEventListener('pointerover', onPointerOver, { passive: true });
    window.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('pointerover', onPointerOver);
      window.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(BGM_STORAGE_KEY, isMusicMuted ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
    const audio = bgmAudioRef.current;
    if (audio) {
      audio.muted = isMusicMuted;
      if (!isMusicMuted && activeMusicTrackRef.current === 'bgm' && audio.paused) {
        audio.play().catch(() => {});
      }
    }
    const outcomeAudio = outcomeAudioRef.current;
    if (outcomeAudio) {
      outcomeAudio.muted = isMusicMuted;
      if (
        !isMusicMuted &&
        activeMusicTrackRef.current !== 'bgm' &&
        outcomeAudio.paused &&
        !outcomeAudio.ended
      ) {
        outcomeAudio.play().catch(() => {});
      }
    }
    const launchAudio = launchAudioRef.current;
    if (launchAudio) {
      launchAudio.muted = isMusicMuted;
      if (!isMusicMuted && launchAudio.paused && !launchAudio.ended) {
        launchAudio.play().catch(() => {});
      }
    }
    const launchFailAudio = launchFailAudioRef.current;
    if (launchFailAudio) {
      launchFailAudio.muted = isMusicMuted;
      if (!isMusicMuted && launchFailAudio.paused && !launchFailAudio.ended) {
        launchFailAudio.play().catch(() => {});
      }
    }
    setUiSfxVolume(isMusicMuted ? 0 : masterVolume);
  }, [isMusicMuted, masterVolume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(masterVolume));
    } catch {
      // Ignore storage errors
    }
    const bgm = bgmAudioRef.current;
    if (bgm && launchFadeRafRef.current === null) {
      bgm.volume = 0.42 * masterVolume;
    }
    const outcomeAudio = outcomeAudioRef.current;
    if (outcomeAudio) {
      outcomeAudio.volume = 0.55 * masterVolume;
    }
    const launchAudio = launchAudioRef.current;
    if (launchAudio && launchFadeRafRef.current === null) {
      launchAudio.volume = 0.72 * masterVolume;
    }
    const launchFailAudio = launchFailAudioRef.current;
    if (launchFailAudio) {
      launchFailAudio.volume = 0.78 * masterVolume;
    }
  }, [masterVolume]);

  const handleVolumeChange = useCallback((nextVal: number) => {
    const clamped = Math.max(0, Math.min(1, nextVal));
    setMasterVolume(clamped);
    if (clamped === 0) {
      setIsMusicMuted(true);
    } else if (isMusicMutedRef.current) {
      setIsMusicMuted(false);
    }
  }, []);

  const toggleMusicMute = useCallback(() => {
    const next = !isMusicMutedRef.current;
    setIsMusicMuted(next);
    if (!next && masterVolumeRef.current === 0) {
      setMasterVolume(0.75);
    }
    const audio = bgmAudioRef.current;
    if (audio) {
      audio.muted = next;
      if (!next && activeMusicTrackRef.current === 'bgm' && audio.paused) {
        audio.play().catch(() => {});
      }
    }
    const outcomeAudio = outcomeAudioRef.current;
    if (outcomeAudio) {
      outcomeAudio.muted = next;
      if (
        !next &&
        activeMusicTrackRef.current !== 'bgm' &&
        outcomeAudio.paused &&
        !outcomeAudio.ended
      ) {
        outcomeAudio.play().catch(() => {});
      }
    }
    const launchAudio = launchAudioRef.current;
    if (launchAudio) {
      launchAudio.muted = next;
      if (!next && launchAudio.paused && !launchAudio.ended) {
        launchAudio.play().catch(() => {});
      }
    }
    const launchFailAudio = launchFailAudioRef.current;
    if (launchFailAudio) {
      launchFailAudio.muted = next;
      if (!next && launchFailAudio.paused && !launchFailAudio.ended) {
        launchFailAudio.play().catch(() => {});
      }
    }
  }, []);

  // Blueprint state (starts empty so there is no rocket on the pad yet)
  const [design, setDesign] = useState<PartData[]>([]);
  const [designResetKey, setDesignResetKey] = useState(0);

  // Inline part inspector + filter state (never floats over UI)
  const [inspectedPart, setInspectedPart] = useState<PartData | null>(null);
  const [partFilter, setPartFilter] = useState<'all' | 'flight' | 'power' | 'science'>('all');
  const [showLockedParts, setShowLockedParts] = useState(false);

  // Launch state
  const [launchCmd, setLaunchCmd] = useState<{
    id: number;
    action: 'prepare' | 'launch';
    result?: ReturnType<typeof calculateMission>;
    orbitName?: string;
    assembly?: RocketAssemblyState;
    disableFailures?: boolean;
  }>({ id: 1, action: 'prepare' });
  const [launchTelemetry, setLaunchTelemetry] = useState<LaunchTelemetry>(() =>
    getIdleLaunchTelemetry(en)
  );
  useEffect(() => {
    setLaunchTelemetry((prev) =>
      prev.outcome === LaunchOutcome.Idle
        ? { ...prev, phase: en ? 'Ready to launch' : 'Listo para lanzar' }
        : prev
    );
  }, [en]);
  const [showLaunchHints, setShowLaunchHints] = useState(false);
  const [ledMounted, setLedMounted] = useState(false);
  const [ledVisible, setLedVisible] = useState(false);

  const isCountdownCounting =
    screen === 'simulator' &&
    gamePhase === 'launch' &&
    !designMenuOpen &&
    launchTelemetry.outcome === LaunchOutcome.Running &&
    launchTelemetry.abortReason !== 'no_fuel' &&
    launchTelemetry.abortReason !== 'incomplete' &&
    (launchTelemetry.countdownRemaining ?? 0) > 0;

  useEffect(() => {
    if (
      screen !== 'simulator' ||
      gamePhase !== 'launch' ||
      designMenuOpen ||
      launchTelemetry.outcome === LaunchOutcome.Idle
    ) {
      setLedVisible(false);
      setLedMounted(false);
      return;
    }

    if (isCountdownCounting) {
      setLedMounted(true);
      const raf = requestAnimationFrame(() => {
        setLedVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    setLedVisible(false);
    const timer = window.setTimeout(() => {
      setLedMounted(false);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [screen, gamePhase, designMenuOpen, launchTelemetry.outcome, isCountdownCounting]);

  // Transition progress (0..1) from successful launch to operation & intro to launch
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [introTransitioning, setIntroTransitioning] = useState(false);
  const [introTransitionProg, setIntroTransitionProg] = useState(0);
  const introSwitchedRef = useRef(false);

  // Operation state
  const opRef = useRef<MissionOperation | null>(null);
  const opAccumRef = useRef(0);
  const autoOpenedEndingOpRef = useRef<MissionOperation | null>(null);
  const [opTick, setOpTick] = useState(0);
  const [opSpeedIndex, setOpSpeedIndex] = useState(0);
  const [directorOverride, setDirectorOverride] = useState<DirectorReaction | null>(null);

  // Ending parameters
  const [endingData, setEndingData] = useState<{
    mission: string;
    orbit: string;
    days: number;
    science: number;
    score: number;
    rating: string;
    hasCamera: boolean;
    habitability: string;
    endingMeta?: MissionEndingMeta | null;
    launchStageFailure?: boolean;
    launchAbortReason?: LaunchAbortReason | null;
    scoreLines?: string[];
    advice?: string;
    improvementHints?: string[];
    minScience?: number;
    isFinalMissionSuccess?: boolean;
  }>(() => ({
    mission: en ? 'MK11 Mission: Full Lunar Route' : 'Misión MK11: Ruta Lunar Completa',
    orbit: en
      ? 'MK11 · Full Lunar Route (Figure-8 Trajectory)'
      : 'MK11 · Ruta Lunar Completa (Trayectoria en 8)',
    days: 5,
    science: 110,
    score: 88,
    rating: en ? 'Historic Engineering (NASA Level)' : 'Ingeniería histórica (Nivel NASA)',
    hasCamera: true,
    habitability: en
      ? 'Not naturally habitable: lacks a breathable atmosphere, has direct solar radiation, and extreme temperatures (-170 °C to +120 °C). Only viable inside sealed pressurized bases.'
      : 'No habitable de forma natural: carece de atmósfera respirable, presenta radiación solar directa y temperaturas extremas (-170 °C a +120 °C). Solo viable en bases selladas y presurizadas.',
    endingMeta: null,
    launchStageFailure: false,
    scoreLines: en
      ? [
          'Safe crew return: +40',
          'Scientific data (110 pts): +18.3 of 20',
          '  Launcher mass: margin 18% → +8.2 of 10',
          '  Translunar ΔV: margin 24% → +7.6 of 10',
          '  Budget: margin 30% → +7.0 of 10',
          '  Battery: margin 31% → +6.9 of 10',
        ]
      : [
          'Retorno de la tripulación a salvo: +40',
          'Información científica (110 pts): +18.3 de 20',
          '  Masa del lanzador: margen 18% → +8.2 de 10',
          '  ΔV translunar: margen 24% → +7.6 de 10',
          '  Presupuesto: margen 30% → +7.0 de 10',
          '  Batería: margen 31% → +6.9 de 10',
        ],
    advice: en
      ? 'Flawless design! All systems operated within nominal parameters.'
      : '¡Diseño impecable! Todos los sistemas operaron dentro de los parámetros nominales.',
    minScience: 60,
    isFinalMissionSuccess: false,
  }));

  // Switch between ambient BGM and outcome (victory / defeat) music tracks cleanly
  const isLaunchFailureActive =
    screen === 'simulator' &&
    gamePhase === 'launch' &&
    (launchTelemetry.outcome === LaunchOutcome.LaunchFailed ||
      launchTelemetry.outcome === LaunchOutcome.OrbitFailed);
  const isPadAbortingNow =
    screen === 'simulator' &&
    gamePhase === 'launch' &&
    launchTelemetry.phase.toLowerCase().includes('abort');
  const launchAudioMode: 'playing' | 'fade' | 'stop' =
    screen !== 'simulator' || isPadAbortingNow
      ? 'stop'
      : gamePhase === 'launch' &&
          (launchTelemetry.outcome === LaunchOutcome.Running ||
            launchTelemetry.outcome === LaunchOutcome.Success)
        ? 'playing'
        : (gamePhase === 'transition' || gamePhase === 'operation') &&
            launchTelemetry.outcome === LaunchOutcome.Success
          ? 'fade'
          : 'stop';

  // Play launch-failure / no-fuel abort engine power-down SFX once per failed launch attempt
  useEffect(() => {
    if (screen !== 'simulator' || gamePhase !== 'launch') {
      stopLaunchFailAudio();
      return;
    }
    const failedNow = isPadAbortingNow || isLaunchFailureActive;
    if (!failedNow || launchCmd.action !== 'launch') return;
    if (failSfxFiredLaunchIdRef.current === launchCmd.id) return;
    failSfxFiredLaunchIdRef.current = launchCmd.id;

    stopLaunchFailAudio();
    const fa = new Audio(LAUNCH_FAIL_SFX_SRC);
    fa.volume = 0.78 * masterVolumeRef.current;
    fa.muted = isMusicMutedRef.current;
    const seekStart = () => {
      try {
        if (fa.currentTime < 0.32) {
          fa.currentTime = 0.35;
        }
      } catch {
        // Ignore seek errors before metadata
      }
    };
    fa.addEventListener('loadedmetadata', seekStart, { once: true });
    seekStart();
    fa.addEventListener(
      'ended',
      () => {
        if (launchFailAudioRef.current === fa) {
          launchFailAudioRef.current = null;
        }
      },
      { once: true }
    );
    launchFailAudioRef.current = fa;
    if (!isMusicMutedRef.current) {
      fa.play().catch(() => {});
    }
  }, [
    screen,
    gamePhase,
    isPadAbortingNow,
    isLaunchFailureActive,
    launchCmd.action,
    launchCmd.id,
    stopLaunchFailAudio,
  ]);

  useEffect(() => {
    const bgm = bgmAudioRef.current;
    const mv = masterVolumeRef.current;
    if (launchAudioMode === 'stop') {
      stopLaunchAudio();
      if (bgm) {
        bgm.volume = 0.42 * mv;
      }
      return;
    }

    if (launchAudioMode === 'playing') {
      if (launchFadeRafRef.current !== null) {
        cancelAnimationFrame(launchFadeRafRef.current);
        launchFadeRafRef.current = null;
      }
      if (bgm) {
        bgm.volume = 0.12 * mv;
      }
      return;
    }

    // 'fade': smoothly ramp rocket launch audio down to 0 and BGM back up across transition -> operation
    const la = launchAudioRef.current;
    const startLaunchVol = la ? la.volume : 0;
    const startBgmVol = bgm ? bgm.volume : 0.42 * mv;
    const fadeDurationMs = 2400;
    const startTime = performance.now();

    const stepFade = (now: number) => {
      const t = Math.min(1, (now - startTime) / fadeDurationMs);
      const easeOut = 1 - Math.pow(1 - t, 2);
      const targetBgm = 0.42 * masterVolumeRef.current;

      if (launchAudioRef.current && launchAudioRef.current === la) {
        la.volume = Math.max(0, startLaunchVol * (1 - easeOut));
      }
      if (bgm) {
        bgm.volume = startBgmVol + (targetBgm - startBgmVol) * easeOut;
      }

      if (t < 1) {
        launchFadeRafRef.current = requestAnimationFrame(stepFade);
      } else {
        launchFadeRafRef.current = null;
        if (launchAudioRef.current === la) {
          stopLaunchAudio();
        }
      }
    };

    if (launchFadeRafRef.current !== null) {
      cancelAnimationFrame(launchFadeRafRef.current);
    }
    launchFadeRafRef.current = requestAnimationFrame(stepFade);

    return () => {
      if (launchFadeRafRef.current !== null) {
        cancelAnimationFrame(launchFadeRafRef.current);
        launchFadeRafRef.current = null;
      }
    };
  }, [launchAudioMode, stopLaunchAudio]);

  const isEndingFailureActive =
    screen === 'ending' &&
    Boolean(endingData.launchStageFailure || endingData.endingMeta?.isFailure);
  const activeMusicTrack: 'bgm' | 'win' | 'lose' =
    isLaunchFailureActive || isEndingFailureActive
      ? 'lose'
      : screen === 'ending'
        ? 'win'
        : 'bgm';
  activeMusicTrackRef.current = activeMusicTrack;

  useEffect(() => {
    if (outcomeAudioRef.current) {
      outcomeAudioRef.current.pause();
      outcomeAudioRef.current.src = '';
      outcomeAudioRef.current = null;
    }

    const bgm = bgmAudioRef.current;
    if (activeMusicTrack === 'bgm') {
      if (bgm && !isMusicMutedRef.current && bgm.paused) {
        bgm.play().catch(() => {});
      }
      return;
    }

    if (bgm && !bgm.paused) {
      bgm.pause();
    }

    const src = activeMusicTrack === 'win' ? WIN_MUSIC_SRC : LOSE_MUSIC_SRC;
    const outcomeAudio = new Audio(src);
    outcomeAudio.loop = activeMusicTrack === 'win';
    outcomeAudio.volume = 0.55 * masterVolumeRef.current;
    outcomeAudio.muted = isMusicMutedRef.current;
    outcomeAudioRef.current = outcomeAudio;

    if (!isMusicMutedRef.current) {
      outcomeAudio.play().catch(() => {});
    }

    return () => {
      outcomeAudio.pause();
      outcomeAudio.src = '';
      if (outcomeAudioRef.current === outcomeAudio) {
        outcomeAudioRef.current = null;
      }
    };
  }, [activeMusicTrack]);

  // Progression Campaign state (persisted in localStorage)
  const [progression, setProgression] = useState<ProgressionState>(loadProgressionState);
  const [justUnlockedLevel, setJustUnlockedLevel] = useState<ProgressionLevel | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(progression));
    } catch {
      // Ignore storage quota errors
    }
  }, [progression]);

  const theme = THEMES.Azul;
  const localizedLevels = useMemo(() => getLocalizedLevels(lang), [lang]);
  const currentLevel = useMemo(
    () =>
      localizedLevels.find((l) => l.level === progression.activeLevel) ??
      localizedLevels[0],
    [localizedLevels, progression.activeLevel]
  );
  const displayJustUnlockedLevel = useMemo(
    () => (justUnlockedLevel ? getLocalizedLevel(justUnlockedLevel, lang) : null),
    [justUnlockedLevel, lang]
  );
  const currentLauncher = useMemo(
    () =>
      LAUNCHERS.find((l) => l.id === currentLevel.launcherId) ??
      LAUNCHERS[0] ??
      null,
    [currentLevel.launcherId]
  );
  const currentDestination = currentLevel.destination;
  const currentBriefing = currentLevel.briefing;
  const unlockedPartsSet = useMemo(
    () => new Set(currentLevel.unlockedPartIds),
    [currentLevel]
  );
  const unlockedHelpersSet = useMemo(
    () => new Set<DesignHelperKey>(currentLevel.unlockedHelpers),
    [currentLevel]
  );
  const isFinalLunar = currentLevel.level === 4;
  const operationStepsPerSec = getStepsPerSecondForLevel(currentLevel.level);
  const currentLevelInfo = useMemo<EndingLevelInfo>(
    () => ({
      level: currentLevel.level,
      code: currentLevel.code,
      title: currentLevel.title,
      isFinalLunar,
      totalDays: currentBriefing.missionDays,
      distanceKm: currentDestination.distanceKm,
    }),
    [currentLevel, isFinalLunar, currentBriefing.missionDays, currentDestination.distanceKm]
  );

  const result = useMemo(
    () =>
      calculateMission(
        design,
        currentLauncher,
        currentDestination,
        currentBriefing,
        lang
      ),
    [design, currentLauncher, currentDestination, currentBriefing, lang]
  );

  const assembly = useMemo<RocketAssemblyState>(
    () => ({
      hasCore: design.some((p) => p.type === PartType.Structure),
      hasBoosters: design.some((p) => p.type === PartType.Fuel),
      hasFairing: design.some(
        (p) =>
          p.type === PartType.SolarPanel ||
          p.type === PartType.RTG ||
          p.type === PartType.Battery ||
          p.type === PartType.Instrument ||
          p.type === PartType.Shielding
      ),
      hasAvionics: design.some(
        (p) => p.type === PartType.Computer || p.type === PartType.Antenna
      ),
    }),
    [design]
  );

  const builtStageCount =
    Number(assembly.hasCore) +
    Number(assembly.hasBoosters) +
    Number(assembly.hasFairing) +
    Number(assembly.hasAvionics);
  const isRocketComplete = builtStageCount === 4;

  const invalidateSimulation = useCallback(() => {
    stopLaunchFailAudio();
    opRef.current = null;
    opAccumRef.current = 0;
    autoOpenedEndingOpRef.current = null;
    setDirectorOverride(null);
    setShowOpDetails(false);
    setShowLaunchHints(false);
    setOpTick((v) => v + 1);
    setDesignResetKey((v) => v + 1);
    setLaunchTelemetry(getIdleLaunchTelemetry(en));
    setGamePhase('launch');
    setLaunchCmd((prev) => ({ id: prev.id + 1, action: 'prepare' }));
  }, [en, stopLaunchFailAudio]);

  const selectLevel = useCallback(
    (levelNum: number) => {
      if (levelNum < 1 || levelNum > progression.maxUnlockedLevel) return;
      const target =
        PROGRESSION_LEVELS.find((l) => l.level === levelNum) ??
        PROGRESSION_LEVELS[0];
      const allowedParts = new Set(target.unlockedPartIds);
      setProgression((prev) => ({ ...prev, activeLevel: target.level }));
      setDesign((prev) => prev.filter((p) => allowedParts.has(p.id)));
      setJustUnlockedLevel(null);
      invalidateSimulation();
    },
    [progression.maxUnlockedLevel, invalidateSimulation]
  );

  const resetProgression = useCallback(() => {
    setProgression(DEFAULT_PROGRESSION);
    setDesign([]);
    setJustUnlockedLevel(null);
    invalidateSimulation();
  }, [invalidateSimulation]);

  const addPart = (part: PartData) => {
    if (!unlockedPartsSet.has(part.id)) return;
    setDesign((prev) => [...prev, part]);
    invalidateSimulation();
  };

  const removePart = (part: PartData) => {
    setDesign((prev) => {
      const idx = prev.findIndex((p) => p.id === part.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy.splice(idx, 1);
      return copy;
    });
    invalidateSimulation();
  };

  const clearDesign = () => {
    setDesign([]);
    invalidateSimulation();
  };

  const countOf = (part: PartData) =>
    design.reduce((acc, p) => (p.id === part.id ? acc + 1 : acc), 0);

  const startOperation = useCallback(() => {
    const seed = Math.floor(Math.random() * 2147483647);
    const nextOp = new MissionOperation(
      design,
      result,
      currentDestination,
      currentBriefing,
      seed,
      lang
    );
    opRef.current = nextOp;
    autoOpenedEndingOpRef.current = null;
    opAccumRef.current = 0;
    setDirectorOverride(null);
    setShowOpDetails(false);
    setOpTick((v) => v + 1);
  }, [design, result, currentDestination, currentBriefing, lang]);

  const enterLaunchStage = useCallback(
    (openDesign = false) => {
      stopLaunchFailAudio();
      opRef.current = null;
      opAccumRef.current = 0;
      autoOpenedEndingOpRef.current = null;
      setDirectorOverride(null);
      setShowOpDetails(false);
      setShowLaunchHints(false);
      setLaunchTelemetry(getIdleLaunchTelemetry(en));
      setGamePhase('launch');
      setDesignMenuOpen(openDesign);
      setLaunchCmd((prev) => ({ id: prev.id + 1, action: 'prepare' }));
      setScreen('simulator');
      setShowHelp(false);
      setShowSettings(false);
    },
    [en, stopLaunchFailAudio]
  );

  const advanceToNextLevel = useCallback(() => {
    const nextLvlNum = justUnlockedLevel?.level ?? Math.min(4, progression.maxUnlockedLevel);
    const target =
      PROGRESSION_LEVELS.find((l) => l.level === nextLvlNum) ?? PROGRESSION_LEVELS[0];
    const allowedParts = new Set(target.unlockedPartIds);
    setProgression((prev) => ({
      ...prev,
      activeLevel: target.level,
      maxUnlockedLevel: Math.max(prev.maxUnlockedLevel, target.level),
    }));
    setDesign((prev) => prev.filter((p) => allowedParts.has(p.id)));
    setJustUnlockedLevel(null);
    enterLaunchStage(true);
  }, [justUnlockedLevel, progression.maxUnlockedLevel, enterLaunchStage]);

  const triggerLaunch = useCallback(() => {
    if (
      gamePhase !== 'launch' ||
      designMenuOpen ||
      design.length === 0 ||
      launchTelemetry.outcome !== LaunchOutcome.Idle
    ) {
      return;
    }
    setShowLaunchHints(false);
    setJustUnlockedLevel(null);

    stopLaunchFailAudio();
    stopLaunchAudio();

    const willAbortOnPadNow = result.fuelMassKg <= 0 || !isRocketComplete;
    if (!willAbortOnPadNow) {
      const la = new Audio(LAUNCH_COUNTDOWN_AUDIO_SRC);
      la.volume = 0.72 * masterVolumeRef.current;
      la.muted = isMusicMutedRef.current;
      const seekStart = () => {
        try {
          if (la.currentTime < 0.65) {
            la.currentTime = 0.7;
          }
        } catch {
          // Ignore seek errors before metadata
        }
      };
      la.addEventListener('loadedmetadata', seekStart, { once: true });
      seekStart();
      la.addEventListener(
        'ended',
        () => {
          if (launchAudioRef.current === la) {
            launchAudioRef.current = null;
          }
        },
        { once: true }
      );
      launchAudioRef.current = la;
      if (!isMusicMutedRef.current) {
        la.play().catch(() => {});
      }
    }

    setLaunchCmd((prev) => ({
      id: prev.id + 1,
      action: 'launch',
      result,
      orbitName: currentDestination?.name ?? (en ? 'the Moon' : 'la Luna'),
      assembly,
      disableFailures: false,
    }));
  }, [
    gamePhase,
    designMenuOpen,
    design.length,
    launchTelemetry.outcome,
    isRocketComplete,
    result,
    currentDestination,
    assembly,
    stopLaunchAudio,
    stopLaunchFailAudio,
    en,
  ]);

  // Global keyboard shortcuts inside the game viewport ('M' opens/closes Design menu, 'Escape' closes it)
  useEffect(() => {
    if (screen !== 'simulator') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        const launchRunning =
          gamePhase === 'launch' && launchTelemetry.outcome === LaunchOutcome.Running;
        if (launchRunning || gamePhase === 'transition') return;
        e.preventDefault();
        setInspectedPart(null);
        setDesignMenuOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (designMenuOpen) {
          e.preventDefault();
          setInspectedPart(null);
          setDesignMenuOpen(false);
        } else if (showOpDetails) {
          e.preventDefault();
          setShowOpDetails(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, gamePhase, launchTelemetry.outcome, designMenuOpen, showOpDetails]);

  const startIntroToLaunchTransition = useCallback(() => {
    if (introTransitioning) return;
    introSwitchedRef.current = false;
    setIntroTransitionProg(0);
    setIntroTransitioning(true);
  }, [introTransitioning]);

  useEffect(() => {
    if (!introTransitioning) return;
    let rafId = 0;
    const start = performance.now();

    const step = (now: number) => {
      const frac = Math.min(1, (now - start) / INTRO_TRANSITION_MS);
      setIntroTransitionProg(frac);
      if (frac >= 0.48 && !introSwitchedRef.current) {
        introSwitchedRef.current = true;
        enterLaunchStage(false);
      }
      if (frac >= 1) {
        setIntroTransitioning(false);
        return;
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [introTransitioning, enterLaunchStage]);

  // Level 1 trial-and-error liftoff telemetry unlock (NASA: learn from your first liftoff)
  useEffect(() => {
    if (screen !== 'simulator' || gamePhase !== 'launch') return;
    if (!currentLevel.unlockOnFirstLiftoff || progression.firstLiftoffDone) return;

    const liftedOff =
      launchTelemetry.outcome === LaunchOutcome.Success ||
      (launchTelemetry.outcome === LaunchOutcome.LaunchFailed &&
        launchTelemetry.abortReason === 'overweight') ||
      (launchTelemetry.outcome === LaunchOutcome.OrbitFailed &&
        launchTelemetry.abortReason === 'low_dv');

    if (!liftedOff) return;

    const lvl2 = PROGRESSION_LEVELS.find((l) => l.level === 2) ?? null;
    setProgression((prev) => ({
      ...prev,
      firstLiftoffDone: true,
      maxUnlockedLevel: Math.max(prev.maxUnlockedLevel, 2),
    }));
    if (lvl2) setJustUnlockedLevel(lvl2);
  }, [
    screen,
    gamePhase,
    currentLevel.unlockOnFirstLiftoff,
    progression.firstLiftoffDone,
    launchTelemetry.outcome,
    launchTelemetry.abortReason,
  ]);

  // Automatically kick off seamless continuous transition right on Launch -> Operation handoff
  useEffect(() => {
    if (
      screen !== 'simulator' ||
      gamePhase !== 'launch' ||
      designMenuOpen ||
      launchTelemetry.outcome !== LaunchOutcome.Success
    ) {
      return;
    }
    setDesignMenuOpen(false);
    setTransitionProgress(0);
    setGamePhase('transition');
  }, [screen, gamePhase, designMenuOpen, launchTelemetry.outcome]);

  // Animate the seamless TLI crossfade transition into Operation
  useEffect(() => {
    if (screen !== 'simulator' || gamePhase !== 'transition') return;
    let rafId = 0;
    const start = performance.now();

    const step = (now: number) => {
      const frac = Math.min(1, (now - start) / TRANSITION_DURATION_MS);
      setTransitionProgress(frac);
      if (frac >= 1) {
        setGamePhase('operation');
        startOperation();
        return;
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [screen, gamePhase, startOperation]);

  // Operation simulation tick loop (pauses cleanly while Design Hangar is open)
  useEffect(() => {
    if (screen !== 'simulator' || gamePhase !== 'operation' || designMenuOpen) return;
    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const op = opRef.current;
      if (op && !op.finished) {
        opAccumRef.current +=
          dt * operationStepsPerSec * OP_SPEED_MULTIPLIERS[opSpeedIndex];
        let stepped = false;
        while (opAccumRef.current >= 1 && !op.finished) {
          op.stepDay();
          opAccumRef.current -= 1;
          stepped = true;
        }
        if (stepped) setOpTick((v) => v + 1);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [screen, gamePhase, designMenuOpen, opSpeedIndex, operationStepsPerSec]);

  const op = opRef.current;
  void opTick;

  // Open ending automatically when Operation completes & unlock next leveling stage if cleared
  useEffect(() => {
    if (
      screen !== 'simulator' ||
      gamePhase !== 'operation' ||
      designMenuOpen ||
      !op ||
      !op.finished ||
      autoOpenedEndingOpRef.current === op
    ) {
      return;
    }
    const levelCleared =
      op.succeeded &&
      !op.endingMeta?.isFailure &&
      (currentLevel.level <= 2 || op.minScience <= 0 || op.scienceDelivered >= op.minScience);

    if (levelCleared) {
      const nextNum = Math.min(PROGRESSION_LEVELS.length, currentLevel.level + 1);
      const unlockedNew = nextNum > progression.maxUnlockedLevel;
      const nextLevelObj =
        unlockedNew || (currentLevel.level < 4 && !progression.completedLevels.includes(currentLevel.level))
          ? PROGRESSION_LEVELS.find((l) => l.level === nextNum) ?? null
          : null;
      setProgression((prev) => ({
        ...prev,
        maxUnlockedLevel: Math.max(prev.maxUnlockedLevel, nextNum),
        completedLevels: prev.completedLevels.includes(currentLevel.level)
          ? prev.completedLevels
          : [...prev.completedLevels, currentLevel.level],
      }));
      if (nextLevelObj) {
        setJustUnlockedLevel(nextLevelObj);
      }
    }

    const isFail = !op.succeeded || op.endingMeta?.isFailure;
    const opHints = buildImprovementHints(result, design, currentLevel, op, lang);
    const openEnding = () => {
      autoOpenedEndingOpRef.current = op;
      setEndingData({
        mission:
          currentBriefing?.title ??
          (en ? 'MK11 Mission: Full Lunar Route' : 'Misión MK11: Ruta Lunar Completa'),
        orbit:
          currentDestination?.name ??
          (en ? 'MK11 · Full Lunar Route' : 'MK11 · Ruta Lunar Completa'),
        days: op.day,
        science: op.scienceDelivered,
        score: op.score,
        rating: op.rating,
        hasCamera: op.hasCamera,
        habitability: op.habitabilityVerdict,
        endingMeta: op.endingMeta,
        launchStageFailure: false,
        scoreLines: [...op.scoreLines],
        advice: op.advice,
        improvementHints: opHints,
        minScience: op.minScience,
        isFinalMissionSuccess: Boolean(isFinalLunar && levelCleared),
      });
      setScreen('ending');
    };

    if (isFail) {
      openEnding();
      return;
    }
    const timerId = window.setTimeout(openEnding, 650);
    return () => window.clearTimeout(timerId);
  }, [
    screen,
    gamePhase,
    designMenuOpen,
    op,
    opTick,
    result,
    design,
    currentBriefing,
    currentDestination,
    currentLevel,
    progression.maxUnlockedLevel,
    progression.completedLevels,
    isFinalLunar,
    lang,
    en,
  ]);

  const activeSolarWatts = op ? result.solarWatts * op.solarHealth : result.solarWatts;
  const activeOffline = Boolean(op && op.finished && !op.succeeded);

  const introCurtainOpacity = (() => {
    if (!introTransitioning) return 0;
    const f =
      introTransitionProg < 0.48
        ? Math.min(1, introTransitionProg / 0.48)
        : Math.max(0, 1 - (introTransitionProg - 0.48) / 0.52);
    return f * f * (3 - 2 * f);
  })();

  const introBadgeOpacity = !introTransitioning
    ? 0
    : Math.pow(Math.sin(Math.min(1, introTransitionProg) * Math.PI), 1.4);

  const introTransitionOverlay = introTransitioning ? (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-[#040711]"
      style={{ opacity: introCurtainOpacity }}
    >
      <div
        className="glass-panel-gold px-6 py-4 text-center space-y-1.5"
        style={{ opacity: introBadgeOpacity }}
      >
        <div className="font-pixel text-[10px] tracking-[0.22em] uppercase text-[#f8d274]">
          {en ? 'Space Center · MK11' : 'Centro Espacial · MK11'}
        </div>
        <div className="font-display text-lg md:text-xl font-bold text-[#f3f0e6]">
          {en ? 'Deploying Launch Pad...' : 'Desplegando Plataforma de Lanzamiento...'}
        </div>
      </div>
    </div>
  ) : null;

  const floatingMusicBtn = (
    <button
      type="button"
      onClick={toggleMusicMute}
      aria-label={
        isMusicMuted
          ? en
            ? 'Unmute music'
            : 'Activar música'
          : en
            ? 'Mute music'
            : 'Silenciar música'
      }
      title={
        isMusicMuted
          ? en
            ? 'Unmute music'
            : 'Activar música'
          : en
            ? 'Mute music'
            : 'Silenciar música'
      }
      className="fixed top-4 right-4 z-40 p-2.5 glass-btn text-[#f3f0e6] hover:text-[#f8d274] flex items-center justify-center cursor-pointer"
    >
      {isMusicMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );

  if (screen === 'story') {
    return (
      <>
        <StoryIntroView
          launcherCapacityKg={currentLauncher?.capacityKg ?? 1200}
          isMuted={isMusicMuted}
          masterVolume={masterVolume}
          onFinished={startIntroToLaunchTransition}
        />
        {floatingMusicBtn}
        {introTransitionOverlay}
      </>
    );
  }

  if (screen === 'ending') {
    return (
      <>
        <StoryEndingView
          mission={endingData.mission}
          orbit={endingData.orbit}
          days={endingData.days}
          science={endingData.science}
          score={endingData.score}
          rating={endingData.rating}
          hasCamera={endingData.hasCamera}
          habitability={endingData.habitability}
          endingMeta={endingData.endingMeta}
          launchStageFailure={endingData.launchStageFailure}
          launchAbortReason={endingData.launchAbortReason}
          scoreLines={endingData.scoreLines}
          advice={endingData.advice}
          improvementHints={endingData.improvementHints}
          minScience={endingData.minScience}
          levelInfo={currentLevelInfo}
          unlockedNextLevel={displayJustUnlockedLevel}
          isFinalMissionSuccess={endingData.isFinalMissionSuccess}
          isMuted={isMusicMuted}
          masterVolume={masterVolume}
          onAdvanceToNextLevel={advanceToNextLevel}
          onEditDesign={() => {
            enterLaunchStage(true);
          }}
          onFinished={(toMenu) => {
            if (toMenu) {
              if (justUnlockedLevel && justUnlockedLevel.level > progression.activeLevel) {
                const allowedParts = new Set(justUnlockedLevel.unlockedPartIds);
                setProgression((prev) => ({
                  ...prev,
                  activeLevel: justUnlockedLevel.level,
                  maxUnlockedLevel: Math.max(prev.maxUnlockedLevel, justUnlockedLevel.level),
                }));
                setDesign((prev) => prev.filter((p) => allowedParts.has(p.id)));
                setJustUnlockedLevel(null);
              }
              setScreen('menu');
              setShowHelp(false);
            } else {
              setScreen('simulator');
              setGamePhase('operation');
            }
          }}
        />
        {floatingMusicBtn}
      </>
    );
  }

  // ---------- Main Menu (Dead Cells Frameless Title + SpaceX Rotating Pixel Earth) ----------
  if (screen === 'menu') {
    const canAccessLaunchpad =
      progression.completedLevels.includes(1) || progression.maxUnlockedLevel > 1;
    const menuItems = [
      {
        id: 'start',
        label: en ? 'Start New Mission' : 'Iniciar Nueva Misión',
        hint: `${currentLevel.code} · ${currentBriefing.missionDays} ${
          currentBriefing.missionDays === 1 ? (en ? 'Day' : 'Día') : en ? 'Days' : 'Días'
        }`,
        primary: true,
        onClick: () => {
          setShowHelp(false);
          setShowSettings(false);
          setScreen('story');
        },
      },
      ...(canAccessLaunchpad
        ? [
            {
              id: 'simulator',
              label: en ? 'Launch Pad' : 'Plataforma de Lanzamiento',
              hint: en ? `Level ${currentLevel.level}/4 · Design` : `Nivel ${currentLevel.level}/4 · Diseño`,
              primary: false,
              onClick: () => {
                enterLaunchStage(false);
              },
            },
          ]
        : []),
      {
        id: 'manual',
        label: en ? 'Leveling Manual' : 'Manual de Nivelación',
        hint: en ? 'NASA Program' : 'Programa NASA',
        primary: false,
        onClick: () => {
          setShowSettings(false);
          setShowHelp(true);
        },
      },
      {
        id: 'settings',
        label: en ? 'Settings' : 'Ajustes',
        hint: en ? 'Audio · Display · Language' : 'Audio · Pantalla · Idioma',
        primary: false,
        onClick: () => {
          setShowHelp(false);
          setShowSettings(true);
        },
      },
    ];

    return (
      <div
        className="relative w-full h-screen overflow-hidden flex flex-col justify-between select-none"
        style={{ backgroundColor: '#05070d', color: theme.text }}
      >
        {/* Galaxy backdrop + rotating 3D pixel-art Earth (SpaceX style) */}
        <PixelEarthGalaxyCanvas
          highlightColor={theme.highlight}
          accentColor={theme.accent}
        />

        {/* Top-Left Subtle Expedition Tag + Top-Right Audio & Reset Controls */}
        <div className="relative z-20 flex items-center justify-between px-6 md:px-12 pt-5 md:pt-7">
          <div className="font-pixel text-[10px] tracking-[0.2em] uppercase text-[#cbd5e1]/80">
            {en ? 'NASA Campaign · Level' : 'Campaña NASA · Nivel'} {currentLevel.level}/4 (
            {currentLevel.code})
          </div>
          <div className="flex items-center gap-2">
            {(progression.maxUnlockedLevel > 1 || progression.completedLevels.length > 0) && (
              <button
                type="button"
                onClick={resetProgression}
                className="px-3 py-1.5 glass-btn text-[11px] font-display font-semibold text-[#cbd5e1] hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                {en ? 'Reset Progress' : 'Reiniciar Progreso'}
              </button>
            )}
            <button
              type="button"
              onClick={toggleMusicMute}
              aria-label={
                isMusicMuted
                  ? en
                    ? 'Unmute music'
                    : 'Activar música'
                  : en
                    ? 'Mute music'
                    : 'Silenciar música'
              }
              title={
                isMusicMuted
                  ? en
                    ? 'Unmute music'
                    : 'Activar música'
                  : en
                    ? 'Mute music'
                    : 'Silenciar música'
              }
              className="p-2 glass-btn text-[#cbd5e1] hover:text-[#f8d274] flex items-center justify-center cursor-pointer"
            >
              {isMusicMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Top Monumental Title */}
        <header className="relative z-10 flex flex-col items-center text-center px-6 pt-1 md:pt-2 pointer-events-none">
          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-[0.12em] text-[#f3f0e6] leading-none"
            style={{
              textShadow: `0 4px 0 #07090d, 0 0 32px ${theme.highlight}40`,
            }}
          >
            {en ? (
              <>
                MISSION <span style={{ color: '#f8d274' }}>MK11</span>
              </>
            ) : (
              <>
                MISIÓN <span style={{ color: '#f8d274' }}>MK11</span>
              </>
            )}
          </h1>
          <div className="mt-2.5 flex items-center gap-3">
            <span
              className="h-[2px] w-8 md:w-14 inline-block"
              style={{ backgroundColor: theme.highlight }}
            />
            <p className="font-pixel text-[10px] md:text-xs uppercase tracking-[0.28em] text-[#cbd5e1]">
              The Travel Space 2D
            </p>
            <span
              className="h-[2px] w-8 md:w-14 inline-block"
              style={{ backgroundColor: theme.highlight }}
            />
          </div>
        </header>

        <div className="flex-1" />

        {/* Bottom Frameless Dead-Cells-style Main Menu */}
        <footer className="relative z-20 px-6 sm:px-10 md:px-14 pb-8 md:pb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          {showSettings ? (
            <div className="w-full max-w-md pixel-panel p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#323846] pb-3">
                <h2 className="font-display text-lg font-bold text-[#f3f0e6] flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#f8d274]" />
                  {en ? 'Settings' : 'Ajustes'}
                </h2>
                <span className="font-pixel text-[10px] text-[#f8d274]">
                  {en ? 'System' : 'Sistema'}
                </span>
              </div>

              <div className="space-y-4">
                {/* Idioma / Language selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-sm font-bold text-[#f3f0e6] flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#f8d274]" />
                        {en ? 'Language' : 'Idioma'}
                      </div>
                      <div className="font-display text-xs text-[#94a3b8]">
                        {en ? 'English' : 'Español'}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1.5"
                      role="group"
                      aria-label={en ? 'Language selector' : 'Selector de idioma'}
                    >
                      <button
                        type="button"
                        onClick={() => setLang('es')}
                        className={`px-3 py-1.5 font-display font-bold text-xs cursor-pointer ${
                          lang === 'es'
                            ? 'pixel-btn-gold'
                            : 'glass-btn text-[#f3f0e6] hover:text-[#f8d274]'
                        }`}
                      >
                        Español
                      </button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`px-3 py-1.5 font-display font-bold text-xs cursor-pointer ${
                          lang === 'en'
                            ? 'pixel-btn-gold'
                            : 'glass-btn text-[#f3f0e6] hover:text-[#f8d274]'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pantalla completa */}
                <div className="space-y-1.5 border-t border-[#323846] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-sm font-bold text-[#f3f0e6]">
                        {en ? 'Fullscreen' : 'Pantalla completa'}
                      </div>
                      <div className="font-display text-xs text-[#94a3b8]">
                        {isFullscreen
                          ? en
                            ? 'Enabled'
                            : 'Activada'
                          : en
                            ? 'Disabled'
                            : 'Desactivada'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className={`px-3.5 py-2 inline-flex items-center gap-2 font-display font-bold text-xs cursor-pointer ${
                        isFullscreen ? 'pixel-btn-gold' : 'glass-btn text-[#f3f0e6] hover:text-[#f8d274]'
                      }`}
                    >
                      {isFullscreen ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5" />
                          {en ? 'Exit' : 'Salir'}
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5" />
                          {en ? 'Enable' : 'Activar'}
                        </>
                      )}
                    </button>
                  </div>
                  {fullscreenError && (
                    <p className="font-display text-[11px] text-[#fda4af]">
                      {fullscreenError}
                    </p>
                  )}
                </div>

                {/* Control de volumen */}
                <div className="space-y-2 border-t border-[#323846] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-bold text-[#f3f0e6]">
                      {en ? 'Master volume' : 'Volumen general'}
                    </span>
                    <span className="font-mono-tech text-xs font-bold text-[#f8d274]">
                      {isMusicMuted
                        ? en
                          ? 'Muted'
                          : 'Silenciado'
                        : `${Math.round(masterVolume * 100)}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleMusicMute}
                      aria-label={
                        isMusicMuted
                          ? en
                            ? 'Unmute audio'
                            : 'Activar audio'
                          : en
                            ? 'Mute audio'
                            : 'Silenciar audio'
                      }
                      className="p-2 glass-btn text-[#f3f0e6] hover:text-[#f8d274] cursor-pointer shrink-0"
                    >
                      {isMusicMuted || masterVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-[#fda4af]" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-[#f8d274]" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={isMusicMuted ? 0 : Math.round(masterVolume * 100)}
                      onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                      aria-label={en ? 'Master volume control' : 'Control de volumen general'}
                      className="w-full accent-[#f8d274] cursor-pointer h-2 rounded-lg bg-[#111827]"
                    />
                  </div>
                </div>

                {/* Insertar código secreto */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (cheatCode.trim() === '2008') {
                      playUiClickSfx();
                      const maxLvl = PROGRESSION_LEVELS.length;
                      setProgression({
                        maxUnlockedLevel: maxLvl,
                        activeLevel: maxLvl,
                        completedLevels: PROGRESSION_LEVELS.map((l) => l.level),
                        firstLiftoffDone: true,
                      });
                      setJustUnlockedLevel(null);
                      setCheatCode('');
                      setCheatFeedback({
                        ok: true,
                        text: en
                          ? 'Everything unlocked! Levels 1–4, all parts & sensors available.'
                          : '¡Todo desbloqueado! Niveles 1–4, todas las piezas y sensores disponibles.',
                      });
                    } else {
                      setCheatFeedback({
                        ok: false,
                        text: en ? 'Invalid code' : 'Código incorrecto',
                      });
                    }
                  }}
                  className="space-y-2 border-t border-[#323846] pt-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-bold text-[#f3f0e6]">
                      {en ? 'Enter code' : 'Insertar código'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cheatCode}
                      onChange={(e) => {
                        setCheatCode(e.target.value);
                        if (cheatFeedback) setCheatFeedback(null);
                      }}
                      placeholder={en ? 'Secret code...' : 'Código secreto...'}
                      aria-label={en ? 'Enter secret code' : 'Insertar código secreto'}
                      className="flex-1 min-w-0 px-3 py-1.5 bg-[#0b101b] border border-[#323846] focus:border-[#f8d274] outline-none font-mono-tech text-xs text-[#f3f0e6] placeholder:text-[#64748b]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 pixel-btn-gold font-display font-bold text-xs cursor-pointer shrink-0"
                    >
                      {en ? 'Apply' : 'Aplicar'}
                    </button>
                  </div>
                  {cheatFeedback && (
                    <p
                      className={`font-display text-[11px] ${
                        cheatFeedback.ok ? 'text-[#6ee7a8]' : 'text-[#fda4af]'
                      }`}
                    >
                      {cheatFeedback.text}
                    </p>
                  )}
                </form>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  setCheatFeedback(null);
                }}
                className="px-4 py-2 pixel-btn-gold inline-flex items-center gap-2 font-display font-bold text-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {en ? 'Back to Menu' : 'Volver al Menú'}
              </button>
            </div>
          ) : !showHelp ? (
            <nav
              aria-label={en ? 'Main menu' : 'Menú principal'}
              className="flex flex-col gap-3 w-full max-w-md"
            >
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="group flex items-baseline justify-between gap-4 text-left cursor-pointer py-1 transition-transform duration-150 hover:translate-x-1.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-pixel text-xs transition-opacity duration-150 ${
                        item.primary
                          ? 'text-[#f8d274] opacity-100'
                          : 'text-[#f8d274] opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      ▸
                    </span>
                    <span
                      className={`font-display font-bold tracking-wide transition-colors duration-150 ${
                        item.primary
                          ? 'text-2xl md:text-3xl text-[#f8d274] group-hover:text-[#fde68a]'
                          : 'text-xl md:text-2xl text-[#f3f0e6] group-hover:text-[#f8d274]'
                      }`}
                      style={{
                        textShadow: '0 3px 8px rgba(0,0,0,0.92), 0 1px 0 #07090d',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className="font-pixel text-[10px] uppercase tracking-widest text-[#94a3b8] group-hover:text-[#cbd5e1] shrink-0"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                  >
                    {item.hint}
                  </span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="max-w-xl pixel-panel p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#323846] pb-3">
                <h2 className="font-display text-lg font-bold text-[#f3f0e6]">
                  {en
                    ? 'Leveling Program · NASA Trial and Error'
                    : 'Programa de Nivelación · NASA Prueba y Error'}
                </h2>
                <span className="font-pixel text-[10px] text-[#f8d274]">
                  {en ? '4 Levels' : '4 Niveles'}
                </span>
              </div>
              <div className="font-display text-sm leading-relaxed space-y-2 text-[#cbd5e1]">
                {en ? (
                  <>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Level 1 · MK-I (LEO):</strong> You start with basic parts and only the Structural Assembly in Design [M]. Your first liftoff unlocks Mass and ΔV sensors.
                    </p>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Level 2 · MK-II (Space Station):</strong> Travel to the space station (2,200 m/s), dock the full craft, collect data, and take photos of Earth (≥ 20 pts) to unlock the Saturn V.
                    </p>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Level 3 · MK-III (Lunar Orbit):</strong> Map the Moon without landing (≥ 30 science pts) to unlock the full catalog.
                    </p>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Level 4 · MK11 (Moon Landing):</strong> With everything unlocked (RTG, EASEP, and full diagnostics), execute the 5-day lunar expedition.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Nivel 1 · MK-I (LEO):</strong> Empiezas con piezas básicas y solo el Ensamblaje Estructural en Diseño [M]. Tu primer despegue desbloquea los sensores de Masa y ΔV.
                    </p>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Nivel 2 · MK-II (Estación Espacial):</strong> Viaja a la estación espacial (2,200 m/s), acopla la nave completa, recolecta información y toma fotos de la Tierra (≥ 20 pts) para desbloquear el Saturno V.
                    </p>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Nivel 3 · MK-III (Órbita Lunar):</strong> Cartografía la Luna sin alunizar (≥ 30 pts de ciencia) para liberar todo el catálogo.
                    </p>
                    <p>
                      <strong className="text-[#f8d274] font-bold">Nivel 4 · MK11 (Alunizaje):</strong> Con todo desbloqueado (RTG, EASEP y diagnóstico completo), ejecuta la expedición lunar de 5 días.
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 pixel-btn-gold inline-flex items-center gap-2 font-display font-bold text-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {en ? 'Back to Menu' : 'Volver al Menú'}
              </button>
            </div>
          )}

          <div className="flex flex-col items-end gap-3 pointer-events-none">
            {/* 3 Large Stars in Bottom-Right representing campaign progress */}
            <div
              className="flex items-center justify-end gap-3 sm:gap-4"
              aria-label={
                en
                  ? `${Math.min(3, progression.completedLevels.length)} of 3 campaign stars`
                  : `${Math.min(3, progression.completedLevels.length)} de 3 estrellas de campaña`
              }
            >
              {[1, 2, 3].map((starSlot, idx) => {
                const earned = idx < Math.min(3, progression.completedLevels.length);
                return (
                  <Star
                    key={starSlot}
                    className={`w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 transition-all duration-300 ${
                      earned
                        ? 'text-[#fde68a] fill-[#f8d274] scale-105'
                        : 'text-slate-400/30 fill-slate-950/45'
                    }`}
                    strokeWidth={earned ? 1.8 : 1.5}
                    style={
                      earned
                        ? {
                            filter:
                              'drop-shadow(0 0 18px rgba(248, 210, 116, 0.72)) drop-shadow(0 3px 0 #7a4c15)',
                          }
                        : {
                            filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.7))',
                          }
                    }
                  />
                );
              })}
            </div>

            <div
              className="hidden md:flex flex-col items-end gap-1 font-pixel text-[9px] uppercase tracking-[0.18em] text-[#cbd5e1]/75"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
            >
              <span className="text-[#f8d274]">
                {currentDestination.distanceKm.toLocaleString(en ? 'en-US' : 'es-ES')} KM ·{' '}
                {currentLevel.code}
              </span>
              <span>
                {currentLauncher
                  ? getLocalizedLauncherName(currentLauncher, lang)
                  : en
                    ? 'SATURN IB'
                    : 'SATURNO IB'}{' '}
                · {currentLauncher?.capacityKg ?? 500} KG
              </span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ---------- Unified Single-Screen 2D Game Viewport ----------
  const hasRocket = design.length > 0;
  const showRocketOnPad = hasRocket && !designMenuOpen;
  const isLaunchRunning =
    gamePhase === 'launch' && launchTelemetry.outcome === LaunchOutcome.Running;
  const isLaunchFailed =
    gamePhase === 'launch' &&
    (launchTelemetry.outcome === LaunchOutcome.LaunchFailed ||
      launchTelemetry.outcome === LaunchOutcome.OrbitFailed);

  const countdownVal = Math.ceil(launchTelemetry.countdownRemaining ?? 0);
  const ledCounterValue =
    isLaunchFailed
      ? '-----'
      : String(Math.max(0, countdownVal)).padStart(5, '0');
  const launchCounterLabel = !hasRocket
    ? en
      ? 'NO ROCKET'
      : 'SIN COHETE'
    : launchTelemetry.outcome === LaunchOutcome.Idle
      ? en
        ? 'T-10 · READY'
        : 'T-10 · LISTO'
      : launchTelemetry.outcome === LaunchOutcome.Running
        ? countdownVal > 0
          ? `T-${String(countdownVal).padStart(2, '0')}`
          : launchTelemetry.altitudeKm < 200
            ? en
              ? 'ASCENT'
              : 'ASCENSO'
            : 'ORBITAL TLI'
        : launchTelemetry.outcome === LaunchOutcome.Success
          ? 'TLI OK'
          : launchTelemetry.outcome === LaunchOutcome.OrbitFailed
            ? en
              ? 'IN ORBIT'
              : 'EN ÓRBITA'
            : en
              ? 'ABORTED'
              : 'ABORTADO';

  const canOpenDesign = !isLaunchRunning && gamePhase !== 'transition';

  const dvTarget = Math.max(1, result.deltaVRequired);
  const dvFraction =
    launchTelemetry.outcome === LaunchOutcome.Running ||
    launchTelemetry.outcome === LaunchOutcome.Success
      ? launchTelemetry.deltaVBurned / Math.max(1, launchTelemetry.deltaVRequired)
      : result.deltaVAvailable / dvTarget;

  const inTransition = gamePhase === 'transition';
  const tEase =
    transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
  const launchLayerOpacity =
    gamePhase === 'launch' ? 1 : inTransition ? 1 - tEase : 0;
  const operationLayerOpacity =
    gamePhase === 'operation' ? 1 : inTransition ? tEase : 0;
  const launchHudOpacity =
    gamePhase === 'launch' ? 1 : inTransition ? Math.max(0, 1 - tEase * 2.2) : 0;

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ backgroundColor: '#05070d', color: theme.text }}
    >
      {introTransitionOverlay}
      {/* 1. Full-Screen Game World Canvas with Continuous Dissolve */}
      <div className="absolute inset-0 z-0">
        {(gamePhase === 'launch' || inTransition) && (
          <div
            className="absolute inset-0"
            style={{ opacity: launchLayerOpacity }}
          >
            <LaunchCanvas
              launcherCapacityKg={result.launcherCapacityKg}
              showRocket={showRocketOnPad}
              assembly={assembly}
              launchCommand={launchCmd}
              onTelemetry={setLaunchTelemetry}
            />
          </div>
        )}

        {(inTransition || gamePhase === 'operation') && (
          <div
            className="absolute inset-0"
            style={{ opacity: operationLayerOpacity }}
          >
            <OrbitMapCanvas
              destination={currentDestination}
              solarWatts={activeSolarWatts}
              rtgWatts={result.rtgWatts}
              consumptionWatts={result.consumptionWatts}
              batteryCapacityWh={result.batteryWh}
              speedMultiplier={1}
              offline={activeOffline}
              designResetKey={designResetKey}
              panelFraction={0}
              operationWaiting={!op || inTransition}
              operationStage={op ? op.stage : undefined}
              operationProgress={op ? op.progressFraction : undefined}
              operationTotalSteps={op ? op.totalSteps : currentBriefing.missionDays * 8}
              operationStepsPerSecond={operationStepsPerSec}
              operationSpeedMultiplier={OP_SPEED_MULTIPLIERS[opSpeedIndex]}
              operationPaused={Boolean(
                designMenuOpen || (op && (op.finished || op.awaitingMinigame))
              )}
            />
          </div>
        )}
      </div>

      {/* 2. TOP-RIGHT Compact Glass Keybind Controls */}
      {gamePhase !== 'transition' && !designMenuOpen && (
        <div className="fixed top-4 right-4 z-[45] flex items-center gap-2">
          <button
            type="button"
            disabled={!canOpenDesign}
            onClick={() => {
              if (!canOpenDesign) return;
              setInspectedPart(null);
              setDesignMenuOpen((prev) => !prev);
            }}
            className={`px-3.5 py-2 text-xs font-display font-bold flex items-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              !hasRocket && gamePhase === 'launch' ? 'glass-btn-gold' : 'glass-btn'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{en ? 'Design' : 'Diseño'}</span>
            <kbd className="font-pixel text-[9px] px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-[#f8d274]">
              M
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              setDesignMenuOpen(false);
              setScreen('menu');
              setShowHelp(false);
            }}
            className="px-3 py-2 glass-btn text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{en ? 'Menu' : 'Menú'}</span>
          </button>

          <button
            type="button"
            onClick={toggleMusicMute}
            aria-label={
              isMusicMuted
                ? en
                  ? 'Unmute music'
                  : 'Activar música'
                : en
                  ? 'Mute music'
                  : 'Silenciar música'
            }
            title={
              isMusicMuted
                ? en
                  ? 'Unmute music'
                  : 'Activar música'
                : en
                  ? 'Mute music'
                  : 'Silenciar música'
            }
            className="p-2 glass-btn text-[#f3f0e6] hover:text-[#f8d274] flex items-center justify-center cursor-pointer"
          >
            {isMusicMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* 3. LAUNCH PHASE HUD (Hidden while Design Hangar is open to prevent text overlap) */}
      {(gamePhase === 'launch' || inTransition) && !designMenuOpen && launchHudOpacity > 0.01 && (
        <div
          className="contents"
          style={{ opacity: launchHudOpacity }}
        >
          {/* Bottom-Center Hardware-Style Red 7-Segment LED Counter (appears on countdown, fades out gradually at 0) */}
          {ledMounted && (
            <div
              className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none scale-75 sm:scale-90 md:scale-100 origin-bottom"
              style={{ opacity: launchHudOpacity }}
            >
              <div
                className={`transition-all ease-out ${
                  ledVisible
                    ? 'duration-500 opacity-100 translate-y-0'
                    : 'duration-[1400ms] opacity-0 translate-y-2'
                }`}
              >
                <SevenSegmentCounter
                  value={ledCounterValue}
                  label={en ? 'Launch counter' : 'Contador de lanzamiento'}
                />
              </div>
            </div>
          )}

          {/* Floating Glass Window Bottom-Left: Countdown & Telemetry Stats (leaves top-left sky open for Sun & bloom) */}
          <aside
            className="fixed bottom-6 left-4 z-20 w-[290px] sm:w-[325px] max-h-[calc(100vh-11rem)] overflow-y-auto glass-panel p-4 space-y-3 pointer-events-auto"
            style={{ opacity: launchHudOpacity }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2.5">
              <div>
                <div className="font-pixel text-[9px] uppercase tracking-wider text-[#cbd5e1]/80">
                  {en ? 'Pad MK11' : 'Plataforma MK11'}
                </div>
                <div
                  className="font-mono-tech text-xl font-bold leading-tight tracking-tight"
                  style={{
                    color: !hasRocket
                      ? '#cbd5e1'
                      : launchTelemetry.outcome === LaunchOutcome.Running
                        ? '#f8d274'
                        : launchTelemetry.outcome === LaunchOutcome.Success
                          ? '#6ee7a8'
                          : isLaunchFailed
                            ? '#fda4af'
                            : theme.highlight,
                  }}
                >
                  {launchCounterLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="font-pixel text-[8px] uppercase tracking-wider text-[#cbd5e1]/75">
                  {en ? 'Launcher' : 'Lanzador'}
                </div>
                <div className="font-display text-xs font-bold text-[#f3f0e6]">
                  {currentLauncher ? getLocalizedLauncherName(currentLauncher, lang) : '-'}
                </div>
              </div>
            </div>

            {!hasRocket ? (
              <div className="space-y-2.5 py-0.5">
                <p className="font-display text-xs text-[#e2e8f0] leading-snug">
                  {en
                    ? 'No rocket on the pad. Open the design menu to assemble MK11 modules.'
                    : 'No hay ningún cohete en plataforma. Abre el menú de diseño para ensamblar los módulos de MK11.'}
                </p>
                <button
                  type="button"
                  onClick={() => setDesignMenuOpen(true)}
                  className="w-full py-2.5 px-3 glass-btn-gold text-xs font-display font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {en ? 'Open Design [M]' : 'Abrir Diseño [M]'}
                </button>
              </div>
            ) : (
              <>
                <div className="font-display text-xs font-semibold text-[#f8d274] truncate">
                  {launchTelemetry.phase}
                </div>

                {/* Delta-V Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono-tech text-[10px] text-[#e2e8f0]">
                    <span className="text-[#94a3b8]">
                      {isLaunchRunning
                        ? en
                          ? 'Burned ΔV'
                          : 'ΔV ejecutado'
                        : en
                          ? 'Available ΔV'
                          : 'ΔV disponible'}
                    </span>
                    <span>
                      {(isLaunchRunning
                        ? launchTelemetry.deltaVBurned
                        : result.deltaVAvailable
                      ).toFixed(0)}{' '}
                      / {result.deltaVRequired.toFixed(0)} m/s
                    </span>
                  </div>
                  <ProgressBar
                    fraction={dvFraction}
                    color={
                      result.deltaVAvailable >= result.deltaVRequired
                        ? theme.highlight
                        : '#f59e0b'
                    }
                  />
                </div>

                {/* 4-Stage Rocket Construction Indicator */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono-tech text-[10px]">
                    <span className="text-[#94a3b8]">
                      {en ? 'Rocket Assembly' : 'Ensamblaje del Cohete'}
                    </span>
                    <span
                      className={`font-bold ${
                        isRocketComplete ? 'text-[#6ee7a8]' : 'text-[#fde68a]'
                      }`}
                    >
                      {builtStageCount}/4{' '}
                      {isRocketComplete
                        ? en
                          ? '· COMPLETE'
                          : '· COMPLETO'
                        : en
                          ? '· INCOMPLETE'
                          : '· INCOMPLETO'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: en ? 'Core' : 'Núcleo', ok: assembly.hasCore },
                      { label: en ? 'Fuel' : 'Combust.', ok: assembly.hasBoosters },
                      { label: en ? 'Fairing' : 'Cofia', ok: assembly.hasFairing },
                      { label: en ? 'Avionics' : 'Aviónica', ok: assembly.hasAvionics },
                    ].map((st) => (
                      <div
                        key={st.label}
                        className={`text-center py-1 px-1 rounded-lg text-[9px] font-mono-tech border ${
                          st.ok
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-400/30 text-rose-300/80'
                        }`}
                      >
                        {st.label}
                      </div>
                    ))}
                  </div>
                </div>

                {launchTelemetry.outcome === LaunchOutcome.Idle &&
                  (!isRocketComplete || result.fuelMassKg <= 0 ? (
                    <div className="font-display text-[11px] text-rose-200 bg-rose-500/15 border border-rose-400/35 rounded-xl px-3 py-2 leading-snug">
                      {result.fuelMassKg <= 0
                        ? en
                          ? 'No fuel: rocket cannot ignite engines or lift off.'
                          : 'Sin combustible: el cohete no podrá encender motores ni despegar.'
                        : en
                          ? 'Incomplete rocket: essential modules are missing for liftoff.'
                          : 'Cohete incompleto: faltan módulos esenciales para iniciar el vuelo.'}
                    </div>
                  ) : (
                    result.missingHints.length > 0 && (
                      <div className="font-display text-[11px] text-[#fde68a] bg-amber-500/15 border border-amber-300/35 rounded-xl px-3 py-2 leading-snug">
                        {result.missingHints[0]}
                      </div>
                    )
                  ))}
              </>
            )}
          </aside>

          {/* Bottom-Center Glass Prompt when platform has no rocket yet */}
          {!hasRocket && !designMenuOpen && (
            <button
              type="button"
              onClick={() => setDesignMenuOpen(true)}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 glass-panel-gold font-pixel text-[10px] sm:text-xs text-[#f8d274] tracking-wider uppercase cursor-pointer hover:brightness-110 transition hidden lg:flex"
            >
              {en
                ? 'Empty pad · Press [M] to design your rocket'
                : 'Plataforma vacía · Pulsa [M] para diseñar tu cohete'}
            </button>
          )}

          {/* Bottom-Right Separated Flight & Rocket Stats Card + Primary Launch Button */}
          {!designMenuOpen && !isLaunchFailed && (
            <div
              className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-2.5 pointer-events-auto"
              style={{ opacity: launchHudOpacity }}
            >
              {hasRocket && (
                <div className="w-[265px] sm:w-[295px] glass-panel p-3 pointer-events-auto">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono-tech text-[11px] glass-well p-2.5">
                    <div>
                      <div className="text-[9px] text-[#94a3b8] uppercase">
                        {en ? 'Altitude' : 'Altitud'}
                      </div>
                      <div className="text-[#f3f0e6] font-bold">
                        {launchTelemetry.altitudeKm.toFixed(1)} km
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#94a3b8] uppercase">
                        {en ? 'Speed' : 'Velocidad'}
                      </div>
                      <div className="text-[#f3f0e6] font-bold">
                        {launchTelemetry.speedKms.toFixed(2)} km/s
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#94a3b8] uppercase">
                        {en ? 'Mass' : 'Masa'}
                      </div>
                      <div
                        className={
                          result.totalMassKg > result.launcherCapacityKg
                            ? 'text-[#fda4af] font-bold'
                            : 'text-[#e2e8f0] font-bold'
                        }
                      >
                        {result.totalMassKg.toFixed(0)}/{result.launcherCapacityKg.toFixed(0)} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#94a3b8] uppercase">
                        {en ? 'Budget' : 'Presupuesto'}
                      </div>
                      <div
                        className={
                          result.totalCost > result.budget
                            ? 'text-[#fda4af] font-bold'
                            : 'text-[#e2e8f0] font-bold'
                        }
                      >
                        ${result.totalCost.toFixed(1)}M/${result.budget.toFixed(0)}M
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hasRocket && launchTelemetry.outcome === LaunchOutcome.Idle && (
                <button
                  type="button"
                  onClick={triggerLaunch}
                  className="px-6 py-3.5 glass-btn-gold text-sm sm:text-base font-display font-bold flex items-center gap-3 cursor-pointer"
                >
                  <Rocket className="w-5 h-5" />
                  <span>{en ? 'Start Launch' : 'Iniciar Lanzamiento'}</span>
                </button>
              )}
              {hasRocket && launchTelemetry.outcome === LaunchOutcome.Running && (
                <div className="px-5 py-3 glass-panel-gold font-pixel text-xs text-[#f8d274] flex items-center gap-2.5">
                  <Rocket className="w-4 h-4 animate-bounce" />
                  <span>{en ? 'LIFTOFF IN PROGRESS' : 'DESPEGUE EN CURSO'}</span>
                </div>
              )}
              {hasRocket && launchTelemetry.outcome === LaunchOutcome.Success && (
                <div className="px-5 py-3 glass-panel border-emerald-300/45 font-pixel text-xs text-[#86efac] flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{en ? 'TLI INJECTION CONFIRMED' : 'INYECCIÓN TLI CONFIRMADA'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. SEAMLESS CINEMATIC HUD PILL: LAUNCH SUCCESS -> OPERATION (Keeps center sky unobstructed) */}
      {gamePhase === 'transition' && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          style={{
            opacity: (() => {
              const f =
                transitionProgress < 0.2
                  ? transitionProgress / 0.2
                  : transitionProgress > 0.78
                    ? Math.max(0, (1 - transitionProgress) / 0.22)
                    : 1;
              return f * f * (3 - 2 * f);
            })(),
          }}
        >
          <div className="w-[320px] sm:w-[390px] glass-panel-gold px-5 py-3 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 font-pixel text-[9px] uppercase tracking-[0.18em] text-[#6ee7a8]">
              <Rocket className="w-3.5 h-3.5 text-[#f8d274]" />
              <span>
                {isFinalLunar
                  ? en
                    ? 'Translunar Course · Entering Operation'
                    : 'Rumbo Translunar · Entrando en Operación'
                  : en
                    ? 'Orbit Reached · Entering Operation'
                    : 'Órbita Alcanzada · Entrando en Operación'}
              </span>
            </div>
            <ProgressBar fraction={transitionProgress} color={theme.highlight} />
          </div>
        </div>
      )}

      {/* 5. OPERATION PHASE GAME HUD (Didactic layout separated into Left Telemetry, Top-Right Bitácora, Bottom-Right Actions) */}
      {gamePhase === 'operation' && op && !designMenuOpen && (
        <>
          {/* 5A. Top-Left Didactic Mission & Subsystems Telemetry HUD */}
          <aside className="fixed top-4 left-4 z-20 w-[275px] sm:w-[305px] max-h-[calc(100vh-5rem)] overflow-y-auto glass-panel p-3.5 space-y-2.5">
            {/* Day Counter + Inline Speed Controls */}
            <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
              <div>
                <div className="font-pixel text-[9px] uppercase tracking-wider text-[#7dd3fc]">
                  {en
                    ? `Operation ${currentLevel.code} · Level ${currentLevel.level}/4`
                    : `Operación ${currentLevel.code} · Nivel ${currentLevel.level}/4`}
                </div>
                <div className="font-mono-tech text-lg font-bold text-[#f8d274] leading-tight">
                  {op.totalDays === 1
                    ? `${en ? 'Hour' : 'Hora'} ${Math.min(
                        24,
                        Math.round(op.progressFraction * 24)
                      )} / 24 h`
                    : op.totalDays <= 3
                      ? `${en ? 'Day' : 'Día'} ${op.day} / ${op.totalDays} · ${Math.min(
                          op.totalDays * 24,
                          Math.round(op.progressFraction * op.totalDays * 24)
                        )}h`
                      : `${en ? 'Day' : 'Día'} ${op.day} / ${op.totalDays}`}
                </div>
              </div>

              {!op.finished && !op.awaitingMinigame && (
                <div className="flex items-center gap-1">
                  {OP_SPEED_LABELS.map((lbl, idx) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setOpSpeedIndex(idx)}
                      className={`px-2 py-1 text-[10px] font-mono-tech font-bold cursor-pointer ${
                        opSpeedIndex === idx ? 'glass-btn-gold' : 'glass-btn'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Phase & Trajectory Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-[8px] uppercase tracking-wider text-[#94a3b8]">
                  {en ? 'Current Stage' : 'Etapa actual'}
                </span>
                <span className="font-mono-tech text-[10px] text-[#7dd3fc] font-bold">
                  {(op.progressFraction * 100).toFixed(0)}%
                </span>
              </div>
              <div className="font-display text-xs font-semibold text-[#f3f0e6] truncate">
                {op.currentPhaseTitle}
              </div>
              <ProgressBar fraction={op.progressFraction} color={theme.highlight} />
            </div>

            {/* Didactic Subsystems Health Cards */}
            <div className="space-y-1.5">
              <div className="font-pixel text-[8px] uppercase tracking-wider text-[#94a3b8]">
                {en ? 'Subsystems Status' : 'Estado de Subsistemas'}
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono-tech text-[10px]">
                <div className="glass-well px-2.5 py-1.5 space-y-0.5">
                  <div className="text-[9px] text-[#94a3b8] flex items-center gap-1">
                    <Sun className="w-3 h-3 text-[#f8d274]" />
                    <span>{en ? 'Panels' : 'Paneles'}</span>
                  </div>
                  <div className="text-[#f3f0e6] font-bold">
                    {(op.solarHealth * 100).toFixed(0)}% {en ? 'active' : 'útiles'}
                  </div>
                </div>

                <div className="glass-well px-2.5 py-1.5 space-y-0.5">
                  <div className="text-[9px] text-[#94a3b8] flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-[#7dd3fc]" />
                    <span>{en ? 'Computer' : 'Computadora'}</span>
                  </div>
                  <div className={op.computerAlive ? 'text-[#6ee7a8] font-bold' : 'text-[#fda4af] font-bold'}>
                    {op.computerAlive
                      ? en
                        ? `${op.computerLivesLeft} lives OK`
                        : `${op.computerLivesLeft} vidas OK`
                      : en
                        ? 'OFFLINE'
                        : 'APAGADA'}
                  </div>
                </div>

                <div className="glass-well px-2.5 py-1.5 space-y-0.5">
                  <div className="text-[9px] text-[#94a3b8] flex items-center gap-1">
                    <Radio className="w-3 h-3 text-[#34d399]" />
                    <span>{en ? 'Antenna Link' : 'Enlace Antena'}</span>
                  </div>
                  <div className={op.linkUp ? 'text-[#6ee7a8] font-bold' : 'text-[#f8d274] font-bold'}>
                    {op.linkUp
                      ? en
                        ? 'ONLINE'
                        : 'EN LÍNEA'
                      : en
                        ? `-${op.linkDownDaysLeft}d down`
                        : `-${op.linkDownDaysLeft}d caída`}
                  </div>
                </div>

                <div className="glass-well px-2.5 py-1.5 space-y-0.5">
                  <div className="text-[9px] text-[#94a3b8] flex items-center gap-1">
                    <Camera className="w-3 h-3 text-[#c4b5fd]" />
                    <span>{en ? 'Camera' : 'Cámara'}</span>
                  </div>
                  <div className={op.hasCamera ? 'text-[#6ee7a8] font-bold' : 'text-[#f8d274] font-bold'}>
                    {op.hasCamera
                      ? en
                        ? 'ACTIVE'
                        : 'ACTIVA'
                      : en
                        ? 'NO GEAR'
                        : 'SIN EQUIPO'}
                  </div>
                </div>
              </div>
            </div>

            {/* Didactic Science Goal Progress */}
            <div className="glass-well p-2.5 space-y-1">
              <div className="flex justify-between items-center font-mono-tech text-[10px]">
                <span className="text-[#94a3b8] flex items-center gap-1">
                  <FlaskConical className="w-3 h-3 text-[#34d399]" />
                  <span>{en ? 'Science received' : 'Ciencia recibida'}</span>
                </span>
                <span
                  className={`font-bold ${
                    op.scienceDelivered >= op.minScience ? 'text-[#6ee7a8]' : 'text-[#f3f0e6]'
                  }`}
                >
                  {op.scienceDelivered.toFixed(0)} / {op.minScience.toFixed(0)} pts
                </span>
              </div>
              <ProgressBar
                fraction={op.minScience > 0 ? op.scienceDelivered / op.minScience : 0}
                color="#34d399"
              />
              <div className="font-display text-[10px] text-[#cbd5e1]/80">
                {op.scienceDelivered >= op.minScience
                  ? en
                    ? 'Science target reached.'
                    : 'Meta científica alcanzada.'
                  : en
                    ? `${Math.max(0, Math.ceil(op.minScience - op.scienceDelivered))} pts remaining to reach target.`
                    : `Faltan ${Math.max(0, Math.ceil(op.minScience - op.scienceDelivered))} pts para completar la meta.`}
              </div>
            </div>

            {/* Mission Objective / Lunar Habitability Note */}
            {isFinalLunar ? (
              (op.day >= 3 || op.finished) && (
                <div className="bg-sky-500/15 border border-sky-300/35 rounded-xl px-2.5 py-2 space-y-0.5">
                  <div className="font-pixel text-[8px] uppercase tracking-wider text-[#7dd3fc]">
                    {en ? 'Lunar Habitability' : 'Habitabilidad Lunar'}
                  </div>
                  <p className="font-display text-[11px] text-[#f3f0e6] leading-snug">
                    {en
                      ? 'Not naturally habitable: requires pressurized bases and life support.'
                      : 'No habitable naturalmente: requiere bases presurizadas y soporte vital.'}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-sky-500/15 border border-sky-300/35 rounded-xl px-2.5 py-2 space-y-0.5">
                <div className="font-pixel text-[8px] uppercase tracking-wider text-[#7dd3fc]">
                  {en ? 'Objective' : 'Objetivo'} {currentLevel.code}
                </div>
                <p className="font-display text-[11px] text-[#f3f0e6] leading-snug">
                  {currentLevel.objectiveSummary}
                </p>
              </div>
            )}
          </aside>

          {/* 5B. Separated Top-Right Panel below Diseño / Menú / Sonido: Live Didactic Mission Log */}
          <section className="fixed top-16 right-4 z-20 w-[285px] sm:w-[330px] max-h-[calc(100vh-20rem)] flex flex-col glass-panel p-3.5 space-y-2 pointer-events-auto">
            <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#7dd3fc]" />
                <span className="font-pixel text-[9px] uppercase tracking-wider text-[#f3f0e6]">
                  {en ? 'Live Log' : 'Bitácora en vivo'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-tech text-[10px] text-[#94a3b8]">
                  {op.log.length} {en ? 'events' : 'eventos'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowOpDetails((v) => !v)}
                  className="font-pixel text-[8px] text-[#7dd3fc] hover:text-white cursor-pointer"
                >
                  {showOpDetails ? (en ? 'HIDE' : 'OCULTAR') : en ? 'SHOW MORE' : 'VER MÁS'}
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-0.5 text-[11px] font-display max-h-44">
              {(showOpDetails ? op.log : op.log.slice(-4)).map((e, i, arr) => {
                const isLatest = i === arr.length - 1;
                const dotColor =
                  e.kind === LogKind.Bad
                    ? 'bg-rose-400'
                    : e.kind === LogKind.Good
                      ? 'bg-emerald-400'
                      : 'bg-sky-300';
                const textColor =
                  e.kind === LogKind.Bad
                    ? 'text-[#fda4af]'
                    : e.kind === LogKind.Good
                      ? 'text-[#6ee7a8]'
                      : 'text-[#e2e8f0]';
                return (
                  <div
                    key={`${e.day}-${i}`}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1 ${
                      isLatest ? 'bg-white/[0.06] border border-white/10' : 'bg-black/20'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                    <div className={`leading-snug ${textColor}`}>
                      <span className="font-mono-tech text-[10px] text-[#94a3b8] mr-1">
                        [{en ? 'Day' : 'Día'} {e.day}]
                      </span>
                      <span>{e.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {showOpDetails && (
              <div className="glass-well p-2.5 text-[10px] space-y-1 font-mono-tech text-[#e2e8f0] border-t border-white/10">
                <div className="font-display font-bold text-[11px] text-[#f3f0e6] flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-[#f8d274]" />
                  <span>{en ? 'Mission Risks & Telemetry' : 'Riesgos y Telemetría de Misión'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">
                    {en ? 'Est. solar storms' : 'Tormentas solares est.'}
                  </span>
                  <span>{op.expectedSevereStorms.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">
                    {en ? 'CPU failure risk' : 'Riesgo fallo CPU'}
                  </span>
                  <span>{(op.computerLossRisk() * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">
                    {en ? 'Antenna download rate' : 'Tasa descarga antena'}
                  </span>
                  <span>{op.antennaCount > 0 ? `${(op.dataRate * 100).toFixed(0)}%` : '0%'}</span>
                </div>
              </div>
            )}
          </section>

          {/* 5C. Separated Bottom-Right Operation Finished Actions Card (Ver Portada / Reintentar / Diseño) */}
          {op.finished && (
            <div className="fixed bottom-4 right-4 z-30 w-[330px] sm:w-[390px] max-w-[calc(100vw-2rem)] glass-panel-gold p-3.5 space-y-2.5 pointer-events-auto">
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-[9px] uppercase tracking-wider text-[#f8d274]">
                  {op.succeeded
                    ? en
                      ? 'Operation Complete'
                      : 'Operación Completada'
                    : en
                      ? 'Operation Ended'
                      : 'Operación Finalizada'}
                </span>
                <span
                  className={`font-mono-tech text-[10px] font-bold ${
                    op.succeeded ? 'text-[#6ee7a8]' : 'text-[#fda4af]'
                  }`}
                >
                  {op.succeeded ? (en ? 'SUCCESS' : 'ÉXITO') : en ? 'FAILED' : 'FALLO'} ·{' '}
                  {op.score.toFixed(0)} pts
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEndingData({
                    mission: currentBriefing?.title ?? '',
                    orbit: currentDestination?.name ?? (en ? 'the Moon' : 'la Luna'),
                    days: op.day,
                    science: op.scienceDelivered,
                    score: op.score,
                    rating: op.rating,
                    hasCamera: op.hasCamera,
                    habitability: op.habitabilityVerdict,
                    endingMeta: op.endingMeta,
                    launchStageFailure: false,
                    scoreLines: [...op.scoreLines],
                    advice: op.advice,
                    minScience: op.minScience,
                    isFinalMissionSuccess: Boolean(
                      isFinalLunar &&
                        op.succeeded &&
                        !op.endingMeta?.isFailure &&
                        (op.minScience <= 0 || op.scienceDelivered >= op.minScience)
                    ),
                  });
                  setScreen('ending');
                }}
                className="w-full py-2 px-3 glass-btn-gold text-xs font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                {op.succeeded
                  ? en
                    ? 'View Score & Newspaper'
                    : 'Ver Puntuación y Diario'
                  : en
                    ? 'View Front Page'
                    : 'Ver Portada del Diario'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startOperation}
                  className="py-1.5 px-2.5 glass-btn text-[11px] font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{en ? 'Retry' : 'Reintentar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => enterLaunchStage(true)}
                  className="py-1.5 px-2.5 glass-btn text-[11px] font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3 h-3" />
                  <span>{en ? 'Design [M]' : 'Diseño [M]'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom-Left Compact Operation Minigame / Action Prompt */}
          {!op.finished && op.awaitingMinigame && (
            <div className="fixed bottom-4 left-4 z-20 px-3.5 py-2.5 glass-panel-gold text-[#fde68a] font-display text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#f8d274] shrink-0" />
              <span>
                {en
                  ? 'Active emergency: resolve the on-screen maneuver.'
                  : 'Emergencia activa: resuelve la maniobra en pantalla.'}
              </span>
            </div>
          )}

          {/* Minigame Modal Centered on Full-Screen Viewport */}
          {!op.finished && op.awaitingMinigame && (
            <OperationMinigames
              kind={op.awaitingMinigame}
              theme={theme}
              onDirectorReaction={(cue) => setDirectorOverride(cue)}
              onComplete={(kind) => {
                op.resolveMinigame(kind);
                setDirectorOverride(null);
                setOpTick((v) => v + 1);
              }}
            />
          )}

          {/* Director HUD (Bottom-Right, shifting smoothly above finished actions card when complete) */}
          {(() => {
            const lastLog = op.log[op.log.length - 1];
            const fallbackCue: DirectorReaction = lastLog
              ? {
                  mood:
                    lastLog.kind === LogKind.Bad
                      ? 'bad'
                      : lastLog.kind === LogKind.Good
                        ? 'good'
                        : 'neutral',
                  text: lastLog.text,
                }
              : {
                  mood: 'neutral',
                  text: en
                    ? `${op.currentPhaseTitle}. Monitoring MK11 telemetry.`
                    : `${op.currentPhaseTitle}. Monitoreando telemetría de MK11.`,
                };
            const activeCue =
              op.awaitingMinigame && directorOverride ? directorOverride : fallbackCue;
            return (
              <DirectorHud
                mood={activeCue.mood}
                text={activeCue.text}
                phaseLabel={
                  en
                    ? `FLIGHT DIR. (JEREMY) · DAY ${op.day}`
                    : `DIR. DE VUELO (JEREMY) · DÍA ${op.day}`
                }
                bottomOffsetClass={op.finished ? 'bottom-[152px]' : 'bottom-4'}
              />
            );
          })()}
        </>
      )}

      {/* 6. CLEAN & SCANNABLE HANGAR DE DISEÑO (Toggled with 'M' key) */}
      {designMenuOpen &&
        (() => {
          const daylightPower = result.solarWatts + result.rtgWatts;
          const massOver = result.totalMassKg > result.launcherCapacityKg;
          const budgetOver = result.totalCost > result.budget;
          const dvOk = result.deltaVAvailable >= result.deltaVRequired;
          const powerOk = daylightPower >= result.consumptionWatts;
          const batteryOk = result.batteryWh >= result.energyNeededInEclipseWh;
          const scienceOk = result.sciencePoints >= result.minScience;

          const hasStructure = design.some((p) => p.type === PartType.Structure);
          const hasComputer = design.some((p) => p.type === PartType.Computer);
          const hasAntenna = design.some((p) => p.type === PartType.Antenna);
          const hasCamera = design.some((p) => p.id === 'camara-hd');
          const hasEASEP = design.some((p) => p.id === 'radar');
          const hasShielding = design.some((p) => p.type === PartType.Shielding);

          const hasMassHelper = unlockedHelpersSet.has('mass');
          const hasBudgetHelper = unlockedHelpersSet.has('budget');
          const hasDeltaVHelper = unlockedHelpersSet.has('deltaV');
          const hasPowerHelper = unlockedHelpersSet.has('power');
          const hasScienceHelper = unlockedHelpersSet.has('science');
          const hasDiagnosticsHelper = unlockedHelpersSet.has('diagnostics');

          const getPartCategory = (p: PartData): 'flight' | 'power' | 'science' => {
            if (p.type === PartType.Structure || p.type === PartType.Fuel) return 'flight';
            if (
              p.type === PartType.SolarPanel ||
              p.type === PartType.RTG ||
              p.type === PartType.Battery
            ) {
              return 'power';
            }
            return 'science';
          };

          const getPartIcon = (p: PartData) => {
            if (p.type === PartType.Structure) return Rocket;
            if (p.type === PartType.Fuel) return Fuel;
            if (p.type === PartType.SolarPanel) return Sun;
            if (p.type === PartType.RTG) return Zap;
            if (p.type === PartType.Battery) return Battery;
            if (p.type === PartType.Antenna) return Radio;
            if (p.type === PartType.Computer) return Cpu;
            if (p.id === 'camara-hd') return Camera;
            if (p.type === PartType.Instrument) return FlaskConical;
            return Shield;
          };

          const unlockedParts = AVAILABLE_PARTS.filter((p) => unlockedPartsSet.has(p.id));
          const lockedParts = AVAILABLE_PARTS.filter((p) => !unlockedPartsSet.has(p.id));
          const visibleUnlockedParts =
            partFilter === 'all'
              ? unlockedParts
              : unlockedParts.filter((p) => getPartCategory(p) === partFilter);

          // Concise, non-overlapping action items (max 3 short alerts)
          const conciseAlerts: string[] = [];
          if (!hasRocket) {
            conciseAlerts.push(
              en
                ? 'Add modules from the list to build your rocket.'
                : 'Agrega módulos en la lista para armar tu cohete.'
            );
          } else {
            if (!assembly.hasCore)
              conciseAlerts.push(en ? 'Missing CSM Structure' : 'Falta Estructura CSM');
            if (!assembly.hasBoosters)
              conciseAlerts.push(en ? 'Missing Fuel Tank' : 'Falta Tanque de combustible');
            if (!assembly.hasFairing)
              conciseAlerts.push(
                en ? 'Missing Power or Science Gear' : 'Falta Energía o Equipo científico'
              );
            if (!assembly.hasAvionics)
              conciseAlerts.push(
                en ? 'Missing AGC Computer or Antenna' : 'Falta Computadora AGC o Antena'
              );
            if (hasDiagnosticsHelper && isRocketComplete) {
              if (massOver)
                conciseAlerts.push(
                  en ? 'Overweight: remove modules' : 'Exceso de peso: quita módulos'
                );
              if (!dvOk)
                conciseAlerts.push(
                  en ? 'Insufficient ΔV: add fuel' : 'Falta impulso ΔV: añade combustible'
                );
              if (!powerOk)
                conciseAlerts.push(
                  en ? 'Insufficient solar/RTG power' : 'Falta energía solar/RTG'
                );
              if (!batteryOk)
                conciseAlerts.push(
                  en ? 'Missing shadow battery' : 'Falta batería para la sombra'
                );
              if (!hasCamera)
                conciseAlerts.push(en ? 'Missing Hasselblad Camera' : 'Falta Cámara Hasselblad');
              if (!hasEASEP)
                conciseAlerts.push(en ? 'Missing EASEP Package' : 'Falta Paquete EASEP');
              if (!hasShielding)
                conciseAlerts.push(
                  en ? 'Recommended: Heat Shield' : 'Recomendado: Escudo térmico'
                );
            }
          }

          const lockedSensors: string[] = [];
          if (!hasMassHelper) lockedSensors.push(en ? 'Mass' : 'Masa');
          if (!hasDeltaVHelper) lockedSensors.push('ΔV');
          if (!hasBudgetHelper) lockedSensors.push(en ? 'Budget' : 'Presupuesto');
          if (!hasPowerHelper) lockedSensors.push(en ? 'Power' : 'Energía');

          const activeSensorCount =
            Number(hasMassHelper) +
            Number(hasDeltaVHelper) +
            Number(hasBudgetHelper) +
            Number(hasPowerHelper);

          return (
            <div
              onClick={() => {
                setInspectedPart(null);
                setDesignMenuOpen(false);
              }}
              className="fixed inset-0 z-50 bg-[#040711]/25 backdrop-blur-[2px] p-3 md:p-6 flex items-center justify-center overflow-hidden"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[980px] h-[86vh] max-h-[680px] bg-[#091020]/50 backdrop-blur-xl border border-white/25 rounded-2xl p-4 md:p-5 flex flex-col gap-3.5 overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.65)] [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]"
              >
                {/* Clean Single-Row Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/15">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-black/25 border border-white/15 flex items-center justify-center shrink-0">
                      <LunarMissionEmblem
                        color={theme.highlight}
                        accent={theme.accent}
                        size={20}
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display text-base md:text-lg font-bold text-[#f8fafc] leading-tight truncate">
                        {en ? 'Rocket Design' : 'Diseño de Cohete'}
                      </h2>
                      <div className="font-mono-tech text-[11px] text-[#cbd5e1] flex flex-wrap items-center gap-1.5">
                        <span className="text-[#f8d274] font-semibold">{currentLevel.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{currentLevel.shortTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {currentLauncher
                            ? getLocalizedLauncherName(currentLauncher, lang).split(' (')[0]
                            : en
                              ? 'Saturn'
                              : 'Saturno'}
                        </span>
                        {hasMassHelper && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {result.launcherCapacityKg.toFixed(0)} kg {en ? 'max.' : 'máx.'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compact Level Switcher + Close/Deploy CTA */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div
                      className="flex items-center gap-1 p-1 rounded-xl bg-black/25 border border-white/15"
                      role="tablist"
                      aria-label={en ? 'Campaign levels' : 'Niveles de campaña'}
                    >
                      {localizedLevels.map((lvl) => {
                        const unlocked = lvl.level <= progression.maxUnlockedLevel;
                        const active = lvl.level === currentLevel.level;
                        const completed = progression.completedLevels.includes(lvl.level);
                        return (
                          <button
                            key={lvl.level}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => selectLevel(lvl.level)}
                            title={lvl.title}
                            className={`px-2.5 py-1.5 rounded-lg font-mono-tech text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                              active
                                ? 'bg-[#f8d274] text-[#140e04] [text-shadow:none]'
                                : unlocked
                                  ? 'text-[#f1f5f9] hover:bg-white/15'
                                  : 'text-slate-400'
                            }`}
                          >
                            <span>{en ? `L${lvl.level}` : `N${lvl.level}`}</span>
                            {!unlocked ? (
                              <Lock className="w-3 h-3" />
                            ) : completed ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setInspectedPart(null);
                        setDesignMenuOpen(false);
                      }}
                      className={`px-4 py-2 text-xs font-display font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 [text-shadow:none] ${
                        hasRocket ? 'glass-btn-emerald' : 'glass-btn'
                      }`}
                    >
                      {hasRocket ? (
                        <>
                          <Rocket className="w-3.5 h-3.5" />
                          <span>{en ? 'Deploy [M]' : 'Desplegar [M]'}</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>{en ? 'Close [M]' : 'Cerrar [M]'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Main 2-Column Workspace */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
                  {/* LEFT COLUMN: Clean Categorized Parts List + Fixed 1-Line Inspector */}
                  <section className="lg:col-span-6 flex flex-col min-h-0 bg-[#060b16]/32 border border-white/15 rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                      <h3 className="text-sm font-display font-bold text-[#f3f0e6]">
                        {en ? 'Modules' : 'Módulos'} ({unlockedParts.length})
                      </h3>

                      {/* Category Filter Tabs */}
                      <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10">
                        {(
                          [
                            { id: 'all', label: en ? 'All' : 'Todos' },
                            { id: 'flight', label: en ? 'Flight' : 'Vuelo' },
                            { id: 'power', label: en ? 'Power' : 'Energía' },
                            { id: 'science', label: en ? 'Gear' : 'Equipos' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPartFilter(tab.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-display font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              partFilter === tab.id
                                ? 'bg-white/15 text-[#f8d274]'
                                : 'text-[#94a3b8] hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scrollable Parts Rows */}
                    <div className="flex-1 overflow-y-auto py-2.5 pr-1 space-y-2">
                      {visibleUnlockedParts.length === 0 ? (
                        <div className="py-8 text-center text-xs font-display text-[#94a3b8]">
                          {en
                            ? `No modules in this category at level ${currentLevel.code}.`
                            : `No hay módulos de esta categoría en el nivel ${currentLevel.code}.`}
                        </div>
                      ) : (
                        visibleUnlockedParts.map((p) => {
                          const count = countOf(p);
                          const IconComp = getPartIcon(p);
                          const isSelected = inspectedPart?.id === p.id;
                          const displayName = getLocalizedPartName(p, lang);
                          return (
                            <div
                              key={p.id}
                              onMouseEnter={() => setInspectedPart(p)}
                              onFocus={() => setInspectedPart(p)}
                              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                                count > 0
                                  ? 'bg-[#f8d274]/10 border-[#f8d274]/45'
                                  : isSelected
                                    ? 'bg-white/[0.08] border-white/25'
                                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                    count > 0
                                      ? 'bg-[#f8d274]/20 border-[#f8d274]/40 text-[#f8d274]'
                                      : 'bg-white/[0.05] border-white/10 text-[#94a3b8]'
                                  }`}
                                >
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-display font-bold text-sm text-[#f3f0e6] truncate">
                                    {displayName}
                                  </div>
                                  <div className="font-mono-tech text-[11px] text-[#94a3b8] truncate">
                                    {getPartKeyStat(p, lang)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={count === 0}
                                  onClick={() => {
                                    setInspectedPart(p);
                                    removePart(p);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/15 border border-white/15 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  aria-label={en ? `Remove ${displayName}` : `Quitar ${displayName}`}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span
                                  className="w-6 text-center font-mono-tech font-bold text-sm"
                                  style={{ color: count > 0 ? '#f8d274' : '#94a3b8' }}
                                >
                                  {count}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectedPart(p);
                                    addPart(p);
                                  }}
                                  className="w-8 h-8 glass-btn-gold flex items-center justify-center cursor-pointer font-bold"
                                  aria-label={en ? `Add ${displayName}` : `Agregar ${displayName}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Collapsible Locked Parts Toggle (keeps catalog clean) */}
                      {lockedParts.length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowLockedParts((v) => !v)}
                            className="w-full px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 text-xs font-display text-[#94a3b8] flex items-center justify-between cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5" />
                              {en
                                ? `Next levels (${lockedParts.length} locked)`
                                : `Próximos niveles (${lockedParts.length} bloqueados)`}
                            </span>
                            {showLockedParts ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          {showLockedParts && (
                            <div className="mt-2 space-y-1.5">
                              {lockedParts.map((p) => {
                                const reqLevel = PART_UNLOCK_LEVEL_MAP[p.id] ?? 4;
                                return (
                                  <div
                                    key={p.id}
                                    onMouseEnter={() => setInspectedPart(p)}
                                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 opacity-65"
                                  >
                                    <span className="font-display text-xs text-[#cbd5e1] truncate">
                                      {getLocalizedPartName(p, lang)}
                                    </span>
                                    <span className="font-mono-tech text-[10px] text-amber-300 shrink-0">
                                      {en ? 'Level' : 'Nivel'} {reqLevel}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Fixed Bottom Inspector Strip + Clear Button (zero jumping popups) */}
                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0 flex-1 min-h-[34px] justify-start">
                        <Info className="w-4 h-4 text-[#7dd3fc] shrink-0 mt-0.5" />
                        <p className="font-display text-xs text-[#cbd5e1] leading-snug line-clamp-2">
                          {inspectedPart ? (
                            <>
                              <strong className="text-[#f8d274] font-semibold">
                                {getLocalizedPartName(inspectedPart, lang)}:
                              </strong>{' '}
                              {getShortPartSummary(inspectedPart, lang)}
                            </>
                          ) : en ? (
                            'Hover over a module to see what it does.'
                          ) : (
                            'Pasa el cursor sobre un módulo para ver para qué sirve.'
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!hasRocket}
                        onClick={clearDesign}
                        className="px-3 py-2 glass-btn-danger text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{en ? 'Clear' : 'Limpiar'}</span>
                      </button>
                    </div>
                  </section>

                  {/* RIGHT COLUMN: Visual Rocket Checklist + Active Gauges + Simple Status */}
                  <section className="lg:col-span-6 flex flex-col min-h-0 bg-[#060b16]/32 border border-white/15 rounded-xl p-3.5 gap-3 overflow-y-auto">
                    {/* 1. Rocket 4-Part Assembly Checklist */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-display font-bold text-[#f3f0e6]">
                          {en ? 'Rocket Parts' : 'Partes del Cohete'}
                        </h3>
                        <span
                          className={`font-mono-tech text-xs font-bold ${
                            isRocketComplete ? 'text-[#6ee7a8]' : 'text-[#f8d274]'
                          }`}
                        >
                          {builtStageCount} / 4 {en ? 'ready' : 'listas'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          {
                            num: '1',
                            name: en ? 'Structure' : 'Estructura',
                            hint: 'CSM',
                            ok: assembly.hasCore,
                          },
                          {
                            num: '2',
                            name: en ? 'Propulsion' : 'Propulsor',
                            hint: en ? 'Tank' : 'Tanque',
                            ok: assembly.hasBoosters,
                          },
                          {
                            num: '3',
                            name: en ? 'Power' : 'Energía',
                            hint: en ? 'Panel / Gear' : 'Panel / Eq.',
                            ok: assembly.hasFairing,
                          },
                          {
                            num: '4',
                            name: en ? 'Avionics' : 'Aviónica',
                            hint: 'AGC / Ant.',
                            ok: assembly.hasAvionics,
                          },
                        ].map((stage) => (
                          <div
                            key={stage.num}
                            className={`px-2.5 py-2 rounded-xl border transition-colors ${
                              stage.ok
                                ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100'
                                : 'bg-white/[0.03] border-white/10 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-display font-bold">
                              <span>
                                {stage.num}. {stage.name}
                              </span>
                              {stage.ok ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                              )}
                            </div>
                            <div className="font-mono-tech text-[10px] opacity-75 mt-0.5">
                              {stage.hint}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. Unlocked Telemetry Bars (No giant locked text walls!) */}
                    {activeSensorCount > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {hasMassHelper && (
                          <div
                            className={`p-3 rounded-xl bg-black/25 border space-y-1.5 ${
                              massOver ? 'border-rose-400/55' : 'border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-display font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-[#7dd3fc]" />
                                {en ? 'Weight' : 'Peso'}
                              </span>
                              <span
                                className={`font-mono-tech font-bold ${
                                  massOver ? 'text-rose-300' : 'text-[#6ee7a8]'
                                }`}
                              >
                                {result.totalMassKg.toFixed(0)} / {result.launcherCapacityKg.toFixed(0)} kg
                              </span>
                            </div>
                            <ProgressBar
                              fraction={
                                result.launcherCapacityKg > 0
                                  ? result.totalMassKg / result.launcherCapacityKg
                                  : 0
                              }
                              color={massOver ? '#fb7185' : '#38bdf8'}
                            />
                          </div>
                        )}

                        {hasDeltaVHelper && (
                          <div
                            className={`p-3 rounded-xl bg-black/25 border space-y-1.5 ${
                              !dvOk ? 'border-rose-400/55' : 'border-emerald-400/35'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-display font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                                <Fuel className="w-3.5 h-3.5 text-[#fb923c]" />
                                {en ? 'ΔV Thrust' : 'Impulso ΔV'}
                              </span>
                              <span
                                className={`font-mono-tech font-bold ${
                                  dvOk ? 'text-[#6ee7a8]' : 'text-rose-300'
                                }`}
                              >
                                {result.deltaVAvailable.toFixed(0)} / {result.deltaVRequired.toFixed(0)} m/s
                              </span>
                            </div>
                            <ProgressBar
                              fraction={
                                result.deltaVRequired > 0
                                  ? result.deltaVAvailable / result.deltaVRequired
                                  : 0
                              }
                              color={dvOk ? '#34d399' : '#fb7185'}
                            />
                          </div>
                        )}

                        {hasBudgetHelper && (
                          <div
                            className={`p-3 rounded-xl bg-black/25 border space-y-1.5 ${
                              budgetOver ? 'border-amber-400/55' : 'border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-display font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-[#f8d274]" />
                                {en ? 'Budget' : 'Presupuesto'}
                              </span>
                              <span
                                className={`font-mono-tech font-bold ${
                                  budgetOver ? 'text-amber-300' : 'text-[#f8d274]'
                                }`}
                              >
                                ${result.totalCost.toFixed(1)}M / ${result.budget.toFixed(0)}M
                              </span>
                            </div>
                            <ProgressBar
                              fraction={result.budget > 0 ? result.totalCost / result.budget : 0}
                              color={budgetOver ? '#fbbf24' : '#f8d274'}
                            />
                          </div>
                        )}

                        {hasPowerHelper && (
                          <div
                            className={`p-3 rounded-xl bg-black/25 border space-y-1.5 ${
                              !powerOk || !batteryOk ? 'border-rose-400/55' : 'border-emerald-400/35'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-display font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-[#fde047]" />
                                {en ? 'Power / Shadow' : 'Energía / Sombra'}
                              </span>
                              <span
                                className={`font-mono-tech font-bold ${
                                  powerOk && batteryOk ? 'text-[#6ee7a8]' : 'text-rose-300'
                                }`}
                              >
                                +{daylightPower.toFixed(0)}W / -{result.consumptionWatts.toFixed(0)}W
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-mono-tech text-[10px] text-[#94a3b8]">
                              <span>{en ? 'Battery' : 'Batería'}</span>
                              <span className={batteryOk ? 'text-[#6ee7a8]' : 'text-rose-300'}>
                                {result.batteryWh.toFixed(0)} / {result.energyNeededInEclipseWh.toFixed(0)} Wh
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compact 1-Line Locked Sensors Notice (replaces 4 verbose locked paragraphs) */}
                    {lockedSensors.length > 0 && (
                      <div className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-2 text-xs text-[#94a3b8]">
                        <Lock className="w-3.5 h-3.5 text-[#f8d274] shrink-0" />
                        <span className="truncate">
                          {en ? 'Locked sensors:' : 'Sensores bloqueados:'} {lockedSensors.join(' · ')}
                        </span>
                      </div>
                    )}

                    {/* 3. Science & Subsystems (Level 4) */}
                    {hasScienceHelper && (
                      <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-display font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                            <FlaskConical className="w-3.5 h-3.5 text-[#a78bfa]" />
                            {en ? 'Science & Gear' : 'Ciencia y Equipos'}
                          </span>
                          <span
                            className={`font-mono-tech font-bold ${
                              scienceOk ? 'text-[#6ee7a8]' : 'text-[#f8d274]'
                            }`}
                          >
                            {result.sciencePoints.toFixed(0)} / {result.minScience.toFixed(0)} pts
                          </span>
                        </div>
                        <ProgressBar
                          fraction={
                            result.minScience > 0 ? result.sciencePoints / result.minScience : 0
                          }
                          color={scienceOk ? '#34d399' : '#a78bfa'}
                        />
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-0.5">
                          {[
                            { label: 'CSM', ok: hasStructure },
                            { label: 'AGC', ok: hasComputer },
                            { label: en ? 'Antenna' : 'Antena', ok: hasAntenna },
                            { label: en ? 'Camera' : 'Cámara', ok: hasCamera },
                            { label: 'EASEP', ok: hasEASEP },
                            { label: en ? 'Shield' : 'Escudo', ok: hasShielding },
                          ].map((sys) => (
                            <div
                              key={sys.label}
                              className={`px-1.5 py-1 rounded-lg border font-mono-tech text-[10px] text-center truncate ${
                                sys.ok
                                  ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200'
                                  : 'bg-white/[0.03] border-white/10 text-slate-400'
                              }`}
                            >
                              {sys.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Mission Goal / Concise Status Strip (pushed cleanly to bottom) */}
                    <div className="mt-auto space-y-2">
                      {!hasDiagnosticsHelper && (
                        <div className="px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-400/25 text-xs font-display text-[#e2e8f0] leading-snug">
                          <strong className="text-[#7dd3fc] font-semibold">
                            {en ? 'Goal' : 'Meta'} {currentLevel.code}:
                          </strong>{' '}
                          {currentLevel.level === 1
                            ? en
                              ? 'Complete all 4 parts and perform your first launch.'
                              : 'Completa las 4 partes y realiza tu primer despegue.'
                            : currentLevel.level === 2
                              ? en
                                ? 'Dock at the space station and transmit ≥ 20 pts (Camera + Battery).'
                                : 'Acopla en la estación espacial y envía ≥ 20 pts (Cámara + Batería).'
                              : en
                                ? 'Travel to the Moon and transmit ≥ 30 pts with the Camera.'
                                : 'Viaja a la Luna y envía ≥ 30 pts con la Cámara.'}
                        </div>
                      )}

                      {conciseAlerts.length === 0 ? (
                        <div className="px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center gap-2 text-xs font-display font-semibold text-[#6ee7a8]">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {en
                              ? 'Rocket ready. Close this window and press Launch.'
                              : 'Cohete listo. Cierra esta ventana y pulsa Lanzamiento.'}
                          </span>
                        </div>
                      ) : (
                        <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-1">
                          {conciseAlerts.slice(0, 3).map((msg, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs font-display text-[#fde68a]"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-[#f8d274] shrink-0" />
                              <span className="truncate">{msg}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          );
        })()}

      {/* 7. Big FAILED screen + Diario on Launch failures */}
      {isLaunchFailed &&
        (() => {
          const reason = launchTelemetry.abortReason;
          const missingSections: string[] = [];
          if (!assembly.hasCore)
            missingSections.push(
              en ? 'CSM / Eagle Structure (Core stage)' : 'Estructura CSM / Eagle (Etapa central)'
            );
          if (!assembly.hasBoosters)
            missingSections.push(
              en ? 'Propellant Tank (Boosters)' : 'Tanque de propelente (Propulsores)'
            );
          if (!assembly.hasFairing)
            missingSections.push(
              en ? 'Power or Instruments (Upper fairing)' : 'Energía o Instrumentos (Cofia superior)'
            );
          if (!assembly.hasAvionics)
            missingSections.push(
              en
                ? 'AGC Computer or Antenna (Launch escape tower)'
                : 'Computadora AGC o Antena (Torre de escape)'
            );

          const failHint =
            reason === 'no_fuel'
              ? en
                ? 'Out of fuel: you did not install any Propellant Tank (TLI/DPS). Without fuel the rocket cannot lift off the pad.'
                : 'Falta combustible: no instalaste ningún Tanque de propelente (TLI/DPS). Sin combustible el cohete no puede despegar de la plataforma.'
              : reason === 'incomplete'
                ? en
                  ? `Incomplete rocket on the pad: missing ${missingSections.join(', ')}. Complete all 4 parts in Design [M] to launch.`
                  : `Cohete incompleto en plataforma: falta ${missingSections.join(', ')}. Completa las 4 partes en Diseño [M] para poder despegar.`
                : reason === 'overweight' || launchTelemetry.outcome === LaunchOutcome.LaunchFailed
                  ? en
                    ? `Excess weight (${result.totalMassKg.toFixed(0)} kg) for this launcher (${result.launcherCapacityKg.toFixed(0)} kg): the rocket lifted off, lost thrust and fell, though thankfully the crew survived! Remove modules or adjust payload.`
                    : `Sobra peso (${result.totalMassKg.toFixed(0)} kg) para este lanzador (${result.launcherCapacityKg.toFixed(0)} kg): el cohete despegó, perdió empuje y cayó, ¡pero por suerte la tripulación se salvó! Quita módulos o ajusta la carga.`
                  : en
                    ? `Insufficient velocity / ΔV (${result.deltaVAvailable.toFixed(0)} m/s of ${result.deltaVRequired.toFixed(0)} m/s required): the spacecraft reached space, failed to complete orbital speed for ${currentDestination.name}, and began falling in space. Add Propellant Tanks or reduce dry mass.`
                    : `Velocidad / ΔV insuficiente (${result.deltaVAvailable.toFixed(0)} m/s de ${result.deltaVRequired.toFixed(0)} m/s requeridos): la nave llegó al espacio, no completó la velocidad necesaria hacia ${currentDestination.name} y empezó a caer en el espacio. Añade Tanques de propelente o reduce masa seca.`;
          const failMeta = buildEndingMeta(
            reason === 'overweight'
              ? 'fallo_grave_despegue_luna'
              : 'sin_combustible_salir_luna',
            failHint,
            lang
          );
          const launchImprovementHints = buildImprovementHints(
            result,
            design,
            currentLevel,
            null,
            lang
          );
          const allLaunchHints = [
            failHint,
            ...launchImprovementHints.filter((h) => h !== failHint),
          ];
          return (
            <div
              className={`fixed inset-0 z-30 flex items-center justify-center p-2 md:p-5 pointer-events-auto overflow-y-auto ${
                reason === 'low_dv'
                  ? 'bg-[#040814]/35 backdrop-blur-[3px]'
                  : 'bg-[#040814]/55 backdrop-blur-md'
              }`}
            >
              <div
                className="w-full max-w-5xl glass-panel p-4 md:p-6 space-y-3.5 my-auto"
                style={{ borderColor: 'rgba(244, 63, 94, 0.45)' }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-rose-400/25 pb-2.5">
                  <div>
                    <div className="font-mono-tech text-[10px] tracking-[0.2em] uppercase text-rose-300">
                      {en ? 'CRITICAL LAUNCH ALERT' : 'ALERTA CRÍTICA DE DESPEGUE'} ·{' '}
                      {currentLevel.code}
                    </div>
                    <div className="font-display text-4xl md:text-5xl font-black tracking-tight text-rose-400 leading-none mt-1">
                      FAILED
                    </div>
                    <div className="font-display text-sm md:text-base font-bold text-[#f3f0e6] mt-1">
                      {launchTelemetry.phase} — {launchTelemetry.resultMessage}
                    </div>
                  </div>
                  <div className="w-12 h-12 glass-well border border-rose-400/40 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-7 h-7 text-rose-400" />
                  </div>
                </div>

                {displayJustUnlockedLevel && (
                  <div className="glass-panel-gold p-3.5 border border-emerald-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-pixel text-[10px] uppercase tracking-wider text-[#6ee7a8] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {en
                          ? `Telemetry gathered! Level ${displayJustUnlockedLevel.level} (${displayJustUnlockedLevel.code}) unlocked`
                          : `¡Telemetría recopilada! Nivel ${displayJustUnlockedLevel.level} (${displayJustUnlockedLevel.code}) desbloqueado`}
                      </div>
                      <p className="font-display text-xs text-[#e2e8f0]">
                        {en
                          ? 'NASA learned from this first launch: you now have Mass & ΔV sensors, Battery, S-Band Antenna, Redundant AGC, and Hasselblad Camera in Design [M].'
                          : 'La NASA aprendió de este primer despegue: ahora tienes sensores de Masa y ΔV, Batería, Antena Banda S, AGC redundante y Cámara Hasselblad en Diseño [M].'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={advanceToNextLevel}
                      className="px-4 py-2 glass-btn-emerald text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      {en
                        ? `Advance to Level ${displayJustUnlockedLevel.level} (${displayJustUnlockedLevel.code})`
                        : `Avanzar a Nivel ${displayJustUnlockedLevel.level} (${displayJustUnlockedLevel.code})`}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <ElDiarioGlobalPaper
                  mission={
                    currentBriefing?.title ??
                    (en
                      ? 'Mission MK11: Full Lunar Route'
                      : 'Misión MK11: Ruta Lunar Completa')
                  }
                  orbit={
                    currentDestination?.name ??
                    (en ? 'MK11 · Full Lunar Route' : 'MK11 · Ruta Lunar Completa')
                  }
                  days={0}
                  science={0}
                  score={0}
                  rating={en ? 'Launch failed' : 'Despegue fallido'}
                  hasCamera={design.some((p) => p.id === 'camara-hd')}
                  meta={failMeta}
                  launchStageFailure
                  launchAbortReason={reason}
                  extraHints={showLaunchHints ? launchImprovementHints : undefined}
                  levelInfo={currentLevelInfo}
                  compact
                />

                {showLaunchHints && (
                  <div className="glass-panel-gold p-3.5 space-y-1.5">
                    <div className="font-mono-tech text-[10px] uppercase tracking-wider text-[#f8d274] font-bold flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" />
                      {en
                        ? 'Hints · What you could improve on your rocket'
                        : 'Pistas · Qué podrías mejorar en tu cohete'}
                    </div>
                    <ul className="font-display text-xs text-amber-200 space-y-1 leading-snug">
                      {allLaunchHints.map((hint, idx) => (
                        <li key={idx}>• {hint}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowLaunchHints((v) => !v)}
                    className={`px-5 py-2.5 glass-btn-gold text-sm font-display font-bold cursor-pointer flex items-center gap-2 ${
                      showLaunchHints ? 'ring-2 ring-[#f8d274]' : ''
                    }`}
                  >
                    <Lightbulb className="w-4 h-4" />
                    {showLaunchHints ? (en ? 'Hide Hints' : 'Ocultar Pistas') : en ? 'Hints' : 'Pistas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => enterLaunchStage(true)}
                    className="px-5 py-2.5 glass-btn-danger text-sm font-display font-bold cursor-pointer"
                  >
                    {en ? 'Fix in Design [M]' : 'Corregir en Diseño [M]'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEndingData({
                        mission:
                          currentBriefing?.title ??
                          (en
                            ? 'Mission MK11: Full Lunar Route'
                            : 'Misión MK11: Ruta Lunar Completa'),
                        orbit:
                          currentDestination?.name ??
                          (en ? 'MK11 · Full Lunar Route' : 'MK11 · Ruta Lunar Completa'),
                        days: 0,
                        science: 0,
                        score: 0,
                        rating: en ? 'Launch failed' : 'Despegue fallido',
                        hasCamera: design.some((p) => p.id === 'camara-hd'),
                        habitability: en
                          ? 'The spacecraft failed to leave Earth safely to complete the mission.'
                          : 'La nave no logró abandonar la Tierra en condiciones seguras para completar la misión.',
                        endingMeta: failMeta,
                        launchStageFailure: true,
                        launchAbortReason: reason,
                        advice: failHint,
                        improvementHints: allLaunchHints,
                        isFinalMissionSuccess: false,
                      });
                      setScreen('ending');
                    }}
                    className="px-5 py-2.5 glass-btn-gold text-sm font-display font-bold cursor-pointer flex items-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    {en ? 'View Fullscreen Newspaper' : 'Ver Diario en Pantalla Completa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLaunchHints(false);
                      setLaunchTelemetry(getIdleLaunchTelemetry(en));
                      setLaunchCmd((prev) => ({
                        id: prev.id + 1,
                        action: 'prepare',
                      }));
                    }}
                    className="px-5 py-2.5 glass-btn text-sm font-display font-bold cursor-pointer"
                  >
                    {en ? 'Retry Launch' : 'Reintentar Despegue'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

    </div>
  );
}

function ProgressBar({
  fraction,
  color,
}: {
  fraction: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return (
    <div className="w-full h-2.5 glass-bar-track overflow-hidden">
      <div
        className="h-full glass-bar-fill transition-all duration-150"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function LunarMissionEmblem({
  color,
  accent,
  size = 28,
}: {
  color: string;
  accent: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse
        cx="16"
        cy="16"
        rx="13"
        ry="5.5"
        transform="rotate(-28 16 16)"
        stroke={color}
        strokeWidth="1.75"
        strokeOpacity="0.85"
      />
      <circle cx="16" cy="16" r="6" fill="rgba(255,255,255,0.08)" stroke="#e2e8f0" strokeWidth="1.5" />
      <path
        d="M18.5 11.2A5.2 5.2 0 0 0 12.2 19.6A5.2 5.2 0 0 1 18.5 11.2Z"
        fill="#cbd5e1"
        opacity="0.45"
      />
      <circle cx="26.5" cy="10.2" r="2.1" fill={accent} />
    </svg>
  );
}
