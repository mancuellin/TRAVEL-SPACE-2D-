import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, FileText, ArrowRight, RotateCcw, Wrench, Sparkles, Lightbulb, Film } from 'lucide-react';
import { REAL_LUNAR_PHYSICS } from '../data/gameData';
import { LaunchAbortReason, MissionEndingMeta, ProgressionLevel } from '../types/game';
import { AnimatedSpaceBg } from './AnimatedSpaceBg';
import { FinalParadeView } from './FinalParadeView';
import { Language, useLanguage } from '../i18n/LanguageContext';

export interface EndingLevelInfo {
  level: number;
  code: string;
  title: string;
  isFinalLunar: boolean;
  totalDays: number;
  distanceKm: number;
}

export interface ElDiarioGlobalProps {
  mission: string;
  orbit: string;
  days: number;
  science: number;
  score: number;
  rating: string;
  hasCamera?: boolean;
  habitability?: string;
  meta: MissionEndingMeta;
  launchStageFailure?: boolean;
  launchAbortReason?: LaunchAbortReason | null;
  extraHints?: string[];
  compact?: boolean;
  levelInfo?: EndingLevelInfo;
  lang?: Language;
}

interface NewspaperEditionContent {
  issueNumber: string;
  dateLine: string;
  editionBadge: string;
  headline: string;
  ribbonText: string;
  leftTopTitle: string;
  leftTopBody: string;
  leftTopImg?: string;
  leftTopAlt?: string;
  leftBottomTitle: string;
  leftBottomBody: string;
  leftBottomImg?: string;
  leftBottomAlt?: string;
  centerLead: string;
  centerSecondaryLead?: string;
  centerPullQuote?: string;
  centerImg?: string;
  centerAlt?: string;
  centerSubColTitle?: string;
  centerSubColBody?: string;
  rightTitle: string;
  rightBody: string;
  rightNote?: string;
  rightImg?: string;
  rightAlt?: string;
  footerItems: string[];
}

function getDefaultHabitability(en: boolean): string {
  return en
    ? 'Not naturally habitable: it lacks a breathable atmosphere, has direct solar radiation, and suffers extreme temperatures (-170 °C to +120 °C). Only viable inside sealed, pressurized bases.'
    : 'No habitable de forma natural: carece de atmósfera respirable, presenta radiación solar directa y temperaturas extremas (-170 °C a +120 °C). Solo viable en bases selladas y presurizadas.';
}

// Strictly uses only artwork from the user-provided EL DIARIO GLOBAL editions
const IMG = {
  crater: '/assets/diario/lunar_crater.jpg',
  rock: '/assets/diario/lunar_rock.jpg',
  flight: '/assets/diario/mk11_flight.jpg',
  dish: '/assets/diario/space_dish.jpg',
  visitaLunar: '/assets/diario/visita_lunar.jpg',
  despegueAbortado: '/assets/diario/despegue_abortado.jpg',
  lunaFotos: '/assets/diario/luna_fotos.jpg',
};

function LaurelWreathSvg({ flip = false }: { flip?: boolean }) {
  const ink = '#132638';
  return (
    <svg
      width="36"
      height="28"
      viewBox="0 0 36 28"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      className="shrink-0"
    >
      <path d="M28 24C18 22 10 15 8 4" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
      <ellipse cx="11" cy="7" rx="3.2" ry="1.8" transform="rotate(-30 11 7)" fill="#6b8e4e" stroke={ink} strokeWidth="1" />
      <ellipse cx="14" cy="12" rx="3.4" ry="1.9" transform="rotate(-22 14 12)" fill="#6b8e4e" stroke={ink} strokeWidth="1" />
      <ellipse cx="18" cy="17" rx="3.4" ry="1.9" transform="rotate(-12 18 17)" fill="#6b8e4e" stroke={ink} strokeWidth="1" />
      <ellipse cx="23" cy="21" rx="3.3" ry="1.8" transform="rotate(6 23 21)" fill="#6b8e4e" stroke={ink} strokeWidth="1" />
      <ellipse cx="7" cy="10" rx="2.9" ry="1.6" transform="rotate(32 7 10)" fill="#7da05c" stroke={ink} strokeWidth="1" />
      <ellipse cx="10" cy="16" rx="3.1" ry="1.7" transform="rotate(24 10 16)" fill="#7da05c" stroke={ink} strokeWidth="1" />
      <ellipse cx="15" cy="21" rx="3.1" ry="1.7" transform="rotate(14 15 21)" fill="#7da05c" stroke={ink} strokeWidth="1" />
    </svg>
  );
}

function buildEditionContent({
  days,
  science,
  hasCamera,
  meta,
  launchStageFailure,
  launchAbortReason,
  extraHints,
  levelInfo,
  lang = 'es',
}: ElDiarioGlobalProps): NewspaperEditionContent {
  const en = lang === 'en';
  const noCamNote = !hasCamera || meta.key === 'sin_camara';
  const showMoonPhotos =
    meta.survived && meta.landed && hasCamera && meta.key !== 'sin_camara';
  const combinedHint =
    extraHints && extraHints.length > 0
      ? `${meta.hint} (${extraHints.slice(0, 2).join(' · ')})`
      : meta.hint;
  const missionCode = levelInfo?.code ?? 'MK11';
  const isOrbitalTest = Boolean(levelInfo && !levelInfo.isFinalLunar);

  // Edition #4 (user-supplied): Launch stage failures (pad abort / overweight / low velocity)
  if (launchStageFailure) {
    const isNoFuel = launchAbortReason === 'no_fuel';
    const isIncomplete = launchAbortReason === 'incomplete';
    const isOverweight = launchAbortReason === 'overweight';
    return {
      issueNumber: en ? 'No. 10,437' : 'N.º 10.437',
      dateLine: en ? 'WEDNESDAY, JANUARY 22, 2058' : 'MIÉRCOLES, 22 DE ENERO DE 2058',
      editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
      headline: isNoFuel
        ? en
          ? `${missionCode} ABORTED WITHOUT FUEL`
          : `${missionCode} ABORTADO SIN COMBUSTIBLE`
        : isIncomplete
          ? en
            ? `${missionCode} INCOMPLETE ON PAD`
            : `${missionCode} INCOMPLETO EN PLATAFORMA`
          : isOverweight
            ? en
              ? `${missionCode} FALLS DUE TO EXCESS WEIGHT — CREW SURVIVES!`
              : `${missionCode} CAE POR SOBREPESO — ¡POR SUERTE SE SALVARON!`
            : en
              ? `${missionCode} FALLS SHORT OF VELOCITY`
              : `${missionCode} CAE POR FALTA DE VELOCIDAD`,
      ribbonText: isNoFuel
        ? en
          ? 'Missing propellant tanks prevent engine ignition on the pad'
          : 'Sin tanques de propelente, los motores no pudieron encender en plataforma'
        : isIncomplete
          ? en
            ? 'Missing structural modules force immediate pad launch abort'
            : 'Faltaron módulos esenciales del cohete y se abortó en plataforma'
          : isOverweight
            ? en
              ? 'Rocket lifted off overloaded and fell, but thankfully the crew survived!'
              : 'El cohete despegó con peso de más y cayó, ¡pero por suerte se salvaron!'
            : en
              ? 'Insufficient velocity prevented reaching orbit and the craft fell in space'
              : 'No completó la velocidad suficiente y comenzó a caer en el espacio',
      leftTopTitle: isNoFuel || isIncomplete
        ? en
          ? 'Launch aborted on pad'
          : 'Despegue abortado en plataforma'
        : isOverweight
          ? en
            ? 'Overloaded liftoff and fall'
            : 'Despegue con sobrepeso y caída'
          : en
            ? 'Velocity shortfall'
            : 'Velocidad insuficiente',
      leftTopBody: isNoFuel
        ? en
          ? `Mission control aborted the ${missionCode} launch immediately on the pad because no propellant tank was installed on the rocket.`
          : `El control de misión abortó inmediatamente en plataforma el lanzamiento del ${missionCode} porque no llevaba ningún tanque de propelente instalado.`
        : isIncomplete
          ? en
            ? `The ${missionCode} rocket had an incomplete assembly on the launch pad, forcing automated safety systems to cancel liftoff before countdown.`
            : `El cohete ${missionCode} tenía un ensamblaje incompleto en la plataforma, obligando al sistema de seguridad a cancelar el lanzamiento antes de despegar.`
          : isOverweight
            ? en
              ? `The ${missionCode} rocket managed to lift off from the pad, but its excess weight exceeded the launcher limit, causing thrust loss mid-ascent and a steep fall.`
              : `El cohete ${missionCode} logró despegar de la plataforma, pero el exceso de peso superó la capacidad del lanzador, perdió empuje en pleno ascenso y terminó cayendo.`
            : en
              ? `The ${missionCode} rocket climbed into space, but failed to reach the required orbital velocity and began falling in orbit.`
              : `El cohete ${missionCode} subió hasta el espacio, pero no completó la velocidad necesaria para sostener la órbita y comenzó a caer en el espacio.`,
      leftBottomTitle: isOverweight
        ? en
          ? 'Thankfully everyone survived!'
          : '¡Por suerte se salvaron!'
        : en
          ? 'Crew out of danger'
          : 'Tripulación fuera de peligro',
      leftBottomBody: isOverweight
        ? en
          ? `Thankfully, the emergency escape tower and capsule parachutes deployed in time: the entire ${missionCode} crew landed safe and sound without a single injury!`
          : `¡Por suerte la tripulación se salvó! La torre de escape y los paracaídas de la cápsula funcionaron a tiempo, logrando que los astronautas del ${missionCode} aterrizaran sanos y salvos.`
        : en
          ? `The ${missionCode} crew landed safely after safety protocols were triggered. Engineers are already analyzing flight telemetry from this test.`
          : `La tripulación del ${missionCode} aterrizó a salvo tras la activación del protocolo de seguridad. Los ingenieros ya analizan los datos de vuelo recopilados en este ensayo.`,
      centerLead: isNoFuel
        ? en
          ? `Before liftoff, the ${missionCode} had zero fuel on board. Without propellant tanks, control canceled the flight immediately on the pad.`
          : `Antes de iniciar la cuenta, el ${missionCode} no contaba con combustible a bordo. Sin tanques de propelente, control canceló el vuelo en la plataforma.`
        : isIncomplete
          ? en
            ? `The ${missionCode} launch attempt was canceled on the pad due to missing essential rocket sections. Engineers must complete all 4 parts in Design.`
            : `El intento de lanzamiento del ${missionCode} fue cancelado en la plataforma al faltar secciones esenciales del cohete. Los ingenieros deben completar las 4 partes en Diseño.`
          : isOverweight
            ? en
              ? `Although ${missionCode} cleared the launch pad, the overload prevented sustained climb and the rocket fell. Thankfully, the crew ejected in time and survived unharmed.`
              : `Aunque el ${missionCode} alcanzó a elevarse de la plataforma, el peso excesivo impidió sostener el vuelo y el cohete cayó. Por suerte, los astronautas activaron el escape a tiempo y se salvaron.`
            : en
              ? `During the orbital burn in space, ${missionCode} ran short of the velocity needed for orbit and began falling out of trajectory. Mission control recovered the crew safely.`
              : `Durante la maniobra en el espacio, el cohete ${missionCode} no completó la velocidad suficiente para la órbita y quedó cayendo en el espacio. El control de misión recuperó a la tripulación a salvo.`,
      centerSecondaryLead: isOverweight
        ? en
          ? 'The agency celebrated that every crew member survived the scare and confirmed the next rocket will carry a lighter load.'
          : 'La agencia celebró que toda la tripulación se salvara del susto y confirmó que aligerará la carga para el próximo despegue.'
        : en
          ? isOrbitalTest
            ? 'The agency confirmed that every failed test yields valuable trial-and-error telemetry to calibrate the next generation of rockets.'
            : 'The crew landed safely; the lunar expedition has been postponed while engineers review the propulsion system.'
          : isOrbitalTest
            ? 'La agencia confirmó que cada intento fallido aporta telemetría valiosa de prueba y error para calibrar la próxima generación de cohetes.'
            : 'La tripulación aterrizó a salvo; la expedición lunar quedó aplazada mientras los ingenieros revisan el sistema de propulsión.',
      centerPullQuote: isOverweight
        ? en
          ? '“The rocket fell under the extra weight, but thankfully the crew survived!”'
          : '“El cohete cayó por el exceso de peso, ¡pero por suerte se salvaron todos!”'
        : en
          ? '“In the space race, every test launch brings us one step closer to the Moon.”'
          : '“En la carrera espacial, cada despegue de prueba nos acerca un paso más a la Luna.”',
      centerImg: IMG.despegueAbortado,
      centerAlt: en
        ? 'Rocket aborting launch and capsule descending under three parachutes'
        : 'Cohete abortando el despegue y cápsula descendiendo con tres paracaídas',
      rightTitle: en ? 'Engineers to review propulsion' : 'Ingenieros revisarán la propulsión',
      rightBody: en
        ? `A technical team will analyze logs from this ${missionCode} attempt to adjust mass, thrust, and modules in the hangar.`
        : `Un equipo técnico analizará los registros de este intento de ${missionCode} para ajustar masa, empuje y módulos en el hangar.`,
      rightNote:
        combinedHint ||
        (en
          ? 'A new launch date will be set after reviewing the rocket design.'
          : 'La nueva fecha de lanzamiento se definirá tras revisar el diseño del cohete.'),
      footerItems: isOverweight
        ? en
          ? [
              'OVERWEIGHT LIFTOFF & FALL',
              'THANKFULLY CREW SURVIVED!',
              'ESCAPE PARACHUTES WORKED',
              'REDUCE WEIGHT IN DESIGN',
            ]
          : [
              'DESPEGUE CON SOBREPESO Y CAÍDA',
              '¡POR SUERTE SE SALVARON!',
              'PARACAÍDAS DE ESCAPE ACTIVADOS',
              'REDUCIR PESO EN DISEÑO',
            ]
        : en
          ? [
              isOrbitalTest ? 'TRIAL-AND-ERROR TEST FLIGHT' : 'LUNAR EXPEDITION POSTPONED',
              'TELEMETRY RECOVERED',
              'NEW TESTS IN PREPARATION',
              'CREW RETURNED SAFELY',
            ]
          : [
              isOrbitalTest ? 'ENSAYO DE PRUEBA Y ERROR' : 'EXPEDICIÓN LUNAR APLAZADA',
              'TELEMETRÍA RECUPERADA',
              'NUEVAS PRUEBAS EN PREPARACIÓN',
              'LA TRIPULACIÓN REGRESÓ A SALVO',
            ],
    };
  }

  // Orbital Leveling Missions (Niveles 1, 2 y 3)
  if (isOrbitalTest && levelInfo) {
    if (meta.key === 'exploracion_completa' || meta.key === 'regreso_emergencia') {
      if (levelInfo.level === 1) {
        return {
          issueNumber: en ? 'No. 10,420' : 'N.º 10.420',
          dateLine: en ? 'MONDAY, JANUARY 13, 2058' : 'LUNES, 13 DE ENERO DE 2058',
          editionBadge: en ? 'INAUGURAL EDITION · MK-I' : 'EDICIÓN INAUGURAL · MK-I',
          headline: en ? 'FIRST MK-I FLIGHT SUCCEEDS!' : '¡PRIMER VUELO MK-I EXITOSO!',
          ribbonText: en
            ? 'Inaugural capsule clears low Earth orbit and unlocks new sensors'
            : 'La cápsula inaugural supera la órbita baja y desbloquea nuevos sensores',
          leftTopTitle: en ? 'Inaugural LEO liftoff' : 'Despegue inaugural en LEO',
          leftTopBody: en
            ? 'The Saturn IB launcher placed the MK-I capsule at 400 km orbital altitude for 24 continuous hours of faultless structural testing.'
            : 'El lanzador Saturno IB colocó la cápsula MK-I a 400 km de altitud orbital durante 24 horas continuas de prueba estructural sin fallos.',
          leftBottomTitle: en ? 'Telemetry recovered' : 'Telemetría recuperada',
          leftBottomBody: en
            ? 'Engineers analyzed thrust, weight, and power curves from this first flight to activate real Mass and ΔV gauges in the hangar.'
            : 'Los ingenieros analizaron las curvas de empuje, peso y energía de este primer vuelo para activar los medidores reales de Masa y ΔV en el hangar.',
          centerLead: en
            ? 'In the program’s first official mission, the crew cleared the atmosphere and validated the core rocket architecture. Houston celebrated the first step toward the Moon.'
            : 'En la primera misión oficial del programa, el equipo superó la atmósfera y validó la arquitectura base del cohete. Houston celebró el primer paso rumbo a la Luna.',
          centerSecondaryLead: en
            ? 'Internal cells kept the capsule powered during 30 minutes of Earth’s shadow before a safe Pacific splashdown.'
            : 'Las celdas internas mantuvieron activa la cápsula durante los 30 minutos de sombra terrestre antes del amerizaje seguro en el Pacífico.',
          centerPullQuote: en
            ? '“First rung cleared: the MK-I rocket opened the door to high orbit.”'
            : '“Primer peldaño superado: el cohete MK-I abrió la puerta de la órbita alta.”',
          centerImg: IMG.flight,
          centerAlt: en
            ? 'MK-I capsule on its first orbital flight above Earth'
            : 'Cápsula MK-I en su primer vuelo orbital sobre la Tierra',
          rightTitle: en ? 'Level 2 · MK-II authorized' : 'Nivel 2 · MK-II autorizado',
          rightBody: en
            ? 'Engineering approved Lunar Batteries, S-Band Parabolic Antenna, Redundant AGC Computer, and the Hasselblad Camera for travel to the Space Station.'
            : 'Ingeniería aprobó Baterías lunares, Antena Parabólica Banda S, Computadora AGC redundante y Cámara Hasselblad para viajar a la Estación Espacial.',
          rightNote: en
            ? 'Use the Design [M] menu to inspect your new Mass and ΔV sensors.'
            : 'Usa el menú Diseño [M] para revisar los nuevos sensores de Masa y ΔV.',
          rightImg: IMG.dish,
          rightAlt: en
            ? 'Ground tracking station following MK-I'
            : 'Estación de seguimiento terrestre siguiendo al MK-I',
          footerItems: en
            ? [
                'FIRST MISSION COMPLETED',
                'LOW ORBIT CLEARED (400 KM)',
                'MASS & ΔV SENSORS ACTIVE',
                'NEXT: LEVEL 2 · SPACE STATION',
              ]
            : [
                'PRIMERA MISIÓN COMPLETADA',
                'ÓRBITA BAJA SUPERADA (400 KM)',
                'SENSORES DE MASA Y ΔV ACTIVOS',
                'RUMBO AL NIVEL 2 · ESTACIÓN ESPACIAL',
              ],
        };
      }
      if (levelInfo.level === 2) {
        return {
          issueNumber: en ? 'No. 10,422' : 'N.º 10.422',
          dateLine: en ? 'WEDNESDAY, JANUARY 15, 2058' : 'MIÉRCOLES, 15 DE ENERO DE 2058',
          editionBadge: en ? 'MK-II STATION EXPEDITION' : 'EXPEDICIÓN ESTACIÓN MK-II',
          headline: en ? 'DOCKING & EARTH PHOTOS SUCCEED!' : '¡ACOPLAMIENTO Y FOTOS DE LA TIERRA!',
          ribbonText: en
            ? 'Full spacecraft docked at the space station and beamed back orbital images'
            : 'La nave completa se acopló a la estación espacial y envió imágenes orbitales',
          leftTopTitle: en ? 'Full-craft docking' : 'Acople con la nave completa',
          leftTopBody: en
            ? `During ${days} days in orbit (420 km), the crew inserted the full spacecraft into the Space Station MK-II port and gathered scientific data.`
            : `Durante ${days} días en órbita (420 km), la tripulación insertó la nave completa en el puerto de la Estación Espacial MK-II y recolectó información científica.`,
          leftBottomTitle: en ? 'Photographs of Earth' : 'Fotografías de la Tierra',
          leftBottomBody: en
            ? `With the Hasselblad Camera they beamed ${science.toFixed(0)} pts of data and images of Earth’s oceans and atmosphere before enduring a 35-min eclipse.`
            : `Con la Cámara Hasselblad enviaron ${science.toFixed(0)} pts de datos e imágenes de los océanos y la atmósfera terrestre antes de resistir 35 min de eclipse.`,
          centerLead: en
            ? 'Mission MK-II successfully completed rendezvous and docking with the orbital space station. With this feat, the agency approves the heavy Saturn V rocket.'
            : 'La misión MK-II completó con éxito el encuentro y acoplamiento con la estación espacial orbital. Con esta hazaña, la agencia aprueba el cohete pesado Saturno V.',
          centerSecondaryLead: en
            ? 'The upcoming MK-III expedition will orbit the Moon to map prospective landing sites.'
            : 'La próxima expedición MK-III enviará una nave alrededor de la Luna para cartografiar posibles zonas de alunizaje.',
          centerPullQuote: en
            ? '“Full craft docked and Earth photos safe; Saturn V awaits on the pad.”'
            : '“Nave completa acoplada y fotos de la Tierra a salvo; el Saturno V espera en plataforma.”',
          centerImg: IMG.flight,
          centerAlt: en
            ? 'MK-II full spacecraft returning after docking at the space station'
            : 'Nave completa MK-II regresando tras acoplarse a la estación espacial',
          rightTitle: en ? 'Saturn V & Shielding approved' : 'Saturno V y Blindaje aprobados',
          rightBody: en
            ? 'Heavy Saturn V rocket (1,200 kg), Solar Storm Heat Shield, and Power & Budget consoles are now unlocked.'
            : 'Se desbloquean el cohete pesado Saturno V (1,200 kg), el Escudo térmico contra tormentas solares y las consolas de Energía y Presupuesto.',
          rightImg: IMG.dish,
          rightAlt: en
            ? 'Deep-space tracking station receiving Earth photos'
            : 'Estación de seguimiento espacial recibiendo fotos de la Tierra',
          footerItems: en
            ? [
                'SPACE STATION COMPLETED',
                'EARTH PHOTOS RECEIVED',
                'SATURN V AUTHORIZED (1,200 KG)',
                'NEXT: LEVEL 3 · MK-III',
              ]
            : [
                'ESTACIÓN ESPACIAL COMPLETADA',
                'FOTOS DE LA TIERRA RECIBIDAS',
                'SATURNO V AUTORIZADO (1,200 KG)',
                'RUMBO AL NIVEL 3 · MK-III',
              ],
        };
      }
      if (levelInfo.level === 3) {
        return {
          issueNumber: en ? 'No. 10,425' : 'N.º 10.425',
          dateLine: en ? 'SATURDAY, JANUARY 18, 2058' : 'SÁBADO, 18 DE ENERO DE 2058',
          editionBadge: en ? 'LUNAR RECONNAISSANCE' : 'RECONOCIMIENTO LUNAR',
          headline: en ? 'MK-III MAPS THE MOON!' : '¡MK-III CARTOGRAFÍA LA LUNA!',
          ribbonText: en
            ? 'Lunar orbit complete: all set for the final MK11 landing'
            : 'Órbita lunar completada: todo listo para el alunizaje final MK11',
          leftTopTitle: en ? '110 km flyby' : 'Sobrevuelo a 110 km',
          leftTopBody: en
            ? `During ${days} days in lunar orbit, the craft photographed the Sea of Tranquility and transmitted ${science.toFixed(0)} science pts.`
            : `Durante ${days} días en órbita lunar, el vehículo fotografió el Mar de la Tranquilidad y transmitió ${science.toFixed(0)} pts científicos.`,
          leftTopImg: hasCamera ? IMG.crater : undefined,
          leftTopAlt: en
            ? 'Lunar craters photographed from orbit'
            : 'Cráteres lunares fotografiados desde órbita',
          leftBottomTitle: en ? 'Landing zone selected' : 'Zona de descenso elegida',
          leftBottomBody: en
            ? 'Orbital maps confirm clear terrain for the Eagle lunar module, though inhospitable without life support.'
            : 'Los mapas orbitales confirman un terreno despejado para el módulo lunar Eagle, aunque inhóspito sin soporte vital.',
          centerLead: en
            ? 'Mission MK-III completed lunar orbit without landing and returned safely to the Pacific. With all tech validated, NASA authorizes the final MK11 expedition.'
            : 'La misión MK-III completó la órbita lunar sin alunizar y regresó a salvo al Pacífico. Con toda la tecnología validada, la NASA autoriza la expedición final MK11.',
          centerSecondaryLead: en
            ? 'SNAP-27 RTG Generator, EASEP Package, and full flight diagnostics are now enabled for landing on the Moon.'
            : 'Generador RTG SNAP-27, Paquete EASEP y diagnóstico total de vuelo quedan habilitados para descender sobre la Luna.',
          centerPullQuote: en
            ? '“We mapped the Moon from above; on the next flight, we touch down.”'
            : '“Cartografiamos la Luna desde arriba; en el próximo vuelo descenderemos.”',
          centerImg: hasCamera ? IMG.lunaFotos : IMG.flight,
          centerAlt: en
            ? 'Lunar orbital photographs captured by MK-III'
            : 'Fotografías orbitales lunares obtenidas por MK-III',
          rightTitle: en ? 'Green light for MK11' : 'Luz verde para MK11',
          rightBody: en
            ? 'All modules and engineering consoles are unlocked. The historic Moon landing is one launch away.'
            : 'Todos los módulos y consolas de ingeniería han sido desbloqueados. El alunizaje histórico está a un lanzamiento de distancia.',
          rightImg: IMG.dish,
          rightAlt: en
            ? 'Antenna receiving lunar maps'
            : 'Antena recibiendo mapas lunares',
          footerItems: en
            ? [
                'LUNAR ORBIT COMPLETED',
                'ALL DESIGN MODULES UNLOCKED',
                'READY FOR MK11 LANDING',
              ]
            : [
                'ÓRBITA LUNAR COMPLETADA',
                'TODO DESBLOQUEADO EN DISEÑO',
                'LISTOS PARA EL ALUNIZAJE MK11',
              ],
        };
      }
    }

    if (meta.key === 'sin_camara' || meta.key === 'sin_instrumentos') {
      if (levelInfo.level === 2) {
        return {
          issueNumber: en ? 'No. 10,423' : 'N.º 10.423',
          dateLine: en ? 'THURSDAY, JANUARY 16, 2058' : 'JUEVES, 16 DE ENERO DE 2058',
          editionBadge: en ? 'INCOMPLETE EXPEDITION · MK-II' : 'EXPEDICIÓN INCOMPLETA · MK-II',
          headline: en ? 'STATION VISITED WITHOUT PHOTOS' : 'ESTACIÓN VISITADA SIN FOTOS',
          ribbonText: en
            ? 'MK-II returned after docking, but fell short of 20 pts of Earth photos'
            : 'MK-II regresó tras acoplarse, pero sin alcanzar los 20 pts de fotos de la Tierra',
          leftTopTitle: en ? 'Docking without camera' : 'Acoplamiento sin cámara',
          leftTopBody: en
            ? `The full craft inserted at the space station for ${days} days, but sent only ${science.toFixed(0)} of the 20 pts minimum required.`
            : `La nave completa se insertó en la estación espacial durante ${days} días, pero solo envió ${science.toFixed(0)} de los 20 pts mínimos requeridos.`,
          leftBottomTitle: en ? 'Earth photos missing' : 'Faltaron fotos de la Tierra',
          leftBottomBody: en
            ? 'Without a Hasselblad Camera and operational Antenna, the crew could not capture Earth imagery or finish the science delivery.'
            : 'Sin Cámara Hasselblad y una Antena operativa, la tripulación no pudo traer imágenes de la Tierra ni completar la entrega científica.',
          centerLead: en
            ? 'Docking at Space Station MK-II succeeded, yet the main objective required gathering data and photographing our planet.'
            : 'La maniobra de acoplamiento en la Estación Espacial MK-II fue exitosa, pero el objetivo principal exigía recolectar información y fotografiar nuestro planeta.',
          centerPullQuote: en
            ? '“We docked the full craft at the station, but forgot to bring back photos of Earth.”'
            : '“Acoplamos la nave completa a la estación, pero olvidamos traer fotos de la Tierra.”',
          centerImg: IMG.flight,
          centerAlt: en
            ? 'MK-II craft returning from the space station without photographs'
            : 'Nave MK-II regresando de la estación espacial sin fotografías',
          rightTitle: en ? 'Design Hangar adjustment' : 'Ajuste en Hangar de Diseño',
          rightBody: en
            ? 'Equip the Hasselblad Camera along with an Antenna in Design [M] before launching back to the space station.'
            : 'Equipa la Cámara Hasselblad junto con una Antena en Diseño [M] antes de volver a lanzar hacia la estación espacial.',
          rightNote: combinedHint || undefined,
          rightImg: IMG.dish,
          rightAlt: en
            ? 'Antenna awaiting Earth photographs'
            : 'Antena esperando fotografías de la Tierra',
          footerItems: en
            ? [
                'STATION DOCKING ACHIEVED',
                'EARTH PHOTOS MISSING (≥ 20 PTS)',
                'EQUIP HASSELBLAD CAMERA & ANTENNA',
              ]
            : [
                'ACOPLAMIENTO LOGRADO EN ESTACIÓN',
                'FALTAN FOTOS DE LA TIERRA (≥ 20 PTS)',
                'EQUIPAR CÁMARA HASSELBLAD Y ANTENA',
              ],
        };
      }
      return {
        issueNumber: en ? 'No. 10,424' : 'N.º 10.424',
        dateLine: en ? 'FRIDAY, JANUARY 17, 2058' : 'VIERNES, 17 DE ENERO DE 2058',
        editionBadge: en ? 'INCOMPLETE RECONNAISSANCE' : 'RECONOCIMIENTO INCOMPLETO',
        headline: en ? 'ORBITED THE MOON WITHOUT PHOTOS' : 'ORBITARON LA LUNA SIN FOTOS',
        ribbonText: en
          ? 'MK-III returns safely but falls short of the required 30 science pts'
          : 'MK-III regresa a salvo pero sin alcanzar los 30 pts científicos requeridos',
        leftTopTitle: en ? 'Flyby without maps' : 'Sobrevuelo sin mapas',
        leftTopBody: en
          ? `The craft spent ${days} days in lunar orbit, transmitting only ${science.toFixed(0)} pts of the 30 pts needed to map the landing zone.`
          : `La nave completó ${days} días en órbita lunar, pero apenas transmitió ${science.toFixed(0)} pts de los 30 pts requeridos para cartografiar la zona.`,
        leftBottomTitle: en ? 'Camera & antenna key' : 'Cámara y antena clave',
        leftBottomBody: en
          ? 'Without the Hasselblad Camera and S-Band Parabolic Antenna, Houston lacked enough imagery to authorize the MK11 landing.'
          : 'Sin Cámara Hasselblad y Antena Parabólica Banda S, Houston no obtuvo imágenes suficientes para autorizar el alunizaje MK11.',
        centerLead: en
          ? 'The MK-III test proved the craft can travel to the Moon and return, but must be repeated with high-res photography to unlock landing.'
          : 'El ensayo MK-III demostró capacidad para viajar a la Luna y regresar, pero deberá repetirse con equipo fotográfico de alta resolución para desbloquear el alunizaje.',
        centerPullQuote: en
          ? '“We reached lunar orbit, but we need clear photos before touching down.”'
          : '“Llegamos a la órbita lunar, pero necesitamos fotografías claras antes de alunizar.”',
        centerImg: IMG.flight,
        centerAlt: en
          ? 'MK-III craft returning from lunar orbit'
          : 'Nave MK-III regresando de órbita lunar',
        rightTitle: en ? 'Design Hangar adjustment' : 'Ajuste en Hangar de Diseño',
        rightBody: en
          ? 'Install the Hasselblad Camera together with the S-Band Parabolic Antenna before retrying lunar reconnaissance.'
          : 'Instala la Cámara Hasselblad junto con la Antena Parabólica Banda S antes de reintentar el reconocimiento lunar.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en
          ? 'Antenna awaiting scientific data'
          : 'Antena esperando datos científicos',
        footerItems: en
          ? [
              'SAFE RETURN FROM ORBIT',
              'INSUFFICIENT SCIENCE FOR LANDING',
              'EQUIP CAMERA & S-BAND ANTENNA',
            ]
          : [
              'REGRESO SEGURO DESDE ÓRBITA',
              'CIENCIA INSUFICIENTE PARA ALUNIZAJE',
              'EQUIPAR CÁMARA Y ANTENA BANDA S',
            ],
      };
    }
  }

  switch (meta.key) {
    // Edition #1: ¡MK11 HACE HISTORIA!
    case 'exploracion_completa':
      return {
        issueNumber: en ? 'No. 10,427' : 'N.º 10.427',
        dateLine: en ? 'MONDAY, JANUARY 20, 2058' : 'LUNES, 20 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'MK11 MAKES HISTORY!' : '¡MK11 HACE HISTORIA!',
        ribbonText: en
          ? 'Crew returns safely from the Moon'
          : 'La tripulación regresa con éxito de la Luna',
        leftTopTitle: en ? 'Five days of exploration' : 'Cinco días de exploración',
        leftTopBody: en
          ? `The MK11 mission spent ${days} days on the Moon, conducting key observations, measurements, and experiments.`
          : `La misión MK11 permaneció ${days} días en la Luna, donde realizó observaciones, mediciones y experimentos clave.`,
        leftTopImg: IMG.crater,
        leftTopAlt: en
          ? 'Lunar surface and crater photographed by MK11'
          : 'Superficie y cráter lunar fotografiado por MK11',
        leftBottomTitle: en ? 'Samples and photos safe' : 'Muestras y fotografías a salvo',
        leftBottomBody: en
          ? 'The crew returned with lunar samples and an extensive high-quality photographic record now entering lab analysis.'
          : 'La tripulación regresó con muestras lunares y un amplio registro fotográfico de alta calidad, que ya comienza a ser analizado.',
        leftBottomImg: IMG.rock,
        leftBottomAlt: en ? 'Lunar rock in laboratory display case' : 'Roca lunar en vitrina de laboratorio',
        centerLead: en
          ? 'After five days of lunar exploration, Jeremy, Victor, Reid, and Christina completed their mission and returned safely to Earth. The crew brought back photographs and scientific data that will help plan future expeditions.'
          : 'Tras cinco días de exploración lunar, Jeremy, Víctor, Reid y Christina completaron su misión y regresaron sanos y salvos a la Tierra. La tripulación obtuvo fotografías y datos científicos que ayudarán a planear futuras expediciones.',
        centerSecondaryLead: en
          ? 'Habitability reports confirm that the Moon is not naturally habitable and only allows stays inside pressurized bases.'
          : 'Los informes de habitabilidad confirman que la Luna no es habitable de forma natural y solo permite estadías en bases presurizadas.',
        centerImg: IMG.flight,
        centerAlt: en
          ? 'MK11 rocket on lunar trajectory between Earth and the Moon'
          : 'Cohete MK11 en trayectoria lunar entre la Tierra y la Luna',
        rightTitle: en ? 'Next mission in preparation' : 'Próxima misión en preparación',
        rightBody: en
          ? 'The space agency confirmed that a new lunar expedition is already in preparation to expand scientific research and evaluate new sites of interest.'
          : 'La agencia espacial confirmó que ya se trabaja en una nueva expedición lunar, que ampliará la investigación científica y evaluará nuevas zonas de interés.',
        rightImg: IMG.dish,
        rightAlt: en ? 'Ground tracking station' : 'Estación de seguimiento terrestre',
        footerItems: en
          ? [
              'A SAFE AND SUCCESSFUL RETURN',
              'NEW DATA FOR SCIENCE',
              'LUNAR EXPLORATION CONTINUES',
            ]
          : [
              'UN RETORNO SEGURO Y EXITOSO',
              'NUEVOS DATOS PARA LA CIENCIA',
              'LA EXPLORACIÓN LUNAR CONTINÚA',
            ],
      };

    // Sin cámara: sin fotos de la Luna
    case 'sin_camara':
      return {
        issueNumber: en ? 'No. 10,428' : 'N.º 10.428',
        dateLine: en ? 'TUESDAY, JANUARY 21, 2058' : 'MARTES, 21 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'OOPS! THEY REACHED THE MOON WITHOUT A CAMERA' : '¡UPS! LLEGARON A LA LUNA SIN CÁMARA',
        ribbonText: en
          ? 'We only have a boring report: the expedition performs tasks without taking photos'
          : 'Solo tenemos un informe aburrido: la expedición realiza tareas sin tomar fotos',
        leftTopTitle: en ? 'Five days of exploration' : 'Cinco días de exploración',
        leftTopBody: en
          ? `The MK11 mission spent ${days} days on the Moon taking scientific measurements under ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² gravity (they forgot the camera).`
          : `La misión MK11 permaneció ${days} días en la Luna realizando mediciones científicas bajo gravedad de ${REAL_LUNAR_PHYSICS.moonGravityMs2} m/s² (se olvidaron la cámara).`,
        leftBottomTitle: en ? 'Handwritten records' : 'Registros escritos a mano',
        leftBottomBody: en
          ? 'Without photographs of the lunar surface, the crew logged every observation in an extensive technical report sent via telemetry.'
          : 'Sin fotografías de la superficie lunar, la tripulación anotó cada observación en un extenso informe técnico enviado por telemetría.',
        centerLead: en
          ? `The expedition arrives and completes other tasks, but cannot take photos. Jeremy, Victor, Reid, and Christina gathered ${science.toFixed(0)} science pts on the surface (they forgot the camera).`
          : `La expedición llega y realiza otras tareas, pero no puede tomar fotos. Jeremy, Víctor, Reid y Christina recolectaron ${science.toFixed(0)} pts de ciencia en la superficie (se olvidaron la cámara).`,
        centerSecondaryLead: en
          ? 'According to the habitability verdict, the Moon lacks a breathable atmosphere and requires sealed bases for any future stay.'
          : 'Según el veredicto de habitabilidad, la Luna carece de atmósfera respirable y requiere bases selladas para cualquier futura estadía.',
        centerPullQuote: en
          ? '“Oops! They reached the Moon without a camera: we only have a boring report (they forgot the camera).”'
          : '“¡Ups! Llegaron a la Luna sin cámara: solo tenemos un informe aburrido (se olvidaron la cámara).”',
        centerSubColTitle: en ? 'No Moon images in archive' : 'Sin imágenes de la Luna en archivo',
        centerSubColBody: en
          ? 'For the first time on an expedition of this scope, presses run the story without lunar photographs after leaving the Hasselblad Camera behind before liftoff.'
          : 'Por primera vez en una expedición de este alcance, las rotativas publican la crónica sin fotografías lunares tras olvidarse la Cámara Hasselblad antes del despegue.',
        rightTitle: en ? 'Next mission will check the manifest' : 'Próxima misión revisará la lista',
        rightBody: en
          ? 'The agency announced extra payload checklist inspections to ensure the camera is packed for the next flight.'
          : 'La agencia anunció controles adicionales en la lista de carga para garantizar que la cámara forme parte del equipo en el próximo vuelo.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Ground tracking antenna' : 'Antena de seguimiento en tierra',
        footerItems: en
          ? [
              'A SAFE AND SUCCESSFUL RETURN',
              'WRITTEN REPORT WITHOUT LUNAR PHOTOS',
              'THEY FORGOT THE CAMERA',
            ]
          : [
              'UN RETORNO SEGURO Y EXITOSO',
              'INFORME ESCRITO SIN FOTOS LUNARES',
              'SE OLVIDARON LA CÁMARA',
            ],
      };

    // Edition #2: LA LUNA SALE HERMOSA EN LAS FOTOS
    case 'sin_instrumentos':
      return {
        issueNumber: en ? 'No. 10,428' : 'N.º 10.428',
        dateLine: en ? 'TUESDAY, JANUARY 21, 2058' : 'MARTES, 21 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'THE MOON LOOKS GORGEOUS IN THE PHOTOS' : 'LA LUNA SALE HERMOSA EN LAS FOTOS',
        ribbonText: en ? 'The science data, not so much' : 'Los datos científicos, no tanto',
        leftTopTitle: en ? 'Moon photos for the archive' : 'Fotos lunares para el archivo',
        leftTopBody: en
          ? 'The MK11 mission delivered a valuable photographic record of the Moon. The sharp, detailed images capture craters, terrain relief, and the vast lunar landscape in quality that exceeded agency expectations.'
          : 'La misión del MK11 entregó un valioso registro fotográfico de la Luna. Las imágenes, de gran nitidez y detalle, muestran el relieve, los cráteres y la inmensidad del paisaje lunar con una calidad que superó las expectativas de la agencia.',
        leftBottomTitle: en ? 'Pending measurements' : 'Mediciones pendientes',
        leftBottomBody: en
          ? 'Without scientific instruments aboard, the crew could not gather useful measurements of terrain conditions such as soil composition, temperature, radiation, or other elements of interest.'
          : 'Sin instrumentos científicos a bordo, la tripulación no pudo obtener mediciones útiles de las condiciones del terreno, como la composición del suelo, la temperatura, la radiación o la presencia de otros elementos de interés.',
        centerLead: en
          ? `The MK11 crew returned with spectacular photographs after ${days} days on the Moon. Without scientific instruments aboard, they could not obtain useful ground measurements.`
          : `La tripulación del MK11 regresó con fotografías espectaculares tras ${days} días en la Luna. Sin instrumentos científicos a bordo, no pudieron obtener mediciones útiles de las condiciones del terreno.`,
        centerSecondaryLead: en
          ? 'The mission left unforgettable images and an important lesson for the next expedition: check the equipment list.'
          : 'La misión dejó imágenes memorables y una importante lección para la próxima expedición: revisar la lista de equipo.',
        centerImg: IMG.lunaFotos,
        centerAlt: en
          ? 'MK11 photograph of lunar crater with Earth and lower filmstrip of lunar views'
          : 'Fotografía MK11 del cráter lunar con la Tierra y tira inferior de vistas lunares',
        rightTitle: en ? 'Next mission will carry instruments' : 'Próxima misión llevará instrumentos',
        rightBody: en
          ? 'The agency confirmed the next lunar expedition will include the scientific instruments needed for full terrain measurements—combining MK11’s photographic success with the missing science data.'
          : 'La agencia confirmó que la próxima expedición a la Luna incluirá los instrumentos científicos necesarios para realizar mediciones completas del terreno. El objetivo es aprovechar la eficacia del registro fotográfico del MK11 y sumar los datos científicos que faltaron.',
        rightNote: combinedHint || undefined,
        footerItems: en
          ? [
              'STUNNING MOON IMAGES',
              'NO SCIENTIFIC MEASUREMENTS',
              'A VALUABLE LESSON',
              'BETTER PREP FOR THE NEXT MISSION',
            ]
          : [
              'GRANDES IMÁGENES DE LA LUNA',
              'SIN MEDICIONES CIENTÍFICAS',
              'UNA LECCIÓN VALIOSA',
              'MÁS PREPARACIÓN PARA LA PRÓXIMA MISIÓN',
            ],
      };

    // Edition #3: VISITA LUNAR EXPRÉS
    case 'sin_equipo_suficiente':
      return {
        issueNumber: en ? 'No. 10,436' : 'N.º 10.436',
        dateLine: en ? 'TUESDAY, JANUARY 21, 2058' : 'MARTES, 21 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'EXPRESS LUNAR VISIT' : 'VISITA LUNAR EXPRÉS',
        ribbonText: en ? 'The crew forgot half the checklist' : 'El equipo olvidó la mitad de la lista',
        leftTopTitle: en ? 'Unfinished tasks' : 'Tareas pendientes',
        leftTopBody: en
          ? noCamNote
            ? 'The crew completed part of the plan, though they could not capture images (they forgot the camera). Several tasks went undone due to lack of time and specialized equipment.'
            : 'The crew completed a major part of the plan, including ground measurements and surface logging. However, several tasks went undone due to lack of time and specialized equipment.'
          : noCamNote
            ? 'La tripulación completó una parte del plan, aunque no pudo registrar imágenes (se olvidaron la cámara). Varias tareas quedaron sin realizar debido a la falta de tiempo y de equipo especializado.'
            : 'La tripulación completó una parte importante del plan, incluyendo mediciones del terreno y registro de la superficie. Sin embargo, varias tareas quedaron sin realizar debido a la falta de tiempo y de equipo especializado.',
        leftBottomTitle: en ? 'Supplies exhausted' : 'Suministros agotados',
        leftBottomBody: en
          ? 'Supplies ran out sooner than expected, limiting mission scope. The expedition kept safety a priority at all times and returned under the contingency plan.'
          : 'Los suministros se consumieron antes de lo previsto, limitando el alcance de la misión. La expedición mantuvo la seguridad en todo momento y decidió regresar según el plan de contingencia.',
        centerLead: en
          ? 'The MK11 expedition reached the Moon, but a shortage of supplies and equipment forced the crew to cut their activities short.'
          : 'La expedición MK11 llegó a la Luna, pero la falta de suministros y equipo obligó a la tripulación a acortar sus actividades.',
        centerSecondaryLead: en
          ? `Some tasks remain for a future visit. The team returned safe and sound, carrying a long list of things not to forget${noCamNote ? ' (they forgot the camera).' : '.'}`
          : `Algunas tareas quedaron pendientes para una próxima visita. El equipo regresó sano y salvo, con una lista larga de cosas que no deben olvidar${noCamNote ? ' (se olvidaron la cámara)' : '.'}`,
        centerPullQuote: en
          ? '“Express lunar visit: the crew forgot half the checklist.”'
          : '“Visita lunar exprés: el equipo olvidó la mitad de la lista.”',
        centerImg: IMG.visitaLunar,
        centerAlt: en
          ? 'MK11 module on the lunar surface beside open supply trunk and mission checklist'
          : 'Módulo MK11 en superficie lunar junto al baúl abierto y la lista de misión',
        rightTitle: en ? 'Next mission will pack a fuller manifest' : 'La próxima misión llevará una lista más completa',
        rightBody: en
          ? 'The space agency confirmed a new lunar expedition is in the works with more time, gear, and supplies to finish pending tasks and build on MK11’s experience.'
          : 'La agencia espacial confirmó que se prepara una nueva expedición a la Luna, con más tiempo, equipo y suministros. El objetivo es completar las tareas pendientes y aprovechar la experiencia obtenida por el MK11 para lograr una misión más completa y eficiente.',
        rightNote: combinedHint || undefined,
        footerItems: en
          ? [
              'REACHED THE MOON',
              'TASKS PARTIALLY COMPLETED',
              'SAFE RETURN',
              'MORE GEAR NEXT MISSION',
              'INSUFFICIENT EQUIPMENT',
            ]
          : [
              'LLEGÓ A LA LUNA',
              'TAREAS PARCIALMENTE COMPLETADAS',
              'REGRESO SEGURO',
              'MÁS EQUIPO EN LA PRÓXIMA MISIÓN',
              'SIN EQUIPO SUFICIENTE',
            ],
      };

    case 'regreso_emergencia':
      return {
        issueNumber: en ? 'No. 10,429' : 'N.º 10.429',
        dateLine: en ? 'FRIDAY, JANUARY 24, 2058' : 'VIERNES, 24 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'TENSE RETURN' : 'REGRESO CON TENSIÓN',
        ribbonText: en
          ? 'Crew overcomes malfunction and makes it home'
          : 'La tripulación supera una avería y vuelve a casa',
        leftTopTitle: en ? 'Emergency overcome' : 'Emergencia superada',
        leftTopBody: en
          ? 'The crew had to rewire circuits on the surface and flip the engine ignition switch before leaving lunar orbit.'
          : 'La tripulación debió reconectar circuitos en superficie y accionar el interruptor del motor antes de abandonar la órbita lunar.',
        leftTopImg: showMoonPhotos ? IMG.crater : undefined,
        leftTopAlt: en ? 'Lunar surface where the crew operated' : 'Superficie lunar donde operó la tripulación',
        leftBottomTitle: en ? 'Samples recovered' : 'Muestras recuperadas',
        leftBottomBody: en
          ? showMoonPhotos
            ? 'Despite electrical strain and solar storms, they saved lunar samples and photographs for science.'
            : 'They returned alive with detailed scientific notes.'
          : showMoonPhotos
            ? 'Pese a la tensión eléctrica y tormentas solares, salvaron muestras y fotografías lunares para la ciencia.'
            : 'Regresaron con vida y anotaciones científicas detalladas.',
        leftBottomImg: showMoonPhotos ? IMG.rock : undefined,
        leftBottomAlt: en ? 'Recovered lunar sample' : 'Muestra lunar recuperada',
        centerLead: en
          ? `The spacecraft suffered an en-route malfunction, but Jeremy, Victor, Reid, and Christina resolved the contingency after ${days} days in space and splashed down safely in the Pacific.`
          : `La nave sufrió una avería en ruta, pero Jeremy, Víctor, Reid y Christina resolvieron la contingencia tras ${days} días en el espacio y amerizaron a salvo en el Pacífico.`,
        centerPullQuote: en
          ? '“Tense return: crew overcomes malfunction and makes it home.”'
          : '“Regreso con tensión: la tripulación supera una avería y vuelve a casa.”',
        centerImg: IMG.flight,
        centerAlt: en ? 'MK11 spacecraft returning from the Moon to Earth' : 'Nave MK11 regresando de la Luna hacia la Tierra',
        rightTitle: en ? 'Upgrades recommended' : 'Refuerzos recomendados',
        rightBody: en
          ? 'Engineering is evaluating redundant antennas, batteries, and thermal shielding to prevent electrical incidents on the next flight.'
          : 'Ingeniería evalúa duplicar antenas, baterías y blindaje térmico para evitar incidentes eléctricos en el próximo vuelo.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Ground tracking station' : 'Estación de seguimiento en tierra',
        footerItems: en
          ? [
              'HEROIC SAFE RETURN',
              'MALFUNCTION RESOLVED EN ROUTE',
              'MK11 MISSION ACCOMPLISHED',
            ]
          : [
              'HEROICO REGRESO CON VIDA',
              'AVERÍA SUPERADA EN RUTA',
              'MISIÓN MK11 CUMPLIDA',
            ],
      };

    case 'aterrizaje_fallido':
      return {
        issueNumber: en ? 'No. 10,430' : 'N.º 10.430',
        dateLine: en ? 'THURSDAY, JANUARY 23, 2058' : 'JUEVES, 23 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'MK-11 REACHED THE MOON…' : 'MK-11 LLEGÓ A LA LUNA…',
        ribbonText: en
          ? 'But could not find a place to park and had to abort landing'
          : 'Pero no encontró dónde estacionarse y debió abortar el alunizaje',
        leftTopTitle: en ? 'Descent aborted' : 'Descenso abortado',
        leftTopBody: en
          ? 'Without a working AGC guidance computer on approach, the crew could not land safely and aborted surface exploration.'
          : 'Sin computadora de guía AGC operativa en la aproximación, la tripulación no pudo aterrizar con seguridad y abortó la exploración.',
        leftBottomTitle: en ? 'Safe orbital return' : 'Retorno orbital seguro',
        leftBottomBody: en
          ? 'With resources remaining in the main module, the crew executed the return burn toward Earth.'
          : 'Con recursos disponibles en el módulo principal, el equipo ejecutó la maniobra de regreso hacia la Tierra.',
        centerLead: en
          ? 'The MK11 expedition reached lunar orbit after crossing cislunar space, but had to cancel descent without automatic guidance.'
          : 'La expedición MK11 alcanzó la órbita lunar tras cruzar el espacio cislunar, pero debió cancelar el descenso al no contar con guía automática.',
        centerPullQuote: en
          ? '“MK-11 reached the Moon… but could not find a place to park.”'
          : '“MK-11 llegó a la Luna… pero no encontró dónde estacionarse.”',
        centerImg: IMG.flight,
        centerAlt: en ? 'MK11 spacecraft flying over the Moon before returning' : 'Nave MK11 sobrevolando la Luna antes de regresar',
        rightTitle: en ? 'Guidance & control review' : 'Revisión de guía y control',
        rightBody: en
          ? 'Engineers confirmed the need to install an AGC Computer before the next launch.'
          : 'Los ingenieros confirmaron la necesidad de incorporar una Computadora AGC antes del próximo lanzamiento.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Ground tracking station' : 'Estación de seguimiento en tierra',
        footerItems: en
          ? [
              'LANDING ABORTED IN ORBIT',
              'CREW RETURNED ALIVE',
              'MISSING AGC COMPUTER',
            ]
          : [
              'ATERRIZAJE ABORTADO EN ÓRBITA',
              'TRIPULACIÓN REGRESÓ CON VIDA',
              'FALTÓ COMPUTADORA AGC',
            ],
      };

    case 'sin_combustible_salir_luna':
      return {
        issueNumber: en ? 'No. 10,431' : 'N.º 10.431',
        dateLine: en ? 'THURSDAY, JANUARY 23, 2058' : 'JUEVES, 23 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'EXPEDITION REACHED THE MOON' : 'LA EXPEDICIÓN LLEGÓ A LA LUNA',
        ribbonText: en
          ? 'But could not lift off again due to lack of fuel'
          : 'Pero no pudo volver a despegar por falta de combustible',
        leftTopTitle: en ? 'Stranded on the surface' : 'Varados en superficie',
        leftTopBody: en
          ? 'The descent module completed landing in the Sea of Tranquility, but depleted its reserves attempting to ignite the ascent stage.'
          : 'El módulo de descenso completó la llegada al Mar de la Tranquilidad, pero agotó sus reservas al intentar encender la etapa de ascenso.',
        leftBottomTitle: en ? 'Last signal on Earth' : 'Última señal en Tierra',
        leftBottomBody: en
          ? 'Tracking stations received telemetry from the liftoff attempt before confirming propellant exhaustion.'
          : 'Las estaciones de seguimiento recibieron la telemetría del intento de despegue antes de confirmarse la falta de propelente.',
        centerLead: en
          ? `The expedition touched down on the Moon on day ${days}, but the module could not lift off and the crew remained stranded on the lunar surface.`
          : `La expedición logró posarse en la Luna durante el día ${days}, pero el módulo no pudo despegar y la tripulación quedó varada en la superficie lunar.`,
        centerPullQuote: en
          ? '“The expedition reached the Moon, but could not lift off again.”'
          : '“La expedición llegó a la Luna, pero no pudo volver a despegar.”',
        centerImg: IMG.visitaLunar,
        centerAlt: en ? 'MK11 module resting on the lunar surface' : 'Módulo MK11 posado sobre la superficie lunar',
        rightTitle: en ? 'Propulsion under review' : 'Propulsión bajo análisis',
        rightBody: en
          ? 'Mission Control will review ΔV fuel margins and the number of tanks required for lunar ascent and return.'
          : 'Control de Misión revisará los márgenes de combustible ΔV y el número de tanques necesarios para el ascenso y retorno.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Antenna listening to the final lunar transmission' : 'Antena escuchando la última transmisión lunar',
        footerItems: en
          ? [
              'MODULE STRANDED ON THE MOON',
              'NO PROPELLANT FOR ASCENT',
              'CHECK TANKS IN DESIGN',
            ]
          : [
              'MÓDULO VARADO EN LA LUNA',
              'SIN PROPELENTE PARA ASCENSO',
              'REVISA TANQUES EN DISEÑO',
            ],
      };

    case 'sin_combustible_regreso':
      return {
        issueNumber: en ? 'No. 10,432' : 'N.º 10.432',
        dateLine: en ? 'FRIDAY, JANUARY 24, 2058' : 'VIERNES, 24 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'MK-11 LOSES CONTACT' : 'MK-11 PIERDE CONTACTO',
        ribbonText: en
          ? 'Out of fuel during return; crew did not come back'
          : 'Sin combustible durante el regreso; la tripulación no volvió',
        leftTopTitle: en ? 'Silence en route' : 'Silencio en ruta',
        leftTopBody: en
          ? 'After leaving lunar orbit, the vehicle burned all remaining propellant before completing the return burn toward the Pacific.'
          : 'Tras abandonar la órbita lunar, el vehículo consumió todo el propelente antes de completar la maniobra de retorno hacia el Pacífico.',
        leftBottomTitle: en ? 'Tracking lost' : 'Rastreo interrumpido',
        leftBottomBody: en
          ? 'Ground stations kept listening while the spacecraft drifted in deep space.'
          : 'Las estaciones terrestres mantuvieron la escucha activa mientras la nave quedó a la deriva en espacio profundo.',
        centerLead: en
          ? `The spacecraft drifted during the return phase and the crew failed to reach Earth after transmitting ${science.toFixed(0)} science pts.`
          : `La nave quedó a la deriva durante la fase de retorno y la tripulación no logró regresar a la Tierra tras transmitir ${science.toFixed(0)} pts científicos.`,
        centerPullQuote: en
          ? '“MK-11 loses contact during return; the crew did not come back.”'
          : '“MK-11 pierde contacto durante el regreso; la tripulación no volvió.”',
        centerImg: IMG.flight,
        centerAlt: en ? 'MK11 spacecraft between Earth and the Moon' : 'Nave MK11 en la trayectoria entre la Tierra y la Luna',
        rightTitle: en ? 'Trip reserve adjustment' : 'Ajuste de reservas de viaje',
        rightBody: en
          ? 'The technical commission requires adding enough propellant tanks to cover both lunar ascent and full Earth return.'
          : 'La comisión técnica exige añadir tanques de propelente suficientes para cubrir tanto el ascenso lunar como el retorno completo.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Deep-space tracking station' : 'Estación de rastreo profundo',
        footerItems: en
          ? [
              'CRAFT ADRIFT ON RETURN',
              'CONTACT LOST WITH MK11',
              'ADD PROPELLANT FOR RETURN',
            ]
          : [
              'NAVE A LA DERIVA EN REGRESO',
              'PÉRDIDA DE CONTACTO CON MK11',
              'AÑADE PROPELENTE PARA RETORNO',
            ],
      };

    case 'fallo_grave_despegue_luna':
      return {
        issueNumber: en ? 'No. 10,433' : 'N.º 10.433',
        dateLine: en ? 'THURSDAY, JANUARY 23, 2058' : 'JUEVES, 23 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'MISSION FAILED' : 'MISIÓN FALLIDA',
        ribbonText: en
          ? isOrbitalTest
            ? `A structural or guidance failure prevents completing the ${missionCode} test`
            : 'A liftoff failure prevents completing the expedition'
          : isOrbitalTest
            ? `Un fallo estructural o de guía impide completar la prueba ${missionCode}`
            : 'Un fallo durante el despegue impide completar la expedición',
        leftTopTitle: en ? 'Ignition failure' : 'Fallo en el encendido',
        leftTopBody: en
          ? isOrbitalTest
            ? `The ${missionCode} capsule suffered a critical anomaly while stabilizing its orbital trajectory.`
            : 'The module suffered a critical failure igniting the ascent engines, failing to stabilize into lunar orbit.'
          : isOrbitalTest
            ? `La cápsula ${missionCode} sufrió una anomalía crítica al estabilizar la trayectoria orbital.`
            : 'El módulo sufrió una falla crítica al activar los motores de ascenso, impidiendo estabilizar la trayectoria hacia la órbita lunar.',
        leftBottomTitle: en ? 'Structural failure' : 'Falla estructural',
        leftBottomBody: en
          ? 'Incoming data shows missing reinforced structure or total loss of the flight control computer in flight.'
          : 'Los datos recibidos muestran ausencia de estructura reforzada o pérdida total de la computadora de control durante el vuelo.',
        centerLead: en
          ? isOrbitalTest
            ? `During the ${missionCode} orbital test, the vehicle lost structural stability or automatic guidance. Mission failed.`
            : `On day ${days} of operations, the module suffered a lunar liftoff failure without reaching return orbit. Mission failed.`
          : isOrbitalTest
            ? `Durante la prueba orbital ${missionCode}, el vehículo perdió estabilidad estructural o guía automática. Misión fallida.`
            : `En el día ${days} de operación, el módulo presentó un fallo durante el despegue lunar sin alcanzar la órbita de retorno. Misión fallida.`,
        centerPullQuote: en
          ? isOrbitalTest
            ? `“Mission failed: the ${missionCode} test flight could not hold orbit.”`
            : '“Mission failed: a liftoff failure prevents completing the expedition.”'
          : isOrbitalTest
            ? `“Misión fallida: el vuelo de prueba ${missionCode} no logró sostener la órbita.”`
            : '“Misión fallida: un fallo durante el despegue impide completar la expedición.”',
        centerImg: IMG.despegueAbortado,
        centerAlt: en
          ? `Critical ignition failure scene for ${missionCode}`
          : `Escena crítica del fallo de encendido ${missionCode}`,
        rightTitle: en ? 'Mandatory structural upgrade' : 'Refuerzo estructural obligatorio',
        rightBody: en
          ? 'The technical board ordered a review of the CSM Structure and securing an AGC Computer in Design.'
          : 'El comité técnico ordenó revisar la Estructura CSM y asegurar la Computadora AGC en Diseño.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Ground telemetry antenna' : 'Antena de telemetría terrestre',
        footerItems: en
          ? [
              `MISSION ${missionCode} FAILED`,
              'STRUCTURAL OR AGC FAILURE',
              'CHECK ROCKET DESIGN',
            ]
          : [
              `MISIÓN ${missionCode} FALLIDA`,
              'FALLA ESTRUCTURAL O DE AGC',
              'REVISAR DISEÑO DEL COHETE',
            ],
      };

    case 'averia_mortal_viaje':
    default:
      return {
        issueNumber: en ? 'No. 10,434' : 'N.º 10.434',
        dateLine: en ? 'FRIDAY, JANUARY 24, 2058' : 'VIERNES, 24 DE ENERO DE 2058',
        editionBadge: en ? 'SPECIAL EDITION' : 'EDICIÓN ESPECIAL',
        headline: en ? 'MISSION FAILED' : 'MISIÓN FALLIDA',
        ribbonText: en
          ? isOrbitalTest
            ? `Mission ${missionCode} failed due to power deficit during orbital test`
            : 'Mission failed due to critical breakdown on the return trip'
          : isOrbitalTest
            ? `Misión ${missionCode} fallida por déficit eléctrico durante la prueba orbital`
            : 'Misión fallida por avería crítica durante el viaje de vuelta',
        leftTopTitle: en ? 'Systems collapse' : 'Colapso de sistemas',
        leftTopBody: en
          ? 'Electrical generation proved insufficient for onboard consumption and reserves were depleted in transit.'
          : 'La generación eléctrica resultó insuficiente frente al consumo de a bordo y las reservas se agotaron durante el trayecto.',
        leftBottomTitle: en ? 'No link on Earth' : 'Sin enlace en Tierra',
        leftBottomBody: en
          ? 'Mission Control tried to restore contact from ground antennas without response.'
          : 'Control de Misión intentó restablecer comunicación desde las antenas terrestres sin obtener respuesta.',
        centerLead: en
          ? isOrbitalTest
            ? `The ${missionCode} capsule ran out of electrical power during the orbital test due to insufficient solar generation or batteries. Mission failed.`
            : 'The spacecraft suffered an irreparable power and life-support failure during return. Mission failed.'
          : isOrbitalTest
            ? `La cápsula ${missionCode} agotó su energía eléctrica durante la prueba orbital por generación solar o baterías insuficientes. Misión fallida.`
            : 'La nave sufrió una avería irreparable en el sistema eléctrico y de soporte vital durante el regreso. Misión fallida.',
        centerPullQuote: en
          ? isOrbitalTest
            ? `“Mission failed: the ${missionCode} test lost electrical power.”`
            : `“Mission failed: the ${missionCode} expedition could not complete return.”`
          : isOrbitalTest
            ? `“Misión fallida: la prueba ${missionCode} quedó sin suministro eléctrico.”`
            : `“Misión fallida: la expedición ${missionCode} no logró completar el retorno.”`,
        centerImg: IMG.flight,
        centerAlt: en
          ? `Spacecraft ${missionCode} on space trajectory`
          : `Nave ${missionCode} en trayectoria espacial`,
        rightTitle: en ? 'Power balance in Design' : 'Balance eléctrico en Diseño',
        rightBody: en
          ? isOrbitalTest
            ? 'Install enough Solar Panels (and Batteries in Level 2+) to cover onboard consumption.'
            : 'We recommend installing enough solar panels, RTG generator, and lunar batteries to survive the lunar shadow.'
          : isOrbitalTest
            ? 'Instala suficientes Paneles solares (y Baterías en Nivel 2+) para cubrir el consumo de a bordo.'
            : 'Se recomienda instalar paneles solares, generador RTG y baterías lunares suficientes para superar la sombra lunar.',
        rightNote: combinedHint || undefined,
        rightImg: IMG.dish,
        rightAlt: en ? 'Antenna trying to restore link' : 'Antena intentando recuperar enlace',
        footerItems: en
          ? [
              'MISSION FAILED DUE TO POWER',
              'ELECTRICAL DEFICIT IN ORBIT',
              'CHECK PANELS AND BATTERIES',
            ]
          : [
              'MISIÓN FALLIDA POR ENERGÍA',
              'DÉFICIT ELÉCTRICO EN ÓRBITA',
              'REVISAR PANELES Y BATERÍAS',
            ],
      };
  }
}

export const ElDiarioGlobalPaper: React.FC<ElDiarioGlobalProps> = (props) => {
  const { compact = false } = props;
  const { lang: ctxLang } = useLanguage();
  const lang = props.lang ?? ctxLang;
  const en = lang === 'en';
  const ed = useMemo(() => buildEditionContent({ ...props, lang }), [props, lang]);
  const inkHeaderBg = '#132638';

  return (
    <div
      className={`w-full bg-[#f3e7ca] text-[#13202f] border-[3px] border-[#13202f] shadow-[0_22px_65px_rgba(0,0,0,0.75)] relative flex flex-col ${
        compact ? 'p-3 md:p-4' : 'p-4 md:p-6'
      }`}
    >
      {/* Inner vintage hairline */}
      <div className="border border-[#13202f]/45 p-2.5 md:p-4 flex flex-col flex-1 min-h-0">
        {/* Top Masthead with flanking horizontal ink bars and laurel wreaths */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden sm:flex flex-1 flex-col gap-[4px]">
            <div className="h-[3px] bg-[#132638]" />
            <div className="h-[2.5px] mx-2 bg-[#132638]" />
            <div className="h-[2px] mx-4 bg-[#132638]" />
          </div>
          <div className="flex items-center gap-2 mx-auto">
            <LaurelWreathSvg />
            <h1
              className={`font-serif font-black tracking-tight uppercase leading-none ${
                compact ? 'text-2xl md:text-4xl' : 'text-3xl md:text-5xl'
              }`}
              style={{ color: '#0f1e2e' }}
            >
              EL DIARIO GLOBAL
            </h1>
            <LaurelWreathSvg flip />
          </div>
          <div className="hidden sm:flex flex-1 flex-col gap-[4px]">
            <div className="h-[3px] bg-[#132638]" />
            <div className="h-[2.5px] mx-2 bg-[#132638]" />
            <div className="h-[2px] mx-4 bg-[#132638]" />
          </div>
        </div>

        {/* Metadata bar */}
        <div className="mt-1.5 border-y-2 border-[#13202f] py-1 px-1 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-[10px] md:text-[11px] font-bold tracking-wider uppercase text-[#13202f]">
          <span>
            {en ? 'YEAR XXXIV' : 'AÑO XXXIV'} • {ed.issueNumber}
          </span>
          <span className="hidden lg:inline text-[#1f2f40]">
            {en ? 'SCIENCE & SPACE EXPLORATION NEWS' : 'NOTICIAS DE CIENCIA Y EXPLORACIÓN ESPACIAL'}
          </span>
          <span className="hidden md:inline text-[#1f2f40]">{ed.dateLine}</span>
          <span>{ed.editionBadge}</span>
        </div>

        {/* Main Monumental Headline */}
        <div className="py-1.5 md:py-2 text-center">
          <h2
            className={`font-serif font-black uppercase tracking-tight leading-[1.02] text-[#0f1e2e] ${
              compact ? 'text-xl md:text-3xl' : 'text-2xl md:text-[42px]'
            }`}
          >
            {ed.headline}
          </h2>
        </div>

        {/* Chevron Dark Navy Ribbon Subtitle */}
        <div className="relative flex items-center justify-center my-1">
          <div
            className="w-full py-1 px-6 text-center font-serif italic font-bold text-xs md:text-base text-[#f7eed7] tracking-wide"
            style={{
              backgroundColor: inkHeaderBg,
              clipPath:
                'polygon(0 0, 100% 0, 98.4% 50%, 100% 100%, 0 100%, 1.6% 50%)',
            }}
          >
            {ed.ribbonText}
          </div>
        </div>

        {/* 3-Column Broadsheet Grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-2.5 flex-1 min-h-0 ${
            compact ? 'text-xs' : 'text-xs md:text-[13px]'
          }`}
        >
          {/* Left Column */}
          <div className="md:col-span-3 flex flex-col gap-3 md:border-r md:border-[#13202f]/40 md:pr-3">
            <div>
              <div
                className="px-2 py-1 font-serif italic font-bold text-[#f7eed7] text-xs md:text-sm leading-tight"
                style={{ backgroundColor: inkHeaderBg }}
              >
                {ed.leftTopTitle}
              </div>
              <div className="mt-1.5 flex gap-2 items-start">
                <p className="font-serif leading-snug text-[#1c2633] flex-1">
                  {ed.leftTopBody}
                </p>
                {ed.leftTopImg && (
                  <img
                    src={ed.leftTopImg}
                    alt={ed.leftTopAlt ?? ''}
                    className="w-20 h-20 object-cover border-2 border-[#13202f] shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
              </div>
            </div>

            <div className="border-t border-[#13202f]/30 pt-2">
              <div
                className="px-2 py-1 font-serif italic font-bold text-[#f7eed7] text-xs md:text-sm leading-tight"
                style={{ backgroundColor: inkHeaderBg }}
              >
                {ed.leftBottomTitle}
              </div>
              <div className="mt-1.5 flex gap-2 items-start">
                <p className="font-serif leading-snug text-[#1c2633] flex-1">
                  {ed.leftBottomBody}
                </p>
                {ed.leftBottomImg && (
                  <img
                    src={ed.leftBottomImg}
                    alt={ed.leftBottomAlt ?? ''}
                    className="w-20 h-20 object-cover border-2 border-[#13202f] shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Center Column */}
          <div className="md:col-span-6 flex flex-col justify-center gap-2.5 md:border-r md:border-[#13202f]/40 md:pr-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
              <div
                className={`${
                  ed.centerImg || ed.centerSubColBody ? 'sm:col-span-5' : 'sm:col-span-12'
                } flex flex-col justify-between gap-2`}
              >
                <div className="space-y-2">
                  <p className="font-serif font-semibold text-[#131d29] leading-snug text-xs md:text-[13.5px]">
                    {ed.centerLead}
                  </p>
                  {ed.centerSecondaryLead && (
                    <p className="font-serif font-medium text-[#1c2633] leading-snug text-xs md:text-[13px]">
                      {ed.centerSecondaryLead}
                    </p>
                  )}
                </div>
                {ed.centerPullQuote && (
                  <div className="bg-[#eee0bc] border border-[#13202f] px-2.5 py-2 font-serif italic font-bold text-[#111c2b] leading-snug text-xs md:text-[13px]">
                    {ed.centerPullQuote}
                  </div>
                )}
              </div>

              {ed.centerImg ? (
                <div className="sm:col-span-7 flex flex-col justify-center">
                  <div className="border-2 border-[#13202f] bg-[#efe1be] overflow-hidden flex items-center justify-center">
                    <img
                      src={ed.centerImg}
                      alt={ed.centerAlt ?? ''}
                      className="w-full max-h-[280px] object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                </div>
              ) : (
                ed.centerSubColBody && (
                  <div className="sm:col-span-7 bg-[#eee0bc] border border-[#13202f]/60 p-3 flex flex-col justify-center">
                    <div className="font-serif font-bold text-xs text-[#0f1e2e] border-b border-[#13202f]/35 pb-1 mb-1.5">
                      {ed.centerSubColTitle}
                    </div>
                    <p className="font-serif leading-snug text-[#1c2633]">
                      {ed.centerSubColBody}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="md:col-span-3 flex flex-col justify-between gap-2">
            <div className="space-y-1.5">
              <div
                className="px-2 py-1 font-serif italic font-bold text-[#f7eed7] text-xs md:text-sm leading-tight"
                style={{ backgroundColor: inkHeaderBg }}
              >
                {ed.rightTitle}
              </div>
              <p className="font-serif leading-snug text-[#1c2633] pt-0.5">
                {ed.rightBody}
              </p>
              {ed.rightNote && (
                <p className="font-serif italic leading-snug text-[#2b3b4e] text-[11.5px] border-t border-[#13202f]/25 pt-1">
                  {ed.rightNote}
                </p>
              )}
            </div>
            {ed.rightImg && (
              <div className="border-2 border-[#13202f] bg-[#efe1be] overflow-hidden h-24 md:h-28">
                <img
                  src={ed.rightImg}
                  alt={ed.rightAlt ?? ''}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Chevron News Ticker */}
        <div className="mt-2.5 pt-1.5 border-t-2 border-[#13202f] flex flex-wrap items-center justify-around gap-x-2 gap-y-1 font-serif font-bold text-[10px] md:text-xs tracking-wide uppercase text-[#132638]">
          {ed.footerItems.map((item, i) => (
            <span key={item} className="flex items-center gap-1.5">
              {i === 0 && <span className="text-amber-700 font-black">»</span>}
              <span>{item}</span>
              {i < ed.footerItems.length - 1 && (
                <span className="hidden md:inline text-[#13202f]/40 ml-1.5">|</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ScoreAxisItem {
  label: string;
  shortLabel: string;
  earned: number;
  max: number;
  detail: string;
}

function parseScoreAxes(
  scoreLines: string[] | undefined,
  science: number,
  totalScore: number,
  survived: boolean,
  lang: Language = 'es'
): ScoreAxisItem[] {
  const en = lang === 'en';
  const findVal = (regex: RegExp, fallbackEarned: number, max: number) => {
    const line = scoreLines?.find((l) => regex.test(l));
    if (!line) return { earned: fallbackEarned, detail: `${fallbackEarned.toFixed(1)} / ${max}` };
    const m =
      line.match(/\+(\d+(?:\.\d+)?)\s*(?:de|of)\s*(\d+)/i) || line.match(/\+(\d+(?:\.\d+)?)/);
    const pct = line.match(/(?:margen|margin)\s*(\d+%)/i)?.[1];
    const earned = m ? parseFloat(m[1]) : fallbackEarned;
    return {
      earned,
      detail: pct ? `${en ? 'Margin' : 'Margen'} ${pct}` : `${earned.toFixed(1)} / ${max}`,
    };
  };

  const crewEarned = survived ? 40 : 0;
  const rem = Math.max(0, totalScore - crewEarned);
  const sciObj = findVal(/(?:Información científica|Scientific data)/i, Math.min(20, rem * 0.35), 20);
  const massObj = findVal(/(?:Masa del lanzador|Launcher mass)/i, Math.min(10, rem * 0.16), 10);
  const dvObj = findVal(/(?:ΔV translunar|Translunar ΔV)/i, Math.min(10, rem * 0.17), 10);
  const costObj = findVal(/(?:Presupuesto|Budget)/i, Math.min(10, rem * 0.16), 10);
  const batObj = findVal(/(?:Batería|Battery)/i, Math.min(10, rem * 0.16), 10);

  return [
    {
      label: en ? 'Crew return' : 'Retorno de la tripulación',
      shortLabel: en ? 'Return' : 'Retorno',
      earned: crewEarned,
      max: 40,
      detail: survived
        ? en
          ? 'Safe in the Pacific'
          : 'A salvo en el Pacífico'
        : en
          ? 'Did not return'
          : 'No regresaron',
    },
    {
      label: en ? 'Scientific data' : 'Información científica',
      shortLabel: en ? 'Science' : 'Ciencia',
      earned: sciObj.earned,
      max: 20,
      detail: `${science.toFixed(0)} ${en ? 'pts delivered' : 'pts entregados'}`,
    },
    {
      label: en ? 'Mass efficiency' : 'Eficiencia de masa',
      shortLabel: en ? 'Mass' : 'Masa',
      earned: massObj.earned,
      max: 10,
      detail: massObj.detail,
    },
    {
      label: en ? 'Translunar ΔV margin' : 'Margen ΔV translunar',
      shortLabel: 'ΔV',
      earned: dvObj.earned,
      max: 10,
      detail: dvObj.detail,
    },
    {
      label: en ? 'Budget optimization' : 'Optimización de presupuesto',
      shortLabel: en ? 'Cost' : 'Costo',
      earned: costObj.earned,
      max: 10,
      detail: costObj.detail,
    },
    {
      label: en ? 'Eclipse power reserve' : 'Reserva energética en eclipse',
      shortLabel: en ? 'Power' : 'Energía',
      earned: batObj.earned,
      max: 10,
      detail: batObj.detail,
    },
  ];
}

function EngineeringRadarSvg({ axes }: { axes: ScoreAxisItem[] }) {
  const cx = 135;
  const cy = 120;
  const r = 82;
  const n = axes.length;

  const pointAt = (idx: number, frac: number) => {
    const ang = -Math.PI / 2 + (idx / n) * Math.PI * 2;
    return {
      x: cx + Math.cos(ang) * r * frac,
      y: cy + Math.sin(ang) * r * frac,
    };
  };

  const ringLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = axes.map((a, i) => pointAt(i, Math.max(0.08, Math.min(1, a.earned / a.max))));
  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox="0 0 270 245" className="w-full max-w-[260px] mx-auto select-none">
      {ringLevels.map((lvl) => {
        const pts = axes
          .map((_, i) => {
            const p = pointAt(i, lvl);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
        return (
          <polygon
            key={lvl}
            points={pts}
            fill="none"
            stroke="rgba(148, 163, 184, 0.18)"
            strokeWidth="1"
          />
        );
      })}
      {axes.map((_, i) => {
        const p = pointAt(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={dataPolygon}
        fill="rgba(56, 189, 248, 0.2)"
        stroke="#38bdf8"
        strokeWidth="2"
      />
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3.5"
          fill="#38bdf8"
          stroke="#07090e"
          strokeWidth="1.5"
        />
      ))}
      {axes.map((a, i) => {
        const lblPt = pointAt(i, 1.24);
        return (
          <text
            key={a.shortLabel}
            x={lblPt.x}
            y={lblPt.y + 3}
            textAnchor="middle"
            className="fill-slate-300 font-mono-tech text-[10px]"
          >
            {a.shortLabel}
          </text>
        );
      })}
    </svg>
  );
}

interface StoryEndingViewProps {
  mission: string;
  orbit: string;
  days: number;
  science: number;
  score: number;
  rating: string;
  hasCamera?: boolean;
  habitability?: string;
  endingMeta?: MissionEndingMeta | null;
  launchStageFailure?: boolean;
  launchAbortReason?: LaunchAbortReason | null;
  scoreLines?: string[];
  advice?: string;
  improvementHints?: string[];
  minScience?: number;
  levelInfo?: EndingLevelInfo;
  unlockedNextLevel?: ProgressionLevel | null;
  isFinalMissionSuccess?: boolean;
  isMuted?: boolean;
  masterVolume?: number;
  onAdvanceToNextLevel?: () => void;
  onEditDesign?: () => void;
  onFinished: (toMenu: boolean) => void;
}

const SPIN_SECONDS = 1.0;
const PAPER_TO_PARADE_SECONDS = 7.5;
const PARADE_FADE_SECONDS = 0.65;

export const StoryEndingView: React.FC<StoryEndingViewProps> = ({
  mission,
  orbit,
  days,
  science,
  score,
  rating,
  hasCamera = true,
  habitability,
  endingMeta,
  launchStageFailure = false,
  launchAbortReason = null,
  scoreLines,
  advice,
  improvementHints,
  minScience = 60,
  levelInfo,
  unlockedNextLevel,
  isFinalMissionSuccess = false,
  isMuted = false,
  masterVolume = 1,
  onAdvanceToNextLevel,
  onEditDesign,
  onFinished,
}) => {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const resolvedHabitability = habitability ?? getDefaultHabitability(en);

  const meta: MissionEndingMeta = endingMeta ?? {
    key: hasCamera ? 'exploracion_completa' : 'sin_camara',
    resultado: en
      ? hasCamera
        ? 'Complete exploration'
        : 'No camera'
      : hasCamera
        ? 'Exploración completa'
        : 'Sin cámara',
    queOcurre: en
      ? hasCamera
        ? 'They arrive with a camera, instruments, and supplies. They take photos and gather data on the Moon.'
        : 'The expedition arrives and performs other tasks, but cannot take photos.'
      : hasCamera
        ? 'Llegan con cámara, instrumentos y suministros. Fotografían y reúnen datos sobre la Luna.'
        : 'La expedición llega y realiza otras tareas, pero no puede tomar fotos.',
    titular: en
      ? hasCamera
        ? 'MK-11 makes history! The expedition brings back Moon photos and data.'
        : 'Oops! They reached the Moon without a camera: we only have a boring report.'
      : hasCamera
        ? '¡MK-11 hace historia! La expedición trae fotos y datos de la Luna.'
        : '¡Ups! Llegaron a la Luna sin cámara: solo tenemos un informe aburrido.',
    isFailure: false,
    survived: true,
    hasPhotos: hasCamera,
    landed: true,
    hint: '',
  };

  const isFinalSuccess =
    Boolean(isFinalMissionSuccess) ||
    Boolean(
      levelInfo?.isFinalLunar &&
        !meta.isFailure &&
        !launchStageFailure &&
        (meta.key === 'exploracion_completa' ||
          meta.key === 'regreso_emergencia' ||
          science >= minScience)
    );

  // Show the Scoring Screen BEFORE the victory newspaper on intermediate levels;
  // on the final mission success, show El Diario Global directly!
  const hasScoreFirst = !meta.isFailure && !launchStageFailure && !isFinalSuccess;
  const canInspectScore = !meta.isFailure && !launchStageFailure;
  const [phase, setPhase] = useState<'Score' | 'Paper' | 'Parade'>(
    hasScoreFirst ? 'Score' : 'Paper'
  );
  const [paperTime, setPaperTime] = useState(0);
  const [animScore, setAnimScore] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [paradeAutoPaused, setParadeAutoPaused] = useState(false);
  const [paradeTransitioning, setParadeTransitioning] = useState(false);
  const [paradeFadeAlpha, setParadeFadeAlpha] = useState(0);

  useEffect(() => {
    setShowHints(false);
  }, [meta.key, launchStageFailure, phase]);

  const hintItems = useMemo(() => {
    const items: string[] = [];
    const seen = new Set<string>();
    const addUnique = (raw?: string) => {
      const text = raw?.trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      items.push(text);
    };
    addUnique(advice);
    addUnique(meta.hint);
    if (improvementHints) {
      for (const h of improvementHints) addUnique(h);
    }
    if (items.length === 0 && (meta.isFailure || launchStageFailure)) {
      addUnique(
        en
          ? 'Check total mass, required ΔV, Solar Panels/Batteries, and Heat Shield in Design [M].'
          : 'Revisa en Diseño [M] el peso total, el ΔV requerido, los Paneles solares/Baterías y el Escudo térmico.'
      );
    }
    return items;
  }, [advice, meta.hint, meta.isFailure, launchStageFailure, improvementHints, en]);

  const canShowPistas = Boolean(
    meta.isFailure ||
      launchStageFailure ||
      !meta.hasPhotos ||
      science < minScience ||
      hintItems.length > 0
  );

  // Smooth score count-up on the Score evaluation screen
  useEffect(() => {
    if (phase !== 'Score') return;
    let rafId = 0;
    const start = performance.now();
    const duration = 850;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const easeOut = 1 - Math.pow(1 - k, 3);
      setAnimScore(score * easeOut);
      if (k < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, score]);

  // Spin entrance only when the Newspaper phase opens
  useEffect(() => {
    if (phase !== 'Paper') return;
    setPaperTime(0);
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setPaperTime((prev) => {
        const next = prev + dt;
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  const openNewspaper = useCallback(() => {
    setPhase('Paper');
  }, []);

  const triggerParadeTransition = useCallback(() => {
    setParadeTransitioning(true);
  }, []);

  // Automatically start the final parade animation after reading El Diario Global on final mission success
  useEffect(() => {
    if (
      phase !== 'Paper' ||
      !isFinalSuccess ||
      paradeAutoPaused ||
      paradeTransitioning
    ) {
      return;
    }
    if (paperTime >= PAPER_TO_PARADE_SECONDS) {
      setParadeTransitioning(true);
    }
  }, [phase, isFinalSuccess, paradeAutoPaused, paradeTransitioning, paperTime]);

  // Smooth fade transition from Newspaper -> Parade
  useEffect(() => {
    if (!paradeTransitioning || phase !== 'Paper') return;
    let rafId = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / (PARADE_FADE_SECONDS * 1000));
      setParadeFadeAlpha(k);
      if (k >= 1) {
        setParadeTransitioning(false);
        setParadeFadeAlpha(0);
        setPhase('Parade');
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [paradeTransitioning, phase]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (phase === 'Parade') return;
        e.preventDefault();
        if (phase === 'Score') {
          openNewspaper();
        } else if (paperTime < SPIN_SECONDS) {
          setPaperTime(SPIN_SECONDS);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, paperTime, openNewspaper]);

  const axes = useMemo(
    () => parseScoreAxes(scoreLines, science, score, meta.survived, lang),
    [scoreLines, science, score, meta.survived, lang]
  );

  const paperK = Math.min(1, paperTime / SPIN_SECONDS);
  const paperEase = 1 - Math.pow(1 - paperK, 3);
  const scoreRingCircumference = 2 * Math.PI * 52;
  const scoreRingOffset =
    scoreRingCircumference * (1 - Math.max(0, Math.min(100, animScore)) / 100);
  const scoreAccent =
    meta.key === 'exploracion_completa' && score >= 85
      ? '#34d399'
      : score >= 70
        ? '#38bdf8'
        : '#f59e0b';

  if (phase === 'Parade') {
    return (
      <FinalParadeView
        isMuted={isMuted}
        masterVolume={masterVolume}
        onReturnToMenu={() => onFinished(true)}
        onViewPaperAgain={() => {
          setParadeAutoPaused(true);
          setParadeTransitioning(false);
          setParadeFadeAlpha(0);
          setPhase('Paper');
        }}
      />
    );
  }

  return (
    <div className="relative w-full h-screen pixel-grid-bg overflow-y-auto select-none flex items-center justify-center p-3 md:p-6">
      <AnimatedSpaceBg alpha={phase === 'Score' ? 0.5 : 0.68} driftMultiplier={0.75} />

      {phase === 'Score' ? (
        <div className="relative z-10 w-full max-w-5xl pixel-panel-gold p-5 md:p-7 my-auto space-y-5">
          {/* Top Calibration Telemetry Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#353b4a] pb-4">
            <div className="space-y-1">
              <div className="font-pixel text-[10px] tracking-wider uppercase text-[#f8d274]">
                {en ? 'Post-Flight Evaluation' : 'Evaluación Post-Vuelo'} ·{' '}
                {levelInfo ? `${levelInfo.title}` : en ? 'MK11 Expedition' : 'Expedición MK11'}
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-[#f3f0e6] tracking-tight">
                {meta.resultado}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono-tech text-xs tabular-nums pixel-inset px-3 py-2">
              <span
                className={
                  meta.key === 'exploracion_completa'
                    ? 'text-[#6ee7a8] font-bold'
                    : 'text-[#f8d274] font-bold'
                }
              >
                {meta.key === 'exploracion_completa'
                  ? en
                    ? 'Nominal Return'
                    : 'Retorno Nominal'
                  : en
                    ? 'Return with Notes'
                    : 'Retorno con Observaciones'}
              </span>
              <span className="text-[#555c6e]">·</span>
              <span className="text-[#f3f0e6]">
                {days} / {levelInfo?.totalDays ?? 5} {en ? 'Days' : 'Días'}
              </span>
              <span className="text-[#555c6e]">·</span>
              <span className="text-[#f3f0e6]">
                {(levelInfo?.distanceKm ?? REAL_LUNAR_PHYSICS.distanceKm).toLocaleString(
                  en ? 'en-US' : 'es-ES'
                )}{' '}
                km
              </span>
            </div>
          </div>

          {unlockedNextLevel && (
            <div className="pixel-inset p-4 border-2 border-[#f8d274]/60 bg-[#1a2234]/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-pixel text-[10px] uppercase tracking-wider text-[#f8d274] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {en
                    ? `NEW LEVEL UNLOCKED: ${unlockedNextLevel.title}!`
                    : `¡NUEVO NIVEL DESBLOQUEADO: ${unlockedNextLevel.title}!`}
                </div>
                <p className="font-display text-xs sm:text-sm text-[#e2e8f0]">
                  {unlockedNextLevel.subtitle} · {unlockedNextLevel.objectiveSummary}
                </p>
              </div>
              {onAdvanceToNextLevel && (
                <button
                  type="button"
                  onClick={onAdvanceToNextLevel}
                  className="px-4 py-2.5 pixel-btn-emerald text-xs sm:text-sm font-display font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
                >
                  {en
                    ? `Continue to Level ${unlockedNextLevel.level} (${unlockedNextLevel.code})`
                    : `Continuar a Nivel ${unlockedNextLevel.level} (${unlockedNextLevel.code})`}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Main Asymmetric Calibration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Score Anchor + Radar */}
            <div className="lg:col-span-5 pixel-inset p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="relative w-32 h-32 shrink-0 flex items-center justify-center pixel-slot-gold p-1.5">
                  <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
                    <circle
                      cx="62"
                      cy="62"
                      r="52"
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.16)"
                      strokeWidth="9"
                    />
                    <circle
                      cx="62"
                      cy="62"
                      r="52"
                      fill="none"
                      stroke={scoreAccent}
                      strokeWidth="9"
                      strokeDasharray={scoreRingCircumference}
                      strokeDashoffset={scoreRingOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono-tech text-3xl font-bold text-[#f3f0e6] tabular-nums leading-none">
                      {animScore.toFixed(0)}
                    </span>
                    <span className="font-pixel text-[9px] text-[#9aa4bd] mt-1">
                      / 100 PTS
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="font-pixel text-[10px] uppercase tracking-wider text-[#9aa4bd]">
                    {en ? 'Rating' : 'Calificación'}
                  </div>
                  <div
                    className="font-display text-lg font-bold leading-snug"
                    style={{ color: scoreAccent }}
                  >
                    {rating}
                  </div>
                  <p className="font-display text-sm text-[#d4d8e4] leading-snug">
                    {meta.queOcurre}
                  </p>
                </div>
              </div>

              {/* Hexagonal Calibration Radar Chart */}
              <div className="border-t-2 border-[#252a36] pt-3">
                <div className="font-pixel text-[10px] uppercase tracking-wider text-[#f8d274] mb-1 text-center">
                  {en ? 'MK11 Efficiency Profile' : 'Perfil de Eficiencia MK11'}
                </div>
                <EngineeringRadarSvg axes={axes} />
              </div>
            </div>

            {/* Right 6-Axis Score Breakdown & Mission Checklist */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              {/* 6-Axis Score Table */}
              <div className="pixel-inset p-5 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-[#252a36] pb-2.5">
                  <span className="font-display text-base font-bold text-[#f3f0e6]">
                    {en ? 'Score Breakdown' : 'Desglose de Puntuación'}
                  </span>
                  <span className="font-mono-tech text-xs text-[#9aa4bd] tabular-nums">
                    {en
                      ? `Science: ${science.toFixed(0)} / ${minScience.toFixed(0)} pts min.`
                      : `Ciencia: ${science.toFixed(0)} / ${minScience.toFixed(0)} pts mín.`}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {axes.map((item) => {
                    const pct = Math.max(0, Math.min(100, (item.earned / item.max) * 100));
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-display text-sm text-[#f3f0e6] font-medium">
                            {item.label}
                          </span>
                          <div className="flex items-center gap-3 font-mono-tech tabular-nums shrink-0">
                            <span className="text-[#9aa4bd] text-[11px]">{item.detail}</span>
                            <span className="text-[#f8d274] font-bold w-20 text-right">
                              +{item.earned.toFixed(1)} / {item.max}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2.5 pixel-bar-track overflow-hidden">
                          <div
                            className="h-full pixel-bar-fill transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 75 ? '#34d399' : pct >= 45 ? '#38bdf8' : '#f59e0b',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Flight Summary & Habitability Verdict */}
              <div className="pixel-inset p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-pixel text-[10px] uppercase tracking-wider text-[#9aa4bd]">
                    {levelInfo && !levelInfo.isFinalLunar && levelInfo.level <= 2
                      ? en
                        ? 'Orbital Telemetry'
                        : 'Telemetría Orbital'
                      : en
                        ? 'Photographic Record'
                        : 'Registro Fotográfico'}
                  </div>
                  <div className="font-display text-sm text-[#f3f0e6] leading-snug flex items-start gap-1.5">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        hasCamera || (levelInfo && !levelInfo.isFinalLunar && levelInfo.level <= 2)
                          ? 'text-[#4ade80]'
                          : 'text-[#f8d274]'
                      }`}
                    />
                    <span>
                      {levelInfo && !levelInfo.isFinalLunar && levelInfo.level <= 2
                        ? en
                          ? `Orbital test ${levelInfo.code} completed: thrust, mass, and link data ready for press.`
                          : `Prueba orbital ${levelInfo.code} completada: datos de empuje, masa y enlace listos para publicación.`
                        : hasCamera
                          ? en
                            ? 'Hasselblad Camera operational: lunar photographs ready for publication.'
                            : 'Cámara Hasselblad operativa: fotografías lunares listas para publicación.'
                          : en
                            ? 'No camera aboard: story published with written report only (they forgot the camera).'
                            : 'Sin cámara a bordo: crónica publicada solo con informe escrito (se olvidaron la cámara).'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-pixel text-[10px] uppercase tracking-wider text-[#9aa4bd]">
                    {en ? 'Lunar Habitability' : 'Habitabilidad Lunar'}
                  </div>
                  <p className="font-display text-sm text-[#d4d8e4] leading-snug">
                    {resolvedHabitability}
                  </p>
                </div>

                {(advice || meta.hint) && (
                  <div className="sm:col-span-2 border-t-2 border-[#252a36] pt-2.5 font-display text-sm text-[#f8d274] leading-snug">
                    <strong className="font-bold">
                      {en ? 'Technical note:' : 'Nota técnica:'}
                    </strong>{' '}
                    {advice || meta.hint}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Primary Action Bar leading directly to El Diario Global */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#353b4a] pt-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onFinished(false)}
                className="px-4 py-2.5 pixel-btn text-xs font-display font-bold cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {en ? 'Back to Simulator' : 'Volver al Simulador'}
              </button>
              {onEditDesign && (
                <button
                  type="button"
                  onClick={onEditDesign}
                  className="px-4 py-2.5 pixel-btn text-xs font-display font-bold cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {en ? 'Adjust Design' : 'Ajustar Diseño'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onFinished(true)}
                className="px-4 py-2.5 pixel-btn text-xs font-display font-medium text-[#b9c2d6] cursor-pointer whitespace-nowrap"
              >
                {en ? 'Main Menu' : 'Menú Principal'}
              </button>
            </div>

            <button
              type="button"
              onClick={openNewspaper}
              className="px-6 py-3 pixel-btn-gold text-sm font-display font-bold cursor-pointer inline-flex items-center gap-2.5 whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              {en
                ? 'Publish Edition in El Diario Global'
                : 'Publicar Edición en El Diario Global'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (paperTime < SPIN_SECONDS) setPaperTime(SPIN_SECONDS);
          }}
          className="relative z-10 w-[96vw] max-w-6xl max-h-[95vh] flex flex-col overflow-y-auto my-auto"
          style={{
            transform:
              paperK < 1
                ? `scale(${0.08 + 0.92 * paperEase}) rotate(${(1 - paperEase) * 540}deg)`
                : undefined,
          }}
        >
          <ElDiarioGlobalPaper
            mission={mission}
            orbit={orbit}
            days={days}
            science={science}
            score={score}
            rating={rating}
            hasCamera={hasCamera}
            habitability={resolvedHabitability}
            meta={meta}
            launchStageFailure={launchStageFailure}
            launchAbortReason={launchAbortReason}
            levelInfo={levelInfo}
            lang={lang}
          />
          {unlockedNextLevel && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 pixel-panel-gold p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="font-pixel text-[10px] uppercase tracking-wider text-[#f8d274] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {en ? 'Unlocked:' : 'Desbloqueado:'} {unlockedNextLevel.title}
                </div>
                <p className="font-display text-xs text-[#e2e8f0]">
                  {unlockedNextLevel.subtitle}
                </p>
              </div>
              {onAdvanceToNextLevel && (
                <button
                  type="button"
                  onClick={onAdvanceToNextLevel}
                  className="px-4 py-2 pixel-btn-emerald text-xs font-display font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
                >
                  {en
                    ? `Advance to Level ${unlockedNextLevel.level} (${unlockedNextLevel.code})`
                    : `Avanzar a Nivel ${unlockedNextLevel.level} (${unlockedNextLevel.code})`}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          {canShowPistas && showHints && hintItems.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 pixel-panel-gold p-4 space-y-2"
            >
              <div className="font-pixel text-[10px] uppercase tracking-wider text-[#f8d274] flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                {en
                  ? 'Hints · What you could improve on your rocket'
                  : 'Pistas · Qué podrías mejorar en tu cohete'}
              </div>
              <ul className="font-display text-xs sm:text-sm text-[#fde68a] space-y-1 leading-snug">
                {hintItems.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          <div
            className="flex flex-wrap items-center justify-between gap-3 pt-4 px-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-pixel text-[10px] text-[#f8d274] pixel-panel px-3 py-1.5">
              EL DIARIO GLOBAL · {en ? 'EDITION' : 'EDICIÓN'} {levelInfo?.code ?? 'MK11'}
            </span>
            <div className="flex flex-wrap gap-3">
              {canShowPistas && hintItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setParadeAutoPaused(true);
                    setShowHints((prev) => !prev);
                  }}
                  className={`px-4 py-2 text-xs font-display font-bold cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                    showHints ? 'pixel-btn-gold ring-2 ring-[#f8d274]' : 'pixel-btn-gold'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {showHints
                    ? en
                      ? 'Hide Hints'
                      : 'Ocultar Pistas'
                    : en
                      ? 'Hints'
                      : 'Pistas'}
                </button>
              )}
              {canInspectScore && (
                <button
                  type="button"
                  onClick={() => {
                    setParadeAutoPaused(true);
                    setPhase('Score');
                  }}
                  className="px-4 py-2 pixel-btn text-xs font-display font-bold text-[#7dd3fc] cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Award className="w-3.5 h-3.5" />
                  {en
                    ? `View Score (${score.toFixed(0)}/100)`
                    : `Ver Puntuación (${score.toFixed(0)}/100)`}
                </button>
              )}
              {isFinalSuccess && (
                <button
                  type="button"
                  onClick={triggerParadeTransition}
                  className="px-4 py-2 pixel-btn-gold text-xs font-display font-bold cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5" />
                  {paradeAutoPaused
                    ? en
                      ? 'Continue to Ending'
                      : 'Continuar al Final'
                    : en
                      ? `Final Parade (${Math.max(1, Math.ceil(PAPER_TO_PARADE_SECONDS - paperTime))}s)`
                      : `Desfile Final (${Math.max(1, Math.ceil(PAPER_TO_PARADE_SECONDS - paperTime))}s)`}
                </button>
              )}
              {onEditDesign && (
                <button
                  type="button"
                  onClick={onEditDesign}
                  className="px-4 py-2 pixel-btn-gold text-xs font-display font-bold cursor-pointer whitespace-nowrap"
                >
                  {en ? 'Adjust in Design' : 'Ajustar en Diseño'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onFinished(false)}
                className="px-4 py-2 pixel-btn-emerald text-xs font-display font-bold cursor-pointer whitespace-nowrap"
              >
                {en ? 'Back to Simulator' : 'Volver al Simulador'}
              </button>
              <button
                type="button"
                onClick={() => onFinished(true)}
                className="px-4 py-2 pixel-btn text-xs font-display font-bold cursor-pointer whitespace-nowrap"
              >
                {en ? 'Back to Menu' : 'Volver al Menú'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smooth Crossfade to Parade Curtain */}
      {paradeTransitioning && (
        <div
          className="fixed inset-0 z-50 bg-black pointer-events-none"
          style={{ opacity: paradeFadeAlpha }}
        />
      )}
    </div>
  );
};
