import copy from '../../data/copy_ca.json';
import type { PlayerRole } from '../domain/game/game-types';

interface PlayerBadgeProps {
  player: PlayerRole;
  position?: number;
  finishPosition?: number;
  active?: boolean;
}

export function PlayerBadge({ player, position, finishPosition, active = false }: PlayerBadgeProps) {
  const pau = player === 'PAU';
  const name = pau ? copy.pau : copy.tecla;
  const progress = position !== undefined && finishPosition !== undefined;
  return (
    <div className={`player-badge player-badge--${player.toLowerCase()}${active ? ' is-active' : ''}`}>
      <span className="player-marker" aria-hidden="true" />
      <div className="player-details">
        <strong>{name}</strong>
        {progress ? (
          <div className="player-progress" aria-label={`${name}: ${position} / ${finishPosition}`}>
            <span className="progress-track"><span style={{ width: `${Math.min(100, position / finishPosition * 100)}%` }} /></span>
            <small>{position}<span> / {finishPosition}</span></small>
          </div>
        ) : null}
      </div>
    </div>
  );
}
