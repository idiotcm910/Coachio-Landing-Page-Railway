import { describe, expect, it } from 'vitest';
import { THANK_YOU_TEMPLATES } from './thank-you-template-catalog';

describe('thank-you-template-catalog', () => {
  describe('THANK_YOU_TEMPLATES structure', () => {
    it('exports exactly 5 templates (one per kind)', () => {
      expect(THANK_YOU_TEMPLATES).toHaveLength(5);
    });

    it('has one template per kind: workshop, ebook, course, coaching, webinar', () => {
      const kinds = THANK_YOU_TEMPLATES.map((t) => t.kind).sort();
      expect(kinds).toEqual(['coaching', 'course', 'ebook', 'webinar', 'workshop']);
    });

    it('all templates have unique ids', () => {
      const ids = THANK_YOU_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all ids follow pattern: kind-variant', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(template.id).toMatch(/^[a-z]+-[a-z]+$/);
      }
    });
  });

  describe('template required fields', () => {
    it('all templates have required string fields', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(typeof template.id).toBe('string');
        expect(template.id.length).toBeGreaterThan(0);
        expect(typeof template.kind).toBe('string');
        expect(template.kind.length).toBeGreaterThan(0);
        expect(typeof template.label).toBe('string');
        expect(template.label.length).toBeGreaterThan(0);
        expect(typeof template.description).toBe('string');
        expect(template.description.length).toBeGreaterThan(0);
      }
    });

    it('all templates have thumbnailGradient with 2 colors', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(Array.isArray(template.thumbnailGradient)).toBe(true);
        expect(template.thumbnailGradient).toHaveLength(2);
        expect(typeof template.thumbnailGradient[0]).toBe('string');
        expect(typeof template.thumbnailGradient[1]).toBe('string');
      }
    });

    it('all templates have HTML string containing primary_color token', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(typeof template.html).toBe('string');
        expect(template.html.length).toBeGreaterThan(0);
        expect(template.html).toContain('{{primary_color}}');
      }
    });

    it('all templates have defaultVars array', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(Array.isArray(template.defaultVars)).toBe(true);
        expect(template.defaultVars.length).toBeGreaterThan(0);
      }
    });
  });

  describe('template defaultVars structure', () => {
    it('all defaultVars have required fields', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        for (const v of template.defaultVars) {
          expect(typeof v.key).toBe('string');
          expect(v.key.length).toBeGreaterThan(0);
          expect(typeof v.name).toBe('string');
          expect(v.name.length).toBeGreaterThan(0);
          expect(typeof v.type).toBe('string');
          expect(['text', 'date', 'time', 'datetime', 'number', 'color']).toContain(v.type);
          expect(typeof v.sample).toBe('string');
          expect(v.sample.length).toBeGreaterThan(0);
        }
      }
    });

    it('all defaultVars have unique keys within same template', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        const keys = template.defaultVars.map((v) => v.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
      }
    });

    it('placeholder is optional but when present is a string', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        for (const v of template.defaultVars) {
          if (v.placeholder !== undefined) {
            expect(typeof v.placeholder).toBe('string');
          }
        }
      }
    });
  });

  describe('workshop template specifics', () => {
    const workshop = THANK_YOU_TEMPLATES.find((t) => t.kind === 'workshop');

    it('exists in catalog', () => {
      expect(workshop).toBeDefined();
    });

    it('has zaloLink flag set to true', () => {
      expect(workshop?.zaloLink).toBe(true);
    });

    it('has expected variables: event_name, event_date, event_time, location, join_link', () => {
      const keys = workshop?.defaultVars.map((v) => v.key) ?? [];
      expect(keys).toContain('event_name');
      expect(keys).toContain('event_date');
      expect(keys).toContain('event_time');
      expect(keys).toContain('location');
      expect(keys).toContain('join_link');
    });
  });

  describe('ebook template specifics', () => {
    const ebook = THANK_YOU_TEMPLATES.find((t) => t.kind === 'ebook');

    it('exists in catalog', () => {
      expect(ebook).toBeDefined();
    });

    it('has zaloLink flag set to true', () => {
      expect(ebook?.zaloLink).toBe(true);
    });

    it('has expected variables: download_url, file_format, read_guide', () => {
      const keys = ebook?.defaultVars.map((v) => v.key) ?? [];
      expect(keys).toContain('download_url');
      expect(keys).toContain('file_format');
      expect(keys).toContain('read_guide');
    });
  });

  describe('course template specifics', () => {
    const course = THANK_YOU_TEMPLATES.find((t) => t.kind === 'course');

    it('exists in catalog', () => {
      expect(course).toBeDefined();
    });

    it('has zaloLink flag set to true', () => {
      expect(course?.zaloLink).toBe(true);
    });

    it('has expected variables: login_url, course_url, access_note', () => {
      const keys = course?.defaultVars.map((v) => v.key) ?? [];
      expect(keys).toContain('login_url');
      expect(keys).toContain('course_url');
      expect(keys).toContain('access_note');
    });
  });

  describe('coaching template specifics', () => {
    const coaching = THANK_YOU_TEMPLATES.find((t) => t.kind === 'coaching');

    it('exists in catalog', () => {
      expect(coaching).toBeDefined();
    });

    it('has zaloLink flag set to true', () => {
      expect(coaching?.zaloLink).toBe(true);
    });

    it('has expected variables: booking_url, slot_note, contact', () => {
      const keys = coaching?.defaultVars.map((v) => v.key) ?? [];
      expect(keys).toContain('booking_url');
      expect(keys).toContain('slot_note');
      expect(keys).toContain('contact');
    });
  });

  describe('webinar template specifics', () => {
    const webinar = THANK_YOU_TEMPLATES.find((t) => t.kind === 'webinar');

    it('exists in catalog', () => {
      expect(webinar).toBeDefined();
    });

    it('has zaloLink flag set to true', () => {
      expect(webinar?.zaloLink).toBe(true);
    });

    it('has expected variables: join_link, event_date, replay_url, group_link', () => {
      const keys = webinar?.defaultVars.map((v) => v.key) ?? [];
      expect(keys).toContain('join_link');
      expect(keys).toContain('event_date');
      expect(keys).toContain('replay_url');
      expect(keys).toContain('group_link');
    });
  });

  describe('HTML content validation', () => {
    it('all templates contain HTML with content', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(template.html.length).toBeGreaterThan(100);
      }
    });

    it('all templates have {{primary_color}} token', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        expect(template.html).toContain('{{primary_color}}');
      }
    });

    it('templates contain system tokens', () => {
      for (const template of THANK_YOU_TEMPLATES) {
        const hasSystemToken =
          template.html.includes('{{product_name}}') ||
          template.html.includes('{{funnel_title}}') ||
          template.html.includes('{{discounted_price}}') ||
          template.html.includes('{{zalo_link}}');
        expect(hasSystemToken).toBe(true);
      }
    });
  });
});
