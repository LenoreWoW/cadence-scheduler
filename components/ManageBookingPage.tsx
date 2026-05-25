import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Booking {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  attendeeName: string;
  attendeeEmail: string;
  hostId: string;
  hostName: string;
  status: 'pending' | 'approved' | 'cancelled' | 'rejected';
  meetingLink?: string;
  notes?: string;
  canModify: boolean;
}

interface Slot {
  time: string;
  label: string;
}

interface Props {
  token: string;
}

export const ManageBookingPage: React.FC<Props> = ({ token }) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'detail' | 'reschedule' | 'success'>('detail');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing booking token in URL.');
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/booking-links/manage/${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Booking not found');
        return r.json();
      })
      .then(setBooking)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (view !== 'reschedule' || !rescheduleDate || !booking) return;
    setSlotsLoading(true);
    // We don't know the slug — fetch the host's available slots from /api/meetings/host
    // by reading per-day availability through the booking host. Since the manage-token
    // doesn't expose the slug, we'll use a lightweight "any host availability" pattern:
    // ask the meetings endpoint, fall back to bare slots.
    fetch(`${API_BASE}/api/meetings/host/${booking.hostId}?date=${rescheduleDate}`, {
      headers: localStorage.getItem('accessToken')
        ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        : {},
    })
      .then(async r => {
        if (!r.ok) {
          // Fall back to a simple grid of 9-17 every 30 min
          return { meetings: [], externalBusyTimes: [] };
        }
        return r.json();
      })
      .then((data: any) => {
        const taken = new Set((data.meetings || []).map((m: any) => m.time));
        const externalBusy = (data.externalBusyTimes || []) as { start: string; end: string }[];
        const candidate: Slot[] = [];
        for (let h = 9; h < 18; h++) {
          for (let m = 0; m < 60; m += 30) {
            const t = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            if (taken.has(t)) continue;
            const slotStart = new Date(`${rescheduleDate}T${t}:00`).getTime();
            const slotEnd = slotStart + (booking?.durationMinutes ?? 30) * 60_000;
            const externalBlocks = externalBusy.some(b => {
              const bs = new Date(b.start).getTime();
              const be = new Date(b.end).getTime();
              return slotStart < be && slotEnd > bs;
            });
            if (externalBlocks) continue;
            candidate.push({ time: t, label: t });
          }
        }
        setRescheduleSlots(candidate);
      })
      .catch(() => setRescheduleSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [view, rescheduleDate, booking]);

  const handleCancel = async () => {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking-links/manage/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to cancel');
      setActionMessage('Your booking has been cancelled.');
      setView('success');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking-links/manage/${encodeURIComponent(token)}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: rescheduleDate, time: rescheduleTime }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to reschedule');
      setActionMessage(`Your booking is rescheduled to ${rescheduleDate} at ${rescheduleTime}. We've emailed an updated confirmation.`);
      setView('success');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading booking…</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Booking not found</h1>
          <p className="text-slate-500">{error || 'The link may be invalid or the booking already removed.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#8A1538] to-[#A02050] text-white p-8">
          <h1 className="text-2xl font-bold mb-1">Manage your booking</h1>
          <p className="text-white/80 text-sm">With {booking.hostName}</p>
        </div>

        <div className="p-8 space-y-6">
          {view === 'detail' && (
            <>
              <div className="space-y-3">
                <Field label="Meeting" value={booking.title} />
                <Field label="Date" value={new Date(booking.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
                <Field label="Time" value={`${booking.time} (${booking.durationMinutes} min)`} />
                <Field label="Status" value={booking.status} />
              </div>

              {booking.canModify ? (
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setView('reschedule')}
                    className="px-5 py-2.5 bg-[#4194b3] hover:bg-[#367a99] text-white rounded-lg font-medium transition-colors"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={submitting}
                    className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel booking
                  </button>
                </div>
              ) : (
                <div className="text-slate-500 text-sm pt-4 border-t border-slate-100">
                  This booking is {booking.status} and can no longer be modified.
                </div>
              )}
            </>
          )}

          {view === 'reschedule' && (
            <>
              <h2 className="text-lg font-bold text-slate-800">Pick a new time</h2>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#8A1538]"
                />
              </div>
              {rescheduleDate && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Available slots
                  </label>
                  {slotsLoading ? (
                    <div className="text-slate-400 text-sm">Loading…</div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div className="text-slate-400 text-sm">No availability that day. Try another date.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {rescheduleSlots.map(s => (
                        <button
                          key={s.time}
                          onClick={() => setRescheduleTime(s.time)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            rescheduleTime === s.time
                              ? 'bg-[#8A1538] text-white border-[#8A1538]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-[#8A1538]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setView('detail')}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleDate || !rescheduleTime || submitting}
                  className="px-5 py-2.5 bg-[#8A1538] hover:bg-[#a02050] text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'Updating…' : 'Confirm new time'}
                </button>
              </div>
            </>
          )}

          {view === 'success' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">All done</h2>
              <p className="text-slate-500">{actionMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}
