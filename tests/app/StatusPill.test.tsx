import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusPill } from '../../app/ui/StatusPill';

describe('StatusPill', () => {
  it('renders the friendly label for a known status', () => {
    render(<StatusPill status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders pending', () => {
    render(<StatusPill status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('falls back to the raw value for an unknown status', () => {
    render(<StatusPill status="archived" />);
    expect(screen.getByText('archived')).toBeInTheDocument();
  });
});
