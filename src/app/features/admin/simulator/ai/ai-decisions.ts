import type { PlayerId } from '../../../../shared/types/battle.types';
import type { AiSnapshot, PendingDecision } from './ai.types';

/** Detecta la decisión pendiente en el estado actual, con su owner y opciones legales.
 *  Devuelve null si no hay nada accionable (estados transitorios, animaciones, fin de partida).
 *
 *  Es una función PURA sobre la foto — el controlador decide después si el owner
 *  es CPU y ejecuta. El orden de los bloques replica la precedencia de la UI:
 *  run (runState) > peek > boot > compile > deploy > init > nueva ronda. */
export function detectPendingDecision(s: AiSnapshot): PendingDecision | null {
  if (s.state.status === 'finished' || s.state.phase === 'finished') return null;

  // ── Peek reveal: modal del atacante, bloquea el flujo hasta el ack ──
  if (s.peekRevealPlayer !== null) {
    return { kind: 'peek-ack', owner: s.peekRevealPlayer };
  }

  // ── RUN: la máquina de pasos manda mientras haya bot activo ──
  const rs = s.runState;
  if (rs.botId) {
    const bot = s.currentRunBot;
    if (!bot) return null;
    const owner: PlayerId = bot.playerId;

    switch (rs.step) {
      case 'idle':
        return { kind: 'resolve-op', owner, botId: bot.id };
      case 'picking-number':
        return bot.numbers.length > 0
          ? { kind: 'pick-number', owner, botId: bot.id, options: [...bot.numbers] }
          : null;
      case 'intercept-prompt': {
        const ib = s.interceptBot;
        if (!ib) return null;
        return { kind: 'intercept-decide', owner: ib.playerId, interceptorId: ib.id };
      }
      case 'intercept-picking': {
        const ib = s.interceptBot;
        if (!ib || ib.numbers.length === 0) return null;
        return { kind: 'intercept-number', owner: ib.playerId, interceptorId: ib.id, options: [...ib.numbers] };
      }
      case 'picking-hex':
        return { kind: 'move-hex', owner, botId: bot.id, options: s.selectableHexes ?? [] };
      case 'picking-target':
        return { kind: 'target', owner, botId: bot.id, options: s.selectableHexes ?? [] };
      case 'dash-move':
        return { kind: 'dash-hex', owner, botId: bot.id, options: s.selectableHexes ?? [] };
      case 'shadow-step':
        return { kind: 'shadow-hex', owner, botId: bot.id, options: s.selectableHexes ?? [] };
      case 'deploy-barrier':
        return { kind: 'barrier-hex', owner, botId: bot.id, options: s.selectableHexes ?? [] };
      case 'relay-node':
        return { kind: 'relay-hex', owner, botId: bot.id, options: s.selectableHexes ?? [] };
      case 'charged-rolling':
        return s.chargedAnimating ? null : { kind: 'charged', owner, botId: bot.id };
      case 'op-done':
      case 'evaluated':
        return { kind: 'advance-op', owner, botId: bot.id };
      case 'debug':
        return { kind: 'debug-phase', owner, botId: bot.id };
      case 'bot-done':
        return { kind: 'finish-bot', owner, botId: bot.id };
      default:
        // rolling / between-iters / intermedias: nada accionable
        return null;
    }
  }

  // ── BOOT ──
  if (s.nextBootBot && !s.bootRollingFor) {
    return { kind: 'boot', owner: s.nextBootBot.playerId, botId: s.nextBootBot.id };
  }

  // ── COMPILE ──
  if (s.nextCompileBot) {
    return { kind: 'compile', owner: s.nextCompileBot.playerId, botId: s.nextCompileBot.id };
  }

  // ── DEPLOY (criterio → PPT → dado color → colocación) ──
  if (s.state.phase === 'deploy' && !s.deployStarter) {
    switch (s.subPhase) {
      case 'criterion':
        if (!s.choiceP1) return { kind: 'criterion', owner: 1 };
        if (!s.choiceP2) return { kind: 'criterion', owner: 2 };
        return null;
      case 'ppt-p1':
        return s.rollingPpt ? null : { kind: 'ppt-roll', owner: 1, context: 'deploy' };
      case 'ppt-p2':
        return s.rollingPpt ? null : { kind: 'ppt-roll', owner: 2, context: 'deploy' };
      case 'ppt-result':
        return s.deployPptWinner === null
          ? { kind: 'ppt-repeat', owner: 'shared', context: 'deploy' }
          : { kind: 'ppt-confirm', owner: 'shared', context: 'deploy' };
      default:
        return null;
    }
  }
  if (s.state.phase === 'deploy' && s.activeDeployer) {
    if (s.pendingRoll === null) {
      return s.rollingColor ? null : { kind: 'color-roll', owner: s.activeDeployer };
    }
    return { kind: 'deploy-hex', owner: s.activeDeployer, options: s.selectableHexes ?? [] };
  }

  // ── INIT (PPT de ronda) — cubre el arranque tras deploy y tras cada END ──
  if (s.initStarted) {
    switch (s.initSubPhase) {
      case 'ppt-p1':
        return s.rollingPpt ? null : { kind: 'ppt-roll', owner: 1, context: 'init' };
      case 'ppt-p2':
        return s.rollingPpt ? null : { kind: 'ppt-roll', owner: 2, context: 'init' };
      case 'ppt-result':
        return s.initPptWinner === null
          ? { kind: 'ppt-repeat', owner: 'shared', context: 'init' }
          : { kind: 'ppt-confirm', owner: 'shared', context: 'init' };
      default:
        return null;
    }
  }

  // ── END: botón "Nueva ronda" ──
  if (s.state.phase === 'end') {
    return { kind: 'new-round', owner: 'shared' };
  }

  return null;
}
