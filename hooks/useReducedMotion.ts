import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cadence_reduced_motion';

type Override = boolean | null;

const readOverride = (): Override => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

const writeOverride = (value: Override) => {
  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    /* ignore quota / privacy mode errors */
  }
};

/**
 * Resolves the effective reduced-motion preference.
 *
 * Priority: explicit user override (localStorage) > OS-level
 * `prefers-reduced-motion: reduce` media query.
 *
 * Returns just the boolean for legacy callers; use `useReducedMotionState`
 * to also get the setter for building toggles.
 */
export const useReducedMotion = (): boolean => {
  const { prefersReduced } = useReducedMotionState();
  return prefersReduced;
};

interface ReducedMotionState {
  /** Final resolved value: override if set, else OS preference. */
  prefersReduced: boolean;
  /** Raw OS-level media query result. */
  systemPrefersReduced: boolean;
  /** User override; `null` means "follow OS". */
  override: Override;
  /** Set/clear the user override. Pass `null` to follow OS. */
  setOverride: (value: Override) => void;
}

export const useReducedMotionState = (): ReducedMotionState => {
  const [systemPrefersReduced, setSystemPrefersReduced] = useState(false);
  const [override, setOverrideState] = useState<Override>(() => readOverride());

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemPrefersReduced(query.matches);

    const handler = (e: MediaQueryListEvent) => setSystemPrefersReduced(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  // Sync across tabs/windows.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === null) setOverrideState(null);
      else setOverrideState(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setOverride = useCallback((value: Override) => {
    writeOverride(value);
    setOverrideState(value);
  }, []);

  const prefersReduced = override === null ? systemPrefersReduced : override;

  return { prefersReduced, systemPrefersReduced, override, setOverride };
};
