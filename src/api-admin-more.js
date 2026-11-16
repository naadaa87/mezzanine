// 관리자 API(추가분): 소개서 요청, 소개서 파일, 입점 문의, 호스트 계정, 정산, KPI
import { json, fail, readJson, clip, nowIso, kstDate, parseJson, toInt, csv, randomToken, sha256hex, isDate } from './util.js';
import { createInquiry } from './api-public.js';
import { notify } from './notify.js';
import { brochureKey, fileInfo, storeFile, deleteFile, ensureBrochure, fileResponse, driveFileId } from './files.js';
import { isMonth, monthRange, thisMonth, addMonths, daysBetween, bookingsOverlapping, venueSummary, monthlyTrend } from './metrics.js';
import { LEAD_STATUS, PARTNER_STATUS, HOST_STATUS, SETTLE_STATUS, INQUIRY_STATUS } from './seed.js';

const INVITE_DAYS = 14;
const KST = (col) => `date(${col},'+9 hours')`;

async function newInvite(env, hostId) {
  const code = randomToken(24);
  const expires = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();
  await env.DB.prepare('UPDATE hosts SET invite_hash=?, invite_expires=? WHERE id=?').bind(await sha256hex(code), expires, hostId).run();
  return { code, expires };
}

const inviteUrl = (url, code) => `${url.origin}/host/center#/join?code=${encodeURIComponent(code)}`;

function hostInput(b, content) {
  const venues = (Array.isArray(b.venues) ? b.venues : []).filter((s) => content.venues.some((v) => v.slug === s));
  let rate = Number(b.share_rate);
  if (!Number.isFinite(rate) || rate < 0) rate = 0;
  if (rate > 100) rate = 100;
  return {
    name: clip(b.name, 40), company: clip(b.company, 80), phone: clip(b.phone, 30), email: clip(b.email, 120),
    venues: JSON.stringify(venues), share_rate: Math.round(rate * 10) / 10, memo: clip(b.memo, 2000),
  };
}

export async function handleAdminMore({ request, env, ctx, url, p, method, actor, content }) {
  const today = kstDate();
  const vName = (slug) => content.venues.find((v) => v.slug === slug)?.name || slug || '';
  let m;

  // 메뉴 옆 숫자
  if (p === '/badges' && method === 'GET') {
    const rs = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) n FROM inquiries WHERE status='new'`),
      env.DB.prepare(`SELECT COUNT(*) n FROM leads WHERE status='new'`),
      env.DB.prepare(`SELECT COUNT(*) n FROM partner_apps WHERE status='new'`),
      env.DB.prepare(`SELECT COALESCE(SUM(unread_admin),0) n FROM hosts`),
    ]);
    return json({ ok: true, inquiries: rs[0].results[0].n, leads: rs[1].results[0].n, partners: rs[2].results[0].n, hosts: rs[3].results[0].n });
  }

  // ── 소개서 요청 ────────────────────────────────────────────
  if (p === '/leads' && method === 'GET') {
    const q = url.searchParams;
    const where = [];
    const args = [];
    if (q.get('status')) { where.push('status=?'); args.push(q.get('status')); }
    if (q.get('venue')) { where.push('venues LIKE ?'); args.push(`%"${q.get('venue')}"%`); }
    if (q.get('q')) { where.push('(name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ? OR code LIKE ?)'); const k = `%${clip(q.get('q'), 40)}%`; args.push(k, k, k, k, k); }
    const rs = await env.DB.prepare(`SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`).bind(...args).all();
    return json({ ok: true, items: rs.results.map((r) => ({ ...r, venues: parseJson(r.venues, []), token: undefined })), statuses: LEAD_STATUS });
  }

  if ((m = p.match(/^\/leads\/(\d+)$/))) {
    const id = toInt(m[1]);
    if (method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
      if (!r) return fail(404, '요청을 찾지 못했습니다.');
      const others = r.customer_id
        ? (await env.DB.prepare('SELECT id, code, status, venue, created_at FROM inquiries WHERE customer_id=? ORDER BY id DESC LIMIT 10').bind(r.customer_id).all()).results
        : [];
      return json({ ok: true, item: { ...r, venues: parseJson(r.venues, []), token: undefined }, inquiries: others });
    }
    if (method === 'PATCH') {
      const b = await readJson(request);
      const sets = [];
      const args = [];
      if (b.status !== undefined && LEAD_STATUS[b.status]) { sets.push('status=?'); args.push(b.status); }
      if (b.memo !== undefined) { sets.push('memo=?'); args.push(clip(b.memo, 3000)); }
      if (!sets.length) return fail(400, '바꿀 내용이 없습니다.');
      await env.DB.prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at=? WHERE id=?`).bind(...args, nowIso(), id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM leads WHERE id=?').bind(id).run();
      return json({ ok: true });
    }
  }

  if ((m = p.match(/^\/leads\/(\d+)\/convert$/)) && method === 'POST') {
    const r = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(toInt(m[1])).first();
    if (!r) return fail(404, '요청을 찾지 못했습니다.');
    if (r.inquiry_id) return json({ ok: true, inquiry_id: r.inquiry_id });
    const venues = parseJson(r.venues, []);
    const msg = [`[소개서 요청 ${r.code}에서 전환]`, `받은 소개서: ${venues.map(vName).join(', ')}`, r.event_month ? `예정 시기: ${r.event_month}` : '', r.message || ''].filter(Boolean).join('\n');
    const inq = await createInquiry(env, ctx, content, {
      venue: venues.length === 1 ? venues[0] : '', name: r.name, phone: r.phone, email: r.email, company: r.company,
      event_type: r.event_type, headcount: r.headcount, message: msg,
    }, { source: 'brochure', actor });
    await env.DB.prepare(`UPDATE leads SET status='converted', inquiry_id=?, updated_at=? WHERE id=?`).bind(inq.id, nowIso(), r.id).run();
    return json({ ok: true, inquiry_id: inq.id });
  }

  // ── 소개서 파일 ────────────────────────────────────────────
  if (p === '/files' && method === 'GET') {
    const items = [];
    for (const v of content.venues) {
      const info = await fileInfo(env, brochureKey(v.slug));
      const n = await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(downloads),0) d FROM leads WHERE venues LIKE ?`).bind(`%"${v.slug}"%`).first();
      items.push({ slug: v.slug, name: v.name, status: v.status, brochure: v.brochure || '', drive_id: driveFileId(v.brochure), label: v.brochure_label || '', file: info || null, leads: n.n, downloads: n.d });
    }
    return json({ ok: true, items });
  }

  if ((m = p.match(/^\/files\/brochure\/([a-z0-9-]+)(\/fetch)?$/))) {
    const v = content.venues.find((x) => x.slug === m[1]);
    if (!v) return fail(404, '지점을 찾지 못했습니다.');
    const k = brochureKey(v.slug);
    if (m[2] && method === 'POST') {
      if (!driveFileId(v.brochure)) return fail(400, '지점 정보에 소개서 드라이브 링크가 없습니다. 지점 정보에서 먼저 넣어 주세요.');
      const info = await ensureBrochure(env, v, { force: true });
      if (!info || info.src === 'upload') return fail(502, '드라이브에서 파일을 받지 못했습니다. 파일 공유가 "링크가 있는 모든 사용자"인지 확인해 주세요.');
      return json({ ok: true, file: info });
    }
    if (m[2]) return fail(405, '허용되지 않은 요청입니다.');
    if (method === 'PUT') {
      const buf = new Uint8Array(await request.arrayBuffer());
      if (buf.byteLength < 1024) return fail(400, '파일이 비어 있습니다.');
      if (buf.byteLength > 25_000_000) return fail(413, '25MB 이하의 PDF만 올릴 수 있습니다.');
      if (String.fromCharCode(...buf.slice(0, 5)) !== '%PDF-') return fail(400, 'PDF 파일만 올릴 수 있습니다.');
      await storeFile(env, k, buf, { name: `${v.name} 공간소개서.pdf`, src: 'upload' });
      return json({ ok: true, file: await fileInfo(env, k) });
    }
    if (method === 'DELETE') {
      await deleteFile(env, k);
      return json({ ok: true });
    }
    if (method === 'GET') {
      const info = await fileInfo(env, k);
      if (!info || info.state !== 1) return fail(404, '저장된 파일이 없습니다.');
      return fileResponse(env, info, `메자닌_${v.name.replace('메자닌 ', '')}_공간소개서.pdf`, { inline: true, ascii: `mezzanine-${v.slug}-venue-guide.pdf` });
    }
  }

  // ── 입점 문의(공간 파트너) ──────────────────────────────────
  if (p === '/partners' && method === 'GET') {
    const st = url.searchParams.get('status');
    const rs = await env.DB.prepare(`SELECT * FROM partner_apps ${st ? 'WHERE status=?' : ''} ORDER BY id DESC LIMIT 500`).bind(...(st ? [st] : [])).all();
    return json({ ok: true, items: rs.results, statuses: PARTNER_STATUS });
  }

  if ((m = p.match(/^\/partners\/(\d+)$/))) {
    const id = toInt(m[1]);
    if (method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM partner_apps WHERE id=?').bind(id).first();
      if (!r) return fail(404, '입점 문의를 찾지 못했습니다.');
      return json({ ok: true, item: r });
    }
    if (method === 'PATCH') {
      const b = await readJson(request);
      const sets = [];
      const args = [];
      if (b.status !== undefined && PARTNER_STATUS[b.status]) { sets.push('status=?'); args.push(b.status); }
      if (b.memo !== undefined) { sets.push('memo=?'); args.push(clip(b.memo, 5000)); }
      if (!sets.length) return fail(400, '바꿀 내용이 없습니다.');
      await env.DB.prepare(`UPDATE partner_apps SET ${sets.join(', ')}, updated_at=? WHERE id=?`).bind(...args, nowIso(), id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM partner_apps WHERE id=?').bind(id).run();
      return json({ ok: true });
    }
  }

  // ── 호스트 계정 ────────────────────────────────────────────
  if (p === '/hosts' && method === 'GET') {
    const rs = await env.DB.prepare(`SELECT id, login, name, company, phone, email, status, venues, share_rate, memo, unread_admin, invite_expires, created_at, last_login_at FROM hosts ORDER BY id DESC`).all();
    return json({ ok: true, items: rs.results.map((h) => ({ ...h, venues: parseJson(h.venues, []) })), statuses: HOST_STATUS });
  }

  if (p === '/hosts' && method === 'POST') {
    const b = await readJson(request);
    const v = hostInput(b, content);
    if (!v.name) return fail(400, '호스트 이름을 적어 주세요.');
    const r = await env.DB.prepare(
      `INSERT INTO hosts(name, company, phone, email, venues, share_rate, memo, status, created_at) VALUES(?,?,?,?,?,?,?,'invited',?)`
    ).bind(v.name, v.company, v.phone, v.email, v.venues, v.share_rate, v.memo, nowIso()).run();
    const hostId = r.meta.last_row_id;
    const app = toInt(b.from_app, 0);
    if (app) await env.DB.prepare(`UPDATE partner_apps SET host_id=?, status=CASE WHEN status IN ('new','reviewing','visit','proposal') THEN 'contracted' ELSE status END, updated_at=? WHERE id=?`).bind(hostId, nowIso(), app).run();
    const inv = await newInvite(env, hostId);
    return json({ ok: true, id: hostId, invite_url: inviteUrl(url, inv.code), invite_expires: inv.expires });
  }

  if ((m = p.match(/^\/hosts\/(\d+)$/))) {
    const id = toInt(m[1]);
    if (method === 'GET') {
      const h = await env.DB.prepare(`SELECT id, login, name, company, phone, email, status, venues, share_rate, memo, unread_admin, invite_expires, created_at, last_login_at FROM hosts WHERE id=?`).bind(id).first();
      if (!h) return fail(404, '호스트를 찾지 못했습니다.');
      const [msgs, settles] = await env.DB.batch([
        env.DB.prepare('SELECT sender, author, body, created_at FROM host_messages WHERE host_id=? ORDER BY id').bind(id),
        env.DB.prepare('SELECT * FROM settlements WHERE host_id=? ORDER BY month DESC, venue LIMIT 36').bind(id),
      ]);
      if (h.unread_admin) await env.DB.prepare('UPDATE hosts SET unread_admin=0 WHERE id=?').bind(id).run();
      return json({ ok: true, item: { ...h, venues: parseJson(h.venues, []) }, messages: msgs.results, settlements: settles.results });
    }
    if (method === 'PATCH') {
      const b = await readJson(request);
      const v = hostInput(b, content);
      if (!v.name) return fail(400, '호스트 이름을 적어 주세요.');
      const status = ['active', 'paused', 'invited'].includes(b.status) ? b.status : null;
      await env.DB.prepare(`UPDATE hosts SET name=?, company=?, phone=?, email=?, venues=?, share_rate=?, memo=?${status ? ', status=?' : ''} WHERE id=?`)
        .bind(v.name, v.company, v.phone, v.email, v.venues, v.share_rate, v.memo, ...(status ? [status] : []), id).run();
      if (status === 'paused') await env.DB.prepare('DELETE FROM host_sessions WHERE host_id=?').bind(id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM host_sessions WHERE host_id=?').bind(id),
        env.DB.prepare('DELETE FROM host_messages WHERE host_id=?').bind(id),
        env.DB.prepare(`DELETE FROM settlements WHERE host_id=? AND status='draft'`).bind(id),
        env.DB.prepare('DELETE FROM hosts WHERE id=?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  if ((m = p.match(/^\/hosts\/(\d+)\/invite$/)) && method === 'POST') {
    const id = toInt(m[1]);
    const h = await env.DB.prepare('SELECT id FROM hosts WHERE id=?').bind(id).first();
    if (!h) return fail(404, '호스트를 찾지 못했습니다.');
    const inv = await newInvite(env, id);
    return json({ ok: true, invite_url: inviteUrl(url, inv.code), invite_expires: inv.expires });
  }

  if ((m = p.match(/^\/hosts\/(\d+)\/messages$/)) && method === 'POST') {
    const id = toInt(m[1]);
    const b = await readJson(request);
    const body = clip(b.body, 2000);
    if (!body) return fail(400, '메시지 내용을 적어 주세요.');
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO host_messages(host_id, sender, author, body, created_at) VALUES(?,'admin',?,?,?)`).bind(id, actor, body, nowIso()),
      env.DB.prepare('UPDATE hosts SET unread_host=unread_host+1 WHERE id=?').bind(id),
    ]);
    return json({ ok: true });
  }

  // ── 정산 ───────────────────────────────────────────────────
  if (p === '/settlements' && method === 'GET') {
    const month = isMonth(url.searchParams.get('month')) ? url.searchParams.get('month') : addMonths(thisMonth(), -1);
    const [items, months] = await env.DB.batch([
      env.DB.prepare(`SELECT s.*, h.name host_name, h.company host_company FROM settlements s LEFT JOIN hosts h ON h.id=s.host_id WHERE s.month=? ORDER BY h.name, s.venue`).bind(month),
      env.DB.prepare(`SELECT month, COUNT(*) n, SUM(payout) payout, SUM(status='paid') paid FROM settlements GROUP BY month ORDER BY month DESC LIMIT 24`),
    ]);
    return json({ ok: true, month, items: items.results, months: months.results, statuses: SETTLE_STATUS });
  }

  if (p === '/settlements/generate' && method === 'POST') {
    const b = await readJson(request);
    const month = isMonth(b.month) ? b.month : addMonths(thisMonth(), -1);
    const r = monthRange(month);
    const hosts = (await env.DB.prepare(`SELECT id, venues, share_rate FROM hosts WHERE status<>'paused'`).all()).results;
    const allVenues = [...new Set(hosts.flatMap((h) => parseJson(h.venues, [])))];
    const rows = await bookingsOverlapping(env, allVenues, r.from, r.to);
    const sum = venueSummary(rows, allVenues, r.from, r.to);
    const now = nowIso();
    let made = 0;
    let kept = 0;
    for (const h of hosts) {
      for (const slug of parseJson(h.venues, [])) {
        const s = sum[slug];
        if (!s) continue;
        const ex = await env.DB.prepare('SELECT id, status, adjust FROM settlements WHERE host_id=? AND venue=? AND month=?').bind(h.id, slug, month).first();
        if (ex && ex.status !== 'draft') { kept++; continue; }
        const hostAmount = Math.round((s.revenue * Number(h.share_rate || 0)) / 100);
        const adjust = ex ? Number(ex.adjust || 0) : 0;
        await env.DB.prepare(
          `INSERT INTO settlements(host_id, venue, month, bookings, gross, share_rate, host_amount, adjust, payout, status, created_at, updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,'draft',?,?)
           ON CONFLICT(host_id, venue, month) DO UPDATE SET bookings=excluded.bookings, gross=excluded.gross, share_rate=excluded.share_rate,
             host_amount=excluded.host_amount, payout=excluded.host_amount + settlements.adjust, updated_at=excluded.updated_at`
        ).bind(h.id, slug, month, s.bookings, s.revenue, Number(h.share_rate || 0), hostAmount, adjust, hostAmount + adjust, now, now).run();
        made++;
      }
    }
    return json({ ok: true, month, made, kept });
  }

  if ((m = p.match(/^\/settlements\/(\d+)$/))) {
    const id = toInt(m[1]);
    const s = await env.DB.prepare('SELECT * FROM settlements WHERE id=?').bind(id).first();
    if (!s) return fail(404, '정산을 찾지 못했습니다.');
    if (method === 'PATCH') {
      const b = await readJson(request);
      const adjust = b.adjust !== undefined ? toInt(b.adjust, 0) : s.adjust;
      const status = SETTLE_STATUS[b.status] ? b.status : s.status;
      const paidAt = status === 'paid' ? (isDate(b.paid_at) ? b.paid_at : s.paid_at || kstDate()) : null;
      await env.DB.prepare('UPDATE settlements SET adjust=?, payout=?, status=?, memo=?, paid_at=?, updated_at=? WHERE id=?')
        .bind(adjust, Number(s.host_amount || 0) + adjust, status, b.memo !== undefined ? clip(b.memo, 2000) : s.memo, paidAt, nowIso(), id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      if (s.status !== 'draft') return fail(400, '확정되거나 지급된 정산은 지울 수 없습니다. 상태를 먼저 "작성 중"으로 바꿔 주세요.');
      await env.DB.prepare('DELETE FROM settlements WHERE id=?').bind(id).run();
      return json({ ok: true });
    }
  }

  // ── KPI ────────────────────────────────────────────────────
  if (p === '/kpi' && method === 'GET') {
    const q = url.searchParams;
    let to = isDate(q.get('to')) ? q.get('to') : today;
    let from = isDate(q.get('from')) ? q.get('from') : today.slice(0, 8) + '01';
    if (from > to) [from, to] = [to, from];
    if (daysBetween(from, to) > 800) from = new Date(Date.parse(to) - 799 * 86400000).toISOString().slice(0, 10);
    const venue = content.venues.some((v) => v.slug === q.get('venue')) ? q.get('venue') : '';
    const span = daysBetween(from, to);
    const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
    const prevFrom = new Date(Date.parse(prevTo) - (span - 1) * 86400000).toISOString().slice(0, 10);
    const [cur, prev] = await Promise.all([kpiCounts(env, content, from, to, venue), kpiCounts(env, content, prevFrom, prevTo, venue)]);
    const detail = await kpiDetail(env, content, from, to, venue);
    return json({ ok: true, from, to, prev: { from: prevFrom, to: prevTo, ...prev }, venue, ...cur, ...detail });
  }

  // ── 내보내기(추가 항목) ─────────────────────────────────────
  if (p === '/export' && method === 'GET' && ['leads', 'partners', 'settlements'].includes(url.searchParams.get('type'))) {
    const type = url.searchParams.get('type');
    let rows;
    if (type === 'leads') {
      const rs = await env.DB.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 5000').all();
      rows = [['요청번호', '요청일시', '상태', '소개서', '이름', '회사·브랜드', '연락처', '이메일', '행사 종류', '예정 시기', '상담 희망', '내려받은 횟수', '들어온 곳', '메모']];
      for (const r of rs.results)
        rows.push([r.code, r.created_at, LEAD_STATUS[r.status] || r.status, parseJson(r.venues, []).map(vName).join(' / '), r.name, r.company, r.phone, r.email, r.event_type, r.event_month, r.wants_call ? 'O' : '', r.downloads, r.referrer, r.memo]);
    } else if (type === 'partners') {
      const rs = await env.DB.prepare('SELECT * FROM partner_apps ORDER BY id DESC LIMIT 5000').all();
      rows = [['접수번호', '접수일시', '상태', '이름', '관계', '연락처', '이메일', '위치', '건물 형태', '층수', '연면적', '지금 상태', '쓸 수 있는 시기', '운영 방식', '자료 링크', '내용', '메모']];
      for (const r of rs.results)
        rows.push([r.code, r.created_at, PARTNER_STATUS[r.status] || r.status, r.name, r.relation, r.phone, r.email, r.address, r.building_type, r.floors, r.area, r.vacancy, r.available_from, r.model, r.link, r.message, r.memo]);
    } else {
      const rs = await env.DB.prepare('SELECT s.*, h.name hn, h.company hc FROM settlements s LEFT JOIN hosts h ON h.id=s.host_id ORDER BY s.month DESC, h.name').all();
      rows = [['정산 월', '호스트', '회사', '지점', '확정 예약', '대관 매출', '배분율(%)', '배분 금액', '조정', '지급액', '상태', '지급일', '메모']];
      for (const r of rs.results)
        rows.push([r.month, r.hn, r.hc, vName(r.venue), r.bookings, r.gross, r.share_rate, r.host_amount, r.adjust, r.payout, SETTLE_STATUS[r.status] || r.status, r.paid_at, r.memo]);
    }
    return new Response(csv(rows), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="mezzanine-${type}-${today}.csv"`, 'cache-control': 'no-store' },
    });
  }

  return null;
}

// 기간 비교용 핵심 숫자
async function kpiCounts(env, content, from, to, venue) {
  const vi = venue ? ' AND venue=?' : '';
  const va = venue ? [venue] : [];
  const rs = await env.DB.batch([
    env.DB.prepare(`SELECT COALESCE(SUM(n),0) n FROM page_views WHERE day BETWEEN ? AND ?${venue ? ' AND path=?' : ''}`).bind(from, to, ...(venue ? [`/venues/${venue}`] : [])),
    env.DB.prepare(`SELECT COUNT(*) n FROM visitors WHERE day BETWEEN ? AND ?`).bind(from, to),
    env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(wants_call),0) calls, COALESCE(SUM(downloads>0),0) dl FROM leads WHERE ${KST('created_at')} BETWEEN ? AND ?${venue ? ' AND venues LIKE ?' : ''}`).bind(from, to, ...(venue ? [`%"${venue}"%`] : [])),
    env.DB.prepare(`SELECT COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ?${vi}`).bind(from, to, ...va),
    env.DB.prepare(`SELECT COUNT(*) n FROM quotes q JOIN inquiries i ON i.id=q.inquiry_id WHERE q.sent_at IS NOT NULL AND ${KST('q.sent_at')} BETWEEN ? AND ?${venue ? ' AND i.venue=?' : ''}`).bind(from, to, ...va),
    env.DB.prepare(`SELECT COUNT(*) n FROM quotes q JOIN inquiries i ON i.id=q.inquiry_id WHERE q.status='accepted' AND ${KST('q.responded_at')} BETWEEN ? AND ?${venue ? ' AND i.venue=?' : ''}`).bind(from, to, ...va),
    env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount),0) amount FROM bookings WHERE kind='booking' AND status IN ('confirmed','done') AND start_date BETWEEN ? AND ?${vi}`).bind(from, to, ...va),
    env.DB.prepare(`SELECT COUNT(*) n FROM partner_apps WHERE ${KST('created_at')} BETWEEN ? AND ?`).bind(from, to),
  ]);
  const one = (i) => rs[i].results[0];
  return {
    pageviews: one(0).n, visitors: one(1).n, leads: one(2).n, lead_calls: one(2).calls, lead_downloads: one(2).dl,
    inquiries: one(3).n, quotes_sent: one(4).n, quotes_accepted: one(5).n, bookings: one(6).n, revenue: one(6).amount, partner_apps: one(7).n,
  };
}

async function kpiDetail(env, content, from, to, venue) {
  const vi = venue ? ' AND venue=?' : '';
  const va = venue ? [venue] : [];
  const openVenues = content.venues.filter((v) => v.status === 'open').map((v) => v.slug);
  const venues = venue ? [venue] : openVenues;
  const rs = await env.DB.batch([
    // 0 기간에 들어온 문의의 현재 상태(전환율)
    env.DB.prepare(`SELECT status, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ?${vi} GROUP BY status`).bind(from, to, ...va),
    // 1 첫 응답(관리자 메시지)
    env.DB.prepare(`SELECT i.id, i.created_at, MIN(m.created_at) first FROM inquiries i LEFT JOIN messages m ON m.inquiry_id=i.id AND m.sender='admin'
                    WHERE i.kind='rental' AND ${KST('i.created_at')} BETWEEN ? AND ?${venue ? ' AND i.venue=?' : ''} GROUP BY i.id`).bind(from, to, ...va),
    // 2 첫 응답(관리자가 상태를 바꾼 기록)
    env.DB.prepare(`SELECT a.inquiry_id id, MIN(a.created_at) first FROM activity a JOIN inquiries i ON i.id=a.inquiry_id
                    WHERE i.kind='rental' AND ${KST('i.created_at')} BETWEEN ? AND ? AND a.actor NOT IN ('고객','system') AND a.action<>'문의 접수'${venue ? ' AND i.venue=?' : ''} GROUP BY a.inquiry_id`).bind(from, to, ...va),
    // 3 행사까지 남은 기간(리드타임)
    env.DB.prepare(`SELECT AVG(julianday(date_start) - julianday(${KST('created_at')})) d, COUNT(*) n FROM inquiries WHERE kind='rental' AND date_start<>'' AND ${KST('created_at')} BETWEEN ? AND ?${vi}`).bind(from, to, ...va),
    // 4 행사 유형
    env.DB.prepare(`SELECT COALESCE(NULLIF(event_type,''),'미정') t, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ?${vi} GROUP BY t ORDER BY n DESC LIMIT 8`).bind(from, to, ...va),
    // 5 문의 경로
    env.DB.prepare(`SELECT source, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ?${vi} GROUP BY source`).bind(from, to, ...va),
    // 6 들어온 사이트
    env.DB.prepare(`SELECT host, SUM(n) n FROM referrers WHERE day BETWEEN ? AND ? GROUP BY host ORDER BY n DESC LIMIT 8`).bind(from, to),
    // 7 많이 본 페이지
    env.DB.prepare(`SELECT path, SUM(n) n FROM page_views WHERE day BETWEEN ? AND ? GROUP BY path ORDER BY n DESC LIMIT 10`).bind(from, to),
    // 8 지점별 문의
    env.DB.prepare(`SELECT venue, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ? GROUP BY venue`).bind(from, to),
    // 9 오픈 알림 신청
    env.DB.prepare(`SELECT COUNT(*) n FROM inquiries WHERE kind='open_notify' AND ${KST('created_at')} BETWEEN ? AND ?`).bind(from, to),
  ]);

  const byStatus = {};
  for (const r of rs[0].results) byStatus[r.status] = r.n;
  const cohort = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const won = (byStatus.confirmed || 0) + (byStatus.done || 0);

  const firstAct = new Map(rs[2].results.map((r) => [r.id, r.first]));
  const hours = [];
  let waiting = 0;
  for (const r of rs[1].results) {
    const a = r.first;
    const b = firstAct.get(r.id);
    const first = a && b ? (a < b ? a : b) : a || b;
    if (!first) { waiting++; continue; }
    hours.push((Date.parse(first) - Date.parse(r.created_at)) / 3600000);
  }
  hours.sort((x, y) => x - y);
  const median = hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null;
  const within24 = hours.length ? hours.filter((h) => h <= 24).length / (hours.length + waiting) : null;

  // 지점별 매출·가동률
  const brs = await bookingsOverlapping(env, venues, from, to);
  const sum = venueSummary(brs, venues, from, to);
  const inqBy = Object.fromEntries(rs[8].results.map((r) => [r.venue, r.n]));
  const byVenue = venues.map((slug) => ({ slug, name: content.venues.find((v) => v.slug === slug)?.name || slug, inquiries: inqBy[slug] || 0, ...sum[slug] }));

  // 월별 추이(기간 끝 기준 12개월)
  const endMonth = to.slice(0, 7);
  const startMonth = addMonths(endMonth, -11);
  const mFrom = monthRange(startMonth).from;
  const mTo = monthRange(endMonth).to;
  const [trend, mt] = await Promise.all([
    monthlyTrend(env, venues, endMonth, 12),
    env.DB.batch([
      env.DB.prepare(`SELECT substr(${KST('created_at')},1,7) m, COUNT(*) n FROM inquiries WHERE kind='rental' AND ${KST('created_at')} BETWEEN ? AND ?${vi} GROUP BY m`).bind(mFrom, mTo, ...va),
      env.DB.prepare(`SELECT substr(${KST('created_at')},1,7) m, COUNT(*) n FROM leads WHERE ${KST('created_at')} BETWEEN ? AND ?${venue ? ' AND venues LIKE ?' : ''} GROUP BY m`).bind(mFrom, mTo, ...(venue ? [`%"${venue}"%`] : [])),
      env.DB.prepare(`SELECT substr(day,1,7) m, COUNT(*) n FROM visitors WHERE day BETWEEN ? AND ? GROUP BY m`).bind(mFrom, mTo),
    ]),
  ]);
  const idx = (r) => Object.fromEntries(r.results.map((x) => [x.m, x.n]));
  const [mi, ml, mv] = mt.map(idx);
  const monthly = trend.map((t) => ({ ...t, inquiries: mi[t.month] || 0, leads: ml[t.month] || 0, visitors: mv[t.month] || 0 }));

  const usedDays = byVenue.reduce((a, x) => a + (x.used_days || 0), 0);
  const capacity = byVenue.reduce((a, x) => a + (x.days || 0), 0);

  return {
    cohort: { total: cohort, won, rate: cohort ? won / cohort : null, by_status: byStatus, labels: INQUIRY_STATUS },
    response: { answered: hours.length, waiting, median_hours: median, within24 },
    lead_days: rs[3].results[0].n ? Math.round(rs[3].results[0].d) : null,
    event_types: rs[4].results,
    sources: rs[5].results,
    referrers: rs[6].results,
    pages: rs[7].results,
    by_venue: byVenue,
    occupancy: capacity ? usedDays / capacity : null,
    open_notify: rs[9].results[0].n,
    monthly,
  };
}
