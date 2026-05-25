import React, { useEffect, useState } from 'react';
import { apiJson } from '../services/api';

interface TeamScore {
  teamId: string;
  teamName: string;
  color?: string | null;
  totalXp: number;
  memberCount: number;
  rank: number;
}

interface TeamCompetitionLeaderboardProps {
  lang?: 'en' | 'ar';
}

/**
 * TeamCompetitionLeaderboard
 *
 * Renders team-vs-team rankings from /api/leaderboard/team-competition. If
 * the endpoint isn't ready, displays a clear empty state.
 */
export const TeamCompetitionLeaderboard: React.FC<TeamCompetitionLeaderboardProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<TeamScore[]>('/api/leaderboard/team-competition');
        if (!cancelled) setTeams(Array.isArray(data) ? data : []);
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
    title: lang === 'ar' ? 'منافسة الفرق' : 'Team competition',
    subtitle: lang === 'ar' ? 'ترتيب الفرق حسب XP' : 'Teams ranked by total XP',
    soon: lang === 'ar' ? 'منافسات الفرق قريباً — قيد التطوير' : 'Team competitions coming soon — backend pending.',
    members: lang === 'ar' ? 'أعضاء' : 'members',
    xp: 'XP',
    empty: lang === 'ar' ? 'لا توجد فرق متنافسة بعد.' : 'No competing teams yet.',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-5">
        <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
        <p className="text-xs text-gray-500">{labels.subtitle}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : unavailable ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 italic">{labels.soon}</p>
        </div>
      ) : teams.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">{labels.empty}</p>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <div
              key={t.teamId}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-white to-gray-50 border border-gray-100 rounded-xl hover:shadow-md transition-shadow"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md ${
                  t.rank === 1
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                    : t.rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                    : t.rank === 3
                    ? 'bg-gradient-to-br from-amber-500 to-amber-700'
                    : 'bg-gray-200 text-charcoal'
                }`}
              >
                {t.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-charcoal truncate">{t.teamName}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                  {t.memberCount} {labels.members}
                </p>
              </div>
              <div className="text-right rtl:text-left">
                <p className="text-lg font-display font-bold text-[#8A1538]">{t.totalXp.toLocaleString()}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{labels.xp}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamCompetitionLeaderboard;
