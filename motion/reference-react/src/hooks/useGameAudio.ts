import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Cue = 'turn_start' | 'card_slide' | 'card_flip' | 'correct' | 'incorrect' | 'pawn_step' | 'plus_one' | 'drink' | 'double_drink' | 'victory';

const cueFiles: Record<Cue, string> = {
  turn_start: '/sounds/turn_start.wav',
  card_slide: '/sounds/card_slide.wav',
  card_flip: '/sounds/card_flip.wav',
  correct: '/sounds/correct.wav',
  incorrect: '/sounds/incorrect.wav',
  pawn_step: '/sounds/pawn_step.wav',
  plus_one: '/sounds/plus_one.wav',
  drink: '/sounds/drink.wav',
  double_drink: '/sounds/double_drink.wav',
  victory: '/sounds/victory.wav',
};

export function useGameAudio() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('tp:sound') !== 'off');
  const unlocked = useRef(false);
  const lastPlayed = useRef(new Map<string, number>());
  const audio = useMemo(() => new Map<Cue, HTMLAudioElement>(), []);

  useEffect(() => {
    for (const [cue, src] of Object.entries(cueFiles) as [Cue, string][]) {
      const element = new Audio(src);
      element.preload = 'auto';
      element.volume = 0.48;
      audio.set(cue, element);
    }
    return () => audio.forEach((element) => { element.pause(); element.src = ''; });
  }, [audio]);

  const unlock = useCallback(() => { unlocked.current = true; }, []);

  const play = useCallback((cue: Cue, dedupeKey?: string) => {
    if (!enabled || !unlocked.current) return;
    const now = performance.now();
    const key = dedupeKey ?? cue;
    if (now - (lastPlayed.current.get(key) ?? -Infinity) < 180) return;
    lastPlayed.current.set(key, now);
    const element = audio.get(cue);
    if (!element) return;
    element.currentTime = 0;
    void element.play().catch(() => undefined);
  }, [audio, enabled]);

  const toggle = useCallback(() => {
    setEnabled((value) => {
      localStorage.setItem('tp:sound', value ? 'off' : 'on');
      return !value;
    });
  }, []);

  return { enabled, toggle, unlock, play };
}
