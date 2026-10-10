import { useEffect, useState } from 'react';

/** A fresh problem must last continuously for five seconds before its notice. */
export function usePersistentProblem(problem: string | null, delayMs = 5000): boolean {
  const [persistent, setPersistent] = useState<string | null>(null);
  useEffect(() => {
    setPersistent(null);
    if (problem === null) return;
    const timer = window.setTimeout(() => setPersistent(problem), delayMs);
    return () => window.clearTimeout(timer);
  }, [problem, delayMs]);
  // Hide immediately on recovery or a different game/error, before effects run.
  return problem !== null && persistent === problem;
}
