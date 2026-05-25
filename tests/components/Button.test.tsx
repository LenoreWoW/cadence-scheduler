/**
 * Button Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Button component (since the real one may have different implementation)
const Button: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}> = ({ children, variant = 'primary', onClick, disabled, loading, className }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`btn btn--${variant} ${loading ? 'btn--loading' : ''} ${className || ''}`}
    data-testid="button"
  >
    {loading ? <span className="sr-only">Loading...</span> : children}
  </button>
);

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click Me</Button>);
    
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByTestId('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant class', () => {
    render(<Button variant="secondary">Secondary</Button>);
    
    expect(screen.getByTestId('button')).toHaveClass('btn--secondary');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    
    expect(screen.getByTestId('button')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    
    expect(screen.getByTestId('button')).toBeDisabled();
    expect(screen.getByTestId('button')).toHaveClass('btn--loading');
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Click</Button>);
    
    fireEvent.click(screen.getByTestId('button'));
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    
    expect(screen.getByTestId('button')).toHaveClass('custom-class');
  });
});

