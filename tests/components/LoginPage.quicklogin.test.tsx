import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LoginPage } from '../../components/LoginPage';
import { authService } from '../../services/authService';

vi.mock('../../components/LoginScene3D', () => ({ LoginScene3D: () => null }));

const t = (k: string) => k;

describe('LoginPage quick login', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('renders a button per role', () => {
    render(<LoginPage onLogin={vi.fn()} lang="en" t={t} toggleLang={vi.fn()} />);
    expect(screen.getByText('roleAdmin')).toBeInTheDocument();
    expect(screen.getByText('roleManager')).toBeInTheDocument();
    expect(screen.getByText('roleSubordinate')).toBeInTheDocument();
    expect(screen.getByText('roleGuest')).toBeInTheDocument();
  });

  it('clicking a role logs in with the seeded account and calls onLogin', async () => {
    const fakeUser = { id: '2', username: 'sub', role: 'subordinate', name: 'Fatima' } as any;
    const login = vi.spyOn(authService, 'login').mockResolvedValue(fakeUser);
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} lang="en" t={t} toggleLang={vi.fn()} />);
    fireEvent.click(screen.getByText('roleSubordinate'));
    await waitFor(() => expect(login).toHaveBeenCalledWith('sub', 'password'));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(fakeUser));
  });
});
