export async function apiFetch(path: string, options: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  const url = `${base}${path}`;
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('ngrok-skip-browser-warning', 'true');
  return fetch(url, { ...options, headers });
}