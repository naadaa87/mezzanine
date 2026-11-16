import { json, fail, readJson, clip, normPhone, isDate, isTime, toInt, nowIso, kstDate, randomCode, randomToken, clientIp, parseJson } from './util.js';
import { ensureSchema, getContent, logActivity, rateLimit, storeMedia } from './db.js';
import { ensureBrochure, fileResponse } from './files.js';
import { sameOrigin } from './auth.js';
import { notify } from './notify.js';
import { fetchDriveImage, DRIVE_ID } from './drive.js';
import { EVENT_TYPES, INQUIRY_STATUS, PARTNER_MODELS } from './seed.js';

const venueName = (content, slug) => content.venues.find((v) => v.slug === slug)?.name || '지점 미정';

export async function findOrCreateCustomer(env, { name, company, phone, email }) {
  const pn = normPhone(phone);
  let row = null;
  if (pn) row = await env.DB.prepare('SELECT id FROM customers WHERE phone_norm=? LIMIT 1').bind(pn).first();
  if (!row && email) row = await env.DB.prepare('SELECT id FROM customers WHERE email=? LIMIT 1').bind(email).first();
  const now = nowIso();
  if (row) {
    await env.DB.prepare(
      `UPDATE customers SET name=?, company=CASE WHEN ?<>'' THEN ? ELSE company END,
       email=CASE WHEN ?<>'' THEN ? ELSE email END, updated_at=? WHERE id=?`
    )
      .bind(name, company, company, email, email, now, row.id)
      .run();
    return row.id;
  }
  const r = await env.DB.prepare(
    'INSERT INTO customers(name, company, phone, phone_norm, email, created_at, updated_at) VALUES(?,?,?,?,?,?,?)'
  )
    .bind(name, company, phone, pn, email, now, now)
    .run();
  return r.meta.last_row_id;
}

export async function createInquiry(env, ctx, content, b, { source = 'web', actor = '고객' } = {}) {
  const venue = content.venues.some((v) => v.slug === b.venue) ? b.venue : '';
  const v = content.venues.find((x) => x.slug === venue);
  const kind = b.kind === 'open_notify' || v?.status === 'coming' ? 'open_notify' : 'rental';
  const name = clip(b.name, 40);
  const phone = clip(b.phone, 30);
  const email = clip(b.email, 120);
  if (!name) throw new Error('담당자 이름을 적어 주세요.');
  if (normPhone(phone).length < 9) throw new Error('연락받을 전화번호를 확인해 주세요.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 주소를 확인해 주세요.');
  const date_start = isDate(b.date_start) ? b.date_start : '';
  let date_end = isDate(b.date_end) ? b.date_end : date_start;
  if (date_start && date_end < date_start) date_end = date_start;
  const zones = Array.isArray(b.zones) ? b.zones.slice(0, 20).map((z) => clip(z, 40)).filter(Boolean) : [];
  const options = Array.isArray(b.options) ? b.options.slice(0, 20).map((z) => clip(z, 40)).filter(Boolean) : [];
  const company = clip(b.company, 80);
  const customerId = await findOrCreateCustomer(env, { name, company, phone, email });

  const code = `MZ-${kstDate().slice(2).replace(/-/g, '')}-${randomCode(4)}`;
  const token = randomToken(18);
  const now = nowIso();
  const r = await env.DB.prepare(
    `INSERT INTO inquiries(code, access_token, customer_id, kind, venue, zones, event_type, event_name,
       date_start, date_end, time_start, time_end, date_flexible, headcount, budget, options, message,
       contact_pref, name, company, phone, email, status, source, unread_admin, created_at, updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?)`
  )
    .bind(
      code, token, customerId, kind, venue, JSON.stringify(zones),
      EVENT_TYPES.includes(b.event_type) ? b.event_type : clip(b.event_type, 30),
      clip(b.event_name, 80), date_start, date_end,
      isTime(b.time_start) ? b.time_start : '', isTime(b.time_end) ? b.time_end : '',
      b.date_flexible ? 1 : 0, toInt(b.headcount, 0) || null, clip(b.budget, 30), JSON.stringify(options),
      clip(b.message, 3000), clip(b.contact_pref, 20), name, company, phone, email,
      source, source === 'web' ? 1 : 0, now, now
    )
    .run();
  const id = r.meta.last_row_id;
  await logActivity(env, { inquiry_id: id, actor, action: '문의 접수', detail: source === 'web' ? '홈페이지' : '관리자 직접 등록' });
  if (source === 'web') {
    const when = date_start ? (date_end && date_end !== date_start ? `${date_start}~${date_end}` : date_start) : '일정 미정';
    notify(env, ctx, content.settings,
      `[메자닌] ${kind === 'open_notify' ? '오픈 알림 신청' : '새 대관 문의'} ${code}\n${venueName(content, venue)} / ${when} / ${name}${company ? ` (${company})` : ''}\n${clip(b.message, 200)}`);
  }
  return { id, code, token };
}

async function loadInquiryByToken(env, code, token) {
  if (!code || !token) return null;
  const row = await env.DB.prepare('SELECT * FROM inquiries WHERE code=?').bind(String(code).toUpperCase()).first();
  if (!row || row.access_token !== token) return null;
  return row;
}

const publicQuote = (q) => ({
  id: q.id, number: q.number, title: q.title, items: parseJson(q.items, []), subtotal: q.subtotal, discount: q.discount,
  vat: q.vat, total: q.total, vat_mode: q.vat_mode, valid_until: q.valid_until, note: q.note, status: q.status,
  sent_at: q.sent_at, responded_at: q.responded_at,
});

export async function handlePublicApi(request, env, ctx, url) {
  const p = url.pathname;
  const method = request.method;
  try {
    await ensureSchema(env);
  } catch {
    return fail(503, '아직 데이터베이스가 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (method !== 'GET' && !sameOrigin(request)) return fail(403, '허용되지 않은 요청입니다.');
  const content = await getContent(env);
  const ip = clientIp(request);

  // 대관 문의 접수
  if (p === '/api/inquiries' && method === 'POST') {
    let b;
    try { b = await readJson(request); } catch (e) { return fail(400, e.message); }
    if (b.hp) return json({ ok: true, code: 'MZ-000000-0000', token: '' }); // 자동 등록 프로그램 차단
    if (!b.agree) return fail(400, '개인정보 수집·이용에 동의해 주세요.');
    if (!(await rateLimit(env, `inq:${ip}`, 6, 600))) return fail(429, '짧은 시간에 문의가 여러 번 접수됐습니다. 10분 뒤에 다시 시도해 주세요.');
    try {
      const r = await createInquiry(env, ctx, content, b);
      return json({ ok: true, code: r.code, token: r.token });
    } catch (e) {
      return fail(400, e.message || '문의를 접수하지 못했습니다.');
    }
  }

  // 공간소개서 요청: 연락처를 남기면 내려받기 링크를 드립니다
  if (p === '/api/brochure' && method === 'POST') {
    let b;
    try { b = await readJson(request); } catch (e) { return fail(400, e.message); }
    if (b.hp) return json({ ok: true, code: 'BR-000000-0000', token: '', files: [] });
    if (!b.agree) return fail(400, '개인정보 수집·이용에 동의해 주세요.');
    const avail = brochureVenues(content);
    const picked = (Array.isArray(b.venues) ? b.venues : [b.venues]).filter((x) => avail.some((v) => v.slug === x));
    if (!picked.length) return fail(400, '받으실 지점 소개서를 골라 주세요.');
    const name = clip(b.name, 40);
    const phone = clip(b.phone, 30);
    const email = clip(b.email, 120);
    const company = clip(b.company, 80);
    if (!name) return fail(400, '이름을 적어 주세요.');
    if (normPhone(phone).length < 9) return fail(400, '연락처를 확인해 주세요.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, '이메일 주소를 확인해 주세요.');
    if (!(await rateLimit(env, `brochure:${ip}`, 8, 600))) return fail(429, '요청이 너무 잦습니다. 10분 뒤에 다시 시도해 주세요.');
    const customerId = await findOrCreateCustomer(env, { name, company, phone, email });
    const code = `BR-${kstDate().slice(2).replace(/-/g, '')}-${randomCode(4)}`;
    const token = randomToken(18);
    const now = nowIso();
    let ref = '';
    try { ref = new URL(clip(b.ref, 300)).hostname.replace(/^www\./, ''); } catch {}
    await env.DB.prepare(
      `INSERT INTO leads(code, token, venues, customer_id, name, company, phone, email, event_type, event_month, headcount, message, wants_call, status, referrer, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?)`
    ).bind(code, token, JSON.stringify(picked), customerId, name, company, phone, email,
      EVENT_TYPES.includes(b.event_type) ? b.event_type : clip(b.event_type, 30), clip(b.event_month, 20),
      toInt(b.headcount, 0) || null, clip(b.message, 1000), b.wants_call ? 1 : 0, ref.slice(0, 80), now, now).run();
    // 파일을 미리 받아 둡니다(첫 내려받기를 빠르게)
    for (const slug of picked) {
      const v = content.venues.find((x) => x.slug === slug);
      if (v) ctx.waitUntil(ensureBrochure(env, v).catch(() => {}));
    }
    notify(env, ctx, content.settings,
      `[메자닌] 소개서 요청 ${code}\n${picked.map((x) => venueName(content, x)).join(', ')} / ${name}${company ? ` (${company})` : ''}${b.wants_call ? ' / 상담 연락 희망' : ''}`);
    return json({ ok: true, code, token, files: brochureLinks(content, picked, code, token) });
  }

  // 이미 받은 소개서 링크 다시 보기(같은 브라우저에서)
  if (p === '/api/brochure/links' && method === 'GET') {
    const row = await env.DB.prepare('SELECT code, token, venues, created_at FROM leads WHERE code=?').bind(clip(url.searchParams.get('code'), 30).toUpperCase()).first();
    if (!row || row.token !== url.searchParams.get('t') || Date.now() - Date.parse(row.created_at) > LINK_DAYS * 86400000) return fail(404, '링크가 만료됐습니다.');
    return json({ ok: true, files: brochureLinks(content, parseJson(row.venues, []), row.code, row.token) });
  }

  // 공간 파트너(건물주) 입점 문의
  if (p === '/api/partners' && method === 'POST') {
    let b;
    try { b = await readJson(request); } catch (e) { return fail(400, e.message); }
    if (b.hp) return json({ ok: true, code: 'PT-000000-0000' });
    if (!b.agree) return fail(400, '개인정보 수집·이용에 동의해 주세요.');
    const name = clip(b.name, 40);
    const phone = clip(b.phone, 30);
    const email = clip(b.email, 120);
    const address = clip(b.address, 200);
    if (!name) return fail(400, '이름을 적어 주세요.');
    if (normPhone(phone).length < 9) return fail(400, '연락처를 확인해 주세요.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, '이메일 주소를 확인해 주세요.');
    if (!address) return fail(400, '건물 위치를 적어 주세요. 동네 이름까지만 적으셔도 됩니다.');
    if (!(await rateLimit(env, `partner:${ip}`, 5, 600))) return fail(429, '요청이 너무 잦습니다. 10분 뒤에 다시 시도해 주세요.');
    const code = `PT-${kstDate().slice(2).replace(/-/g, '')}-${randomCode(4)}`;
    const now = nowIso();
    let link = clip(b.link, 400);
    if (link && !/^https?:\/\//.test(link)) link = '';
    await env.DB.prepare(
      `INSERT INTO partner_apps(code, name, relation, company, phone, email, address, building_type, floors, area, vacancy, available_from, model, link, message, status, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?)`
    ).bind(code, name, clip(b.relation, 20), clip(b.company, 80), phone, email, address, clip(b.building_type, 30), clip(b.floors, 40), clip(b.area, 40),
      clip(b.vacancy, 40), clip(b.available_from, 40), PARTNER_MODELS.includes(b.model) ? b.model : clip(b.model, 40), link, clip(b.message, 3000), now, now).run();
    notify(env, ctx, content.settings, `[메자닌] 공간 파트너 입점 문의 ${code}\n${address} / ${name}${b.relation ? ` (${clip(b.relation, 20)})` : ''}\n${clip(b.message, 200)}`);
    return json({ ok: true, code });
  }

  // 접수번호 + 연락처로 내 문의 찾기
  if (p === '/api/my/lookup' && method === 'POST') {
    let b;
    try { b = await readJson(request); } catch (e) { return fail(400, e.message); }
    if (!(await rateLimit(env, `lookup:${ip}`, 12, 600))) return fail(429, '조회 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const row = await env.DB.prepare('SELECT code, access_token, phone FROM inquiries WHERE code=?')
      .bind(clip(b.code, 30).toUpperCase())
      .first();
    const pn = normPhone(b.phone);
    if (!row || !pn || normPhone(row.phone) !== pn) return fail(404, '접수번호와 연락처가 일치하는 문의를 찾지 못했습니다.');
    return json({ ok: true, code: row.code, token: row.access_token });
  }

  // 내 문의 내용
  if (p === '/api/my' && method === 'GET') {
    const row = await loadInquiryByToken(env, url.searchParams.get('code'), url.searchParams.get('t'));
    if (!row) return fail(404, '문의를 찾지 못했습니다. 주소가 정확한지 확인해 주세요.');
    const [msgs, quotes, booking] = await env.DB.batch([
      env.DB.prepare('SELECT sender, author, body, created_at FROM messages WHERE inquiry_id=? ORDER BY id').bind(row.id),
      env.DB.prepare(`SELECT * FROM quotes WHERE inquiry_id=? AND status<>'draft' ORDER BY id DESC`).bind(row.id),
      env.DB.prepare(`SELECT venue, zones, title, start_date, end_date, start_time, end_time, status, amount, deposit_amount, deposit_paid, balance_paid
                      FROM bookings WHERE inquiry_id=? AND kind='booking' AND status<>'cancelled' ORDER BY id DESC LIMIT 1`).bind(row.id),
    ]);
    const today = kstDate();
    return json({
      ok: true,
      inquiry: {
        code: row.code, kind: row.kind, status: row.status, status_label: INQUIRY_STATUS[row.status] || row.status,
        venue: row.venue, venue_name: venueName(content, row.venue), zones: parseJson(row.zones, []),
        event_type: row.event_type, event_name: row.event_name, date_start: row.date_start, date_end: row.date_end,
        time_start: row.time_start, time_end: row.time_end, date_flexible: !!row.date_flexible, headcount: row.headcount,
        budget: row.budget, options: parseJson(row.options, []), message: row.message, name: row.name, company: row.company,
        created_at: row.created_at,
      },
      messages: msgs.results,
      quotes: quotes.results.map((q) => {
        const o = publicQuote(q);
        if (o.status === 'sent' && o.valid_until && o.valid_until < today) o.status = 'expired';
        return o;
      }),
      booking: booking.results[0] ? { ...booking.results[0], zones: parseJson(booking.results[0].zones, []), venue_name: venueName(content, booking.results[0].venue) } : null,
      channels: content.settings.channels,
    });
  }

  // 고객이 남기는 메시지
  if (p === '/api/my/message' && method === 'POST') {
    let b;
    try { b = await readJson(request); } catch (e) { return fail(400, e.message); }
    const row = await loadInquiryByToken(env, b.code, b.t);
    if (!row) return fail(404, '문의를 찾지 못했습니다.');
    const body = clip(b.body, 2000);
    if (!body) return fail(400, '메시지 내용을 적어 주세요.');
    if (!(await rateLimit(env, `msg:${row.id}`, 20, 600))) return fail(429, '메시지를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요.');
    const now = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO messages(inquiry_id, sender, author, body, created_at) VALUES(?,'customer',?,?,?)`).bind(row.id, row.name, body, now),
      env.DB.prepare('UPDATE inquiries SET unread_admin=unread_admin+1, updated_at=? WHERE id=?').bind(now, row.id),
    ]);
    notify(env, ctx, content.settings, `[메자닌] ${row.code} 고객 메시지 (${row.name})\n${clip(body, 300)}`);
    return json({ ok: true });
  }

  // 견적 수락·거절
  if (p === '/api/my/quote' && method === 'POST') {
    let b;
    try { b = await readJson(request); } catch (e) { return fail(400, e.message); }
    const row = await loadInquiryByToken(env, b.code, b.t);
    if (!row) return fail(404, '문의를 찾지 못했습니다.');
    const q = await env.DB.prepare('SELECT * FROM quotes WHERE id=? AND inquiry_id=?').bind(toInt(b.quote_id), row.id).first();
    if (!q || q.status !== 'sent') return fail(400, '이미 처리됐거나 응답할 수 없는 견적입니다.');
    if (q.valid_until && q.valid_until < kstDate()) return fail(400, '유효기간이 지난 견적입니다. 메시지로 다시 요청해 주세요.');
    const accept = b.action === 'accept';
    const now = nowIso();
    const note = clip(b.note, 500);
    const text = accept ? `견적을 수락했습니다. (${q.number})` : `견적을 거절했습니다. (${q.number})`;
    const stmts = [
      env.DB.prepare('UPDATE quotes SET status=?, responded_at=?, updated_at=? WHERE id=?').bind(accept ? 'accepted' : 'declined', now, now, q.id),
      env.DB.prepare(`INSERT INTO messages(inquiry_id, sender, author, body, created_at) VALUES(?,'system','',?,?)`).bind(row.id, text + (note ? `\n${note}` : ''), now),
      env.DB.prepare('UPDATE inquiries SET unread_admin=unread_admin+1, updated_at=?, status=CASE WHEN ?=1 AND status IN (\'new\',\'consulting\',\'quoted\') THEN \'contracting\' ELSE status END WHERE id=?')
        .bind(now, accept ? 1 : 0, row.id),
    ];
    await env.DB.batch(stmts);
    await logActivity(env, { inquiry_id: row.id, actor: '고객', action: accept ? '견적 수락' : '견적 거절', detail: q.number });
    notify(env, ctx, content.settings, `[메자닌] ${row.code} ${text}${note ? `\n${note}` : ''}`);
    return json({ ok: true });
  }

  // 지점별 예약 현황(날짜와 상태만 공개)
  if (p === '/api/availability' && method === 'GET') {
    const venue = url.searchParams.get('venue') || '';
    const from = isDate(url.searchParams.get('from')) ? url.searchParams.get('from') : kstDate();
    const to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to') : from;
    const rs = await env.DB.prepare(
      `SELECT start_date, end_date, status, kind FROM bookings
       WHERE venue=? AND status IN ('hold','confirmed','done') AND end_date>=? AND start_date<=? ORDER BY start_date`
    )
      .bind(venue, from, to)
      .all();
    return json(
      { ok: true, items: rs.results.map((r) => ({ start: r.start_date, end: r.end_date, state: r.kind === 'block' ? 'closed' : r.status === 'hold' ? 'hold' : 'booked' })) },
      200,
      { 'cache-control': 'public, max-age=60' }
    );
  }

  return fail(404, '없는 주소입니다.');
}

// 사진 제공. ?s=sm 이면 목록용 작은 사진. 드라이브에서 가져온 사진은 아직 저장 전이면 지금 받아 저장합니다.
export async function serveMedia(request, env, ctx, id) {
  const small = new URL(request.url).searchParams.get('s') === 'sm';
  const cache = caches.default;
  const key = new Request(new URL(`/media/${id}${small ? '?s=sm' : ''}`, request.url).toString());
  try {
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch {}
  let row;
  try {
    await ensureSchema(env);
    row = await env.DB.prepare(`SELECT id, mime, src, size, ${small ? 'COALESCE(thumb, data)' : 'data'} AS body FROM media WHERE id=?`).bind(toInt(id)).first();
  } catch {
    row = null;
  }
  if (!row) return new Response('Not found', { status: 404 });
  let body = row.body;
  let type = row.mime || 'image/webp';
  if (!body && /^(drive|asset):/.test(String(row.src || ''))) {
    const ok = await storeMedia(env, row);
    if (!ok) return new Response('Not available', { status: 404, headers: { 'cache-control': 'no-store' } });
    const again = await env.DB.prepare(`SELECT mime, ${small ? 'COALESCE(thumb, data)' : 'data'} AS body FROM media WHERE id=?`).bind(row.id).first();
    body = again?.body;
    type = again?.mime || type;
  }
  if (!body) return new Response('Not found', { status: 404 });
  if (!(body instanceof ArrayBuffer)) body = new Uint8Array(body);
  const res = new Response(body, {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' },
  });
  try {
    ctx.waitUntil(cache.put(key, res.clone()));
  } catch {}
  return res;
}

// 드라이브 영상의 미리보기 이미지. 사이트에 등록된 영상만 제공합니다.
export async function serveVideoPoster(request, env, ctx, driveId) {
  if (!DRIVE_ID.test(driveId)) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const key = new Request(new URL(`/media/dv/${driveId}`, request.url).toString());
  try {
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch {}
  const content = await getContent(env);
  const known = [...content.venues, ...content.cases].some((x) => (x.drive_videos || []).includes(driveId));
  if (!known) return new Response('Not found', { status: 404 });
  const img = await fetchDriveImage(driveId, 960);
  if (!img) return new Response('Not available', { status: 404, headers: { 'cache-control': 'no-store' } });
  const res = new Response(img.buf, { headers: { 'content-type': img.type, 'cache-control': 'public, max-age=604800' } });
  try {
    ctx.waitUntil(cache.put(key, res.clone()));
  } catch {}
  return res;
}

// ── 공간소개서 ───────────────────────────────────────────────
export const LINK_DAYS = 30;

// 소개서를 내려받을 수 있는 지점: 드라이브 링크가 있거나 관리자가 파일을 올린 곳
export function brochureVenues(content) {
  return content.venues.filter((v) => v.status !== 'coming' && (v.brochure || (content.brochures || []).includes(v.slug)));
}

function brochureLinks(content, slugs, code, token) {
  return slugs
    .map((slug) => content.venues.find((v) => v.slug === slug))
    .filter(Boolean)
    .map((v) => ({ slug: v.slug, name: v.name, label: v.brochure_label || `${v.name} 공간소개서`, url: `/brochure/download/${code}/${token}/${v.slug}` }));
}

export async function serveBrochure(request, env, ctx, code, token, slug) {
  await ensureSchema(env);
  const content = await getContent(env);
  const lead = await env.DB.prepare('SELECT id, token, venues, created_at FROM leads WHERE code=?').bind(String(code).toUpperCase()).first();
  if (!lead || lead.token !== token) return { error: '내려받기 주소가 올바르지 않습니다. 소개서 받기 화면에서 다시 신청해 주세요.' };
  if (Date.now() - Date.parse(lead.created_at) > LINK_DAYS * 86400000)
    return { error: `내려받기 링크는 신청 후 ${LINK_DAYS}일 동안 쓸 수 있습니다. 소개서 받기 화면에서 다시 신청해 주세요.` };
  const v = brochureVenues(content).find((x) => x.slug === slug);
  if (!v) return { error: '해당 지점의 소개서를 찾지 못했습니다.' };
  const info = await ensureBrochure(env, v);
  if (!info) return { error: '소개서 파일을 지금 준비하지 못했습니다. 남겨 주신 연락처로 담당자가 직접 보내 드리겠습니다.', notify: true, lead };
  await env.DB.prepare('UPDATE leads SET downloads=downloads+1, last_download_at=? WHERE id=?').bind(nowIso(), lead.id).run();
  return { res: fileResponse(env, info, `메자닌_${v.name.replace('메자닌 ', '')}_공간소개서.pdf`, { ascii: `mezzanine-${v.slug}-venue-guide.pdf` }) };
}
