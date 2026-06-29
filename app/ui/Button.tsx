import React from 'react';
import { motion } from 'motion/react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-al-adaam text-white hover:bg-al-adaam-dark shadow-sm',
  secondary: 'surface text-[color:var(--text)] hover:bg-[color:var(--surface-2)]',
  ghost: 'text-[color:var(--text)] hover:bg-[color:var(--surface-2)]',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', children, ...props }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 min-h-11 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ring-focus ${VARIANTS[variant]} ${className}`}
    {...(props as any)}
  >
    {children}
  </motion.button>
);
