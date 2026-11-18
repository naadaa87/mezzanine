// 방문 집계. 쿠키나 개인 식별 정보 없이 숫자만 남깁니다.
// 서버(페이지를 열 때)
// - 페이지별 조회 수, 시간대별 조회 수
// - 하루 방문자 수: (날짜 + IP + 브라우저 정보)를 해시한 값만 그날 하루 동안 중복 제거에 씁니다. 기기 종류(PC·모바일·태블릿)도 함께
// - 페이지별 방문자 수: 같은 해시로 페이지마다 그날 한 번만 셉니다
// - 다른 사이트에서 들어온 경우 그 사이트 주소(도메인)만
// 브라우저(/assets/js/track.js → POST /api/t)
// - 방문(세션): 탭을 닫으면 사라지는 임의 번호(sessionStorage)로 한 번의 방문 안에서 본 페이지 수, 머문 시간, 들어온 경로, 문의·소개서 요청 여부
// - 페이지별 머문 시간(화면을 보고 있던 시간)과 스크롤 깊이
// - 버튼·링크 클릭 수(어느 버튼을 어디서 눌렀는지)
import { kstDate, sha256hex, clientIp, nowIso } from './util.js';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|daum|lighthouse|headless|curl|wget|python|axios|node-fetch|monitor|uptime/i;

// 집계할 공개 페이지만 고릅니다
export function trackable(path) {
  if (path === '/') return true;
  return /^\/(venues(\/[a-z0-9-]+)?|cases|guide|inquiry|brochure|host|my)$/.test(path);
}

export function deviceOf(ua) {
  if (/iPad|Tablet|SM-T\d|Tab\b|Kindle|Silk/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  return 'desktop';
}

const kstHour = () => new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
const hostOf = (s) => {
  try {
    return new URL(s).hostname.replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
};

export async function trackView(env, request, path) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return;
    if (request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')) return;
    const day = kstDate();
    const h = (await sha256hex(`${day}|${clientIp(request)}|${ua}`)).slice(0, 20);
    const stmts = [
      env.DB.prepare('INSERT INTO page_views(day, path, n) VALUES(?,?,1) ON CONFLICT(day, path) DO UPDATE SET n=n+1').bind(day, path),
      env.DB.prepare('INSERT OR IGNORE INTO visitors(day, h, dev) VALUES(?,?,?)').bind(day, h, deviceOf(ua)),
      env.DB.prepare('INSERT OR IGNORE INTO page_uv(day, path, h) VALUES(?,?,?)').bind(day, path, h),
      env.DB.prepare('INSERT INTO visit_hours(day, hour, n) VALUES(?,?,1) ON CONFLICT(day, hour) DO UPDATE SET n=n+1').bind(day, kstHour()),
    ];
    const host = hostOf(request.headers.get('referer') || '');
    const self = new URL(request.url).hostname.replace(/^www\./, '');
    if (host && host !== self) stmts.push(env.DB.prepare('INSERT INTO referrers(day, host, n) VALUES(?,?,1) ON CONFLICT(day, host) DO UPDATE SET n=n+1').bind(day, host.slice(0, 80)));
    await env.DB.batch(stmts);
  } catch {}
}

const NO = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const CONV = { 'conv:inquiry': 'conv_inquiry', 'conv:brochure': 'conv_brochure', 'conv:partner': 'conv_partner' };

// 브라우저가 보내는 기록(navigator.sendBeacon). 실패해도 화면에는 영향이 없도록 항상 204로 답합니다.
export async function handleBeacon(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return NO();
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin && hostOf(origin) !== url.hostname.replace(/^(www|m)\./, '')) return NO();
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return NO();
    if (Number(request.headers.get('content-length') || 0) > 4096) return NO();
    const b = JSON.parse((await request.text()).slice(0, 4096));
    const sid = String(b.sid || '');
    const p = String(b.p || '');
    if (!/^[a-z0-9]{12,32}$/.test(sid) || !trackable(p)) return NO();
    const day = kstDate();
    const now = nowIso();
    const db = env.DB;

    if (b.e === 'pv') {
      let ref = clean(b.r, 80).toLowerCase().replace(/^(www|m)\./, '');
      if (ref === url.hostname.replace(/^(www|m)\./, '')) ref = '';
      await db.batch([
        db.prepare(`INSERT INTO visit_sessions(sid, day, started_at, last_at, landing, exit_path, pages, dev, ref, utm_source, utm_medium, utm_campaign)
                    VALUES(?,?,?,?,?,?,1,?,?,?,?,?)
                    ON CONFLICT(sid) DO UPDATE SET pages=pages+1, last_at=excluded.last_at, exit_path=excluded.exit_path WHERE visit_sessions.pages < 500`)
          .bind(sid, day, now, now, p, p, deviceOf(ua), ref, clean(b.us, 60).toLowerCase(), clean(b.um, 60).toLowerCase(), clean(b.uc, 80)),
        db.prepare('INSERT INTO page_time(day, path, loads) VALUES(?,?,1) ON CONFLICT(day, path) DO UPDATE SET loads=loads+1').bind(day, p),
      ]);
      return NO();
    }

    if (b.e === 'leave') {
      const ms = int(b.ms, 30 * 60 * 1000);
      const d = int(b.d, 100);
      if (!ms && !d) return NO();
      const r = await db.prepare('UPDATE visit_sessions SET ms=ms+?, last_at=? WHERE sid=?').bind(ms, now, sid).run();
      if (!r.meta.changes) return NO();
      await db.prepare('INSERT INTO page_time(day, path, ms, depth) VALUES(?,?,?,?) ON CONFLICT(day, path) DO UPDATE SET ms=ms+excluded.ms, depth=depth+excluded.depth').bind(day, p, ms, d).run();
      return NO();
    }

    if (b.e === 'click' || b.e === 'ev') {
      const k = clean(b.k, 120);
      if (!k) return NO();
      const conv = b.e === 'ev' ? CONV[k] : null;
      if (b.e === 'ev' && !conv && !k.startsWith('search|')) return NO();
      // 페이지를 연 기록이 있는 방문에서만, 한 방문에 300번까지 셉니다
      const r = await db.prepare(`UPDATE visit_sessions SET clicks=clicks+1, last_at=?${conv ? `, ${conv}=1` : ''}${k.startsWith('search|') ? ', conv_search=1' : ''} WHERE sid=? AND clicks<300`).bind(now, sid).run();
      if (!r.meta.changes) return NO();
      await db.prepare('INSERT INTO clicks(day, path, k, label, n) VALUES(?,?,?,?,1) ON CONFLICT(day, path, k) DO UPDATE SET n=n+1, label=excluded.label')
        .bind(day, p, k, clean(b.l, 60)).run();
      return NO();
    }
  } catch {}
  return NO();
}

// 오래된 방문 기록 정리(예약 작업에서 호출)
export async function pruneVisits(env) {
  const cut = (days) => kstDate(new Date(Date.now() - days * 86400000));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM visit_sessions WHERE day < ?').bind(cut(400)),
    env.DB.prepare('DELETE FROM page_uv WHERE day < ?').bind(cut(400)),
  ]);
}
