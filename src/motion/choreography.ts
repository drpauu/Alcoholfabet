import rawChoreography from '../../motion/event-choreography.json';
import audioMap from '../../motion/audio-cues.json';
import rawTokens from '../../motion/motion-tokens.json';
import type { ConfirmedGameEffect } from './effects';

export type AudioCue = keyof typeof audioMap;
export const audioCues = audioMap;
export const motionTokens = rawTokens;
export interface MotionStep {
  atMs: number; target: string; action: string;
  durationMs?: number; durationPerCellMs?: number; easing?: string;
  props?: Record<string, string | number>; to?: Record<string, string | number>;
  from?: Record<string, string | number>; values?: Record<string, number[]>;
  cue?: AudioCue; cueByDrinkCount?: Record<string, AudioCue>;
  value?: string; count?: number; scale?: number[]; text?: string; label?: string;
  pattern?: number[]; playStepSound?: boolean;
  fromPosition?: number; toPosition?: number;
}
export interface MotionSequence { totalMs: number; steps: MotionStep[] }

// The source JSON is the timing authority; the adapter adds confirmed movement endpoints.
const choreography = rawChoreography as unknown as Record<string, { totalMs?: number; steps?: MotionStep[]; request?: MotionStep[]; won?: MotionStep[]; lost?: MotionStep[] }>;

export function sequenceFor(effect: ConfirmedGameEffect): MotionSequence {
  if (effect.type === 'TP_CLAIM') {
    const steps = choreography.TP_CLAIM[effect.variant] ?? [];
    return { totalMs: effect.variant === 'won' ? 300 : 180, steps: steps.map((step) => ({ ...step })) };
  }
  const source = choreography[effect.type];
  const steps = (source.steps ?? []).map((step) => ({ ...step }));
  if (effect.type === 'CORRECT_AND_MOVE') {
    const feedback = steps.filter((step) => step.action !== 'moveAlongBoard');
    if (effect.plusOne && effect.to - effect.from >= 2) {
      const plusSteps = (choreography.PLUS_ONE.steps ?? []).map((step) => ({ ...step, atMs: step.atMs + 360 }));
      let current = effect.from;
      for (const step of plusSteps) {
        if (step.action === 'moveOneCell') {
          step.fromPosition = current;
          current += 1;
          step.toPosition = current;
          step.playStepSound = true;
        }
      }
      return { totalMs: 1700, steps: [...feedback, ...plusSteps] };
    }
    for (const step of steps) if (step.action === 'moveAlongBoard') {
      step.fromPosition = effect.from;
      step.toPosition = effect.to;
    }
    return { totalMs: 360 + Math.max(0, effect.to - effect.from) * 420, steps };
  }
  if (effect.type === 'INCORRECT_AND_DRINK') {
    for (const step of steps) if (step.action === 'playDynamic') {
      step.action = 'play';
      step.cue = step.cueByDrinkCount?.[String(effect.drinkCount)];
    }
  }
  return { totalMs: source.totalMs ?? 300, steps };
}

export function connectionSequence(connected: boolean): MotionSequence {
  const source = choreography[connected ? 'RECONNECT' : 'DISCONNECT'];
  return { totalMs: source.totalMs ?? 0, steps: (source.steps ?? []).map((step) => ({ ...step })) };
}

export function claimRequestSequence(): MotionSequence {
  return { totalMs: 90, steps: choreography.TP_CLAIM.request ?? [] };
}

/** Keeps every semantic cue, while replacing trajectories, shake and particles. */
export function reduceSequence(sequence: MotionSequence): MotionSequence {
  const ratio = Math.min(1, 180 / Math.max(sequence.totalMs, 1));
  const steps = sequence.steps.flatMap((step): MotionStep[] => {
    if (step.action === 'emit') return [];
    const reduced = { ...step, atMs: Math.round(step.atMs * ratio), durationMs: step.durationMs ? Math.min(100, Math.round(step.durationMs * ratio)) : undefined };
    if (step.action === 'set' && (step.props?.rotateY !== undefined || step.props?.x !== undefined)) return [];
    if (step.target === 'gameCamera') return [];
    if (['moveAlongBoard', 'moveOneCell', 'landAtFinish'].includes(step.action)) return [{ ...reduced, action: 'reducedMove', durationMs: 100 }];
    if (['keyframes', 'animate', 'pulse', 'dropAndBounce', 'raiseGlass'].includes(step.action)) {
      return [{ ...reduced, action: 'reducedFeedback', to: { opacity: 1 }, durationMs: 100 }];
    }
    return [reduced];
  });
  return { totalMs: Math.min(180, sequence.totalMs), steps };
}

export function easing(name = 'enter'): string {
  const values = motionTokens.easing[name as keyof typeof motionTokens.easing] ?? motionTokens.easing.enter;
  return `cubic-bezier(${values.join(',')})`;
}
