import { Board } from './Board';
import { FilledDrinkGlass } from './DrinkNotice';
import type { BoardCell } from '../domain/game/game-types';

const cells: BoardCell[] = Array.from({ length: 9 }, (_, index) => ({
  position: index + 1,
  type: index % 5 === 2 ? 'TP' : index % 2 === 0 ? 'PERSONAL' : 'CROSSED',
  modifier: index === 4 ? 'PLUS_ONE' : 'NONE',
}));

export function HomeTable() {
  return <div className="home-table" aria-hidden="true">
    <Board cells={cells} positions={{ PAU: 3, TECLA: 2 }} activePlayer="PAU" finishPosition={10} />
    <div className="home-table__glasses"><FilledDrinkGlass /><FilledDrinkGlass /></div>
  </div>;
}
