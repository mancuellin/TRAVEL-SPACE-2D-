import {
  LauncherData,
  LunarDestination,
  MissionBriefing,
  MissionResult,
  PartData,
  PartType,
} from '../types/game';
import type { Language } from '../i18n/LanguageContext';

const G0 = 9.80665; // m/s^2
export const ISP_SECONDS = 380; // Etapa superior translunar

export function calculateMission(
  parts: PartData[],
  launcher: LauncherData | null,
  destination: LunarDestination | null,
  briefing: MissionBriefing | null,
  lang: Language = 'es'
): MissionResult {
  const en = lang === 'en';
  const r: MissionResult = {
    dryMassKg: 0,
    fuelMassKg: 0,
    totalMassKg: 0,
    launcherCapacityKg: 0,
    partsCost: 0,
    totalCost: 0,
    budget: 0,
    solarWatts: 0,
    rtgWatts: 0,
    consumptionWatts: 0,
    batteryWh: 0,
    periodMinutes: 0,
    eclipseMinutes: 0,
    energyNeededInEclipseWh: 0,
    deltaVAvailable: 0,
    deltaVRequired: 0,
    sciencePoints: 0,
    minScience: 0,
    errors: [],
    missingHints: [],
    isValid: false,
  };

  let hasStructure = false;
  let hasComputer = false;
  let hasAntenna = false;
  let hasCamera = false;
  let hasEASEP = false;
  let hasShielding = false;

  // 1) Sumar todas las piezas
  for (const p of parts) {
    if (!p) continue;
    if (p.type === PartType.Structure) hasStructure = true;
    if (p.type === PartType.Computer) hasComputer = true;
    if (p.type === PartType.Antenna) hasAntenna = true;
    if (p.id === 'camara-hd') hasCamera = true;
    if (p.id === 'radar') hasEASEP = true;
    if (p.type === PartType.Shielding) hasShielding = true;

    r.dryMassKg += p.massKg;
    r.fuelMassKg += p.fuelKg;
    r.partsCost += p.costMillions;
    r.batteryWh += p.batteryWh;
    r.sciencePoints += p.sciencePoints;
    if (p.powerWatts > 0) {
      if (p.type === PartType.RTG) r.rtgWatts += p.powerWatts;
      else r.solarWatts += p.powerWatts;
    } else {
      r.consumptionWatts += -p.powerWatts;
    }
  }

  r.totalMassKg = r.dryMassKg + r.fuelMassKg;
  r.totalCost = r.partsCost;

  // Pistas de módulos faltantes para la misión MK11
  if (!hasStructure) {
    r.missingHints.push(
      en
        ? 'Missing CSM / Eagle Structure (high risk during lunar liftoff).'
        : 'Falta Estructura CSM / Eagle (riesgo grave al despegar de la Luna).'
    );
  }
  if (!hasComputer) {
    r.missingHints.push(
      en
        ? 'Missing AGC Computer (without it, lunar landing will fail).'
        : 'Falta Computadora AGC (sin ella el aterrizaje lunar fallará).'
    );
  }
  if (!hasCamera) {
    r.missingHints.push(
      en
        ? 'Missing Hasselblad Camera & Lunar TV (you will return without photos).'
        : 'Falta Cámara Hasselblad y TV lunar (regresarás sin fotografías).'
    );
  }
  if (!hasEASEP) {
    r.missingHints.push(
      en
        ? 'Missing EASEP Package & Samples (useful scientific readings will be missing).'
        : 'Falta Paquete EASEP y Muestras (faltarán mediciones científicas útiles).'
    );
  }
  if (!hasAntenna) {
    r.missingHints.push(
      en
        ? 'Missing Antenna (you will not be able to transmit science data or photos to Earth).'
        : 'Falta Antena (no podrás transmitir datos científicos ni fotos a la Tierra).'
    );
  }
  if (!hasShielding) {
    r.missingHints.push(
      en
        ? 'No Heat Shield / radiation armor (higher risk during solar storms).'
        : 'Sin Escudo térmico/blindaje (mayor riesgo ante tormentas solares).'
    );
  }

  // 2) Lanzador
  if (!launcher) {
    r.errors.push(en ? 'No launcher selected.' : 'No hay lanzador seleccionado.');
    r.missingHints.push(en ? 'Select a Launch Vehicle.' : 'Selecciona un Vehículo Lanzador.');
  } else {
    r.totalCost += launcher.costMillions;
    r.launcherCapacityKg = launcher.capacityKg;
    if (r.totalMassKg > launcher.capacityKg) {
      r.errors.push(
        en
          ? `Mass (${r.totalMassKg.toFixed(0)} kg) exceeds launcher capacity (${launcher.capacityKg.toFixed(0)} kg).`
          : `La masa (${r.totalMassKg.toFixed(0)} kg) supera la capacidad del lanzador (${launcher.capacityKg.toFixed(0)} kg).`
      );
      r.missingHints.push(
        en
          ? `You exceed launcher capacity by ${(r.totalMassKg - launcher.capacityKg).toFixed(0)} kg: remove modules or use a larger launcher.`
          : `Sobrepasas la capacidad del lanzador por ${(r.totalMassKg - launcher.capacityKg).toFixed(0)} kg: quita módulos o usa un lanzador mayor.`
      );
    }
  }

  // 3) Presupuesto y ciencia (solo referencia, no bloquea el despegue)
  if (briefing) {
    r.budget = briefing.budgetMillions;
    r.minScience = briefing.minSciencePoints;
    if (r.totalCost > briefing.budgetMillions) {
      r.errors.push(
        en
          ? `Guideline budget exceeded: $${r.totalCost.toFixed(1)}M of $${briefing.budgetMillions.toFixed(1)}M.`
          : `Presupuesto orientativo excedido: $${r.totalCost.toFixed(1)}M de $${briefing.budgetMillions.toFixed(1)}M.`
      );
    }
    if (r.sciencePoints < briefing.minSciencePoints) {
      r.errors.push(
        en
          ? `Estimated science too low: ${r.sciencePoints.toFixed(0)} of ${briefing.minSciencePoints.toFixed(0)} points.`
          : `Ciencia estimada baja: ${r.sciencePoints.toFixed(0)} de ${briefing.minSciencePoints.toFixed(0)} puntos.`
      );
    }
  }

  // 4) ΔV (ecuación de Tsiolkovsky para el viaje lunar)
  if (r.dryMassKg > 0 && r.fuelMassKg > 0) {
    r.deltaVAvailable = ISP_SECONDS * G0 * Math.log(r.totalMassKg / r.dryMassKg);
  }

  if (!destination) {
    r.errors.push(en ? 'No lunar destination selected.' : 'No hay destino lunar seleccionado.');
    r.isValid = r.errors.length === 0;
    return r;
  }

  r.deltaVRequired = destination.deltaVRequired;
  if (r.deltaVAvailable < destination.deltaVRequired) {
    r.errors.push(
      en
        ? `ΔV below optimal for ${destination.name}: ${r.deltaVAvailable.toFixed(0)} m/s of ${destination.deltaVRequired.toFixed(0)} m/s.`
        : `ΔV por debajo del óptimo para ${destination.name}: ${r.deltaVAvailable.toFixed(0)} m/s de ${destination.deltaVRequired.toFixed(0)} m/s.`
    );
    if (r.fuelMassKg <= 0) {
      r.missingHints.push(
        en
          ? 'Missing Propellant Tanks (without fuel the rocket cannot lift off).'
          : 'Faltan Tanques de propelente (sin combustible el cohete no despega).'
      );
    } else if (r.deltaVAvailable < 1500) {
      r.missingHints.push(
        en
          ? 'Fuel critically low (< 1500 m/s): spacecraft will remain trapped in low orbit.'
          : 'Combustible muy bajo (< 1500 m/s): quedará atrapado en órbita baja.'
      );
    } else if (r.deltaVAvailable < 2600) {
      r.missingHints.push(
        en
          ? 'Insufficient fuel (< 2600 m/s): spacecraft will stay in Earth orbit without reaching the Moon.'
          : 'Combustible insuficiente (< 2600 m/s): quedará orbitando la Tierra sin llegar a la Luna.'
      );
    } else {
      r.missingHints.push(
        en
          ? `Insufficient thrust (< ${destination.deltaVRequired.toFixed(0)} m/s): spacecraft will launch but stay in orbit without reaching the Moon.`
          : `Impulso insuficiente (< ${destination.deltaVRequired.toFixed(0)} m/s): la nave despegará pero quedará orbitando sin viajar a la Luna.`
      );
    }
  }

  // 5) Ciclo de luz y sombra lunar
  r.periodMinutes = destination.periodMinutes;
  r.eclipseMinutes = destination.eclipseMinutes;

  const eclipseHours = r.eclipseMinutes / 60;
  const daylightHours = (r.periodMinutes - r.eclipseMinutes) / 60;

  // 6) Balance de energía
  const daylightPower = r.solarWatts + r.rtgWatts;
  if (daylightPower < r.consumptionWatts) {
    r.errors.push(
      en
        ? `Insufficient solar power: generates ${daylightPower.toFixed(0)} W and consumes ${r.consumptionWatts.toFixed(0)} W.`
        : `Energía insuficiente al sol: genera ${daylightPower.toFixed(0)} W y consume ${r.consumptionWatts.toFixed(0)} W.`
    );
    r.missingHints.push(
      en
        ? 'Missing Solar Panels or RTG Generator to cover electrical consumption.'
        : 'Faltan Paneles solares o Generador RTG para cubrir el consumo eléctrico.'
    );
  }

  const eclipseDeficitW = r.consumptionWatts - r.rtgWatts;
  r.energyNeededInEclipseWh = Math.max(0, eclipseDeficitW) * eclipseHours;

  if (r.energyNeededInEclipseWh > r.batteryWh) {
    r.errors.push(
      en
        ? `Insufficient battery capacity for the ${r.eclipseMinutes.toFixed(0)}-min lunar eclipse phase.`
        : `Faltó batería para cubrir la fase de sombra lunar de ${r.eclipseMinutes.toFixed(0)} min.`
    );
    r.missingHints.push(
      en
        ? 'Missing Lunar Battery to survive orbital eclipses without electrical failure.'
        : 'Falta Batería lunar para sobrevivir los eclipses sin avería eléctrica.'
    );
  } else if (daylightPower >= r.consumptionWatts) {
    const rechargeWh = (daylightPower - r.consumptionWatts) * daylightHours;
    if (rechargeWh < r.energyNeededInEclipseWh) {
      r.errors.push(
        en
          ? 'Solar panels cannot recharge the battery in time during the sunlit phase.'
          : 'Los paneles no alcanzan a recargar la batería durante el periodo iluminado.'
      );
      r.missingHints.push(
        en
          ? 'Add another Auxiliary Solar Panel or RTG to recharge the battery in time.'
          : 'Añade otro Panel solar auxiliar o RTG para recargar la batería a tiempo.'
      );
    }
  }

  r.isValid = r.errors.length === 0;
  return r;
}

export function formatMissionReport(
  r: MissionResult,
  lang: Language = 'es'
): string {
  const en = lang === 'en';
  const lines: string[] = [];
  lines.push(en ? '=== MASS ===' : '=== MASA ===');
  lines.push(
    en
      ? `Total mass: ${r.totalMassKg.toFixed(0)} kg / ${r.launcherCapacityKg.toFixed(0)} kg (launcher)`
      : `Masa total: ${r.totalMassKg.toFixed(0)} kg / ${r.launcherCapacityKg.toFixed(0)} kg (lanzador)`
  );
  lines.push(
    en
      ? `  Dry: ${r.dryMassKg.toFixed(0)} kg   Propellant: ${r.fuelMassKg.toFixed(0)} kg`
      : `  Seca: ${r.dryMassKg.toFixed(0)} kg   Combustible: ${r.fuelMassKg.toFixed(0)} kg`
  );
  lines.push('');
  lines.push(en ? '=== COST ===' : '=== COSTO ===');
  lines.push(
    en
      ? `Total cost: $${r.totalCost.toFixed(1)}M / $${r.budget.toFixed(1)}M (reference)`
      : `Costo total: $${r.totalCost.toFixed(1)}M / $${r.budget.toFixed(1)}M (referencia)`
  );
  lines.push('');
  lines.push(en ? '=== POWER ===' : '=== ENERGÍA ===');
  lines.push(
    en
      ? `Solar: ${r.solarWatts.toFixed(0)} W   RTG: ${r.rtgWatts.toFixed(0)} W   Draw: ${r.consumptionWatts.toFixed(0)} W`
      : `Paneles: ${r.solarWatts.toFixed(0)} W   RTG: ${r.rtgWatts.toFixed(0)} W   Consumo: ${r.consumptionWatts.toFixed(0)} W`
  );
  lines.push(
    en
      ? `Battery: ${r.batteryWh.toFixed(0)} Wh (needs ${r.energyNeededInEclipseWh.toFixed(0)} Wh in eclipse)`
      : `Batería: ${r.batteryWh.toFixed(0)} Wh (necesita ${r.energyNeededInEclipseWh.toFixed(0)} Wh en sombra)`
  );
  lines.push(
    en
      ? `Orbital cycle: ${r.periodMinutes.toFixed(0)} min   Eclipse: ${r.eclipseMinutes.toFixed(0)} min`
      : `Ciclo orbital: ${r.periodMinutes.toFixed(0)} min   Sombra: ${r.eclipseMinutes.toFixed(0)} min`
  );
  lines.push('');
  lines.push(en ? '=== ΔV & REAL LUNAR DATA ===' : '=== ΔV Y DATOS LUNARES REALES ===');
  lines.push(
    en
      ? `Available ΔV: ${r.deltaVAvailable.toFixed(0)} m/s / Optimal full route: ${r.deltaVRequired.toFixed(0)} m/s`
      : `ΔV disponible: ${r.deltaVAvailable.toFixed(0)} m/s / Óptimo ruta completa: ${r.deltaVRequired.toFixed(0)} m/s`
  );
  lines.push(
    en
      ? 'Required TLI vel.: 10.9 km/s (Earth orbit 7.8 km/s)'
      : 'Vel. TLI requerida: 10.9 km/s (órbita terrestre 7.8 km/s)'
  );
  lines.push(
    en
      ? 'Lunar gravity: 1.62 m/s² (orbit 1.68 km/s · escape 2.38 km/s)'
      : 'Gravedad lunar: 1.62 m/s² (órbita 1.68 km/s · escape 2.38 km/s)'
  );
  lines.push('');
  lines.push(en ? '=== SCIENCE ===' : '=== CIENCIA ===');
  lines.push(
    en
      ? `Points: ${r.sciencePoints.toFixed(0)} / recommended ${r.minScience.toFixed(0)}`
      : `Puntos: ${r.sciencePoints.toFixed(0)} / recomendado ${r.minScience.toFixed(0)}`
  );
  lines.push('');
  if (r.isValid && r.missingHints.length === 0) {
    lines.push(en ? 'STATUS: OPTIMAL MK11 CONFIGURATION' : 'ESTADO: CONFIGURACIÓN MK11 ÓPTIMA');
  } else {
    lines.push(en ? 'ENGINEERING NOTES:' : 'OBSERVACIONES DE INGENIERÍA:');
    const combined = r.missingHints.length > 0 ? r.missingHints : r.errors;
    for (const h of combined) lines.push(` - ${h}`);
  }
  return lines.join('\n');
}
