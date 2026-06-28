/**
 * Auth Service Tests — covers the current API-backed authService
 * (talks to /api/auth/* via services/api; caches the user in localStorage).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the HTTP layer so no real network happens.
vi.mock('../services/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

import { authService } from '../services/authService';
import { apiFetch, apiJson, setTokens, clearTokens } from '../services/api';

const SESSION_KEY = 'cadence_user';

const serverUser = {
  id: '1',
  username: 'manager',
  name: 'Abdul Rahman',
  role: 'manager',
  title: 'Senior Consultant',
  email: 'a@x.com',
};
const authResponse = { user: serverUser, accessToken: 'a.token', refreshToken: 'r.token' };

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    it('logs in, stores tokens, and caches the mapped user', async () => {
      vi.mocked(apiJson).mockResolvedValue(authResponse as any);

      const user = await authService.login('manager', 'password');

      expect(apiJson).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }));
      expect(setTokens).toHaveBeenCalledWith({ accessToken: 'a.token', refreshToken: 'r.token' });
      expect(user.id).toBe('1');
      expect(user.username).toBe('manager');
      expect(user.role).toBe('manager');
      // Cached for instant rehydration.
      expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toMatchObject({ id: '1', username: 'manager' });
    });

    it('rejects on invalid credentials and stores nothing', async () => {
      vi.mocked(apiJson).mockRejectedValue(new Error('Invalid credentials'));

      await expect(authService.login('nope', 'wrong')).rejects.toThrow('Invalid credentials');
      expect(setTokens).not.toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });
  });

  describe('register', () => {
    it('registers and caches the new user', async () => {
      vi.mocked(apiJson).mockResolvedValue({
        ...authResponse,
        user: { ...serverUser, id: '9', username: 'newuser', role: 'guest', title: null },
      } as any);

      const user = await authService.register('New User', 'newuser', 'password', 'n@x.com');

      expect(apiJson).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }));
      expect(user.username).toBe('newuser');
      expect(user.role).toBe('guest');
      expect(setTokens).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears tokens and the cached session', async () => {
      vi.mocked(apiFetch).mockResolvedValue({} as any);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: '1' }));

      await authService.logout();

      expect(apiFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
      expect(clearTokens).toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('still clears local state when the server logout fails', async () => {
      vi.mocked(apiFetch).mockRejectedValue(new Error('offline'));
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: '1' }));

      await authService.logout();

      expect(clearTokens).toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    it('returns null when no session is cached', () => {
      expect(authService.getCurrentSession()).toBeNull();
    });

    it('returns the cached user when present', () => {
      const cached = { id: '1', username: 'test', name: 'Test', role: 'guest' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(cached));
      expect(authService.getCurrentSession()).toEqual(cached);
    });

    it('returns null for corrupt cached JSON', () => {
      localStorage.setItem(SESSION_KEY, '{not json');
      expect(authService.getCurrentSession()).toBeNull();
    });
  });

  describe('fetchCurrentUser', () => {
    it('validates against the server and re-caches', async () => {
      vi.mocked(apiJson).mockResolvedValue(serverUser as any);

      const user = await authService.fetchCurrentUser();

      expect(apiJson).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ method: 'GET' }));
      expect(user.id).toBe('1');
      expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toMatchObject({ id: '1' });
    });
  });
});
