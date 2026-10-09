import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionCard } from '../../src/components/QuestionCard';

const card = (props: Parameters<typeof QuestionCard>[0]) => renderToStaticMarkup(createElement(QuestionCard, props));
const question = { category: 'Personal', question: 'Quina és la resposta?', phase: 'RESULT' };

describe('confirmed drink result', () => {
  it('names the provided respondent and displays an ordinary drink without needing an answer', () => {
    const html = card({ ...question, drinkPlayer: 'PAU' });
    expect(html).toContain('En Pau ha de beure');
    expect(html).toContain('data-drink-player="PAU"');
    expect(html).toContain('data-drink-count="1"');
    expect(html).not.toContain('La Tecla ha de beure');
    expect(html).not.toContain('Beu doble');
  });

  it('keeps the double penalty and respondent readable after the timed decoration has ended', () => {
    const html = card({ ...question, phase: 'BETWEEN_TURNS', drinkPlayer: 'TECLA', drinkDouble: true, answer: 'Resposta ja revelada' });
    expect(html).toContain('La Tecla ha de beure');
    expect(html).toContain('Beu doble');
    expect(html).toContain('data-drink-count="2"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Resposta ja revelada');
    expect(html.match(/data-motion="drinkGlass"/g)).toHaveLength(1);
  });

  it('does not carry a stale drink notice into the next turn', () => {
    const html = card({ ...question, phase: 'TURN_INTRO', drinkPlayer: 'PAU', drinkDouble: true });
    expect(html).not.toContain('data-drink-player');
    expect(html).not.toContain('En Pau ha de beure');
  });

  it('retains the authorized answer for a correct result and never renders a hidden answer', () => {
    const visible = card({ ...question, answer: 'Resposta autoritzada' });
    expect(visible).toContain('Resposta autoritzada');
    expect(visible).not.toContain('data-drink-player');
    const hidden = card({ ...question, phase: 'QUESTION', answer: 'Resposta oculta', answerVisible: false });
    expect(hidden).not.toContain('Resposta oculta');
  });
});
