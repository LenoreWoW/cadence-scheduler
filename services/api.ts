/**
 * API Fetch Wrapper
 *
 * Centralized fetch client with JWT auth, automatic 401-refresh handling,
 * and typed error responses. All call sites pass full paths (including `/api/...`)
 * and the base URL is read from `VITE_API_URL` (no trailing `/api`).
 */

// Base URL for the backend (no trailing /api — callers include the full path).
const API_BASE_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';

// LocalStorage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// ---------- Token storage helpers ----------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// ---------- Typed error ----------

export class ApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ---------- Internal helpers ----------

function buildUrl(path: string): string {
  // Allow absolute URLs to pass through.
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE_URL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function attachAuthHeader(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return { ...(init || {}), headers };
}

// Track an in-flight refresh so concurrent 401s share a single refresh attempt.
let refreshInFlight: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as Partial<AuthTokens>;
      if (!data.accessToken || !data.refreshToken) return null;

      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Clear the gate on the next microtask so concurrent callers
      // that arrived during the await still see the same result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

function handleAuthFailure(): void {
  clearTokens();
  // Fire a custom event so the app can react (e.g. redirect to login).
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
}

// ---------- Public fetch helpers ----------

/**
 * Raw fetch wrapper. Attaches Authorization header (if a token is available)
 * and transparently retries once on 401 after refreshing the access token.
 *
 * Returns the raw Response — callers are responsible for parsing/handling it.
 * Does NOT throw on non-OK status (use `apiJson` for that).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = buildUrl(path);
  const token = getAccessToken();

  let response = await fetch(url, attachAuthHeader(init, token));

  if (response.status !== 401) {
    return response;
  }

  // Don't attempt refresh on the refresh endpoint itself.
  if (path.includes('/api/auth/refresh')) {
    handleAuthFailure();
    return response;
  }

  // Only attempt refresh if we have a refresh token to use.
  const refreshTokenAvailable = !!getRefreshToken();
  if (!refreshTokenAvailable) {
    // No refresh token — clear any stale state and surface the 401.
    if (token) handleAuthFailure();
    return response;
  }

  const newAccessToken = await attemptRefresh();
  if (!newAccessToken) {
    handleAuthFailure();
    return response;
  }

  // Retry once with the new token.
  response = await fetch(url, attachAuthHeader(init, newAccessToken));
  if (response.status === 401) {
    handleAuthFailure();
  }
  return response;
}

/**
 * JSON fetch wrapper. Parses the response body and throws an `ApiError`
 * (with `.status` and `.body`) on non-OK responses.
 */
export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);

  // Try to parse a body — but tolerate empty responses.
  let body: any = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && (body.error || body.message)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}
