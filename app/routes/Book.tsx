import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useHosts, useCreateMeeting } from '../lib/hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

// Local YYYY-MM-DD (avoids the UTC shift you'd get from toISOString()).
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const pad = (n: number) => String(n).padStart(2, '0');

// Build "HH:MM" slots across [startHour, endHour) stepped by slotDuration minutes.
const buildSlots = (startHour: number, endHour: number, step: number): string[] => {
  const out: string[] = [];
  const safeStep = step > 0 ? step : 30;
  for (let m = startHour * 60; m + safeStep <= endHour * 60; m += safeStep) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
};

const FIELD =
  'w-full rounded-xl surface-2 px-4 py-2.5 text-sm text-[color:var(--text)] outline-none ring-focus placeholder:text-[color:var(--muted)]';

export const Book: React.FC = () => {
  const { user } = useAuth();
  const { data: hosts = [], isLoading, isError } = useHosts();
  const createMeeting = useCreateMeeting();

  const [hostId, setHostId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'in-person' | 'online'>('in-person');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const selectedHost = useMemo(() => hosts.find((h) => h.id === hostId), [hosts, hostId]);

  // Availability drives the slot grid + duration; fall back to 9–17 / 30min.
  const availability = selectedHost?.availability ?? null;
  const slotDuration = availability?.slotDuration || 30;
  const slots = useMemo(
    () => buildSlots(availability?.startHour ?? 9, availability?.endHour ?? 17, slotDuration),
    [availability?.startHour, availability?.endHour, slotDuration],
  );

  const onPickHost = (id: string) => {
    setHostId(id);
    setTime(''); // slot grid changes per host
    setError('');
  };

  const reset = () => {
    setHostId('');
    setDate(todayStr());
    setTime('');
    setTitle('');
    setFormat('in-person');
    setNotes('');
    setShowMore(false);
    setError('');
    setDone(false);
  };

  const canSubmit = !!hostId && !!date && !!time && title.trim().length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await createMeeting.mutateAsync({
        title: title.trim(),
        date,
        time,
        durationMinutes: slotDuration || 30,
        attendeeName: user?.name ?? '',
        attendeeEmail: user?.email ?? '',
        hostId,
        meetingFormat: format,
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || err?.body?.error || 'Could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Header strip (shared across states) ----
  const header = (
    <section className="relative gba-aurora text-white overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 py-14 md:py-20">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white" /> Request a meeting
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-display text-3xl md:text-5xl font-semibold leading-[1.05] max-w-2xl"
        >
          Book time with the team.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="text-white/70 mt-3 max-w-md"
        >
          Pick a host and a time that works — they’ll confirm your request.
        </motion.p>
      </div>
    </section>
  );

  // ---- Loading ----
  if (isLoading) {
    return (
      <div>
        {header}
        <div className="mx-auto max-w-6xl px-5 -mt-8 relative z-10">
          <Card className="animate-pulse">
            <div className="h-4 w-32 rounded bg-[color:var(--border)]" />
            <div className="mt-4 h-10 rounded-xl surface-2" />
            <div className="mt-3 h-10 rounded-xl surface-2" />
            <div className="mt-3 h-24 rounded-xl surface-2" />
          </Card>
        </div>
      </div>
    );
  }

  // ---- Load error (distinct from "no hosts") ----
  if (isError) {
    return (
      <div>
        {header}
        <div className="mx-auto max-w-6xl px-5 -mt-8 relative z-10">
          <Card className="py-14 text-center">
            <p className="font-display text-lg font-semibold">Couldn't load hosts</p>
            <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Empty: no bookable hosts ----
  if (hosts.length === 0) {
    return (
      <div>
        {header}
        <div className="mx-auto max-w-6xl px-5 -mt-8 relative z-10">
          <Card className="text-center py-14">
            <p className="font-display text-lg font-semibold">No hosts available</p>
            <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
              There’s no one to book with right now. Check back once your team has set up their availability.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Success ----
  if (done) {
    return (
      <div>
        {header}
        <div className="mx-auto max-w-6xl px-5 -mt-8 relative z-10 pb-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card role="status" className="text-center py-14 max-w-xl mx-auto">
              <div className="mx-auto w-12 h-12 rounded-full grid place-items-center status-ok text-2xl">
                ✓
              </div>
              <h2 className="font-display text-2xl font-semibold mt-5">Request sent</h2>
              <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
                The host will approve it. You’ll see it on your schedule once it’s confirmed.
              </p>
              <div className="mt-7 flex justify-center">
                <Button onClick={reset}>Book another</Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // ---- Form ----
  return (
    <div>
      {header}
      <div className="mx-auto max-w-6xl px-5 -mt-8 relative z-10 pb-12">
        <form onSubmit={submit}>
          <Card className="max-w-2xl mx-auto">
            {/* Host */}
            <div>
              <label className="block text-sm font-semibold mb-2">Host</label>
              <select
                className={FIELD}
                value={hostId}
                onChange={(e) => onPickHost(e.target.value)}
              >
                <option value="">Select a host…</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.title ? ` — ${h.title}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">Date</label>
              <input
                type="date"
                className={FIELD}
                value={date}
                min={todayStr()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError('');
                }}
              />
            </div>

            {/* Time */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">Time</label>
              {!hostId ? (
                <p className="text-muted text-sm">Select a host to see available times.</p>
              ) : slots.length === 0 ? (
                <p className="text-muted text-sm">This host has no open times. Try a different host.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const active = s === time;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setTime(s);
                          setError('');
                        }}
                        className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ring-focus ${
                          active
                            ? 'bg-al-adaam text-white shadow-sm'
                            : 'surface-2 text-[color:var(--text)] hover:bg-al-adaam/10'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">Title</label>
              <input
                type="text"
                className={FIELD}
                value={title}
                placeholder="What’s this meeting about?"
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError('');
                }}
              />
            </div>

            {/* Format */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">Format</label>
              <div className="inline-flex rounded-xl surface-2 p-1">
                {(['in-person', 'online'] as const).map((f) => {
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ring-focus ${
                        active ? 'bg-al-adaam text-white shadow-sm' : 'text-[color:var(--muted)]'
                      }`}
                    >
                      {f === 'in-person' ? 'In-person' : 'Online'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* More options */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="text-sm font-medium text-al-adaam hover:underline ring-focus rounded"
              >
                {showMore ? 'Hide options' : 'More options'}
              </button>
              {showMore && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 overflow-hidden"
                >
                  <label className="block text-sm font-semibold mb-2">Notes</label>
                  <textarea
                    rows={3}
                    className={`${FIELD} resize-none`}
                    value={notes}
                    placeholder="Anything the host should know (optional)"
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </motion.div>
              )}
            </div>

            {error && <p role="alert" className="text-bad text-sm mt-5">{error}</p>}

            <div className="mt-7 flex items-center justify-between gap-4">
              <p className="text-muted text-xs">
                Requesting as {user?.name ?? 'you'}
                {user?.email ? ` · ${user.email}` : ''}
              </p>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};
