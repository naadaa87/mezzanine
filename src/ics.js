import { ensureSchema, getContent } from './db.js';
import { parseJson } from './util.js';

// 관리자 설정의 구독 주소로 예약 일정을 구글·애플 캘린더에 띄웁니다.
const escText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (d) => d.replace(/-/g, '');
const nextDay = (d) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10).replace(/-/g, '');
};
const fold = (line) => {
  const out = [];
  let s = line;
  while (new TextEncoder().encode(s).length > 73) {
    let n = 60;
    while (new TextEncoder().encode(s.slice(0, n)).length > 73) n -= 5;
    out.push(s.slice(0, n));
    s = ' ' + s.slice(n);
  }
  out.push(s);
  return out.join('\r\n');
};

export async function serveCalendar(request, env, token) {
  await ensureSchema(env);
  const content = await getContent(env, true);
  const want = content.settings.calendar_token;
  if (!want || token !== want) return new Response('Not found', { status: 404 });
  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const rs = await env.DB.prepare(
    `SELECT b.*, i.code, c.name cn, c.company cc, c.phone cp FROM bookings b
     LEFT JOIN inquiries i ON i.id=b.inquiry_id LEFT JOIN customers c ON c.id=b.customer_id
     WHERE b.status<>'cancelled' AND b.end_date>=? ORDER BY b.start_date LIMIT 1000`
  ).bind(from).all();
  const vname = (slug) => content.venues.find((v) => v.slug === slug)?.name || slug;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MEZZANINE SEOUL//Bookings//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:메자닌 예약', 'X-WR-TIMEZONE:Asia/Seoul'];
  for (const b of rs.results) {
    const label = b.kind === 'block' ? '예약 불가' : b.status === 'hold' ? '가예약' : b.status === 'done' ? '완료' : '확정';
    const zones = parseJson(b.zones, []);
    const desc = [
      `${vname(b.venue)}${zones.length ? ' · ' + zones.join(', ') : ''}`,
      b.code ? `문의 ${b.code}` : '',
      b.cn ? `고객 ${b.cn}${b.cc ? ' (' + b.cc + ')' : ''} ${b.cp || ''}` : '',
      b.amount ? `금액 ${Number(b.amount).toLocaleString('ko-KR')}원` : '',
      b.memo || '',
    ].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:mz-booking-${b.id}@mezzanine`, `DTSTAMP:${stamp}`);
    if (b.start_time && b.end_time && b.start_date === b.end_date) {
      lines.push(`DTSTART;TZID=Asia/Seoul:${ymd(b.start_date)}T${b.start_time.replace(':', '')}00`, `DTEND;TZID=Asia/Seoul:${ymd(b.end_date)}T${b.end_time.replace(':', '')}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(b.start_date)}`, `DTEND;VALUE=DATE:${nextDay(b.end_date)}`);
    }
    lines.push(fold(`SUMMARY:${escText(`[${label}] ${vname(b.venue).replace('메자닌 ', '')} · ${b.title || ''}`)}`), fold(`DESCRIPTION:${escText(desc)}`), `STATUS:${b.status === 'hold' ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
