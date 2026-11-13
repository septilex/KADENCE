// Minimal Chrome DevTools Protocol client (Node built-in WebSocket + fetch). Read-only measurement harness.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const BRAVE = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
export const PORT = 9333;
export const PROFILE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'brave-clean-profile');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchBrave({ fresh = false } = {}) {
  if (fresh && fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`); return { reused: true }; } catch {}
  const args = [
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
    '--no-first-run', '--no-default-browser-check', '--start-maximized',
    // keep the measured window from being throttled when another window covers it (affects this temp instance only)
    '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    'about:blank',
  ];
  const p = spawn(BRAVE, args, { detached: true, stdio: 'ignore' });
  p.unref();
  for (let i = 0; i < 60; i++) { await sleep(500); try { await fetch(`http://127.0.0.1:${PORT}/json/version`); return { reused: false, args }; } catch {} }
  throw new Error('Brave debug port did not come up');
}

export async function connect() {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
    else if (msg.method) for (const l of listeners) l(msg.method, msg.params, msg.sessionId);
  };
  const send = (method, params = {}, sessionId, timeoutMs = 60000) => new Promise((res, rej) => { const i = ++id; const tm = setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("CDP timeout: " + method)); } }, timeoutMs); pending.set(i, { res: (v) => { clearTimeout(tm); res(v); }, rej: (e) => { clearTimeout(tm); rej(e); } }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const on = (fn) => listeners.push(fn);
  return { send, on, close: () => ws.close(), version: ver };
}

// Open a fresh page target and attach (flattened session)
export async function newPage(cdp, url = 'about:blank') {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p, _u, timeoutMs) => cdp.send(m, p, sessionId, timeoutMs);
  return { targetId, sessionId, s };
}

export async function evaluate(s, expression) {
  const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}

export function writeJSON(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 1)); }
