import { Role, MeetingCategory, MeetingLocality } from '../types';
import { LOCALITY_CONFIG } from '../constants';

interface LocalitySignals {
  bookedBy?: Role;
  category?: MeetingCategory;
  attendeeEmail?: string;
  hostEmail?: string;
}

const domainOf = (email?: string): string | null => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase().trim() || null;
};

/** Smart default for a meeting's locality when the booker has not chosen one. */
export const deriveLocality = (s: LocalitySignals): MeetingLocality => {
  if (s.bookedBy === 'guest') return 'external';
  if (s.category === 'client') return 'external';
  const a = domainOf(s.attendeeEmail);
  const h = domainOf(s.hostEmail);
  if (a && h && a !== h) return 'external';
  return 'internal';
};

/** Resolve the accent (CSS var) for a meeting, falling back to derivation. */
export const getMeetingAccent = (
  m: { locality?: MeetingLocality } & LocalitySignals
): { locality: MeetingLocality; colorVar: string } => {
  const locality = m.locality ?? deriveLocality(m);
  return { locality, colorVar: `var(${LOCALITY_CONFIG[locality].cssVar})` };
};
