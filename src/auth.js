import { randomToken, sha256hex, nowIso } from './util.js';

const COOKIE = 'mz_admin';
const SESSION_DAYS = 14;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return toB64(bits);
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return { hash: await derive(password, salt), salt: toB64(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const h = await derive(password, fromB64(salt));
  if (h.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 100;
}

function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  for (const part of c.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

export async function createSession(env, request, adminId) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
    env.DB.prepare('INSERT INTO sessions(token_hash, admin_id, expires_at, created_at) VALUES(?,?,?,?)').bind(
      await sha256hex(token),
      adminId,
      expires,
      nowIso()
    ),
    env.DB.prepare('UPDATE admins SET last_login_at=? WHERE id=?').bind(nowIso(), adminId),
  ]);
  const secure = new URL(request.url).protocol === 'https:' ? ' Secure;' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function destroySession(env, request) {
  const token = readCookie(request, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256hex(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function currentAdmin(env, request) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT a.id, a.login, a.name, a.role FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256hex(token), nowIso())
    .first();
  return row || null;
}

// 상태를 바꾸는 요청은 같은 사이트에서 온 JSON 요청만 받습니다(CSRF 방지).
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
