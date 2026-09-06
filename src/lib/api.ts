export interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  created_at: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });

  const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Etwas ist schiefgelaufen.';
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const api = {
  checkSession: () => request<{ authenticated: boolean }>('/api/session'),

  login: (password: string) =>
    request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),

  logout: () => request<{ ok: true }>('/api/session', { method: 'DELETE' }),

  listUsers: () => request<{ users: User[] }>('/api/users'),

  createUser: (input: { name: string; avatar: string; color: string }) =>
    request<{ user: User }>('/api/users', { method: 'POST', body: JSON.stringify(input) }),

  deleteUser: (id: string) =>
    request<{ ok: true }>(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  loadSave: <T>(userId: string, gameId: string) =>
    request<{ state: T | null; updatedAt: string | null }>(
      `/api/saves?user=${encodeURIComponent(userId)}&game=${encodeURIComponent(gameId)}`,
    ),

  loadAllSaves: (userId: string) =>
    request<{ states: Record<string, { state: unknown; updatedAt: string }> }>(
      `/api/saves?user=${encodeURIComponent(userId)}`,
    ),

  putSave: (userId: string, gameId: string, state: unknown) =>
    request<{ ok: true; updatedAt: string }>('/api/saves', {
      method: 'PUT',
      body: JSON.stringify({ userId, gameId, state }),
    }),
};
