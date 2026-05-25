import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { calendarIntegration } from '../services/calendarIntegration';
import { BookingSuccess3D } from './BookingSuccess3D';
import { LocationAddressField } from './LocationAddressField';

interface TimeSlot {
  time: string;
  label: string;
  hour: number;
  minute: number;
  period: 'morning' | 'afternoon' | 'evening';
  available: boolean;
}

interface HostInfo {
  id: string;
  name: string;
  title?: string;
  avatar?: string;
  email?: string;
  team?: { name: string; color: string } | null;
  availability?: {
    startHour: number;
    endHour: number;
    slotDuration: number;
    bufferMinutes: number;
    minNoticeMinutes: number;
    days: number[];
    timeOff: string[];
  } | null;
}

interface AnalyticsPixel {
  id: string;
  provider: 'ga4' | 'gtm' | 'posthog' | 'fathom' | 'plausible';
  trackingId: string;
}

interface BookingLinkData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  durationOptions: number[];
  defaultDuration: number;
  customMessage?: string;
  host: HostInfo;
  bufferBefore: number;
  bufferAfter: number;
  showBranding: boolean; // Pro/Business users can hide branding
  hostCanAcceptBookings: boolean; // False if host hit meeting limit
  hostLimitMessage?: string;
  // Branding overrides
  brandLogoUrl?: string | null;
  brandColor?: string | null;
  brandFont?: string | null;
  redirectUrlOnSuccess?: string | null;
  // Analytics pixels to inject
  pixels?: AnalyticsPixel[];
  // Theme & embed preferences
  theme?: 'system' | 'light' | 'dark' | null;
  hideDetails?: boolean | null;
  // Display-only address provided by the link itself.
  locationAddress?: string | null;
}

interface PublicBookingPageProps {
  slug: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({ slug }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<BookingLinkData | null>(null);
  
  // Booking flow state
  const [step, setStep] = useState<'date' | 'time' | 'details' | 'success'>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookedMeeting, setBookedMeeting] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    attendeeName: '',
    attendeeEmail: '',
    notes: '',
    meetingFormat: 'in-person' as 'online' | 'in-person',
    locationAddress: ''
  });

  // Detect embed mode (?embed=1)
  const isEmbed = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('embed') === '1';
    } catch {
      return false;
    }
  }, []);

  // Current month for calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch booking link data
  useEffect(() => {
    const fetchBookingData = async () => {
      try {
        const response = await fetch(`${API_BASE}/booking-links/public/${slug}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Booking page not found');
        }
        const data = await response.json();
        
        // Check if host can accept bookings (hasn't hit meeting limit)
        if (data.hostCanAcceptBookings === false) {
          throw new Error(data.hostLimitMessage || 'This host is not currently accepting bookings. Please try again later.');
        }
        
        setBookingData(data);
        setSelectedDuration(data.defaultDuration);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBookingData();
  }, [slug]);

  // Inject analytics pixels once the booking-link data loads.
  useEffect(() => {
    const pixels = bookingData?.pixels;
    if (!pixels || pixels.length === 0) return;
    const injected: HTMLElement[] = [];

    for (const p of pixels) {
      if (!p?.trackingId) continue;
      try {
        if (p.provider === 'ga4') {
          const s1 = document.createElement('script');
          s1.async = true;
          s1.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(p.trackingId)}`;
          document.head.appendChild(s1);
          injected.push(s1);

          const s2 = document.createElement('script');
          s2.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${p.trackingId}');`;
          document.head.appendChild(s2);
          injected.push(s2);
        } else if (p.provider === 'gtm') {
          const s = document.createElement('script');
          s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${p.trackingId}');`;
          document.head.appendChild(s);
          injected.push(s);
        } else if (p.provider === 'plausible') {
          const s = document.createElement('script');
          s.defer = true;
          s.setAttribute('data-domain', p.trackingId);
          s.src = 'https://plausible.io/js/script.js';
          document.head.appendChild(s);
          injected.push(s);
        } else if (p.provider === 'fathom') {
          const s = document.createElement('script');
          s.defer = true;
          s.setAttribute('data-site', p.trackingId);
          s.src = 'https://cdn.usefathom.com/script.js';
          document.head.appendChild(s);
          injected.push(s);
        } else if (p.provider === 'posthog') {
          const s = document.createElement('script');
          s.text = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${p.trackingId}',{api_host:'https://app.posthog.com'});`;
          document.head.appendChild(s);
          injected.push(s);
        }
      } catch {
        /* ignore one bad pixel */
      }
    }

    return () => {
      for (const el of injected) {
        try {
          el.parentNode?.removeChild(el);
        } catch {
          /* ignore */
        }
      }
    };
  }, [bookingData?.pixels]);

  // Apply per-link theme to document.body so dark-mode Tailwind variants
  // pick it up for the duration of this page.
  useEffect(() => {
    const theme = bookingData?.theme || 'system';
    const body = document.body;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const applyDark = (on: boolean) => {
      if (on) body.classList.add('dark');
      else body.classList.remove('dark');
    };

    let listener: ((ev: MediaQueryListEvent) => void) | null = null;

    if (theme === 'dark') {
      applyDark(true);
    } else if (theme === 'light') {
      applyDark(false);
    } else {
      applyDark(mql.matches);
      listener = (ev) => applyDark(ev.matches);
      try {
        mql.addEventListener('change', listener);
      } catch {
        // Safari fallback
        // @ts-ignore
        mql.addListener(listener);
      }
    }

    return () => {
      applyDark(false);
      if (listener) {
        try {
          mql.removeEventListener('change', listener);
        } catch {
          // @ts-ignore
          mql.removeListener(listener);
        }
      }
    };
  }, [bookingData?.theme]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate || !bookingData) return;

    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        // Format date in local timezone (YYYY-MM-DD)
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const response = await fetch(
          `${API_BASE}/booking-links/public/${slug}/slots?date=${dateStr}`
        );
        const data = await response.json();
        setAvailableSlots(data.slots || []);
      } catch (err) {
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [selectedDate, slug, bookingData]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Add padding for days before first of month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [currentMonth]);

  // Check if date is available
  const isDateAvailable = (date: Date): boolean => {
    if (!bookingData?.host.availability) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    const dayOfWeek = date.getDay();
    return bookingData.host.availability.days.includes(dayOfWeek);
  };

  // Handle booking submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot || !bookingData) return;

    setSubmitting(true);
    try {
      // Format the date in the host's local timezone (not the booker's),
      // since slots were generated in the host's TZ. Using toISOString() would
      // drift by ±1 day for far-away bookers.
      const dateYmd = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const response = await fetch(`${API_BASE}/booking-links/public/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateYmd,
          time: selectedSlot.time,
          duration: selectedDuration,
          title: formData.title || `Meeting with ${formData.attendeeName}`,
          attendeeName: formData.attendeeName,
          attendeeEmail: formData.attendeeEmail,
          notes: formData.notes,
          meetingFormat: formData.meetingFormat,
          locationAddress: formData.meetingFormat === 'in-person'
            ? (formData.locationAddress || bookingData.locationAddress || null)
            : null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Booking failed');
      }

      const result = await response.json();
      // If the link or server returned a redirect URL, send the user there
      // instead of showing the in-app success screen.
      const redirectUrl = result?.redirectUrlOnSuccess || bookingData?.redirectUrlOnSuccess;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      setBookedMeeting(result);
      setStep('success');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-200" />
          <div className="w-48 h-4 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Booking Unavailable</h1>
          <p className="text-slate-600">{error || 'This booking page is not available.'}</p>
        </div>
      </div>
    );
  }

  const { host } = bookingData;

  // Success state
  if (step === 'success' && bookedMeeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="relative">
            <BookingSuccess3D />
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center relative -mt-8">
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-emerald-500/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Meeting Requested!</h1>
            <p className="text-slate-600 mb-6">
              Your meeting with <span className="font-semibold text-slate-800">{host.name}</span> has been submitted. 
              You'll receive a confirmation at <span className="font-semibold text-slate-800">{bookedMeeting.attendeeEmail}</span>.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{bookedMeeting.title}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(bookedMeeting.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {bookedMeeting.time}
                  </p>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {bookedMeeting.durationMinutes} minutes
                </span>
                {' • '}
                <span className="capitalize">{bookedMeeting.meetingFormat}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="default" 
                fullWidth
                onClick={() => {
                  const meeting = { 
                    ...bookedMeeting, 
                    time: bookedMeeting.time,
                    durationMinutes: bookedMeeting.durationMinutes 
                  };
                  window.open(calendarIntegration.getGoogleCalendarUrl(meeting, host as any), '_blank');
                }}
              >
                Add to Calendar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Branding: optional per-link logo, brand color, font.
  const brandColor = bookingData.brandColor || '#8A1538';
  const brandLogo = bookingData.brandLogoUrl || null;
  const brandFont = bookingData.brandFont || null;
  const rootStyle: React.CSSProperties = brandFont ? { fontFamily: brandFont } : {};

  // When embedded with ?embed=1 and hideDetails set, show only the slot picker.
  const embedHideDetails = isEmbed && !!bookingData.hideDetails;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" style={rootStyle}>
      {/* Optional brand logo */}
      {brandLogo && !embedHideDetails && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-center">
            <img src={brandLogo} alt="" className="max-h-10 object-contain" />
          </div>
        </div>
      )}
      {/* Header */}
      {!embedHideDetails && (
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                style={{
                  background: host.team?.color
                    ? `linear-gradient(135deg, ${host.team.color}, ${host.team.color}dd)`
                    : `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)`,
                }}
              >
                {host.avatar ? (
                  <img src={host.avatar} alt={host.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  host.name.charAt(0)
                )}
              </div>
              <div>
                <h1 className="font-bold text-slate-800">{host.name}</h1>
                {host.title && <p className="text-xs text-slate-500">{host.title}</p>}
              </div>
            </div>
            {host.team && (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: host.team.color }}
              >
                {host.team.name}
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title Section */}
        {!embedHideDetails && (
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">{bookingData.title}</h2>
          {bookingData.description && (
            <p className="text-slate-600 max-w-lg mx-auto">{bookingData.description}</p>
          )}
          {bookingData.customMessage && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4 max-w-lg mx-auto">
              <p className="text-amber-800 text-sm">{bookingData.customMessage}</p>
            </div>
          )}
        </div>
        )}

        {/* Duration Selection */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 mb-6">
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Meeting Duration
          </label>
          <div className="flex flex-wrap gap-2">
            {bookingData.durationOptions.map(duration => (
              <button
                key={duration}
                onClick={() => setSelectedDuration(duration)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  selectedDuration === duration
                    ? 'bg-[#8A1538] text-white shadow-lg shadow-[#8A1538]/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-slate-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={idx} className="aspect-square" />;
                
                const isAvailable = isDateAvailable(date);
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();

                return (
                  <button
                    key={idx}
                    onClick={() => isAvailable && setSelectedDate(date)}
                    disabled={!isAvailable}
                    className={`aspect-square rounded-lg text-sm font-medium transition-all relative ${
                      isSelected
                        ? 'bg-[#8A1538] text-white shadow-lg shadow-[#8A1538]/30'
                        : isAvailable
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {date.getDate()}
                    {isToday && !isSelected && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#8A1538]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots & Details */}
          <div className="space-y-6">
            {/* Time Slots */}
            {selectedDate && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 animate-fade-in">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-bold text-slate-800">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <span className="text-xs text-slate-400 ml-2 whitespace-nowrap" title="Times shown in your local timezone">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </div>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8A1538]" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No available times for this date</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep('details');
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedSlot?.time === slot.time
                            ? 'bg-[#8A1538] text-white shadow-lg'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Details Form */}
            {step === 'details' && selectedSlot && (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800">Your Details</h3>
                  <button
                    type="button"
                    onClick={() => setStep('time')}
                    className="text-sm text-[#8A1538] hover:underline"
                  >
                    Change time
                  </button>
                </div>

                {/* Selected time summary */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#8A1538]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#8A1538]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">
                      {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-slate-500">{selectedSlot.label} • {selectedDuration} minutes</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.attendeeName}
                      onChange={e => setFormData({ ...formData, attendeeName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.attendeeEmail}
                      onChange={e => setFormData({ ...formData, attendeeEmail: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none transition-all"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Meeting Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none transition-all"
                      placeholder="Quick chat about..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Meeting Format
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, meetingFormat: 'in-person' })}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          formData.meetingFormat === 'in-person'
                            ? 'bg-[#8A1538] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        In Person
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, meetingFormat: 'online' })}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          formData.meetingFormat === 'online'
                            ? 'bg-[#8A1538] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Online
                      </button>
                    </div>
                  </div>

                  {formData.meetingFormat === 'in-person' && (
                    <LocationAddressField
                      value={formData.locationAddress}
                      onChange={(v) => setFormData({ ...formData, locationAddress: v })}
                      presetAddress={bookingData.locationAddress || null}
                      lang="en"
                    />
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#8A1538] focus:ring-2 focus:ring-[#8A1538]/20 outline-none transition-all resize-none"
                      placeholder="Anything you'd like to discuss..."
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  className="mt-6"
                  disabled={submitting || !formData.attendeeName || !formData.attendeeEmail}
                >
                  {submitting ? 'Submitting...' : 'Confirm Booking'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Footer - Only show branding for Free tier hosts */}
        {(bookingData?.showBranding ?? true) && (
          <div className="mt-12 text-center text-sm text-slate-400">
            <p>Powered by <span className="font-bold text-slate-500">Cadence</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicBookingPage;

