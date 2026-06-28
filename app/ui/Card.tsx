import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`surface rounded-2xl p-5 [box-shadow:var(--shadow)] ${className}`} {...props}>
    {children}
  </div>
);
