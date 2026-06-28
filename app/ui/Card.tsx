import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ className = '', interactive = false, children, ...props }) => (
  <div
    className={`surface rounded-2xl p-5 [box-shadow:var(--shadow)] ${interactive ? 'elevate' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);
