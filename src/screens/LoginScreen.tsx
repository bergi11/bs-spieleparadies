import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export function LoginScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;

    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="centered">
      <form className="card login" onSubmit={onSubmit}>
        <div className="login-logo">🎮</div>
        <h1>Spieleparadies</h1>
        <p className="muted">Ohne Werbung. Nur für uns.</p>

        <input
          type="password"
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Passwort"
          autoComplete="current-password"
          autoFocus
          enterKeyHint="go"
        />

        {error && <p className="error">{error}</p>}

        <button className="button" type="submit" disabled={busy || !password}>
          {busy ? 'Moment…' : 'Rein damit'}
        </button>
      </form>
    </div>
  );
}
