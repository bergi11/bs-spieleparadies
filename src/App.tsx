import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, type User } from './lib/api';
import { useHashRoute } from './lib/useHashRoute';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { Launchpad } from './screens/Launchpad';
import { gameById } from './games/registry';

const LAST_USER_KEY = 'bsp.lastUser';

type AuthState = 'prüfen' | 'gesperrt' | 'offen';

export function App() {
  const [auth, setAuth] = useState<AuthState>('prüfen');
  const [users, setUsers] = useState<User[] | null>(null);
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(LAST_USER_KEY));
  const { route, navigate, back } = useHashRoute();

  useEffect(() => {
    api
      .checkSession()
      .then(({ authenticated }) => setAuth(authenticated ? 'offen' : 'gesperrt'))
      .catch(() => setAuth('gesperrt'));
  }, []);

  const refreshUsers = useCallback(async () => {
    const { users: list } = await api.listUsers();
    setUsers(list);
    return list;
  }, []);

  useEffect(() => {
    if (auth !== 'offen') return;
    refreshUsers().catch((err) => {
      // Ein abgelaufenes Cookie merken wir erst beim ersten echten Aufruf.
      if (err instanceof ApiError && err.status === 401) setAuth('gesperrt');
    });
  }, [auth, refreshUsers]);

  const selectUser = useCallback((id: string | null) => {
    setUserId(id);
    if (id) localStorage.setItem(LAST_USER_KEY, id);
    else localStorage.removeItem(LAST_USER_KEY);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    selectUser(null);
    setUsers(null);
    setAuth('gesperrt');
    navigate('/');
  }, [navigate, selectUser]);

  if (auth === 'prüfen') {
    return <div className="splash">…</div>;
  }

  if (auth === 'gesperrt') {
    return <LoginScreen onUnlocked={() => setAuth('offen')} />;
  }

  if (!users) {
    return <div className="splash">…</div>;
  }

  // Ein gelöschtes oder auf einem anderen Gerät entferntes Profil fällt hier raus.
  const user = users.find((candidate) => candidate.id === userId) ?? null;

  if (!user || route === '/profile') {
    return (
      <ProfileScreen
        users={users}
        activeUserId={user?.id ?? null}
        onSelect={(id) => {
          selectUser(id);
          navigate('/');
        }}
        onChanged={refreshUsers}
        onClose={user ? () => navigate('/') : undefined}
        onLogout={logout}
      />
    );
  }

  const gameMatch = route.match(/^\/game\/(.+)$/);
  if (gameMatch) {
    const game = gameById(gameMatch[1]);
    if (game) {
      const Game = game.component;
      return <Game user={user} onExit={back} />;
    }
  }

  return (
    <Launchpad
      user={user}
      onOpenGame={(id) => navigate(`/game/${id}`)}
      onSwitchUser={() => navigate('/profile')}
    />
  );
}
