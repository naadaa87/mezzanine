// 공간소개서(PDF) 같은 큰 파일 저장·제공.
// D1은 한 칸에 2MB까지만 들어가므로 1.9MB씩 나눠 저장하고, 내려받을 때 이어 붙여 보냅니다.
import { nowIso } from './util.js';

const PART = 1_900_000;
const RETRY_MS = 20 * 60 * 1000;

export const brochureKey = (slug) => `brochure:${slug}`;

export function fileInfo(env, k) {
  return env.DB.prepare('SELECT k, name, mime, size, parts, src, state, fetch_at, updated_at FROM files WHERE k=?').bind(k).first();
}

export async function listFiles(env, prefix) {
  const rs = await env.DB.prepare('SELECT k, name, mime, size, parts, src, state, fetch_at, updated_at FROM files WHERE k LIKE ?').bind(`${prefix}%`).all();
  return rs.results;
}

export async function storeFile(env, k, bytes, { name = '', mime = 'application/pdf', src = '' } = {}) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const parts = Math.ceil(u8.byteLength / PART);
  const now = nowIso();
  // 저장하는 동안에는 내려받기를 막아 둡니다
  await env.DB.prepare(
    `INSERT INTO files(k, name, mime, size, parts, src, state, fetch_at, updated_at) VALUES(?,?,?,?,0,?,0,?,?)
     ON CONFLICT(k) DO UPDATE SET state=0, updated_at=excluded.updated_at`
  ).bind(k, name, mime, u8.byteLength, src, now, now).run();
  await env.DB.prepare('DELETE FROM file_parts WHERE k=?').bind(k).run();
  for (let i = 0; i < parts; i++) {
    const chunk = u8.slice(i * PART, (i + 1) * PART);
    await env.DB.prepare('INSERT INTO file_parts(k, part, data) VALUES(?,?,?)').bind(k, i, chunk.buffer).run();
  }
  await env.DB.prepare(`UPDATE files SET name=?, mime=?, size=?, parts=?, src=?, state=1, fetch_at=?, updated_at=? WHERE k=?`)
    .bind(name, mime, u8.byteLength, parts, src, now, now, k)
    .run();
}

export async function deleteFile(env, k) {
  await env.DB.batch([env.DB.prepare('DELETE FROM file_parts WHERE k=?').bind(k), env.DB.prepare('DELETE FROM files WHERE k=?').bind(k)]);
}

// 드라이브 공유 링크에서 파일 ID를 꺼냅니다
export function driveFileId(link) {
  const s = String(link || '').trim();
  const m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
}

// "링크가 있는 모든 사용자"로 공유된 드라이브 PDF를 받습니다
export async function fetchDrivePdf(id, maxBytes = 30_000_000) {
  const urls = [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; MezzanineSite/1.0)' } });
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength < 1024 || buf.byteLength > maxBytes) continue;
      if (String.fromCharCode(...buf.slice(0, 5)) !== '%PDF-') continue;
      return buf;
    } catch {}
  }
  return null;
}

// 지점 소개서를 준비합니다. 관리자가 직접 올린 파일이 있으면 그대로 쓰고,
// 없으면 지점 정보의 드라이브 링크에서 받아 저장합니다.
export async function ensureBrochure(env, venue, { force = false } = {}) {
  const k = brochureKey(venue.slug);
  const info = await fileInfo(env, k);
  const id = driveFileId(venue.brochure);
  if (info && info.state === 1 && info.parts > 0) {
    const sameSource = info.src === 'upload' || !id || info.src === `drive:${id}`;
    if (!force && sameSource) return info;
  }
  if (!id) return info && info.state === 1 ? info : null;
  if (!force && info && info.state === -1 && info.fetch_at && Date.now() - Date.parse(info.fetch_at) < RETRY_MS) return null;
  const buf = await fetchDrivePdf(id);
  if (!buf) {
    const now = nowIso();
    await env.DB.prepare(
      `INSERT INTO files(k, name, mime, size, parts, src, state, fetch_at, updated_at) VALUES(?,?,?,0,0,?,-1,?,?)
       ON CONFLICT(k) DO UPDATE SET state=CASE WHEN files.parts>0 AND files.state=1 THEN 1 ELSE -1 END, fetch_at=excluded.fetch_at`
    ).bind(k, `${venue.name} 공간소개서.pdf`, 'application/pdf', `drive:${id}`, now, now).run();
    return info && info.state === 1 ? info : null;
  }
  await storeFile(env, k, buf, { name: `${venue.name} 공간소개서.pdf`, src: `drive:${id}` });
  return fileInfo(env, k);
}

// 나눠 저장한 파일을 이어 붙여 내려보냅니다
export function fileResponse(env, info, filename, { inline = false, ascii: asciiName = '' } = {}) {
  let i = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (i >= info.parts) {
        controller.close();
        return;
      }
      const r = await env.DB.prepare('SELECT data FROM file_parts WHERE k=? AND part=?').bind(info.k, i).first();
      i++;
      if (!r || !r.data) {
        controller.error(new Error('file part missing'));
        return;
      }
      controller.enqueue(r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : new Uint8Array(r.data));
    },
  });
  // 전체 크기를 알려 주면 브라우저가 내려받기 진행률을 보여 줍니다
  let body = stream;
  if (typeof FixedLengthStream === 'function') {
    const fls = new FixedLengthStream(info.size);
    stream.pipeTo(fls.writable).catch(() => {});
    body = fls.readable;
  }
  const ascii = (asciiName || filename.replace(/[^\x20-\x7e]/g, '').replace(/"/g, '') || 'download.pdf').replace(/"/g, '');
  return new Response(body, {
    headers: {
      'content-type': info.mime || 'application/pdf',
      'content-length': String(info.size),
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
