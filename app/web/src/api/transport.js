/**
 * How requests leave the browser. The live app talks to the Express API over
 * fetch; the static design demo swaps this one file for an in-browser copy
 * of the same API (see design-demo/overrides). Nothing else differs.
 */
export async function send(method, url, body, { signal } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    signal,
    headers: {
      'X-Requested-With': 'eap-web',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

/** Exports are plain GETs; the browser saves the attachment. */
export function download(url) {
  window.location.href = url;
}
