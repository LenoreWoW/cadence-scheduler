import crypto from 'crypto';

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET required for OAuth state signing');
  return s;
}

export function signState(payload: Record<string, unknown>): string {
  const data = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now(), nonce: crypto.randomBytes(8).toString('hex') })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyState<T = Record<string, unknown>>(state: string): T | null {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  const [data, sig] = state.split('.');
  if (!data || !sig) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch {
    return null;
  }

  if (typeof payload.ts !== 'number' || Date.now() - payload.ts > 10 * 60 * 1000) {
    return null;
  }

  return payload as T;
}
