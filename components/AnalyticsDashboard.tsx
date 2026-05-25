import React, { useMemo, useState } from 'react';
import { Meeting, User, Language } from '../types';
import { translations } from '../services/translations';
import { CATEGORY_CONFIG } from '../constants';

interface AnalyticsDashboardProps {
  meetings: Meeting[];
  users: User[];
  currentUser: User;
  language: Language;
}

type TimeRange = 'week' | 'month' | 'quarter' | 'year';

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  meetings,
  users,
  currentUser,
  language
}) => {
  const t = translations[language];
  const isRTL = language === 'ar';
  
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  
  const filteredMeetings = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return meetings.filter(m => new Date(m.date) >= startDate);
  }, [meetings, timeRange]);

  const stats = useMemo(() => {
    const approved = filteredMeetings.filter(m => m.status === 'approved').length;
    const pending = filteredMeetings.filter(m => m.status === 'pending').length;
    const cancelled = filteredMeetings.filter(m => m.status === 'cancelled').length;
    const rejected = filteredMeetings.filter(m => m.status === 'rejected').length;
    
    const totalDuration = filteredMeetings
      .filter(m => m.status === 'approved')
      .reduce((sum, m) => sum + m.durationMinutes, 0);
    
    const avgDuration = approved > 0 ? Math.round(totalDuration / approved) : 0;
    
    // Meetings by category
    const byCategory: Record<string, number> = {};
    filteredMeetings.forEach(m => {
      const cat = m.category || 'general';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    
    // Meetings by day of week
    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
    filteredMeetings.forEach(m => {
      const day = new Date(m.date).getDay();
      byDayOfWeek[day]++;
    });
    
    // Peak hours
    const byHour: Record<number, number> = {};
    filteredMeetings.forEach(m => {
      const hour = parseInt(m.time.split(':')[0]);
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    let peakHour = 9;
    let peakCount = 0;
    Object.entries(byHour).forEach(([hour, count]) => {
      if (count > peakCount) {
        peakHour = parseInt(hour);
        peakCount = count;
      }
    });
    
    // Approval rate
    const total = approved + rejected;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;
    
    return {
      total: filteredMeetings.length,
      approved,
      pending,
      cancelled,
      rejected,
      avgDuration,
      totalHours: Math.round(totalDuration / 60),
      byCategory,
      byDayOfWeek,
      byHour,
      peakHour,
      approvalRate
    };
  }, [filteredMeetings]);

  const timeRangeButtons: { value: TimeRange; label: string }[] = [
    { value: 'week', label: isRTL ? 'أسبوع' : 'Week' },
    { value: 'month', label: isRTL ? 'شهر' : 'Month' },
    { value: 'quarter', label: isRTL ? 'ربع سنة' : 'Quarter' },
    { value: 'year', label: isRTL ? 'سنة' : 'Year' }
  ];

  const dayLabels = isRTL 
    ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const maxDayCount = Math.max(...stats.byDayOfWeek, 1);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-semibold text-gray-900">
            {t.analytics}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {isRTL ? 'تحليل أداء جدولك الزمني' : 'Analyze your scheduling performance'}
          </p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {timeRangeButtons.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                timeRange === value
                  ? 'bg-white text-[#8A1538] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Meetings */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">
              {isRTL ? 'إجمالي الاجتماعات' : 'Total Meetings'}
            </span>
            <span className="w-10 h-10 rounded-full bg-[#8A1538]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8A1538]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-display font-bold text-gray-900 mt-3">
            {stats.total}
          </p>
        </div>

        {/* Approved */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">{t.approved}</span>
            <span className="w-10 h-10 rounded-full bg-[#129b82]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#129b82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-display font-bold text-gray-900 mt-3">
            {stats.approved}
          </p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">{t.pending}</span>
            <span className="w-10 h-10 rounded-full bg-[#e9c56b]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#e9c56b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-display font-bold text-gray-900 mt-3">
            {stats.pending}
          </p>
        </div>

        {/* Total Hours */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">
              {isRTL ? 'ساعات الاجتماعات' : 'Meeting Hours'}
            </span>
            <span className="w-10 h-10 rounded-full bg-[#4194b3]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#4194b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-display font-bold text-gray-900 mt-3">
            {stats.totalHours}h
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Meetings by Day */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">
            {t.distribution}
          </h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {stats.byDayOfWeek.map((count, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div 
                  className="w-full bg-[#8A1538]/20 rounded-t transition-all duration-500"
                  style={{ 
                    height: `${(count / maxDayCount) * 100}%`,
                    minHeight: count > 0 ? '8px' : '0'
                  }}
                >
                  <div 
                    className="w-full bg-[#8A1538] rounded-t transition-all duration-500"
                    style={{ height: '100%' }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-2">{dayLabels[index]}</span>
                <span className="text-xs font-medium text-gray-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories Breakdown */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">
            {isRTL ? 'حسب الفئة' : 'By Category'}
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byCategory).map(([category, count]) => {
              const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.general;
              const percentage = Math.round((count / stats.total) * 100) || 0;
              
              return (
                <div key={category} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm text-gray-600 flex-1">{config.label}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: config.color }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
                </div>
              );
            })}
            {Object.keys(stats.byCategory).length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                {isRTL ? 'لا توجد بيانات' : 'No data available'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Peak Hours */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">{t.peakHours}</h3>
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8A1538] to-[#511C3C] flex items-center justify-center mx-auto">
              <span className="text-2xl font-display font-bold text-white">
                {stats.peakHour}:00
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              {isRTL ? 'أكثر ساعة ازدحاماً' : 'Busiest hour'}
            </p>
          </div>
        </div>

        {/* Approval Rate */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">
            {isRTL ? 'معدل الموافقة' : 'Approval Rate'}
          </h3>
          <div className="relative w-32 h-32 mx-auto">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#129b82"
                strokeWidth="12"
                strokeDasharray={`${(stats.approvalRate / 100) * 352} 352`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-display font-bold text-gray-900">
                {stats.approvalRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">
            {isRTL ? 'متوسط المدة' : 'Avg. Duration'}
          </h3>
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-display font-bold text-gray-900">
                {stats.avgDuration}
              </span>
              <span className="text-lg text-gray-500">{t.minutes}</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {isRTL ? 'لكل اجتماع' : 'per meeting'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

