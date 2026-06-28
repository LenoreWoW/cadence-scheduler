import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelpModal } from '../../components/HelpModal';
import { tourService } from '../../services/tourService';

const t = (k: string) => k; // identity: assert on keys

describe('HelpModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<HelpModal isOpen={false} onClose={vi.fn()} t={t} lang="en" role="manager" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the guide sections when open', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} t={t} lang="en" role="manager" />);
    expect(screen.getByText('helpTitle')).toBeInTheDocument();
    expect(screen.getByText('helpColorsBody')).toBeInTheDocument();
    expect(screen.getByText('helpTentativeBody')).toBeInTheDocument();
  });

  it('starting the guided tour resets+starts welcome and closes', () => {
    const reset = vi.spyOn(tourService, 'resetTour');
    const start = vi.spyOn(tourService, 'startTour');
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} t={t} lang="en" role="manager" />);
    fireEvent.click(screen.getByText('helpStartTour'));
    expect(reset).toHaveBeenCalledWith('welcome');
    expect(start).toHaveBeenCalledWith('welcome');
    expect(onClose).toHaveBeenCalled();
    reset.mockRestore(); start.mockRestore();
  });

  it('hides the admin tour button for non-admins', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} t={t} lang="en" role="manager" />);
    expect(screen.queryByText('helpStartAdmin')).not.toBeInTheDocument();
  });
});
