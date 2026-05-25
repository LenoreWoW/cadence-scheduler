/**
 * Theme Service - Dark/Light Mode Management
 */

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'al_adaam_theme';

class ThemeService {
  private currentTheme: Theme = 'system';
  private listeners: Set<(theme: Theme) => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    // Load saved theme
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      this.currentTheme = saved;
    }

    // Apply initial theme
    this.applyTheme();

    // Listen for system preference changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.currentTheme === 'system') {
          this.applyTheme();
        }
      });
    }
  }

  private applyTheme() {
    const isDark = this.isDarkMode();
    const html = document.documentElement;
    const body = document.body;

    if (isDark) {
      html.classList.add('dark');
      body.classList.add('dark');
    } else {
      html.classList.remove('dark');
      body.classList.remove('dark');
    }

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0a0a0a' : '#ffffff');
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.currentTheme));
  }

  isDarkMode(): boolean {
    if (this.currentTheme === 'dark') return true;
    if (this.currentTheme === 'light') return false;
    
    // System preference
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(theme: Theme) {
    this.currentTheme = theme;
    localStorage.setItem(THEME_KEY, theme);
    this.applyTheme();
  }

  toggle() {
    const newTheme = this.isDarkMode() ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }

  subscribe(listener: (theme: Theme) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const themeService = new ThemeService();

