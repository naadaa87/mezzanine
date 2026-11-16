// 호스트센터 API — 메자닌에 공간을 맡긴 건물주(공간 파트너)용
// 자기 건물(지점)의 예약 일정, 매출, 정산, 공지, 메시지만 볼 수 있고 고객 개인정보는 보이지 않습니다.
import { json, fail, readJson, clip, nowIso, kstDate, clientIp, parseJson, sha256hex } from './util.js';
import { ensureSchema, getContent, rateLimit } from './db.js';
import { hashPassword, verifyPassword, validPassword, createHostSession, destroyHostSession, currentHost, sameOrigin } from './auth.js';
import { notify } from './notify.js';
import { isMonth, monthRange, thisMonth, bookingsOverlapping, venueSummary, monthlyTrend, publicEventLabel } from './metrics.js';
import { SETTLE_STATUS, BOOKING_STATUS } from './seed.js';

const hostVenues = (host, content) => parseJson(host.venues, []).filter((s) => content.venues.some((v) => v.slug === s));

export async function inviteLookup(env, code) {
  if (!code || code.length < 16) return null;
  const row = await env.DB.prepare('SELECT * FROM hosts WHERE invite_hash=?').bind(await sha256hex(code)).first();
  if (!row || !row.invite_expires || row.invite_expires < nowIso()) return null;
  return row;
}

export async function handleHostApi(request, env, ctx, url) {
  const p = url.pathname.replace(/^\/api\/host/, '') || '/';
  const method = request.method;
  try {
    await ensureSchema(env);
  } catch {
    return fail(503, '잠시 후 다시 시도해 주세요.');
  }
  if (method !== 'GET' && !sameOrigin(request)) return fail(403, '허용되지 않은 요청입니다.');
  const ip = clientIp(request);
  const content = await getContent(env);
  const vName = (slug) => content.venues.find((v) => v.slug === slug)?.name || slug;

  // ── 로그인 전 ──
  if (p === '/state' && method === 'GET') {
    const host = await currentHost(env, request);
    return json({ ok: true, host: host ? publicHost(host, content) : null, brand: content.settings.brand });
  }

  if (p === '/invite' && method === 'GET') {
    if (!(await rateLimit(env, `hinv:${ip}`, 20, 600))) return fail(429, '잠시 후 다시 시도해 주세요.');
    const row = await inviteLookup(env, clip(url.searchParams.get('code'), 80));
    if (!row) return fail(404, '초대 링크가 만료됐거나 올바르지 않습니다. 메자닌 담당자에게 새 링크를 요청해 주세요.');
    return json({ ok: true, name: row.name, company: row.company, venues: parseJson(row.venues, []).map(vName), login: row.login || '' });
  }

  if (p === '/join' && method === 'POST') {
    if (!(await rateLimit(env, `hjoin:${ip}`, 10, 600))) return fail(429, '잠시 후 다시 시도해 주세요.');
    const b = await readJson(request);
    const row = await inviteLookup(env, clip(b.code, 80));
    if (!row) return fail(404, '초대 링크가 만료됐거나 올바르지 않습니다.');
    const login = clip(b.login, 40).toLowerCase();
    if (!/^[a-z0-9._@-]{3,40}$/.test(login)) return fail(400, '아이디는 영문 소문자·숫자 3자 이상으로 정해 주세요.');
    if (!validPassword(b.password)) return fail(400, '비밀번호는 8자 이상으로 정해 주세요.');
    const dup = await env.DB.prepare('SELECT id FROM hosts WHERE login=? AND id<>?').bind(login, row.id).first();
    if (dup) return fail(409, '이미 쓰고 있는 아이디입니다. 다른 아이디를 정해 주세요.');
    const { hash, salt } = await hashPassword(b.password);
    await env.DB.prepare(`UPDATE hosts SET login=?, pass_hash=?, pass_salt=?, status='active', invite_hash=NULL, invite_expires=NULL WHERE id=?`)
      .bind(login, hash, salt, row.id).run();
    const cookie = await createHostSession(env, request, row.id);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (p === '/login' && method === 'POST') {
    if (!(await rateLimit(env, `hlogin:${ip}`, 10, 600))) return fail(429, '로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.');
    const b = await readJson(request);
    const row = await env.DB.prepare('SELECT * FROM hosts WHERE login=?').bind(clip(b.login, 40).toLowerCase()).first();
    if (!row || !row.pass_hash || !(await verifyPassword(String(b.password || ''), row.pass_hash, row.pass_salt)))
      return fail(401, '아이디 또는 비밀번호가 맞지 않습니다.');
    if (row.status !== 'active') return fail(403, '지금은 이용이 멈춘 계정입니다. 메자닌 담당자에게 문의해 주세요.');
    const cookie = await createHostSession(env, request, row.id);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (p === '/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': await destroyHostSession(env, request) });
  }

  // ── 여기부터 로그인 필요 ──
  const host = await currentHost(env, request);
  if (!host) return fail(401, '로그인이 필요합니다.');
  const venues = hostVenues(host, content);
  const today = kstDate();

  if (p === '/dashboard' && method === 'GET') {
    const month = isMonth(url.searchParams.get('month')) ? url.searchParams.get('month') : thisMonth();
    const r = monthRange(month);
    const ahead = new Date(Date.parse(today) + 120 * 86400000).toISOString().slice(0, 10);
    const [monthRows, upcomingRows, trend, settles] = await Promise.all([
      bookingsOverlapping(env, venues, r.from, r.to),
      bookingsOverlapping(env, venues, today, ahead),
      monthlyTrend(env, venues, month, 12),
      env.DB.prepare('SELECT * FROM settlements WHERE host_id=? AND status<>\'draft\' ORDER BY month DESC, venue LIMIT 24').bind(host.id).all(),
    ]);
    const sum = venueSummary(monthRows, venues, r.from, r.to);
    const notices = (content.host_notices || []).filter((n) => !n.venues?.length || n.venues.some((v) => venues.includes(v)))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
    return json({
      ok: true,
      month, range: r,
      venues: venues.map((slug) => ({ slug, name: vName(slug), ...sum[slug] })),
      upcoming: upcomingRows.filter((b) => b.end_date >= today).slice(0, 12).map(publicBooking),
      month_bookings: monthRows.filter((b) => b.kind === 'booking').map(publicBooking),
      trend,
      settlements: settles.results.map(publicSettlement(vName)),
      notices,
      unread: host.unread_host || 0,
    });
  }

  if (p === '/calendar' && method === 'GET') {
    const month = isMonth(url.searchParams.get('month')) ? url.searchParams.get('month') : thisMonth();
    const r = monthRange(month);
    const rows = await bookingsOverlapping(env, venues, r.from, r.to);
    return json({ ok: true, month, items: rows.map(publicBooking) });
  }

  if (p === '/settlements' && method === 'GET') {
    const rs = await env.DB.prepare('SELECT * FROM settlements WHERE host_id=? AND status<>\'draft\' ORDER BY month DESC, venue').bind(host.id).all();
    return json({ ok: true, items: rs.results.map(publicSettlement(vName)) });
  }

  if (p === '/messages' && method === 'GET') {
    const rs = await env.DB.prepare('SELECT sender, author, body, created_at FROM host_messages WHERE host_id=? ORDER BY id').bind(host.id).all();
    if (host.unread_host) await env.DB.prepare('UPDATE hosts SET unread_host=0 WHERE id=?').bind(host.id).run();
    return json({ ok: true, items: rs.results });
  }

  if (p === '/messages' && method === 'POST') {
    const b = await readJson(request);
    const body = clip(b.body, 2000);
    if (!body) return fail(400, '메시지 내용을 적어 주세요.');
    if (!(await rateLimit(env, `hmsg:${host.id}`, 30, 600))) return fail(429, '메시지를 너무 자주 보내고 있습니다.');
    const now = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO host_messages(host_id, sender, author, body, created_at) VALUES(?,'host',?,?,?)`).bind(host.id, host.name || host.login, body, now),
      env.DB.prepare('UPDATE hosts SET unread_admin=unread_admin+1 WHERE id=?').bind(host.id),
    ]);
    notify(env, ctx, content.settings, `[메자닌] 호스트 메시지 — ${host.name || host.login}${host.company ? ` (${host.company})` : ''}\n${clip(body, 200)}`);
    return json({ ok: true });
  }

  if (p === '/password' && method === 'POST') {
    const b = await readJson(request);
    const row = await env.DB.prepare('SELECT pass_hash, pass_salt FROM hosts WHERE id=?').bind(host.id).first();
    if (!(await verifyPassword(String(b.current || ''), row.pass_hash, row.pass_salt))) return fail(400, '지금 비밀번호가 맞지 않습니다.');
    if (!validPassword(b.next)) return fail(400, '새 비밀번호는 8자 이상으로 정해 주세요.');
    const { hash, salt } = await hashPassword(b.next);
    await env.DB.prepare('UPDATE hosts SET pass_hash=?, pass_salt=? WHERE id=?').bind(hash, salt, host.id).run();
    return json({ ok: true });
  }

  return fail(404, '없는 주소입니다.');
}

function publicHost(h, content) {
  const venues = parseJson(h.venues, []).filter((s) => content.venues.some((v) => v.slug === s));
  return {
    name: h.name, company: h.company, login: h.login, share_rate: h.share_rate, unread: h.unread_host || 0,
    venues: venues.map((slug) => {
      const v = content.venues.find((x) => x.slug === slug);
      return { slug, name: v.name, color: v.color, address: v.address };
    }),
  };
}

function publicBooking(b) {
  return {
    venue: b.venue, label: publicEventLabel(b), zones: parseJson(b.zones, []), start_date: b.start_date, end_date: b.end_date,
    start_time: b.start_time, end_time: b.end_time, kind: b.kind, status: b.status,
    status_label: b.kind === 'block' ? '예약 불가' : BOOKING_STATUS[b.status] || b.status,
    amount: b.kind === 'booking' && (b.status === 'confirmed' || b.status === 'done') ? Number(b.amount || 0) : null,
  };
}

const publicSettlement = (vName) => (s) => ({
  id: s.id, month: s.month, venue: s.venue, venue_name: vName(s.venue), bookings: s.bookings, gross: s.gross, share_rate: s.share_rate,
  host_amount: s.host_amount, adjust: s.adjust, payout: s.payout, status: s.status, status_label: SETTLE_STATUS[s.status] || s.status,
  memo: s.memo, paid_at: s.paid_at,
});
