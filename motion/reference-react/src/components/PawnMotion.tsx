import { useEffect, useRef } from 'react';
import { motionTokens } from '../lib/motionTokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Point = { x: number; y: number };
type Props = {
  player: 'PAU' | 'TECLA';
  position: number;
  points: Point[];
  onStep?: (position: number) => void;
};

export function PawnMotion({ player, position, points, onStep }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(position);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || position === previous.current) return;
    const from = previous.current;
    const direction = position > from ? 1 : -1;
    const targets: number[] = [];
    for (let p = from + direction; direction > 0 ? p <= position : p >= position; p += direction) targets.push(p);

    let cancelled = false;
    const run = async () => {
      for (const target of targets) {
        if (cancelled) return;
        const point = points[target] ?? points[points.length - 1];
        const animation = element.animate(
          reduced ? [{ opacity: .6 }, { opacity: 1 }] : [
            { transform: 'translate(-50%,-100%) translateY(0)' },
            { transform: 'translate(-50%,-100%) translateY(-7px)', offset: .5 },
            { transform: 'translate(-50%,-100%) translateY(0)' },
          ],
          { duration: reduced ? 100 : motionTokens.duration.pawnStep, easing: motionTokens.easing.pawn },
        );
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
        await animation.finished.catch(() => undefined);
        onStep?.(target);
      }
      previous.current = position;
    };
    void run();
    return () => { cancelled = true; };
  }, [position, points, onStep, reduced]);

  const point = points[Math.min(previous.current, points.length - 1)] ?? { x: 0, y: 0 };
  return <div ref={ref} className={`tp-pawn tp-pawn--${player.toLowerCase()}`} style={{ left: point.x, top: point.y }} aria-label={player === 'PAU' ? "Peça d'en Pau" : 'Peça de la Tecla'} />;
}
