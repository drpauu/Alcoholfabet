import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Scene } from './components/Scene';
import { Board } from './components/Board';
import { QuestionCard } from './components/QuestionCard';
import { PlayerBadge } from './components/PlayerBadge';
import { ArtButtonPrimary, ArtButtonSecondary, ArtButtonQuiet, ArtButtonCorrect, ArtButtonIncorrect, ArtButtonTP, ArtPanel, ArtCard, ArtModal, ArtToast, ArtLoader, ArtIcon, ArtIconButton } from './components/art';
import { ca } from './content/ca';
import { useGameSession } from './hooks/useGameSession';
import { useGameChannel } from './hooks/useGameChannel';
import { useGameMotion } from './motion/useGameMotion';
import type { GameAction, GameMode, PlayerRole } from './domain/game/game-types';
import type { GameView, Scoreboard } from './services/game-contract';

type SetupStep = 'HOME' | 'ONLINE' | 'ROLE' | 'JOIN' | 'DURATION' | 'STARTER';
const emptyScore: Scoreboard = { pauWins: 0, teclaWins: 0, completedGames: 0 };

function Score({ score }: { score: Scoreboard }) {
  return <ArtPanel as="div" className="score-strip" data-motion="scoreTransition" aria-label={ca.scoreboard}>
    <span>{ca.pau}</span><strong>{score.pauWins}<i>—</i>{score.teclaWins}</strong><span>{ca.tecla}</span>
  </ArtPanel>;
}

function categoryFor(view: GameView): string {
  switch (view.question?.pool) {
    case 'PAU': return ca.personalPau;
    case 'TECLA': return ca.personalTecla;
    case 'PAU_TECLA': return ca.crossPauTecla;
    case 'TECLA_PAU': return ca.crossTeclaPau;
    case 'TP': return ca.tpBoth;
    default: return view.game.currentTurn === 'PAU' ? ca.turnPau : ca.turnTecla;
  }
}

export default function App() {
  const session = useGameSession();
  const { view } = session;
  const [step, setStep] = useState<SetupStep>('HOME');
  const [mode, setMode] = useState<GameMode>('IN_PERSON');
  const [role, setRole] = useState<PlayerRole>('PAU');
  const [joining, setJoining] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState(false);
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState(() => new URLSearchParams(location.search).get('partida') ?? '');
  const [invitePending, setInvitePending] = useState(() => new URLSearchParams(location.search).has('partida'));
  const [rules, setRules] = useState(false);
  const [leave, setLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [view?.game.inviteCode]);
  const motion = useGameMotion(view);
  const channel = useGameChannel(view?.game.id ?? null, session.userId, view?.viewer.role ?? null, session.refresh, view?.game.stateVersion ?? 0);
  const disconnected = view !== null && channel.connection !== 'connected';
  const locked = session.pending || motion.busy || disconnected;
  const wasDisconnected = useRef(false);

  useEffect(() => {
    if (invitePending && invite && session.access?.authorized && !view && step === 'HOME') {
      setInvitePending(false);
      setMode('ONLINE'); setJoining(true); setStep('ROLE');
    }
  }, [invite, invitePending, session.access?.authorized, view, step]);

  useEffect(() => {
    if (disconnected) {
      wasDisconnected.current = true;
      motion.disconnect();
    } else if (wasDisconnected.current) {
      wasDisconnected.current = false;
      motion.reconnect();
    }
  }, [disconnected, motion.disconnect, motion.reconnect]);

  const act = (action: GameAction) => {
    if (!view || locked) return;
    motion.unlockAudio();
    if (action.type === 'CLAIM_TP') motion.claimPending();
    void session.run((repo) => repo.action(view, action));
  };
  const setup = (nextMode: GameMode) => {
    motion.unlockAudio();
    setMode(nextMode);
    setJoining(false);
    setStep(nextMode === 'ONLINE' ? 'ONLINE' : 'DURATION');
    session.clearError();
  };
  const create = async (starter: PlayerRole | 'RANDOM') => {
    const success = await session.run((repo) => repo.createGame({ mode, targetMinutes: minutes,
      startingPlayer: starter, creatorRole: mode === 'IN_PERSON' ? 'IN_PERSON_CONTROLLER' : role }));
    if (success) setStep('HOME');
  };
  const enter = async (event: FormEvent) => {
    event.preventDefault();
    motion.unlockAudio();
    const submitted = code;
    setCode('');
    if (await session.verify(submitted)) {
      if (invite) { setMode('ONLINE'); setJoining(true); setStep('ROLE'); }
    }
  };
  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (await session.run((repo) => repo.joinGame(invite, role))) {
      setStep('HOME');
      setInvite(''); setInvitePending(false);
      history.replaceState(null, '', location.pathname);
    }
  };
  const goHome = () => { session.goHome(); setStep('HOME'); session.clearError(); };
  const copyInvite = async () => {
    if (!view?.game.inviteCode) return;
    try { await navigator.clipboard.writeText(view.game.inviteCode); setCopied(true); }
    catch { setCopied(false); }
  };
  const shareInvite = async () => {
    if (!view?.game.inviteCode) return;
    const url = `${location.origin}${location.pathname}?partida=${view.game.inviteCode}`;
    if (navigator.share) await navigator.share({ title: ca.appTitle, url }).catch(() => undefined);
    else { await navigator.clipboard.writeText(url).catch(() => undefined); setCopied(true); }
  };

  let content: ReactNode;
  if (session.loading) {
    content = <section className="setup-screen"><ArtPanel><ArtLoader /></ArtPanel></section>;
  } else if (!session.access?.authorized) {
    content = <section className="setup-screen access-screen">
      <ArtPanel as="form" className="access-panel" onSubmit={enter}>
        <p className="eyebrow">{ca.homeEyebrow}</p><h1>{ca.enterPrivateGame}</h1><p>{ca.accessHelp}</p>
        <label className="form-field">{ca.privateCode}<input type="password" autoComplete="current-password" value={code}
          onChange={(event) => setCode(event.target.value)} minLength={6} maxLength={128} required disabled={session.pending} /></label>
        <ArtButtonPrimary type="submit" className="primary-button" loading={session.pending} disabled={code.length < 6}>{session.pending ? ca.sending : ca.enter}</ArtButtonPrimary>
        <small>{ca.privateNotice}</small>
        {!session.access && <ArtButtonQuiet icon="reconnect" type="button" className="text-button" onClick={() => void session.boot()}>{ca.connectionRetry}</ArtButtonQuiet>}
      </ArtPanel>
    </section>;
  } else if (view) {
    const game = view.game;
    const responding = game.respondingPlayer ?? game.currentTurn;
    const finished = game.status === 'FINISHED';
    const abandoned = game.status === 'ABANDONED';
    const waiting = game.status === 'LOBBY';
    const last = view.lastEvent?.payload;
    const resultCorrect = last?.correct === true;
    const resultPhase = ['RESULT', 'BETWEEN_TURNS', 'MOVING'].includes(game.phase) || finished;
    const plus = last?.plusOne === true;
    const drinkDouble = last?.drinkCount === 2;
    const turnText = game.currentTurn === 'PAU' ? ca.turnPau : ca.turnTecla;
    content = <div className="game-layout" data-motion="gameCamera" data-game-id={game.id} data-state-version={game.stateVersion} data-phase={game.phase}>
      <header className="game-hud">
        <PlayerBadge player="PAU" position={game.pauPosition} finishPosition={game.finishPosition} active={responding === 'PAU'} />
        <div className={`turn-label turn-label--${responding.toLowerCase()}`} aria-live="polite"><span>{waiting ? ca.onlineGame : turnText}</span><small>{game.turnNumber > 0 ? `${ca.turnLabel} ${game.turnNumber}` : ca.waiting}</small></div>
        <PlayerBadge player="TECLA" position={game.teclaPosition} finishPosition={game.finishPosition} active={responding === 'TECLA'} />
      </header>
      <section className="board-column" aria-label={ca.boardLabel}>
        <Board cells={view.board} positions={{PAU:game.pauPosition,TECLA:game.teclaPosition}} activePlayer={responding}
          targetPosition={game.currentTargetCell} finishPosition={game.finishPosition} />
        <div className="board-legend"><span><ArtIcon name="personal" />{ca.personalLabel}</span><span><ArtIcon name="crossed" />{ca.crossedLabel}</span><span><ArtIcon name="tp" />T&amp;P</span></div>
      </section>
      <section className="card-column" aria-live="polite">
        {waiting ? <ArtPanel className="lobby-panel">
          <p className="eyebrow">{ca.onlineGame}</p><h2>{ca.waitingStart}</h2>
          <p>{ca.inviteHelp}</p><span className="code-label">{ca.gameCode}</span><strong className="invite-code">{game.inviteCode}</strong>
          <div className="panel-actions"><ArtButtonSecondary icon={copied ? 'correct' : 'copy'} className="secondary-button" status={copied ? 'success' : 'normal'} onClick={() => void copyInvite()}>{copied ? ca.copied : ca.copy}</ArtButtonSecondary><ArtButtonSecondary icon="share" className="secondary-button" onClick={() => void shareInvite()}>{ca.share}</ArtButtonSecondary></div>
          <div className="lobby-players">{(['PAU','TECLA'] as const).map((player) => <div key={player}><PlayerBadge player={player} /><span>{channel.presentRoles.includes(player) ? (player==='PAU' ? ca.connectedMale : ca.connectedFemale) : ca.waiting}</span></div>)}</div>
          <ArtButtonPrimary icon="start" className="primary-button" loading={session.pending} disabled={locked || !view.capabilities.canStart || !['PAU','TECLA'].every((player) => channel.presentRoles.includes(player))} onClick={() => void session.run((repo) => repo.startGame(view))}>{ca.startGame}</ArtButtonPrimary>
        </ArtPanel> : finished && motion.victoryVisible ? <div className="victory-wrap">
          <img className="winner-crown" data-motion="crown" data-ready={motion.crownVisible} src="/assets/production/effects/crown.svg" alt="" />
          <ArtCard className="victory-panel" data-motion="winnerCard" data-ready={motion.victoryCardVisible}>
          <img className="winner-avatar" src={`/assets/production/avatars/${game.winner?.toLowerCase()}_avatar.webp`} alt="" />
          <h2>{game.winner === 'PAU' ? ca.pauWon : ca.teclaWon}</h2><p>{ca.finishedHelp}</p><div data-ready={motion.scoreVisible} className="victory-score"><Score score={view.scoreboard} /></div>
          <div className="final-actions" data-motion="finalActions" hidden={!motion.finalActionsVisible}>
            <ArtButtonPrimary icon="turn" className="primary-button" disabled={locked} onClick={() => { goHome(); setup(game.mode); }}>{ca.playAgain}</ArtButtonPrimary>
            <ArtButtonSecondary icon="home" className="secondary-button" onClick={goHome}>{ca.goHome}</ArtButtonSecondary>
          </div>
        </ArtCard></div> : abandoned ? <ArtPanel><h2>{ca.abandoned}</h2><p>{ca.noPoint}</p><ArtButtonPrimary icon="home" className="primary-button" onClick={goHome}>{ca.goHome}</ArtButtonPrimary></ArtPanel> :
          <QuestionCard category={categoryFor(view)} pool={view.question?.pool} question={view.question?.questionCa ?? ca.questionReady}
            answer={view.question?.answerCa} answerVisible={motion.answerVisible} phase={game.phase} busy={locked} drinkDouble={drinkDouble}>
            {game.phase === 'TP_CLAIMED' && <p className="claim-label" data-motion="claimLabel">{responding === 'PAU' ? ca.pauAnswers : ca.teclaAnswers}</p>}
            {view.capabilities.canBeginTurn && <ArtButtonPrimary className="primary-button" disabled={locked} onClick={() => act({type:'BEGIN_TURN'})}>{ca.startTurn}</ArtButtonPrimary>}
            {game.phase === 'TP_OPEN' && <div className="claim-controls">
              {game.mode === 'IN_PERSON' ? (['PAU','TECLA'] as const).map((player) => <ArtButtonTP key={player} player={player} data-motion="claimButton" className={player==='PAU'?'blue-button':'pink-button'} disabled={locked || !view.capabilities.canClaim} onClick={() => act({type:'CLAIM_TP',claimant:player})}>{session.pending ? ca.checking : player==='PAU' ? ca.claimPau : ca.claimTecla}</ArtButtonTP>) :
                <ArtButtonTP player={view.viewer.role as PlayerRole} data-motion="claimButton" className={view.viewer.role==='PAU'?'blue-button':'pink-button'} disabled={locked || !view.capabilities.canClaim} onClick={() => act({type:'CLAIM_TP',claimant:view.viewer.role as PlayerRole})}>{session.pending ? ca.checking : ca.iAnswer}</ArtButtonTP>}
            </div>}
            {view.capabilities.canReveal && <ArtButtonPrimary className="primary-button" disabled={locked} onClick={() => act({type:'REVEAL_ANSWER'})}>{ca.showAnswer}</ArtButtonPrimary>}
            {view.capabilities.canJudge && motion.answerVisible && <div className="judge-controls" data-motion="judgeButtons">
              <ArtButtonIncorrect className="danger-button" disabled={locked} onClick={() => act({type:'JUDGE_INCORRECT'})}>{ca.incorrect}</ArtButtonIncorrect>
              <ArtButtonCorrect className="primary-button" disabled={locked} onClick={() => act({type:'JUDGE_CORRECT'})}>{ca.correct}</ArtButtonCorrect>
            </div>}
            {!resultPhase && !view.capabilities.canBeginTurn && !view.capabilities.canJudge && game.phase !== 'TP_OPEN' && <p className="voice-hint">{ca.answerAloud}<small>{ca.waitingJudge}</small></p>}
            {resultPhase && <div className={`result-note ${resultCorrect ? 'is-correct':'is-incorrect'}`}>
              <strong>{resultCorrect ? `${ca.correct}!` : `${ca.incorrect}!`}</strong>
              <p>{resultCorrect ? plus ? `${ca.plusOneTitle} ${ca.advanceExtra}` : ca.advanceOne : `${ca.doNotAdvance} ${ca.loseTurn} ${drinkDouble ? ca.drinkDouble : ca.drink}`}</p>
            </div>}
            {view.capabilities.canNextTurn && <ArtButtonPrimary className="primary-button" disabled={locked} onClick={() => act({type:'NEXT_TURN'})}>{ca.nextTurn}</ArtButtonPrimary>}
          </QuestionCard>}
      </section>
      <div className="motion-confetti" data-motion="confetti" aria-hidden="true" />
    </div>;
  } else if (step === 'HOME') {
    content = <section className="home-screen">
      <p className="eyebrow">{ca.homeEyebrow}</p><h1 className="home-logo">{ca.appTitle}</h1><p className="home-tagline">{ca.tagline}</p>
      <div className="home-characters"><img src="/assets/production/avatars/pau_character.webp" alt={ca.pau} /><img src="/assets/production/avatars/tecla_character.webp" alt={ca.tecla} /></div>
      <Score score={session.access.scoreboard ?? emptyScore} />
      <div className="home-actions"><ArtButtonSecondary player="PAU" icon="person" onClick={() => setup('IN_PERSON')}>{ca.playInPerson}</ArtButtonSecondary><ArtButtonSecondary player="TECLA" icon="online" onClick={() => setup('ONLINE')}>{ca.playOnline}</ArtButtonSecondary></div>
      {(session.access.activeGameId || localStorage.getItem('tp-active-game')) && <ArtButtonQuiet icon="turn" className="text-button" disabled={session.pending} onClick={() => void session.run((repo) => repo.getGameView(session.access?.activeGameId ?? localStorage.getItem('tp-active-game') ?? ''))}>{ca.resumeGame}</ArtButtonQuiet>}
      <ArtButtonQuiet icon="rules" className="text-button" onClick={() => setRules(true)}>{ca.rules}</ArtButtonQuiet>
    </section>;
  } else {
    content = <section className="setup-screen"><ArtPanel>
      <ArtButtonQuiet icon="back" className="text-button back-button" disabled={session.pending} onClick={() => setStep(step==='STARTER'?'DURATION':step==='JOIN'?'ROLE':'HOME')}>{ca.back}</ArtButtonQuiet>
      {step === 'ONLINE' && <><p className="eyebrow">{ca.online}</p><h1>{ca.chooseOnline}</h1><div className="setup-options"><ArtButtonSecondary icon="online" className="option-button" onClick={() => {setJoining(false);setStep('ROLE');}}>{ca.createGame}</ArtButtonSecondary><ArtButtonSecondary icon="person" className="option-button" onClick={() => {setJoining(true);setStep('ROLE');}}>{ca.joinGame}</ArtButtonSecondary></div></>}
      {step === 'ROLE' && <><h1>{ca.chooseRole}</h1><div className="setup-options">{(['PAU','TECLA'] as const).map((player) => <ArtButtonSecondary player={player} className="option-button" key={player} onClick={() => {setRole(player);setStep(joining?'JOIN':'DURATION');}}><PlayerBadge player={player} /><span>{player==='PAU'?ca.iAmPau:ca.iAmTecla}</span></ArtButtonSecondary>)}</div></>}
      {step === 'JOIN' && <form onSubmit={join}><h1>{ca.joinGame}</h1><label className="form-field">{ca.gameCode}<input autoComplete="off" value={invite} onChange={(event) => setInvite(event.target.value.toUpperCase())} minLength={6} maxLength={12} required /></label><ArtButtonPrimary type="submit" className="primary-button" loading={session.pending} disabled={invite.length<6}>{session.pending?ca.sending:ca.joinGame}</ArtButtonPrimary></form>}
      {step === 'DURATION' && <><p className="eyebrow">{mode==='IN_PERSON'?ca.inPerson:ca.online}</p><h1>{ca.durationQuestion}</h1><div className="setup-options duration-options">{[20,30,45,60].map((duration) => <ArtButtonSecondary className={`option-button ${!custom&&minutes===duration?'is-selected':''}`} aria-pressed={!custom&&minutes===duration} key={duration} onClick={() => {setMinutes(duration);setCustom(false);}}><strong>{duration}</strong><span>{ca.minutes}</span></ArtButtonSecondary>)}<ArtButtonSecondary className={`option-button ${custom?'is-selected':''}`} aria-pressed={custom} onClick={() => setCustom(true)}>{ca.custom}</ArtButtonSecondary></div>{custom&&<label className="form-field">{ca.customMinutes}<input type="number" value={minutes} min={10} max={100} onChange={(event) => setMinutes(Number(event.target.value))} /></label>}<p className="setup-hint">{ca.durationHelp}</p><ArtButtonPrimary className="primary-button" disabled={!Number.isFinite(minutes)||minutes<10||minutes>100} onClick={() => setStep('STARTER')}>{ca.next}</ArtButtonPrimary></>}
      {step === 'STARTER' && <><h1>{ca.whoStarts}</h1><div className="setup-options starter-options">{(['PAU','TECLA'] as const).map((player) => <ArtButtonSecondary player={player} className="option-button" key={player} disabled={session.pending} onClick={() => void create(player)}><PlayerBadge player={player} /><span>{player==='PAU'?ca.pauWithArticle:ca.teclaWithArticle}</span></ArtButtonSecondary>)}<ArtButtonSecondary icon="turn" className="option-button" loading={session.pending} onClick={() => void create('RANDOM')}>{session.pending?ca.sending:ca.random}</ArtButtonSecondary></div></>}
    </ArtPanel></section>;
  }

  return <Scene variant={view ? 'game' : step==='HOME'&&session.access?.authorized ? 'home':'setup'}>
    <div className="app-header"><span className="brand">{ca.appTitle}</span><div className="header-actions">
      {session.access?.authorized && <ArtIconButton className="icon-button" icon="rules" onClick={() => setRules(true)} aria-label={ca.showRules} />}
      <ArtIconButton className="icon-button" icon={motion.soundEnabled?'sound_on':'sound_off'} aria-label={motion.soundEnabled?ca.soundOn:ca.soundOff} aria-pressed={motion.soundEnabled} onClick={motion.toggleSound} />
      {view&&view.capabilities.canAbandon&&<ArtIconButton className="icon-button" icon="home" onClick={() => setLeave(true)} aria-label={ca.exit} />}
    </div></div>
    {content}
    {session.error&&<ArtToast className="error-message" tone="incorrect" onDismiss={session.clearError}>{session.error}</ArtToast>}
    {rules&&<ArtModal open={rules} title={ca.rules} onClose={() => setRules(false)}><div className="rules-copy">{[ca.ruleGoal,ca.ruleTalk,ca.ruleCategories,ca.ruleCorrect,ca.ruleBonus,ca.ruleTP,ca.ruleScore].map((line)=><p key={line}>{line}</p>)}</div><ArtButtonPrimary className="primary-button" onClick={() => setRules(false)}>{ca.close}</ArtButtonPrimary></ArtModal>}
    {leave&&<ArtModal open={leave} title={ca.leaveQuestion} onClose={() => setLeave(false)}><p>{ca.leaveWarning}</p><div className="panel-actions"><ArtButtonSecondary className="secondary-button" onClick={() => setLeave(false)}>{ca.keepPlaying}</ArtButtonSecondary><ArtButtonIncorrect className="danger-button" disabled={locked} onClick={() => {act({type:'ABANDON_GAME'});setLeave(false);}}>{ca.abandonGame}</ArtButtonIncorrect></div></ArtModal>}
    <div className={`connection-overlay ${disconnected||motion.reconnectVisible?'is-visible':''}`} data-motion="disconnectOverlay" aria-hidden={!disconnected&&!motion.reconnectVisible}>
      <ArtPanel><ArtIcon name={motion.reconnectVisible ? 'reconnect' : 'connection'} /><h2 data-motion="reconnectText">{motion.reconnectVisible?ca.reconnected:ca.connectionLost}</h2><p>{motion.reconnectVisible?ca.gameContinues:ca.reconnecting}</p><ArtLoader className="connection-loader" compact label="" aria-label={ca.reconnecting} /><svg data-motion="reconnectCheck" viewBox="0 0 60 60"><path d="M13 30 25 43 48 17" /></svg></ArtPanel>
    </div>
    {view&&<div className="orientation-gate"><ArtIcon name="rotate" /><h2 className="mobile-rotation">{ca.rotateDevice}</h2><p className="mobile-rotation">{ca.rotateDeviceHelp}</p><h2 className="tablet-rotation">{ca.rotateIpad}</h2><p className="tablet-rotation">{ca.rotateIpadHelp}</p></div>}
  </Scene>;
}
