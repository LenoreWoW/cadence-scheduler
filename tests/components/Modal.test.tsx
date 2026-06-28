import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Modal } from '../../components/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onClose={vi.fn()}>hi</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('renders children + title with dialog semantics when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="My Title">body content</Modal>);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });
  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T">x</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
