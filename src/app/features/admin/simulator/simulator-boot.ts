import type {
  BattleBot,
  BattleEvent,
  OperationKind,
} from '../../../shared/types/battle.types';

export const BOOT_POOLS: Record<1 | 2 | 3, OperationKind[]> = {
  1: ['IF', 'IF_ELSE'],
  2: ['IF', 'IF_ELSE', 'FOR', 'WHILE'],
  3: ['IF', 'IF_ELSE', 'FOR', 'WHILE', 'TRY_CATCH'],
};

export interface BootRollResult {
  dice: number[];
  total: number;
  energy: number;
  overflow: boolean;
  numbers: number[];
  rolledNumbers: number[];
  operations: OperationKind[];
  bugsAfter: number;
  events: BattleEvent[];
}

function d6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollBoot(
  bot: BattleBot,
  chosen: 0 | 1 | 2 | 3,
  turn: number,
  activation: number,
): BootRollResult {
  const ts = () => new Date().toISOString();
  const base = {
    turn,
    activation,
    phase: 'boot' as const,
    timestamp: ts(),
    botId: bot.id,
  };

  const dice: number[] = [];
  for (let i = 0; i < chosen; i++) dice.push(d6());
  const total = dice.reduce((s, x) => s + x, 0);
  const combined = bot.energy + total;
  const energy = Math.min(bot.maxEnergy, combined);
  const overflow = chosen > 0 && combined > bot.maxEnergy;

  const events: BattleEvent[] = [];
  events.push({
    ...base,
    kind: 'boot_energy_rolled',
    payload: { chosen, dice, total, combined, energy, overflow },
  });
  if (overflow) {
    events.push({
      ...base,
      kind: 'bug_added',
      payload: { count: 1, reason: 'energy-overflow' },
    });
  }

  const need = Math.max(0, bot.maxNumbers - bot.numbers.length);
  const rolledNumbers: number[] = [];
  for (let i = 0; i < need; i++) rolledNumbers.push(d6());
  const numbers = [...bot.numbers, ...rolledNumbers].slice(0, bot.maxNumbers);
  events.push({
    ...base,
    kind: 'boot_numbers_rolled',
    payload: { numbers, rolled: rolledNumbers },
  });

  const bugsAfter = bot.bugs + (overflow ? 1 : 0);
  const slots = Math.max(0, bot.maxOperations - bugsAfter);
  const pool = BOOT_POOLS[bot.version];
  const operations: OperationKind[] = [];
  let hasLoop = false;
  let guard = 0;
  while (operations.length < slots && guard++ < 1000) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if ((pick === 'FOR' || pick === 'WHILE') && hasLoop) continue;
    if (pick === 'FOR' || pick === 'WHILE') hasLoop = true;
    operations.push(pick);
  }
  events.push({
    ...base,
    kind: 'boot_operations_rolled',
    payload: { operations, version: bot.version, slots, bugs: bugsAfter },
  });

  return { dice, total, energy, overflow, numbers, rolledNumbers, operations, bugsAfter, events };
}
