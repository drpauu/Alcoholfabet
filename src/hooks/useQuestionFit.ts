import { useLayoutEffect, useRef } from 'react';

/** Keep the whole prompt readable when the answer and controls need more room. */
export function useQuestionFit(question: string | null) {
  const copy = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = copy.current;
    const heading = container?.querySelector('h2');
    if (!container || !heading) return;
    let mounted = true;
    let frame = 0;
    const fit = () => {
      if (!mounted) return;
      heading.style.fontSize = '';
      const style = getComputedStyle(container);
      const available = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (window.innerWidth < 768) {
        let size = parseFloat(getComputedStyle(heading).fontSize);
        // Preserve the usual font size for short questions. Long questions fit
        // down to 20px; unusually small viewports/zoom can scroll the text only.
        while (heading.scrollHeight > available + 1 && size > 20) {
          size -= 1;
          heading.style.fontSize = `${size}px`;
        }
      }
      container.dataset.overflow = String(heading.scrollHeight > available + 1);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    window.addEventListener('resize', schedule);
    void document.fonts.ready.then(schedule);
    fit();
    return () => { mounted = false; observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [question]);
  return copy;
}
