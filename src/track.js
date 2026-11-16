// 방문 집계. 쿠키나 개인 식별 정보 없이 하루 단위 숫자만 남깁니다.
// - 페이지별 조회 수
// - 하루 방문자 수: (날짜 + IP + 브라우저 정보)를 해시한 값만 그날 하루 동안 중복 제거에 씁니다
// - 다른 사이트에서 들어온 경우 그 사이트 주소(도메인)만
import { kstDate, sha256hex, clientIp } from './util.js';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|daum|lighthouse|headless|curl|wget|python|axios|node-fetch|monitor|uptime/i;

// 집계할 공개 페이지만 고릅니다
export function trackable(path) {
  if (path === '/') return true;
  return /^\/(venues(\/[a-z0-9-]+)?|cases|guide|inquiry|brochure|host)$/.test(path);
}

export async function trackView(env, request, path) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return;
    if (request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')) return;
    const day = kstDate();
    const h = (await sha256hex(`${day}|${clientIp(request)}|${ua}`)).slice(0, 20);
    const stmts = [
      env.DB.prepare('INSERT INTO page_views(day, path, n) VALUES(?,?,1) ON CONFLICT(day, path) DO UPDATE SET n=n+1').bind(day, path),
      env.DB.prepare('INSERT OR IGNORE INTO visitors(day, h) VALUES(?,?)').bind(day, h),
    ];
    const ref = request.headers.get('referer') || '';
    if (ref) {
      let host = '';
      try {
        host = new URL(ref).hostname.replace(/^www\./, '').replace(/^m\./, '');
      } catch {}
      const self = new URL(request.url).hostname.replace(/^www\./, '');
      if (host && host !== self) stmts.push(env.DB.prepare('INSERT INTO referrers(day, host, n) VALUES(?,?,1) ON CONFLICT(day, host) DO UPDATE SET n=n+1').bind(day, host.slice(0, 80)));
    }
    await env.DB.batch(stmts);
  } catch {}
}
