/**
 * Auth Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';

// Mock storageService
vi.mock('../services/storageService', () => ({
  storageService: {
    init: vi.fn(),
    getUsers: vi.fn(),
    saveUser: vi.fn(),
    getUserStats: vi.fn().mockReturnValue(null)
  }
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUsers = [
        { id: '1', username: 'testuser', name: 'Test User', role: 'manager' }
      ];
      vi.mocked(storageService.getUsers).mockReturnValue(mockUsers);

      const user = await authService.login('testuser', 'password');
      
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(storageService.init).toHaveBeenCalled();
    });

    it('should reject invalid credentials', async () => {
      vi.mocked(storageService.getUsers).mockReturnValue([]);

      await expect(authService.login('invalid', 'wrong'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should create a new user with guest role', async () => {
      vi.mocked(storageService.getUsers).mockReturnValue([]);

      const user = await authService.register('New User', 'newuser', 'password');
      
      expect(user).toBeDefined();
      expect(user.username).toBe('newuser');
      expect(user.role).toBe('guest');
      expect(storageService.saveUser).toHaveBeenCalled();
    });

    it('should reject duplicate username', async () => {
      vi.mocked(storageService.getUsers).mockReturnValue([
        { id: '1', username: 'existing', name: 'Existing', role: 'guest' }
      ]);

      await expect(authService.register('New', 'existing', 'password'))
        .rejects.toThrow('Username already exists');
    });
  });

  describe('logout', () => {
    it('should clear session', () => {
      localStorage.setItem('al_adaam_session', JSON.stringify({ id: '1' }));
      
      authService.logout();
      
      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('getCurrentSession', () => {
    it('should return null when no session exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      
      const session = authService.getCurrentSession();
      
      expect(session).toBeNull();
    });

    it('should return user when session exists', () => {
      const mockUser = { id: '1', username: 'test', name: 'Test', role: 'guest' };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockUser));
      
      const session = authService.getCurrentSession();
      
      expect(session).toEqual(mockUser);
    });
  });
});

