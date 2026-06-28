import { describe, it, expect } from 'vitest';
import { tours } from '../services/tourService';

describe('welcome tour', () => {
  const welcome = tours.welcome;

  it('was bumped to version 4+', () => {
    expect(welcome.version).toBeGreaterThanOrEqual(4);
  });

  it('includes the new feature steps', () => {
    const ids = welcome.steps.map(s => s.id);
    expect(ids).toContain('meeting-colors');
    expect(ids).toContain('on-behalf');
    expect(ids).toContain('delegates');
    expect(ids).toContain('help-button');
  });

  it('every step has a non-empty target and bilingual copy', () => {
    for (const s of welcome.steps) {
      expect(s.target.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.titleAr.length).toBeGreaterThan(0);
      expect(s.content.length).toBeGreaterThan(0);
      expect(s.contentAr.length).toBeGreaterThan(0);
    }
  });

  it('no tour copy uses the old name (Latin "Regent" or Arabic "ريجنت")', () => {
    const blob = JSON.stringify(welcome);
    expect(blob).not.toContain('Regent');
    expect(blob).not.toContain('ريجنت');
  });
});
