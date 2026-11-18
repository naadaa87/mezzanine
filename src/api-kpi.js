// 관리자 KPI: 방문 분석, 페이지·클릭, 인기 정보, 고객·회원
// 모든 숫자는 고른 기간(한국 시간 기준 날짜)과, 바로 앞의 같은 길이 기간을 비교합니다.
import { json, isDate, kstDate, parseJson } from './util.js';

const KST = (col) => `date(${col},'+9 hours')`;
const DAY = 86400000;
const shift = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY) + 1;
const NOT_EVENT = `k NOT LIKE 'search|%' AND k NOT LIKE 'conv:%'`;
const BOUNCE = 'pages=1 AND ms<10000 AND clicks=0';

function period(q) {
  const today = kstDate();
  let to = isDate(q.get('to')) ? q.get('to') : today;
  let from = isDate(q.get('from')) ? q.get('from') : today.slice(0, 8) + '01';
  if (from > to) [from, to] = [to, from];
  if (span(from, to) > 800) from = shift(to, -799);
  const n = span(from, to);
  const prevTo = shift(from, -1);
  return { from, to, prevFrom: shift(prevTo, -(n - 1)), prevTo, days: n };
}

const rowsOf = (r) => r.results || [];
const one = (r) => rowsOf(r)[0] || {};

// 들어온 경로를 묶어서 봅니다
function channelOf(ref, src, med) {
  const m = (med || '').toLowerCase();
  const t = ((src || '') + ' ' + (ref || '')).toLowerCase().trim();
  if (/^(cpc|ppc|paid|ad|ads|display|banner|paidsocial)$/.test(m)) return '광고';
  if (m === 'qr') return 'QR 코드';
  if (m === 'email' || /mail|newsletter|stibee/.test(t)) return '이메일';
  if (!t) return '직접 방문';
  if (/blog\.naver|tistory|brunch|velog|blog/.test(t)) return '블로그';
  if (/map\.naver|naver\.me|map\.kakao|kakaomap|maps\.google/.test(t)) return '지도';
  if (/instagram|facebook|\bfb\b|threads|t\.co\b|twitter|x\.com|youtube|youtu\.be|kakao|linktr|litt\.ly|lnk\.bio|band\.us/.test(t)) return 'SNS·링크';
  if (/naver|google|daum|bing|zum|yahoo|nate|duckduckgo|ecosia/.test(t)) return '검색';
  return '다른 사이트';
}

// 클릭 기록 키: "종류|내용|@위치"
function parseKey(k) {
  const i = k.lastIndexOf('|@');
  const base = i >= 0 ? k.slice(0, i) : k;
  const place = i >= 0 ? k.slice(i + 2) : '';
  const j = base.indexOf('|');
  return { base, place, type: j >= 0 ? base.slice(0, j) : base, detail: j >= 0 ? base.slice(j + 1) : '' };
}

function groupClicks(rows) {
  const map = new Map();
  for (const r of rows) {
    const { base, place, type, detail } = parseKey(r.k);
    const g = map.get(base) || { key: base, type, detail, n: 0, label: r.label || '', places: {} };
    g.n += r.n;
    if (place) g.places[place] = (g.places[place] || 0) + r.n;
    if (!g.label && r.label) g.label = r.label;
    map.set(base, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, places: Object.entries(g.places).sort((a, b) => b[1] - a[1]).map(([place, n]) => ({ place, n })) }))
    .sort((a, b) => b.n - a.n);
}

async function trafficCounts(db, from, to) {
  const b = (s) => db.prepare(s).bind(from, to);
  const rs = await db.batch([
    b('SELECT COUNT(*) n FROM visitors WHERE day BETWEEN ? AND ?'),
    b('SELECT COALESCE(SUM(n),0) n FROM page_views WHERE day BETWEEN ? AND ?'),
    b(`SELECT COUNT(*) n, COALESCE(SUM(pages),0) pages, COALESCE(SUM(ms),0) ms, COALESCE(SUM(${BOUNCE}),0) bounce,
              COALESCE(SUM(conv_inquiry),0) ci, COALESCE(SUM(conv_brochure),0) cb, COALESCE(SUM(conv_search),0) cs FROM visit_sessions WHERE day BETWEEN ? AND ?`),
    b('SELECT COALESCE(SUM(loads),0) loads, COALESCE(SUM(ms),0) ms FROM page_time WHERE day BETWEEN ? AND ?'),
    b(`SELECT COALESCE(SUM(n),0) n FROM clicks WHERE day BETWEEN ? AND ? AND ${NOT_EVENT}`),
  ]);
  const s = one(rs[2]);
  const t = one(rs[3]);
  return {
    visitors: one(rs[0]).n,
    pageviews: one(rs[1]).n,
    sessions: s.n,
    pages_per_session: s.n ? s.pages / s.n : null,
    avg_session_ms: s.n ? s.ms / s.n : null,
    bounce: s.n ? s.bounce / s.n : null,
    avg_page_ms: t.loads ? t.ms / t.loads : null,
    clicks: one(rs[4]).n,
    conv_inquiry: s.ci,
    conv_brochure: s.cb,
    searches: s.cs,
    conv_rate: s.n ? (s.ci + s.cb) / s.n : null,
  };
}

async function pathStats(db, from, to) {
  const b = (s) => db.prepare(s).bind(from, to);
  const rs = await db.batch([
    b('SELECT path, SUM(n) n FROM page_views WHERE day BETWEEN ? AND ? GROUP BY path'),
    b('SELECT path, COUNT(*) n FROM page_uv WHERE day BETWEEN ? AND ? GROUP BY path'),
    b('SELECT path, SUM(loads) loads, SUM(ms) ms, SUM(depth) depth FROM page_time WHERE day BETWEEN ? AND ? GROUP BY path'),
    b(`SELECT landing path, COUNT(*) n, SUM(${BOUNCE}) bounce, SUM(conv_inquiry) ci, SUM(conv_brochure) cb FROM visit_sessions WHERE day BETWEEN ? AND ? GROUP BY landing`),
    b('SELECT exit_path path, COUNT(*) n FROM visit_sessions WHERE day BETWEEN ? AND ? GROUP BY exit_path'),
    b(`SELECT path, SUM(n) n FROM clicks WHERE day BETWEEN ? AND ? AND ${NOT_EVENT} GROUP BY path`),
  ]);
  const m = new Map();
  const get = (p) => m.get(p) || (m.set(p, { path: p, views: 0, visitors: 0, loads: 0, ms: 0, depth: 0, entrances: 0, bounces: 0, exits: 0, clicks: 0, conv: 0 }), m.get(p));
  rowsOf(rs[0]).forEach((r) => (get(r.path).views = r.n));
  rowsOf(rs[1]).forEach((r) => (get(r.path).visitors = r.n));
  rowsOf(rs[2]).forEach((r) => Object.assign(get(r.path), { loads: r.loads, ms: r.ms, depth: r.depth }));
  rowsOf(rs[3]).forEach((r) => Object.assign(get(r.path), { entrances: r.n, bounces: r.bounce, conv: r.ci + r.cb }));
  rowsOf(rs[4]).forEach((r) => (get(r.path).exits = r.n));
  rowsOf(rs[5]).forEach((r) => (get(r.path).clicks = r.n));
  return [...m.values()]
    .filter((r) => r.path)
    .map((r) => ({
      ...r,
      avg_ms: r.loads ? r.ms / r.loads : null,
      avg_depth: r.loads ? r.depth / r.loads : null,
      bounce: r.entrances ? r.bounces / r.entrances : null,
    }))
    .sort((a, b) => b.views - a.views);
}

async function clickRows(db, from, to, extra = '') {
  return rowsOf(await db.prepare(`SELECT k, SUM(n) n, MAX(label) label FROM clicks WHERE day BETWEEN ? AND ? AND ${extra || NOT_EVENT} GROUP BY k`).bind(from, to).all());
}

async function trackingSince(db) {
  const r = await db.prepare('SELECT MIN(day) d FROM visit_sessions').first();
  return r?.d || null;
}

// ── 방문 분석 ─────────────────────────────────────────────
async function traffic(env, P) {
  const db = env.DB;
  const [cur, prev, since] = await Promise.all([trafficCounts(db, P.from, P.to), trafficCounts(db, P.prevFrom, P.prevTo), trackingSince(db)]);
  const b = (s) => db.prepare(s).bind(P.from, P.to);
  const monthly = P.days > 93;
  const unit = monthly ? 'substr(day,1,7)' : 'day';
  const rs = await db.batch([
    b(`SELECT ${unit} d, COUNT(*) n FROM visitors WHERE day BETWEEN ? AND ? GROUP BY d`),
    b(`SELECT ${unit} d, SUM(n) n FROM page_views WHERE day BETWEEN ? AND ? GROUP BY d`),
    b(`SELECT ${unit} d, COUNT(*) n FROM visit_sessions WHERE day BETWEEN ? AND ? GROUP BY d`),
    b('SELECT hour, SUM(n) n FROM visit_hours WHERE day BETWEEN ? AND ? GROUP BY hour'),
    b(`SELECT CAST(strftime('%w', day) AS INTEGER) w, COUNT(*) n FROM visitors WHERE day BETWEEN ? AND ? GROUP BY w`),
    b(`SELECT dev, COUNT(*) n FROM visitors WHERE day BETWEEN ? AND ? AND dev<>'' GROUP BY dev`),
    b(`SELECT dev, COUNT(*) n, SUM(ms) ms, SUM(pages) pages, SUM(${BOUNCE}) bounce, SUM(conv_inquiry) ci, SUM(conv_brochure) cb FROM visit_sessions WHERE day BETWEEN ? AND ? GROUP BY dev`),
    b(`SELECT ref, utm_source src, utm_medium med, COUNT(*) n, SUM(pages) pages, SUM(ms) ms, SUM(${BOUNCE}) bounce, SUM(conv_inquiry) ci, SUM(conv_brochure) cb FROM visit_sessions WHERE day BETWEEN ? AND ? GROUP BY ref, utm_source, utm_medium`),
    b(`SELECT utm_source src, utm_medium med, utm_campaign camp, COUNT(*) n, SUM(conv_inquiry) ci, SUM(conv_brochure) cb FROM visit_sessions WHERE day BETWEEN ? AND ? AND (utm_campaign<>'' OR utm_source<>'') GROUP BY 1,2,3 ORDER BY n DESC LIMIT 20`),
    b('SELECT host, SUM(n) n FROM referrers WHERE day BETWEEN ? AND ? GROUP BY host ORDER BY n DESC LIMIT 12'),
  ]);

  // 기간 안의 날(또는 달)을 빠짐없이 채웁니다
  const keys = [];
  if (monthly) {
    for (let m = P.from.slice(0, 7); m <= P.to.slice(0, 7); ) {
      keys.push(m);
      const [y, mm] = m.split('-').map(Number);
      m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
    }
  } else for (let d = P.from; d <= P.to; d = shift(d, 1)) keys.push(d);
  const toMap = (r) => Object.fromEntries(rowsOf(r).map((x) => [x.d, x.n]));
  const [vm, pm, sm] = [toMap(rs[0]), toMap(rs[1]), toMap(rs[2])];
  const trend = keys.map((k) => ({ d: k, visitors: vm[k] || 0, pageviews: pm[k] || 0, sessions: sm[k] || 0 }));

  const hours = Array.from({ length: 24 }, (_, h) => rowsOf(rs[3]).find((x) => x.hour === h)?.n || 0);
  const weekdays = Array.from({ length: 7 }, (_, w) => rowsOf(rs[4]).find((x) => x.w === w)?.n || 0);

  const chMap = new Map();
  const sources = [];
  for (const r of rowsOf(rs[7])) {
    const ch = channelOf(r.ref, r.src, r.med);
    const g = chMap.get(ch) || { channel: ch, n: 0, pages: 0, ms: 0, bounce: 0, ci: 0, cb: 0 };
    for (const k of ['n', 'pages', 'ms', 'bounce', 'ci', 'cb']) g[k] += r[k] || 0;
    chMap.set(ch, g);
    if (r.ref || r.src) sources.push({ source: r.src ? `${r.src}${r.med ? ` / ${r.med}` : ''}` : r.ref, channel: ch, n: r.n, ci: r.ci, cb: r.cb });
  }
  const merged = new Map();
  for (const s of sources) {
    const g = merged.get(s.source) || { ...s, n: 0, ci: 0, cb: 0 };
    g.n += s.n;
    g.ci += s.ci;
    g.cb += s.cb;
    merged.set(s.source, g);
  }

  return {
    ok: true, from: P.from, to: P.to, prev: { from: P.prevFrom, to: P.prevTo, ...prev }, since, monthly,
    ...cur, trend, hours, weekdays,
    devices: rowsOf(rs[5]),
    device_sessions: rowsOf(rs[6]),
    channels: [...chMap.values()].sort((a, b) => b.n - a.n),
    sources: [...merged.values()].sort((a, b) => b.n - a.n).slice(0, 15),
    campaigns: rowsOf(rs[8]),
    referrers: rowsOf(rs[9]),
  };
}

// ── 페이지·클릭 ───────────────────────────────────────────
async function pages(env, P) {
  const db = env.DB;
  const [list, prevList, clicks, prevClicks, cur, since] = await Promise.all([
    pathStats(db, P.from, P.to), pathStats(db, P.prevFrom, P.prevTo), clickRows(db, P.from, P.to), clickRows(db, P.prevFrom, P.prevTo), trafficCounts(db, P.from, P.to), trackingSince(db),
  ]);
  const prevBy = Object.fromEntries(prevList.map((r) => [r.path, r]));
  const groups = groupClicks(clicks);
  const prevGroups = Object.fromEntries(groupClicks(prevClicks).map((g) => [g.key, g.n]));
  const totalClicks = groups.reduce((a, g) => a + g.n, 0);
  const types = {};
  for (const g of groups) types[g.type] = (types[g.type] || 0) + g.n;
  return {
    ok: true, from: P.from, to: P.to, prev: { from: P.prevFrom, to: P.prevTo }, since,
    sessions: cur.sessions, total_clicks: totalClicks, prev_clicks: Object.values(prevGroups).reduce((a, n) => a + n, 0),
    pages: list.map((r) => ({ ...r, prev_views: prevBy[r.path]?.views || 0 })),
    clicks: groups.slice(0, 40).map((g) => ({ ...g, prev: prevGroups[g.key] || 0 })),
    click_types: Object.entries(types).map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n),
  };
}

// ── 인기 정보 ─────────────────────────────────────────────
async function popular(env, content, P) {
  const db = env.DB;
  const b = (s) => db.prepare(s).bind(P.from, P.to);
  const [list, clicks, evRows, since] = await Promise.all([
    pathStats(db, P.from, P.to), clickRows(db, P.from, P.to), clickRows(db, P.from, P.to, `k LIKE 'search|%'`), trackingSince(db),
  ]);
  const rs = await db.batch([
    b(`SELECT venue, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ? GROUP BY venue`),
    b(`SELECT venue, COUNT(*) n FROM inquiries WHERE kind='open_notify' AND ${KST('created_at')} BETWEEN ? AND ? GROUP BY venue`),
    b(`SELECT venue, COUNT(*) n, COALESCE(SUM(amount),0) amount FROM bookings WHERE kind='booking' AND status IN ('confirmed','done') AND start_date BETWEEN ? AND ? GROUP BY venue`),
    b(`SELECT COALESCE(NULLIF(event_type,''),'미정') t, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ? GROUP BY t ORDER BY n DESC`),
    b(`SELECT COALESCE(NULLIF(event_type,''),'미정') t, COUNT(*) n FROM leads WHERE ${KST('created_at')} BETWEEN ? AND ? GROUP BY t ORDER BY n DESC`),
    b(`SELECT COUNT(*) n, COALESCE(SUM(downloads>0),0) dl, COALESCE(SUM(downloads),0) downloads FROM leads WHERE ${KST('created_at')} BETWEEN ? AND ?`),
  ]);
  const by = (r, key = 'venue') => Object.fromEntries(rowsOf(r).map((x) => [x[key], x]));
  const inq = by(rs[0]);
  const notify = by(rs[1]);
  const bk = by(rs[2]);
  const pathBy = Object.fromEntries(list.map((r) => [r.path, r]));
  const groups = groupClicks(clicks);
  const sum = (pred) => groups.filter(pred).reduce((a, g) => a + g.n, 0);

  // 공간 찾기: search|지점|행사 종류|인원
  const search = { total: 0, venue: {}, type: {}, headcount: {}, month: {} };
  for (const r of evRows) {
    const [, v, t, hc] = r.k.split('|');
    search.total += r.n;
    search.venue[v] = (search.venue[v] || 0) + r.n;
    if (t && t !== '-') search.type[t] = (search.type[t] || 0) + r.n;
    if (hc && hc !== '-') search.headcount[hc] = (search.headcount[hc] || 0) + r.n;
    if (r.label) search.month[r.label] = (search.month[r.label] || 0) + r.n;
  }
  const rank = (o) => Object.entries(o).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);

  const venues = content.venues.map((v) => {
    const pg = pathBy[`/venues/${v.slug}`] || {};
    return {
      slug: v.slug, name: v.name, status: v.status,
      views: pg.views || 0, visitors: pg.visitors || 0, avg_ms: pg.avg_ms ?? null,
      card_clicks: sum((g) => g.type === 'venue' && g.detail === v.slug),
      searched: search.venue[v.slug] || 0,
      inquiries: inq[v.slug]?.n || 0, notify: notify[v.slug]?.n || 0,
      bookings: bk[v.slug]?.n || 0, revenue: bk[v.slug]?.amount || 0,
    };
  }).sort((a, b) => b.views + b.card_clicks - (a.views + a.card_clicks));

  const pick = (type) => groups.filter((g) => g.type === type).map((g) => ({ k: g.detail, n: g.n, label: g.label, places: g.places }));
  return {
    ok: true, from: P.from, to: P.to, since,
    top_pages: list.slice(0, 10),
    venues,
    type_buttons: pick('type'),
    search: { total: search.total, venue: rank(search.venue), type: rank(search.type), headcount: rank(search.headcount), month: rank(search.month).slice(0, 8) },
    inquiry_types: rowsOf(rs[3]),
    lead_types: rowsOf(rs[4]),
    faq: pick('faq'),
    photos: pick('photo'),
    videos: pick('video'),
    outbound: [...pick('out'), ...pick('contact')].sort((a, b) => b.n - a.n),
    ctas: pick('cta'),
    brochure: { ...one(rs[5]), clicks: sum((g) => g.type === 'cta' && g.detail === '소개서 받기'), download_clicks: sum((g) => g.type === 'download') },
  };
}

// ── 고객·회원 ─────────────────────────────────────────────
async function members(env, P, q) {
  const db = env.DB;
  const b = (s) => db.prepare(s).bind(P.from, P.to);
  const bp = (s) => db.prepare(s).bind(P.prevFrom, P.prevTo);
  const booked = `SELECT COALESCE(bk.customer_id, i.customer_id) cid FROM bookings bk LEFT JOIN inquiries i ON i.id=bk.inquiry_id WHERE bk.kind='booking' AND bk.status IN ('confirmed','done')`;
  const since12 = `${shift(kstDate(), -400).slice(0, 7)}-01`;
  const rs = await db.batch([
    db.prepare('SELECT COUNT(*) n FROM customers'),
    b(`SELECT COUNT(*) n FROM customers WHERE ${KST('created_at')} BETWEEN ? AND ?`),
    bp(`SELECT COUNT(*) n FROM customers WHERE ${KST('created_at')} BETWEEN ? AND ?`),
    db.prepare(`SELECT COUNT(DISTINCT customer_id) n FROM inquiries WHERE kind='rental' AND customer_id IS NOT NULL`),
    db.prepare(`SELECT COUNT(*) n FROM (SELECT customer_id FROM inquiries WHERE kind='rental' AND customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*)>=2)`),
    db.prepare(`SELECT COUNT(DISTINCT cid) n FROM (${booked}) WHERE cid IS NOT NULL`),
    db.prepare(`SELECT COUNT(*) n FROM customers c WHERE EXISTS(SELECT 1 FROM leads l WHERE l.customer_id=c.id) AND NOT EXISTS(SELECT 1 FROM inquiries i WHERE i.customer_id=c.id)`),
    db.prepare(`SELECT substr(${KST('created_at')},1,7) m, COUNT(*) n FROM customers WHERE ${KST('created_at')} >= ? GROUP BY m`).bind(since12),
    b(`SELECT c.id,
          (SELECT created_at || '|' || COALESCE(source,'') FROM inquiries i WHERE i.customer_id=c.id ORDER BY created_at LIMIT 1) fi,
          (SELECT MIN(created_at) FROM leads l WHERE l.customer_id=c.id) fl
        FROM customers c WHERE ${KST('c.created_at')} BETWEEN ? AND ?`),
    db.prepare(`SELECT id, name, company, status, venues, created_at, last_login_at FROM hosts ORDER BY id DESC`),
    db.prepare('SELECT COUNT(*) n FROM admins'),
    b(`SELECT COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ?`),
    b(`SELECT COUNT(*) n FROM leads WHERE ${KST('created_at')} BETWEEN ? AND ?`),
    b(`SELECT COUNT(*) n FROM partner_apps WHERE ${KST('created_at')} BETWEEN ? AND ?`),
  ]);

  // 처음 연락한 경로
  const first = {};
  for (const r of rowsOf(rs[8])) {
    const [fiAt, fiSrc] = (r.fi || '').split('|');
    let k = '기타';
    if (r.fl && (!fiAt || r.fl <= fiAt)) k = 'brochure';
    else if (fiAt) k = fiSrc || 'web';
    first[k] = (first[k] || 0) + 1;
  }

  // 고객 목록(기간 안에 처음 등록된 고객, all=1이면 전체)
  const all = q.get('all') === '1';
  const where = all ? '' : `WHERE ${KST('c.created_at')} BETWEEN ? AND ?`;
  const listSql = `SELECT c.id, c.name, c.company, c.phone, c.email, c.tags, c.created_at,
      (SELECT COUNT(*) FROM inquiries i WHERE i.customer_id=c.id AND i.kind='rental') inquiries,
      (SELECT COUNT(*) FROM leads l WHERE l.customer_id=c.id) leads,
      (SELECT COUNT(*) FROM (${booked}) x WHERE x.cid=c.id) bookings,
      (SELECT COALESCE(SUM(bk.amount),0) FROM bookings bk LEFT JOIN inquiries i ON i.id=bk.inquiry_id WHERE bk.kind='booking' AND bk.status IN ('confirmed','done') AND COALESCE(bk.customer_id, i.customer_id)=c.id) revenue,
      MAX(COALESCE((SELECT MAX(created_at) FROM inquiries WHERE customer_id=c.id),''), COALESCE((SELECT MAX(created_at) FROM leads WHERE customer_id=c.id),'')) last_at
    FROM customers c ${where} ORDER BY c.id DESC LIMIT 300`;
  const list = rowsOf(await (all ? db.prepare(listSql) : db.prepare(listSql).bind(P.from, P.to)).all());

  const hosts = rowsOf(rs[9]).map((h) => ({ ...h, venues: parseJson(h.venues, []) }));
  const hc = { total: hosts.length, active: hosts.filter((h) => h.status === 'active').length, invited: hosts.filter((h) => h.status === 'invited').length, paused: hosts.filter((h) => h.status === 'paused').length };

  return {
    ok: true, from: P.from, to: P.to, prev: { from: P.prevFrom, to: P.prevTo, new_customers: one(rs[2]).n },
    total: one(rs[0]).n, new_customers: one(rs[1]).n,
    with_inquiry: one(rs[3]).n, repeat: one(rs[4]).n, booked: one(rs[5]).n, lead_only: one(rs[6]).n,
    monthly: rowsOf(rs[7]),
    first_touch: Object.entries(first).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n),
    inquiries: one(rs[11]).n, leads: one(rs[12]).n, partner_apps: one(rs[13]).n,
    list, all,
    hosts, host_counts: hc, admins: one(rs[10]).n,
  };
}

// 요약 화면에 더하는 방문·행동·고객 숫자
export async function kpiBehavior(env, from, to, prevFrom, prevTo) {
  const [cur, prev, nc, pnc] = await Promise.all([
    trafficCounts(env.DB, from, to),
    trafficCounts(env.DB, prevFrom, prevTo),
    env.DB.prepare(`SELECT COUNT(*) n FROM customers WHERE ${KST('created_at')} BETWEEN ? AND ?`).bind(from, to).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM customers WHERE ${KST('created_at')} BETWEEN ? AND ?`).bind(prevFrom, prevTo).first(),
  ]);
  return { cur: { ...cur, new_customers: nc.n }, prev: { ...prev, new_customers: pnc.n } };
}

export async function handleKpi({ env, url, p, content }) {
  const P = period(url.searchParams);
  if (p === '/kpi/traffic') return json(await traffic(env, P));
  if (p === '/kpi/pages') return json(await pages(env, P));
  if (p === '/kpi/content') return json(await popular(env, content, P));
  if (p === '/kpi/members') return json(await members(env, P, url.searchParams));
  return null;
}
