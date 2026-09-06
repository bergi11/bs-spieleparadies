import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export type SaveStatus = 'laden' | 'bereit' | 'speichert' | 'fehler';

/**
 * Lädt den Spielstand eines Nutzers und schreibt Änderungen verzögert zurück.
 * Die Verzögerung bündelt schnelle Züge zu einem Schreibvorgang, statt bei
 * jedem Tastendruck die Datenbank zu belasten.
 */
export function useGameSave<T>(userId: string, gameId: string, fallback: T) {
  const [state, setState] = useState<T>(fallback);
  const [status, setStatus] = useState<SaveStatus>('laden');

  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<T>();
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loaded.current = false;
    setStatus('laden');

    api
      .loadSave<T>(userId, gameId)
      .then(({ state: remote }) => {
        if (cancelled) return;
        setState(remote ?? fallback);
        loaded.current = true;
        setStatus('bereit');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('fehler');
      });

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
    // `fallback` ist bewusst nicht in den Abhängigkeiten: der Startwert soll
    // kein erneutes Laden auslösen, wenn er inline erzeugt wurde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, gameId]);

  const flush = useCallback(async () => {
    if (pending.current === undefined) return;
    const value = pending.current;
    pending.current = undefined;
    setStatus('speichert');
    try {
      await api.putSave(userId, gameId, value);
      setStatus('bereit');
    } catch {
      setStatus('fehler');
    }
  }, [userId, gameId]);

  const save = useCallback(
    (updater: T | ((previous: T) => T)) => {
      setState((previous) => {
        const next = typeof updater === 'function' ? (updater as (p: T) => T)(previous) : updater;
        // Vor dem ersten erfolgreichen Laden nichts zurückschreiben – sonst
        // könnte ein leerer Startzustand einen echten Spielstand überschreiben.
        if (loaded.current) {
          pending.current = next;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, 600);
        }
        return next;
      });
    },
    [flush],
  );

  // Beim Verlassen der Seite noch Ausstehendes wegschreiben.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  return { state, save, status } as const;
}
