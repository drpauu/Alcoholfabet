import { easing, type MotionSequence, type MotionStep } from './choreography';
import { GameAudioManager } from './audio';
import type { ConfirmedGameEffect } from './effects';

type MotionElement = HTMLElement | SVGElement;
interface Point { x: number; y: number; fraction?: number }
export interface MotionCallbacks { onAnswerMidpoint?: () => void; onFinalActions?: () => void; onCrown?: () => void; onWinnerCard?: () => void; onScore?: () => void; onViewSynced?: () => void }
export interface RunOptions extends MotionCallbacks { root?: ParentNode; audio: GameAudioManager; reduced: boolean; signal: AbortSignal; effect?: ConfirmedGameEffect; key: string }

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

function frame(props: Record<string, string | number>): Keyframe {
  const result: Keyframe = {};
  const transforms: string[] = [];
  if (props.x !== undefined || props.y !== undefined) transforms.push(`translate(${props.x ?? 0}px, ${props.y ?? 0}px)`);
  if (props.rotateZ !== undefined) transforms.push(`rotate(${props.rotateZ}deg)`);
  if (props.rotateY !== undefined) transforms.push(`rotateY(${props.rotateY}deg)`);
  if (props.scale !== undefined) transforms.push(`scale(${props.scale})`);
  if (transforms.length) result.transform = transforms.join(' ');
  if (props.opacity !== undefined) result.opacity = props.opacity;
  if (props.blurPx !== undefined || props.saturation !== undefined) result.filter = `blur(${props.blurPx ?? 0}px) saturate(${props.saturation ?? 1})`;
  if (props.shadow !== undefined) result.boxShadow = props.shadow === 'low' ? '0 2px 3px rgb(57 32 17 / 10%)' : 'var(--tp-shadow-card)';
  return result;
}

function point(root: ParentNode, position: number): Point | null {
  const element = root.querySelector<MotionElement>(`[data-board-position="${position}"]`);
  if (!element) return null;
  const x = Number(element.dataset.boardX), y = Number(element.dataset.boardY);
  const fraction = Number(element.dataset.boardFraction);
  return Number.isFinite(x) && Number.isFinite(y) ? {
    x, y,
    ...(Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? { fraction } : {}),
  } : null;
}

/** Samples the board's SVG curve; every pawn landing stays aligned with its cell. */
function routeFrames(root: ParentNode, from: Point, to: Point, fromOffsetX = 0, toOffsetX = 0): Keyframe[] {
  const path = root.querySelector<SVGPathElement>('[data-motion="boardPath"]');
  const samples = 20;
  let points: Point[];
  if (path && typeof path.getTotalLength === 'function') {
    const total = path.getTotalLength();
    const nearest = (target: Point) => {
      let distance = Infinity, best = 0;
      for (let index = 0; index <= 240; index += 1) {
        const length = index / 240 * total;
        const p = path.getPointAtLength(length);
        const squared = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
        if (squared < distance) { distance = squared; best = length; }
      }
      return best;
    };
    // Board cells expose their measured fraction of this same SVG path. Use
    // it directly so synchronous endpoint searches cannot delay the route
    // against the badge's absolute choreography. Legacy DOM keeps its fallback.
    const lengthAt = (target: Point) => target.fraction === undefined ? nearest(target) : target.fraction * total;
    const start = lengthAt(from), finish = lengthAt(to);
    points = Array.from({ length: samples + 1 }, (_, index) => path.getPointAtLength(start + (finish - start) * index / samples));
    points[0] = from; points[samples] = to;
  } else {
    // A shallow quadratic arc also covers the short SORTIDA-to-first-cell segment.
    points = Array.from({ length: samples + 1 }, (_, index) => {
      const t = index / samples;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 12 };
    });
  }
  return points.map((p, index) => ({ transform: `translate(${p.x + fromOffsetX + (toOffsetX - fromOffsetX) * index / samples}px, ${p.y + 10 - Math.sin(index / samples * Math.PI) * 7}px)`, offset: index / samples }));
}

export async function runSequence(sequence: MotionSequence, options: RunOptions): Promise<void> {
  const root = options.root ?? document;
  const animations = new Set<Animation>();
  const animationTargets = new Map<Animation, MotionElement>();
  const generated = new Set<HTMLElement>();
  const originals = new Map<MotionElement, string | null>();
  const remember = (element: MotionElement) => { if (!originals.has(element)) originals.set(element, element.getAttribute('style')); };
  const get = (target: string): MotionElement | null => {
    if ((target === 'pawn' || target === 'winnerPawn') && options.effect && ('player' in options.effect || 'winner' in options.effect)) {
      const player = 'player' in options.effect ? options.effect.player : options.effect.winner;
      return root.querySelector(`[data-motion="pawn-${player}"]`);
    }
    if (target === 'targetCell' && options.effect?.type === 'CORRECT_AND_MOVE') return root.querySelector(`[data-board-position="${options.effect.from + 1}"] [data-motion="targetCell"]`) ?? root.querySelector(`[data-board-position="${options.effect.from + 1}"] rect`);
    return root.querySelector(`[data-motion="${target}"]`);
  };
  const animate = async (element: MotionElement, frames: Keyframe[], duration: number, name?: string) => {
    if (options.signal.aborted) return;
    remember(element);
    if (typeof element.animate !== 'function') return;
    const animation = element.animate(frames, { duration, easing: easing(name), fill: 'both' });
    animations.add(animation);
    animationTargets.set(animation, element);
    await animation.finished.catch(() => undefined);
  };
  const cancel = () => { for (const animation of animations) animation.cancel(); };
  options.signal.addEventListener('abort', cancel, { once: true });
  // The confirmed SVG attribute is already at the destination. Hold its previous
  // visual coordinate through answer feedback before following the actual path.
  if (options.effect?.type === 'CORRECT_AND_MOVE') {
    const pawn = get('pawn'), start = point(root, options.effect.from);
    if (pawn && start) { remember(pawn); pawn.style.transform = `translate(${start.x + (options.effect.fromOffsetX ?? 0)}px, ${start.y + 10}px)`; }
  }

  const execute = async (step: MotionStep, index: number): Promise<void> => {
    await wait(step.atMs, options.signal);
    if (options.signal.aborted) return;
    if (step.target === 'audio' && step.cue) { await options.audio.play(step.cue, `${options.key}:${index}`, options.signal); return; }
    if (step.target === 'haptics') { if (!options.reduced) navigator.vibrate?.(step.pattern ?? [20]); return; }
    if (step.action === 'swapContent') { options.onAnswerMidpoint?.(); return; }
    if (step.target === 'finalActions') options.onFinalActions?.();
    if (step.target === 'crown') options.onCrown?.();
    if (step.target === 'winnerCard') options.onWinnerCard?.();
    if (step.target === 'scoreTransition') options.onScore?.();
    if (step.action === 'enableAfterViewSync') options.onViewSynced?.();
    const element = get(step.target);
    if (!element) return;
    const duration = step.durationMs ?? 240;
    if (step.action === 'set') {
      remember(element);
      // The first half of a card flip must release its 90° fill before the
      // exact midpoint reset to -90°. Otherwise WAAPI masks the new face.
      for (const animation of animations) if (animationTargets.get(animation) === element) animation.cancel();
      const styles = frame(step.props ?? {});
      for (const [name, value] of Object.entries(styles)) element.style.setProperty(name === 'boxShadow' ? 'box-shadow' : name, String(value));
    } else if (step.action === 'animate') {
      // The score's JSON step intentionally supplies only its start and
      // duration. Give that paper plate a physical entry without inventing
      // another timeline or changing other animate steps.
      const frames = step.target === 'scoreTransition' && !step.to ? [
        { transform: 'translateY(6px) rotate(-.7deg)', opacity: 0, boxShadow: 'var(--art-shadow-paper)' },
        { transform: 'translateY(0) rotate(0deg)', opacity: 1, boxShadow: 'var(--art-shadow-paper)' },
      ] : [{}, frame(step.to ?? {})];
      await animate(element, frames, duration, step.easing);
    } else if (step.action === 'keyframes') {
      const xs = step.values?.x ?? [0];
      await animate(element, xs.map((x) => ({ transform: `translateX(${x}px)` })), duration);
    } else if (step.action === 'burst') {
      await animate(element, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: .8, transform: 'scale(1.04)', offset: .35 }, { opacity: 0, transform: 'scale(1.08)' }], duration);
    } else if (step.action === 'draw') {
      remember(element); element.style.opacity = '1';
      const paths = element instanceof SVGPathElement ? [element] : Array.from(element.querySelectorAll<SVGPathElement>('path'));
      await Promise.all(paths.map(async (path) => {
        remember(path);
        if (step.target === 'claimantRing' && options.effect?.type === 'TP_CLAIM') path.style.stroke = options.effect.claimant === 'PAU' ? 'var(--art-pau, #426c82)' : 'var(--art-tecla, #ac6570)';
        const length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        await animate(path, [{ strokeDashoffset: length }, { strokeDashoffset: 0 }], duration);
      }));
    } else if (step.action === 'emit') {
      const drinking = step.target === 'drinkBubbles';
      const count = Math.min(step.count ?? 3, step.target === 'confetti' ? 18 : drinking ? 6 : 3);
      const colors = drinking ? ['#b78035', '#dfb55c', '#f2d28d'] : ['var(--art-pau, #426c82)', 'var(--art-tecla, #ac6570)', 'var(--art-ochre, #b68b43)', 'var(--art-olive, #727958)', 'var(--art-tp, #84708c)'];
      await Promise.all(Array.from({ length: count }, async (_, particleIndex) => {
        const particle = document.createElement('span');
        particle.className = step.target === 'confetti' ? 'tp-motion-confetti' : 'tp-motion-particle';
        particle.style.backgroundColor = colors[particleIndex % colors.length];
        particle.style.left = step.target === 'confetti' ? `${20 + particleIndex * 59 / count}%` : '50%';
        particle.style.top = step.target === 'confetti' ? `${12 + (particleIndex % 4) * 5}%` : '38%';
        element.append(particle); generated.add(particle);
        const dx = step.target === 'confetti' ? (particleIndex % 2 ? 1 : -1) * (35 + particleIndex * 9) : drinking ? (particleIndex % 2 ? 1 : -1) * (12 + particleIndex * 4) : [-20, 18, 5][particleIndex];
        const dy = step.target === 'confetti' ? 150 + (particleIndex % 5) * 25 : drinking ? -18 - particleIndex * 4 : [-12, -17, -23][particleIndex];
        await animate(particle, [{ opacity: 0, transform: 'translate(0,0) rotate(0)' }, { opacity: 1, offset: .15 }, { opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(${step.target === 'confetti' ? 180 + particleIndex * 21 : 90}deg)` }], duration);
      }));
    } else if (step.action === 'moveAlongBoard' || step.action === 'moveOneCell') {
      const from = step.fromPosition ?? 0, to = step.toPosition ?? from;
      for (let position = from + 1; position <= to; position += 1) {
        if (options.signal.aborted) return;
        const start = point(root, position - 1), finish = point(root, position);
        if (!start || !finish) continue;
        const firstOffset = options.effect?.type === 'CORRECT_AND_MOVE' && position - 1 === options.effect.from ? options.effect.fromOffsetX ?? 0 : 0;
        const destinationOffset = options.effect?.type === 'CORRECT_AND_MOVE' && position === options.effect.to ? Number(element.dataset.boardX) - finish.x : 0;
        const moveDuration = step.durationPerCellMs ?? duration;
        const shadow = element.querySelector<SVGElement>('.pawn-shadow');
        const shadowMotion = shadow ? animate(shadow, [{ opacity: .25, transform: 'translateY(0) scaleX(1)' }, { opacity: .12, transform: 'translateY(7px) scaleX(1.25)', offset: .5 }, { opacity: .25, transform: 'translateY(0) scaleX(1)' }], moveDuration, 'pawn') : Promise.resolve();
        const body = element.querySelector<SVGElement>('[data-pawn-body]') ?? element.querySelector<SVGElement>('image');
        const inclination = finish.x >= start.x ? -2.2 : 2.2;
        if (body) { remember(body); body.style.transformBox = 'fill-box'; body.style.transformOrigin = '50% 100%'; }
        const bodyMotion = body ? animate(body, [
          { transform: 'rotate(0deg) scale(1)' },
          { transform: `rotate(${inclination}deg) scale(1)`, offset: .38 },
          { transform: `rotate(${inclination * .3}deg) scale(1)`, offset: .76 },
          { transform: 'rotate(0deg) scale(1.025,.96)', offset: .87 },
          { transform: 'rotate(0deg) scale(.995,1.012)', offset: .94 },
          { transform: 'rotate(0deg) scale(1)' },
        ], moveDuration, 'pawn') : Promise.resolve();
        await Promise.all([shadowMotion, bodyMotion, animate(element, routeFrames(root, start, finish, firstOffset, Number.isFinite(destinationOffset) ? destinationOffset : 0), moveDuration, 'pawn')]);
        if (step.playStepSound) await options.audio.play('PAWN_STEP', `${options.key}:${index}:${position}`, options.signal);
      }
    } else if (step.action === 'reducedMove') {
      await animate(element, [{ opacity: .65 }, { opacity: 1 }], 100);
      if (step.playStepSound) {
        const cells = Math.max(1, (step.toPosition ?? 1) - (step.fromPosition ?? 0));
        for (let cell = 0; cell < cells; cell += 1) await options.audio.play('PAWN_STEP', `${options.key}:${index}:${cell}`, options.signal);
      }
    } else if (step.action === 'landAtFinish') {
      await animate(element, [{ filter: 'drop-shadow(-2px 8px 7px rgb(72 43 24 / .15))' }, { filter: 'drop-shadow(-1px 3px 3px rgb(72 43 24 / .3))' }], duration);
    } else if (step.action === 'pulse') {
      await animate(element, (step.scale ?? [1, 1.06, 1]).map((scale) => ({ transform: `scale(${scale})` })), duration);
    } else if (step.action === 'raiseGlass') {
      const second = step.target === 'drinkSecondGlass';
      await animate(element, [
        { transform: `translateY(5px) rotate(${second ? 9 : -7}deg) scale(.9)` },
        { transform: `translateY(-10px) rotate(${second ? -10 : 10}deg) scale(1.07)`, offset: .4 },
        { transform: `translateY(-5px) rotate(${second ? 6 : -3}deg) scale(1.02)`, offset: .7 },
        { transform: second ? 'rotate(9deg) translateY(-5px)' : 'translateY(0) rotate(0) scale(1)' },
      ], duration, 'springSoft');
    } else if (step.action === 'dropAndBounce') {
      await animate(element, [{ opacity: 0, transform: 'translateY(-12px) rotate(-6deg)' }, { opacity: 1, transform: 'translateY(2px) rotate(2deg)', offset: .65 }, { opacity: 1, transform: 'translateY(-3px)', offset: .82 }, { opacity: 1, transform: 'translateY(0)' }], duration);
    } else if (step.action === 'enter') {
      await animate(element, [frame(step.from ?? { y: 18, opacity: 0 }), frame(step.to ?? { y: 0, opacity: 1 })], duration);
    } else if (step.action === 'exit') {
      await animate(element, [{ opacity: 1 }, { opacity: 0 }], duration);
    } else if (step.action === 'reducedFeedback') {
      await animate(element, [{ opacity: .6 }, { opacity: 1 }], duration);
    } else if (step.action === 'desaturate') {
      await animate(element, [{ filter: 'saturate(1)' }, { filter: 'saturate(.2)' }], duration);
    } else if (step.action === 'restore') {
      await animate(element, [{ transform: 'scale(.98)' }, { transform: 'scale(1)' }], duration);
    } else if (step.action === 'show' || step.action === 'showRespondent') {
      remember(element); element.style.opacity = '1';
    }
  };
  try { await Promise.all([wait(sequence.totalMs, options.signal), ...sequence.steps.map(execute)]); }
  finally {
    cancel();
    options.signal.removeEventListener('abort', cancel);
    for (const particle of generated) particle.remove();
    for (const [element, style] of originals) {
      if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style);
    }
  }
}
