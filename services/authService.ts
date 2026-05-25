/**
 * Authentication Service
 *
 * Talks to the Express backend at `/api/auth/*`. Stores access/refresh tokens
 * via `services/api.ts` helpers and caches the current user in localStorage
 * under `cadence_user` for instant rehydration on page load.
 */

import { User, Role, UserAvailability } from '../types';
import { apiFetch, apiJson, setTokens, clearTokens } from './api';

const SESSION_KEY = 'cadence_user';

// Server response shape (matches server/routes/auth.ts).
interface ServerUser {
  id: string;
  username: string;
  name: string;
  role: string;
  title?: string | null;
  avatar?: string | null;
  email?: string | null;
  teamId?: string | null;
  timezone?: string | null;
  onboardingCompleted?: boolean;
  availability?: UserAvailability | null;
}

interface AuthResponse {
  user: ServerUser;
  accessToken: string;
  refreshToken: string;
}

/** Normalize a server user payload into the frontend `User` shape. */
function toUser(s: ServerUser): User {
  const user: User = {
    id: s.id,
    username: s.username,
    name: s.name,
    role: (s.role as Role) || 'guest',
  };
  if (s.title) user.title = s.title;
  if (s.avatar) user.avatar = s.avatar;
  if (s.email) user.email = s.email;
  if (s.teamId) user.teamId = s.teamId;
  if (s.timezone) user.timezone = s.timezone;
  if (typeof s.onboardingCompleted === 'boolean') {
    user.onboardingCompleted = s.onboardingCompleted;
  }
  if (s.availability) user.availability = s.availability;
  return user;
}

function persistUser(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export const authService = {
  async login(username: string, password: string): Promise<User> {
    const res = await apiJson<AuthResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    const user = toUser(res.user);
    persistUser(user);
    return user;
  },

  async register(
    name: string,
    username: string,
    password: string,
    email?: string,
  ): Promise<User> {
    const res = await apiJson<AuthResponse>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, email }),
    });

    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    const user = toUser(res.user);
    persistUser(user);
    return user;
  },

  async logout(): Promise<void> {
    try {
      // Best-effort — server might be unreachable, but we always clear locally.
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* swallow — clear local state regardless */
    }
    clearTokens();
    localStorage.removeItem(SESSION_KEY);
  },

  /**
   * Read the cached user from localStorage (synchronous).
   * Use this for instant UI hydration on page load; call `fetchCurrentUser`
   * to validate against the server.
   */
  getCurrentSession(): User | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  /**
   * Validate the access token against the server and return the fresh user.
   * Throws if the token is invalid (refresh will be attempted automatically
   * by `apiFetch`; if that also fails the `auth:logout` event is dispatched).
   */
  async fetchCurrentUser(): Promise<User> {
    const user = await apiJson<ServerUser>('/api/auth/me', { method: 'GET' });
    const mapped = toUser(user);
    persistUser(mapped);
    return mapped;
  },
};
