import type { ComponentType } from 'react';
import type { User } from '../lib/api';
import { Wordle } from './wordle/Wordle';

export interface GameProps {
  user: User;
  onExit: () => void;
}

export interface GameDefinition {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  accent: string;
  component: ComponentType<GameProps>;
  /** Kurzer Fortschrittstext für die Kachel im Launchpad. */
  summary?: (state: unknown) => string | null;
}

/**
 * Zentrale Liste aller Spiele. Ein neues Spiel braucht nur eine Komponente
 * und einen Eintrag hier – Launchpad und Routing ziehen sich den Rest.
 */
export const GAMES: GameDefinition[] = [
  {
    id: 'wordle',
    title: 'Wörtchen',
    tagline: 'Tägliches Worträtsel',
    icon: '🔤',
    accent: '#3ddc97',
    component: Wordle,
    summary: (state) => {
      const s = state as { stats?: { played?: number; streak?: number } } | null;
      if (!s?.stats?.played) return null;
      const { played = 0, streak = 0 } = s.stats;
      return `${played} gespielt · Serie ${streak}`;
    },
  },
];

export const gameById = (id: string) => GAMES.find((game) => game.id === id);
