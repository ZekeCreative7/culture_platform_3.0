import { useEffect, useState } from 'react';
import { subscribe } from '../state.js';

export function useVanillaStateTick(debounceMs = 150) {
  const [, setTick] = useState(0);
  useEffect(() => {
    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setTick((n) => n + 1), debounceMs);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}
