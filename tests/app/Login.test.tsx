import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Login } from '../../app/routes/Login';
import { authService } from '../../services/authService';
import { languageService } from '../../services/languageService';
import { renderWithProviders, adminUser } from './providers';

describe('Login', () => {
  afterEach(() => languageService.setLanguage('en'));

  it('shows the per-role dev quick-login buttons', () => {
    renderWithProviders(<Login />, { route: '/login' });
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manager' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subordinate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guest' })).toBeInTheDocument();
  });

  it('calls authService.login with the chosen role credentials', async () => {
    const spy = vi.spyOn(authService, 'login').mockResolvedValue(adminUser);
    renderWithProviders(<Login />, { route: '/login' });

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('admin', 'password'));
  });

  it('surfaces a sign-in error', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue({ body: { error: 'Bad creds' } });
    renderWithProviders(<Login />, { route: '/login' });

    fireEvent.click(screen.getByRole('button', { name: 'Manager' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bad creds');
  });

  it('switches the login copy to Arabic via the language toggle', () => {
    renderWithProviders(<Login />, { route: '/login' });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
  });
});
