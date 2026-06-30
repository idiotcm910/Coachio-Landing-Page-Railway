/**
 * Static catalog of 5 thank-you page templates, one per product kind.
 * HTML strings are imported from thank-you-template-html.ts to stay under the 200-line limit.
 */

import {
  COACHING_HTML,
  COURSE_HTML,
  EBOOK_HTML,
  WEBINAR_HTML,
  WORKSHOP_HTML,
} from './thank-you-template-html';
import type { ThankYouTemplate } from './thank-you-template-types';

export const THANK_YOU_TEMPLATES: ThankYouTemplate[] = [
  // -------------------------------------------------------------------------
  // Workshop
  // -------------------------------------------------------------------------
  {
    id: 'workshop-standard',
    kind: 'workshop',
    label: 'Workshop / Event',
    description: 'Thank-you page for a workshop or an offline/online event with a reserved seat.',
    thumbnailGradient: ['#7c3aed', '#a78bfa'],
    html: WORKSHOP_HTML,
    zaloLink: true,
    defaultVars: [
      {
        key: 'event_name',
        name: 'Workshop name',
        type: 'text',
        placeholder: 'e.g. Personal Branding Workshop',
        sample: 'Personal Branding Workshop',
      },
      {
        key: 'event_date',
        name: 'Event date',
        type: 'date',
        placeholder: 'e.g. 2026-07-15',
        sample: '2026-07-15',
      },
      {
        key: 'event_time',
        name: 'Start time',
        type: 'time',
        placeholder: 'e.g. 09:00',
        sample: '09:00',
      },
      {
        key: 'location',
        name: 'Location',
        type: 'text',
        placeholder: 'e.g. Zoom / 123 Nguyen Hue, Dist. 1, HCMC',
        sample: 'Zoom (link sent via email)',
      },
      {
        key: 'join_link',
        name: 'Join link',
        type: 'text',
        placeholder: 'https://zoom.us/j/...',
        sample: 'https://zoom.us/j/123456789',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Ebook
  // -------------------------------------------------------------------------
  {
    id: 'ebook-standard',
    kind: 'ebook',
    label: 'Ebook / Document',
    description: 'Thank-you page for an ebook or digital document with a download button.',
    thumbnailGradient: ['#0ea5e9', '#38bdf8'],
    html: EBOOK_HTML,
    zaloLink: true,
    defaultVars: [
      {
        key: 'download_url',
        name: 'Ebook download link',
        type: 'text',
        placeholder: 'https://drive.google.com/...',
        sample: 'https://drive.google.com/file/d/abc123/view',
      },
      {
        key: 'file_format',
        name: 'File format',
        type: 'text',
        placeholder: 'e.g. PDF, EPUB',
        sample: 'PDF',
      },
      {
        key: 'read_guide',
        name: 'Reading guide',
        type: 'text',
        placeholder: 'e.g. Open with Adobe Acrobat or a browser',
        sample: 'Open with Adobe Acrobat Reader or a web browser',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Course
  // -------------------------------------------------------------------------
  {
    id: 'course-standard',
    kind: 'course',
    label: 'Online Course',
    description: 'Thank-you page for an online course, guiding students to the learning platform.',
    thumbnailGradient: ['#16a34a', '#4ade80'],
    html: COURSE_HTML,
    zaloLink: true,
    defaultVars: [
      {
        key: 'login_url',
        name: 'Login link',
        type: 'text',
        placeholder: 'https://academy.example.com/login',
        sample: 'https://academy.example.com/login',
      },
      {
        key: 'course_url',
        name: 'Course link',
        type: 'text',
        placeholder: 'https://academy.example.com/courses/...',
        sample: 'https://academy.example.com/courses/marketing-101',
      },
      {
        key: 'access_note',
        name: 'Access note',
        type: 'text',
        placeholder: 'e.g. Account created, check your email for the password',
        sample: 'Your account is now active. Use your email to log in and start learning.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Coaching
  // -------------------------------------------------------------------------
  {
    id: 'coaching-standard',
    kind: 'coaching',
    label: 'Coaching 1-1',
    description: 'Thank-you page for a personal coaching package, guiding the booking flow.',
    thumbnailGradient: ['#ea580c', '#fb923c'],
    html: COACHING_HTML,
    zaloLink: true,
    defaultVars: [
      {
        key: 'booking_url',
        name: 'Booking link',
        type: 'text',
        placeholder: 'https://calendly.com/...',
        sample: 'https://calendly.com/coach/session-30min',
      },
      {
        key: 'slot_note',
        name: 'Booking note',
        type: 'text',
        placeholder: 'e.g. Pick a suitable slot within the next week',
        sample: 'Please book your session within 7 days of payment.',
      },
      {
        key: 'contact',
        name: 'Contact info',
        type: 'text',
        placeholder: 'e.g. Zalo 0909123456 / email@example.com',
        sample: 'Zalo: 0909 123 456',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Webinar
  // -------------------------------------------------------------------------
  {
    id: 'webinar-standard',
    kind: 'webinar',
    label: 'Webinar / Live stream',
    description: 'Thank-you page for an online webinar, with join and replay links.',
    thumbnailGradient: ['#0f172a', '#6d5efc'],
    html: WEBINAR_HTML,
    zaloLink: true,
    defaultVars: [
      {
        key: 'join_link',
        name: 'Live join link',
        type: 'text',
        placeholder: 'https://zoom.us/j/... or YouTube Live',
        sample: 'https://zoom.us/j/987654321',
      },
      {
        key: 'event_date',
        name: 'Event date',
        type: 'date',
        placeholder: 'e.g. 2026-07-20',
        sample: '2026-07-20',
      },
      {
        key: 'replay_url',
        name: 'Replay link',
        type: 'text',
        placeholder: 'https://youtube.com/watch?v=...',
        sample: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      },
      {
        key: 'group_link',
        name: 'Community group link',
        type: 'text',
        placeholder: 'https://facebook.com/groups/...',
        sample: 'https://facebook.com/groups/webinar-community',
      },
    ],
  },
];
