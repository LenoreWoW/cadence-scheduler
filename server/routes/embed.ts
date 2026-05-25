/**
 * Embeddable booking page — lets sites drop in a Cadence booking iframe.
 *
 * GET /booking-link/:slug   → HTML page with the iframe embed.
 * GET /widget.js            → JS snippet a site can include and tag with
 *                              `<script data-slug="..." src="..."></script>`.
 */

import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function htmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// GET /booking-link/:slug — minimal HTML page that embeds the booking flow.
router.get('/booking-link/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const link = db.connection.prepare(
    `SELECT slug, title FROM booking_links WHERE slug = ? AND is_active = 1`
  ).get(slug) as any;

  if (!link) {
    return res.status(404).type('html').send('<h1>Booking link not found</h1>');
  }

  const bookingUrl = `${FRONTEND_URL}/book/${encodeURIComponent(slug)}?embed=1`;
  // ALLOWALL via meta tag — useful for legacy frame integrations. Modern browsers
  // ignore X-Frame-Options on meta, but we keep it for back-compat.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-Frame-Options" content="ALLOWALL" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${htmlEscape(link.title || 'Book a meeting')}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%;width:100%;background:#fafafa;font-family:-apple-system,'Segoe UI',sans-serif;}
  .frame-wrap{position:fixed;inset:0;}
  iframe{border:0;width:100%;height:100%;display:block;}
</style>
</head>
<body>
<div class="frame-wrap">
  <iframe src="${htmlEscape(bookingUrl)}" allow="clipboard-write" referrerpolicy="no-referrer"></iframe>
</div>
</body>
</html>`;
  // Don't let helmet block framing for the embed surface.
  res.removeHeader?.('X-Frame-Options');
  res.removeHeader?.('Content-Security-Policy');
  res.type('html').send(html);
});

// GET /widget.js — small loader site owners drop in.
router.get('/widget.js', (req: Request, res: Response) => {
  const apiBase = `${req.protocol}://${req.get('host')}`;
  const script = `/* Cadence Embed Widget */
(function(){
  var scripts = document.querySelectorAll('script[data-slug]');
  scripts.forEach(function(s){
    if (s.getAttribute('data-cadence-loaded') === '1') return;
    s.setAttribute('data-cadence-loaded', '1');
    var slug = s.getAttribute('data-slug');
    if (!slug) return;
    var height = s.getAttribute('data-height') || '720';
    var iframe = document.createElement('iframe');
    iframe.src = ${JSON.stringify(apiBase)} + '/api/embed/booking-link/' + encodeURIComponent(slug);
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.minHeight = height + 'px';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    s.parentNode.insertBefore(iframe, s.nextSibling);
  });
})();
`;
  res.type('application/javascript').send(script);
});

export default router;
