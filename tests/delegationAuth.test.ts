import { describe, it, expect } from 'vitest';
import { isDelegationAllowed } from '../server/utils/delegationRules';

describe('isDelegationAllowed', () => {
  it('admins may always act on behalf', () => {
    expect(isDelegationAllowed('admin', false)).toBe(true);
  });
  it('a registered delegate may act', () => {
    expect(isDelegationAllowed('manager', true)).toBe(true);
  });
  it('a non-delegate non-admin may not', () => {
    expect(isDelegationAllowed('manager', false)).toBe(false);
  });
});
