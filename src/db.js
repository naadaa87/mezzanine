import { DEFAULTS, SEED_MEDIA, SEED_MEDIA_V2, SEED_MEDIA_V3, SEED_MEDIA_VERSION } from './seed.js';
import { fetchDriveImage, imageSize } from './drive.js';
import { parseJson, nowIso } from './util.js';

const SCHEMA_VERSION = 4;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS admins (
     id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE NOT NULL, name TEXT,
     pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, role TEXT DEFAULT 'owner',
     created_at TEXT, last_login_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS content (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS customers (
     id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, company TEXT, phone TEXT, phone_norm TEXT, email TEXT,
     tags TEXT DEFAULT '', memo TEXT DEFAULT '', created_at TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_norm)`,
  `CREATE TABLE IF NOT EXISTS inquiries (
     id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, access_token TEXT NOT NULL,
     customer_id INTEGER, kind TEXT DEFAULT 'rental', venue TEXT, zones TEXT DEFAULT '[]',
     event_type TEXT, event_name TEXT, date_start TEXT, date_end TEXT, time_start TEXT, time_end TEXT,
     date_flexible INTEGER DEFAULT 0, headcount INTEGER, budget TEXT, options TEXT DEFAULT '[]', message TEXT,
     contact_pref TEXT, name TEXT, company TEXT, phone TEXT, email TEXT,
     status TEXT DEFAULT 'new', assignee TEXT DEFAULT '', internal_memo TEXT DEFAULT '', source TEXT DEFAULT 'web',
     unread_admin INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_customer ON inquiries(customer_id)`,
  `CREATE TABLE IF NOT EXISTS messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER NOT NULL, sender TEXT NOT NULL,
     author TEXT, body TEXT NOT NULL, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_inquiry ON messages(inquiry_id, id)`,
  `CREATE TABLE IF NOT EXISTS quotes (
     id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER NOT NULL, number TEXT, title TEXT,
     items TEXT DEFAULT '[]', subtotal INTEGER DEFAULT 0, discount INTEGER DEFAULT 0, vat INTEGER DEFAULT 0,
     total INTEGER DEFAULT 0, vat_mode TEXT DEFAULT 'add', valid_until TEXT, note TEXT DEFAULT '',
     status TEXT DEFAULT 'draft', sent_at TEXT, responded_at TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_inquiry ON quotes(inquiry_id)`,
  `CREATE TABLE IF NOT EXISTS bookings (
     id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER, customer_id INTEGER, quote_id INTEGER,
     kind TEXT DEFAULT 'booking', venue TEXT NOT NULL, zones TEXT DEFAULT '[]', title TEXT,
     start_date TEXT NOT NULL, end_date TEXT NOT NULL, start_time TEXT, end_time TEXT,
     status TEXT DEFAULT 'hold', amount INTEGER DEFAULT 0, deposit_amount INTEGER DEFAULT 0,
     deposit_paid INTEGER DEFAULT 0, balance_paid INTEGER DEFAULT 0, memo TEXT DEFAULT '',
     created_at TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(venue, start_date, end_date)`,
  `CREATE TABLE IF NOT EXISTS media (
     id INTEGER PRIMARY KEY AUTOINCREMENT, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL,
     sort INTEGER DEFAULT 0, caption TEXT DEFAULT '', mime TEXT, width INTEGER, height INTEGER,
     size INTEGER, data BLOB, src TEXT DEFAULT '', kind TEXT DEFAULT 'photo', thumb BLOB,
     fetch_state INTEGER DEFAULT 0, fetch_at TEXT, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_type, owner_id, sort)`,
  `CREATE TABLE IF NOT EXISTS activity (
     id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER, booking_id INTEGER,
     actor TEXT, action TEXT, detail TEXT, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_inquiry ON activity(inquiry_id, id)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (k TEXT PRIMARY KEY, n INTEGER, reset_at INTEGER)`,
  // v4: 공간소개서 요청(리드)
  `CREATE TABLE IF NOT EXISTS leads (
     id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, token TEXT NOT NULL, venues TEXT DEFAULT '[]',
     customer_id INTEGER, name TEXT, company TEXT, phone TEXT, email TEXT, event_type TEXT, event_month TEXT,
     headcount INTEGER, message TEXT DEFAULT '', wants_call INTEGER DEFAULT 0, status TEXT DEFAULT 'new',
     memo TEXT DEFAULT '', inquiry_id INTEGER, downloads INTEGER DEFAULT 0, last_download_at TEXT,
     referrer TEXT DEFAULT '', created_at TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at)`,
  // 소개서 PDF 등 큰 파일: D1 한 칸에 2MB까지만 들어가므로 나눠서 저장
  `CREATE TABLE IF NOT EXISTS files (
     k TEXT PRIMARY KEY, name TEXT, mime TEXT, size INTEGER DEFAULT 0, parts INTEGER DEFAULT 0, src TEXT DEFAULT '',
     state INTEGER DEFAULT 0, fetch_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS file_parts (k TEXT NOT NULL, part INTEGER NOT NULL, data BLOB, PRIMARY KEY(k, part))`,
  // 공간 파트너(건물주) 입점 신청
  `CREATE TABLE IF NOT EXISTS partner_apps (
     id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT, relation TEXT, company TEXT,
     phone TEXT, email TEXT, address TEXT, building_type TEXT, floors TEXT, area TEXT, vacancy TEXT,
     available_from TEXT, model TEXT, link TEXT, message TEXT, status TEXT DEFAULT 'new', memo TEXT DEFAULT '',
     host_id INTEGER, created_at TEXT, updated_at TEXT)`,
  // 호스트(공간 파트너) 계정
  `CREATE TABLE IF NOT EXISTS hosts (
     id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE, name TEXT, company TEXT, phone TEXT, email TEXT,
     pass_hash TEXT, pass_salt TEXT, status TEXT DEFAULT 'invited', invite_hash TEXT, invite_expires TEXT,
     venues TEXT DEFAULT '[]', share_rate REAL DEFAULT 0, memo TEXT DEFAULT '', unread_admin INTEGER DEFAULT 0,
     unread_host INTEGER DEFAULT 0, created_at TEXT, last_login_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS host_sessions (token_hash TEXT PRIMARY KEY, host_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS host_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT, host_id INTEGER NOT NULL, sender TEXT NOT NULL, author TEXT, body TEXT NOT NULL, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_host_messages ON host_messages(host_id, id)`,
  `CREATE TABLE IF NOT EXISTS settlements (
     id INTEGER PRIMARY KEY AUTOINCREMENT, host_id INTEGER NOT NULL, venue TEXT NOT NULL, month TEXT NOT NULL,
     bookings INTEGER DEFAULT 0, gross INTEGER DEFAULT 0, share_rate REAL DEFAULT 0, host_amount INTEGER DEFAULT 0,
     adjust INTEGER DEFAULT 0, payout INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', memo TEXT DEFAULT '',
     paid_at TEXT, created_at TEXT, updated_at TEXT, UNIQUE(host_id, venue, month))`,
  // 방문 집계: 쿠키 없이 하루 단위로만 셉니다
  `CREATE TABLE IF NOT EXISTS page_views (day TEXT NOT NULL, path TEXT NOT NULL, n INTEGER DEFAULT 0, PRIMARY KEY(day, path))`,
  `CREATE TABLE IF NOT EXISTS visitors (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY(day, h))`,
  `CREATE TABLE IF NOT EXISTS referrers (day TEXT NOT NULL, host TEXT NOT NULL, n INTEGER DEFAULT 0, PRIMARY KEY(day, host))`,
];

let ready = null;

// 첫 요청 때 테이블을 만듭니다. 별도의 마이그레이션 명령 없이 D1만 연결하면 됩니다.
export function ensureSchema(env) {
  if (!env.DB) return Promise.reject(new Error('DB_NOT_BOUND'));
  if (ready) return ready;
  ready = (async () => {
    let ver = 0;
    try {
      const r = await env.DB.prepare(`SELECT v FROM meta WHERE k='schema'`).first();
      ver = Number(r?.v || 0);
    } catch {
      ver = 0;
    }
    if (ver < SCHEMA_VERSION) {
      await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
      // v2: 구글드라이브에서 가져온 사진의 원본 위치
      for (const col of [`src TEXT DEFAULT ''`, `kind TEXT DEFAULT 'photo'`, `thumb BLOB`, `fetch_state INTEGER DEFAULT 0`, `fetch_at TEXT`]) {
        try {
          await env.DB.prepare(`ALTER TABLE media ADD COLUMN ${col}`).run();
        } catch {}
      }
      await env.DB.prepare(`UPDATE media SET fetch_state=1 WHERE size>0`).run();
      await env.DB.prepare(`INSERT INTO meta(k,v) VALUES('schema',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`)
        .bind(String(SCHEMA_VERSION))
        .run();
    }
    await seedMedia(env);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

// 기본 사진을 버전마다 한 번만 넣습니다. 관리자에서 지운 사진은 다시 채우지 않습니다.
async function seedMedia(env) {
  const r = await env.DB.prepare(`SELECT v FROM meta WHERE k='seed_media'`).first();
  const done = Number(r?.v || 0);
  if (done >= SEED_MEDIA_VERSION) return;
  const now = new Date().toISOString();
  const stmts = [];
  const insert = (type, id, sort, caption, src, kind) =>
    env.DB.prepare(`INSERT INTO media(owner_type, owner_id, sort, caption, mime, width, height, size, data, src, kind, fetch_state, created_at) VALUES(?,?,?,?,'',0,0,0,NULL,?,?,0,?)`)
      .bind(type, id, sort, caption, src, kind, now);
  if (done < 1) {
    for (const [owner, list] of Object.entries(SEED_MEDIA)) {
      const [type, id] = owner.split(':');
      const c = await env.DB.prepare('SELECT COUNT(*) n FROM media WHERE owner_type=? AND owner_id=?').bind(type, id).first();
      if (c.n > 0) continue;
      list.forEach(([driveId, caption], i) => stmts.push(insert(type, id, i + 1, caption, `drive:${driveId}`, 'photo')));
    }
  }
  if (done < 2) {
    const byOwner = {};
    for (const it of SEED_MEDIA_V2) (byOwner[it[0]] ||= []).push(it);
    for (const [owner, list] of Object.entries(byOwner)) {
      const [type, id] = owner.split(':');
      const ex = await env.DB.prepare('SELECT src, sort FROM media WHERE owner_type=? AND owner_id=?').bind(type, id).all();
      const have = new Set(ex.results.map((x) => x.src));
      const sorts = ex.results.map((x) => x.sort);
      const firsts = list.filter((x) => x[4] === 'first' && !have.has(`drive:${x[1]}`));
      const lasts = list.filter((x) => x[4] !== 'first' && !have.has(`drive:${x[1]}`));
      let lo = sorts.length ? Math.min(...sorts) : 1;
      let hi = sorts.length ? Math.max(...sorts) : 0;
      firsts.forEach((x, i) => stmts.push(insert(type, id, lo - firsts.length + i, x[2], `drive:${x[1]}`, x[3])));
      lasts.forEach((x) => stmts.push(insert(type, id, ++hi, x[2], `drive:${x[1]}`, x[3])));
    }
  }
  if (done < 3) {
    // 소개서에 실린 실제 공간 사진(사이트에 함께 올린 파일). 지점 사진 맨 앞에 넣습니다.
    const byOwner = {};
    for (const it of SEED_MEDIA_V3) (byOwner[it[0]] ||= []).push(it);
    for (const [owner, list] of Object.entries(byOwner)) {
      const [type, id] = owner.split(':');
      const ex = await env.DB.prepare('SELECT src, sort FROM media WHERE owner_type=? AND owner_id=?').bind(type, id).all();
      const have = new Set(ex.results.map((x) => x.src));
      const lo = Math.min(-100, ...ex.results.map((x) => x.sort));
      const add = list.filter((x) => !have.has(`asset:${x[1]}`));
      add.forEach((x, i) => stmts.push(insert(type, id, lo - add.length + i, x[2], `asset:${x[1]}`, x[3] || 'photo')));
    }
  }
  stmts.push(env.DB.prepare(`INSERT INTO meta(k,v) VALUES('seed_media',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(String(SEED_MEDIA_VERSION)));
  await env.DB.batch(stmts);
}

// 드라이브 사진을 받아 저장합니다(큰 사진 + 목록용 작은 사진). 실패하면 20분 뒤 다시 시도합니다.
export async function storeDriveMedia(env, row) {
  const driveId = String(row.src || '').slice(6);
  const big = await fetchDriveImage(driveId, 1800, 1_850_000);
  if (!big) {
    await env.DB.prepare(`UPDATE media SET fetch_state=-1, fetch_at=? WHERE id=?`).bind(new Date().toISOString(), row.id).run();
    return null;
  }
  const small = await fetchDriveImage(driveId, 720, 400_000);
  await env.DB.prepare(`UPDATE media SET data=?, thumb=?, mime=?, width=?, height=?, size=?, fetch_state=1, fetch_at=? WHERE id=?`)
    .bind(big.buf, small ? small.buf : null, big.type, big.w || 0, big.h || 0, big.buf.byteLength, new Date().toISOString(), row.id)
    .run();
  bustContent();
  return big;
}

// 사이트에 함께 올린 사진 파일(public/assets/...)을 사진 목록에 저장합니다. 작은 사진은 같은 이름의 .sm.jpg
export async function storeAssetMedia(env, row) {
  const path = String(row.src || '').slice(6);
  const get = async (p) => {
    if (!env.ASSETS) return null;
    const res = await env.ASSETS.fetch(new Request(`https://assets.local${p}`));
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  };
  const big = await get(path);
  if (!big) {
    await env.DB.prepare(`UPDATE media SET fetch_state=-1, fetch_at=? WHERE id=?`).bind(new Date().toISOString(), row.id).run();
    return null;
  }
  const small = await get(path.replace(/\.jpg$/, '.sm.jpg'));
  const dim = imageSize(big) || {};
  await env.DB.prepare(`UPDATE media SET data=?, thumb=?, mime='image/jpeg', width=?, height=?, size=?, fetch_state=1, fetch_at=? WHERE id=?`)
    .bind(big.buffer, small ? small.buffer : null, dim.w || 0, dim.h || 0, big.byteLength, new Date().toISOString(), row.id)
    .run();
  bustContent();
  return true;
}

export const storeMedia = (env, row) => (String(row.src || '').startsWith('asset:') ? storeAssetMedia(env, row) : storeDriveMedia(env, row));

export async function processPendingMedia(env, limit = 8) {
  await ensureSchema(env);
  const retry = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const rs = await env.DB.prepare(
    `SELECT id, src FROM media WHERE (src LIKE 'drive:%' OR src LIKE 'asset:%') AND (size IS NULL OR size=0 OR thumb IS NULL)
     AND (fetch_state IS NULL OR fetch_state<>-1 OR fetch_at<?) ORDER BY (src LIKE 'asset:%') DESC, id LIMIT ?`
  ).bind(retry, limit).all();
  let ok = 0;
  for (const row of rs.results) if (await storeMedia(env, row)) ok++;
  return { tried: rs.results.length, ok };
}

let cache = { t: 0, data: null };

function withDefaults(o = {}) {
  const s = o.settings || {};
  const d = DEFAULTS.settings;
  return {
    settings: {
      ...d,
      ...s,
      channels: { ...d.channels, ...(s.channels || {}) },
      contact: { ...d.contact, ...(s.contact || {}) },
      business: { ...d.business, ...(s.business || {}) },
      notify: { ...d.notify, ...(s.notify || {}) },
    },
    // 관리자에서 저장한 지점 정보에 새로 생긴 항목(층별 안내 등)이 없으면 기본값으로 채웁니다
    venues: Array.isArray(o.venues)
      ? o.venues.map((v) => {
          const d = DEFAULTS.venues.find((x) => x.slug === v.slug);
          return d ? { ...d, ...v, guide: v.guide || d.guide, map: { ...(d.map || {}), ...(v.map || {}) } } : v;
        })
      : DEFAULTS.venues,
    cases: Array.isArray(o.cases) ? o.cases : DEFAULTS.cases,
    faqs: Array.isArray(o.faqs) ? o.faqs : DEFAULTS.faqs,
    guide: o.guide || DEFAULTS.guide,
    rates: Array.isArray(o.rates) ? o.rates : DEFAULTS.rates,
    host_notices: Array.isArray(o.host_notices) ? o.host_notices : [],
    partner: { ...DEFAULTS.partner, ...(o.partner || {}) },
    media: {},
  };
}

// 사이트 콘텐츠(설정·지점·사례·FAQ·사진 목록). DB가 아직 없으면 기본값으로 동작합니다.
export async function getContent(env, force = false) {
  if (!force && cache.data && Date.now() - cache.t < 15000) return cache.data;
  let data;
  try {
    await ensureSchema(env);
    const [rows, media, files] = await env.DB.batch([
      env.DB.prepare('SELECT k, v FROM content'),
      env.DB.prepare('SELECT id, owner_type, owner_id, sort, caption, width, height, kind FROM media WHERE size>0 ORDER BY owner_type, owner_id, sort, id'),
      env.DB.prepare(`SELECT k FROM files WHERE k LIKE 'brochure:%' AND state=1 AND parts>0`),
    ]);
    const o = {};
    for (const r of rows.results) o[r.k] = parseJson(r.v, undefined);
    data = withDefaults(o);
    for (const m of media.results) (data.media[`${m.owner_type}:${m.owner_id}`] ||= []).push(m);
    data.brochures = files.results.map((f) => f.k.slice(9));
    data.dbReady = true;
  } catch (e) {
    data = withDefaults({});
    data.brochures = [];
    data.dbReady = false;
  }
  cache = { t: Date.now(), data };
  return data;
}

export const bustContent = () => {
  cache.t = 0;
};

export async function setContent(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO content(k,v,updated_at) VALUES(?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at`
  )
    .bind(key, JSON.stringify(value), nowIso())
    .run();
  bustContent();
}

export async function logActivity(env, { inquiry_id = null, booking_id = null, actor = 'system', action, detail = '' }) {
  await env.DB.prepare('INSERT INTO activity(inquiry_id, booking_id, actor, action, detail, created_at) VALUES(?,?,?,?,?,?)')
    .bind(inquiry_id, booking_id, actor, action, detail, nowIso())
    .run();
}

// 간단한 요청 횟수 제한. 한도를 넘으면 false
export async function rateLimit(env, key, max, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare('SELECT n, reset_at FROM rate_limits WHERE k=?').bind(key).first();
  if (!r || r.reset_at < now) {
    await env.DB.prepare(
      'INSERT INTO rate_limits(k,n,reset_at) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=1, reset_at=excluded.reset_at'
    )
      .bind(key, now + windowSec)
      .run();
    return true;
  }
  if (r.n >= max) return false;
  await env.DB.prepare('UPDATE rate_limits SET n=n+1 WHERE k=?').bind(key).run();
  return true;
}
