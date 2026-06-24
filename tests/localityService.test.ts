import { describe, it, expect } from 'vitest';
import { deriveLocality, getMeetingAccent } from '../services/localityService';

describe('deriveLocality', () => {
  it('defaults to internal with no signals', () => {
    expect(deriveLocality({})).toBe('internal');
  });
  it('is external when booked by a guest', () => {
    expect(deriveLocality({ bookedBy: 'guest' })).toBe('external');
  });
  it('is external for the client category', () => {
    expect(deriveLocality({ category: 'client' })).toBe('external');
  });
  it('is external when attendee email domain differs from host domain', () => {
    expect(deriveLocality({ attendeeEmail: 'x@outside.com', hostEmail: 'boss@acme.com' })).toBe('external');
  });
  it('stays internal when domains match', () => {
    expect(deriveLocality({ attendeeEmail: 'a@acme.com', hostEmail: 'boss@acme.com' })).toBe('internal');
  });
  it('skips the domain signal when either email is missing', () => {
    expect(deriveLocality({ attendeeEmail: 'a@acme.com' })).toBe('internal');
  });
});

describe('getMeetingAccent', () => {
  it('uses the explicit locality when present', () => {
    expect(getMeetingAccent({ locality: 'external' })).toEqual({ locality: 'external', colorVar: 'var(--meeting-external)' });
  });
  it('falls back to derivation when locality is absent', () => {
    expect(getMeetingAccent({ bookedBy: 'guest' })).toEqual({ locality: 'external', colorVar: 'var(--meeting-external)' });
    expect(getMeetingAccent({})).toEqual({ locality: 'internal', colorVar: 'var(--meeting-internal)' });
  });
});
