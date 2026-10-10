import type { ReactNode } from 'react';
import copy from '../../data/copy_ca.json';
import { ArtBadge, ArtCard } from './art';
import { DrinkNotice } from './DrinkNotice';
import type { PlayerRole, QuestionPool } from '../domain/game/game-types';
import { useQuestionFit } from '../hooks/useQuestionFit';

interface QuestionCardProps {
  category: string;
  pool?: QuestionPool;
  question: string | null;
  answer?: string;
  answerVisible?: boolean;
  phase: string;
  children?: ReactNode;
  busy?: boolean;
  drinkPlayer?: PlayerRole;
  drinkDouble?: boolean;
}

export function QuestionCard({ category, pool, question, answer, answerVisible = true, phase, children, busy = false, drinkPlayer, drinkDouble = false }: QuestionCardProps) {
  const questionBody = useQuestionFit(question);
  const categoryKind = pool === 'TP' ? 'tp' : pool?.includes('_') ? 'crossed' : pool === 'TECLA' ? 'tecla' : 'pau';
  const drinkResult = drinkPlayer && (phase === 'RESULT' || phase === 'BETWEEN_TURNS');
  return (
    <ArtCard className={`question-card question-card--${phase.toLowerCase()}`} data-motion="questionCard" aria-busy={busy} face={answer && answerVisible ? 'back' : 'front'}>
      <div className="card-stock-edge" aria-hidden="true" />
      <div className="question-card-inner art-surface" data-material="paper" data-motion="questionCardInner">
        <ArtBadge className={`card-category card-category--${categoryKind}`} tone={categoryKind === 'crossed' ? 'neutral' : categoryKind}
          icon={phase === 'TURN_INTRO' ? 'turn' : categoryKind === 'tp' ? 'tp' : categoryKind === 'crossed' ? 'crossed' : 'personal'}>{category}</ArtBadge>
        <div className="card-divider" aria-hidden="true" />
        <div className="question-body" ref={questionBody}>
          <div className="question-copy"><h2>{question}</h2></div>
          <div className={`answer-space${drinkResult || (answer && answerVisible) ? ' has-content' : ''}`}>
            {drinkResult ? <DrinkNotice player={drinkPlayer} double={drinkDouble} /> : answer && answerVisible ? <div className="answer-panel"><span>{copy.correctAnswer}</span><strong>{answer}</strong></div> : null}
          </div>
        </div>
        <div className="question-actions">{children}</div>
      </div>
      <div className="card-result-halo card-result-halo--correct" data-motion="correctHalo" aria-hidden="true" />
      <div className="card-result-halo card-result-halo--error" data-motion="errorHalo" aria-hidden="true" />
      <svg className="result-mark result-mark--correct" data-motion="correctCheck" viewBox="0 0 60 60" aria-hidden="true"><path d="M13 30 25 43 48 17" /></svg>
      <svg className="result-mark result-mark--error" data-motion="errorCross" viewBox="0 0 60 60" aria-hidden="true"><path d="m17 17 26 26M43 17 17 43" /></svg>
      <div className="correct-particles" data-motion="correctParticles" aria-hidden="true" />
      <svg className="claimant-ring" data-motion="claimantRing" viewBox="0 0 50 50" aria-hidden="true"><path d="M25 3a22 22 0 1 1-.01 0" /></svg>
    </ArtCard>
  );
}
