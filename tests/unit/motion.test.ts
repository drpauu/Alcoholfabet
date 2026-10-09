import { describe, expect, it } from 'vitest';
import { reduceSequence, sequenceFor } from '../../src/motion/choreography';
import { effectsBetween, type ConfirmedGameEffect } from '../../src/motion/effects';
import { GameEventOrchestrator } from '../../src/motion/orchestrator';
import type { GameView } from '../../src/services/game-contract';

const identity = { gameId: 'game-1', stateVersion: 2, id: 'event-2' };
const questionEffect: ConfirmedGameEffect = { ...identity, type: 'QUESTION_ENTER' };

function view(version = 1): GameView {
  return {
    game: { id: 'game-1', coupleId: 'private', inviteCode: null, mode: 'IN_PERSON', status: 'ACTIVE', phase: 'QUESTION', currentTurn: 'PAU', startingPlayer: 'PAU', targetMinutes: 20, finishPosition: 4, currentTargetCell: 1, tpClaimant: null, respondingPlayer: 'PAU', pauPosition: 0, teclaPosition: 0, turnNumber: 1, stateVersion: version, winner: null },
    viewer: { role: 'IN_PERSON_CONTROLLER', userId: 'device' }, board: [],
    question: { id: 'q-1', pool: 'PAU', topic: 'Tema', questionCa: 'Pregunta?' },
    capabilities: { canSeeAnswer: false, canJudge: false, canBeginTurn: false, canReveal: true, canClaim: false, canNextTurn: false, canStart: false, canAbandon: true },
    members: [{ role: 'IN_PERSON_CONTROLLER' }], lastEvent: null,
    scoreboard: { pauWins: 0, teclaWins: 0, completedGames: 0 },
  };
}

describe('confirmed visual effects', () => {
  it('derives separate movement and victory effects from one final transaction', () => {
    const before = view(10); before.game.pauPosition = 2;
    const after = view(11); after.game.phase = 'FINISHED'; after.game.status = 'FINISHED'; after.game.winner = 'PAU'; after.game.pauPosition = 4;
    after.lastEvent = { id: 'judge-11', type: 'JUDGE_CORRECT', stateVersion: 11, createdAt: '', payload: { correct: true, respondingPlayer: 'PAU', from: 2, to: 4, plusOne: true } };
    expect(effectsBetween(before, after).map((effect) => effect.type)).toEqual(['CORRECT_AND_MOVE', 'VICTORY']);
    expect(effectsBetween(null, after)).toEqual([]);
    expect(effectsBetween(after, after)).toEqual([]);
  });

  it('never reveals content for a respondent view', () => {
    const before = view(); const after = view(2); after.game.phase = 'ANSWER_REVEALED';
    expect(effectsBetween(before, after)).toEqual([]);
    after.capabilities.canSeeAnswer = true;
    expect(effectsBetween(before, after)[0].type).toBe('ANSWER_REVEAL');
  });

  it('animates a nonfinal server MOVING phase rather than teleporting its pawn', () => {
    const before = view(3); before.game.phase = 'ANSWER_REVEALED';
    const after = view(4); after.game.phase = 'MOVING'; after.game.pauPosition = 1;
    after.lastEvent = { id: 'judge-4', type: 'JUDGE_CORRECT', stateVersion: 4, createdAt: '', payload: { correct: true, respondingPlayer: 'PAU', from: 0, to: 1, plusOne: false } };
    expect(effectsBetween(before, after)).toEqual([{ gameId: 'game-1', stateVersion: 4, id: 'judge-4', type: 'CORRECT_AND_MOVE', player: 'PAU', from: 0, to: 1, plusOne: false, fromOffsetX: -18 }]);
  });

  it('uses exact card midpoint and distinct +1 landings from the choreography', () => {
    const reveal = sequenceFor({ ...identity, type: 'ANSWER_REVEAL' });
    expect(reveal.steps.find((step) => step.action === 'swapContent')?.atMs).toBe(210);
    const plus = sequenceFor({ ...identity, type: 'CORRECT_AND_MOVE', player: 'PAU', from: 2, to: 4, plusOne: true });
    expect(plus.steps.filter((step) => step.action === 'moveOneCell').map((step) => [step.atMs, step.fromPosition, step.toPosition])).toEqual([[540, 2, 3], [1920, 3, 4]]);
    expect(plus.steps.find((step) => step.cue === 'PLUS_ONE')?.atMs).toBe(1455);
    expect(plus.totalMs).toBe(2550);
  });

  it('keeps semantic reduced-motion feedback and drops flying particles', () => {
    const reduced = reduceSequence(sequenceFor({ ...identity, type: 'VICTORY', winner: 'TECLA' }));
    expect(reduced.totalMs).toBe(180);
    expect(reduced.steps.some((step) => step.action === 'emit')).toBe(false);
    expect(reduced.steps.some((step) => step.cue === 'VICTORY')).toBe(true);
    expect(reduced.steps.some((step) => step.target === 'crown')).toBe(true);
    expect(reduced.steps.some((step) => step.target === 'finalActions')).toBe(true);
  });

  it('orchestrates the drink toast and preserves the right sound with reduced motion', () => {
    for (const drinkCount of [1, 2] as const) {
      const sequence = sequenceFor({ ...identity, type: 'INCORRECT_AND_DRINK', player: 'PAU', drinkCount });
      expect(sequence.totalMs).toBe(3600);
      expect(sequence.steps.find(step => step.target === 'drinkHeroFirst')?.action).toBe('toastGlass');
      expect(sequence.steps.find(step => step.target === 'drinkSparkles')?.count).toBeLessThanOrEqual(10);
      const clink = sequence.steps.find(step => step.target === 'drinkClink');
      expect(sequence.steps.find(step => step.action === 'play' && step.atMs === clink?.atMs)?.cue).toBe(drinkCount === 2 ? 'DOUBLE_DRINK' : 'DRINK');
      const reduced = reduceSequence(sequence);
      expect(reduced.totalMs).toBe(900);
      expect(reduced.steps.some(step => ['toastGlass', 'liquidSway', 'sweepGlass', 'ripple', 'emit', 'pulse', 'keyframes'].includes(step.action))).toBe(false);
      expect(reduced.steps.filter(step => step.action === 'enter').every(step => step.to?.scale === undefined && step.to?.y === undefined)).toBe(true);
      expect(reduced.steps.some(step => step.cue === (drinkCount === 2 ? 'DOUBLE_DRINK' : 'DRINK'))).toBe(true);
    }
  });

  it('names the confirmed T&P respondent, even when the next turn belongs to the other player', () => {
    const before = view(7); before.game.phase = 'TP_CLAIMED'; before.game.tpClaimant = 'PAU';
    const after = view(8); after.game.phase = 'RESULT'; after.game.currentTurn = 'TECLA';
    after.lastEvent = { id: 'drink-8', type: 'JUDGE_INCORRECT', stateVersion: 8, createdAt: '', payload: { correct: false, respondingPlayer: 'PAU', drinkCount: 2 } };
    expect(effectsBetween(before, after)).toEqual([{ gameId: 'game-1', stateVersion: 8, id: 'drink-8', type: 'INCORRECT_AND_DRINK', player: 'PAU', drinkCount: 2 }]);
    after.lastEvent.payload.respondingPlayer = 'UNKNOWN';
    expect(effectsBetween(before, after)).toEqual([]);
    after.lastEvent.payload.respondingPlayer = 'PAU'; after.lastEvent.stateVersion = 6;
    expect(effectsBetween(before, after)).toEqual([]);
  });
});

describe('event orchestration', () => {
  it('deduplicates both realtime delivery and RPC response, while keeping distinct effects', async () => {
    const orchestrator = new GameEventOrchestrator(); orchestrator.hydrate('game-1', 1);
    const played: string[] = [];
    const runner = async (effect: ConfirmedGameEffect) => { played.push(effect.type); };
    await orchestrator.enqueue(questionEffect, runner);
    await orchestrator.enqueue(questionEffect, runner);
    await orchestrator.enqueue({ ...identity, type: 'ANSWER_REVEAL' }, runner);
    expect(played).toEqual(['QUESTION_ENTER', 'ANSWER_REVEAL']);
  });

  it('does not replay stale versions after reconnect, including pruned events', async () => {
    const orchestrator = new GameEventOrchestrator(); orchestrator.hydrate('game-1', 1);
    const played: number[] = [];
    const runner = async (effect: ConfirmedGameEffect) => { played.push(effect.stateVersion); };
    for (let version = 2; version < 160; version += 1) await orchestrator.enqueue({ ...questionEffect, stateVersion: version, id: String(version) }, runner);
    await orchestrator.enqueue(questionEffect, runner);
    orchestrator.hydrate('game-1', 200);
    await orchestrator.enqueue({ ...questionEffect, stateVersion: 200 }, runner);
    expect(played).toHaveLength(158);
  });

  it('recovers the queue after a failed animation', async () => {
    const orchestrator = new GameEventOrchestrator(); orchestrator.hydrate('game-1', 1);
    await expect(orchestrator.enqueue(questionEffect, async () => { throw new Error('Animation cancelled'); })).rejects.toThrow();
    let played = false;
    await orchestrator.enqueue({ ...questionEffect, stateVersion: 3 }, async () => { played = true; });
    expect(played).toBe(true);
  });

  it('cancels queued effects before hydrating a current server view', async () => {
    const orchestrator = new GameEventOrchestrator(); orchestrator.hydrate('game-1', 1);
    const played: string[] = [];
    void orchestrator.enqueue(questionEffect, async () => { played.push('old'); });
    orchestrator.hydrate('game-1', 3);
    await orchestrator.settled();
    expect(played).toEqual([]);
  });
});
