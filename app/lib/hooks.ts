import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, CreateMeetingInput } from '../../services/meetingsApi';
import { MeetingStatus } from '../../types';

// Server-state hooks — the new UI reads/writes the shared schedule through these.
export const useMeetings = () =>
  useQuery({ queryKey: ['meetings'], queryFn: () => meetingsApi.list() });

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
