import { useEffect, useRef } from 'react';
import { motionTokens } from '../lib/motionTokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  phase: 'hidden' | 'question' | 'answer';
  category: string;
  question: string;
  answer?: string | null;
  onAnimationEnd?: () => void;
};

export function QuestionCardMotion({ phase, category, question, answer, onAnimationEnd }: Props) {
  const shellRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const previous = useRef(phase);
  const reduced = useReducedMotion();

  useEffect(() => {
    const shell = shellRef.current;
    const inner = innerRef.current;
    if (!shell || !inner) return;

    if (phase === 'question' && previous.current === 'hidden') {
      const animation = shell.animate(
        reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
          { opacity: 0, transform: 'translate(8px,24px) rotate(1.2deg)' },
          { opacity: 1, transform: 'translate(0,0) rotate(0deg)' },
        ],
        { duration: reduced ? 100 : motionTokens.duration.cardEnter, easing: motionTokens.easing.enter, fill: 'both' },
      );
      animation.finished.then(onAnimationEnd).catch(() => undefined);
    }

    if (phase === 'answer' && previous.current !== 'answer') {
      const animation = inner.animate(
        reduced ? [{ opacity: .3 }, { opacity: 1 }] : [
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(90deg)', offset: .5 },
          { transform: 'rotateY(0deg)' },
        ],
        { duration: reduced ? 120 : motionTokens.duration.cardFlip, easing: motionTokens.easing.enter },
      );
      animation.finished.then(onAnimationEnd).catch(() => undefined);
    }
    previous.current = phase;
  }, [phase, reduced, onAnimationEnd]);

  if (phase === 'hidden') return null;
  return (
    <article ref={shellRef} className="tp-question-card">
      <div ref={innerRef} className="tp-question-card__inner">
        <p className="tp-question-card__category">{category}</p>
        <h2>{question}</h2>
        {phase === 'answer' && answer ? (
          <div className="tp-question-card__answer"><span>Resposta correcta</span><strong>{answer}</strong></div>
        ) : null}
      </div>
    </article>
  );
}
