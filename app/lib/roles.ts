// Single source of truth for human-facing role labels — never render the raw enum.
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  subordinate: 'Team member',
  guest: 'Guest',
};

export const roleLabel = (role?: string): string => (role ? ROLE_LABEL[role] ?? role : '');

// Who may approve/manage requests (host or admin/manager). Guests cannot.
export const canApprove = (role?: string): boolean => role === 'admin' || role === 'manager';
