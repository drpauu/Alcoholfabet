import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { PlayerRole } from '../domain/game/game-types';
import type { GameView } from '../services/game-contract';
import type { DrinkPresentation } from '../components/DrinkCelebration';
import { GameAudioManager } from './audio';
import { claimRequestSequence, connectionSequence, reduceSequence, sequenceFor } from './choreography';
import { runSequence } from './dom-runner';
import { effectsBetween } from './effects';
import { GameEventOrchestrator } from './orchestrator';

export interface GameMotionOptions { rootRef?: RefObject<HTMLElement | null> }
function initialAnswer(view: GameView | null): boolean {
  return Boolean(view?.capabilities.canSeeAnswer && (view.game.mode === 'ONLINE' || view.game.phase === 'ANSWER_REVEALED' || view.game.phase === 'RESULT' || view.game.status === 'FINISHED'));
}

export function useGameMotion(view: GameView | null, options: GameMotionOptions = {}) {
  const [busy, setBusy] = useState(false);
  const [answerVisible, setAnswerVisible] = useState(() => initialAnswer(view));
  const [finalActionsVisible, setFinalActionsVisible] = useState(() => view?.game.status === 'FINISHED');
  const [victoryVisible, setVictoryVisible] = useState(() => view?.game.status === 'FINISHED');
  const [victoryCardVisible, setVictoryCardVisible] = useState(() => view?.game.status === 'FINISHED');
  const [crownVisible, setCrownVisible] = useState(() => view?.game.status === 'FINISHED');
  const [scoreVisible, setScoreVisible] = useState(() => view?.game.status === 'FINISHED');
  const [reconnectVisible, setReconnectVisible] = useState(false);
  const [drinkPresentation, setDrinkPresentation] = useState<DrinkPresentation | null>(null);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [audio] = useState(() => new GameAudioManager());
  const [soundEnabled, setSoundEnabled] = useState(audio.enabled);
  const [orchestrator] = useState(() => new GameEventOrchestrator());
  const previous = useRef<GameView | null>(null);
  const current = useRef(view);
  const disconnected = useRef(false);
  const auxiliary = useRef(new AbortController());
  const reducedRef = useRef(reduced);
  const activeRuns = useRef(0);
  current.current = view;
  reducedRef.current = reduced;
  const root = useCallback(() => options.rootRef?.current ?? document, [options.rootRef]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => { media.removeEventListener('change', update); orchestrator.cancel(); auxiliary.current.abort(); audio.stop(); };
  }, [audio, orchestrator]);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (!view) { orchestrator.cancel(); setDrinkPresentation(null); setBusy(false); setAnswerVisible(false); setFinalActionsVisible(false); setVictoryVisible(false); setVictoryCardVisible(false); setCrownVisible(false); setScoreVisible(false); return; }
    if (!before || before.game.id !== view.game.id || disconnected.current) {
      orchestrator.hydrate(view.game.id, view.game.stateVersion);
      setDrinkPresentation(null);
      setBusy(false);
      setAnswerVisible(initialAnswer(view));
      setFinalActionsVisible(view.game.status === 'FINISHED');
      setVictoryVisible(view.game.status === 'FINISHED');
      setVictoryCardVisible(view.game.status === 'FINISHED');
      setCrownVisible(view.game.status === 'FINISHED');
      setScoreVisible(view.game.status === 'FINISHED');
      return;
    }
    if (view.game.stateVersion <= before.game.stateVersion) return;
    const effects = effectsBetween(before, view);
    const revealing = effects.some((effect) => effect.type === 'ANSWER_REVEAL');
    if (!revealing) setAnswerVisible(initialAnswer(view));
    if (effects.some((effect) => effect.type === 'VICTORY') || view.game.status !== 'FINISHED') {
      setFinalActionsVisible(false); setVictoryVisible(false); setVictoryCardVisible(false); setCrownVisible(false); setScoreVisible(false);
    }
    if (!effects.length) return;
    setBusy(true);
    activeRuns.current += 1;
    for (const effect of effects) {
      void orchestrator.enqueue(effect, async (confirmed, signal) => {
        const key = `${confirmed.gameId}:${confirmed.stateVersion}:${confirmed.id}:${confirmed.type}`;
        if (confirmed.type === 'INCORRECT_AND_DRINK') {
          setDrinkPresentation({ key, player: confirmed.player, drinkCount: confirmed.drinkCount });
          // The portal must be mounted before the shared timeline queries its targets.
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (signal.aborted) return;
        }
        if (confirmed.type === 'VICTORY') {
          setVictoryVisible(true);
          // Let React mount the crown and winner targets before starting the JSON timeline.
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (signal.aborted) return;
        }
        const sequence = sequenceFor(confirmed);
        try { await runSequence(reducedRef.current ? reduceSequence(sequence) : sequence, {
          root: root(), audio, reduced: reducedRef.current, signal, effect: confirmed,
          key,
          onAnswerMidpoint: () => { if (!signal.aborted && current.current?.capabilities.canSeeAnswer) setAnswerVisible(true); },
          onFinalActions: () => { if (!signal.aborted) setFinalActionsVisible(true); },
          onWinnerCard: () => { if (!signal.aborted) setVictoryCardVisible(true); },
          onCrown: () => { if (!signal.aborted) setCrownVisible(true); },
          onScore: () => { if (!signal.aborted) setScoreVisible(true); },
        }); } finally {
          if (confirmed.type === 'INCORRECT_AND_DRINK') setDrinkPresentation((active) => active?.key === key ? null : active);
        }
      }).catch(() => undefined);
    }
    void orchestrator.settled().then(() => {
      activeRuns.current -= 1;
      if (activeRuns.current <= 0) { activeRuns.current = 0; setBusy(false); }
    });
  }, [view, orchestrator, root, audio]);

  const unlockAudio = useCallback(() => audio.unlock(), [audio]);
  const toggleSound = useCallback(() => { audio.unlock(); setSoundEnabled(audio.toggle()); }, [audio]);

  const disconnect = useCallback((present = true) => {
    disconnected.current = true;
    setReconnectVisible(false);
    setDrinkPresentation(null);
    orchestrator.cancel(); audio.stop(); auxiliary.current.abort(); auxiliary.current = new AbortController();
    if (!present) return;
    const sequence = connectionSequence(false);
    void runSequence(reducedRef.current ? reduceSequence(sequence) : sequence, { root: root(), audio, reduced: reducedRef.current, signal: auxiliary.current.signal, key: 'disconnect' });
  }, [orchestrator, audio, root]);

  /** Call after fetching the safe, current view and restoring the private channel. */
  const reconnect = useCallback((present = true) => {
    disconnected.current = false;
    if (current.current) orchestrator.hydrate(current.current.game.id, current.current.game.stateVersion);
    auxiliary.current.abort(); auxiliary.current = new AbortController();
    if (!present) { setBusy(false); setReconnectVisible(false); return; }
    const sequence = connectionSequence(true);
    setReconnectVisible(true);
    setBusy(true);
    void runSequence(reducedRef.current ? reduceSequence(sequence) : sequence, {
      root: root(), audio, reduced: reducedRef.current, signal: auxiliary.current.signal, key: 'reconnect',
    }).finally(() => { setBusy(false); setReconnectVisible(false); });
  }, [orchestrator, audio, root]);

  const claimPending = useCallback((claimant?: PlayerRole) => {
    void claimant;
    const sequence = claimRequestSequence();
    void runSequence(reducedRef.current ? reduceSequence(sequence) : sequence, { root: root(), audio, reduced: reducedRef.current, signal: auxiliary.current.signal, key: 'claim-request' });
  }, [root, audio]);

  return { busy, answerVisible, finalActionsVisible, victoryVisible, victoryCardVisible, crownVisible, scoreVisible, reconnectVisible, drinkPresentation, soundEnabled, unlockAudio, toggleSound, disconnect, reconnect, claimPending, reducedMotion: reduced };
}
