import type { AttackFnDef } from './attack-fn.types';

import { powerSmash } from './v1/power-smash';
import { rocketPunch } from './v1/rocket-punch';
import { laserBeam } from './v1/laser-beam';
import { dashStrike } from './v1/dash-strike';
import { pinpointBurst } from './v1/pinpoint-burst';
import { pulseShot } from './v1/pulse-shot';
import { stabilizerHit } from './v1/stabilizer-hit';

import { nanoRepair } from './v2/nano-repair';
import { traceShot } from './v2/trace-shot';
import { ghostProtocol } from './v2/ghost-protocol';
import { peekMemory } from './v2/peek-memory';
import { shadowStep } from './v2/shadow-step';
import { overclockStrike } from './v2/overclock-strike';
import { plasmaBolt } from './v2/plasma-bolt';
import { chainLightning } from './v2/chain-lightning';
import { berserkProtocol } from './v2/berserk-protocol';
import { firewall } from './v2/firewall';
import { gravityWell } from './v2/gravity-well';
import { swapProtocol } from './v2/swap-protocol';
import { ionCannon } from './v2/ion-cannon';
import { deployBarrier } from './v2/deploy-barrier';

import { overdriveStrike } from './v3/overdrive-strike';
import { railgun } from './v3/railgun';
import { chargedStrike } from './v3/charged-strike';
import { dataSpike } from './v3/data-spike';
import { flashSpin } from './v3/flash-spin';
import { syncBlast } from './v3/sync-blast';
import { relayNode } from './v3/relay-node';
import { novaBlast } from './v3/nova-blast';
import { empField } from './v3/emp-field';

const ALL: AttackFnDef[] = [
  powerSmash, rocketPunch, laserBeam, dashStrike, pinpointBurst, pulseShot, stabilizerHit,
  nanoRepair, traceShot, ghostProtocol, peekMemory, shadowStep, overclockStrike, plasmaBolt,
  chainLightning, berserkProtocol, firewall, gravityWell, swapProtocol, ionCannon, deployBarrier,
  overdriveStrike, railgun, chargedStrike, dataSpike, flashSpin, syncBlast, relayNode,
  novaBlast, empField,
];

export const ATTACK_FN_REGISTRY: ReadonlyMap<string, AttackFnDef> = new Map(
  ALL.map(d => [d.id, d]),
);

export function getAttackFn(id: string | undefined | null): AttackFnDef | undefined {
  if (!id) return undefined;
  return ATTACK_FN_REGISTRY.get(id.replace(/\(\s*\)$/, ''));
}
