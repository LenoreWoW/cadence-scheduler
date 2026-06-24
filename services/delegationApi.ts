import { apiJson } from './api';
import { Delegate, Meeting } from '../types';

export interface DelegateLists { iManage: Delegate[]; myDelegates: Delegate[]; }

export const listDelegates = () => apiJson<DelegateLists>('/api/delegates');

export const addDelegate = (delegateUserId: string, scope = 'calendar') =>
  apiJson<Delegate>('/api/delegates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delegateUserId, scope }),
  });

export const removeDelegate = (delegateUserId: string) =>
  apiJson<{ success: boolean }>(`/api/delegates/${delegateUserId}`, { method: 'DELETE' });

/** Create a tentative meeting on the boss's (hostId's) server calendar. */
export const createOnBehalfMeeting = (payload: Partial<Meeting> & { hostId: string }) =>
  apiJson<Meeting>('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, onBehalf: true }),
  });

export const confirmMeeting = (id: string) =>
  apiJson<{ message: string }>(`/api/meetings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved' }),
  });

export const declineMeeting = (id: string) =>
  apiJson<{ message: string }>(`/api/meetings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected' }),
  });

export const confirmByToken = (id: string, token: string) =>
  apiJson<{ message: string; status: string }>(`/api/meetings/${id}/confirm-by-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

/** Server tentatives where I am host or creator, to merge into the in-app calendar. */
export const fetchMyTentatives = () => apiJson<Meeting[]>('/api/meetings?status=pending');
