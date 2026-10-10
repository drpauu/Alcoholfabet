import { useLayoutEffect, useRef } from 'react';

/** Fit the complete mobile card, including answers and the persistent drink result. */
export function useQuestionFit(question: string | null) {
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = body.current;
    const heading = container?.querySelector('h2');
    const copy = container?.querySelector<HTMLElement>('.question-copy');
    const answer = container?.querySelector<HTMLElement>('.answer-space');
    const card = container?.closest('.question-card-inner');
    const layout = container?.closest<HTMLElement>('.game-layout');
    const board = layout?.querySelector<HTMLElement>('.board-perspective-shell');
    if (!container || !heading || !copy || !answer) return;
    let mounted = true;
    let frame = 0;
    copy.scrollTop = 0;
    const pixels = (value: string) => parseFloat(value) || 0;
    const requiredHeight = () => {
      const copyStyle = getComputedStyle(copy), answerStyle = getComputedStyle(answer);
      return heading.scrollHeight + pixels(copyStyle.paddingTop) + pixels(copyStyle.paddingBottom)
        + answer.offsetHeight + pixels(answerStyle.marginTop) + pixels(answerStyle.marginBottom);
    };
    const fit = () => {
      if (!mounted) return;
      heading.style.fontSize = '';
      layout?.style.removeProperty('--question-board-width');
      if (window.innerWidth < 768) {
        let size = parseFloat(getComputedStyle(heading).fontSize);
        // Prefer readable type; borrow space from the board before the final
        // two pixels of reduction. Its aspect ratio and navigation stay intact.
        while (requiredHeight() > container.clientHeight + 1 && size > 22) {
          size -= 1;
          heading.style.fontSize = `${size}px`;
        }
        const missing = requiredHeight() - container.clientHeight;
        if (missing > 1 && layout && board) {
          const reclaim = Math.min(missing, Math.max(0, board.clientHeight - 120));
          layout.style.setProperty('--question-board-width', `${board.clientWidth - reclaim * 1210 / 625}px`);
        }
        while (requiredHeight() > container.clientHeight + 1 && size > 20) {
          size -= 1;
          heading.style.fontSize = `${size}px`;
        }
      }
      // The answer/notice has its own row; only the question scrolls as a
      // fallback, so the penalty and next-turn controls remain visible.
      container.dataset.overflow = String(requiredHeight() > container.clientHeight + 1);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    observer.observe(answer);
    const actions = card?.querySelector('.question-actions');
    if (actions) observer.observe(actions);
    if (layout) observer.observe(layout);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    void document.fonts.ready.then(schedule);
    fit();
    return () => {
      mounted = false;
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      layout?.style.removeProperty('--question-board-width');
    };
  }, [question]);
  return body;
}
