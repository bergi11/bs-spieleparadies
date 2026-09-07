import type { ComponentType } from 'react';
import type { User } from '../lib/api';
import { Wordle } from './wordle/Wordle';
import { WordPuzzle } from './wordpuzzle/WordPuzzle';
import { Clever } from './clever/Clever';
import { Hangman } from './hangman/Hangman';

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
  /**
   * Wert für die Bestenliste – höher ist besser. `null`, wenn noch nichts
   * zu werten ist. `text` steht in der Liste, `wert` bestimmt die Reihenfolge.
   */
  bestwert?: (state: unknown) => { wert: number; text: string } | null;
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
    bestwert: (state) => {
      const s = state as { stats?: { won?: number; maxStreak?: number } } | null;
      if (!s?.stats?.won) return null;
      const { won = 0, maxStreak = 0 } = s.stats;
      return { wert: won, text: `${won} gelöst · beste Serie ${maxStreak}` };
    },
  },
  {
    id: 'wordpuzzle',
    title: 'Wortsalat',
    tagline: 'Buchstaben zu Wörtern verbinden',
    icon: '🔡',
    accent: '#ffb703',
    component: WordPuzzle,
    summary: (state) => {
      const s = state as { level?: number; bonusTotal?: number } | null;
      if (!s?.level) return null;
      const bonus = s.bonusTotal ?? 0;
      return bonus ? `Level ${s.level} · ✦ ${bonus}` : `Level ${s.level}`;
    },
    bestwert: (state) => {
      const s = state as { solved?: number; bonusTotal?: number } | null;
      if (!s?.solved) return null;
      return { wert: s.solved, text: `${s.solved} Level · ✦ ${s.bonusTotal ?? 0}` };
    },
  },
  {
    id: 'clever',
    title: 'Clever 4Ever',
    tagline: 'Würfelspiel, Solo',
    icon: '🎲',
    accent: '#ff8c42',
    component: Clever,
    summary: (state) => {
      const s = state as { laufend?: unknown; beste?: number; partien?: number } | null;
      if (s?.laufend) return 'Partie läuft';
      if (!s?.partien) return null;
      return `${s.partien} Partien · beste ${s.beste ?? 0}`;
    },
    bestwert: (state) => {
      const s = state as { beste?: number; partien?: number } | null;
      if (!s?.partien) return null;
      return { wert: s.beste ?? 0, text: `${s.beste ?? 0} Punkte · ${s.partien} Partien` };
    },
  },
  {
    id: 'hangman',
    title: 'Galgenmännchen',
    tagline: 'Buchstaben raten, Strich für Strich',
    icon: '🪢',
    accent: '#ff5d8f',
    component: Hangman,
    summary: (state) => {
      const s = state as { stats?: { played?: number; streak?: number } } | null;
      if (!s?.stats?.played) return null;
      const { played = 0, streak = 0 } = s.stats;
      return `${played} gespielt · Serie ${streak}`;
    },
    bestwert: (state) => {
      const s = state as { stats?: { won?: number; maxStreak?: number } } | null;
      if (!s?.stats?.won) return null;
      const { won = 0, maxStreak = 0 } = s.stats;
      return { wert: won, text: `${won} gerettet · beste Serie ${maxStreak}` };
    },
  },
];

export const gameById = (id: string) => GAMES.find((game) => game.id === id);
