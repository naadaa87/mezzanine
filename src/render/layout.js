import { esc } from '../util.js';
import { wordmark } from './wordmark.js';

const NAV = [
  { href: '/venues', label: '공간 찾기', key: 'venues' },
  { href: '/cases', label: '대관 사례', key: 'cases' },
  { href: '/brochure', label: '공간소개서', key: 'brochure' },
  { href: '/guide', label: '이용 안내', key: 'guide' },
];

export const ARROW = '<svg class="arr" viewBox="0 0 26 10" aria-hidden="true"><path d="M0 5h24M19 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

// 사진 종류 표시: 실제 사진이 아닌 이미지는 반드시 밝힙니다.
export const KIND_LABEL = { brand: '브랜드 이미지', staged: '연출 이미지' };
export const kindNote = (m) => KIND_LABEL[m.kind] || '';

// 기본 공유 이미지: 관리자에서 정한 site:og 이미지, 없으면 기본 파일
export const defaultShareImage = (content) => {
  const m = content.media['site:og'];
  return m && m.length ? `/media/${m[0].id}` : '/assets/img/og.png';
};

export function page({ content, origin, path, title, description, body, active = '', jsonLd = null, scripts = [], noindex = false, image = '', bar = true }) {
  const s = content.settings;
  const site = (s.site_url || origin || '').replace(/\/$/, '');
  const fullTitle = title ? `${title} | ${s.brand}` : `${s.brand} | 공간에 여백을, 경험에 깊이를`;
  const desc = description || s.description;
  const ch = s.channels || {};
  const shareImg = image || defaultShareImage(content);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(site + path)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${esc(s.brand)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(site + path)}">
<meta property="og:image" content="${esc(site)}${esc(shareImg)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/assets/css/site.css?v=7">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body${bar ? ' class="has-bar"' : ''}>
<a class="skip" href="#main">본문으로 건너뛰기</a>
${s.notice ? `<p class="notice">${esc(s.notice)}</p>` : ''}
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/" aria-label="MEZZANINE ${esc(s.brand)} 홈">${wordmark({ cls: 'wm', stroke: 8 })}</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav"><span class="menu-label">메뉴</span><span class="menu-ico" aria-hidden="true"></span></button>
    <nav class="nav" id="nav" aria-label="주 메뉴">
      <div class="nav-main">${NAV.map((n) => `<a href="${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}</div>
      <div class="nav-side">
        <a class="nav-my" href="/my"${active === 'my' ? ' aria-current="page"' : ''}>내 문의 조회</a>
        <a class="nav-cta" href="/inquiry"${active === 'inquiry' ? ' aria-current="page"' : ''}>견적 요청</a>
      </div>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div class="foot-brand">
      <a class="logo" href="/" aria-label="MEZZANINE ${esc(s.brand)} 홈">${wordmark({ cls: 'wm wm-foot', stroke: 8 })}</a>
      <p class="foot-line">서울의 통건물 대관, 메자닌 서울<br>공간에 여백을, 경험에 깊이를.</p>
    </div>
    <div class="foot-col">
      <h2>공간</h2>
      <ul>${content.venues.map((v) => `<li><a href="/venues/${esc(v.slug)}">${esc(v.name)}${v.status === 'coming' ? ' <small>오픈 예정</small>' : ''}</a></li>`).join('')}</ul>
    </div>
    <div class="foot-col">
      <h2>대관</h2>
      <ul>
        <li><a href="/inquiry">견적 요청</a></li>
        <li><a href="/brochure">공간소개서 받기</a></li>
        <li><a href="/my">내 문의 조회</a></li>
        <li><a href="/cases">대관 사례</a></li>
        <li><a href="/guide">이용 안내</a></li>
      </ul>
    </div>
    <div class="foot-col">
      <h2>파트너</h2>
      <ul>
        <li><a href="/host">공간 파트너 모집</a></li>
        <li><a href="/host/center">호스트센터</a></li>
      </ul>
    </div>
    <div class="foot-col">
      <h2>연락</h2>
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
    <p lang="en">© ${new Date().getFullYear()} ${esc(s.brand_en)}</p>
  </div>
</footer>
${bar ? `<nav class="mbar" aria-label="빠른 문의">
  <a class="mbar-main" href="/inquiry">견적 요청</a>
  ${ch.kakao ? `<a class="mbar-sub" href="${esc(ch.kakao)}" target="_blank" rel="noopener">카카오톡</a>` : `<a class="mbar-sub" href="/my">내 문의 조회</a>`}
</nav>` : ''}
<script src="/assets/js/site.js?v=7" defer></script>
${scripts.map((src) => `<script src="${src}?v=7" defer></script>`).join('\n')}
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

// 대표 이미지: 저장된 사진이 있으면 첫 장, 없으면 유튜브 썸네일
export function coverOf(content, type, id, video) {
  const m = content.media[`${type}:${id}`];
  if (m && m.length) return { src: `/media/${m[0].id}`, sm: `/media/${m[0].id}?s=sm`, w: m[0].width, h: m[0].height, kind: m[0].kind || 'photo' };
  if (video) return { src: `https://i.ytimg.com/vi/${encodeURIComponent(video)}/hqdefault.jpg`, sm: `https://i.ytimg.com/vi/${encodeURIComponent(video)}/hqdefault.jpg`, w: 480, h: 360, kind: 'video' };
  return null;
}

export const venueBy = (content, slug) => content.venues.find((v) => v.slug === slug);

export const statusChip = (v) =>
  v.status === 'coming' ? '<span class="chip chip-soon">오픈 예정</span>' : '<span class="chip chip-open">대관 가능</span>';
