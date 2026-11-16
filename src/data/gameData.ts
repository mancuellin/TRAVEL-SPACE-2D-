import {
  DesignHelperKey,
  LauncherData,
  LunarDestination,
  MissionBriefing,
  PartData,
  PartType,
  ProgressionLevel,
  ThemePalette,
  UiThemeKey,
} from '../types/game';

export const AVAILABLE_PARTS: PartData[] = [
  {
    id: 'estructura',
    partName: 'Estructura CSM / Eagle',
    type: PartType.Structure,
    massKg: 100,
    costMillions: 3,
    powerWatts: 0,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'panel-solar',
    partName: 'Panel solar auxiliar',
    type: PartType.SolarPanel,
    massKg: 15,
    costMillions: 1.5,
    powerWatts: 200,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'rtg',
    partName: 'Generador RTG (SNAP-27)',
    type: PartType.RTG,
    massKg: 40,
    costMillions: 12,
    powerWatts: 120,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'bateria',
    partName: 'Batería lunar',
    type: PartType.Battery,
    massKg: 10,
    costMillions: 1,
    powerWatts: 0,
    batteryWh: 150,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'antena-omni',
    partName: 'Antena omnidireccional',
    type: PartType.Antenna,
    massKg: 2,
    costMillions: 0.5,
    powerWatts: -10,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'antena-parabolica',
    partName: 'Antena banda S (Alta ganancia)',
    type: PartType.Antenna,
    massKg: 12,
    costMillions: 3,
    powerWatts: -60,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 1.0,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'computadora-simple',
    partName: 'Computadora AGC simple',
    type: PartType.Computer,
    massKg: 5,
    costMillions: 1,
    powerWatts: -30,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'computadora-redundante',
    partName: 'Computadora AGC redundante',
    type: PartType.Computer,
    massKg: 9,
    costMillions: 3,
    powerWatts: -45,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 2,
    shielding: 0,
  },
  {
    id: 'camara-hd',
    partName: 'Cámara Hasselblad y TV lunar',
    type: PartType.Instrument,
    massKg: 25,
    costMillions: 6,
    powerWatts: -80,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 50,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'radar',
    partName: 'Paquete EASEP y Muestras',
    type: PartType.Instrument,
    massKg: 40,
    costMillions: 9,
    powerWatts: -150,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 70,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'tanque',
    partName: 'Tanque de propelente (TLI/DPS)',
    type: PartType.Fuel,
    massKg: 20,
    costMillions: 1,
    powerWatts: 0,
    batteryWh: 0,
    fuelKg: 100,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0,
  },
  {
    id: 'blindaje',
    partName: 'Escudo térmico y blindaje',
    type: PartType.Shielding,
    massKg: 15,
    costMillions: 1.5,
    powerWatts: 0,
    batteryWh: 0,
    fuelKg: 0,
    sciencePoints: 0,
    dataRate: 0.5,
    computerLives: 1,
    shielding: 0.3,
  },
];

export const LAUNCHERS: LauncherData[] = [
  {
    id: 'ligero',
    launcherName: 'Saturno IB (Prueba Orbital)',
    capacityKg: 500,
    costMillions: 15,
  },
  {
    id: 'medio',
    launcherName: 'Saturno V (MK11 Estándar)',
    capacityKg: 1200,
    costMillions: 35,
  },
  {
    id: 'pesado',
    launcherName: 'Saturno V (Bloque II Carga Máxima)',
    capacityKg: 2000,
    costMillions: 52,
  },
];

export const REAL_LUNAR_PHYSICS = {
  earthGravityMs2: 9.81,
  moonGravityMs2: 1.62,
  leoVelocityKms: 7.8,
  tliVelocityKms: 10.9,
  lunarOrbitVelocityKms: 1.68,
  lunarEscapeVelocityKms: 2.38,
  distanceKm: 384400,
} as const;

export const LUNAR_DESTINATIONS: LunarDestination[] = [
  {
    id: 'mk11-ruta-completa',
    name: 'MK11 · Ruta Lunar Completa (Trayectoria en 8)',
    profile: 'apollo11',
    distanceKm: 384400,
    altitudeKm: 0,
    deltaVRequired: 3588,
    periodMinutes: 180,
    eclipseMinutes: 60,
    radiationLevel: 0.9,
    description:
      'Trayectoria real en 8 (retorno libre): inyección translunar a 10.9 km/s (ΔV 3,588 m/s desde órbita baja), órbita lunar a 1.68 km/s, alunizaje con gravedad lunar de 1.62 m/s² (escape 2.38 km/s) y regreso al Pacífico.',
  },
];

export const MISSION_BRIEFINGS: MissionBriefing[] = [
  {
    id: 'mk11-completa',
    title: 'Misión MK11: Ruta Lunar Completa',
    description:
      'Nueva expedición MK11 de 5 días: viaja a la Luna, aluniza para reunir información, fotos y evaluar si es habitable, repara fallas en cabina, acóplate con el módulo de retorno y regresa a salvo.',
    budgetMillions: 85,
    minSciencePoints: 70,
    missionDays: 5,
  },
];

const LEVEL1_HELPERS: DesignHelperKey[] = ['assembly'];
const LEVEL2_HELPERS: DesignHelperKey[] = ['assembly', 'mass', 'deltaV'];
const LEVEL3_HELPERS: DesignHelperKey[] = ['assembly', 'mass', 'deltaV', 'budget', 'power'];
const LEVEL4_HELPERS: DesignHelperKey[] = [
  'assembly',
  'mass',
  'deltaV',
  'budget',
  'power',
  'science',
  'diagnostics',
];

export const PROGRESSION_LEVELS: ProgressionLevel[] = [
  {
    level: 1,
    code: 'MK-I',
    shortTitle: 'Primer Despegue',
    title: 'Nivel 1 · MK-I: Primer Despegue (LEO)',
    subtitle: 'Prueba y Error · Solo Ensamblaje Estructural',
    objectiveSummary:
      'Ensambla las 4 secciones del cohete con módulos básicos y realiza tu primer despegue hacia órbita baja (1,500 m/s). Sin sensores de masa ni ΔV todavía.',
    launcherId: 'ligero',
    destination: {
      id: 'leo-prueba',
      name: 'Órbita Terrestre Baja (Prueba LEO)',
      profile: 'orbit',
      distanceKm: 400,
      altitudeKm: 400,
      deltaVRequired: 1500,
      periodMinutes: 90,
      eclipseMinutes: 30,
      radiationLevel: 0.25,
      description:
        'Vuelo inaugural de calibración a 400 km de altura (ΔV 1,500 m/s). Los datos de este primer despegue calibrarán los sensores de ingeniería.',
    },
    briefing: {
      id: 'mk1-prueba',
      title: 'Misión MK-I: Primer Despegue',
      description:
        'Primer ensayo en plataforma con Saturno IB (500 kg). En el menú de diseño solo dispones de la guía de ensamblaje estructural.',
      budgetMillions: 35,
      minSciencePoints: 0,
      missionDays: 1,
    },
    unlockedPartIds: [
      'estructura',
      'tanque',
      'panel-solar',
      'antena-omni',
      'computadora-simple',
    ],
    unlockedHelpers: LEVEL1_HELPERS,
    unlocksOnCompleteText: [
      'Sensores de Masa de Carga e Impulso ΔV en Diseño',
      'Módulos: Batería lunar, Antena banda S, AGC redundante y Cámara Hasselblad',
      'Acceso a Misión MK-II (Estación Espacial y Acoplamiento)',
    ],
    unlockOnFirstLiftoff: true,
  },
  {
    level: 2,
    code: 'MK-II',
    shortTitle: 'Estación Espacial',
    title: 'Nivel 2 · MK-II: Estación Espacial',
    subtitle: 'Encuentro Orbital, Acoplamiento, Ciencia y Fotos de la Tierra',
    objectiveSummary:
      'Viaja a la estación espacial en órbita (2,200 m/s, máx. 500 kg), acopla la nave completa, recolecta información y toma fotos de la Tierra con la Cámara Hasselblad (≥ 20 pts).',
    launcherId: 'ligero',
    destination: {
      id: 'estacion-espacial',
      name: 'Estación Espacial Orbital MK11',
      profile: 'station',
      distanceKm: 1200,
      altitudeKm: 420,
      deltaVRequired: 2200,
      periodMinutes: 100,
      eclipseMinutes: 35,
      radiationLevel: 0.45,
      description:
        'Encuentro y acoplamiento con la estación espacial en órbita terrestre (420 km · ΔV 2,200 m/s, 35 min de sombra). Recolecta datos científicos y fotografía la Tierra antes de regresar.',
    },
    briefing: {
      id: 'mk2-estacion',
      title: 'Misión MK-II: Estación Espacial',
      description:
        'Expedición de 2 días a la estación espacial: realiza la maniobra de acoplamiento con la nave completa, recopila información científica y toma fotografías de la Tierra.',
      budgetMillions: 55,
      minSciencePoints: 20,
      missionDays: 2,
    },
    unlockedPartIds: [
      'estructura',
      'tanque',
      'panel-solar',
      'bateria',
      'antena-omni',
      'antena-parabolica',
      'computadora-simple',
      'computadora-redundante',
      'camara-hd',
    ],
    unlockedHelpers: LEVEL2_HELPERS,
    unlocksOnCompleteText: [
      'Cohete Pesado Saturno V (1,200 kg)',
      'Consolas de Presupuesto y Energía / Eclipse en Diseño',
      'Módulo: Escudo térmico y blindaje',
      'Acceso a Misión MK-III (Órbita Lunar)',
    ],
  },
  {
    level: 3,
    code: 'MK-III',
    shortTitle: 'Órbita Lunar',
    title: 'Nivel 3 · MK-III: Reconocimiento Lunar',
    subtitle: 'Sobrevuelo y Fotografía Orbital sin Alunizaje',
    objectiveSummary:
      'Viaja a la órbita de la Luna (3,200 m/s), resiste tormentas solares y transmite ≥ 30 pts científicos con la Cámara Hasselblad.',
    launcherId: 'medio',
    destination: {
      id: 'orbita-lunar',
      name: 'Órbita Lunar de Reconocimiento (Sin Alunizaje)',
      profile: 'orbit',
      distanceKm: 384400,
      altitudeKm: 110,
      deltaVRequired: 3200,
      periodMinutes: 120,
      eclipseMinutes: 45,
      radiationLevel: 0.8,
      description:
        'Inserción en órbita lunar a 110 km (ΔV 3,200 m/s, radiación 0.8). Mapea posibles zonas de alunizaje antes de enviar el módulo Eagle.',
    },
    briefing: {
      id: 'mk3-reconocimiento',
      title: 'Misión MK-III: Reconocimiento Lunar',
      description:
        'Expedición orbital de 3 días alrededor de la Luna. Debes fotografiar la superficie y transmitir al menos 30 pts de ciencia a Houston.',
      budgetMillions: 75,
      minSciencePoints: 30,
      missionDays: 3,
    },
    unlockedPartIds: [
      'estructura',
      'tanque',
      'panel-solar',
      'bateria',
      'antena-omni',
      'antena-parabolica',
      'computadora-simple',
      'computadora-redundante',
      'blindaje',
      'camara-hd',
    ],
    unlockedHelpers: LEVEL3_HELPERS,
    unlocksOnCompleteText: [
      '¡TODO DESBLOQUEADO! Lista completa de 12 módulos (RTG SNAP-27 y Paquete EASEP)',
      'Sistemas Críticos y Diagnóstico de Vuelo completo en Diseño',
      'Misión Final MK11: ¡Alunizaje en la Luna y Regreso!',
    ],
  },
  {
    level: 4,
    code: 'MK11',
    shortTitle: 'Alunizaje Lunar',
    title: 'Nivel 4 · MK11: Expedición Lunar Completa',
    subtitle: 'Todo Desbloqueado · Alunizaje, Emergencias y Regreso',
    objectiveSummary:
      'Ruta lunar completa de 5 días: inyección TLI (3,588 m/s), alunizaje del Eagle, investigación científica, reparaciones en cabina, acople orbital y amerizaje.',
    launcherId: 'medio',
    destination: LUNAR_DESTINATIONS[0],
    briefing: MISSION_BRIEFINGS[0],
    unlockedPartIds: AVAILABLE_PARTS.map((p) => p.id),
    unlockedHelpers: LEVEL4_HELPERS,
    unlocksOnCompleteText: [
      'Programa Espacial MK11 completado al 100%',
    ],
  },
];

export const PART_UNLOCK_LEVEL_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const lvl of PROGRESSION_LEVELS) {
    for (const pid of lvl.unlockedPartIds) {
      if (map[pid] === undefined) map[pid] = lvl.level;
    }
  }
  return map;
})();


export const THEMES: Record<UiThemeKey, ThemePalette> = {
  Azul: {
    key: 'Azul',
    accent: '#f59e0b',
    highlight: '#38bdf8',
    background: '#060a14',
    panel: 'rgba(11, 17, 32, 0.86)',
    text: '#f1f5f9',
  },
  Naranja: {
    key: 'Naranja',
    accent: '#fbbf24',
    highlight: '#fb923c',
    background: '#0d0907',
    panel: 'rgba(24, 16, 13, 0.88)',
    text: '#fafaf9',
  },
  Verde: {
    key: 'Verde',
    accent: '#a3e635',
    highlight: '#34d399',
    background: '#050e0b',
    panel: 'rgba(10, 23, 19, 0.88)',
    text: '#f0fdf4',
  },
  Violeta: {
    key: 'Violeta',
    accent: '#f472b6',
    highlight: '#a78bfa',
    background: '#090714',
    panel: 'rgba(18, 13, 34, 0.88)',
    text: '#f5f3ff',
  },
};

import type { Language } from '../i18n/LanguageContext';

const PART_NAMES_EN: Record<string, string> = {
  estructura: 'CSM / Eagle Structure',
  'panel-solar': 'Auxiliary Solar Panel',
  rtg: 'RTG Generator (SNAP-27)',
  bateria: 'Lunar Battery',
  'antena-omni': 'Omnidirectional Antenna',
  'antena-parabolica': 'S-Band Antenna (High Gain)',
  'computadora-simple': 'Single AGC Computer',
  'computadora-redundante': 'Redundant AGC Computer',
  'camara-hd': 'Hasselblad Camera & Lunar TV',
  radar: 'EASEP Package & Samples',
  tanque: 'Propellant Tank (TLI/DPS)',
  blindaje: 'Heat Shield & Radiation Armor',
};

const LAUNCHER_NAMES_EN: Record<string, string> = {
  ligero: 'Saturn IB (Orbital Test)',
  medio: 'Saturn V (MK11 Standard)',
  pesado: 'Saturn V (Block II Max Payload)',
};

const DEST_EN: Record<string, { name: string; description: string }> = {
  'leo-prueba': {
    name: 'Low Earth Orbit (LEO Test)',
    description:
      'Inaugural calibration flight at 400 km altitude (ΔV 1,500 m/s). Data from this first liftoff will calibrate engineering sensors.',
  },
  'estacion-espacial': {
    name: 'MK11 Orbital Space Station',
    description:
      'Rendezvous and docking with the space station in Earth orbit (420 km · ΔV 2,200 m/s, 35 min eclipse). Gather scientific data and photograph Earth before returning.',
  },
  'orbita-lunar': {
    name: 'Lunar Reconnaissance Orbit (No Landing)',
    description:
      'Lunar orbit insertion at 110 km (ΔV 3,200 m/s, radiation 0.8). Map candidate landing zones before sending the Eagle lander.',
  },
  'mk11-ruta-completa': {
    name: 'MK11 · Full Lunar Route (Figure-8 Trajectory)',
    description:
      'Real figure-8 free-return trajectory: translunar injection at 10.9 km/s (ΔV 3,588 m/s from LEO), lunar orbit at 1.68 km/s, lunar landing at 1.62 m/s² gravity (2.38 km/s escape), and Pacific splashdown.',
  },
};

const BRIEFING_EN: Record<string, { title: string; description: string }> = {
  'mk1-prueba': {
    title: 'Mission MK-I: First Liftoff',
    description:
      'First pad test on Saturn IB (500 kg). Only structural assembly guidance is available in the Design menu.',
  },
  'mk2-estacion': {
    title: 'Mission MK-II: Space Station',
    description:
      '2-day expedition to the space station: perform full-spacecraft docking, collect scientific data, and photograph Earth.',
  },
  'mk3-reconocimiento': {
    title: 'Mission MK-III: Lunar Reconnaissance',
    description:
      '3-day orbital expedition around the Moon. Photograph the lunar surface and transmit at least 30 science pts to Houston.',
  },
  'mk11-completa': {
    title: 'Mission MK11: Full Lunar Route',
    description:
      'New 5-day MK11 expedition: travel to the Moon, land to gather data, photos, and evaluate habitability, repair cabin failures, dock with the return module, and splash down safely.',
  },
};

const LEVEL_EN: Record<
  number,
  {
    shortTitle: string;
    title: string;
    subtitle: string;
    objectiveSummary: string;
    unlocksOnCompleteText: string[];
  }
> = {
  1: {
    shortTitle: 'First Liftoff',
    title: 'Level 1 · MK-I: First Liftoff (LEO)',
    subtitle: 'Trial & Error · Structural Assembly Only',
    objectiveSummary:
      'Assemble all 4 rocket sections with basic modules and perform your first liftoff into low Earth orbit (1,500 m/s). No mass or ΔV sensors yet.',
    unlocksOnCompleteText: [
      'Payload Mass & ΔV Thrust sensors in Design',
      'Modules: Lunar Battery, S-Band Antenna, Redundant AGC, and Hasselblad Camera',
      'Access to Mission MK-II (Space Station & Docking)',
    ],
  },
  2: {
    shortTitle: 'Space Station',
    title: 'Level 2 · MK-II: Space Station',
    subtitle: 'Orbital Rendezvous, Docking, Science & Earth Photos',
    objectiveSummary:
      'Travel to the orbiting space station (2,200 m/s, max 500 kg), dock the full spacecraft, gather data, and take Earth photos with the Hasselblad Camera (≥ 20 pts).',
    unlocksOnCompleteText: [
      'Heavy-Lift Saturn V Rocket (1,200 kg)',
      'Budget & Power / Eclipse consoles in Design',
      'Module: Heat Shield & Radiation Armor',
      'Access to Mission MK-III (Lunar Orbit)',
    ],
  },
  3: {
    shortTitle: 'Lunar Orbit',
    title: 'Level 3 · MK-III: Lunar Reconnaissance',
    subtitle: 'Orbital Flyby & Photography Without Landing',
    objectiveSummary:
      'Travel to lunar orbit (3,200 m/s), withstand solar storms, and transmit ≥ 30 science pts with the Hasselblad Camera.',
    unlocksOnCompleteText: [
      'ALL UNLOCKED! Full 12-module catalog (RTG SNAP-27 & EASEP Package)',
      'Critical Systems & Full Flight Diagnostics in Design',
      'Final Mission MK11: Lunar Landing & Return!',
    ],
  },
  4: {
    shortTitle: 'Lunar Landing',
    title: 'Level 4 · MK11: Full Lunar Expedition',
    subtitle: 'All Unlocked · Lunar Landing, Emergencies & Return',
    objectiveSummary:
      'Full 5-day lunar route: TLI burn (3,588 m/s), Eagle touchdown, scientific research, cabin repairs, orbital docking, and splashdown.',
    unlocksOnCompleteText: ['MK11 Space Program 100% Completed'],
  },
};

export function getLocalizedPartName(p: PartData, lang: Language = 'es'): string {
  if (lang === 'en') return PART_NAMES_EN[p.id] ?? p.partName;
  return p.partName;
}

export function getLocalizedLauncherName(
  l: LauncherData | null,
  lang: Language = 'es'
): string {
  if (!l) return '-';
  if (lang === 'en') return LAUNCHER_NAMES_EN[l.id] ?? l.launcherName;
  return l.launcherName;
}

export function getLocalizedDestination(
  d: LunarDestination,
  lang: Language = 'es'
): LunarDestination {
  if (lang === 'es') return d;
  const tr = DEST_EN[d.id];
  return tr ? { ...d, name: tr.name, description: tr.description } : d;
}

export function getLocalizedBriefing(
  b: MissionBriefing,
  lang: Language = 'es'
): MissionBriefing {
  if (lang === 'es') return b;
  const tr = BRIEFING_EN[b.id];
  return tr ? { ...b, title: tr.title, description: tr.description } : b;
}

export function getLocalizedLevel(
  lvl: ProgressionLevel,
  lang: Language = 'es'
): ProgressionLevel {
  if (lang === 'es') return lvl;
  const tr = LEVEL_EN[lvl.level];
  return {
    ...lvl,
    shortTitle: tr?.shortTitle ?? lvl.shortTitle,
    title: tr?.title ?? lvl.title,
    subtitle: tr?.subtitle ?? lvl.subtitle,
    objectiveSummary: tr?.objectiveSummary ?? lvl.objectiveSummary,
    unlocksOnCompleteText: tr?.unlocksOnCompleteText ?? lvl.unlocksOnCompleteText,
    destination: getLocalizedDestination(lvl.destination, lang),
    briefing: getLocalizedBriefing(lvl.briefing, lang),
  };
}

export function getLocalizedLevels(lang: Language = 'es'): ProgressionLevel[] {
  return PROGRESSION_LEVELS.map((lvl) => getLocalizedLevel(lvl, lang));
}

export function getPartDescription(p: PartData, lang: Language = 'es'): string {
  if (lang === 'en') {
    switch (p.type) {
      case PartType.Structure:
        return 'Combined structure of the orbital return module and the MK11 descent lander. Supports the crew across the full 5-day route.';
      case PartType.SolarPanel:
        return 'Support solar arrays for the Earth–Moon transit. Generate power in direct sunlight and gradually degrade under radiation.';
      case PartType.RTG:
        return 'SNAP-27 nuclear generator: delivers continuous power for scientific experiments even during lunar shadow. Heavy and expensive, but sun-independent.';
      case PartType.Battery:
        return 'Stores electrical energy to keep life support and guidance systems active through lunar eclipse passages.';
      case PartType.Antenna: {
        const rate = p.dataRate > 0 ? p.dataRate : 0.5;
        return (
          `Transmits telemetry, voice, and imagery from the Moon to Mission Control (384,400 km). Delivers ${(rate * 100).toFixed(0)}% of data` +
          (rate < 1
            ? ': low power draw, but reduced science throughput.'
            : ': full S-Band coverage, higher power consumption.') +
          ' With two antennas, a backup link prevents communication blackouts.'
        );
      }
      case PartType.Computer:
        return (
          `MK11 Guidance Computer (AGC): essential for lunar landing and return docking. Survives ${Math.max(1, p.computerLives)} ` +
          'severe radiation storm(s) before failing.'
        );
      case PartType.Instrument:
        return 'MK11 science equipment: captures lunar photography, collects samples, and evaluates surface habitability. Needs power and an antenna to transmit results.';
      case PartType.Fuel:
        return 'Hypergolic propellant for translunar injection, lunar descent, lunar ascent, and return burns toward the Pacific Ocean.';
      case PartType.Shielding:
        return `Heat shield and deep-space solar radiation armor: reduces storm impact on the AGC computer by ${(p.shielding * 100).toFixed(0)}% (max 80%).`;
      default:
        return '';
    }
  }

  switch (p.type) {
    case PartType.Structure:
      return 'Estructura conjunta del módulo de retorno orbital y el módulo de descenso MK11. Soporta a la tripulación durante los 5 días de ruta completa.';
    case PartType.SolarPanel:
      return 'Paneles de apoyo eléctrico para la travesía Tierra–Luna. Generan energía cuando la nave recibe luz solar directa y se degradan con la radiación.';
    case PartType.RTG:
      return 'Generador nuclear SNAP-27: suministra energía continua para los experimentos científicos incluso durante la sombra lunar. Es costoso y pesado, pero no depende del Sol.';
    case PartType.Battery:
      return 'Almacena energía para mantener activos los sistemas de soporte vital y guía durante los pasos por la sombra lunar.';
    case PartType.Antenna: {
      const rate = p.dataRate > 0 ? p.dataRate : 0.5;
      return (
        `Transmite telemetría, voz e imágenes desde la Luna hasta Control de Misión (384,400 km). Entrega el ${(rate * 100).toFixed(0)}% de los datos` +
        (rate < 1
          ? ': bajo consumo, pero menor tasa científica.'
          : ': cobertura total de banda S, mayor consumo eléctrico.') +
        ' Con dos antenas, un enlace de respaldo evita cortes de comunicación.'
      );
    }
    case PartType.Computer:
      return (
        `Computadora de Guía MK11 (AGC): imprescindible para el alunizaje y el acoplamiento de regreso. Resiste ${Math.max(1, p.computerLives)} ` +
        'tormenta(s) de radiación severa(s) antes de fallar.'
      );
    case PartType.Instrument:
      return 'Equipamiento científico MK11: captura fotografías lunares, recolecta muestras y evalúa la habitabilidad de la superficie. Requiere energía y antena para enviar resultados.';
    case PartType.Fuel:
      return 'Propelente hipergólico para maniobras de inyección translunar, descenso, ascenso desde la Luna y retorno hacia el océano Pacífico.';
    case PartType.Shielding:
      return `Escudo térmico y protección contra radiación solar de espacio profundo: reduce un ${(p.shielding * 100).toFixed(0)}% el impacto de tormentas sobre la computadora AGC (máximo 80%).`;
    default:
      return '';
  }
}

export function getShortPartSummary(p: PartData, lang: Language = 'es'): string {
  if (lang === 'en') {
    switch (p.id) {
      case 'estructura':
        return 'Main rocket cabin and primary structural frame.';
      case 'tanque':
        return 'Propellant required for liftoff and maneuvers (+100 kg).';
      case 'panel-solar':
        return 'Generates +200 W in sunlight (degrades with radiation).';
      case 'rtg':
        return 'Continuous nuclear power (+120 W), even in shadow.';
      case 'bateria':
        return 'Stores +150 Wh to survive orbital eclipse passages.';
      case 'antena-omni':
        return 'Basic Earth link (50% data rate, -10 W).';
      case 'antena-parabolica':
        return 'High-gain Earth link (100% data rate, -60 W).';
      case 'computadora-simple':
        return 'Basic flight guidance (survives 1 solar storm).';
      case 'computadora-redundante':
        return 'Dual backup guidance (survives 2 solar storms).';
      case 'camara-hd':
        return 'Captures lunar & Earth photos (+50 science pts, -80 W).';
      case 'radar':
        return 'Surface experiments & lunar samples (+70 science pts, -150 W).';
      case 'blindaje':
        return 'Reduces solar radiation damage by 30% (max 80%).';
      default:
        return '';
    }
  }

  switch (p.id) {
    case 'estructura':
      return 'Cabina y estructura principal del cohete.';
    case 'tanque':
      return 'Combustible necesario para despegar y maniobrar (+100 kg).';
    case 'panel-solar':
      return 'Genera +200 W con luz solar (se degrada con radiación).';
    case 'rtg':
      return 'Energía nuclear continua (+120 W), incluso en sombra.';
    case 'bateria':
      return 'Almacena +150 Wh para sobrevivir pasos por sombra.';
    case 'antena-omni':
      return 'Enlace básico con la Tierra (50% datos, -10 W).';
    case 'antena-parabolica':
      return 'Enlace de alta ganancia (100% datos, -60 W).';
    case 'computadora-simple':
      return 'Guía de vuelo básica (resiste 1 tormenta solar).';
    case 'computadora-redundante':
      return 'Guía doble de respaldo (resiste 2 tormentas solares).';
    case 'camara-hd':
      return 'Captura fotos lunares (+50 pts ciencia, -80 W).';
    case 'radar':
      return 'Experimentos y muestras en superficie (+70 pts ciencia, -150 W).';
    case 'blindaje':
      return 'Reduce un 30% el daño por radiación solar (máx. 80%).';
    default:
      return '';
  }
}

export function getPartKeyStat(p: PartData, lang: Language = 'es'): string {
  const tokens: string[] = [];
  if (p.fuelKg > 0) tokens.push(`+${p.fuelKg.toFixed(0)} kg ${lang === 'en' ? 'fuel' : 'prop.'}`);
  if (p.powerWatts > 0) tokens.push(`+${p.powerWatts.toFixed(0)} W`);
  if (p.powerWatts < 0) tokens.push(`${p.powerWatts.toFixed(0)} W`);
  if (p.batteryWh > 0) tokens.push(`+${p.batteryWh.toFixed(0)} Wh`);
  if (p.sciencePoints > 0) tokens.push(`+${p.sciencePoints.toFixed(0)} ${lang === 'en' ? 'science' : 'ciencia'}`);
  if (p.shielding > 0) tokens.push(`-${(p.shielding * 100).toFixed(0)}% rad.`);
  if (p.type === PartType.Antenna) tokens.push(`${(p.dataRate * 100).toFixed(0)}% ${lang === 'en' ? 'data' : 'datos'}`);
  if (p.type === PartType.Computer) tokens.push(`${p.computerLives}${lang === 'en' ? 'x guid.' : 'v guía'}`);
  tokens.push(`${p.massKg.toFixed(0)} kg`);
  tokens.push(`$${p.costMillions.toFixed(1)}M`);
  return tokens.join(' · ');
}

