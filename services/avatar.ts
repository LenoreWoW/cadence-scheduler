// Local, token-styled initials avatar — replaces remote ui-avatars.com placeholders.
// Returns an inline SVG data-URI (no network request; works offline + in dark mode)
// drawn on the Al Adaam brand colour with white initials.
export const avatarPlaceholder = (name?: string): string => {
  const initials =
    (name || '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="#8A1538"/>` +
    `<text x="50%" y="50%" dy=".05em" fill="#ffffff" font-family="Inter, system-ui, sans-serif" ` +
    `font-size="38" font-weight="600" text-anchor="middle" dominant-baseline="central">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
