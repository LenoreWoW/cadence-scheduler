import React, { useEffect, useState } from 'react';
import { apiJson } from '../services/api';

interface Challenge {
  id: string;
  title: string;
  description?: string;
  targetCount: number;
  currentCount: number;
  endsAt?: string;
  reward?: string;
}

interface ChallengesCardProps {
  lang?: 'en' | 'ar';
}

/**
 * ChallengesCard
 *
 * Dashboard card showing the user's active challenges with a progress bar
 * each. Pulls from /api/challenges/active and falls back to an empty state
 * if the endpoint isn't implemented yet.
 */
export const ChallengesCard: React.FC<ChallengesCardProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Challenge[]>('/api/challenges/active');
        if (!cancelled) setChallenges(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const labels = {
    title: lang === 'ar' ? 'التحديات النشطة' : 'Active challenges',
    subtitle: lang === 'ar' ? 'أكمل لتحصل على XP' : 'Complete them for XP',
    none: lang === 'ar' ? 'لا توجد تحديات نشطة الآن — تحقق لاحقاً.' : 'No active challenges right now — check back later.',
    soon: lang === 'ar' ? 'التحديات قريباً' : 'Challenges coming soon',
    soonMsg: lang === 'ar' ? 'سيظهر تحدٍ جديد كل أسبوع.' : 'A new challenge will appear here every week.',
    ends: lang === 'ar' ? 'ينتهي' : 'Ends',
  };

  return (
    <div className="bg-gradient-to-br from-white via-white to-gray-50 border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8A1538] to-[#5f0e26] text-white flex items-center justify-center shadow-md shadow-[#8A1538]/20">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.673z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-charcoal">{labels.title}</h3>
          <p className="text-[11px] text-gray-500">{labels.subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          <div className="h-14 bg-gray-50 rounded-lg animate-pulse" />
        </div>
      ) : unavailable ? (
        <div className="text-center py-6">
          <p className="text-sm font-bold text-charcoal mb-1">{labels.soon}</p>
          <p className="text-xs text-gray-500">{labels.soonMsg}</p>
        </div>
      ) : challenges.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6">{labels.none}</p>
      ) : (
        <div className="space-y-4">
          {challenges.map((c) => {
            const pct = Math.min(100, Math.round((c.currentCount / Math.max(1, c.targetCount)) * 100));
            return (
              <div key={c.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-charcoal">{c.title}</p>
                  <span className="text-[10px] font-mono text-gray-400">
                    {c.currentCount}/{c.targetCount}
                  </span>
                </div>
                {c.description && <p className="text-[11px] text-gray-500 mb-2">{c.description}</p>}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8A1538] to-[#5f0e26] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {c.endsAt && (
                  <p className="text-[10px] font-mono text-gray-400 mt-1.5">
                    {labels.ends} {new Date(c.endsAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChallengesCard;
