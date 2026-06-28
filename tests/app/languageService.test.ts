import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { languageService } from '../../services/languageService';

describe('languageService', () => {
  beforeEach(() => languageService.setLanguage('en'));
  afterEach(() => languageService.setLanguage('en'));

  it('defaults to English (LTR)', () => {
    expect(languageService.getLanguage()).toBe('en');
    expect(languageService.isRTL()).toBe(false);
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches to Arabic and flips the document to RTL', () => {
    languageService.setLanguage('ar');
    expect(languageService.getLanguage()).toBe('ar');
    expect(languageService.isRTL()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('toggle() flips between en and ar', () => {
    expect(languageService.toggle()).toBe('ar');
    expect(languageService.toggle()).toBe('en');
  });

  it('persists the choice to localStorage', () => {
    languageService.setLanguage('ar');
    expect(localStorage.getItem('al_adaam_lang')).toBe('ar');
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const seen: string[] = [];
    const unsub = languageService.subscribe((l) => seen.push(l));
    languageService.setLanguage('ar');
    languageService.setLanguage('en');
    unsub();
    languageService.setLanguage('ar');
    expect(seen).toEqual(['ar', 'en']); // no event after unsubscribe
  });
});
