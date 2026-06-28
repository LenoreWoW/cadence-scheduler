import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useHosts, useCreateMeeting } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

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
  const { t } = useI18n();
  const { data: hosts = [], isLoading, isError } = useHosts();
  const createMeeting = useCreateMeeting();

  const [hostId, setHostId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'in-person' | 'online'>('in-person');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);
  // Book on behalf of someone else (the assistant/gatekeeper flow).
  const [forOther, setForOther] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherEmail, setOtherEmail] = useState('');
  const [locality, setLocality] = useState<'internal' | 'external'>('internal');

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
    setForOther(false);
    setOtherName('');
    setOtherEmail('');
    setLocality('internal');
    setError('');
    setDone(false);
  };

  const canSubmit =
    !!hostId && !!date && !!time && title.trim().length > 0 && !submitting &&
    (!forOther || (otherName.trim().length > 0 && otherEmail.trim().length > 0));

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
        attendeeName: forOther ? otherName.trim() : (user?.name ?? ''),
        attendeeEmail: forOther ? otherEmail.trim() : (user?.email ?? ''),
        hostId,
        meetingFormat: format,
        locality,
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || err?.body?.error || t('book.errSubmit'));
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
          <span className="w-1.5 h-1.5 rounded-full bg-white" /> {t('book.badge')}
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-display text-3xl md:text-5xl font-semibold leading-[1.05] max-w-2xl"
        >
          {t('book.heroTitle')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="text-white/70 mt-3 max-w-md"
        >
          {t('book.heroSubtitle')}
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
            <p className="font-display text-lg font-semibold">{t('book.errLoadHosts')}</p>
            <p className="mt-2 text-sm text-muted">{t('common.connErr')}</p>
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
            <p className="font-display text-lg font-semibold">{t('book.noHostsTitle')}</p>
            <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
              {t('book.noHostsBody')}
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
              <h2 className="font-display text-2xl font-semibold mt-5">{t('book.sentTitle')}</h2>
              <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
                {t('book.sentBody')}
              </p>
              <div className="mt-7 flex justify-center">
                <Button onClick={reset}>{t('book.bookAnother')}</Button>
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
              <label className="block text-sm font-semibold mb-2">{t('book.host')}</label>
              <Select
                value={hostId}
                onChange={onPickHost}
                placeholder={t('book.selectHost')}
                ariaLabel={t('book.host')}
                options={hosts.map((h) => ({ value: h.id, label: `${h.name}${h.title ? ` — ${h.title}` : ''}` }))}
              />
            </div>

            {/* Book on behalf of someone else (assistant / gatekeeper flow) */}
            <div className="mt-5">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm font-semibold">{t('book.forOther')}</span>
                <input
                  type="checkbox"
                  checked={forOther}
                  onChange={(e) => setForOther(e.target.checked)}
                  className="ring-focus h-5 w-5 rounded accent-al-adaam"
                />
              </label>
              {forOther ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input className={FIELD} placeholder={t('book.theirName')} value={otherName} onChange={(e) => { setOtherName(e.target.value); setError(''); }} aria-label={t('book.attendeeName')} />
                  <input className={FIELD} type="email" placeholder={t('book.theirEmail')} value={otherEmail} onChange={(e) => { setOtherEmail(e.target.value); setError(''); }} aria-label={t('book.attendeeEmail')} />
                </div>
              ) : (
                <p className="text-muted text-xs mt-1">{t('book.requestingAs', { name: user?.name ?? t('book.you') })}</p>
              )}
            </div>

            {/* Date */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">{t('book.date')}</label>
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
              <label className="block text-sm font-semibold mb-2">{t('book.time')}</label>
              {!hostId ? (
                <p className="text-muted text-sm">{t('book.selectHostForTimes')}</p>
              ) : slots.length === 0 ? (
                <p className="text-muted text-sm">{t('book.noOpenTimes')}</p>
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
              <label className="block text-sm font-semibold mb-2">{t('book.title')}</label>
              <input
                type="text"
                className={FIELD}
                value={title}
                placeholder={t('book.titlePlaceholder')}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError('');
                }}
              />
            </div>

            {/* Format */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">{t('book.format')}</label>
              <div className="inline-flex rounded-xl surface-2 p-1">
                {(['in-person', 'online'] as const).map((f) => {
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ring-focus ${
                        active ? 'bg-al-adaam text-white shadow-sm' : 'text-[color:var(--muted)]'
                      }`}
                    >
                      {f === 'in-person' ? t('book.inPerson') : t('book.online')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location type (internal / external) */}
            <div className="mt-5">
              <label className="block text-sm font-semibold mb-2">{t('book.locationType')}</label>
              <div className="inline-flex rounded-xl surface-2 p-1">
                {(['internal', 'external'] as const).map((loc) => {
                  const active = locality === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocality(loc)}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ring-focus ${
                        active ? 'bg-al-adaam text-white shadow-sm' : 'text-[color:var(--muted)]'
                      }`}
                    >
                      {loc === 'internal' ? t('book.internal') : t('book.external')}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted text-xs mt-1">{t('book.localityHint')}</p>
            </div>

            {/* More options */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="text-sm font-medium text-al-adaam hover:underline ring-focus rounded"
              >
                {showMore ? t('book.hideOptions') : t('book.moreOptions')}
              </button>
              {showMore && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 overflow-hidden"
                >
                  <label className="block text-sm font-semibold mb-2">{t('book.notes')}</label>
                  <textarea
                    rows={3}
                    className={`${FIELD} resize-none`}
                    value={notes}
                    placeholder={t('book.notesPlaceholder')}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </motion.div>
              )}
            </div>

            {error && <p role="alert" className="text-bad text-sm mt-5">{error}</p>}

            <div className="mt-7 flex items-center justify-between gap-4">
              <p className="text-muted text-xs">
                {t('book.requestingAsFooter', { name: user?.name ?? t('book.you') })}
                {user?.email ? ` · ${user.email}` : ''}
              </p>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? t('book.sending') : t('book.sendRequest')}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};
