import { describe, it, expect } from 'vitest';
import { canApprove } from '../../app/lib/roles';
import { roleLabelKey } from '../../app/lib/i18n';

describe('canApprove', () => {
  it('allows admin and manager', () => {
    expect(canApprove('admin')).toBe(true);
    expect(canApprove('manager')).toBe(true);
  });
  it('denies guests, subordinates, and undefined', () => {
    expect(canApprove('guest')).toBe(false);
    expect(canApprove('subordinate')).toBe(false);
    expect(canApprove(undefined)).toBe(false);
  });
});

describe('roleLabelKey', () => {
  it('maps known roles to dictionary keys', () => {
    expect(roleLabelKey('admin')).toBe('role.admin');
    expect(roleLabelKey('manager')).toBe('role.manager');
    expect(roleLabelKey('subordinate')).toBe('role.subordinate');
    expect(roleLabelKey('guest')).toBe('role.guest');
  });
  it('returns null for unknown/undefined roles', () => {
    expect(roleLabelKey('wizard')).toBeNull();
    expect(roleLabelKey(undefined)).toBeNull();
  });
});
