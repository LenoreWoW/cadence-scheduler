/** Pure authorization rule for acting on behalf of another user. */
export function isDelegationAllowed(role: string, isRegisteredDelegate: boolean): boolean {
  return role === 'admin' || isRegisteredDelegate;
}
