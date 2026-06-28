import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, CreateMeetingInput } from '../../services/meetingsApi';
import { usersApi } from '../../services/usersApi';
import { listDelegates, addDelegate, removeDelegate } from '../../services/delegationApi';
import { MeetingStatus } from '../../types';

// Server-state hooks — the new UI reads/writes the shared schedule through these.
export const useMeetings = () =>
  useQuery({ queryKey: ['meetings'], queryFn: () => meetingsApi.list() });

export const useHosts = () =>
  useQuery({ queryKey: ['hosts'], queryFn: () => usersApi.hosts() });

export const usePendingApproval = () =>
  useQuery({ queryKey: ['meetings', 'pending'], queryFn: () => meetingsApi.pendingApproval() });

export const useCreateMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => meetingsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
};

export const useSetMeetingStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MeetingStatus }) => meetingsApi.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
};

export const useRescheduleMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, time }: { id: string; date: string; time: string }) => meetingsApi.reschedule(id, date, time),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
};

// Delegates — who may manage my calendar / book on my behalf (the assistant model).
export const useDelegates = () =>
  useQuery({ queryKey: ['delegates'], queryFn: () => listDelegates() });

export const useAddDelegate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (delegateUserId: string) => addDelegate(delegateUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegates'] }),
  });
};

export const useRemoveDelegate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (delegateUserId: string) => removeDelegate(delegateUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegates'] }),
  });
};
