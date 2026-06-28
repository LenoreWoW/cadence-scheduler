import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { PortalGate } from '../../components/PortalGate';
import { authService } from '../../services/authService';

const t = (k: string) => k;

describe('PortalGate', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('always shows the portal sign-in placeholder', () => {
    render(<PortalGate onLogin={vi.fn()} lang="en" t={t} toggleLang={vi.fn()} />);
    expect(screen.getByText('portalSignInTitle')).toBeInTheDocument();
    expect(screen.getByText('portalSignInButton')).toBeInTheDocument();
  });

  // import.meta.env.DEV is true under Vitest, so the dev-only quick entry renders.
  it('renders a dev quick-login button per role', () => {
    render(<PortalGate onLogin={vi.fn()} lang="en" t={t} toggleLang={vi.fn()} />);
    expect(screen.getByText('roleAdmin')).toBeInTheDocument();
    expect(screen.getByText('roleManager')).toBeInTheDocument();
    expect(screen.getByText('roleSubordinate')).toBeInTheDocument();
    expect(screen.getByText('roleGuest')).toBeInTheDocument();
  });

  it('clicking a role logs in with the seeded account and calls onLogin', async () => {
    const fakeUser = { id: '2', username: 'sub', role: 'subordinate', name: 'Fatima' } as any;
    const login = vi.spyOn(authService, 'login').mockResolvedValue(fakeUser);
    const onLogin = vi.fn();
    render(<PortalGate onLogin={onLogin} lang="en" t={t} toggleLang={vi.fn()} />);
    fireEvent.click(screen.getByText('roleSubordinate'));
    await waitFor(() => expect(login).toHaveBeenCalledWith('sub', 'password'));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(fakeUser));
  });
});
