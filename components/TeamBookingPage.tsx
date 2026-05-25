import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TeamLink {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationOptions: number[];
  defaultDuration: number;
  customMessage: string | null;
  team: { id: string; name: string; color?: string; image?: string };
}

export const TeamBookingPage: React.FC<{ slug: string }> = ({ slug }) => {
  const [link, setLink] = useState<TeamLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState<{ time: string; label: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/team-booking-links/public/${encodeURIComponent(slug)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Link not found');
        return r.json();
      })
      .then((data: TeamLink) => {
        setLink(data);
        setDuration(data.defaultDuration);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!date) return;
    setSlotsLoading(true);
    fetch(`${API_BASE}/api/team-booking-links/public/${encodeURIComponent(slug)}/slots?date=${date}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [date, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/team-booking-links/public/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, time, duration,
          attendeeName: name, attendeeEmail: email, notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to book');
      setSuccess(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading…</div>;
  }
  if (error && !link) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Link unavailable</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }
  if (!link) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Request sent!</h1>
          <p className="text-slate-500 mb-2">Assigned to {success.assignedTo.name}. They'll confirm shortly.</p>
          <p className="text-slate-400 text-xs">A confirmation has been emailed to {success.attendeeEmail}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100" style={{ background: link.team.color || '#8A1538', color: 'white' }}>
          <div className="text-sm opacity-80 mb-1">Booking link · Team</div>
          <h1 className="text-3xl font-bold">{link.title}</h1>
          {link.description && <p className="opacity-90 mt-2">{link.description}</p>}
          <div className="text-sm opacity-80 mt-3">With the {link.team.name} team</div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {link.customMessage && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
              {link.customMessage}
            </div>
          )}

          {link.durationOptions.length > 1 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Duration</label>
              <div className="flex gap-2 flex-wrap">
                {link.durationOptions.map(d => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                      duration === d
                        ? 'bg-[#8A1538] text-white border-[#8A1538]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#8A1538]'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={e => { setDate(e.target.value); setTime(''); }}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#8A1538]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Time</label>
              {!date ? (
                <div className="text-slate-400 text-sm py-3">Pick a date first</div>
              ) : slotsLoading ? (
                <div className="text-slate-400 text-sm py-3">Loading slots…</div>
              ) : slots.length === 0 ? (
                <div className="text-slate-400 text-sm py-3">No availability that day.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(s => (
                    <button
                      type="button"
                      key={s.time}
                      onClick={() => setTime(s.time)}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        time === s.time
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
          </div>

          {time && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Your name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#8A1538]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#8A1538]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#8A1538]"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={!date || !time || !name || !email || submitting}
            className="w-full px-5 py-3 bg-[#8A1538] hover:bg-[#a02050] text-white rounded-lg font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Request meeting'}
          </button>
        </form>
      </div>
    </div>
  );
};
