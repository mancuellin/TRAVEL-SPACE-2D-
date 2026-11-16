export enum PartType {
  Structure = 0,
  SolarPanel = 1,
  RTG = 2,
  Battery = 3,
  Antenna = 4,
  Computer = 5,
  Instrument = 6,
  Fuel = 7,
  Shielding = 8,
}

export interface PartData {
  id: string;
  partName: string;
  type: PartType;
  massKg: number;
  costMillions: number;
  powerWatts: number;
  batteryWh: number;
  fuelKg: number;
  sciencePoints: number;
  dataRate: number;
  computerLives: number;
  shielding: number;
}

export interface LauncherData {
  id: string;
  launcherName: string;
  capacityKg: number;
  costMillions: number;
}

export type LunarProfileType = 'orbit' | 'landing' | 'apollo11' | 'station';

export interface LunarDestination {
  id: string;
  name: string;
  profile: LunarProfileType;
  distanceKm: number;
  altitudeKm: number;
  deltaVRequired: number;
  periodMinutes: number;
  eclipseMinutes: number;
  radiationLevel: number;
  description: string;
}

export interface MissionBriefing {
  id: string;
  title: string;
  description: string;
  budgetMillions: number;
  minSciencePoints: number;
  missionDays: number;
}

export interface MissionResult {
  dryMassKg: number;
  fuelMassKg: number;
  totalMassKg: number;
  launcherCapacityKg: number;
  partsCost: number;
  totalCost: number;
  budget: number;
  solarWatts: number;
  rtgWatts: number;
  consumptionWatts: number;
  batteryWh: number;
  periodMinutes: number;
  eclipseMinutes: number;
  energyNeededInEclipseWh: number;
  deltaVAvailable: number;
  deltaVRequired: number;
  sciencePoints: number;
  minScience: number;
  errors: string[];
  missingHints: string[];
  isValid: boolean;
}

export enum LaunchOutcome {
  Idle = 'Idle',
  Running = 'Running',
  LaunchFailed = 'LaunchFailed',
  OrbitFailed = 'OrbitFailed',
  Success = 'Success',
}

export enum LogKind {
  Info = 'Info',
  Good = 'Good',
  Bad = 'Bad',
}

export interface OperationEvent {
  day: number;
  text: string;
  kind: LogKind;
}

export enum OperationOutcome {
  Running = 'Running',
  Success = 'Success',
  FailedPower = 'FailedPower',
  FailedComputer = 'FailedComputer',
  FailedScience = 'FailedScience',
  FailedLanding = 'FailedLanding',
  FailedFuelAscent = 'FailedFuelAscent',
  FailedFuelReturn = 'FailedFuelReturn',
  FailedTakeoffCrash = 'FailedTakeoffCrash',
  FailedBreakdown = 'FailedBreakdown',
}

export type MissionEndingKey =
  | 'exploracion_completa'
  | 'sin_camara'
  | 'sin_instrumentos'
  | 'sin_equipo_suficiente'
  | 'aterrizaje_fallido'
  | 'sin_combustible_salir_luna'
  | 'sin_combustible_regreso'
  | 'fallo_grave_despegue_luna'
  | 'averia_mortal_viaje'
  | 'regreso_emergencia';

export interface MissionEndingMeta {
  key: MissionEndingKey;
  resultado: string;
  queOcurre: string;
  titular: string;
  isFailure: boolean;
  survived: boolean;
  hasPhotos: boolean;
  landed: boolean;
  hint: string;
}

export type OperationStage =
  | 'transit'
  | 'station_docking'
  | 'station_ops'
  | 'landing_closeup'
  | 'problem_cables'
  | 'problem_birome'
  | 'problem_oxygen'
  | 'ascent_docking'
  | 'return';

export type UiThemeKey = 'Azul' | 'Naranja' | 'Verde' | 'Violeta';

export interface ThemePalette {
  key: UiThemeKey;
  accent: string;
  highlight: string;
  background: string;
  panel: string;
  text: string;
}

export interface LunarTelemetry {
  periodMinutes: number;
  eclipseMinutes: number;
  simTimeMinutes: number;
  distanceFromEarthKm: number;
  tripPhaseName: string;
  inEclipse: boolean;
  batteryWh: number;
  batteryCapacityWh: number;
  generationW: number;
  consumptionW: number;
  powerFailure: boolean;
  lightingPhaseName: string;
}

export interface RocketAssemblyState {
  hasCore: boolean;
  hasBoosters: boolean;
  hasFairing: boolean;
  hasAvionics: boolean;
}

export type LaunchAbortReason =
  | 'no_fuel'
  | 'incomplete'
  | 'overweight'
  | 'low_dv';

export interface LaunchTelemetry {
  outcome: LaunchOutcome;
  phase: string;
  resultMessage: string;
  altitudeKm: number;
  speedKms: number;
  deltaVBurned: number;
  deltaVRequired: number;
  countdownRemaining?: number;
  abortReason?: LaunchAbortReason | null;
}

export type DesignHelperKey =
  | 'assembly'
  | 'mass'
  | 'deltaV'
  | 'budget'
  | 'power'
  | 'science'
  | 'diagnostics';

export interface ProgressionLevel {
  level: number;
  code: string;
  shortTitle: string;
  title: string;
  subtitle: string;
  objectiveSummary: string;
  launcherId: string;
  destination: LunarDestination;
  briefing: MissionBriefing;
  unlockedPartIds: string[];
  unlockedHelpers: DesignHelperKey[];
  unlocksOnCompleteText: string[];
  /** Allows first-flight trial-and-error liftoff telemetry to unlock the next level */
  unlockOnFirstLiftoff?: boolean;
}

export interface ProgressionState {
  maxUnlockedLevel: number;
  activeLevel: number;
  completedLevels: number[];
  firstLiftoffDone: boolean;
}

