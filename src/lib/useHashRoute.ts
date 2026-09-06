import { useEffect, useState } from 'react';

/**
 * Winziger Router über den URL-Hash. Reicht für das Launchpad und hat den
 * Vorteil, dass die Zurück-Taste des Handys wie erwartet funktioniert.
 */
export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
  };

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate('/');
  };

  return { route, navigate, back } as const;
}
