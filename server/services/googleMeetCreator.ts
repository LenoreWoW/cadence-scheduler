/**
 * Google Meet auto-create helper.
 *
 * Injects a `conferenceData.createRequest` field onto a Google Calendar event
 * payload. When sent with `conferenceDataVersion=1`, Google generates a Meet
 * link for the event and returns it in `event.hangoutLink`.
 */
import { v4 as uuidv4 } from 'uuid';

/** Returns a shallow-cloned event with a Meet createRequest attached. */
export function enrichEventWithMeet<T extends Record<string, any>>(event: T): T {
  const requestId = uuidv4();
  return {
    ...event,
    conferenceData: {
      ...(event as any).conferenceData,
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
}

export default { enrichEventWithMeet };
