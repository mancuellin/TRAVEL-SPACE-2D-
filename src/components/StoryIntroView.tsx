import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  CHARACTER_SHEET_SRC,
  CharacterSpriteSheet,
  CleanSprite,
  ExpressionKey,
  MK11_ROCKET_SHEET_SRC,
  VAN_SPRITE_SRC,
  loadCharacterSpriteSheet,
  loadCleanSprite,
  loadMk11RocketSprites,
} from '../utils/spriteLoader';

type Kind = 'Dialogue' | 'BriefingDoc' | 'Rollout';
type Place = 'Control' | 'Pad39A';
type Who = 'None' | 'Director' | 'Armstrong' | 'Aldrin' | 'Collins';

interface Beat {
  kind: Kind;
  place: Place;
  chars: Who[];
  speaker: Who;
  text: string;
}

const CONTROL_ROOM_BG =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_14.46.28_ec21e07b.jpeg';
const LAUNCH_BASE_BG =
  '/assets/aistudio/WhatsApp_Image_2026-11-14_at_14.40.58_9059f59e.jpeg';
const ROLLOUT_VEHICLE_AUDIO_SRC =
  '/assets/aistudio/630027__el_boss__space-ship-accelerating__1__1860a848.wav';
const INTRO_SPEAK_AUDIO_SRC =
  '/assets/aistudio/creatorshome-video-game-speak-358238__2__9ddb124a.mp3';

const BEATS_ES: Beat[] = [
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong'],
    speaker: 'None',
    text: 'Centro de Control Espacial. Todo el equipo está en sus puestos para preparar el lanzamiento de la misión lunar MK11.',
  },
  {
    kind: 'BriefingDoc',
    place: 'Control',
    chars: [],
    speaker: 'None',
    text: '',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Director',
    text: 'Tripulación MK11, el cohete ya está listo en la base de lanzamiento. El objetivo es completar toda la ruta lunar: llegar a la Luna, alunizar, evaluar su habitabilidad y regresar a salvo.',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Collins',
    text: 'Yo permaneceré al mando del módulo de retorno MK11 en órbita lunar, manteniendo la navegación y el enlace para el acoplamiento final.',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Aldrin',
    text: 'Durante los 5 días de operación descenderemos a la superficie lunar para tomar fotografías, recoger datos y muestras, y comprobar si la Luna es habitable.',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Armstrong',
    text: 'Si surge alguna falla técnica en la Luna, la repararemos en cabina, subiremos a acoplarnos en órbita y regresaremos al océano Pacífico.',
  },
  {
    kind: 'Rollout',
    place: 'Pad39A',
    chars: [],
    speaker: 'None',
    text: 'Traslado de la tripulación MK11 hacia la Plataforma de Lanzamiento...',
  },
  {
    kind: 'Dialogue',
    place: 'Pad39A',
    chars: ['Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Armstrong',
    text: 'Ya estamos en la plataforma de lanzamiento. Ingeniero, pulsa la tecla M para diseñar el cohete MK11 y autorizar el despegue.',
  },
];

const BEATS_EN: Beat[] = [
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong'],
    speaker: 'None',
    text: 'Space Control Center. The entire team is at their stations preparing the launch of lunar mission MK11.',
  },
  {
    kind: 'BriefingDoc',
    place: 'Control',
    chars: [],
    speaker: 'None',
    text: '',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Director',
    text: 'MK11 crew, the rocket is ready on the launch pad. Our objective is to complete the full lunar route: reach the Moon, land, assess habitability, and return safely.',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Collins',
    text: 'I will remain in command of the MK11 return module in lunar orbit, maintaining navigation and communications for the final docking.',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Aldrin',
    text: 'Over the 5 days of operation we will descend to the lunar surface to take photographs, gather data and samples, and test whether the Moon is habitable.',
  },
  {
    kind: 'Dialogue',
    place: 'Control',
    chars: ['Director', 'Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Armstrong',
    text: 'If any technical failure arises on the Moon, we will repair it in the cabin, ascend to dock in orbit, and splash down in the Pacific Ocean.',
  },
  {
    kind: 'Rollout',
    place: 'Pad39A',
    chars: [],
    speaker: 'None',
    text: 'Transferring MK11 crew to the Launch Pad...',
  },
  {
    kind: 'Dialogue',
    place: 'Pad39A',
    chars: ['Armstrong', 'Aldrin', 'Collins'],
    speaker: 'Armstrong',
    text: 'We are on the launch pad. Engineer, press M to design the MK11 rocket and authorize liftoff.',
  },
];

const TYPE_SPEED = 52;
const ROLLOUT_SECONDS = 6.0;

const CHAR_META_ES: Record<
  Exclude<Who, 'None'>,
  { name: string; role: string; color: string }
> = {
  Director: {
    name: 'Dir. de Vuelo (Jeremy)',
    role: 'Control MK11',
    color: '#f59e0b',
  },
  Armstrong: {
    name: 'Comandante (Victor)',
    role: 'Líder de Misión',
    color: '#38bdf8',
  },
  Aldrin: {
    name: 'Especialista (Reid)',
    role: 'Módulo Descenso',
    color: '#34d399',
  },
  Collins: {
    name: 'Pilota (Christina)',
    role: 'Módulo Retorno',
    color: '#a78bfa',
  },
};

const CHAR_META_EN: Record<
  Exclude<Who, 'None'>,
  { name: string; role: string; color: string }
> = {
  Director: {
    name: 'Flight Dir. (Jeremy)',
    role: 'MK11 Control',
    color: '#f59e0b',
  },
  Armstrong: {
    name: 'Commander (Victor)',
    role: 'Mission Lead',
    color: '#38bdf8',
  },
  Aldrin: {
    name: 'Specialist (Reid)',
    role: 'Lander Module',
    color: '#34d399',
  },
  Collins: {
    name: 'Pilot (Christina)',
    role: 'Return Module',
    color: '#a78bfa',
  },
};

const PixelSpriteCanvas: React.FC<{
  sprite: CleanSprite | null | undefined;
  flipX?: boolean;
  className?: string;
}> = ({ sprite, flipX = false, className = '' }) => {
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
    ctx.save();
    if (flipX) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sprite.canvas, 0, 0);
    ctx.restore();
  }, [sprite, ready, sprite?.width, sprite?.height, flipX]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{
        imageRendering: 'pixelated',
        aspectRatio:
          sprite && sprite.ready ? `${sprite.width} / ${sprite.height}` : undefined,
      }}
    />
  );
};

interface StoryIntroViewProps {
  launcherCapacityKg?: number;
  isMuted?: boolean;
  masterVolume?: number;
  onFinished: () => void;
}

export const StoryIntroView: React.FC<StoryIntroViewProps> = ({
  launcherCapacityKg = 1200,
  isMuted = false,
  masterVolume = 1,
  onFinished,
}) => {
  void launcherCapacityKg;
  const { lang } = useLanguage();
  const en = lang === 'en';
  const BEATS = en ? BEATS_EN : BEATS_ES;
  const CHAR_META = en ? CHAR_META_EN : CHAR_META_ES;
  const [index, setIndex] = useState(0);
  const [beatTime, setBeatTime] = useState(0);
  const [placeTime, setPlaceTime] = useState(0);
  const [typed, setTyped] = useState(0);
  const [spritesReadyTick, setSpritesReadyTick] = useState(0);

  const charSheet = useMemo<CharacterSpriteSheet>(
    () =>
      loadCharacterSpriteSheet(CHARACTER_SHEET_SRC, () =>
        setSpritesReadyTick((v) => v + 1)
      ),
    []
  );

  const rocketSprites = useMemo(
    () =>
      loadMk11RocketSprites(MK11_ROCKET_SHEET_SRC, () =>
        setSpritesReadyTick((v) => v + 1)
      ),
    []
  );

  const vanSprite = useMemo<CleanSprite>(
    () => loadCleanSprite(VAN_SPRITE_SRC, 0, 1, 0, 1, 26),
    []
  );

  useEffect(() => {
    if (vanSprite.ready) return;
    const id = window.setInterval(() => {
      if (vanSprite.ready) {
        setSpritesReadyTick((v) => v + 1);
        window.clearInterval(id);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [vanSprite]);

  void spritesReadyTick;

  const beat = BEATS[index];

  const enterBeat = useCallback(
    (nextIdx: number, prevPlace: Place) => {
      if (nextIdx >= BEATS.length) {
        onFinished();
        return;
      }
      const nextBeat = BEATS[nextIdx];
      setIndex(nextIdx);
      setBeatTime(0);
      setTyped(nextBeat.kind === 'BriefingDoc' ? 9999 : 0);
      if (nextBeat.place !== prevPlace) {
        setPlaceTime(0);
      }
    },
    [BEATS, onFinished]
  );

  const advance = useCallback(() => {
    const b = BEATS[index];
    if (b.kind === 'Dialogue' && typed < b.text.length) {
      setTyped(b.text.length);
      return;
    }
    enterBeat(index + 1, b.place);
  }, [BEATS, index, typed, enterBeat]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setBeatTime((v) => {
        const next = v + dt;
        if (BEATS[index].kind === 'Rollout' && next >= ROLLOUT_SECONDS) {
          enterBeat(index + 1, BEATS[index].place);
        }
        return next;
      });
      setPlaceTime((v) => v + dt);
      setTyped((v) => v + dt * TYPE_SPEED);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [BEATS, index, enterBeat]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance]);

  const fadeAlpha = Math.max(0, 1 - placeTime / 0.65);
  const typing = typed < beat.text.length;
  const visibleText = beat.text.slice(0, Math.floor(Math.min(typed, beat.text.length)));

  const rolloutAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isRolloutBeat = beat.kind === 'Rollout';
  const isCharacterSpeakingNow =
    beat.kind === 'Dialogue' && beat.speaker !== 'None' && typing;

  // Character speech SFX: strictly ONLY when characters speak during the Intro
  useEffect(() => {
    const audio = new Audio(INTRO_SPEAK_AUDIO_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = Math.max(0, Math.min(1, 0.52 * masterVolume));
    audio.muted = isMutedRef.current;
    speakAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      if (speakAudioRef.current === audio) {
        speakAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const audio = speakAudioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    audio.volume = Math.max(
      0,
      Math.min(1, 0.52 * Math.max(0, Math.min(1, masterVolume)))
    );

    if (isCharacterSpeakingNow && !isMuted && masterVolume > 0.001) {
      if (audio.paused) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [isCharacterSpeakingNow, isMuted, masterVolume]);

  // Start & clean up vehicle transport sound during Rollout beat
  useEffect(() => {
    if (!isRolloutBeat) {
      if (rolloutAudioRef.current) {
        rolloutAudioRef.current.pause();
        rolloutAudioRef.current.src = '';
        rolloutAudioRef.current = null;
      }
      return;
    }

    const audio = new Audio(ROLLOUT_VEHICLE_AUDIO_SRC);
    audio.volume = 0.05;
    audio.muted = isMutedRef.current;
    rolloutAudioRef.current = audio;

    if (!isMutedRef.current) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = '';
      if (rolloutAudioRef.current === audio) {
        rolloutAudioRef.current = null;
      }
    };
  }, [isRolloutBeat]);

  useEffect(() => {
    const audio = rolloutAudioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    if (!isMuted && isRolloutBeat && audio.paused && !audio.ended) {
      audio.play().catch(() => {});
    }
  }, [isMuted, isRolloutBeat]);

  // Smooth accelerate -> cruise -> brake physics curve for the transport vehicle
  const rolloutProgress = Math.min(1, beatTime / ROLLOUT_SECONDS);
  const driveU = Math.min(1, rolloutProgress / 0.88);
  const vanTravel =
    rolloutProgress >= 0.88
      ? 1
      : 0.5 * (1 - Math.cos(Math.pow(driveU, 0.92) * Math.PI));
  const vanSpeedFactor =
    rolloutProgress >= 0.88 ? 0 : Math.sin(Math.pow(driveU, 0.92) * Math.PI);
  const brakeIntensity =
    rolloutProgress < 0.62
      ? 0
      : rolloutProgress <= 0.88
        ? Math.min(1, (rolloutProgress - 0.62) / 0.14)
        : Math.max(0, 1 - (rolloutProgress - 0.88) / 0.08);

  // Dynamic suspension squat on acceleration, road rumble during cruise, and nose-dip rebound on stop
  const vanPitchDeg =
    !isRolloutBeat
      ? 0
      : rolloutProgress < 0.28
        ? -1.5 * Math.sin((rolloutProgress / 0.28) * Math.PI)
        : rolloutProgress < 0.62
          ? Math.sin(beatTime * 9) * 0.25 * vanSpeedFactor
          : rolloutProgress < 0.88
            ? 2.3 * Math.sin(((rolloutProgress - 0.62) / 0.26) * Math.PI)
            : -1.3 *
              Math.exp(-(rolloutProgress - 0.88) * 28) *
              Math.sin((rolloutProgress - 0.88) * 52);

  const vanBounceY = isRolloutBeat
    ? vanSpeedFactor * (Math.sin(beatTime * 24) * 1.45 + Math.sin(beatTime * 43) * 0.55)
    : 0;
  const wheelSpinDeg = vanTravel * 1440;

  // Modulate transport vehicle sound volume with acceleration & braking fade-out
  useEffect(() => {
    const audio = rolloutAudioRef.current;
    if (!audio || !isRolloutBeat) return;
    const fadeIn = Math.min(1, rolloutProgress / 0.08);
    const fadeOut =
      rolloutProgress > 0.66
        ? Math.max(0, 1 - (rolloutProgress - 0.66) / 0.30)
        : 1;
    audio.volume = Math.max(
      0,
      Math.min(0.68, 0.62 * fadeIn * fadeOut * Math.max(0, Math.min(1, masterVolume)))
    );
  }, [isRolloutBeat, rolloutProgress, masterVolume]);

  return (
    <div
      onClick={advance}
      className="relative w-full h-screen overflow-hidden cursor-pointer select-none bg-[#0a1020]"
    >
      {/* Background: Grounded Mission Control Room or Grounded Launch Pad Base */}
      {beat.place === 'Control' && (
        <div className="absolute inset-0 overflow-hidden bg-[#0c1220]">
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{
              width: 'max(100vw, calc(100vh * 1.7917))',
              height: 'max(100vh, calc(100vw / 1.7917))',
            }}
          >
            <img
              src={CONTROL_ROOM_BG}
              alt={en ? 'MK11 Mission Control Room' : 'Sala de Control de Misión MK11'}
              className="w-full h-full object-cover brightness-[1.04] contrast-[1.06] saturate-[1.08]"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          {/* Atmospheric screen glow + cinematic vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 50% 35%, rgba(56, 189, 248, 0.14) 0%, rgba(15, 23, 42, 0.08) 45%, rgba(4, 7, 15, 0.72) 100%)',
            }}
          />
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 pixel-panel-gold font-pixel text-[10px] tracking-wider text-[#f8d274] uppercase">
            {en ? 'Mission Control · MK11 Mission' : 'Sala de Control · Misión MK11'}
          </div>
        </div>
      )}

      {beat.place === 'Pad39A' && (
        <div className="absolute inset-0 overflow-hidden bg-[#1047b8]">
          {/* Aspect-locked 1376x768 Launchpad Stage so Rocket & Van stay locked to pad & road */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{
              width: 'max(100vw, calc(100vh * 1.7917))',
              height: 'max(100vh, calc(100vw / 1.7917))',
            }}
          >
            <img
              src={LAUNCH_BASE_BG}
              alt={en ? 'MK11 Launch Base' : 'Base de Lanzamiento MK11'}
              className="w-full h-full object-cover brightness-[1.03] contrast-[1.06] saturate-[1.1]"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Exact Same MK11 Rocket Sprite as Launch Tab seated firmly onto the pad deck */}
            {rocketSprites.idle.ready && (
              <div
                className="absolute -translate-x-1/2 h-[54%] flex items-end justify-center pointer-events-none"
                style={{
                  left: '52.5%',
                  bottom: '16.9%',
                }}
              >
                <PixelSpriteCanvas
                  sprite={rocketSprites.idle}
                  className="h-full w-auto drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]"
                />
              </div>
            )}

            {/* Rollout / Crew Transfer NASA Van driving along the pad road */}
            {beat.kind === 'Rollout' && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${(-16 + vanTravel * 52).toFixed(2)}%`,
                  bottom: '13.4%',
                  transform: `translateY(${vanBounceY.toFixed(1)}px)`,
                }}
              >
                {vanSprite.ready ? (
                  <div className="relative flex flex-col items-center">
                    {/* Ground contact shadow */}
                    <div
                      className="absolute -bottom-1 left-[8%] right-[8%] h-2.5 rounded-full bg-black/55 blur-[2px] pointer-events-none"
                      style={{
                        transform: `scaleX(${(1 + vanSpeedFactor * 0.04).toFixed(3)})`,
                      }}
                    />

                    {/* Trailing tarmac dust / exhaust wisps while moving */}
                    {vanSpeedFactor > 0.1 && (
                      <div className="absolute right-[92%] bottom-[6%] flex items-end pointer-events-none">
                        {[0, 1, 2, 3].map((pIdx) => {
                          const cycle = (beatTime * 2.4 + pIdx * 0.25) % 1;
                          const dx = -cycle * 64 * (0.5 + vanSpeedFactor * 0.7);
                          const dy = -cycle * 14 - Math.sin(cycle * Math.PI) * 5;
                          const sc = 0.7 + cycle * 1.35;
                          const op =
                            Math.sin(cycle * Math.PI) * 0.42 * vanSpeedFactor;
                          return (
                            <div
                              key={pIdx}
                              className="absolute w-6 h-4 rounded-full bg-slate-200/75 blur-[3px]"
                              style={{
                                transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sc.toFixed(2)})`,
                                opacity: op.toFixed(3),
                              }}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Main chassis container with suspension pitch */}
                    <div
                      className="relative"
                      style={{
                        transform: `rotate(${vanPitchDeg.toFixed(2)}deg)`,
                        transformOrigin: '52% 82%',
                      }}
                    >
                      {/* Warm headlight beam projecting ahead from front nose LED */}
                      <div
                        className="absolute left-[96%] top-[44%] w-24 sm:w-32 h-10 sm:h-12 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(254, 249, 195, 0.56) 0%, rgba(254, 240, 138, 0.18) 55%, rgba(254, 240, 138, 0) 100%)',
                          clipPath: 'polygon(0% 34%, 100% 0%, 100% 100%, 0% 66%)',
                          opacity: (0.65 + vanSpeedFactor * 0.35).toFixed(2),
                        }}
                      />

                      <PixelSpriteCanvas
                        sprite={vanSprite}
                        flipX={true}
                        className="h-20 sm:h-24 md:h-28 w-auto drop-shadow-[0_4px_0_rgba(0,0,0,0.75)]"
                      />

                      {/* Animated spinning hub spokes over rear and front wheels */}
                      {[21.7, 79.2].map((wheelLeftPct) => (
                        <div
                          key={wheelLeftPct}
                          className="absolute w-5 h-5 sm:w-6 sm:h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-75"
                          style={{
                            left: `${wheelLeftPct}%`,
                            top: '75%',
                            transform: `translate(-50%, -50%) rotate(${wheelSpinDeg.toFixed(1)}deg)`,
                          }}
                        >
                          <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-slate-400/70 rounded-full" />
                          <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-slate-400/70 rounded-full" />
                        </div>
                      ))}

                      {/* Rear T-taillight brake glow while slowing down & parked */}
                      {brakeIntensity > 0.03 && (
                        <div
                          className="absolute left-[-1.5%] top-[47%] w-6 h-7 rounded-full pointer-events-none blur-[3px]"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(248, 113, 113, 0.95) 0%, rgba(239, 68, 68, 0.5) 50%, rgba(239, 68, 68, 0) 100%)',
                            opacity: brakeIntensity.toFixed(2),
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-14 pixel-panel" />
                )}
              </div>
            )}
          </div>

          {/* Warm sunlight bloom + atmospheric vignette on Pad39A */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 14% 16%, rgba(255, 250, 215, 0.24) 0%, rgba(186, 230, 253, 0.08) 32%, rgba(4, 9, 24, 0.42) 100%)',
            }}
          />

          {beat.kind === 'Rollout' && (
            <>
              <div className="absolute top-[7%] left-[12%] right-[12%] pixel-panel-gold px-6 py-4 text-center">
                <p className="font-display text-lg md:text-xl font-bold text-[#f3f0e6]">
                  {visibleText}
                </p>
              </div>
              <div className="absolute bottom-6 right-6 font-pixel text-[10px] text-[#f8d274] pixel-panel px-3 py-1.5">
                {en ? 'CLICK to continue' : 'CLIC para continuar'}
              </div>
            </>
          )}
        </div>
      )}

      {/* Grounded Crew & Director Pixel-Art Portraits anchored right onto the dialogue desk/ground */}
      {beat.kind === 'Dialogue' && (
        <div className="absolute inset-x-0 bottom-[23%] flex justify-center items-end gap-2 sm:gap-5 md:gap-8 px-4 pointer-events-none z-10">
          {beat.chars.map((who) => {
            if (who === 'None') return null;
            const meta = CHAR_META[who];
            const speaking = who === beat.speaker;
            const dim = beat.speaker !== 'None' && !speaking;
            const bounce =
              speaking && typing ? Math.abs(Math.sin(beatTime * 11)) * 2 : 0;

            let expression: ExpressionKey = 'neutro';
            if (speaking && typing) {
              const seq: ExpressionKey[] = [
                'transicion',
                'hablando1',
                'hablando2',
                'hablando1',
              ];
              expression = seq[Math.floor(beatTime * 8) % seq.length];
            } else if (speaking) {
              expression = 'hablando1';
            }

            const portraitSprite = charSheet[who]?.[expression];

            return (
              <div
                key={who}
                className="flex flex-col items-center transition-all duration-150"
                style={{
                  transform: `translateY(${(-bounce).toFixed(1)}px)`,
                  filter: dim ? 'brightness(0.68) saturate(0.85)' : undefined,
                }}
              >
                <div className="relative flex flex-col items-center">
                  {/* Grounded pixel nameplate above shoulder/chest base */}
                  <div
                    className={`mb-1 px-2.5 py-1 text-center ${
                      speaking ? 'pixel-panel-gold' : 'pixel-panel'
                    }`}
                  >
                    <div
                      className="text-xs md:text-sm font-display font-bold leading-tight whitespace-nowrap"
                      style={{ color: speaking ? meta.color : '#f3f0e6' }}
                    >
                      {meta.name}
                    </div>
                    <div className="font-pixel text-[9px] text-[#9aa4bd]">
                      {meta.role}
                    </div>
                  </div>
                  {portraitSprite?.ready ? (
                    <PixelSpriteCanvas
                      sprite={portraitSprite}
                      className="h-32 sm:h-40 md:h-48 w-auto drop-shadow-[0_4px_0_rgba(0,0,0,0.85)]"
                    />
                  ) : (
                    <div className="w-28 h-40 pixel-panel" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Official NASA Flight Plan Dossier Card */}
      {beat.kind === 'BriefingDoc' && (
        <div className="absolute inset-0 z-20 bg-black/78 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-3xl flex flex-col items-center">
            <img
              src={
                en
                  ? '/assets/aistudio/WhatsApp_Image_2026-11-15_at_14.55.12_7cb51270.jpeg'
                  : '/assets/aistudio/WhatsApp_Image_2026-11-14_at_17.48.06_93ef4de3.jpeg'
              }
              alt={en ? 'MK11 Mission - Official Flight Plan' : 'Misión MK11 - Plan de Vuelo Oficial'}
              className="w-full max-h-[82vh] object-contain rounded-xl border-2 border-[#38bdf8]/45 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            />
          </div>
          <div className="absolute bottom-6 right-6 pixel-btn-gold px-3 py-1.5 font-pixel text-[10px]">
            {en ? 'SPACE or CLICK to continue' : 'ESPACIO o CLIC para continuar'}
          </div>
        </div>
      )}

      {/* Pixel-Art Dialogue Bar */}
      {beat.kind === 'Dialogue' && (
        <div className="absolute inset-x-0 bottom-0 h-[23%] z-20 pixel-panel px-6 md:px-14 py-5 flex flex-col justify-between">
          {beat.speaker !== 'None' && (
            <div
              className="inline-flex items-center gap-2 self-start px-3.5 py-1 -mt-10 font-display font-bold text-xs md:text-sm text-[#080a0f] border-2 border-[#080a0f] shadow-[0_3px_0_#080a0f]"
              style={{ backgroundColor: CHAR_META[beat.speaker].color }}
            >
              <span>{CHAR_META[beat.speaker].name}</span>
              <span className="opacity-80 font-pixel text-[10px]">
                · {CHAR_META[beat.speaker].role}
              </span>
            </div>
          )}
          <p className="font-display text-base md:text-xl text-[#f3f0e6] leading-relaxed mt-1">
            {visibleText}
          </p>
          <div className="self-end font-pixel text-[10px] text-[#f8d274]">
            {en ? 'SPACE or CLICK »' : 'ESPACIO o CLIC »'}
          </div>
        </div>
      )}

      {/* Fade Overlay */}
      {fadeAlpha > 0.01 && (
        <div
          className="absolute inset-0 z-30 bg-black pointer-events-none"
          style={{ opacity: fadeAlpha }}
        />
      )}

      {/* Skip Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFinished();
        }}
        className="absolute top-4 right-4 z-30 px-4 py-2 pixel-btn-gold font-display font-bold text-xs cursor-pointer"
      >
        {en ? 'Skip to Launch' : 'Ir al Lanzamiento'}
      </button>
    </div>
  );
};
