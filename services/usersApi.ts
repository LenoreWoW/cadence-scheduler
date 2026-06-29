import { apiJson } from './api';
import { User } from '../types';

// Thin client for the people directory (server-backed).
export const usersApi = {
  /** Bookable hosts (admin/manager/subordinate) with availability — for the Book flow. */
  hosts: () => apiJson<User[]>('/api/users/hosts', { method: 'GET' }),
};
