/**
 * Language Service — language + text-direction (LTR/RTL) management.
 * Mirrors themeService: persists the choice, applies it to <html> on load,
 * and notifies subscribers. Arabic flips the document to RTL.
 */
import { Language } from '../types';

const LANG_KEY = 'al_adaam_lang';

class LanguageService {
  private current: Language = 'en';
  private listeners: Set<(lang: Language) => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    const saved = localStorage.getItem(LANG_KEY) as Language | null;
    if (saved === 'en' || saved === 'ar') {
      this.current = saved;
    } else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) {
      this.current = 'ar';
    }
    this.apply();
  }

  private apply() {
    const html = document.documentElement;
    html.lang = this.current;
    html.dir = this.current === 'ar' ? 'rtl' : 'ltr';
    this.listeners.forEach((listener) => listener(this.current));
  }

  getLanguage(): Language {
    return this.current;
  }

  isRTL(): boolean {
    return this.current === 'ar';
  }

  setLanguage(lang: Language) {
    this.current = lang;
    localStorage.setItem(LANG_KEY, lang);
    this.apply();
  }

  toggle(): Language {
    this.setLanguage(this.current === 'en' ? 'ar' : 'en');
    return this.current;
  }

  subscribe(listener: (lang: Language) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const languageService = new LanguageService();
