export function normalizeUrl(raw: string): string {
  const url = new URL(raw);

  // Lowercase hostname, strip www
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  // Remove fragment
  url.hash = '';

  // Remove utm_ params, sort remaining
  const params = new URLSearchParams();
  url.searchParams.sort();
  for (const [key, value] of url.searchParams) {
    if (!key.startsWith('utm_')) {
      params.set(key, value);
    }
  }
  url.search = params.toString();

  // Strip trailing slash from pathname
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';

  let result = url.toString();
  // Remove trailing slash on the full URL only if pathname is root
  if (url.pathname === '/' && !url.search) {
    result = result.replace(/\/$/, '');
  }

  return result;
}

export function extractDomain(raw: string): string {
  try {
    const url = new URL(raw);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // Non-URL input (e.g., YouTube channel ID) — return as-is
    return raw;
  }
}
