import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusPill } from '../../app/ui/StatusPill';
import { I18nProvider } from '../../app/lib/i18n';

const renderPill = (status: string) =>
  render(
    <I18nProvider>
      <StatusPill status={status} />
    </I18nProvider>,
  );

describe('StatusPill', () => {
  it('renders the friendly label for a known status', () => {
    renderPill('approved');
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders pending', () => {
    renderPill('pending');
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('falls back to the raw value for an unknown status', () => {
    renderPill('archived');
    expect(screen.getByText('archived')).toBeInTheDocument();
  });
});
