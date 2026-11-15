// 구글드라이브 공유 파일을 서버에서 읽어 옵니다. 공유가 "링크가 있는 모든 사용자"로 되어 있어야 합니다.

export const DRIVE_ID = /^[A-Za-z0-9_-]{20,80}$/;

export function folderIdFrom(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{20,80})/) || s.match(/[?&]id=([A-Za-z0-9_-]{20,80})/);
  if (m) return m[1];
  return DRIVE_ID.test(s) ? s : '';
}

const UA = 'Mozilla/5.0 (compatible; MezzanineSite/1.0)';

// 사진을 긴 변 1800px 이하의 JPEG로 받습니다.
export async function fetchDriveImage(id, size = 1800) {
  if (!DRIVE_ID.test(id)) return null;
  const urls = [
    `https://drive.google.com/thumbnail?id=${id}&sz=w${size}-h${size}`,
    `https://lh3.googleusercontent.com/d/${id}=w${size}-h${size}`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'image/jpeg,image/png,image/*;q=0.8' } });
      const type = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !type.startsWith('image/')) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 500) continue;
      return { buf, type, ...imageSize(new Uint8Array(buf)) };
    } catch {}
  }
  return null;
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// 공유 폴더의 파일 목록 (사진·영상만)
export async function listDriveFolder(folderId) {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' } });
  const html = r.ok ? await r.text() : '';
  if (!html.includes('flip-entry')) return null;
  const items = [];
  for (const chunk of html.split('id="entry-').slice(1)) {
    const id = chunk.slice(0, chunk.indexOf('"'));
    const tm = chunk.match(/class="flip-entry-title">([^<]*)</);
    if (!DRIVE_ID.test(id) || !tm) continue;
    const name = decode(tm[1]).trim();
    const isFolder = /\/drive\/folders\//.test(chunk.slice(0, 600));
    const kind = isFolder ? 'folder' : /\.(jpe?g|png|webp|heic|gif)$/i.test(name) ? 'image' : /\.(mp4|mov|m4v|webm)$/i.test(name) ? 'video' : 'other';
    items.push({ id, name, kind });
  }
  const num = (n) => Number((n.match(/\((\d+)\)/) || [])[1] || 0);
  items.sort((a, b) => a.name.replace(/\s*\(\d+\).*$/, '').localeCompare(b.name.replace(/\s*\(\d+\).*$/, ''), 'ko') || num(a.name) - num(b.name) || a.name.localeCompare(b.name));
  return items;
}

// 이미지 파일의 가로·세로 크기
export function imageSize(u8) {
  try {
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e) {
      const dv = new DataView(u8.buffer, u8.byteOffset);
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    if (u8[0] === 0xff && u8[1] === 0xd8) {
      let i = 2;
      while (i < u8.length - 9) {
        if (u8[i] !== 0xff) { i++; continue; }
        const m = u8[i + 1];
        if (m === 0xd8 || m === 0x01 || m === 0xff || (m >= 0xd0 && m <= 0xd7)) { i += m === 0xff ? 1 : 2; continue; }
        const len = (u8[i + 2] << 8) | u8[i + 3];
        if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
          return { h: (u8[i + 5] << 8) | u8[i + 6], w: (u8[i + 7] << 8) | u8[i + 8] };
        }
        i += 2 + len;
      }
    }
    if (u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57 && u8[9] === 0x45) {
      const tag = String.fromCharCode(u8[12], u8[13], u8[14], u8[15]);
      if (tag === 'VP8X') return { w: 1 + (u8[24] | (u8[25] << 8) | (u8[26] << 16)), h: 1 + (u8[27] | (u8[28] << 8) | (u8[29] << 16)) };
      if (tag === 'VP8 ') return { w: (u8[26] | (u8[27] << 8)) & 0x3fff, h: (u8[28] | (u8[29] << 8)) & 0x3fff };
      if (tag === 'VP8L') {
        const b = u8[21] | (u8[22] << 8) | (u8[23] << 16) | (u8[24] << 24);
        return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
      }
    }
  } catch {}
  return { w: 0, h: 0 };
}
