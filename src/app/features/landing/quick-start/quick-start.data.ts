/**
 * QUICK_START.EXE — Datos del recorrido interactivo de un turno.
 * Contenido verificado contra /docs/reglamento (core-cycle, setup, tables).
 */

export interface QsDie {
  k: string;
  v: string;
  cls?: 'true' | 'false';
}

export interface QsStep {
  tag: string;
  name: string;
  text: string;
  dice: QsDie[];
  note: string;
  /** Índice de fase activa en el pipeline (-1 = ninguna). */
  phase: number;
  /** Script: líneas completadas y líneas en ejecución. */
  script?: { done: number[]; hot: number[] };
  /** Estado del tablero/paneles tras el paso. */
  en: number;
  meShield: number;
  foeLife: number;
  foeShield: number;
  /** Índices de `numbers` ya gastados (acumulado). */
  spent: number[];
  /** Índice del número usado en ESTE paso (resaltado). */
  num?: number;
  showNums: boolean;
  moved: boolean;
  attack: boolean;
  /** Hexes resaltados como ruta de movimiento / impacto. */
  path?: string[];
  hit?: string[];
  /** Último paso: muestra CTA y marca DEBUG() como saltada. */
  end?: boolean;
}

export const QS_PHASES = ['INIT()', 'BOOT()', 'COMPILE()', 'RUN()', 'DEBUG()', 'END()'];

/** Números cargados en RAM durante BOOT() — MAX_NUMBERS V1 = 5. */
export const QS_NUMS = [2, 5, 3, 6, 1];

/** BattleScript compilado (HTML con clases bs-* del design system). */
export const QS_SCRIPT: string[] = [
  '<span class="bs-phase">START</span>',
  '  <span class="bs-kw">IF</span> <span class="bs-cmt">(cond)</span> <span class="bs-kw">THEN</span> <span class="bs-fn">move</span><span class="bs-type">()</span>',
  '  <span class="bs-kw">IF</span> <span class="bs-cmt">(cond)</span> <span class="bs-kw">THEN</span> <span class="bs-fn">attack</span><span class="bs-type">(</span><span class="bs-fn">pulseShot</span><span class="bs-type">())</span>',
  '  <span class="bs-kw">IF-ELSE</span> <span class="bs-cmt">(cond)</span> <span class="bs-kw">THEN</span> <span class="bs-fn">attack</span><span class="bs-type">(</span><span class="bs-fn">laserBeam</span><span class="bs-type">())</span>',
  '       <span class="bs-kw">ELSE</span> <span class="bs-fn">shield</span><span class="bs-type">()</span>',
  '<span class="bs-phase">END</span>',
];

export const QS_STEPS: QsStep[] = [
  {
    tag: 'Paso 1 · La escena',
    name: 'DUELO EN EL EDC',
    text: 'Dos Programadores, un Bot cada uno, en pleno Entorno Digitalizado de Combate. Ambos desplegaron respetando el perímetro de seguridad (mínimo 6 Hexes), pero tras la primera ronda de maniobras <b>KERNEL-9</b> (verde) ha cerrado la distancia: <b>R3AP-R</b> está a 4 Hexes y ya acumula <b>1 punto de escudo</b>. Los Hexes negros son obstáculos: Bloquean movimiento y línea de visión.',
    dice: [],
    note: 'Cada ronda arranca con INIT() y BOOT(). Después, cada Bot ejecuta su ciclo: COMPILE() → RUN() → DEBUG() → END().',
    phase: -1,
    en: 0, meShield: 0, foeLife: 20, foeShield: 1,
    spent: [], showNums: false, moved: false, attack: false,
  },
  {
    tag: 'Paso 2 · Inicio de ronda',
    name: 'INIT()',
    text: 'Los Programadores negocian el <b>CPU Time</b> con un duelo de Piedra-Papel-Tijera. Sacas papel contra piedra: <b>Ganas la Prioridad de CPU</b>. Tu Bot actuará primero durante toda la ronda.',
    dice: [{ k: 'PPT Protocol', v: '✋ vs ✊', cls: 'true' }],
    note: 'En las rondas 3 y 5 todos los Bots ejecutan upgrade() y desbloquean nuevas Operaciones, Funciones y ataques.',
    phase: 0,
    en: 0, meShield: 0, foeLife: 20, foeShield: 1,
    spent: [], showNums: false, moved: false, attack: false,
  },
  {
    tag: 'Paso 3 · Arranque',
    name: 'BOOT()',
    text: 'KERNEL-9 arranca. Ejecuta <b>getEnergy(2)</b>: 2d6 → 4+3 = <b>7 de energía</b>. Con <b>getNumbers()</b> rellena su RAM de números para las condiciones. Y lanza 3 veces el <b>Dado V1</b> para cargar sus Operaciones del turno: <b>IF, IF, IF-ELSE</b>.',
    dice: [
      { k: 'getEnergy(2)', v: '4+3 = 7' },
      // El texto menciona getNumbers(): el resultado se muestra aquí igual
      // que el de los otros dos lanzamientos. Los valores son QS_NUMS.
      { k: 'getNumbers()', v: '2 5 3 6 1' },
      { k: 'Dado V1 ×3', v: 'IF · IF · IF-ELSE' },
    ],
    note: 'Si la energía supera MAX_ENERGY, el exceso se pierde… Y el Bot gana un BUG por sobrecarga.',
    phase: 1,
    en: 7, meShield: 0, foeLife: 20, foeShield: 1,
    spent: [], showNums: true, moved: false, attack: false,
  },
  {
    tag: 'Paso 4 · Programación',
    name: 'COMPILE()',
    text: 'Ahora escribes el <b>BattleScript</b>: Ordenas tus 3 Operaciones y les asignas Funciones. El plan: Acercarte, disparar y, si el segundo ataque falla, levantar escudo. Una vez compilado, <b>no se puede reordenar</b>.',
    dice: [],
    note: 'Cada BUG activo te roba una ranura de Operación. Programa limpio o sufre.',
    phase: 2,
    script: { done: [], hot: [] },
    en: 7, meShield: 0, foeLife: 20, foeShield: 1,
    spent: [], showNums: true, moved: false, attack: false,
  },
  {
    tag: 'Paso 5 · Ejecución · línea 1',
    name: 'RUN()',
    text: 'Cada condición se resuelve con dados. Dado de Operaciones → <b>≥</b>. 1d6 → <b>4</b>. Eliges tu número guardado <b>3</b>. ¿4 ≥ 3? <b>TRUE</b> → Se ejecuta <b>move()</b>: Declaras 2 Hexes, pagas 2 de energía y avanzas.',
    dice: [
      { k: 'Comparador', v: '≥' },
      { k: '1d6', v: '4' },
      { k: 'numbers', v: '3' },
      { k: '4 ≥ 3', v: 'TRUE', cls: 'true' },
    ],
    note: 'move(n) cuesta tanta energía como Hexes muevas, hasta MAX_MOVEMENT.',
    phase: 3,
    script: { done: [], hot: [1] },
    en: 5, meShield: 0, foeLife: 20, foeShield: 1,
    spent: [2], num: 2, showNums: true, moved: true, attack: false,
    path: ['2,2', '3,2'],
  },
  {
    tag: 'Paso 6 · Ejecución · línea 2',
    name: 'RUN()',
    text: 'Comparador → <b>==</b>. 1d6 → <b>2</b>. Eliges tu <b>2</b>. ¿2 == 2? <b>TRUE</b> → <b>attack(pulseShot())</b>: 1 de energía, daño 2 a rango 2. El escudo rival para 1 punto y se rompe. R3AP-R pierde <b>1 de vida</b>.',
    dice: [
      { k: 'Comparador', v: '==' },
      { k: '1d6', v: '2' },
      { k: 'numbers', v: '2' },
      { k: '2 == 2', v: 'TRUE', cls: 'true' },
    ],
    note: 'Ojo: El Bot enemigo más cercano puede INTERCEPTAR una Operación por turno y sustituir tu dado por un número suyo.',
    phase: 3,
    script: { done: [1], hot: [2] },
    en: 4, meShield: 0, foeLife: 19, foeShield: 0,
    spent: [2, 0], num: 0, showNums: true, moved: true, attack: true,
    hit: ['5,2'],
  },
  {
    tag: 'Paso 7 · Ejecución · línea 3',
    name: 'RUN()',
    text: 'Comparador → <b>&lt;</b>. 1d6 → <b>6</b>. Tu número: <b>1</b>. ¿6 &lt; 1? <span class="bad">FALSE</span> → El laserBeam() no se dispara… Pero es un <b>IF-ELSE</b>: Se ejecuta la rama ELSE, <b>shield()</b>. Pagas 2 de energía y ganas <b>+1 escudo</b>.',
    dice: [
      { k: 'Comparador', v: '<' },
      { k: '1d6', v: '6' },
      { k: 'numbers', v: '1' },
      { k: '6 < 1', v: 'FALSE', cls: 'false' },
    ],
    note: 'Programar un plan B en la rama ELSE es la diferencia entre un turno perdido y un turno sólido.',
    phase: 3,
    script: { done: [1, 2], hot: [3, 4] },
    en: 2, meShield: 1, foeLife: 19, foeShield: 0,
    spent: [2, 0, 4], num: 4, showNums: true, moved: true, attack: false,
  },
  {
    tag: 'Paso 8 · Cierre',
    name: 'END()',
    text: 'Se descartan las Operaciones usadas, pero <b>conservas los números que no gastaste y tus 2 de energía</b> para el próximo turno. No tienes bugs, así que saltas DEBUG(). El turno pasa a R3AP-R… Y ahora le toca sudar a su Programador.',
    dice: [],
    note: 'Victoria: El último Programador con Bots operativos gana. Sin piedad, sin rollback.',
    phase: 5,
    script: { done: [1, 2, 3, 4], hot: [5] },
    en: 2, meShield: 1, foeLife: 19, foeShield: 0,
    spent: [2, 0, 4], showNums: true, moved: true, attack: false,
    end: true,
  },
];
