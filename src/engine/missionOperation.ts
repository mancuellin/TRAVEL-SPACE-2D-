import { REAL_LUNAR_PHYSICS } from '../data/gameData';
import { Language } from '../i18n/LanguageContext';
import {
  LogKind,
  LunarDestination,
  MissionBriefing,
  MissionEndingKey,
  MissionEndingMeta,
  MissionResult,
  OperationEvent,
  OperationOutcome,
  OperationStage,
  PartData,
  PartType,
} from '../types/game';

const STORM_THRESHOLD = 0.5;
const STEPS_PER_DAY = 8; // 8 pasos por día = 40 pasos en 5 días
const ANTENNA_FAIL_PROB_PER_STEP = 0.012;
const ANTENNA_OUTAGE_STEPS = 4;

export type MinigameKind = 'cables' | 'birome' | 'oxygen' | 'docking' | 'station_docking';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function f0(v: number): string {
  return v.toFixed(0);
}

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MissionOperation {
  public readonly totalDays: number;
  public readonly totalSteps: number;
  public readonly radiationLevel: number;
  public readonly shieldingFactor: number;
  public readonly computerLivesTotal: number;
  public readonly antennaCount: number;
  public readonly dataRate: number;
  public readonly sciencePoints: number;
  public readonly minScience: number;
  public readonly stormProbPerStep: number;
  public readonly solarLossPerStep: number;

  public readonly hasStructure: boolean;
  public readonly hasCamera: boolean;
  public readonly hasEASEP: boolean;
  public readonly hasRTG: boolean;
  public readonly hasShielding: boolean;
  public readonly isLandingMission: boolean;
  public readonly isStationMission: boolean;
  public readonly isLunarOrbitMission: boolean;
  public readonly totalPowerW: number;
  public readonly deltaVAvailable: number;
  public readonly fuelMassKg: number;
  public readonly lang: Language;
  public readonly habitabilityVerdict: string;

  public step = 0;
  public day = 1;
  public solarHealth = 1;
  public computerLivesLeft: number;
  public scienceDelivered = 0;
  public outageStepsTotal = 0;
  public outcome: OperationOutcome = OperationOutcome.Running;
  public stage: OperationStage = 'transit';
  public awaitingMinigame: MinigameKind | null = null;
  public surfaceProblemFixed = false;
  public cablesFixed = false;
  public biromeUsed = false;
  public oxygenFixed = false;
  public dockingCompleted = false;
  public stationDocked = false;
  public stationPhotosTaken = false;
  public stationDataCollected = false;

  public landedOnMoon = false;
  public landingAborted = false;
  public hadPowerEmergency = false;
  public hadStormHit = false;
  public lostAllComputersInFlight = false;

  public endingMeta: MissionEndingMeta | null = null;
  public failureCause = '';
  public advice = '';
  public score = 0;
  public readonly log: OperationEvent[] = [];
  public readonly scoreLines: string[] = [];

  private readonly res: MissionResult;
  private readonly rng: () => number;
  private linkDownStepsLeftCount = 0;
  private readonly stepScience: number;
  private nextHealthMilestone = 0.9;

  constructor(
    parts: PartData[],
    result: MissionResult,
    destination: LunarDestination | null,
    briefing: MissionBriefing | null,
    seed: number,
    lang: Language = 'es'
  ) {
    this.lang = lang;
    this.habitabilityVerdict =
      lang === 'en'
        ? 'Not naturally habitable: lacks a breathable atmosphere, has direct solar radiation, and extreme temperatures (-170 °C to +120 °C). Viable only inside sealed pressurized habitats.'
        : 'No habitable de forma natural: carece de atmósfera respirable, presenta radiación solar directa y temperaturas extremas (-170 °C a +120 °C). Solo viable en bases selladas y presurizadas.';
    this.res = result;
    this.rng = createRng(seed);
    this.outcome = OperationOutcome.Running;

    let shield = 0;
    let lives = 0;
    let antennas = 0;
    let rate = 0;
    let structure = false;
    let cam = false;
    let easep = false;
    let rtg = false;

    for (const p of parts) {
      if (!p) continue;
      if (p.type === PartType.Structure) structure = true;
      if (p.id === 'camara-hd') cam = true;
      if (p.id === 'radar') easep = true;
      if (p.type === PartType.RTG) rtg = true;
      if (p.type === PartType.Computer) {
        lives += Math.max(1, p.computerLives);
      } else if (p.type === PartType.Antenna) {
        antennas++;
        rate = Math.max(rate, p.dataRate > 0 ? p.dataRate : 0.5);
      } else if (p.type === PartType.Shielding) {
        shield += p.shielding;
      }
    }

    this.hasStructure = structure;
    this.hasCamera = cam;
    this.hasEASEP = easep;
    this.hasRTG = rtg;
    this.hasShielding = shield > 0;
    this.isLandingMission = (destination?.profile ?? 'apollo11') === 'apollo11';
    this.isStationMission = destination?.profile === 'station';
    this.isLunarOrbitMission =
      !this.isLandingMission &&
      !this.isStationMission &&
      (destination?.distanceKm ?? 0) >= 100000;
    this.totalPowerW = result.solarWatts + result.rtgWatts;
    this.deltaVAvailable = result.deltaVAvailable;
    this.fuelMassKg = result.fuelMassKg;

    this.computerLivesTotal = lives;
    this.antennaCount = antennas;
    this.dataRate = rate;
    this.shieldingFactor = Math.min(0.8, shield);
    this.sciencePoints = result.sciencePoints;
    this.minScience = briefing ? briefing.minSciencePoints : 0;
    this.totalDays =
      briefing && briefing.missionDays > 0 ? Math.round(briefing.missionDays) : 5;
    this.totalSteps = this.totalDays * STEPS_PER_DAY;

    this.radiationLevel = destination ? destination.radiationLevel : 0.7;
    this.stormProbPerStep = 0.02 * this.radiationLevel;
    this.solarLossPerStep = 0.004 * this.radiationLevel;

    this.stepScience = (this.sciencePoints / this.totalSteps) * (this.antennaCount > 0 ? this.dataRate : 0);
    this.solarHealth = 1;
    this.computerLivesLeft = this.computerLivesTotal;

    const en = this.lang === 'en';
    const numLocale = en ? 'en-US' : 'es-ES';
    const destName = destination ? destination.name : en ? 'the Moon' : 'la Luna';
    const missionLabel = briefing ? briefing.title : en ? 'MK11 Mission' : 'Misión MK11';
    if (this.isLandingMission) {
      this.add(
        1,
        en
          ? `Liftoff confirmed for ${missionLabel} to ${destName} (${REAL_LUNAR_PHYSICS.distanceKm.toLocaleString(numLocale)} km · TLI injection ${REAL_LUNAR_PHYSICS.tliVelocityKms} km/s). Duration: ${this.totalDays} days.`
          : `Despegue confirmado de ${missionLabel} hacia ${destName} (${REAL_LUNAR_PHYSICS.distanceKm.toLocaleString(numLocale)} km · inyección TLI ${REAL_LUNAR_PHYSICS.tliVelocityKms} km/s). Duración: ${this.totalDays} días.`,
        LogKind.Info
      );
      if (!this.hasCamera) {
        this.add(
          1,
          en
            ? 'Warning: Hasselblad Camera was not loaded. The mission will proceed without taking photos.'
            : 'Aviso: no se cargó la Cámara Hasselblad. La misión continuará sin poder tomar fotos.',
          LogKind.Bad
        );
      }
      if (!this.hasEASEP) {
        this.add(
          1,
          en
            ? 'Warning: EASEP Package missing. Full surface science measurements will be unavailable.'
            : 'Aviso: falta el Paquete EASEP. Faltarán mediciones científicas completas en superficie.',
          LogKind.Bad
        );
      }
    } else {
      this.add(
        1,
        en
          ? `Liftoff confirmed for ${missionLabel} to ${destName} (${destination?.distanceKm.toLocaleString(numLocale) ?? '400'} km). Mission duration: ${this.totalDays} day(s).`
          : `Despegue confirmado de ${missionLabel} hacia ${destName} (${destination?.distanceKm.toLocaleString(numLocale) ?? '400'} km). Duración de misión: ${this.totalDays} día(s).`,
        LogKind.Info
      );
      if (this.minScience > 0 && !this.hasCamera) {
        this.add(
          1,
          this.isStationMission
            ? en
              ? 'Warning: Hasselblad Camera not loaded. You will not be able to photograph Earth from the space station.'
              : 'Aviso: no se cargó la Cámara Hasselblad. No podrás tomar fotos de la Tierra desde la estación espacial.'
            : en
              ? 'Warning: Hasselblad Camera not loaded. You will not be able to photograph the Moon or reach required science.'
              : 'Aviso: no se cargó la Cámara Hasselblad. No podrás fotografiar la Luna ni alcanzar la ciencia requerida.',
          LogKind.Bad
        );
      }
    }

    if (this.antennaCount === 0) {
      this.add(
        1,
        en
          ? 'Warning: no antenna included. Houston will struggle to receive telemetry data.'
          : 'Aviso: no se incluyó antena. Houston tendrá dificultades para recibir datos.',
        LogKind.Bad
      );
    }
    if (this.computerLivesTotal <= 0) {
      this.add(
        1,
        this.isLandingMission
          ? en
            ? 'Critical warning: no AGC computer onboard; lunar landing risks being aborted.'
            : 'Advertencia crítica: sin computadora AGC a bordo; el alunizaje correrá riesgo de aborto.'
          : en
            ? 'Critical warning: no operational AGC computer to stabilize orbit.'
            : 'Advertencia crítica: sin computadora AGC operativa para estabilizar la órbita.',
        LogKind.Bad
      );
    }
  }

  get finished(): boolean {
    return this.outcome !== OperationOutcome.Running;
  }

  get succeeded(): boolean {
    return this.endingMeta ? !this.endingMeta.isFailure : this.outcome === OperationOutcome.Success;
  }

  get computerAlive(): boolean {
    return this.computerLivesLeft > 0 && !this.lostAllComputersInFlight;
  }

  get linkUp(): boolean {
    return this.linkDownStepsLeftCount <= 0 && this.antennaCount > 0;
  }

  get linkDownDaysLeft(): number {
    return Math.max(0, Math.ceil(this.linkDownStepsLeftCount / STEPS_PER_DAY));
  }

  get progressFraction(): number {
    return this.step / Math.max(1, this.totalSteps);
  }

  get currentPhaseTitle(): string {
    const en = this.lang === 'en';
    if (!this.isLandingMission) {
      if (this.isStationMission) {
        if (this.stage === 'station_docking') {
          return en
            ? 'Docking · Full Spacecraft ↔ Space Station'
            : 'Acoplamiento · Nave Completa ↔ Estación Espacial';
        }
        if (this.stage === 'station_ops') {
          return en
            ? 'Space Station · Earth Data & Photos'
            : 'Estación Espacial · Datos y Fotos de la Tierra';
        }
        if (this.stage === 'return') {
          return en
            ? 'Undocking & Reentry toward the Pacific'
            : 'Desacople y reentrada hacia el Pacífico';
        }
        return en
          ? 'Orbital Rendezvous with Space Station MK-II'
          : 'Encuentro orbital con Estación Espacial MK-II';
      }
      if (this.isLunarOrbitMission) {
        return this.stage === 'return'
          ? en
            ? 'Return from Lunar Orbit to Earth'
            : 'Regreso desde órbita lunar hacia la Tierra'
          : en
            ? 'Lunar Reconnaissance Orbit (No Landing)'
            : 'Órbita lunar de reconocimiento (Sin alunizaje)';
      }
      return this.stage === 'return'
        ? en
          ? 'Test Reentry & Splashdown'
          : 'Reentrada y amerizaje de prueba'
        : en
          ? 'Low Earth Orbit (MK-I Test)'
          : 'Órbita Terrestre Baja (Prueba MK-I)';
    }
    switch (this.stage) {
      case 'transit':
        return en
          ? 'Transit & Lunar Approach'
          : 'Tránsito y acercamiento a la Luna';
      case 'landing_closeup':
        return en
          ? 'Lunar Surface · Close-up'
          : 'Superficie lunar · Primer plano';
      case 'problem_cables':
        return en
          ? 'Emergency · Electrical Wiring'
          : 'Emergencia · Cableado eléctrico';
      case 'problem_birome':
        return en
          ? 'Emergency · Engine Switch (Ballpoint Pen)'
          : 'Emergencia · Palanca del motor (Birome)';
      case 'problem_oxygen':
        return en
          ? 'Emergency · Oxygen Leak (O₂)'
          : 'Emergencia · Fuga de Oxígeno (O₂)';
      case 'ascent_docking':
        return this.landingAborted
          ? en
            ? 'Lunar Orbit · Landing Aborted (Preparing Return)'
            : 'Órbita lunar · Alunizaje abortado (preparando retorno)'
          : en
            ? 'Lunar Orbit · Docking with MK11 Return Module'
            : 'Órbita lunar · Acople con Módulo de Retorno MK11';
      case 'return':
      default:
        return en ? 'Return to Earth' : 'Regreso a la Tierra';
    }
  }

  resolveMinigame(kind: MinigameKind): void {
    if (this.awaitingMinigame !== kind) return;
    const en = this.lang === 'en';

    if (kind === 'cables') {
      this.cablesFixed = true;
      this.surfaceProblemFixed = true;
      this.awaitingMinigame = null;
      this.stage = 'landing_closeup';
      this.add(
        this.day,
        en
          ? 'MK11 lander cables reconnected. Internal power restored.'
          : 'Cables del módulo de descenso MK11 reconectados. Energía interna restablecida.',
        LogKind.Good
      );
      return;
    }

    if (kind === 'birome') {
      this.biromeUsed = true;
      this.surfaceProblemFixed = true;
      this.awaitingMinigame = null;
      this.stage = 'landing_closeup';
      this.add(
        this.day,
        en
          ? 'Apollo 11 Cameo: MK11 crew found a ballpoint pen in the cabin and engaged the ascent engine switch.'
          : 'Cameo Apolo 11: la tripulación MK11 encontró un birome en cabina y accionó el interruptor del motor de ascenso.',
        LogKind.Good
      );
      return;
    }

    if (kind === 'oxygen') {
      this.oxygenFixed = true;
      this.surfaceProblemFixed = true;
      this.awaitingMinigame = null;
      this.stage = 'landing_closeup';
      this.add(
        this.day,
        en
          ? 'Oxygen leak sealed inside Eagle cabin. O₂ pressure restored to 100% nominal.'
          : 'Fuga de oxígeno sellada en la cabina del Eagle. Presión de O₂ restablecida al 100% nominal.',
        LogKind.Good
      );
      return;
    }

    if (kind === 'docking') {
      this.dockingCompleted = true;
      this.awaitingMinigame = null;
      this.stage = 'return';
      this.add(
        this.day,
        en
          ? 'Docking complete! The MK11 lander joined the return module and begins the voyage back to Earth.'
          : '¡Acoplamiento completado! El módulo MK11 se unió al módulo de retorno e inicia viaje hacia la Tierra.',
        LogKind.Good
      );
      return;
    }

    if (kind === 'station_docking') {
      this.stationDocked = true;
      this.awaitingMinigame = null;
      this.stage = 'station_ops';
      this.scienceDelivered += this.stepScience;
      this.add(
        this.day,
        en
          ? 'Airtight docking confirmed! The full spacecraft docked with Space Station MK-II.'
          : '¡Acoplamiento hermético confirmado! La nave completa se insertó en la Estación Espacial MK-II.',
        LogKind.Good
      );
    }
  }

  stepDay(): void {
    if (this.finished || this.awaitingMinigame) return;
    const en = this.lang === 'en';
    this.step++;
    this.day = Math.min(this.totalDays, Math.max(1, Math.ceil(this.step / STEPS_PER_DAY)));

    // 1) Eventos de la ruta MK11 (sin bloquear por requisitos previos)
    this.handleDailyMilestones();
    if (this.finished || this.awaitingMinigame) return;

    // 2) Degradación solar en espacio profundo
    this.solarHealth *= 1 - this.solarLossPerStep;
    if (this.solarHealth < this.nextHealthMilestone) {
      this.add(
        this.day,
        en
          ? `Solar panels at ${f0(this.solarHealth * 100)}% due to deep-space exposure.`
          : `Paneles solares al ${f0(this.solarHealth * 100)}% por exposición en el viaje lunar.`,
        LogKind.Info
      );
      this.nextHealthMilestone -= 0.1;
    }

    // 3) Balance de energía (en vez de cortar en Día 1, registra emergencia para el desenlace)
    const powerCheck = this.powerOk(this.solarHealth);
    if (!powerCheck.ok && !this.hadPowerEmergency) {
      this.hadPowerEmergency = true;
      this.add(
        this.day,
        en
          ? `Power alert: ${powerCheck.why}. Crew activates emergency rationing.`
          : `Alerta eléctrica: ${powerCheck.why} La tripulación activa el racionamiento de emergencia.`,
        LogKind.Bad
      );
    }

    // 4) Tormenta solar / radiación espacial
    if (this.rng() < this.stormProbPerStep) {
      const sev = 0.3 + 0.7 * this.rng();
      const eff = sev * (1 - this.shieldingFactor);
      const txt = en
        ? `Solar storm detected (${f0(sev * 100)}%` +
          (this.shieldingFactor > 0
            ? `, ${f0(eff * 100)}% after shielding`
            : '') +
          ').'
        : `Tormenta solar detectada (${f0(sev * 100)}%` +
          (this.shieldingFactor > 0
            ? `, ${f0(eff * 100)}% tras el blindaje`
            : '') +
          ').';

      if (eff > STORM_THRESHOLD) {
        this.hadStormHit = true;
        if (this.computerLivesLeft > 0) {
          this.computerLivesLeft--;
        }
        if (this.computerLivesLeft > 0) {
          this.add(
            this.day,
            en
              ? `${txt} Primary AGC switched to backup (${this.computerLivesLeft} life left).`
              : `${txt} La AGC principal conmutó al respaldo (${this.computerLivesLeft} vida restante).`,
            LogKind.Bad
          );
        } else {
          this.lostAllComputersInFlight = true;
          this.add(
            this.day,
            en
              ? `${txt} AGC computer failure! Crew attempts manual maneuvers.`
              : `${txt} ¡Avería en la computadora AGC! La tripulación intenta maniobrar manualmente.`,
            LogKind.Bad
          );
        }
      } else {
        this.add(
          this.day,
          en
            ? `${txt} Shielding and systems held with no damage.`
            : `${txt} El blindaje y los sistemas resistieron sin daños.`,
          LogKind.Good
        );
      }
    }

    // 5) Interferencia de antena
    if (this.antennaCount > 0 && this.rng() < ANTENNA_FAIL_PROB_PER_STEP) {
      if (this.antennaCount >= 2) {
        this.add(
          this.day,
          en
            ? 'Brief primary antenna glitch; backup antenna maintained communication with Earth.'
            : 'Fallo breve en antena principal; la antena de respaldo mantuvo la comunicación con Tierra.',
          LogKind.Good
        );
      } else {
        this.linkDownStepsLeftCount = ANTENNA_OUTAGE_STEPS;
        this.outageStepsTotal += ANTENNA_OUTAGE_STEPS;
        this.add(
          this.day,
          en
            ? 'Temporary link blackout with Houston due to missing backup antenna.'
            : 'Corte temporal de enlace con Houston por falta de antena de respaldo.',
          LogKind.Bad
        );
      }
    }

    // 6) Transmisión de datos científicos
    if (this.linkDownStepsLeftCount > 0) {
      this.linkDownStepsLeftCount--;
      if (this.linkDownStepsLeftCount === 0) {
        this.add(
          this.day,
          en ? 'Link with Earth restored.' : 'Enlace con la Tierra restablecido.',
          LogKind.Good
        );
      }
    } else {
      this.scienceDelivered += this.stepScience;
    }

    if (this.step >= this.totalSteps) {
      this.complete();
    }
  }

  private handleDailyMilestones(): void {
    if (!this.isLandingMission) {
      this.handleOrbitalTestMilestones();
      return;
    }
    const en = this.lang === 'en';
    const s = this.step;

    // DÍA 1 (pasos 1-8): Acercamiento progresivo a la Luna
    if (s === 4) {
      this.add(
        1,
        en
          ? `Lunar approach underway. Active systems: ${this.hasRTG ? 'RTG SNAP-27, ' : ''}${this.hasShielding ? 'thermal shielding, ' : ''}${this.computerLivesTotal > 0 ? 'AGC' : 'manual control'}.`
          : `Aproximación lunar en curso. Sistemas activos: ${this.hasRTG ? 'RTG SNAP-27, ' : ''}${this.hasShielding ? 'blindaje térmico, ' : ''}${this.computerLivesTotal > 0 ? 'AGC' : 'control manual'}.`,
        LogKind.Info
      );
    } else if (s === 8) {
      this.add(
        1,
        en
          ? `Figure-8 trajectory complete. Braking burn and lunar orbit insertion at ${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} km/s.`
          : `Trayectoria en 8 completada. Maniobra de frenado e inserción en órbita lunar a ${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} km/s.`,
        LogKind.Good
      );
    }

    // DÍA 2 (pasos 9-16): Intento de alunizaje
    else if (s === 9) {
      if (this.computerLivesTotal <= 0 || this.lostAllComputersInFlight) {
        this.landingAborted = true;
        this.landedOnMoon = false;
        this.stage = 'ascent_docking';
        this.add(
          2,
          en
            ? 'LANDING FAILED! Without an operational AGC guidance computer, MK-11 could not find a safe landing site and aborts exploration.'
            : '¡ATERRIZAJE FALLIDO! Sin computadora de guía AGC operativa, MK-11 no encontró dónde aterrizar con seguridad y aborta la exploración.',
          LogKind.Bad
        );
      } else {
        this.landedOnMoon = true;
        this.stage = 'landing_closeup';
        this.add(
          2,
          en
            ? `LUNAR LANDING COMPLETE! The MK11 lander touches down under ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² lunar gravity while the return module remains in orbit.`
            : `¡ALUNIZAJE COMPLETADO! El módulo de descenso MK11 posa sus patas bajo gravedad lunar de ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² mientras el módulo de retorno permanece en órbita.`,
          LogKind.Good
        );
      }
    } else if (s === 13 && this.landedOnMoon) {
      this.add(
        2,
        en
          ? `Lunar exploration started: measuring surface radiation, lunar dust, and true ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² gravity (1/6 Earth g).`
          : `Exploración lunar iniciada: medición de radiación superficial, polvo lunar y gravedad real de ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² (1/6 g terrestre).`,
        LogKind.Info
      );
    }

    // DÍA 3 (pasos 17-24): Recolección de información, fotos y habitabilidad
    else if (s === 17) {
      if (!this.landedOnMoon) {
        this.add(
          3,
          en
            ? 'Emergency orbit: evaluating remaining resources to attempt a return to Earth.'
            : 'Órbita de emergencia: evaluando recursos disponibles para intentar el regreso a la Tierra.',
          LogKind.Info
        );
      } else if (this.hasCamera) {
        this.add(
          3,
          en
            ? 'Hasselblad Camera: capturing high-definition photographs of lunar soil, craters, and horizon.'
            : 'Cámara Hasselblad: capturando fotografías de alta definición del suelo, cráteres y horizonte lunar.',
          LogKind.Good
        );
      } else {
        this.add(
          3,
          en
            ? 'No camera onboard: performing other surface tasks without taking photographs.'
            : 'Sin cámara a bordo: realizando otras tareas de superficie sin poder tomar fotografías.',
          LogKind.Bad
        );
      }
    } else if (s === 20 && this.landedOnMoon) {
      if (this.hasEASEP) {
        this.add(
          3,
          en
            ? 'EASEP Package & samples: collecting lunar rocks and analyzing useful scientific measurements.'
            : 'Paquete EASEP y muestras: recolectando rocas lunares y analizando mediciones científicas útiles.',
          LogKind.Good
        );
      } else {
        this.add(
          3,
          en
            ? 'No EASEP Package: scientific instruments are missing for complete measurements.'
            : 'Sin Paquete EASEP: faltan instrumentos científicos para obtener mediciones completas.',
          LogKind.Bad
        );
      }
    } else if (s === 24 && this.landedOnMoon) {
      this.add(
        3,
        en
          ? 'Habitability verdict: the Moon is NOT habitable without spacesuits or pressurized domes.'
          : 'Veredicto de habitabilidad: la Luna NO es habitable sin trajes ni domos presurizados.',
        LogKind.Info
      );
    }

    // DÍA 4 (pasos 25-32): Emergencia aleatoria en superficie (cables, birome u oxígeno)
    else if (s === 26 && this.landedOnMoon && !this.surfaceProblemFixed) {
      const roll = this.rng();
      if (roll < 1 / 3) {
        this.stage = 'problem_cables';
        this.awaitingMinigame = 'cables';
        this.add(
          4,
          en
            ? 'MK11 MODULE PROBLEM! Several launch-panel wires came loose. Reconnect them to continue.'
            : '¡PROBLEMA EN EL MÓDULO MK11! Varios cables del panel de despegue se soltaron. Reconéctalos para continuar.',
          LogKind.Bad
        );
      } else if (roll < 2 / 3) {
        this.stage = 'problem_birome';
        this.awaitingMinigame = 'birome';
        this.add(
          4,
          en
            ? 'CRITICAL CABIN FAILURE! The ascent engine breaker switch snapped off. Find a ballpoint pen to engage it (Apollo 11 cameo).'
            : '¡FALLA CRÍTICA EN CABINA! Se rompió la palanca del interruptor del motor de ascenso. Busca un birome para accionarlo (cameo Apolo 11).',
          LogKind.Bad
        );
      } else {
        this.stage = 'problem_oxygen';
        this.awaitingMinigame = 'oxygen';
        this.add(
          4,
          en
            ? 'LIFE SUPPORT ALARM! Oxygen (O₂) hose leak inside the Eagle. Seal the crack and secure the line.'
            : '¡ALARMA DE SOPORTE VITAL! Fuga en la manguera de oxígeno (O₂) dentro del Eagle. Sella la grieta y asegura la línea.',
          LogKind.Bad
        );
      }
    }

    // DÍA 5 (pasos 33-40): Despegue lunar, acople y regreso a la Tierra
    else if (s === 33) {
      if (this.landingAborted) {
        this.stage = 'return';
        this.add(
          5,
          en
            ? 'Return burn from lunar orbit after aborted landing.'
            : 'Encendido de retorno desde órbita lunar tras el aterrizaje abortado.',
          LogKind.Info
        );
      } else if (!this.hasStructure || this.lostAllComputersInFlight) {
        // Fallo grave al despegar de la Luna
        const missing = !this.hasStructure
          ? en
            ? 'Missing CSM / Eagle Structure to withstand the lunar ascent burn.'
            : 'Falta la Estructura CSM / Eagle para soportar el encendido lunar.'
          : en
            ? 'The AGC computer was destroyed before the ascent ignition.'
            : 'La computadora AGC quedó destruida antes del encendido de ascenso.';
        this.finishWithEnding(
          'fallo_grave_despegue_luna',
          OperationOutcome.FailedTakeoffCrash,
          missing,
          en
            ? 'Hint: equip CSM / Eagle Structure and protect your AGC Computer with Heat Shield and radiation armor.'
            : 'Pista: equipa Estructura CSM / Eagle y protege tu Computadora AGC con Escudo térmico y blindaje.'
        );
      } else if (this.deltaVAvailable < 2600 || this.fuelMassKg < 200) {
        // Sin combustible para salir de la Luna
        this.finishWithEnding(
          'sin_combustible_salir_luna',
          OperationOutcome.FailedFuelAscent,
          en
            ? `Available ΔV (${f0(this.deltaVAvailable)} m/s) insufficient to lift off from the Moon (minimum 2600 m/s).`
            : `ΔV disponible (${f0(this.deltaVAvailable)} m/s) insuficiente para despegar desde la Luna (mínimo 2600 m/s).`,
          en
            ? 'Hint: more Propellant Tanks (TLI/DPS) were needed in Design to power lunar ascent.'
            : 'Pista: faltaron Tanques de propelente (TLI/DPS) en Diseño para impulsar el ascenso lunar.'
        );
      }
    } else if (s === 34 && this.landedOnMoon && !this.dockingCompleted) {
      this.stage = 'ascent_docking';
      this.awaitingMinigame = 'docking';
      this.add(
        5,
        en
          ? `MK11 lunar ascent (gravity ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² · lunar escape ${REAL_LUNAR_PHYSICS.lunarEscapeVelocityKms} km/s) toward the return module in orbit (${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} km/s).`
          : `Ascenso lunar MK11 (gravedad ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² · escape lunar ${REAL_LUNAR_PHYSICS.lunarEscapeVelocityKms} km/s) hacia el módulo de retorno en órbita (${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} km/s).`,
        LogKind.Info
      );
    } else if (s === 37) {
      if (this.deltaVAvailable < 3400) {
        // Sin combustible durante el regreso
        this.finishWithEnding(
          'sin_combustible_regreso',
          OperationOutcome.FailedFuelReturn,
          en
            ? `Fuel was enough to leave lunar orbit, but ran out on the way home (${f0(this.deltaVAvailable)} / 3400 m/s).`
            : `El combustible alcanzó para salir de la órbita lunar, pero se agotó en el regreso (${f0(this.deltaVAvailable)} / 3400 m/s).`,
          en
            ? 'Hint: add 1 or 2 extra Propellant Tanks to cover the full return maneuver.'
            : 'Pista: añade 1 o 2 Tanques de propelente adicionales para cubrir la maniobra completa de regreso.'
        );
      } else if (this.totalPowerW <= 0 || (this.hadPowerEmergency && this.res.batteryWh <= 0)) {
        // Avería mortal en el viaje
        this.finishWithEnding(
          'averia_mortal_viaje',
          OperationOutcome.FailedBreakdown,
          en
            ? 'Total power and life-support collapse with no generation or batteries during the return trip.'
            : 'Colapso total de energía y soporte vital sin generación ni baterías durante el trayecto de regreso.',
          en
            ? 'Hint: equip Solar Panels, RTG Generator, and Lunar Batteries in Design to prevent fatal failure.'
            : 'Pista: equipa Paneles solares, Generador RTG y Baterías lunares en Diseño para evitar una avería mortal.'
        );
      }
    } else if (s === this.totalSteps) {
      this.add(
        5,
        this.landingAborted
          ? en
            ? 'MK11 capsule splashes down in the Pacific Ocean after aborting the landing.'
            : 'Cápsula MK11 ameriza en el océano Pacífico tras abortar el alunizaje.'
          : en
            ? 'Splashdown in the Pacific Ocean complete.'
            : 'Amerizaje en el océano Pacífico completado.',
        this.landingAborted ? LogKind.Bad : LogKind.Good
      );
    }
  }

  private powerOk(health: number): { ok: boolean; why: string } {
    const en = this.lang === 'en';
    const solar = this.res.solarWatts * health;
    const daylight = solar + this.res.rtgWatts;
    const cons = this.res.consumptionWatts;

    if (daylight < cons) {
      return {
        ok: false,
        why: en
          ? `in sunlight panels generate ${f0(daylight)} W while craft consumes ${f0(cons)} W`
          : `al sol los paneles generan ${f0(daylight)} W y la nave consume ${f0(cons)} W`,
      };
    }

    // Nivel 1 (MK-I) usa celdas internas de reserva en órbita baja; las baterías externas se desbloquean en Nivel 2.
    if (this.totalDays === 1) {
      return { ok: true, why: '' };
    }

    const eclipseH = this.res.eclipseMinutes / 60;
    const dayH = (this.res.periodMinutes - this.res.eclipseMinutes) / 60;
    const need = Math.max(0, cons - this.res.rtgWatts) * eclipseH;

    if (need > this.res.batteryWh) {
      return {
        ok: false,
        why: en
          ? `insufficient battery for lunar shadow (${f0(need)} Wh needed, ${f0(this.res.batteryWh)} Wh available)`
          : `batería insuficiente para la sombra lunar (${f0(need)} Wh necesarios, ${f0(this.res.batteryWh)} Wh disponibles)`,
      };
    }

    const recharge = (daylight - cons) * dayH;
    if (need > 0 && recharge < need) {
      return {
        ok: false,
        why: en
          ? 'solar panels cannot recharge battery in time during daylight phase'
          : 'los paneles no recargan la batería a tiempo en la fase iluminada',
      };
    }

    return { ok: true, why: '' };
  }

  private handleOrbitalTestMilestones(): void {
    const en = this.lang === 'en';
    const s = this.step;
    if (this.totalDays === 1) {
      // Nivel 1 · MK-I: Órbita Baja LEO (8 pasos)
      if (s === 2) {
        this.add(
          1,
          en
            ? 'Low Earth Orbit reached (400 km · 7.8 km/s). MK-I structural telemetry active.'
            : 'Órbita terrestre baja alcanzada (400 km · 7.8 km/s). Telemetría estructural MK-I activa.',
          LogKind.Good
        );
      } else if (s === 5) {
        this.add(
          1,
          en
            ? 'Checking orbital link with Houston and thermal stability in shadow.'
            : 'Verificando enlace orbital con Houston y estabilidad térmica en sombra.',
          LogKind.Info
        );
      } else if (s === 7) {
        this.stage = 'return';
      } else if (s === this.totalSteps) {
        this.add(
          1,
          en
            ? 'MK-I test complete! Test capsule deorbits and splashes down safely.'
            : '¡Prueba MK-I completada! Cápsula de ensayo desorbita y ameriza a salvo.',
          LogKind.Good
        );
      }
      return;
    }

    if (this.isStationMission) {
      // Nivel 2 · MK-II: Estación Espacial (16 pasos = 2 días)
      if (s === 2) {
        this.add(
          1,
          en
            ? 'Rendezvous orbit reached (420 km). Tracking Space Station MK-II beacon.'
            : 'Órbita de encuentro alcanzada (420 km). Rastreando baliza de la Estación Espacial MK-II.',
          LogKind.Info
        );
      } else if (s === 5 && !this.stationDocked) {
        this.stage = 'station_docking';
        this.awaitingMinigame = 'station_docking';
        this.add(
          1,
          en
            ? 'Space Station in sight! Align the ring and dock the full craft into port MK11.'
            : '¡Estación Espacial a la vista! Alinea el aro e inserta la nave completa en el puerto MK11.',
          LogKind.Info
        );
      } else if (s === 7) {
        this.stationDataCollected = true;
        if (this.hasCamera && this.antennaCount > 0) {
          this.scienceDelivered += 4;
        }
        this.add(
          1,
          en
            ? 'Docked at Space Station: downloading orbital telemetry and microgravity science logs.'
            : 'Acoplados en la Estación Espacial: descargando información orbital y registros científicos de microgravedad.',
          LogKind.Good
        );
      } else if (s === 9) {
        if (this.hasCamera) {
          this.stationPhotosTaken = true;
          this.add(
            2,
            en
              ? 'Hasselblad Camera: capturing high-definition photographs of Earth, oceans, and atmosphere from the station.'
              : 'Cámara Hasselblad: capturando fotografías de alta definición de la Tierra, océanos y atmósfera desde la estación.',
            LogKind.Good
          );
        } else {
          this.add(
            2,
            en
              ? 'No Hasselblad Camera: unable to photograph Earth from the space station.'
              : 'Sin Cámara Hasselblad: imposible tomar fotografías de la Tierra desde la estación espacial.',
            LogKind.Bad
          );
        }
      } else if (s === 11) {
        this.add(
          2,
          en
            ? 'Passing through Earth shadow (35 min eclipse). Checking station battery reserves.'
            : 'Paso por la sombra terrestre (35 min de eclipse). Comprobando reservas de batería en la estación.',
          this.hadPowerEmergency ? LogKind.Bad : LogKind.Info
        );
      } else if (s === 13) {
        this.stage = 'return';
        this.add(
          2,
          en
            ? 'Clean undocking from Space Station. Transmitting Earth photos and starting reentry.'
            : 'Desacople limpio de la Estación Espacial. Transmitiendo fotos de la Tierra e iniciando reentrada.',
          LogKind.Info
        );
      } else if (s === this.totalSteps) {
        this.add(
          2,
          en
            ? 'MK-II reentry complete. Crew splashes down safely in the Pacific Ocean.'
            : 'Reentrada MK-II completada. La tripulación ameriza a salvo en el océano Pacífico.',
          this.hadPowerEmergency ? LogKind.Bad : LogKind.Good
        );
      }
      return;
    }

    // Nivel 3 · MK-III: Reconocimiento en Órbita Lunar (24 pasos)
    if (s === 4) {
      this.add(
        1,
        en
          ? 'Translunar transit to the Moon (384,400 km). Evaluating shielding against solar storms.'
          : 'Tránsito translunar hacia la Luna (384,400 km). Evaluando blindaje ante tormentas solares.',
        LogKind.Info
      );
    } else if (s === 8) {
      this.add(
        1,
        en
          ? `Lunar orbit insertion (110 km · ${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} km/s). Lunar flyby without landing.`
          : `Inserción en órbita lunar (110 km · ${REAL_LUNAR_PHYSICS.lunarOrbitVelocityKms} km/s). Sobrevuelo lunar sin alunizaje.`,
        LogKind.Good
      );
    } else if (s === 12) {
      if (this.hasCamera) {
        this.add(
          2,
          en
            ? 'Hasselblad Camera: photographing Mare Tranquillitatis to prepare the upcoming landing.'
            : 'Cámara Hasselblad: fotografiando el Mar de la Tranquilidad para preparar el futuro alunizaje.',
          LogKind.Good
        );
      } else {
        this.add(
          2,
          en
            ? 'No Hasselblad Camera: unable to capture lunar reconnaissance imagery.'
            : 'Sin Cámara Hasselblad: imposible capturar imágenes de reconocimiento lunar.',
          LogKind.Bad
        );
      }
    } else if (s === 16) {
      this.add(
        2,
        en
          ? 'Crossing the far side of the Moon (45 min eclipse). Verifying power autonomy.'
          : 'Paso por la cara oculta de la Luna (45 min de eclipse). Comprobando autonomía eléctrica.',
        this.hadPowerEmergency ? LogKind.Bad : LogKind.Info
      );
    } else if (s === 20) {
      this.stage = 'return';
      this.add(
        3,
        en
          ? 'Transmitting high-resolution orbital maps and igniting return burn to Earth.'
          : 'Transmitiendo mapas orbitales de alta resolución y encendiendo retorno hacia la Tierra.',
        LogKind.Info
      );
    } else if (s === this.totalSteps) {
      this.add(
        3,
        en
          ? 'MK-III translunar return complete. Safe splashdown in the Pacific Ocean.'
          : 'Retorno translunar MK-III completado. Amerizaje seguro en el océano Pacífico.',
        LogKind.Good
      );
    }
  }

  private completeOrbitalTest(): void {
    const en = this.lang === 'en';
    const isTrainingNoFail = this.totalDays <= 2;

    // 1) Fallo grave de estructura o pérdida total de computadora AGC
    if (!this.hasStructure || this.lostAllComputersInFlight) {
      const cause = !this.hasStructure
        ? en
          ? 'Missing CSM / Eagle Structure to withstand orbital maneuvers.'
          : 'Faltó la Estructura CSM / Eagle para resistir las maniobras orbitales.'
        : en
          ? 'Solar storms destroyed the AGC computer during flight.'
          : 'Las tormentas solares destruyeron la computadora AGC durante el vuelo.';
      const hint = en
        ? 'Hint: include CSM Structure and protect the AGC with Heat Shield and radiation armor or a redundant AGC.'
        : 'Pista: incluye Estructura CSM y protege la AGC con Escudo térmico y blindaje o AGC redundante.';
      if (isTrainingNoFail) {
        this.finishWithEnding('regreso_emergencia', OperationOutcome.Success, cause, hint);
        return;
      }
      this.finishWithEnding(
        'fallo_grave_despegue_luna',
        OperationOutcome.FailedComputer,
        cause,
        hint
      );
      return;
    }

    // 2) Fallo eléctrico en eclipse / falta de baterías o generación insuficiente
    const batteryCheckFailed =
      this.totalDays >= 2 &&
      this.hadPowerEmergency &&
      (this.res.batteryWh <= 0 || this.res.energyNeededInEclipseWh > this.res.batteryWh);
    if (
      this.totalPowerW <= 0 ||
      this.totalPowerW * this.solarHealth < this.res.consumptionWatts ||
      batteryCheckFailed
    ) {
      const cause =
        this.totalDays === 1
          ? en
            ? 'Insufficient solar power generation to run MK-I capsule systems.'
            : 'Faltó generación eléctrica solar suficiente para alimentar los sistemas de la cápsula MK-I.'
          : en
            ? 'Electrical collapse during orbital eclipse due to missing batteries or insufficient solar generation.'
            : 'Colapso eléctrico durante la fase de sombra orbital por falta de baterías o generación solar insuficiente.';
      const hint =
        this.totalDays === 1
          ? en
            ? 'Hint: include at least one basic Solar Panel to cover your MK-I rocket consumption.'
            : 'Pista: incluye al menos un Panel solar básico para cubrir el consumo de tu cohete MK-I.'
          : en
            ? 'Hint: install a Lunar Battery and enough Solar Panels to cover eclipse consumption.'
            : 'Pista: instala Batería lunar y suficientes Paneles solares para cubrir el consumo durante el eclipse.';
      if (isTrainingNoFail) {
        this.finishWithEnding('regreso_emergencia', OperationOutcome.Success, cause, hint);
        return;
      }
      this.finishWithEnding(
        'averia_mortal_viaje',
        OperationOutcome.FailedBreakdown,
        cause,
        hint
      );
      return;
    }

    // 3) Objetivo científico mínimo (Nivel 2 estación requiere ≥ 20 pts, Nivel 3 requiere ≥ 30 pts)
    if (this.minScience > 0 && this.scienceDelivered < this.minScience) {
      if (!this.hasCamera) {
        this.finishWithEnding(
          'sin_camara',
          OperationOutcome.Success,
          this.isStationMission
            ? en
              ? `The full craft docked at the space station, but without a Hasselblad Camera it took no Earth photos (${f0(this.scienceDelivered)}/${f0(this.minScience)} pts).`
              : `La nave completa se acopló en la estación espacial, pero sin Cámara Hasselblad no tomó fotos de la Tierra (${f0(this.scienceDelivered)}/${f0(this.minScience)} pts).`
            : en
              ? `The capsule returned safely, but without a Hasselblad Camera no lunar reconnaissance was obtained (${f0(this.scienceDelivered)}/${f0(this.minScience)} pts).`
              : `La cápsula regresó a salvo, pero sin Cámara Hasselblad no se obtuvo el reconocimiento lunar (${f0(this.scienceDelivered)}/${f0(this.minScience)} pts).`,
          this.isStationMission
            ? en
              ? 'Hint: equip the Hasselblad Camera and an Antenna in Design [M] to bring back Earth photos (≥ 20 pts).'
              : 'Pista: equipa la Cámara Hasselblad y una Antena en Diseño [M] para traer fotos de la Tierra (≥ 20 pts).'
            : en
              ? 'Hint: equip the Hasselblad Camera and an S-Band Antenna to deliver ≥ 30 pts and unlock Final Mission MK11.'
              : 'Pista: equipa la Cámara Hasselblad y una Antena Banda S para entregar ≥ 30 pts y desbloquear la Misión Final MK11.'
        );
      } else {
        this.finishWithEnding(
          'sin_instrumentos',
          OperationOutcome.Success,
          this.isStationMission
            ? en
              ? `Transmitted ${f0(this.scienceDelivered)} of ${f0(this.minScience)} minimum pts of data and photos from the space station.`
              : `Se transmitieron ${f0(this.scienceDelivered)} de ${f0(this.minScience)} pts mínimos de información y fotos desde la estación espacial.`
            : en
              ? `Delivered ${f0(this.scienceDelivered)} of ${f0(this.minScience)} minimum science pts required to clear lunar landing.`
              : `Se entregaron ${f0(this.scienceDelivered)} de ${f0(this.minScience)} pts científicos mínimos requeridos para autorizar el alunizaje.`,
          this.isStationMission
            ? en
              ? 'Hint: use an uninterrupted Antenna (or S-Band Antenna) with your Hasselblad Camera to transmit ≥ 20 pts.'
              : 'Pista: utiliza una Antena sin cortes (o Antena Banda S) junto con tu Cámara Hasselblad para enviar ≥ 20 pts.'
            : en
              ? 'Hint: use the High-Gain S-Band Antenna or dual antennas to avoid outages and deliver ≥ 30 pts.'
              : 'Pista: utiliza la Antena banda S (Alta ganancia) o doble antena para evitar cortes y entregar ≥ 30 pts.'
        );
      }
      return;
    }

    // 4) Supervivencia con emergencia menor
    if (this.hadPowerEmergency || this.hadStormHit || this.outageStepsTotal > 0) {
      const motivos: string[] = [];
      if (this.hadPowerEmergency) motivos.push(en ? 'power deficit' : 'déficit eléctrico');
      if (this.hadStormHit) motivos.push(en ? 'solar hit on AGC' : 'impacto solar en la AGC');
      if (this.outageStepsTotal > 0) motivos.push(en ? 'link blackout' : 'corte de enlace');
      this.finishWithEnding(
        'regreso_emergencia',
        OperationOutcome.Success,
        en
          ? `Orbital test passed after resolving ${motivos.join(' and ')}.`
          : `Prueba orbital superada tras resolver ${motivos.join(' y ')}.`,
        en
          ? 'Test passed! You can optimize batteries, shielding, or a backup antenna in Design.'
          : '¡Prueba superada! Puedes optimizar baterías, blindaje o antena de respaldo en Diseño.'
      );
      return;
    }

    // 5) Prueba orbital limpia
    this.finishWithEnding(
      'exploracion_completa',
      OperationOutcome.Success,
      this.totalDays === 1
        ? en
          ? 'First MK-I flight completed successfully in Low Earth Orbit.'
          : 'Primer vuelo MK-I completado con éxito en Órbita Terrestre Baja.'
        : en
          ? 'Test flight completed with all systems nominal.'
          : 'Vuelo de prueba completado con todos los sistemas nominales.',
      en
        ? 'Design verified! New technologies and engineering aids unlocked.'
        : '¡Diseño verificado! Nuevas tecnologías y ayudas de ingeniería desbloqueadas.'
    );
  }

  private complete(): void {
    if (!this.isLandingMission) {
      this.completeOrbitalTest();
      return;
    }
    const en = this.lang === 'en';
    // 1) Aterrizaje fallido pero con recursos para regresar
    if (this.landingAborted) {
      this.finishWithEnding(
        'aterrizaje_fallido',
        OperationOutcome.FailedLanding,
        en
          ? 'Lacked an operational AGC Computer during final approach to the surface.'
          : 'Faltó Computadora AGC operativa durante la aproximación final a la superficie.',
        en
          ? 'Hint: add an AGC Computer (single or redundant) in Design to achieve the landing.'
          : 'Pista: agrega una Computadora AGC (simple o redundante) en Diseño para lograr el alunizaje.'
      );
      return;
    }

    // 2) Sin equipo suficiente (ni cámara ni EASEP, o falta energía + equipos)
    if ((!this.hasCamera && !this.hasEASEP) || (this.hadPowerEmergency && (!this.hasCamera || !this.hasEASEP))) {
      const missing: string[] = [];
      if (!this.hasCamera) missing.push(en ? 'Hasselblad Camera' : 'Cámara Hasselblad');
      if (!this.hasEASEP) missing.push(en ? 'EASEP Package' : 'Paquete EASEP');
      if (this.antennaCount === 0) missing.push(en ? 'Antenna' : 'Antena');
      if (this.hadPowerEmergency) missing.push(en ? 'Solar Panel/Battery' : 'Panel solar/Batería');
      this.finishWithEnding(
        'sin_equipo_suficiente',
        OperationOutcome.Success,
        en
          ? `Key supplies were missing (${missing.join(', ')}), so they only completed part of the tasks.`
          : `Faltaron suministros clave (${missing.join(', ')}), por lo que solo completaron parte de las tareas.`,
        en
          ? `Hint: equip ${missing.join(', ')} in Design to achieve Full Exploration.`
          : `Pista: equipa ${missing.join(', ')} en Diseño para lograr la Exploración completa.`
      );
      return;
    }

    // 3) Sin cámara (tienen instrumentos y realizan tareas, pero sin fotos)
    if (!this.hasCamera) {
      this.finishWithEnding(
        'sin_camara',
        OperationOutcome.Success,
        en
          ? 'Hasselblad Camera and lunar TV were not loaded before launch.'
          : 'No se cargó la Cámara Hasselblad y TV lunar antes del lanzamiento.',
        en
          ? 'Hint: add the Hasselblad Camera in Design to return with lunar photographs.'
          : 'Pista: agrega la Cámara Hasselblad en Diseño para regresar con fotografías lunares.'
      );
      return;
    }

    // 4) Sin instrumentos útiles (tienen cámara, pero falta EASEP o Antena para mediciones)
    if (!this.hasEASEP || this.antennaCount === 0) {
      const falta =
        !this.hasEASEP && this.antennaCount === 0
          ? en
            ? 'EASEP Package and Antenna'
            : 'Paquete EASEP y Antena'
          : !this.hasEASEP
            ? en
              ? 'EASEP Package & Samples'
              : 'Paquete EASEP y Muestras'
            : en
              ? 'Antenna to transmit data'
              : 'Antena para transmitir datos';
      this.finishWithEnding(
        'sin_instrumentos',
        OperationOutcome.Success,
        en
          ? `Missing ${falta} to obtain useful scientific measurements.`
          : `Faltó ${falta} para obtener mediciones científicas útiles.`,
        en
          ? `Hint: install ${falta} in Design alongside your Hasselblad Camera.`
          : `Pista: instala ${falta} en Diseño junto a tu Cámara Hasselblad.`
      );
      return;
    }

    // 5) Regreso con emergencia (avería eléctrica, impacto de tormenta o corte de enlace superado)
    if (this.hadPowerEmergency || this.hadStormHit || this.outageStepsTotal > 0) {
      const motivos: string[] = [];
      if (this.hadPowerEmergency) motivos.push(en ? 'power or battery deficit' : 'déficit eléctrico o de batería');
      if (this.hadStormHit) motivos.push(en ? 'solar storm hit on the AGC' : 'impacto de tormenta solar en la AGC');
      if (this.outageStepsTotal > 0) motivos.push(en ? 'single-antenna link blackout' : 'corte de enlace por antena única');
      this.finishWithEnding(
        'regreso_emergencia',
        OperationOutcome.Success,
        en
          ? `The crew overcame ${motivos.join(' and ')} and made it back alive.`
          : `La tripulación superó ${motivos.join(' y ')} y logró volver con vida.`,
        en
          ? 'Hint: add more Batteries/Panels, Heat Shield, or a second Antenna for a smooth flight.'
          : 'Pista: añade más Baterías/Paneles, Escudo térmico o una segunda Antena para un viaje sin sobresaltos.'
      );
      return;
    }

    // 6) Exploración completa
    this.finishWithEnding(
      'exploracion_completa',
      OperationOutcome.Success,
      en
        ? 'The crew completed the entire MK-11 flight plan with camera, instruments, and supplies.'
        : 'La tripulación cumplió toda la hoja de ruta MK-11 con cámara, instrumentos y suministros.',
      en
        ? 'Flawless design! All systems operated within nominal parameters.'
        : '¡Diseño impecable! Todos los sistemas operaron dentro de los parámetros nominales.'
    );
  }

  private finishWithEnding(
    key: MissionEndingKey,
    outcome: OperationOutcome,
    cause: string,
    hint: string
  ): void {
    const en = this.lang === 'en';
    const meta = buildEndingMeta(key, hint, this.lang);
    if (!this.isLandingMission && !meta.isFailure && (key === 'exploracion_completa' || key === 'regreso_emergencia')) {
      if (this.totalDays === 1) {
        meta.resultado = en ? 'First MK-I Flight Passed' : 'Primer vuelo MK-I superado';
        meta.queOcurre = en
          ? 'The MK-I capsule completed its first Low Earth Orbit test and returned intact to the Pacific.'
          : 'La cápsula MK-I completó su primera prueba en órbita terrestre baja y regresó intacta al Pacífico.';
        meta.titular = en
          ? 'First MK-I Flight Succeeds! Agency unlocks Mass and ΔV sensors.'
          : '¡Primer vuelo MK-I exitoso! La agencia desbloquea sensores de Masa y ΔV.';
      } else if (this.isStationMission) {
        meta.resultado = en
          ? 'Space Station MK-II Mission Passed'
          : 'Misión en Estación Espacial MK-II superada';
        meta.queOcurre = en
          ? 'The full spacecraft docked at the space station, gathered data, and photographed Earth before returning.'
          : 'La nave completa se acopló a la estación espacial, recolectó información y fotografió la Tierra antes de regresar.';
        meta.titular = en
          ? 'Space Station MK-II Success! Earth photos and data safely home.'
          : '¡Éxito en la Estación Espacial MK-II! Fotos de la Tierra y datos a salvo.';
      } else {
        meta.resultado = en
          ? 'MK-III Lunar Reconnaissance Complete'
          : 'Reconocimiento lunar MK-III completo';
        meta.queOcurre = en
          ? 'The spacecraft mapped Mare Tranquillitatis from lunar orbit and returned safely.'
          : 'La nave cartografió el Mar de la Tranquilidad desde órbita lunar y regresó a salvo.';
        meta.titular = en
          ? 'MK-III Maps the Moon! Everything ready for MK11 landing.'
          : '¡MK-III cartografía la Luna! Todo listo para el alunizaje MK11.';
      }
    }
    this.endingMeta = meta;
    this.outcome = outcome;
    this.failureCause = cause;
    this.advice = hint;
    this.add(
      this.day,
      `${meta.resultado.toUpperCase()}: ${meta.queOcurre}`,
      meta.isFailure ? LogKind.Bad : LogKind.Good
    );
    if (!meta.isFailure) {
      this.computeScore();
    } else {
      this.score = 0;
    }
  }

  private computeScore(): void {
    const en = this.lang === 'en';
    this.scoreLines.length = 0;
    let pts = 40;
    this.scoreLines.push(
      en ? 'Safe crew return: +40' : 'Retorno de la tripulación a salvo: +40'
    );

    const sci =
      20 * clamp01(this.scienceDelivered / Math.max(1, 1.5 * Math.max(1, this.minScience)));
    this.scoreLines.push(
      en
        ? `Scientific data (${f0(this.scienceDelivered)} pts): +${sci.toFixed(1)} of 20`
        : `Información científica (${f0(this.scienceDelivered)} pts): +${sci.toFixed(1)} de 20`
    );
    pts += sci;

    this.scoreLines.push(
      en
        ? 'Engineering margins (less surplus = higher efficiency):'
        : 'Márgenes de ingeniería (menos excedente = mayor eficiencia):'
    );

    const massM =
      this.res.launcherCapacityKg > 0
        ? (this.res.launcherCapacityKg - this.res.totalMassKg) /
          this.res.launcherCapacityKg
        : 1;
    const dvM =
      (this.res.deltaVAvailable - this.res.deltaVRequired) /
      Math.max(1, this.res.deltaVRequired);
    const costM =
      this.res.budget > 0
        ? (this.res.budget - this.res.totalCost) / this.res.budget
        : 1;
    const batM =
      this.res.batteryWh > 0
        ? (this.res.batteryWh - this.res.energyNeededInEclipseWh) /
          this.res.batteryWh
        : 1;

    pts += this.margin(en ? '  Launcher mass' : '  Masa del lanzador', massM);
    pts += this.margin(en ? '  Translunar ΔV' : '  ΔV translunar', dvM);
    pts += this.margin(en ? '  Budget' : '  Presupuesto', costM);
    pts += this.margin(en ? '  Battery' : '  Batería', batM);
    this.score = pts;
  }

  private margin(name: string, m: number): number {
    const en = this.lang === 'en';
    const p = 10 * (1 - clamp01(m));
    this.scoreLines.push(
      en
        ? `${name}: margin ${f0(Math.max(0, m) * 100)}% → +${p.toFixed(1)} of 10`
        : `${name}: margen ${f0(Math.max(0, m) * 100)}% → +${p.toFixed(1)} de 10`
    );
    return p;
  }

  get rating(): string {
    const en = this.lang === 'en';
    if (this.endingMeta?.key === 'exploracion_completa' && this.score >= 85) {
      return en ? 'Historic Engineering (NASA Grade)' : 'Ingeniería histórica (Nivel NASA)';
    }
    if (this.score >= 70) return en ? 'Outstanding Design' : 'Diseño sobresaliente';
    if (this.score >= 55) return en ? 'Passed, room to optimize' : 'Aprobado, con margen mejorable';
    return en ? 'Mission completed with gaps' : 'Misión completada con carencias';
  }

  private severeFraction(): number {
    const thrSev = STORM_THRESHOLD / (1 - this.shieldingFactor);
    return clamp01((1 - thrSev) / 0.7);
  }

  get expectedSevereStorms(): number {
    return this.totalSteps * this.stormProbPerStep * this.severeFraction();
  }

  expectedSolarHealthAtEnd(): number {
    return Math.pow(1 - this.solarLossPerStep, this.totalSteps);
  }

  computerLossRisk(): number {
    if (this.computerLivesTotal <= 0) return 1;
    const lambda = this.expectedSevereStorms;
    let term = Math.exp(-lambda);
    let cum = 0;
    for (let k = 0; k < this.computerLivesTotal; k++) {
      cum += term;
      term *= lambda / (k + 1);
    }
    return clamp01(1 - cum);
  }

  private add(day: number, text: string, kind: LogKind): void {
    this.log.push({ day, text, kind });
  }
}

export function buildEndingMeta(
  key: MissionEndingKey,
  hint: string,
  lang: Language = 'es'
): MissionEndingMeta {
  const en = lang === 'en';
  switch (key) {
    case 'exploracion_completa':
      return {
        key,
        resultado: en ? 'Full Exploration' : 'Exploración completa',
        queOcurre: en
          ? 'They arrive with camera, instruments, and supplies. They photograph and gather data on the Moon.'
          : 'Llegan con cámara, instrumentos y suministros. Fotografían y reúnen datos sobre la Luna.',
        titular: en
          ? 'MK-11 Makes History! Expedition brings back photos and data from the Moon.'
          : '¡MK-11 hace historia! La expedición trae fotos y datos de la Luna.',
        isFailure: false,
        survived: true,
        hasPhotos: true,
        landed: true,
        hint,
      };
    case 'sin_camara':
      return {
        key,
        resultado: en ? 'No Camera' : 'Sin cámara',
        queOcurre: en
          ? 'The expedition arrives and performs other tasks, but cannot take photos.'
          : 'La expedición llega y realiza otras tareas, pero no puede tomar fotos.',
        titular: en
          ? 'Oops! They reached the Moon without a camera: just a boring report.'
          : '¡Ups! Llegaron a la Luna sin cámara: solo tenemos un informe aburrido.',
        isFailure: false,
        survived: true,
        hasPhotos: false,
        landed: true,
        hint,
      };
    case 'sin_instrumentos':
      return {
        key,
        resultado: en ? 'No Instruments' : 'Sin instrumentos',
        queOcurre: en
          ? 'They return with photos, but fail to capture useful scientific measurements.'
          : 'Regresan con fotos, pero no consiguen mediciones científicas útiles.',
        titular: en
          ? 'The Moon looks gorgeous in the photos; the scientific data, not so much.'
          : 'La Luna sale hermosa en las fotos; los datos científicos, no tanto.',
        isFailure: false,
        survived: true,
        hasPhotos: true,
        landed: true,
        hint,
      };
    case 'sin_equipo_suficiente':
      return {
        key,
        resultado: en ? 'Insufficient Equipment' : 'Sin equipo suficiente',
        queOcurre: en
          ? 'They only complete a few tasks before running out of time or supplies.'
          : 'Solo completan algunas tareas antes de quedarse sin tiempo o suministros.',
        titular: en
          ? 'Express Moon visit: crew forgot half the checklist.'
          : 'Visita lunar exprés: el equipo olvidó la mitad de la lista.',
        isFailure: false,
        survived: true,
        hasPhotos: false,
        landed: true,
        hint,
      };
    case 'aterrizaje_fallido':
      return {
        key,
        resultado: en ? 'Landing Failed' : 'Aterrizaje fallido',
        queOcurre: en
          ? 'They cannot land safely and must abort exploration. If resources remain, they attempt to return.'
          : 'No pueden aterrizar con seguridad y deben abortar la exploración. Si tienen recursos, intentan regresar.',
        titular: en
          ? 'MK-11 reached the Moon… but could not find a place to park.'
          : 'MK-11 llegó a la Luna… pero no encontró dónde estacionarse.',
        isFailure: true,
        survived: true,
        hasPhotos: false,
        landed: false,
        hint,
      };
    case 'sin_combustible_salir_luna':
      return {
        key,
        resultado: en
          ? 'Out of Fuel to Leave the Moon'
          : 'Sin combustible para salir de la Luna',
        queOcurre: en
          ? 'The lander cannot lift off and the crew is stranded.'
          : 'El módulo no puede despegar y la tripulación queda varada.',
        titular: en
          ? 'The expedition reached the Moon, but could not lift off again.'
          : 'La expedición llegó a la Luna, pero no pudo volver a despegar.',
        isFailure: true,
        survived: false,
        hasPhotos: false,
        landed: true,
        hint,
      };
    case 'sin_combustible_regreso':
      return {
        key,
        resultado: en
          ? 'Out of Fuel During Return'
          : 'Sin combustible durante el regreso',
        queOcurre: en
          ? 'The spacecraft drifts off course and the crew fails to return.'
          : 'La nave queda a la deriva y la tripulación no logra regresar.',
        titular: en
          ? 'MK-11 loses contact during return; the crew never made it back.'
          : 'MK-11 pierde contacto durante el regreso; la tripulación no volvió.',
        isFailure: true,
        survived: false,
        hasPhotos: false,
        landed: true,
        hint,
      };
    case 'fallo_grave_despegue_luna':
      return {
        key,
        resultado: en ? 'Mission Failed' : 'Misión fallida',
        queOcurre: en
          ? 'Mission failed: the lander could not complete the lunar liftoff.'
          : 'Misión fallida: el módulo no logró completar el despegue lunar.',
        titular: en
          ? 'Mission Failed: a liftoff failure prevents continuing the expedition.'
          : 'Misión fallida: un fallo durante el despegue impide continuar la expedición.',
        isFailure: true,
        survived: false,
        hasPhotos: false,
        landed: true,
        hint,
      };
    case 'averia_mortal_viaje':
      return {
        key,
        resultado: en ? 'Mission Failed' : 'Misión fallida',
        queOcurre: en
          ? 'Mission failed: the spacecraft suffered a critical electrical failure on the return trip.'
          : 'Misión fallida: la nave sufrió una avería eléctrica crítica durante el regreso.',
        titular: en
          ? 'Mission Failed: the MK-11 expedition could not complete the return.'
          : 'Misión fallida: la expedición MK-11 no logró completar el retorno.',
        isFailure: true,
        survived: false,
        hasPhotos: false,
        landed: true,
        hint,
      };
    case 'regreso_emergencia':
      return {
        key,
        resultado: en ? 'Emergency Return' : 'Regreso con emergencia',
        queOcurre: en
          ? 'The spacecraft suffers a fault, but the crew resolves the event and makes it home alive.'
          : 'La nave tiene una avería, pero el equipo resuelve el evento y vuelve con vida.',
        titular: en
          ? 'Tense return: crew overcomes a critical fault and makes it home.'
          : 'Regreso con tensión: la tripulación supera una avería y vuelve a casa.',
        isFailure: false,
        survived: true,
        hasPhotos: true,
        landed: true,
        hint,
      };
  }
}
