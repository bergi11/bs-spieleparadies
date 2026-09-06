import { useState, type FormEvent } from 'react';
import { api, type User } from '../lib/api';

const AVATARS = ['🎮', '🦊', '🐙', '🐼', '🐧', '🦉', '🐳', '🌵', '🍄', '⭐', '🍕', '🐝'];
const COLORS = ['#7c5cff', '#3ddc97', '#ffb703', '#ff5d8f', '#4cc9f0', '#f77f00'];

interface Props {
  users: User[];
  activeUserId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<User[]>;
  onClose?: () => void;
  onLogout: () => void;
}

export function ProfileScreen({ users, activeUserId, onSelect, onChanged, onClose, onLogout }: Props) {
  const [creating, setCreating] = useState(users.length === 0);

  return (
    <div className="centered">
      <div className="card profiles">
        <h1>Wer spielt?</h1>

        {users.length > 0 && (
          <ul className="profile-list">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  className={user.id === activeUserId ? 'profile active' : 'profile'}
                  onClick={() => onSelect(user.id)}
                >
                  <span className="profile-avatar" style={{ background: user.color }}>
                    {user.avatar}
                  </span>
                  <span className="profile-name">{user.name}</span>
                  {user.id === activeUserId && <span className="profile-check">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {creating ? (
          <NewProfileForm
            onCancel={users.length > 0 ? () => setCreating(false) : undefined}
            onCreated={async (id) => {
              await onChanged();
              setCreating(false);
              onSelect(id);
            }}
          />
        ) : (
          <button className="button button-ghost" onClick={() => setCreating(true)}>
            + Neues Profil
          </button>
        )}

        <div className="profile-footer">
          {onClose && (
            <button className="link" onClick={onClose}>
              Zurück
            </button>
          )}
          <button className="link" onClick={onLogout}>
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProfileForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !name.trim()) return;

    setBusy(true);
    setError(null);
    try {
      const { user } = await api.createUser({ name: name.trim(), avatar, color });
      await onCreated(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil konnte nicht angelegt werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="new-profile" onSubmit={submit}>
      <input
        className="input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        maxLength={20}
        autoFocus
        enterKeyHint="done"
      />

      <div className="picker">
        {AVATARS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === avatar ? 'chip active' : 'chip'}
            onClick={() => setAvatar(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="picker">
        {COLORS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === color ? 'swatch active' : 'swatch'}
            style={{ background: option }}
            onClick={() => setColor(option)}
            aria-label={`Farbe ${option}`}
          />
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="sheet-actions">
        <button className="button" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Moment…' : 'Anlegen'}
        </button>
        {onCancel && (
          <button className="button button-ghost" type="button" onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
