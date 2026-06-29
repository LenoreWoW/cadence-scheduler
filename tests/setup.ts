/**
 * Vitest Setup File
 */

import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

// Stateful localStorage mock — backed by a real object so reads see prior writes
// (authService/languageService/themeService round-trip through it), while each
// method stays a vi.fn() so tests can still assert calls.
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
  setItem: vi.fn((key: string, value: string) => { store[key] = String(value); }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { store = {}; }),
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  get length() { return Object.keys(store).length; },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  configurable: true,
  value: IntersectionObserverMock
});

// Cleanup after each test — reset the store and call history (keeps implementations).
afterEach(() => {
  store = {};
  vi.clearAllMocks();
});
