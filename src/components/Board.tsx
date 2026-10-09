import { useId, useLayoutEffect, useRef, useState } from 'react';
import copy from '../../data/copy_ca.json';
import type { BoardCell, PlayerPositions, PlayerRole } from '../domain/game/game-types';
import { boardWindow, BOARD_WINDOW_STEP } from '../domain/game/board-window';
import { boardCopy } from '../content/board';
import { ArtIconButton } from './art';
import '../art-system/board.css';

export interface BoardPoint { x: number; y: number }

// The production board-v2 route is retained; its centres are sampled by arc
// length so every persisted board length uses the same physical playing surface.
const curveEnds: BoardPoint[] = [
  { x: 142.5, y: 452.5 }, { x: 250, y: 435 }, { x: 367.5, y: 412.5 },
  { x: 486.5, y: 382.5 }, { x: 604, y: 355 }, { x: 722.5, y: 325 },
  { x: 842.5, y: 300 }, { x: 962.5, y: 275 }, { x: 1070, y: 250 },
  { x: 1062.5, y: 152.5 }, { x: 940, y: 120 }, { x: 802.5, y: 110 },
  { x: 660, y: 107.5 }, { x: 507.5, y: 105 }, { x: 430, y: 80 },
];
const routePath = 'M95 505 Q95 505 142.5 452.5 T250 435 T367.5 412.5 T486.5 382.5 T604 355 T722.5 325 T842.5 300 T962.5 275 T1070 250 T1062.5 152.5 T940 120 T802.5 110 T660 107.5 T507.5 105 T430 80';
const sampledRoute: Array<BoardPoint & { distance: number }> = [{ x: 95, y: 505, distance: 0 }];
let previous = { x: 95, y: 505 };
let control = previous;
for (const end of curveEnds) {
  const start = previous;
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const point = {
      x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
      y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
    };
    const last = sampledRoute[sampledRoute.length - 1];
    sampledRoute.push({ ...point, distance: last.distance + Math.hypot(point.x - last.x, point.y - last.y) });
  }
  previous = end;
  control = { x: end.x * 2 - control.x, y: end.y * 2 - control.y };
}
const totalDistance = sampledRoute[sampledRoute.length - 1].distance;
let measuredRoute: SVGPathElement | null = null;

function routePoint(fraction: number): BoardPoint {
  const bounded = Math.max(0, Math.min(1, fraction));
  if (measuredRoute?.isConnected) {
    const point = measuredRoute.getPointAtLength(bounded * measuredRoute.getTotalLength());
    return { x: point.x, y: point.y };
  }
  const distance = bounded * totalDistance;
  const next = sampledRoute.findIndex(point => point.distance >= distance);
  if (next <= 0) return sampledRoute[0];
  const a = sampledRoute[next - 1];
  const b = sampledRoute[next];
  const ratio = (distance - a.distance) / (b.distance - a.distance || 1);
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
}

export function boardPoint(position: number, finishPosition: number): BoardPoint {
  return routePoint(position / Math.max(1, finishPosition));
}

export function boardPathBetween(from: number, to: number, finishPosition: number): BoardPoint[] {
  const count = Math.max(12, Math.abs(to - from) * 24);
  return Array.from({ length: count + 1 }, (_, i) => boardPoint(from + (to - from) * i / count, finishPosition));
}

interface BoardProps {
  cells: BoardCell[];
  positions: PlayerPositions;
  activePlayer: PlayerRole;
  targetPosition?: number | null;
  finishPosition: number;
  busy?: boolean;
}

const slabShape = 'M92 31C231 22 399 32 557 28L1093 33C1135 33 1162 49 1174 78C1188 159 1182 411 1172 523C1168 564 1142 588 1096 590L111 591C67 590 38 570 33 536C25 400 29 214 36 91C39 52 58 35 92 31Z';
const insetShape = 'M105 63C263 56 396 63 552 59L1090 64C1122 64 1141 76 1147 100C1155 224 1153 411 1145 516C1142 544 1125 559 1093 561L116 562C86 562 66 548 62 524C57 403 61 218 65 108C68 78 80 66 105 63Z';
const tileColors = {
  PERSONAL: ['#e2dfc9', '#bfcac1', '#8fa6a4'],
  CROSSED: ['#e4dfbf', '#c3c79e', '#929d75'],
  TP: ['#e4d7cf', '#cbb9c6', '#a58da7'],
} as const;

function tileShape(width: number, height: number): string {
  const x = width / 2, y = height / 2;
  return `M${-x + 17} ${-y}Q${-x + 1} ${-y - 1} ${-x} ${-y + 16}L${-x + 1} ${y - 15}Q${-x + 2} ${y + 1} ${-x + 18} ${y}L${x - 16} ${y - 1}Q${x + 2} ${y - 1} ${x} ${y - 17}L${x - 1} ${-y + 15}Q${x - 2} ${-y - 2} ${x - 19} ${-y + 1}Z`;
}

export function Board({ cells, positions, activePlayer, targetPosition, finishPosition, busy = false }: BoardProps) {
  const id = useId().replaceAll(':', '');
  const focus = targetPosition ?? Math.min(finishPosition, positions[activePlayer] + 1);
  const focusKey = `${targetPosition}:${activePlayer}:${positions.PAU}:${positions.TECLA}`;
  const [browsing, setBrowsing] = useState<{ key: string; start: number } | null>(null);
  const window = boardWindow(finishPosition, focus, browsing?.key === focusKey ? browsing.start : undefined);
  const windowLength = window.end - window.start;
  const visiblePoint = (position: number) => boardPoint(Math.min(window.end, Math.max(window.start, position)) - window.start, windowLength);
  const fraction = (position: number) => (Math.min(window.end, Math.max(window.start, position)) - window.start) / windowLength;
  const visibleCells = cells.filter(cell => cell.position >= window.start && cell.position <= window.end);
  const outsidePlayers = (['PAU', 'TECLA'] as const).filter(player => positions[player] < window.start || positions[player] > window.end);
  const pathRef = useRef<SVGPathElement>(null);
  const [, measureGeometry] = useState(0);
  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    measuredRoute = path;
    measureGeometry(version => version + 1);
    return () => { if (measuredRoute === path) measuredRoute = null; };
  }, [finishPosition]);
  const samePosition = positions.PAU === positions.TECLA;
  const badgePoint = visiblePoint(targetPosition ?? 1);
  const shortBoard = windowLength <= 7;
  const tileWidth = shortBoard ? 148 : windowLength <= 9 ? 124 : windowLength <= 12 ? 108 : 91;
  const tileHeight = shortBoard ? 124 : windowLength <= 9 ? 105 : windowLength <= 12 ? 92 : 79;
  const ceramicShape = tileShape(tileWidth, tileHeight);
  const iconSize = Math.min(shortBoard ? 74 : 63, tileWidth * .55);
  const pawnWidth = shortBoard ? 88 : 78;
  const pawnHeight = shortBoard ? 118 : 104;
  return (
    <div className="board-display" data-board-window-start={window.start} data-board-window-end={window.end}>
    <div className="board-perspective-shell art-board">
      <svg className="game-board" viewBox="0 0 1210 625" role="img" aria-label={`${copy.appTitle} · ${copy.start} — ${copy.finish}`}>
        <defs>
          <filter id={`${id}-contact`} x="-15%" y="-20%" width="130%" height="155%"><feDropShadow dx="-4" dy="4" stdDeviation="3" floodColor="#352114" floodOpacity=".44" /><feDropShadow dx="-10" dy="17" stdDeviation="10" floodColor="#3c2618" floodOpacity=".32" /></filter>
          <linearGradient id={`${id}-wood`} x1="1" y1="0" x2="0" y2="1"><stop stopColor="#d9b27c" /><stop offset=".36" stopColor="#c39059" /><stop offset="1" stopColor="#926038" /></linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a77140" /><stop offset=".62" stopColor="#744629" /><stop offset="1" stopColor="#573821" /></linearGradient>
          <linearGradient id={`${id}-inset`} x1="1" y1="0" x2="0" y2="1"><stop stopColor="#dbc294" /><stop offset=".48" stopColor="#c8a16d" /><stop offset="1" stopColor="#b48553" /></linearGradient>
          <linearGradient id={`${id}-brass`} x1="1" y1="0" x2="0" y2="1"><stop stopColor="#e0c58e" /><stop offset=".42" stopColor="#c19a56" /><stop offset="1" stopColor="#98723e" /></linearGradient>
          <pattern id={`${id}-grain`} width="247" height="79" patternUnits="userSpaceOnUse"><g fill="none" stroke="#6e452c" strokeWidth="1"><path d="M-10 9C34 17 61 0 114 8S204 18 262 8M-8 24C48 16 80 35 143 23S215 21 259 27M-8 47C42 50 59 35 97 39S157 51 259 43M-8 64C54 55 103 72 162 62S221 55 262 65" /><path d="M4 34C57 27 117 42 236 35M13 72C67 66 113 77 207 70" strokeOpacity=".48" /></g><g fill="none" stroke="#efd0a0" strokeWidth="1.3" opacity=".55"><path d="M-8 18C65 7 132 29 260 16M-8 54C76 44 140 60 260 51" /></g></pattern>
          <pattern id={`${id}-clay-speckle`} width="37" height="31" patternUnits="userSpaceOnUse"><g fill="#684d3d" opacity=".18"><circle cx="7" cy="9" r=".7" /><circle cx="24" cy="21" r=".9" /><circle cx="31" cy="5" r=".45" /></g><path d="m13 15 4-1m-1 12 3 .3" stroke="#f9edd4" strokeWidth="1" opacity=".35" /></pattern>
          <clipPath id={`${id}-face-clip`}><path d={slabShape} /></clipPath>
          {(['PERSONAL', 'CROSSED', 'TP'] as const).map(type => <linearGradient key={type} id={`${id}-tile-${type}`} x1="1" y1="0" x2="0" y2="1"><stop stopColor={tileColors[type][0]} /><stop offset=".53" stopColor={tileColors[type][1]} /><stop offset="1" stopColor={tileColors[type][2]} /></linearGradient>)}
        </defs>
        <g className="board-slab" filter={`url(#${id}-contact)`}>
          <path d={slabShape} transform="translate(-2 15)" fill={`url(#${id}-edge)`} stroke="#513422" strokeWidth="3" />
          <path d={slabShape} fill={`url(#${id}-wood)`} stroke="#795033" strokeWidth="3" />
          <path d={slabShape} transform="translate(14 10) scale(.976 .963)" fill="none" stroke="#f0d4a5" strokeWidth="2.7" opacity=".75" />
          <path d={insetShape} fill={`url(#${id}-inset)`} stroke="#8c613c" strokeWidth="2.2" />
          <path d={insetShape} transform="translate(5 4) scale(.992 .984)" fill="none" stroke="#f2d9ab" strokeWidth="2" opacity=".75" />
          <g className="board-painted-grain" clipPath={`url(#${id}-face-clip)`} opacity=".28" aria-hidden="true"><svg x="0" y="0" width="1210" height="625" viewBox="350 495 1000 340" preserveAspectRatio="none"><image href="/assets/production/backgrounds/sitges_scene_desktop_ai.webp" width="1672" height="941" /></svg></g>
          <g clipPath={`url(#${id}-face-clip)`} className="board-grain">
            <path d={slabShape} fill={`url(#${id}-grain)`} opacity=".63" />
            <g fill="none" stroke="#865633" opacity=".4"><path d="M191 258c35-15 63-11 88 3s69 18 120 9M205 260c12-14 46-16 63-3s2 29-28 24-36-13-35-21Z" /><path d="M215 262c8-7 32-8 41 0s-3 14-19 12-27-7-22-12Z" /><path d="M242 253c73-19 160 1 205 5M192 285c79 1 132 10 207 0M809 442c68-8 91 13 161 7M838 451c-13-14 18-23 36-12s2 27-18 19-18-7-18-7Z" /></g>
            <g fill="none" stroke="#654629" strokeWidth="1.4" opacity=".3"><path d="M58 73c152-6 268 2 420-3M78 551c167-8 304 3 433-1M766 73c123-4 240 4 365 0M718 550c163 8 286-1 405 0" /></g>
          </g>
          <g className="board-engraving" transform="translate(295 208)">
            <path d="M-88 25C-49 18-13-3 12-37M-52 11c-13-1-28-15-25-24 14 1 28 9 25 24ZM-26-4c-15-7-17-19-13-25 12 5 16 17 13 25ZM-9-23c2-14 12-26 22-26-1 13-10 23-22 26Z" />
            <path d="M102 24C66 18 35-4 19-39M70 11c12-3 23-17 19-25-13 4-22 14-19 25ZM45-7c12-8 13-21 7-27-10 6-12 19-7 27Z" />
            <text x="8" y="61" textAnchor="middle">Alcoholfabet</text>
            <path d="M-63 84q21-8 41 0t42 0 42 0" />
          </g>
        </g>
        <path d={routePath} fill="none" stroke="#785434" strokeWidth="8" strokeOpacity=".55" strokeLinecap="round" />
        <path ref={pathRef} data-motion="boardPath" d={routePath} fill="none" stroke="#eed8ae" strokeWidth="2" strokeOpacity=".75" strokeLinecap="round" />
        {visibleCells.map(cell => {
          const point = visiblePoint(cell.position);
          const next = visiblePoint(cell.position + .03);
          let angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI;
          if (angle > 90 || angle < -90) angle += 180;
          const rotation = Math.max(-15, Math.min(15, angle * .18));
          const target = targetPosition === cell.position;
          return (
            <g key={cell.position} className={`board-cell art-tile art-tile--${cell.type.toLowerCase()}${target ? ' board-cell--target' : ''}`} transform={`translate(${point.x} ${point.y})`} data-board-position={cell.position} data-board-fraction={fraction(cell.position)} data-board-x={point.x} data-board-y={point.y}>
              <g transform={`rotate(${rotation})`}>
                <rect x={-tileWidth / 2 - 5} y={-tileHeight / 2 - 4} width={tileWidth + 10} height={tileHeight + 10} rx="20" className="tile-socket" />
                <path d={ceramicShape} transform="translate(-2 6)" fill="#81664c" stroke="#785c43" strokeWidth="2" />
                <path d={ceramicShape} fill={`url(#${id}-tile-${cell.type})`} stroke="#80674f" strokeWidth="2.4" />
                <path d={ceramicShape} fill={`url(#${id}-clay-speckle)`} />
                <path d={ceramicShape} transform="scale(.92 .90)" fill="none" stroke="#fbecd0" strokeWidth="1.7" strokeOpacity=".7" />
                {target ? <path data-motion="targetCell" className="target-cell-ring" d={tileShape(tileWidth + 17, tileHeight + 16)} fill="none" strokeWidth="4" /> : null}
                <image href={`/assets/production/art/icons/${cell.type === 'PERSONAL' ? 'personal' : cell.type === 'TP' ? 'tp' : 'crossed'}.svg`} x={-iconSize / 2} y={-iconSize / 2 - 7} width={iconSize} height={iconSize} />
                <g className="tile-pattern" fill="none" strokeWidth="1.5"><path d={`M${-tileWidth * .28} ${tileHeight * .30}q8-5 16 0t16 0`} />{cell.type === 'PERSONAL' ? <path d={`M${-tileWidth * .28} ${tileHeight * .36}q8-5 16 0t16 0`} /> : cell.type === 'CROSSED' ? <path d={`m${-tileWidth * .23} ${tileHeight * .28}-3-5m14 5 3-5`} /> : <path d={`m${-tileWidth * .2} ${tileHeight * .25} 5 7m10-7-5 7`} />}</g>
                <text x={tileWidth * .34} y={tileHeight * .35} textAnchor="end" className="cell-number">{cell.position}</text>
                {cell.modifier === 'PLUS_ONE' ? <g transform={`translate(${tileWidth * .37} ${-tileHeight * .38})`} className="cell-bonus-seal"><path d="M-19-14Q-17-20-8-19L13-18Q21-16 19-7L17 13Q15 20 5 18L-15 17Q-22 15-20 6Z" fill={`url(#${id}-brass)`} stroke="#765833" strokeWidth="1.6" /><path d="M-13-11 10-12M-12 12 9 13" fill="none" stroke="#f1d7a5" strokeWidth="1" /><text y="6" textAnchor="middle" className="cell-plus">+1</text></g> : null}
              </g>
            </g>
          );
        })}
        {[0, finishPosition].filter(position => position >= window.start && position <= window.end).map(position => {
          const point = visiblePoint(position);
          const start = position === 0;
          const denseBoard = windowLength > 12;
          const width = denseBoard && !start ? 123 : 165;
          const height = denseBoard && start ? 90 : 112;
          const shape = tileShape(width, height);
          return <g key={position} className={`board-end board-end--${start ? 'start' : 'finish'}`} data-board-position={position} data-board-fraction={fraction(position)} data-board-x={point.x} data-board-y={point.y} transform={`translate(${point.x} ${point.y})`}>
            <g transform={denseBoard && start ? 'translate(0 30)' : undefined}>
              <path d={shape} transform="translate(-2 7)" fill="#745137" stroke="#63412b" strokeWidth="2" />
              <path d={shape} fill={start ? `url(#${id}-wood)` : `url(#${id}-brass)`} stroke="#866139" strokeWidth="2.5" />
              <path d={tileShape(width - 13, height - 12)} fill="none" stroke="#efd6a3" strokeWidth="1.8" />
              <g transform="translate(0 -22)" className="board-end-engraving">{start ? <path d="M-14 9C-18-6-7-19 1-24 10-12 15-1 9 10M-6 13 1-16M-6-1l9 5" /> : <path d="m-24-14 10 9 14-18 14 18 10-9-5 23h-38ZM-19 15h38" />}</g>
              <text y="37" textAnchor="middle" className="board-end-label">{start ? copy.start : copy.finish}</text>
            </g>
          </g>;
        })}
        {(['PAU', 'TECLA'] as const).map(player => {
          const point = visiblePoint(positions[player]);
          const outside = positions[player] < window.start || positions[player] > window.end;
          const offset = samePosition ? player === 'PAU' ? -18 : 18 : 0;
          const x = point.x + offset;
          const y = point.y + 10;
          return <g key={player} className={`board-pawn art-pawn art-pawn--${player.toLowerCase()}${player === activePlayer ? ' board-pawn--active' : ''}${outside ? ' board-pawn--outside' : ''}`} transform={`translate(${x} ${y})`} data-motion={`pawn-${player}`} data-board-position={positions[player]} data-board-fraction={fraction(positions[player])} data-board-x={x} data-board-y={y} aria-label={`${player === 'PAU' ? copy.pau : copy.tecla}: ${positions[player]} / ${finishPosition}`}>
            {!outside && <>
              <ellipse cx="-4" cy="-2" rx={shortBoard ? 33 : 29} ry={shortBoard ? 10 : 9} className="pawn-shadow" />
              <g data-pawn-body="true"><image href={`/assets/production/pawns/pawn_${player.toLowerCase()}.svg`} x={-pawnWidth / 2} y={4 - pawnHeight} width={pawnWidth} height={pawnHeight} /></g>
            </>}
          </g>;
        })}
        <image data-motion="plusOneBadge" className="board-plus-badge" href="/assets/production/effects/plus_one_badge.svg" x={badgePoint.x - 80} y={badgePoint.y - 120} width="160" height="112" />
      </svg>
      <div className="board-caption" aria-hidden="true"><span className="board-caption-line" /><span>{copy.appTitle}</span><span className="board-caption-line" /></div>
    </div>
    {finishPosition > 15 && <nav className="board-navigation" aria-label={copy.appTitle + ' · ' + copy.start + ' — ' + copy.finish}>
      <ArtIconButton icon="back" aria-label={boardCopy.previous} disabled={busy || window.start === 0} onClick={() => setBrowsing({ key: focusKey, start: window.start - BOARD_WINDOW_STEP })} />
      <span className="board-navigation-copy"><span>{boardCopy.range(window.start, window.end, finishPosition)}</span>
        {outsidePlayers.length > 0 && <small className="board-outside-players">{outsidePlayers.map(player => <span className={`board-outside-label board-outside-label--${player.toLowerCase()}`} key={player}>{positions[player] < window.start ? '← ' : ''}{player === 'PAU' ? copy.pau : copy.tecla}: {positions[player]}{positions[player] > window.end ? ' →' : ''}</span>)}</small>}
      </span>
      <ArtIconButton icon="back" className="board-navigation-next" aria-label={boardCopy.next} disabled={busy || window.start === window.lastStart} onClick={() => setBrowsing({ key: focusKey, start: window.start + BOARD_WINDOW_STEP })} />
    </nav>}
    </div>
  );
}
