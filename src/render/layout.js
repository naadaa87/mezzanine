import { esc } from '../util.js';

const NAV = [
  { href: '/venues', label: '지점', key: 'venues' },
  { href: '/cases', label: '대관 사례', key: 'cases' },
  { href: '/guide', label: '이용 안내', key: 'guide' },
  { href: '/my', label: '내 문의 조회', key: 'my' },
];

export const mark = `<svg class="mark" viewBox="0 0 44 28" aria-hidden="true"><rect x="1" y="6" width="10" height="21"/><rect x="17" y="1" width="10" height="26"/><rect x="33" y="10" width="10" height="17"/><rect class="mark-link" x="11" y="13" width="22" height="4"/></svg>`;

export function page({ content, origin, path, title, description, body, active = '', jsonLd = null, scripts = [], noindex = false }) {
  const s = content.settings;
  const site = (s.site_url || origin || '').replace(/\/$/, '');
  const fullTitle = title ? `${title} | ${s.brand}` : `${s.brand} | 통건물 복합 대관 공간`;
  const desc = description || s.description;
  const ch = s.channels || {};
  const openVenues = content.venues;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(site + path)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(s.brand)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(site + path)}">
<meta property="og:image" content="${esc(site)}/assets/img/og.png">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=1">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
${s.notice ? `<p class="notice">${esc(s.notice)}</p>` : ''}
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/" aria-label="${esc(s.brand)} 홈">${mark}<span class="logo-en">MEZZANINE</span><span class="logo-sub">SEOUL</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav">메뉴</button>
    <nav class="nav" id="nav" aria-label="주 메뉴">
      ${NAV.map((n) => `<a href="${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
      <a class="btn btn-point nav-cta" href="/inquiry">대관 문의</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div class="foot-brand">
      <a class="logo" href="/" aria-label="${esc(s.brand)} 홈">${mark}<span class="logo-en">MEZZANINE</span><span class="logo-sub">SEOUL</span></a>
      <p>건물과 건물을 2층에서 이은 복합 대관 공간</p>
    </div>
    <div class="foot-col">
      <h2>지점</h2>
      <ul>${openVenues.map((v) => `<li><a href="/venues/${esc(v.slug)}">${esc(v.name)}${v.status === 'coming' ? ' <small>오픈 예정</small>' : ''}</a></li>`).join('')}</ul>
    </div>
    <div class="foot-col">
      <h2>대관</h2>
      <ul>
        <li><a href="/inquiry">대관 문의·견적 요청</a></li>
        <li><a href="/my">내 문의 조회</a></li>
        <li><a href="/cases">대관 사례</a></li>
        <li><a href="/guide">이용 안내</a></li>
      </ul>
    </div>
    <div class="foot-col">
      <h2>채널</h2>
      <ul>
        ${ch.kakao ? `<li><a href="${esc(ch.kakao)}" target="_blank" rel="noopener">카카오톡 채널</a></li>` : ''}
        ${ch.instagram ? `<li><a href="${esc(ch.instagram)}" target="_blank" rel="noopener">인스타그램</a></li>` : ''}
        ${ch.blog ? `<li><a href="${esc(ch.blog)}" target="_blank" rel="noopener">네이버 블로그</a></li>` : ''}
        ${ch.youtube ? `<li><a href="${esc(ch.youtube)}" target="_blank" rel="noopener">유튜브</a></li>` : ''}
        ${s.contact.phone ? `<li><a href="tel:${esc(s.contact.phone.replace(/[^\d+]/g, ''))}">${esc(s.contact.phone)}</a></li>` : ''}
        ${s.contact.email ? `<li><a href="mailto:${esc(s.contact.email)}">${esc(s.contact.email)}</a></li>` : ''}
      </ul>
    </div>
  </div>
  <div class="wrap foot-legal">
    ${businessLine(s.business)}
    <p>© ${new Date().getFullYear()} ${esc(s.brand_en)}</p>
  </div>
</footer>
<script src="/assets/js/site.js?v=1" defer></script>
${scripts.map((src) => `<script src="${src}?v=1" defer></script>`).join('\n')}
</body>
</html>`;
}

function businessLine(b = {}) {
  const parts = [];
  if (b.company) parts.push(esc(b.company));
  if (b.ceo) parts.push(`대표 ${esc(b.ceo)}`);
  if (b.regno) parts.push(`사업자등록번호 ${esc(b.regno)}`);
  if (b.address) parts.push(esc(b.address));
  return parts.length ? `<p>${parts.join(' | ')}</p>` : '';
}

export const html = (body, status = 200, headers = {}) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'SAMEORIGIN',
      ...headers,
    },
  });

// 사진이 있으면 첫 장, 없으면 유튜브 썸네일
export function coverOf(content, type, id, video) {
  const m = content.media[`${type}:${id}`];
  if (m && m.length) return { src: `/media/${m[0].id}`, w: m[0].width, h: m[0].height, kind: 'photo' };
  if (video) return { src: `https://i.ytimg.com/vi/${encodeURIComponent(video)}/hqdefault.jpg`, w: 480, h: 360, kind: 'video' };
  return null;
}

export const venueBy = (content, slug) => content.venues.find((v) => v.slug === slug);

export const statusChip = (v) =>
  v.status === 'coming' ? '<span class="chip chip-soon">오픈 예정</span>' : '<span class="chip chip-open">대관 가능</span>';
