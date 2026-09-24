/**
 * Design demo — requests are answered by the in-browser copy of the API
 * (src/demo-server) instead of travelling over the network. The signature
 * matches the live transport.js, so client.js and every screen are unchanged.
 */
import { dispatch } from '../demo-server/app.js';

export async function send(method, url, body) {
  const res = await dispatch(method, url, body);
  return { status: res.status, ok: res.status < 400, text: res.text };
}

/** Exports are generated in the browser and saved as a file. */
export async function download(url) {
  const res = await dispatch('GET', url);
  if (res.status >= 400) { window.alert('That export is not available for this account.'); return; }
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || 'export.csv';
  const blob = new Blob([res.text], { type: res.headers['content-type'] || 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
