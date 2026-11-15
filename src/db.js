import { DEFAULTS } from './seed.js';
import { parseJson, nowIso } from './util.js';

const SCHEMA_VERSION = 1;

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
     size INTEGER, data BLOB, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_type, owner_id, sort)`,
  `CREATE TABLE IF NOT EXISTS activity (
     id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER, booking_id INTEGER,
     actor TEXT, action TEXT, detail TEXT, created_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_inquiry ON activity(inquiry_id, id)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (k TEXT PRIMARY KEY, n INTEGER, reset_at INTEGER)`,
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
      await env.DB.prepare(`INSERT INTO meta(k,v) VALUES('schema',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`)
        .bind(String(SCHEMA_VERSION))
        .run();
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
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
    venues: Array.isArray(o.venues) ? o.venues : DEFAULTS.venues,
    cases: Array.isArray(o.cases) ? o.cases : DEFAULTS.cases,
    faqs: Array.isArray(o.faqs) ? o.faqs : DEFAULTS.faqs,
    guide: o.guide || DEFAULTS.guide,
    rates: Array.isArray(o.rates) ? o.rates : DEFAULTS.rates,
    media: {},
  };
}

// 사이트 콘텐츠(설정·지점·사례·FAQ·사진 목록). DB가 아직 없으면 기본값으로 동작합니다.
export async function getContent(env, force = false) {
  if (!force && cache.data && Date.now() - cache.t < 15000) return cache.data;
  let data;
  try {
    await ensureSchema(env);
    const [rows, media] = await env.DB.batch([
      env.DB.prepare('SELECT k, v FROM content'),
      env.DB.prepare('SELECT id, owner_type, owner_id, sort, caption, width, height FROM media ORDER BY owner_type, owner_id, sort, id'),
    ]);
    const o = {};
    for (const r of rows.results) o[r.k] = parseJson(r.v, undefined);
    data = withDefaults(o);
    for (const m of media.results) (data.media[`${m.owner_type}:${m.owner_id}`] ||= []).push(m);
    data.dbReady = true;
  } catch (e) {
    data = withDefaults({});
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
