/**
 * Authentication Hook and Context
 *
 * Provides authentication state and methods throughout the app. Backed by
 * `services/authService.ts` which talks to the Express backend.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Role } from '../types';
import { authService } from '../services/authService';
import { getAccessToken } from '../services/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => {
    // Hydrate instantly from cached user — token validation happens in effect.
    const cached = authService.getCurrentSession();
    return {
      user: cached,
      loading: !!cached, // if we have a cached user, we're about to validate
      error: null,
      isAuthenticated: !!cached,
    };
  });

  // On mount: validate the cached session against the server. If validation
  // fails (and refresh fails), `apiFetch` will fire `auth:logout` and our
  // listener below will clear state.
  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      const hasToken = !!getAccessToken();
      const cached = authService.getCurrentSession();

      if (!hasToken || !cached) {
        // No token or no cached user — nothing to validate.
        if (!cancelled) {
          setState({
            user: null,
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        }
        return;
      }

      try {
        const fresh = await authService.fetchCurrentUser();
        if (cancelled) return;
        setState({
          user: fresh,
          loading: false,
          error: null,
          isAuthenticated: true,
        });
      } catch {
        // apiFetch will have already cleared tokens + dispatched auth:logout
        // when refresh fails; if it's a different error we still clear state
        // here so the UI doesn't hang on `loading: true`.
        if (cancelled) return;
        setState({
          user: null,
          loading: false,
          error: null,
          isAuthenticated: false,
        });
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, []);

  // React to global logout events (e.g. refresh failure inside apiFetch).
  useEffect(() => {
    const handleAuthLogout = () => {
      setState({
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      });
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const user = await authService.login(username, password);
      setState({
        user,
        loading: false,
        error: null,
        isAuthenticated: true,
      });
    } catch (err: any) {
      const message = err?.body?.error || err?.message || 'Login failed';
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }));
      throw err;
    }
  }, []);

  const register = useCallback(
    async (name: string, username: string, password: string, email?: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const user = await authService.register(name, username, password, email);
        setState({
          user,
          loading: false,
          error: null,
          isAuthenticated: true,
        });
      } catch (err: any) {
        const message = err?.body?.error || err?.message || 'Registration failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
        }));
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setState({
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authService.fetchCurrentUser();
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: true,
      }));
    } catch {
      // auth:logout listener will handle clearing state on hard failure.
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook for protected routes
export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, loading, redirectTo]);

  return { isAuthenticated, loading };
}

// Helper hook for role-based access
export function useRequireRole(requiredRoles: Role[], redirectTo = '/') {
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (!requiredRoles.includes(user.role)) {
        window.location.href = redirectTo;
      }
    }
  }, [user, loading, isAuthenticated, requiredRoles, redirectTo]);

  return { user, loading, hasAccess: user ? requiredRoles.includes(user.role) : false };
}
