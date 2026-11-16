// 예약·매출·가동률 계산 (관리자 KPI와 호스트센터가 함께 씁니다)
import { kstDate } from './util.js';

export const isMonth = (s) => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, days: last };
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const thisMonth = () => kstDate().slice(0, 7);

export function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
}

function eachDay(from, to, fn) {
  let t = Date.parse(from);
  const end = Date.parse(to);
  let guard = 0;
  while (t <= end && guard++ < 800) {
    fn(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
}

// 기간과 겹치는 예약(취소 제외). 문의에 적힌 행사 유형도 함께 가져옵니다(고객 정보는 가져오지 않음).
export async function bookingsOverlapping(env, venues, from, to) {
  if (!venues.length) return [];
  const ph = venues.map(() => '?').join(',');
  const rs = await env.DB.prepare(
    `SELECT b.id, b.kind, b.venue, b.zones, b.start_date, b.end_date, b.start_time, b.end_time, b.status, b.amount, b.inquiry_id, i.event_type
     FROM bookings b LEFT JOIN inquiries i ON i.id=b.inquiry_id
     WHERE b.venue IN (${ph}) AND b.status<>'cancelled' AND b.end_date>=? AND b.start_date<=? ORDER BY b.start_date`
  ).bind(...venues, from, to).all();
  return rs.results;
}

const counted = (b) => b.kind === 'booking' && (b.status === 'confirmed' || b.status === 'done');

// 지점별 요약: 확정 예약 수·매출(시작일 기준), 사용한 날 수, 가동률
export function venueSummary(bookings, venues, from, to) {
  const days = daysBetween(from, to);
  const out = {};
  for (const v of venues) out[v] = { venue: v, bookings: 0, revenue: 0, hold: 0, used_days: 0, days, occupancy: 0 };
  const used = {};
  for (const b of bookings) {
    const o = out[b.venue];
    if (!o) continue;
    if (counted(b)) {
      if (b.start_date >= from && b.start_date <= to) {
        o.bookings++;
        o.revenue += Number(b.amount || 0);
      }
      const s = b.start_date < from ? from : b.start_date;
      const e = b.end_date > to ? to : b.end_date;
      eachDay(s, e, (d) => ((used[b.venue] ||= new Set()).add(d)));
    } else if (b.kind === 'booking' && b.status === 'hold' && b.start_date >= from && b.start_date <= to) o.hold++;
  }
  for (const v of venues) {
    out[v].used_days = used[v] ? used[v].size : 0;
    out[v].occupancy = days ? out[v].used_days / days : 0;
  }
  return out;
}

// 최근 n개월 월별 매출·사용일
export async function monthlyTrend(env, venues, endMonth, n = 12) {
  const startMonth = addMonths(endMonth, -(n - 1));
  const from = monthRange(startMonth).from;
  const to = monthRange(endMonth).to;
  const rows = await bookingsOverlapping(env, venues, from, to);
  const list = [];
  for (let i = 0; i < n; i++) {
    const m = addMonths(startMonth, i);
    const r = monthRange(m);
    const sum = venueSummary(rows, venues, r.from, r.to);
    const tot = Object.values(sum).reduce((a, x) => ({ revenue: a.revenue + x.revenue, bookings: a.bookings + x.bookings, used: a.used + x.used_days }), { revenue: 0, bookings: 0, used: 0 });
    list.push({ month: m, revenue: tot.revenue, bookings: tot.bookings, used_days: tot.used, occupancy: venues.length ? tot.used / (r.days * venues.length) : 0 });
  }
  return list;
}

// 호스트에게 보여 줄 행사 이름: 고객 이름이 들어가지 않게 행사 유형만 씁니다
export function publicEventLabel(b) {
  if (b.kind === 'block') return '예약 불가(점검·준비)';
  return b.event_type ? `${b.event_type} 대관` : '대관';
}
