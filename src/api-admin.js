import { json, fail, readJson, clip, normPhone, isDate, isTime, toInt, nowIso, kstDate, clientIp, parseJson, csv } from './util.js';
import { ensureSchema, getContent, setContent, bustContent, logActivity, rateLimit } from './db.js';
import { hashPassword, verifyPassword, validPassword, createSession, destroySession, currentAdmin, sameOrigin } from './auth.js';
import { createInquiry } from './api-public.js';
import { DEFAULTS, EVENT_TYPES, OPTION_LIST, BUDGETS, INQUIRY_STATUS, BOOKING_STATUS, QUOTE_STATUS } from './seed.js';

const CONTENT_KEYS = { settings: 'object', venues: 'array', cases: 'array', faqs: 'array', guide: 'object', rates: 'array' };

function calcQuote(itemsIn, discountIn, vatMode) {
  const items = (Array.isArray(itemsIn) ? itemsIn : []).slice(0, 60).map((it) => ({
    name: clip(it.name, 80),
    desc: clip(it.desc, 200),
    qty: Math.max(0, Number(it.qty) || 0),
    unit: clip(it.unit, 10),
    price: toInt(it.price, 0),
  })).filter((it) => it.name);
  const subtotal = Math.round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const discount = Math.min(Math.max(0, toInt(discountIn, 0)), subtotal);
  const base = subtotal - discount;
  const mode = ['add', 'incl', 'none'].includes(vatMode) ? vatMode : 'add';
  const vat = mode === 'add' ? Math.round(base * 0.1) : mode === 'incl' ? Math.round(base / 11) : 0;
  const total = mode === 'add' ? base + vat : base;
  return { items, subtotal, discount, vat, total, vat_mode: mode };
}

const inquiryRow = (r) => ({ ...r, zones: parseJson(r.zones, []), options: parseJson(r.options, []), access_token: undefined });
const bookingRow = (r) => ({ ...r, zones: parseJson(r.zones, []) });
const quoteRow = (r) => ({ ...r, items: parseJson(r.items, []) });

async function conflictsFor(env, b, selfId = 0) {
  if (b.status === 'cancelled') return [];
  const rs = await env.DB.prepare(
    `SELECT id, title, start_date, end_date, status, kind, zones FROM bookings
     WHERE venue=? AND id<>? AND status IN ('hold','confirmed') AND end_date>=? AND start_date<=?`
  ).bind(b.venue, selfId, b.start_date, b.end_date).all();
  return rs.results.map(bookingRow);
}

function bookingInput(b, content) {
  if (!content.venues.some((v) => v.slug === b.venue)) throw new Error('지점을 선택해 주세요.');
  if (!isDate(b.start_date)) throw new Error('시작일을 입력해 주세요.');
  const end = isDate(b.end_date) && b.end_date >= b.start_date ? b.end_date : b.start_date;
  return {
    kind: b.kind === 'block' ? 'block' : 'booking',
    venue: b.venue,
    zones: JSON.stringify(Array.isArray(b.zones) ? b.zones.slice(0, 20).map((z) => clip(z, 40)) : []),
    title: clip(b.title, 100) || (b.kind === 'block' ? '예약 불가' : '예약'),
    start_date: b.start_date,
    end_date: end,
    start_time: isTime(b.start_time) ? b.start_time : '',
    end_time: isTime(b.end_time) ? b.end_time : '',
    status: Object.keys(BOOKING_STATUS).includes(b.status) ? b.status : 'hold',
    amount: toInt(b.amount, 0),
    deposit_amount: toInt(b.deposit_amount, 0),
    deposit_paid: b.deposit_paid ? 1 : 0,
    balance_paid: b.balance_paid ? 1 : 0,
    memo: clip(b.memo, 2000),
  };
}

export async function handleAdminApi(request, env, ctx, url) {
  const p = url.pathname.replace(/^\/api\/admin/, '') || '/';
  const method = request.method;
  try {
    await ensureSchema(env);
  } catch {
    return fail(503, '데이터베이스(D1)가 아직 연결되지 않았습니다. Cloudflare에서 DB 바인딩을 확인해 주세요.');
  }
  if (method !== 'GET' && !sameOrigin(request)) return fail(403, '허용되지 않은 요청입니다.');
  const ip = clientIp(request);
  const body = async () => readJson(request);

  // ── 로그인 전 ───────────────────────────────────────────────
  if (p === '/state' && method === 'GET') {
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM admins').first();
    const admin = await currentAdmin(env, request);
    return json({ ok: true, setup_needed: n.n === 0, admin });
  }

  if (p === '/setup' && method === 'POST') {
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM admins').first();
    if (n.n > 0) return fail(403, '이미 관리자 계정이 있습니다. 로그인해 주세요.');
    const b = await body();
    const login = clip(b.login, 40).toLowerCase();
    if (!/^[a-z0-9._@-]{3,40}$/.test(login)) return fail(400, '아이디는 영문 소문자·숫자 3자 이상으로 정해 주세요.');
    if (!validPassword(b.password)) return fail(400, '비밀번호는 8자 이상으로 정해 주세요.');
    const { hash, salt } = await hashPassword(b.password);
    const r = await env.DB.prepare(`INSERT INTO admins(login, name, pass_hash, pass_salt, role, created_at) VALUES(?,?,?,?,'owner',?)`)
      .bind(login, clip(b.name, 40) || '관리자', hash, salt, nowIso()).run();
    const cookie = await createSession(env, request, r.meta.last_row_id);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (p === '/login' && method === 'POST') {
    if (!(await rateLimit(env, `login:${ip}`, 10, 600))) return fail(429, '로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.');
    const b = await body();
    const row = await env.DB.prepare('SELECT * FROM admins WHERE login=?').bind(clip(b.login, 40).toLowerCase()).first();
    if (!row || !(await verifyPassword(String(b.password || ''), row.pass_hash, row.pass_salt)))
      return fail(401, '아이디 또는 비밀번호가 맞지 않습니다.');
    const cookie = await createSession(env, request, row.id);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (p === '/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': await destroySession(env, request) });
  }

  // ── 여기부터 로그인 필요 ─────────────────────────────────────
  const admin = await currentAdmin(env, request);
  if (!admin) return fail(401, '로그인이 필요합니다.');
  const actor = admin.name || admin.login;
  const content = await getContent(env, true);
  const today = kstDate();
  let m;

  if (p === '/bootstrap' && method === 'GET') {
    return json({
      ok: true, admin,
      content: { settings: content.settings, venues: content.venues, cases: content.cases, faqs: content.faqs, guide: content.guide, rates: content.rates },
      enums: { EVENT_TYPES, OPTION_LIST, BUDGETS, INQUIRY_STATUS, BOOKING_STATUS, QUOTE_STATUS },
    });
  }

  if (p === '/dashboard' && method === 'GET') {
    const monthStart = today.slice(0, 8) + '01';
    const monthEnd = today.slice(0, 8) + '31';
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const rs = await env.DB.batch([
      env.DB.prepare('SELECT status, COUNT(*) n FROM inquiries GROUP BY status'),
      env.DB.prepare('SELECT COUNT(*) n FROM inquiries WHERE created_at>=?').bind(weekAgo),
      env.DB.prepare('SELECT COALESCE(SUM(unread_admin),0) n FROM inquiries'),
      env.DB.prepare(`SELECT b.*, i.code FROM bookings b LEFT JOIN inquiries i ON i.id=b.inquiry_id
                      WHERE b.status IN ('hold','confirmed') AND b.end_date>=? ORDER BY b.start_date LIMIT 10`).bind(today),
      env.DB.prepare(`SELECT COALESCE(SUM(amount),0) amount, COUNT(*) n FROM bookings
                      WHERE kind='booking' AND status IN ('confirmed','done') AND start_date BETWEEN ? AND ?`).bind(monthStart, monthEnd),
      env.DB.prepare(`SELECT id, code, kind, venue, name, company, event_type, date_start, date_end, status, unread_admin, created_at
                      FROM inquiries ORDER BY id DESC LIMIT 8`),
      env.DB.prepare('SELECT venue, COUNT(*) n FROM inquiries GROUP BY venue'),
      env.DB.prepare(`SELECT COUNT(*) n FROM quotes WHERE status='sent'`),
      env.DB.prepare(`SELECT substr(datetime(created_at,'+9 hours'),1,7) m, COUNT(*) n FROM inquiries GROUP BY m ORDER BY m DESC LIMIT 6`),
      env.DB.prepare(`SELECT COALESCE(SUM(amount),0) amount FROM bookings WHERE kind='booking' AND status='hold' AND end_date>=?`).bind(today),
    ]);
    const byStatus = {};
    for (const r of rs[0].results) byStatus[r.status] = r.n;
    return json({
      ok: true,
      byStatus, week_new: rs[1].results[0].n, unread: rs[2].results[0].n,
      upcoming: rs[3].results.map(bookingRow),
      month: rs[4].results[0], recent: rs[5].results, byVenue: rs[6].results,
      quotes_waiting: rs[7].results[0].n, monthly: rs[8].results.reverse(), hold_amount: rs[9].results[0].amount,
    });
  }

  // ── 문의 ───────────────────────────────────────────────────
  if (p === '/inquiries' && method === 'GET') {
    const q = url.searchParams;
    const where = [];
    const args = [];
    if (q.get('status')) { where.push('status=?'); args.push(q.get('status')); }
    if (q.get('venue')) { where.push('venue=?'); args.push(q.get('venue')); }
    if (q.get('kind')) { where.push('kind=?'); args.push(q.get('kind')); }
    if (q.get('q')) {
      const s = `%${q.get('q').trim()}%`;
      where.push('(code LIKE ? OR name LIKE ? OR company LIKE ? OR phone LIKE ? OR event_name LIKE ?)');
      args.push(s, s, s, s, s);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(toInt(q.get('limit'), 50), 200);
    const offset = Math.max(toInt(q.get('offset'), 0), 0);
    const [rows, total] = await env.DB.batch([
      env.DB.prepare(`SELECT id, code, kind, venue, zones, event_type, event_name, date_start, date_end, headcount, name, company, phone,
                      status, source, unread_admin, created_at, updated_at FROM inquiries ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset),
      env.DB.prepare(`SELECT COUNT(*) n FROM inquiries ${w}`).bind(...args),
    ]);
    return json({ ok: true, items: rows.results.map((r) => ({ ...r, zones: parseJson(r.zones, []) })), total: total.results[0].n });
  }

  if (p === '/inquiries' && method === 'POST') {
    const b = await body();
    try {
      const r = await createInquiry(env, ctx, content, { ...b, agree: true }, { source: clip(b.source, 20) || 'manual', actor });
      return json({ ok: true, id: r.id, code: r.code });
    } catch (e) {
      return fail(400, e.message);
    }
  }

  if ((m = p.match(/^\/inquiries\/(\d+)$/))) {
    const id = toInt(m[1]);
    const row = await env.DB.prepare('SELECT * FROM inquiries WHERE id=?').bind(id).first();
    if (!row) return fail(404, '문의를 찾지 못했습니다.');

    if (method === 'GET') {
      const rs = await env.DB.batch([
        env.DB.prepare('SELECT * FROM messages WHERE inquiry_id=? ORDER BY id').bind(id),
        env.DB.prepare('SELECT * FROM quotes WHERE inquiry_id=? ORDER BY id DESC').bind(id),
        env.DB.prepare('SELECT * FROM bookings WHERE inquiry_id=? ORDER BY id DESC').bind(id),
        env.DB.prepare('SELECT * FROM activity WHERE inquiry_id=? ORDER BY id DESC LIMIT 40').bind(id),
        env.DB.prepare('SELECT * FROM customers WHERE id=?').bind(row.customer_id),
        env.DB.prepare('UPDATE inquiries SET unread_admin=0 WHERE id=?').bind(id),
      ]);
      return json({
        ok: true,
        inquiry: inquiryRow(row),
        link: `/my?code=${encodeURIComponent(row.code)}&t=${encodeURIComponent(row.access_token)}`,
        messages: rs[0].results, quotes: rs[1].results.map(quoteRow), bookings: rs[2].results.map(bookingRow),
        activity: rs[3].results, customer: rs[4].results[0] || null,
      });
    }

    if (method === 'PATCH') {
      const b = await body();
      const set = [];
      const args = [];
      const put = (k, v) => { set.push(`${k}=?`); args.push(v); };
      if (b.status !== undefined && INQUIRY_STATUS[b.status] && b.status !== row.status) {
        put('status', b.status);
        await logActivity(env, { inquiry_id: id, actor, action: '상태 변경', detail: `${INQUIRY_STATUS[row.status]} → ${INQUIRY_STATUS[b.status]}` });
      }
      if (b.assignee !== undefined) put('assignee', clip(b.assignee, 40));
      if (b.internal_memo !== undefined) put('internal_memo', clip(b.internal_memo, 4000));
      if (b.venue !== undefined && (b.venue === '' || content.venues.some((v) => v.slug === b.venue))) put('venue', b.venue);
      if (b.zones !== undefined) put('zones', JSON.stringify(Array.isArray(b.zones) ? b.zones.slice(0, 20).map((z) => clip(z, 40)) : []));
      if (b.event_type !== undefined) put('event_type', clip(b.event_type, 30));
      if (b.event_name !== undefined) put('event_name', clip(b.event_name, 80));
      if (b.date_start !== undefined) put('date_start', isDate(b.date_start) ? b.date_start : '');
      if (b.date_end !== undefined) put('date_end', isDate(b.date_end) ? b.date_end : '');
      if (b.time_start !== undefined) put('time_start', isTime(b.time_start) ? b.time_start : '');
      if (b.time_end !== undefined) put('time_end', isTime(b.time_end) ? b.time_end : '');
      if (b.headcount !== undefined) put('headcount', toInt(b.headcount, 0) || null);
      if (!set.length) return json({ ok: true });
      put('updated_at', nowIso());
      await env.DB.prepare(`UPDATE inquiries SET ${set.join(', ')} WHERE id=?`).bind(...args, id).run();
      return json({ ok: true });
    }

    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM messages WHERE inquiry_id=?').bind(id),
        env.DB.prepare('DELETE FROM quotes WHERE inquiry_id=?').bind(id),
        env.DB.prepare('DELETE FROM activity WHERE inquiry_id=?').bind(id),
        env.DB.prepare('UPDATE bookings SET inquiry_id=NULL WHERE inquiry_id=?').bind(id),
        env.DB.prepare('DELETE FROM inquiries WHERE id=?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  if ((m = p.match(/^\/inquiries\/(\d+)\/messages$/)) && method === 'POST') {
    const id = toInt(m[1]);
    const b = await body();
    const text = clip(b.body, 3000);
    if (!text) return fail(400, '메시지 내용을 적어 주세요.');
    const row = await env.DB.prepare('SELECT id, status FROM inquiries WHERE id=?').bind(id).first();
    if (!row) return fail(404, '문의를 찾지 못했습니다.');
    const now = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO messages(inquiry_id, sender, author, body, created_at) VALUES(?,'admin',?,?,?)`).bind(id, actor, text, now),
      env.DB.prepare(`UPDATE inquiries SET updated_at=?, unread_admin=0, status=CASE WHEN status='new' THEN 'consulting' ELSE status END WHERE id=?`).bind(now, id),
    ]);
    return json({ ok: true });
  }

  // ── 견적 ───────────────────────────────────────────────────
  if ((m = p.match(/^\/inquiries\/(\d+)\/quotes$/)) && method === 'POST') {
    const id = toInt(m[1]);
    const inq = await env.DB.prepare('SELECT id, code FROM inquiries WHERE id=?').bind(id).first();
    if (!inq) return fail(404, '문의를 찾지 못했습니다.');
    const b = await body();
    const c = calcQuote(b.items, b.discount, b.vat_mode);
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM quotes WHERE inquiry_id=?').bind(id).first();
    const number = `${inq.code.replace(/^MZ-/, 'Q-')}-${n.n + 1}`;
    const now = nowIso();
    const r = await env.DB.prepare(
      `INSERT INTO quotes(inquiry_id, number, title, items, subtotal, discount, vat, total, vat_mode, valid_until, note, status, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`
    ).bind(id, number, clip(b.title, 100) || '대관 견적서', JSON.stringify(c.items), c.subtotal, c.discount, c.vat, c.total, c.vat_mode,
      isDate(b.valid_until) ? b.valid_until : '', clip(b.note, 2000), now, now).run();
    await logActivity(env, { inquiry_id: id, actor, action: '견적 작성', detail: number });
    return json({ ok: true, id: r.meta.last_row_id, number });
  }

  if (p === '/quotes' && method === 'GET') {
    const st = url.searchParams.get('status');
    const rs = await env.DB.prepare(
      `SELECT q.*, i.code, i.name, i.company, i.venue FROM quotes q JOIN inquiries i ON i.id=q.inquiry_id
       ${st ? 'WHERE q.status=?' : ''} ORDER BY q.id DESC LIMIT 200`
    ).bind(...(st ? [st] : [])).all();
    return json({ ok: true, items: rs.results.map(quoteRow) });
  }

  if ((m = p.match(/^\/quotes\/(\d+)$/))) {
    const id = toInt(m[1]);
    const q = await env.DB.prepare('SELECT * FROM quotes WHERE id=?').bind(id).first();
    if (!q) return fail(404, '견적을 찾지 못했습니다.');
    if (method === 'PATCH') {
      const b = await body();
      const now = nowIso();
      if (b.items !== undefined || b.discount !== undefined || b.vat_mode !== undefined || b.title !== undefined || b.note !== undefined || b.valid_until !== undefined) {
        if (q.status === 'accepted') return fail(400, '고객이 수락한 견적은 수정할 수 없습니다. 새 견적을 만들어 주세요.');
        const c = calcQuote(b.items ?? parseJson(q.items, []), b.discount ?? q.discount, b.vat_mode ?? q.vat_mode);
        await env.DB.prepare(
          `UPDATE quotes SET title=?, items=?, subtotal=?, discount=?, vat=?, total=?, vat_mode=?, valid_until=?, note=?, updated_at=? WHERE id=?`
        ).bind(clip(b.title ?? q.title, 100), JSON.stringify(c.items), c.subtotal, c.discount, c.vat, c.total, c.vat_mode,
          b.valid_until !== undefined ? (isDate(b.valid_until) ? b.valid_until : '') : q.valid_until, clip(b.note ?? q.note, 2000), now, id).run();
      }
      if (b.status && QUOTE_STATUS[b.status] && b.status !== q.status) {
        const stmts = [env.DB.prepare(`UPDATE quotes SET status=?, updated_at=?, sent_at=CASE WHEN ?='sent' THEN ? ELSE sent_at END WHERE id=?`).bind(b.status, now, b.status, now, id)];
        if (b.status === 'sent') {
          stmts.push(
            env.DB.prepare(`INSERT INTO messages(inquiry_id, sender, author, body, created_at) VALUES(?,'system','',?,?)`).bind(q.inquiry_id, `견적서를 보냈습니다. 아래 "견적"에서 확인해 주세요. (${q.number})`, now),
            env.DB.prepare(`UPDATE inquiries SET updated_at=?, status=CASE WHEN status IN ('new','consulting') THEN 'quoted' ELSE status END WHERE id=?`).bind(now, q.inquiry_id)
          );
        }
        await env.DB.batch(stmts);
        await logActivity(env, { inquiry_id: q.inquiry_id, actor, action: `견적 ${QUOTE_STATUS[b.status]}`, detail: q.number });
      }
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM quotes WHERE id=?').bind(id).run();
      await logActivity(env, { inquiry_id: q.inquiry_id, actor, action: '견적 삭제', detail: q.number });
      return json({ ok: true });
    }
  }

  // ── 예약·일정 ───────────────────────────────────────────────
  if (p === '/bookings' && method === 'GET') {
    const q = url.searchParams;
    const from = isDate(q.get('from')) ? q.get('from') : '0000-01-01';
    const to = isDate(q.get('to')) ? q.get('to') : '9999-12-31';
    const args = [from, to];
    let w = 'b.end_date>=? AND b.start_date<=?';
    if (q.get('venue')) { w += ' AND b.venue=?'; args.push(q.get('venue')); }
    if (q.get('status')) { w += ' AND b.status=?'; args.push(q.get('status')); }
    const rs = await env.DB.prepare(
      `SELECT b.*, i.code, c.name customer_name, c.company customer_company, c.phone customer_phone
       FROM bookings b LEFT JOIN inquiries i ON i.id=b.inquiry_id LEFT JOIN customers c ON c.id=b.customer_id
       WHERE ${w} ORDER BY b.start_date, b.id LIMIT 500`
    ).bind(...args).all();
    return json({ ok: true, items: rs.results.map(bookingRow) });
  }

  if (p === '/bookings' && method === 'POST') {
    const b = await body();
    let v;
    try { v = bookingInput(b, content); } catch (e) { return fail(400, e.message); }
    let inquiryId = toInt(b.inquiry_id, 0) || null;
    let customerId = toInt(b.customer_id, 0) || null;
    let inq = null;
    if (inquiryId) {
      inq = await env.DB.prepare('SELECT id, customer_id, status FROM inquiries WHERE id=?').bind(inquiryId).first();
      if (!inq) inquiryId = null; else customerId = customerId || inq.customer_id;
    }
    const now = nowIso();
    const r = await env.DB.prepare(
      `INSERT INTO bookings(inquiry_id, customer_id, quote_id, kind, venue, zones, title, start_date, end_date, start_time, end_time,
         status, amount, deposit_amount, deposit_paid, balance_paid, memo, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(inquiryId, customerId, toInt(b.quote_id, 0) || null, v.kind, v.venue, v.zones, v.title, v.start_date, v.end_date, v.start_time, v.end_time,
      v.status, v.amount, v.deposit_amount, v.deposit_paid, v.balance_paid, v.memo, now, now).run();
    const id = r.meta.last_row_id;
    if (inq) await syncInquiryFromBooking(env, inq, v, actor, id);
    return json({ ok: true, id, conflicts: await conflictsFor(env, v, id) });
  }

  if ((m = p.match(/^\/bookings\/(\d+)$/))) {
    const id = toInt(m[1]);
    const row = await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();
    if (!row) return fail(404, '예약을 찾지 못했습니다.');
    if (method === 'PATCH') {
      const b = await body();
      let v;
      try { v = bookingInput({ ...bookingRow(row), ...b }, content); } catch (e) { return fail(400, e.message); }
      await env.DB.prepare(
        `UPDATE bookings SET kind=?, venue=?, zones=?, title=?, start_date=?, end_date=?, start_time=?, end_time=?, status=?, amount=?,
           deposit_amount=?, deposit_paid=?, balance_paid=?, memo=?, updated_at=? WHERE id=?`
      ).bind(v.kind, v.venue, v.zones, v.title, v.start_date, v.end_date, v.start_time, v.end_time, v.status, v.amount,
        v.deposit_amount, v.deposit_paid, v.balance_paid, v.memo, nowIso(), id).run();
      if (row.inquiry_id && v.status !== row.status) {
        const inq = await env.DB.prepare('SELECT id, status FROM inquiries WHERE id=?').bind(row.inquiry_id).first();
        if (inq) await syncInquiryFromBooking(env, inq, v, actor, id);
      }
      return json({ ok: true, conflicts: await conflictsFor(env, v, id) });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM bookings WHERE id=?').bind(id).run();
      return json({ ok: true });
    }
  }

  // ── 고객 ───────────────────────────────────────────────────
  if (p === '/customers' && method === 'GET') {
    const s = (url.searchParams.get('q') || '').trim();
    const like = `%${s}%`;
    const rs = await env.DB.prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM inquiries i WHERE i.customer_id=c.id) inquiry_count,
         (SELECT COUNT(*) FROM bookings b WHERE b.customer_id=c.id AND b.kind='booking' AND b.status IN ('confirmed','done')) booking_count,
         (SELECT COALESCE(SUM(amount),0) FROM bookings b WHERE b.customer_id=c.id AND b.kind='booking' AND b.status IN ('confirmed','done')) total_amount,
         (SELECT MAX(created_at) FROM inquiries i WHERE i.customer_id=c.id) last_inquiry_at
       FROM customers c
       ${s ? 'WHERE c.name LIKE ? OR c.company LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.tags LIKE ?' : ''}
       ORDER BY c.updated_at DESC LIMIT 300`
    ).bind(...(s ? [like, like, like, like, like] : [])).all();
    return json({ ok: true, items: rs.results });
  }

  if ((m = p.match(/^\/customers\/(\d+)$/))) {
    const id = toInt(m[1]);
    const c = await env.DB.prepare('SELECT * FROM customers WHERE id=?').bind(id).first();
    if (!c) return fail(404, '고객을 찾지 못했습니다.');
    if (method === 'GET') {
      const rs = await env.DB.batch([
        env.DB.prepare('SELECT id, code, kind, venue, event_type, event_name, date_start, date_end, status, created_at FROM inquiries WHERE customer_id=? ORDER BY id DESC').bind(id),
        env.DB.prepare('SELECT * FROM bookings WHERE customer_id=? ORDER BY start_date DESC').bind(id),
      ]);
      return json({ ok: true, customer: c, inquiries: rs[0].results, bookings: rs[1].results.map(bookingRow) });
    }
    if (method === 'PATCH') {
      const b = await body();
      const phone = b.phone !== undefined ? clip(b.phone, 30) : c.phone;
      await env.DB.prepare('UPDATE customers SET name=?, company=?, phone=?, phone_norm=?, email=?, tags=?, memo=?, updated_at=? WHERE id=?')
        .bind(clip(b.name ?? c.name, 40), clip(b.company ?? c.company, 80), phone, normPhone(phone), clip(b.email ?? c.email, 120),
          clip(b.tags ?? c.tags, 200), clip(b.memo ?? c.memo, 4000), nowIso(), id).run();
      return json({ ok: true });
    }
  }

  // ── 콘텐츠(지점·사례·FAQ·요금표·설정) ─────────────────────────
  if ((m = p.match(/^\/content\/([a-z]+)$/)) && CONTENT_KEYS[m[1]]) {
    const key = m[1];
    if (method === 'PUT') {
      const b = await readJson(request, 400_000);
      const v = b.value;
      const ok = CONTENT_KEYS[key] === 'array' ? Array.isArray(v) : v && typeof v === 'object' && !Array.isArray(v);
      if (!ok) return fail(400, '저장할 내용의 형식이 올바르지 않습니다.');
      if (key === 'venues' && !v.every((x) => x && /^[a-z0-9-]{2,30}$/.test(x.slug || '') && x.name)) return fail(400, '지점마다 주소용 영문 이름(slug)과 지점명이 필요합니다.');
      await setContent(env, key, v);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM content WHERE k=?').bind(key).run();
      bustContent();
      return json({ ok: true, value: DEFAULTS[key] });
    }
  }

  // ── 사진 ───────────────────────────────────────────────────
  if (p === '/media' && method === 'GET') {
    const q = url.searchParams;
    const rs = await env.DB.prepare('SELECT id, owner_type, owner_id, sort, caption, width, height, size FROM media WHERE owner_type=? AND owner_id=? ORDER BY sort, id')
      .bind(q.get('owner_type') || '', q.get('owner_id') || '').all();
    return json({ ok: true, items: rs.results });
  }

  if (p === '/media' && method === 'PUT') {
    const q = url.searchParams;
    const type = q.get('owner_type');
    const owner = clip(q.get('owner_id'), 60);
    const mime = (request.headers.get('content-type') || '').split(';')[0];
    if (!['venue', 'case', 'site'].includes(type) || !owner) return fail(400, '사진을 넣을 위치가 올바르지 않습니다.');
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(mime)) return fail(400, '이미지 파일만 올릴 수 있습니다.');
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 1_800_000) return fail(413, '사진 용량이 너무 큽니다. 다시 시도해 주세요.');
    if (buf.byteLength < 100) return fail(400, '사진 파일이 비어 있습니다.');
    const mx = await env.DB.prepare('SELECT COALESCE(MAX(sort),0) s FROM media WHERE owner_type=? AND owner_id=?').bind(type, owner).first();
    const r = await env.DB.prepare('INSERT INTO media(owner_type, owner_id, sort, caption, mime, width, height, size, data, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(type, owner, mx.s + 1, clip(q.get('caption'), 120), mime, toInt(q.get('w'), 0), toInt(q.get('h'), 0), buf.byteLength, buf, nowIso()).run();
    bustContent();
    return json({ ok: true, id: r.meta.last_row_id });
  }

  if (p === '/media/reorder' && method === 'POST') {
    const b = await body();
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => toInt(x)).filter(Boolean).slice(0, 300);
    if (ids.length) await env.DB.batch(ids.map((id, i) => env.DB.prepare('UPDATE media SET sort=? WHERE id=?').bind(i + 1, id)));
    bustContent();
    return json({ ok: true });
  }

  if ((m = p.match(/^\/media\/(\d+)$/))) {
    const id = toInt(m[1]);
    if (method === 'PATCH') {
      const b = await body();
      await env.DB.prepare('UPDATE media SET caption=? WHERE id=?').bind(clip(b.caption, 120), id).run();
      bustContent();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM media WHERE id=?').bind(id).run();
      bustContent();
      return json({ ok: true });
    }
  }

  // ── 관리자 계정 ─────────────────────────────────────────────
  if (p === '/admins' && method === 'GET') {
    const rs = await env.DB.prepare('SELECT id, login, name, role, created_at, last_login_at FROM admins ORDER BY id').all();
    return json({ ok: true, items: rs.results });
  }

  if (p === '/admins' && method === 'POST') {
    if (admin.role !== 'owner') return fail(403, '계정 추가는 대표 관리자만 할 수 있습니다.');
    const b = await body();
    const login = clip(b.login, 40).toLowerCase();
    if (!/^[a-z0-9._@-]{3,40}$/.test(login)) return fail(400, '아이디는 영문 소문자·숫자 3자 이상으로 정해 주세요.');
    if (!validPassword(b.password)) return fail(400, '비밀번호는 8자 이상으로 정해 주세요.');
    if (await env.DB.prepare('SELECT id FROM admins WHERE login=?').bind(login).first()) return fail(400, '이미 있는 아이디입니다.');
    const { hash, salt } = await hashPassword(b.password);
    await env.DB.prepare(`INSERT INTO admins(login, name, pass_hash, pass_salt, role, created_at) VALUES(?,?,?,?,'staff',?)`)
      .bind(login, clip(b.name, 40) || login, hash, salt, nowIso()).run();
    return json({ ok: true });
  }

  if ((m = p.match(/^\/admins\/(\d+)$/)) && method === 'DELETE') {
    if (admin.role !== 'owner') return fail(403, '계정 삭제는 대표 관리자만 할 수 있습니다.');
    const id = toInt(m[1]);
    if (id === admin.id) return fail(400, '지금 로그인한 계정은 삭제할 수 없습니다.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE admin_id=?').bind(id),
      env.DB.prepare('DELETE FROM admins WHERE id=?').bind(id),
    ]);
    return json({ ok: true });
  }

  if (p === '/password' && method === 'POST') {
    const b = await body();
    const row = await env.DB.prepare('SELECT * FROM admins WHERE id=?').bind(admin.id).first();
    if (!(await verifyPassword(String(b.current || ''), row.pass_hash, row.pass_salt))) return fail(400, '현재 비밀번호가 맞지 않습니다.');
    if (!validPassword(b.next)) return fail(400, '새 비밀번호는 8자 이상으로 정해 주세요.');
    const { hash, salt } = await hashPassword(b.next);
    await env.DB.prepare('UPDATE admins SET pass_hash=?, pass_salt=? WHERE id=?').bind(hash, salt, admin.id).run();
    return json({ ok: true });
  }

  // ── 내보내기(CSV) ───────────────────────────────────────────
  if (p === '/export' && method === 'GET') {
    const type = url.searchParams.get('type');
    const vn = (s) => content.venues.find((v) => v.slug === s)?.name || '';
    let rows;
    if (type === 'inquiries') {
      const rs = await env.DB.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT 5000').all();
      rows = [['접수번호', '접수일시', '구분', '상태', '지점', '공간', '행사 유형', '행사명', '시작일', '종료일', '시간', '인원', '예산', '요청 사항', '담당자', '회사·단체', '연락처', '이메일', '문의 내용', '내부 메모']];
      for (const r of rs.results)
        rows.push([r.code, r.created_at, r.kind === 'open_notify' ? '오픈 알림' : '대관', INQUIRY_STATUS[r.status] || r.status, vn(r.venue), parseJson(r.zones, []).join(' / '),
          r.event_type, r.event_name, r.date_start, r.date_end, [r.time_start, r.time_end].filter(Boolean).join('~'), r.headcount, r.budget,
          parseJson(r.options, []).join(' / '), r.name, r.company, r.phone, r.email, r.message, r.internal_memo]);
    } else if (type === 'bookings') {
      const rs = await env.DB.prepare(`SELECT b.*, c.name cn, c.company cc, c.phone cp FROM bookings b LEFT JOIN customers c ON c.id=b.customer_id ORDER BY b.start_date DESC LIMIT 5000`).all();
      rows = [['구분', '상태', '지점', '공간', '제목', '시작일', '종료일', '시간', '금액', '계약금', '계약금 입금', '잔금 입금', '고객', '회사·단체', '연락처', '메모']];
      for (const r of rs.results)
        rows.push([r.kind === 'block' ? '예약 불가' : '예약', BOOKING_STATUS[r.status] || r.status, vn(r.venue), parseJson(r.zones, []).join(' / '), r.title, r.start_date, r.end_date,
          [r.start_time, r.end_time].filter(Boolean).join('~'), r.amount, r.deposit_amount, r.deposit_paid ? 'O' : '', r.balance_paid ? 'O' : '', r.cn, r.cc, r.cp, r.memo]);
    } else if (type === 'customers') {
      const rs = await env.DB.prepare('SELECT * FROM customers ORDER BY id DESC LIMIT 5000').all();
      rows = [['이름', '회사·단체', '연락처', '이메일', '태그', '메모', '등록일']];
      for (const r of rs.results) rows.push([r.name, r.company, r.phone, r.email, r.tags, r.memo, r.created_at]);
    } else return fail(400, '내보낼 항목을 선택해 주세요.');
    return new Response(csv(rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="mezzanine-${type}-${today}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  return fail(404, '없는 주소입니다.');
}

// 예약이 확정되면 연결된 문의 상태도 맞추고, 고객에게 보이는 안내를 남깁니다.
async function syncInquiryFromBooking(env, inq, v, actor, bookingId) {
  const now = nowIso();
  if (v.kind !== 'booking') return;
  if (v.status === 'confirmed' && inq.status !== 'confirmed' && inq.status !== 'done') {
    const period = v.start_date === v.end_date ? v.start_date : `${v.start_date} ~ ${v.end_date}`;
    await env.DB.batch([
      env.DB.prepare(`UPDATE inquiries SET status='confirmed', updated_at=? WHERE id=?`).bind(now, inq.id),
      env.DB.prepare(`INSERT INTO messages(inquiry_id, sender, author, body, created_at) VALUES(?,'system','',?,?)`).bind(inq.id, `예약이 확정됐습니다. (${period})`, now),
    ]);
    await logActivity(env, { inquiry_id: inq.id, booking_id: bookingId, actor, action: '예약 확정', detail: period });
  } else if (v.status === 'done' && inq.status !== 'done') {
    await env.DB.prepare(`UPDATE inquiries SET status='done', updated_at=? WHERE id=?`).bind(now, inq.id).run();
  } else if (v.status === 'hold' && ['new', 'consulting', 'quoted'].includes(inq.status)) {
    await env.DB.prepare(`UPDATE inquiries SET status='contracting', updated_at=? WHERE id=?`).bind(now, inq.id).run();
    await logActivity(env, { inquiry_id: inq.id, booking_id: bookingId, actor, action: '가예약 등록', detail: v.start_date });
  }
}
