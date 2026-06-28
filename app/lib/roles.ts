// Who may approve/manage requests (host or admin/manager). Guests cannot.
// Human-facing role labels live in the i18n dictionary (see roleLabelKey).
export const canApprove = (role?: string): boolean => role === 'admin' || role === 'manager';
