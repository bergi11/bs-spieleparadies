import type { ComponentType } from 'react';
import type { User } from '../lib/api';
import { Wordle } from './wordle/Wordle';
import { WordPuzzle } from './wordpuzzle/WordPuzzle';
import { Clever } from './clever/Clever';
import { Hangman } from './hangman/Hangman';
import { Intersections } from './intersections/Intersections';
import { Skyscrapers } from './skyscrapers/Skyscrapers';
import { Nonogram } from './nonogram/Nonogram';

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
  {
    id: 'intersections',
    title: 'Schnittpunkte',
    tagline: 'Wörter für Zeile und Spalte finden',
    icon: '✚',
    accent: '#4cc9f0',
    component: Intersections,
    summary: (state) => {
      const s = state as { raetsel?: number; stats?: { geloest?: number } } | null;
      if (!s?.raetsel) return null;
      const geloest = s.stats?.geloest ?? 0;
      return geloest ? `Rätsel ${s.raetsel} · ${geloest} gelöst` : `Rätsel ${s.raetsel}`;
    },
    bestwert: (state) => {
      const s = state as { stats?: { geloest?: number; makellos?: number } } | null;
      if (!s?.stats?.geloest) return null;
      const { geloest = 0, makellos = 0 } = s.stats;
      return { wert: geloest, text: `${geloest} gelöst · ${makellos} ohne Tipp` };
    },
  },
  {
    id: 'skyscrapers',
    title: 'Wolkenkratzer',
    tagline: 'Häuser zählen, Höhen ausschließen',
    icon: '🏙️',
    accent: '#c77dff',
    component: Skyscrapers,
    summary: (state) => {
      const s = state as { raetsel?: number; stats?: { geloest?: number } } | null;
      if (!s?.raetsel) return null;
      const geloest = s.stats?.geloest ?? 0;
      return geloest ? `Rätsel ${s.raetsel} · ${geloest} gelöst` : `Rätsel ${s.raetsel}`;
    },
    bestwert: (state) => {
      const s = state as { stats?: { geloest?: number; makellos?: number } } | null;
      if (!s?.stats?.geloest) return null;
      const { geloest = 0, makellos = 0 } = s.stats;
      return { wert: geloest, text: `${geloest} gelöst · ${makellos} ohne Tipp` };
    },
  },
  {
    id: 'nonogram',
    title: 'Bildgitter',
    tagline: 'Zahlen am Rand, Bild im Gitter',
    icon: '🖼️',
    accent: '#f4a261',
    component: Nonogram,
    summary: (state) => {
      const s = state as { bild?: number; stats?: { geloest?: number } } | null;
      if (!s?.bild) return null;
      const geloest = s.stats?.geloest ?? 0;
      return geloest ? `Bild ${s.bild} · ${geloest} gelöst` : `Bild ${s.bild}`;
    },
    bestwert: (state) => {
      const s = state as { stats?: { geloest?: number; makellos?: number } } | null;
      if (!s?.stats?.geloest) return null;
      const { geloest = 0, makellos = 0 } = s.stats;
      return { wert: geloest, text: `${geloest} gelöst · ${makellos} ohne Tipp` };
    },
  },
];

export const gameById = (id: string) => GAMES.find((game) => game.id === id);
