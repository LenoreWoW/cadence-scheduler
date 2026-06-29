import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { I18nProvider } from '../../app/lib/i18n';
import { AuthProvider } from '../../app/lib/auth';
import { authService } from '../../services/authService';
import type { User } from '../../types';

interface Opts {
  route?: string;
  user?: User | null;
}

// Render a component inside the full app provider stack (router + i18n + query + auth).
// `user` is injected via the auth session cache so useAuth() resolves it synchronously.
export function renderWithProviders(ui: React.ReactElement, { route = '/', user = null }: Opts = {}) {
  vi.spyOn(authService, 'getCurrentSession').mockReturnValue(user);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{ui}</AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

export const adminUser: User = { id: '0', username: 'admin', name: 'System Admin', role: 'admin', title: 'Administrator' };
export const guestUser: User = { id: '3', username: 'user1', name: 'Ahmed Client', role: 'guest' };
