import React from 'react';
import { motion } from 'motion/react';

interface PageHeaderProps {
  eyebrow?: string;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

// Branded header band for secondary screens — soft maroon mesh + faded grid +
// noise, so pages have depth instead of a bare title on a flat canvas.
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, icon, title, subtitle, right }) => (
  <header className="relative overflow-hidden border-b border-[color:var(--border)] gba-mesh noise">
    <div className="absolute inset-0 gba-grid opacity-70" aria-hidden="true" />
    <div className="relative mx-auto max-w-6xl px-5 py-10 md:py-12 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && (
          <motion.span
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-al-adaam/10 text-al-adaam px-3 py-1 text-xs font-semibold mb-3"
          >
            {icon}
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="font-display text-3xl md:text-4xl font-semibold tracking-tight"
        >
          {title}
        </motion.h1>
        {subtitle && <p className="text-muted text-sm mt-1.5 max-w-xl">{subtitle}</p>}
      </div>
      {right && <div className="relative flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  </header>
);
