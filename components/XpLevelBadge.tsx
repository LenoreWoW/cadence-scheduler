import React, { useEffect, useState } from 'react';
import { apiJson } from '../services/api';

interface XpData {
  level: number;
  xp: number;
  xpForNextLevel: number;
  xpInLevel?: number;
  xpToNextLevel?: number;
}

interface XpLevelBadgeProps {
  lang?: 'en' | 'ar';
  className?: string;
}

/**
 * XpLevelBadge
 *
 * Small badge for the app header showing the user's level and a circular
 * progress ring representing XP toward the next level.
 */
export const XpLevelBadge: React.FC<XpLevelBadgeProps> = ({ lang = 'en', className = '' }) => {
  const [data, setData] = useState<XpData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<XpData>('/api/gamification/me');
        if (!cancelled) setData(res);
      } catch {
        /* swallow — backend may not be ready */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const xpIn = data.xpInLevel ?? data.xp ?? 0;
  const xpFor = data.xpForNextLevel || data.xpToNextLevel || 100;
  const pct = Math.min(100, Math.max(0, Math.round((xpIn / Math.max(1, xpFor)) * 100)));

  // Circumference of a circle r=14 is 2πr ≈ 87.96
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center w-9 h-9 ${className}`}
      title={lang === 'ar' ? `المستوى ${data.level} · ${pct}%` : `Level ${data.level} · ${pct}%`}
      aria-label={lang === 'ar' ? `المستوى ${data.level}` : `Level ${data.level}`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f0f0f0" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#8A1538"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="relative text-[11px] font-bold text-[#8A1538] font-mono">{data.level}</span>
    </div>
  );
};

export default XpLevelBadge;
