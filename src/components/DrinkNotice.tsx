import type { HTMLAttributes } from 'react';
import type { PlayerRole } from '../domain/game/game-types';
import { drinkCopy } from '../content/drink';
import '../art-system/drink.css';

interface FilledDrinkGlassProps extends HTMLAttributes<HTMLSpanElement> {
  double?: boolean;
}

/** One original filled glass, shared by the result and the timed physical entry. */
export function FilledDrinkGlass({ double = false, className = '', ...props }: FilledDrinkGlassProps) {
  return <span {...props} className={`filled-drink-glass ${className}`.trim()} aria-hidden="true">
    <img src="/assets/production/effects/drink-filled.svg" alt="" draggable={false} />
    {double && <span className="filled-drink-glass__double">×2</span>}
  </span>;
}

interface DrinkNoticeProps {
  player: PlayerRole;
  double?: boolean;
}

export function DrinkNotice({ player, double = false }: DrinkNoticeProps) {
  return <div className="drink-notice" data-motion="drinkNotice" data-drink-player={player} data-drink-count={double ? 2 : 1} role="status">
    <div className="drink-notice__glasses" aria-hidden="true">
      <FilledDrinkGlass double={double} data-motion="drinkGlass" />
      {double && <FilledDrinkGlass className="drink-notice__second-glass" data-motion="drinkSecondGlass" />}
      <div className="drink-bubbles" data-motion="drinkBubbles" />
    </div>
    <div className="drink-notice__copy">
      <strong>{drinkCopy[player]}</strong>
      {double && <span>{drinkCopy.double}</span>}
    </div>
  </div>;
}
