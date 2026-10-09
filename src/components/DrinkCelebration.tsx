import { useId } from 'react';
import { createPortal } from 'react-dom';
import type { PlayerRole } from '../domain/game/game-types';
import { drinkCopy } from '../content/drink';
import '../art-system/drink-stage.css';

export interface DrinkPresentation {
  key: string;
  player: PlayerRole;
  drinkCount: 1 | 2;
}

/** Vector glass: independent liquid and reflection layers stay sharp at every size. */
function ToastGlass({ second = false }: { second?: boolean }) {
  const id = useId().replace(/:/g, '');
  const target = second ? 'drinkHeroSecond' : 'drinkHeroFirst';
  return <div className="drink-stage__glass" data-motion={target}>
    <svg viewBox="0 0 220 290" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glass`} x1="35" y1="100" x2="190" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff5db" stopOpacity=".62" /><stop offset=".2" stopColor="#fff7e5" stopOpacity=".15" />
          <stop offset=".72" stopColor="#d6b889" stopOpacity=".12" /><stop offset="1" stopColor="#fff5de" stopOpacity=".7" />
        </linearGradient>
        <linearGradient id={`${id}-amber`} x1="110" y1="106" x2="110" y2="259" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6c064" /><stop offset=".48" stopColor="#d79131" /><stop offset="1" stopColor="#99531e" />
        </linearGradient>
        <linearGradient id={`${id}-ice`} x1="65" y1="105" x2="150" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffefc8" stopOpacity=".87" /><stop offset="1" stopColor="#f2d38c" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="-30" y1="0" x2="45" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff9e9" stopOpacity="0" /><stop offset=".5" stopColor="#fff9e9" stopOpacity=".7" /><stop offset="1" stopColor="#fff9e9" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-inside`}><path d="M39 37Q110 60 181 37L168 243Q165 260 110 260Q55 260 52 243Z" /></clipPath>
      </defs>
      <ellipse cx="110" cy="270" rx="72" ry="10" fill="#22180f" opacity=".24" />
      <path d="M33 34Q110 9 187 34L174 247Q172 273 110 274Q48 273 46 247Z" fill={`url(#${id}-glass)`} stroke="#f5e5c3" strokeWidth="2.4" />
      <g clipPath={`url(#${id}-inside)`}>
        <g className="drink-stage__liquid" data-motion={second ? 'drinkLiquidSecond' : 'drinkLiquidFirst'}>
          <path d="M21 113Q65 100 110 112T199 113V281H21Z" fill={`url(#${id}-amber)`} />
          <ellipse cx="110" cy="112" rx="83" ry="13" fill="#f9cf7b" />
          <ellipse cx="110" cy="115" rx="76" ry="8" fill="#dea348" opacity=".65" />
          <path d="m59 126 39-10q5-1 7 5l10 38q2 6-4 8l-36 9q-6 1-8-5l-12-37q-2-6 4-8Z" fill={`url(#${id}-ice)`} stroke="#fff1cc" strokeOpacity=".7" strokeWidth="1.8" />
          <path d="m117 137 35 6q7 1 6 8l-6 37q-1 6-7 5l-37-6q-6-1-5-7l7-36q1-8 7-7Z" fill={`url(#${id}-ice)`} stroke="#ffedbf" strokeOpacity=".58" strokeWidth="1.8" />
          <path d="m61 133 35-9 8 29-36 9M117 146l33 5-5 32-33-5" stroke="#fff4d8" strokeOpacity=".48" strokeWidth="2" strokeLinejoin="round" />
          <g fill="#ffe1a1" opacity=".75"><circle cx="83" cy="204" r="3" /><circle cx="145" cy="217" r="2.5" /><circle cx="98" cy="233" r="2" /><circle cx="160" cy="170" r="2" /><circle cx="64" cy="193" r="1.8" /></g>
        </g>
        <path d="M48 43 58 240Q64 252 84 255" stroke="#fff8e6" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
        <path d="m172 52-10 178" stroke="#fff5d9" strokeOpacity=".44" strokeWidth="3" strokeLinecap="round" />
        <g className="drink-stage__sheen" data-motion={second ? 'drinkSheenSecond' : 'drinkSheenFirst'}>
          <path d="M-30 20H45L92 279H17Z" fill={`url(#${id}-shine)`} />
        </g>
      </g>
      <path d="M33 34Q110 58 187 34M46 243Q110 266 174 243" stroke="#fff4d9" strokeOpacity=".62" strokeWidth="2.6" />
      <ellipse cx="110" cy="34" rx="77" ry="17" fill="#f7edcf" fillOpacity=".1" stroke="#fff4d9" strokeWidth="2.8" />
      <path d="M44 29Q81 14 132 20" stroke="#fff9ec" strokeWidth="3" strokeLinecap="round" />
      <path d="m41 58 5 57" stroke="#fff9e9" strokeOpacity=".8" strokeWidth="4" strokeLinecap="round" />
      <path d="M54 253Q110 277 167 253" stroke="#ffe7b4" strokeOpacity=".72" strokeWidth="4.5" strokeLinecap="round" />
      <g fill="#fff5da" opacity=".6"><ellipse cx="174" cy="85" rx="2" ry="3" /><ellipse cx="49" cy="143" rx="2" ry="2.8" /><ellipse cx="164" cy="206" rx="1.5" ry="2.4" /></g>
    </svg>
  </div>;
}

/** A transient visual counterpart of the accessible, persistent result on the card. */
export function DrinkCelebration({ presentation }: { presentation: DrinkPresentation | null }) {
  if (!presentation) return null;
  const double = presentation.drinkCount === 2;
  return createPortal(<div key={presentation.key} className="drink-stage" data-motion="drinkStage" data-drink-presentation={presentation.key}
    data-drink-player={presentation.player} data-drink-count={presentation.drinkCount} aria-hidden="true">
    <div className="drink-stage__scrim" />
    <div className="drink-stage__content" data-motion="drinkStageContent">
      <div className="drink-stage__art">
        <div className="drink-stage__halo" />
        <div className="drink-stage__ripple" data-motion="drinkRipple" />
        <div className="drink-stage__coaster" />
        <div className="drink-stage__glasses"><ToastGlass />{double && <ToastGlass second />}</div>
        <div className="drink-stage__sparkles" data-motion="drinkSparkles" />
        <svg className="drink-stage__clink" data-motion="drinkClink" viewBox="0 0 100 80" fill="none">
          <path d="m50 21 0-13M30 28l-9-10M70 28l9-10" stroke="#ffe5a9" strokeWidth="3.5" strokeLinecap="round" />
          <path d="m13 46 9 0M78 46h9" stroke="#f6c977" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className={`drink-stage__caption drink-stage__caption--${presentation.player.toLowerCase()}`} data-motion="drinkCaption">
        <span className="drink-stage__player">{presentation.player === 'PAU' ? drinkCopy.pauName : drinkCopy.teclaName}</span>
        <strong>{drinkCopy.mustDrink}</strong>
        {double && <span className="drink-stage__double">{drinkCopy.double} <span>×2</span></span>}
      </div>
    </div>
  </div>, document.body);
}
