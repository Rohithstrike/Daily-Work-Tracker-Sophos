import { useEffect, useState } from 'react';

/**
 * A ticking clock for live durations. `intervalMs` of 1000 drives stopwatches;
 * pass `enabled: false` to stop re-rendering when nothing is running.
 */
export function useNow(intervalMs = 1000, enabled = true): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);

  return now;
}
