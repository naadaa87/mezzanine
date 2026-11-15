export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const fail = (status, message, extra = {}) => json({ ok: false, error: message, ...extra }, status);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const nowIso = () => new Date().toISOString();

// 한국 시간 기준 날짜(YYYY-MM-DD)
export const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
export const clip = (s, n) => String(s ?? '').trim().slice(0, n);
export const normPhone = (p) => String(p ?? '').replace(/\D/g, '');
export const toInt = (v, d = 0) => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : d;
};
export const won = (n) => Number(n || 0).toLocaleString('ko-KR');

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a.buffer);
}

// 헷갈리는 글자(0/O, 1/I)를 뺀 짧은 코드
export function randomCode(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => chars[x % chars.length]).join('');
}

export async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readJson(request, maxBytes = 300_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('요청 내용이 너무 큽니다.');
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new Error('요청 형식이 올바르지 않습니다.');
  }
}

export const clientIp = (request) => request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';

export const parseJson = (s, d) => {
  try {
    return s ? JSON.parse(s) : d;
  } catch {
    return d;
  }
};

export function csv(rows) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    // 엑셀에서 수식으로 실행되지 않게 막기
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
