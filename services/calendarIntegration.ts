
import { Meeting, User } from '../types';

export const calendarIntegration = {
  /**
   * Generates a Google Calendar Link
   */
  getGoogleCalendarUrl: (meeting: Partial<Meeting>, host: User | null): string => {
    const title = encodeURIComponent(meeting.title || 'Meeting');
    const details = encodeURIComponent(meeting.notes || `Scheduled via Cadence with ${host?.name}`);
    const location = encodeURIComponent('Online Meeting');
    
    // Construct dates YYYYMMDDTHHMMSS
    // Note: In a real app, strict UTC conversion is required. 
    // Here we assume the date/time strings are local to the user for simplicity of the demo.
    const startTime = meeting.time?.replace(':', '') + '00';
    const startDate = meeting.date?.replace(/-/g, '');
    
    // Calculate end time roughly
    const [h, m] = (meeting.time || '00:00').split(':').map(Number);
    const duration = meeting.durationMinutes || 30;
    const endDateObj = new Date();
    endDateObj.setHours(h, m + duration, 0);
    const endTime = endDateObj.getHours().toString().padStart(2, '0') + 
                    endDateObj.getMinutes().toString().padStart(2, '0') + '00';

    const dates = `${startDate}T${startTime}/${startDate}T${endTime}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  },

  /**
   * Generates an ICS file content
   */
  generateICS: (meeting: Partial<Meeting>, host: User | null): string => {
    const title = meeting.title || 'Meeting';
    const description = meeting.notes || `Meeting with ${host?.name}`;
    
    // Format Date for ICS: YYYYMMDDTHHMMSS
    const formatICSDate = (dateStr?: string, timeStr?: string, addMinutes: number = 0) => {
      if (!dateStr || !timeStr) return '';
      const d = new Date(`${dateStr}T${timeStr}`);
      d.setMinutes(d.getMinutes() + addMinutes);
      
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const start = formatICSDate(meeting.date, meeting.time, 0);
    const end = formatICSDate(meeting.date, meeting.time, meeting.durationMinutes || 30);

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Cadence//Scheduler//EN
BEGIN:VEVENT
UID:${Math.random().toString(36).substr(2, 9)}@aladaam.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}
DTSTART:${start}
DTEND:${end}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:Online
END:VEVENT
END:VCALENDAR`;
  },

  downloadICS: (meeting: Partial<Meeting>, host: User | null) => {
    const content = calendarIntegration.generateICS(meeting, host);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${meeting.title?.replace(/\s+/g, '_') || 'meeting'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
