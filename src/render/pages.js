import { esc } from '../util.js';
import { page, coverOf, venueBy, statusChip, ARROW, KIND_LABEL } from './layout.js';
import { sectionSVG } from './diagram.js';
import { EVENT_TYPES, OPTION_LIST, BUDGETS } from '../seed.js';
import { brochureVenues } from '../api-public.js';

const PROCESS = [
  ['문의 접수', '지점과 일정, 행사 내용을 적어 문의를 남깁니다. 접수번호가 바로 발급됩니다.'],
  ['상담·답사', '담당자가 내용을 확인하고 연락드립니다. 필요하면 공간을 직접 둘러봅니다.'],
  ['견적 확인', '사용 공간과 기간에 맞춘 견적서를 보내드립니다. 내 문의 조회에서 확인하고 수락할 수 있습니다.'],
  ['계약·예약 확정', '계약을 마치면 일정이 확정되고, 예약 현황에 반영됩니다.'],
  ['행사 진행', '설치부터 철수까지 약속한 일정대로 공간을 사용합니다.'],
];

const USE_ROWS = [
  ['팝업스토어', ['팝업']],
  ['전시', ['전시']],
  ['브랜드·기업 행사', ['브랜드 행사', '기업 행사']],
  ['네트워킹·파티', ['파티']],
  ['공연·쇼케이스', ['공연']],
  ['마켓', ['마켓']],
  ['촬영', ['촬영']],
  ['단기 임대·카페 운영', ['단기 임대', '카페']],
];

const short = (v) => v.name.replace('메자닌 ', '');
const enName = (v) => (v.name_en || '').toUpperCase();
const mediaOf = (content, key) => content.media[key] || [];
const capOf = (m) => [m.caption, KIND_LABEL[m.kind]].filter(Boolean).join(' · ');
const kindTag = (m) => (KIND_LABEL[m.kind] ? `<span class="tag">${KIND_LABEL[m.kind]}</span>` : '');
const imgTag = (m, { sm = true, alt = '', lazy = true, extra = '' } = {}) =>
  `<img src="/media/${m.id}${sm ? '?s=sm' : ''}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async" width="${m.width || 1600}" height="${m.height || 1067}"${extra}>`;
const galBtn = (m, alt, inner) => `<button type="button" class="gal-item" data-full="/media/${m.id}" data-cap="${esc(capOf(m))}" aria-label="${esc(alt)} 크게 보기">${inner}</button>`;
const hiddenItems = (list) => list.map((m) => `<button type="button" class="gal-item" hidden data-full="/media/${m.id}" data-cap="${esc(capOf(m))}"></button>`).join('');
const brandNote = (list) =>
  list.some((m) => m.kind === 'brand')
    ? '<p class="gal-note">‘브랜드 이미지’ 표시가 있는 사진은 실제 공간 사진을 바탕으로 보정한 이미지로, 세부 모습이 지금과 다를 수 있습니다.</p>'
    : '';

const hasBrochure = (content, v) => brochureVenues(content).some((x) => x.slug === v.slug);
const asset = (v, name, sm = false) => `/assets/venue/${v.slug}/${name}${sm ? '.sm' : ''}.jpg`;

// 소개서와 같은 구성의 층별 안내: 층을 고르면 큰 사진, 도면, 핵심 요소, 세부 사진이 나옵니다
function floorGuide(content, v) {
  const g = v.guide;
  if (!g || !(g.floors || []).length) return '';
  const fl = g.floors;
  return `<section class="sec sec-tone fg" aria-labelledby="h-fg"><div class="wrap">
    <div class="sec-head sec-head-row"><h2 id="h-fg">층별 안내</h2>${hasBrochure(content, v) ? `<a class="arrow-link" href="/brochure?venue=${esc(v.slug)}">소개서(PDF)로 받기 ${ARROW}</a>` : ''}</div>
    ${g.summary ? `<p class="fg-sum">${esc(g.summary)}</p>` : ''}
    <div class="fg-box" data-tabs>
      <div class="tabs fg-tabs" role="tablist" aria-label="층 선택">
        ${fl.map((f, i) => `<button role="tab" type="button" id="fgt-${esc(f.id)}" aria-controls="fgp-${esc(f.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(f.bldg)} <b>${esc(f.floor)}</b></button>`).join('')}
      </div>
      ${fl.map((f, i) => `<div class="fg-pane" role="tabpanel" id="fgp-${esc(f.id)}" aria-labelledby="fgt-${esc(f.id)}"${i === 0 ? '' : ' hidden'} data-gallery>
        <button type="button" class="gal-item fg-main" data-full="${asset(v, f.id)}" data-cap="${esc(`${f.bldg} ${f.floor} · ${f.sub}`)}" aria-label="${esc(`${f.bldg} ${f.floor}`)} 사진 크게 보기"><img src="${asset(v, f.id, true)}" alt="${esc(`${v.name} ${f.bldg} ${f.floor}`)}" loading="lazy" decoding="async" width="720" height="720"></button>
        <div class="fg-side">
          <p class="en" lang="en">${esc(f.bldg.replace('동', ''))} BUILDING — ${esc(f.floor)}</p>
          <h3>${esc(f.bldg)} ${esc(f.floor)}<small>${esc(f.sub)}</small></h3>
          <p class="fg-hl"><span class="fg-k">핵심 요소</span>${f.highlights.map((h) => `<span>${esc(h)}</span>`).join('')}</p>
          <figure class="fg-plan">
            <button type="button" class="gal-item" data-full="/assets/venue/${esc(v.slug)}/${esc(f.id)}-plan.jpg" data-cap="${esc(`${f.bldg} ${f.floor} 도면`)}" aria-label="도면 크게 보기"><img src="/assets/venue/${esc(v.slug)}/${esc(f.id)}-plan.jpg" alt="${esc(`${f.bldg} ${f.floor} 도면`)}" loading="lazy" decoding="async"></button>
            <figcaption>${(g.legend || []).map(([c, l]) => `<span><i style="background:${esc(c)}"></i>${esc(l)}</span>`).join('')}</figcaption>
          </figure>
          <div class="fg-details">${(f.details || []).map(([id, cap]) => `<figure><button type="button" class="gal-item" data-full="${asset(v, id)}" data-cap="${esc(`${f.bldg} ${f.floor} · ${cap}`)}" aria-label="${esc(cap)} 크게 보기"><img src="${asset(v, id, true)}" alt="" loading="lazy" decoding="async" width="669" height="355"></button><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div>
        </div>
      </div>`).join('')}
    </div>
  </div></section>`;
}

// 가까운 역: 소개서처럼 걸어서 걸리는 시간을 크게 보여 줍니다
function stationList(v) {
  return v.access.map((a) => {
    const min = String(a.value).match(/(\d+)\s*분/);
    return `<li>${min ? `<span class="st-min"><b>${min[1].padStart(2, '0')}</b><small>분</small></span>` : '<span class="st-min st-min-text"></span>'}<span class="st-name">${esc(a.label)}<small>${esc(a.value)}</small></span></li>`;
  }).join('');
}

// 구글드라이브 영상: 미리보기 이미지를 누르면 드라이브 플레이어가 열립니다.
function driveVideos(ids, label) {
  if (!ids || !ids.length) return '';
  return `<div class="dvs"><h3>현장 영상</h3><div class="dv-grid">${ids
    .map((id, i) => `<button type="button" class="dv" data-dv="${esc(id)}" aria-label="${esc(label)} 영상 ${i + 1} 재생"><img src="/media/dv/${esc(id)}" alt="" loading="lazy" width="480" height="270"><span class="play" aria-hidden="true"></span></button>`)
    .join('')}</div></div>`;
}

const ogImage = (content, type, id) => {
  const m = content.media[`${type}:${id}`];
  return m && m.length ? `/media/${m[0].id}` : '';
};

function caseCard(content, c) {
  const v = venueBy(content, c.venue);
  const cover = coverOf(content, 'case', c.id, c.video);
  return `<article class="case">
    <a class="case-media${cover ? '' : ' is-empty'}" href="/cases#${esc(c.id)}" tabindex="-1" aria-hidden="true">${
      cover ? `<img src="${esc(cover.sm)}" alt="" loading="lazy" decoding="async" width="${cover.w || 480}" height="${cover.h || 360}">` : `<span>${esc(c.type || '')}</span>`
    }</a>
    <p class="case-meta">${v ? esc(short(v)) : ''}${c.date ? `<span>${esc(c.date)}</span>` : ''}</p>
    <h3 class="case-title"><a href="/cases#${esc(c.id)}">${esc(c.title)}</a></h3>
    <p class="case-sum">${esc(c.summary)}</p>
  </article>`;
}

function ctaBand(title, text, venue = '', label = '대관 문의하기') {
  return `<section class="cta">
    <div class="wrap cta-in">
      <div><h2>${title}</h2><p>${text}</p></div>
      <div class="cta-btns">
        <a class="btn btn-white btn-lg" href="/inquiry${venue ? `?venue=${esc(venue)}` : ''}">${label}</a>
        <a class="btn btn-ghost btn-lg" href="/my">내 문의 조회</a>
      </div>
    </div>
  </section>`;
}

// ── 홈·공간 목록 공통 ─────────────────────────────────────────
const STAT_PREFIX = ['대지', '루프탑', '주차', '깊이', '층고'];
const statChips = (v, n = 3) => v.stats.filter((x) => x.label !== '진행 사례').slice(0, n).map((x) => (STAT_PREFIX.includes(x.label) ? `${x.label} ${x.value}` : x.value));
const stationBadge = (v) => {
  const a = v.access[0];
  if (!a) return '';
  return `${a.label.split(' ').pop()} ${a.value.replace(/^도보\s*(약\s*)?/, '')}`;
};
const shortAddr = (v) => (v.address || v.district || '').replace(/^서울\s*/, '');
const matchesType = (v, label) => {
  const row = USE_ROWS.find(([l]) => l === label);
  return !!row && (v.uses || []).some((u) => row[1].some((k) => u.includes(k)));
};
const smOf = (src) => (/^\/assets\/venue\/.+\.jpg$/.test(src) ? src.replace(/\.jpg$/, '.sm.jpg') : src);

function typeChips(active = '', base = '/venues') {
  return `<nav class="chips" aria-label="행사 종류로 공간 찾기">
    <a href="${base}"${active ? '' : ' aria-current="true"'}>전체</a>
    ${USE_ROWS.map(([label]) => `<a href="${base}?type=${encodeURIComponent(label)}"${active === label ? ' aria-current="true"' : ''}>${esc(label)}</a>`).join('')}
  </nav>`;
}

function venueCard(content, v, { dim = false } = {}) {
  const soon = v.status !== 'open';
  if (soon) {
    return `<article class="vc is-soon">
      <div class="vc-fig"><div class="vc-blank"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/></svg>오픈 준비 중</div></div></div>
      <div class="vc-body">
        <div><h3><a href="/venues/${esc(v.slug)}">${esc(v.name)}</a></h3><p class="vc-addr">${esc(v.headline)}</p></div>
        <div class="vc-btns" style="grid-template-columns:1fr"><a class="btn btn-black btn-sm" href="/inquiry?venue=${esc(v.slug)}">오픈 알림 신청</a></div>
      </div>
    </article>`;
  }
  const cover = coverOf(content, 'venue', v.slug, '');
  const badge = stationBadge(v);
  return `<article class="vc${dim ? ' is-dim' : ''}">
    <a class="vc-fig" href="/venues/${esc(v.slug)}" tabindex="-1" aria-hidden="true">${cover ? `<img src="${esc(cover.sm)}" alt="" loading="lazy" decoding="async" width="${cover.w || 720}" height="${cover.h || 540}">` : ''}${badge ? `<span class="vc-badge">${esc(badge)}</span>` : ''}${cover && cover.kind === 'brand' ? '<span class="tag">브랜드 이미지</span>' : ''}</a>
    <div class="vc-body">
      <div><h3><a href="/venues/${esc(v.slug)}">${esc(v.name)}</a></h3><p class="vc-addr">${esc(shortAddr(v))}</p></div>
      <p class="vc-line">${esc(v.headline)}</p>
      <p class="vc-chips">${statChips(v).map((x) => `<span>${esc(x)}</span>`).join('')}</p>
      <div class="vc-btns"><a class="btn btn-line btn-sm" href="/venues/${esc(v.slug)}">공간 보기</a><a class="btn btn-soft btn-sm" href="/inquiry?venue=${esc(v.slug)}">견적 요청</a></div>
      <p class="vc-sub">${hasBrochure(content, v) ? `<a href="/brochure?venue=${esc(v.slug)}">공간소개서 받기</a>` : '<span class="muted">소개서 준비 중</span>'}</p>
    </div>
  </article>`;
}

function compareTable(venues) {
  const sizeOf = (v) => v.stats
    .filter((x) => !['진행 사례', '주차'].includes(x.label))
    .map((x) => (STAT_PREFIX.includes(x.label) ? `${x.label} ${x.value}` : x.value))
    .join(', ') || '–';
  const rows = [
    ['위치', (v) => esc(shortAddr(v))],
    ['규모·구성', (v) => esc(sizeOf(v))],
    ['잘 맞는 행사', (v) => esc((v.uses || []).slice(0, 4).join(', ') || '–')],
    ['가까운 역', (v) => (v.access.length ? esc(`${v.access[0].label} ${v.access[0].value}`) : '–')],
    ['주차', (v) => esc(v.parking || '문의 시 안내')],
  ];
  return `<div class="table-box"><table class="compare">
    <thead><tr><th scope="col"><span class="hp">항목</span></th>${venues.map((v) => `<th scope="col"><a href="/venues/${esc(v.slug)}">${esc(short(v))}</a></th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${venues.map((v) => `<td>${fn(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function hcaseCard(content, c) {
  const v = venueBy(content, c.venue);
  const cover = coverOf(content, 'case', c.id, c.video);
  return `<article class="hcase">
    <a class="hcase-fig${cover ? '' : ' is-empty'}" href="/cases#${esc(c.id)}" tabindex="-1" aria-hidden="true">${cover ? `<img src="${esc(cover.sm)}" alt="" loading="lazy" decoding="async">` : esc(c.type || '')}</a>
    <div class="hcase-body">
      <p class="hcase-meta">${esc([c.type, v ? short(v) : ''].filter(Boolean).join(' · '))}</p>
      <h3><a href="/cases#${esc(c.id)}">${esc(c.title)}</a></h3>
      ${c.date ? `<p class="hcase-date">${esc(c.date)}</p>` : ''}
      <p class="hcase-sum">${esc(c.summary)}</p>
    </div>
  </article>`;
}

const STEPS_SHORT = [
  ['견적 요청', '지점과 날짜, 인원, 행사 종류를 남겨 주세요. 접수번호가 바로 나옵니다.'],
  ['상담·답사', '담당자가 연락드리고, 필요하면 공간을 직접 둘러봅니다.'],
  ['견적 확인', '내 문의 조회에서 견적서를 보고 수락합니다.'],
  ['계약·예약 확정', '계약을 마치면 일정이 확정되고 예약 현황에 반영됩니다.'],
  ['행사 당일', '설치부터 철수까지 약속한 일정대로 공간을 씁니다.'],
];

// ── 홈 ───────────────────────────────────────────────────────
export function homePage(content, origin) {
  const venues = content.venues;
  const s = content.settings;
  const openVenues = venues.filter((v) => v.status === 'open');
  const coming = venues.filter((v) => v.status === 'coming');

  const tiles = openVenues.map((v) => {
    const cover = coverOf(content, 'venue', v.slug, '');
    const big = v.hero_image || cover?.src || '';
    return big ? { v, big, sm: v.hero_image ? smOf(v.hero_image) : cover.sm } : null;
  }).filter(Boolean).slice(0, 3);

  const hero = `<section class="hx">
    <div class="wrap hx-in">
      <div class="hx-text">
        <p class="badge">통건물 대관 브랜드</p>
        <h1>팝업, 행사, 파티, 전시 등<br>공간전문 메자닌을 만나보세요</h1>
        <p class="hx-lead">메자닌 삼성, 북가좌, 한남, 응암.<br>메자닌에서 행사와 모임의 품격을 높여보세요</p>
        <form class="search" id="search" action="/inquiry" method="get" aria-label="공간 찾기">
          <div class="search-grid">
            <label><span>지점</span><select name="venue"><option value="">전체 지점</option>${openVenues.map((v) => `<option value="${esc(v.slug)}">${esc(v.name)}</option>`).join('')}</select></label>
            <label><span>날짜</span><input type="date" name="date"></label>
            <label><span>예상 인원</span><select name="headcount"><option value="">선택</option><option value="50">50명 이하</option><option value="150">50–150명</option><option value="300">150–300명</option><option value="300+">300명 이상</option></select></label>
            <label><span>행사 종류</span><select name="type"><option value="">선택</option>${EVENT_TYPES.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
          </div>
          <div class="search-foot">
            <p>고른 날짜가 비어 있는지, 협의 중인지 바로 알려 드립니다.</p>
            <button class="btn btn-dark" type="submit">예약·견적 문의</button>
          </div>
          <div class="search-out" id="search-out" aria-live="polite" hidden></div>
        </form>
      </div>
      ${tiles.length ? `<div class="mosaic${tiles.length < 3 ? ' is-two' : ''}">${tiles.map((t, i) => `<a class="mosaic-item" href="/venues/${esc(t.v.slug)}"><img src="${esc(i === 0 ? t.big : t.sm)}" alt="${esc(t.v.name)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="mosaic-label">${esc(t.v.name)}</span></a>`).join('')}</div>` : ''}
    </div>
    <div class="wrap hx-chips">${typeChips()}</div>
  </section>`;

  const venueSec = `<section class="sec" aria-labelledby="h-venues">
    <div class="wrap">
      <div class="sec-head sec-head-row">
        <div><h2 id="h-venues">지점</h2><p>모든 지점은 건물이나 층 전체를 한 팀이 씁니다.</p></div>
        <a class="arrow-link" href="/venues">지점 비교 ${ARROW}</a>
      </div>
      <div class="vcs">${venues.map((v) => venueCard(content, v)).join('')}</div>
    </div>
  </section>`;

  const compare = openVenues.length > 1 ? `<section class="sec" aria-labelledby="h-compare">
    <div class="wrap">
      <div class="sec-head"><h2 id="h-compare">한눈에 비교</h2></div>
      ${compareTable(openVenues)}
    </div>
  </section>` : '';

  const staged = mediaOf(content, 'site:use');
  const CAP_TYPE = [['팝업', '팝업스토어'], ['전시', '전시'], ['모임', '브랜드·기업 행사'], ['워크숍', '브랜드·기업 행사'], ['파티', '네트워킹·파티'], ['공연', '공연·쇼케이스'], ['마켓', '마켓'], ['촬영', '촬영']];
  const types = staged.length ? `<section class="sec sec-tone" aria-labelledby="h-types" id="types">
    <div class="wrap">
      <div class="sec-head"><h2 id="h-types">행사별 추천</h2><p>공간을 어떻게 쓸 수 있는지 보여 주는 연출 이미지입니다. 실제 행사는 아래 사례에서 볼 수 있습니다.</p></div>
      <div class="types">${staged.slice(0, 3).map((m) => {
        const t = (CAP_TYPE.find(([k]) => (m.caption || '').includes(k)) || [])[1] || '';
        return `<a class="type-card" href="${t ? `/venues?type=${encodeURIComponent(t)}` : '/venues'}">
          <span class="type-fig">${imgTag(m, { alt: m.caption || '활용 예시' })}${kindTag(m)}</span>
          <h3>${esc(m.caption || '활용 예시')}</h3>
          <p>맞는 공간 보기 ${ARROW}</p>
        </a>`;
      }).join('')}</div>
    </div>
  </section>` : '';

  const cases = content.cases.slice(0, 4);
  const caseSec = cases.length ? `<section class="sec" aria-labelledby="h-cases">
    <div class="wrap">
      <div class="sec-head sec-head-row">
        <h2 id="h-cases">최근 열린 행사</h2>
        <a class="arrow-link" href="/cases">사례 전체 보기 ${ARROW}</a>
      </div>
      <div class="hcases">${cases.map((c) => hcaseCard(content, c)).join('')}</div>
    </div>
  </section>` : '';

  const decks = brochureVenues(content);
  const deckCover = decks.find((v) => ['samsung', 'bukgajwa'].includes(v.slug));
  const hostCover = openVenues.map((v) => coverOf(content, 'venue', v.slug, '')).filter(Boolean)[1];
  const ctas = `<section class="sec" aria-label="공간소개서와 공간 파트너">
    <div class="wrap ccards">
      ${decks.length ? `<div class="ccard is-green">
        <h2>공간소개서 받기</h2>
        <p>층별 도면, 실제 사진, 오시는 길을 담은 지점별 PDF입니다. 연락처를 남기시면 바로 내려받을 수 있습니다.</p>
        ${deckCover ? `<span class="ccard-fig"><img src="/assets/venue/${esc(deckCover.slug)}/deck-cover.jpg" alt="${esc(deckCover.name)} 소개서 표지" loading="lazy" decoding="async"></span>` : ''}
        <a class="btn btn-dark" href="/brochure">소개서 받기</a>
      </div>` : ''}
      <div class="ccard">
        <h2>건물주이신가요?</h2>
        <p>비어 있는 통건물을 메자닌 대관 공간으로 운영합니다. 공간 기획부터 대관 영업, 정산까지 메자닌이 맡고, 호스트센터에서 예약과 매출을 그대로 보여 드립니다.</p>
        ${hostCover ? `<span class="ccard-fig"><img src="${esc(hostCover.sm)}" alt="" loading="lazy" decoding="async"></span>` : ''}
        <a class="btn btn-line" href="/host">공간 파트너 안내</a>
      </div>
    </div>
  </section>`;

  const process = `<section class="sec sec-tone" aria-labelledby="h-process">
    <div class="wrap">
      <div class="sec-head"><h2 id="h-process">대관은 이렇게 진행됩니다</h2></div>
      <ol class="steps">${STEPS_SHORT.map(([t, d]) => `<li><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
    </div>
  </section>`;

  const cta = ctaBand('일정이 정해졌다면,<br>날짜부터 확인해 보세요.', '지점과 날짜, 대략의 규모만 적어 주셔도 됩니다. 접수 후 내 문의 조회에서 견적과 답변을 확인할 수 있습니다.', '', '견적 요청하기');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: s.brand,
    alternateName: s.brand_en,
    url: (s.site_url || origin) + '/',
    slogan: '공간에 여백을, 경험에 깊이를.',
    sameAs: Object.values(s.channels || {}).filter(Boolean),
  };

  return page({ content, origin, path: '/', title: '', body: hero + venueSec + compare + types + caseSec + ctas + process + cta, jsonLd, scripts: ['/assets/js/search.js'] });
}

// ── 공간 목록 ─────────────────────────────────────────────────
export function venuesPage(content, origin, type = '') {
  const venues = content.venues;
  const openVenues = venues.filter((v) => v.status === 'open');
  const t = USE_ROWS.some(([l]) => l === type) ? type : '';
  const fit = t ? openVenues.filter((v) => matchesType(v, t)) : [];
  const list = t ? [...fit, ...openVenues.filter((v) => !fit.includes(v)), ...venues.filter((v) => v.status !== 'open')] : venues;
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">SPACES</p>
      <h1>공간 찾기</h1>
      <p>메자닌 서울의 통건물 공간입니다. 행사 종류로 골라 보고, 건물 구성과 위치를 비교해 보세요.</p>
    </div></section>
    <section class="sec sec-tight"><div class="wrap">
      ${typeChips(t)}
      <div style="height:24px"></div>
      ${t ? `<p class="vfilter-note"><b>${esc(t)}</b>에 잘 맞는 공간 ${fit.length}곳을 먼저 보여 드립니다. 나머지 공간도 구성에 따라 가능하니 문의해 주세요.</p>` : ''}
      <div class="vcs">${list.map((v) => venueCard(content, v, { dim: !!t && !fit.includes(v) })).join('')}</div>
    </div></section>
    ${openVenues.length > 1 ? `<section class="sec" aria-labelledby="h-compare"><div class="wrap">
      <div class="sec-head"><h2 id="h-compare">한눈에 비교</h2></div>
      ${compareTable(openVenues)}
    </div></section>` : ''}
    ${ctaBand('어느 공간이 맞을지 고민된다면', '행사 내용만 알려 주셔도 맞는 공간과 구성을 함께 제안합니다.', '', '견적 요청하기')}`;
  return page({ content, origin, path: '/venues', title: t ? `${t}에 맞는 공간` : '공간 찾기', description: '메자닌 삼성, 북가좌, 한남, 응암(오픈 예정)의 건물 구성과 위치를 비교하고 행사 종류로 공간을 찾아보세요.', body, active: 'venues' });
}

// ── 공간 상세 ─────────────────────────────────────────────────
export function venuePage(content, origin, v) {
  const s = content.settings;
  const coming = v.status === 'coming';
  const media = mediaOf(content, `venue:${v.slug}`);
  const cases = content.cases.filter((c) => c.venue === v.slug);

  const head = `<section class="vhead"><div class="wrap">
    <p class="crumb"><a href="/venues">공간</a></p>
    <p class="en" lang="en">${esc(enName(v))}</p>
    <div class="vhead-row">
      <h1>${esc(v.name)}</h1>
      ${statusChip(v)}
    </div>
    <p class="vhead-line">${esc(v.headline)}</p>
  </div></section>`;

  const first = media[0];
  const rest = media.slice(1);
  const shown = rest.slice(0, 8);
  const photos = media.length ? `<section class="vphotos" aria-label="공간 사진"><div class="wrap" data-gallery>
      ${galBtn(first, v.name, `<span class="vfig">${imgTag(first, { sm: false, alt: first.caption || v.name, lazy: false, extra: ' fetchpriority="high"' })}${kindTag(first)}</span>`)}
      ${shown.length ? `<div class="gal">${shown.map((m, i) => galBtn(m, m.caption || `${v.name} 사진 ${i + 2}`, `${imgTag(m, { alt: m.caption || '' })}${kindTag(m)}${i === shown.length - 1 && rest.length > shown.length ? `<span class="gal-more">사진 ${media.length}장 모두 보기</span>` : ''}`)).join('')}</div>` : ''}
      ${hiddenItems(rest.slice(shown.length))}
      ${brandNote(media)}
    </div></section>` : '';

  const spec = `<section class="sec sec-tight vspec"><div class="wrap">
    ${v.stats.length ? `<dl class="spec">${v.stats.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>` : ''}
    <div class="vhead-cta">
      <a class="btn btn-dark btn-lg" href="/inquiry?venue=${esc(v.slug)}">${coming ? '오픈 알림 신청' : '이 공간 대관 문의'}</a>
      ${hasBrochure(content, v) ? `<a class="btn btn-line btn-lg" href="/brochure?venue=${esc(v.slug)}">공간소개서 받기 (PDF)</a>` : ''}
      ${v.map?.naver ? `<a class="btn btn-line btn-lg" href="${esc(v.map.naver)}" target="_blank" rel="noopener">네이버 지도</a>` : ''}
    </div>
  </div></section>`;

  const about = `<section class="sec sec-tight"><div class="wrap about">
    <div class="about-text">
      <h2>공간 소개</h2>
      <p>${esc(v.summary)}</p>
      ${v.features.length ? `<ul class="ticks">${v.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${v.uses.length ? `<h3>잘 맞는 행사</h3><p class="tags">${v.uses.map((u) => `<span>${esc(u)}</span>`).join('')}</p>` : ''}
    </div>
    ${!coming && (v.video || (v.drive_videos || []).length) ? `<div class="about-video">${v.video ? `<button type="button" class="yt" data-yt="${esc(v.video)}" aria-label="${esc(v.name)} 영상 재생"><img src="https://i.ytimg.com/vi/${esc(v.video)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="play" aria-hidden="true"></span></button><p class="yt-cap">${esc(v.name)} 영상</p>` : ''}${driveVideos(v.drive_videos, v.name)}</div>` : ''}
  </div></section>`;

  const rows = (v.buildings || []).flatMap((b) => b.floors.filter((f) => !f.ghost).map((f, i, arr) => `<tr>
      ${i === 0 ? `<th scope="rowgroup" rowspan="${arr.length}">${esc(b.name)}${b.total ? `<small>${b.total}평</small>` : ''}</th>` : ''}
      <td>${f.f === 'RT' ? '루프탑' : esc(f.f)}</td>
      <td class="num">${f.area ? `${f.area}평` : '<span class="muted">문의</span>'}</td>
      <td>${f.desc ? esc(f.desc) : '<span class="muted">문의 시 안내합니다</span>'}</td>
    </tr>`));

  const plan = (v.buildings || []).length ? `<section class="sec sec-tone" aria-labelledby="h-plan"><div class="wrap">
    <div class="sec-head"><h2 id="h-plan">건물 구성</h2><p>그림에서 층을 누르면 설명이 나옵니다.${v.linked ? ' 건물 사이의 초록 선이 2층을 잇는 메자닌입니다.' : ''}</p></div>
    <div class="plan">
      <div class="plan-fig">${sectionSVG(v)}<p class="sd-cap">${esc(v.headline)}</p></div>
      <div class="table-scroll"><table class="floors">
        <thead><tr><th scope="col">동</th><th scope="col">층</th><th scope="col">면적</th><th scope="col">특징</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>
    </div>
  </div></section>` : `<section class="sec sec-tone"><div class="wrap"><div class="plan-fig plan-fig-solo">${sectionSVG(v)}</div></div></section>`;

  const access = !coming ? `<section class="sec" aria-labelledby="h-access"><div class="wrap two">
    <div>
      <h2 id="h-access">오시는 길</h2>
      <p class="addr">${esc(v.address)}</p>
      ${v.access.length ? `<ul class="stations">${stationList(v)}</ul>` : ''}
      ${v.parking ? `<dl class="rows"><div><dt>주차</dt><dd>${esc(v.parking)}</dd></div></dl>` : ''}
      ${v.map_image ? `<div data-gallery><button type="button" class="gal-item map-img" data-full="${esc(v.map_image)}" data-cap="${esc(v.name)} 주변 지도" aria-label="주변 지도 크게 보기"><img src="${esc(v.map_image)}" alt="${esc(v.name)} 주변 지도와 가까운 역" loading="lazy" decoding="async"></button></div>` : ''}
      <p class="links">
        ${v.map?.naver ? `<a class="btn btn-line" href="${esc(v.map.naver)}" target="_blank" rel="noopener">네이버 지도</a>` : ''}
        ${v.map?.kakao ? `<a class="btn btn-line" href="${esc(v.map.kakao)}" target="_blank" rel="noopener">카카오맵</a>` : ''}
        ${!v.map?.naver && !v.map?.kakao && v.address ? `<a class="btn btn-line" href="https://map.naver.com/p/search/${encodeURIComponent(v.address)}" target="_blank" rel="noopener">지도에서 주소 검색</a>` : ''}
        ${v.instagram ? `<a class="btn btn-line" href="${esc(v.instagram)}" target="_blank" rel="noopener">지점 인스타그램</a>` : ''}
      </p>
    </div>
    <div>
      <h2>예약 현황</h2>
      <p class="hint">확정된 일정과 협의 중인 일정을 표시합니다. 비어 있는 날도 준비 일정이 있을 수 있으니 문의로 확인해 주세요.</p>
      <div class="cal" data-calendar="${esc(v.slug)}"><p class="cal-loading">예약 현황을 불러오는 중입니다.</p></div>
    </div>
  </div></section>` : '';

  const caseSec = cases.length ? `<section class="sec sec-tone" aria-labelledby="h-vcases"><div class="wrap">
    <div class="sec-head sec-head-row"><h2 id="h-vcases">${esc(short(v))}에서 열린 행사</h2><a class="arrow-link" href="/cases">대관 사례 전체 ${ARROW}</a></div>
    <div class="cases">${cases.slice(0, 3).map((c) => caseCard(content, c)).join('')}</div>
  </div></section>` : '';

  const cta = coming
    ? ctaBand(`${esc(v.name)} 오픈 소식을<br>먼저 받아보세요`, '연락처를 남겨 두시면 대관이 열릴 때 가장 먼저 안내합니다.', v.slug, '오픈 알림 신청')
    : ctaBand(`${esc(v.name)} 대관을<br>검토 중이신가요`, '날짜와 대략의 규모만 알려 주셔도 견적을 준비할 수 있습니다.', v.slug);

  const jsonLd = coming ? null : {
    '@context': 'https://schema.org',
    '@type': 'EventVenue',
    name: v.name,
    alternateName: v.name_en,
    description: v.summary,
    url: `${s.site_url || origin}/venues/${v.slug}`,
    address: { '@type': 'PostalAddress', streetAddress: v.address, addressLocality: '서울', addressCountry: 'KR' },
    ...(media[0] ? { image: `${s.site_url || origin}/media/${media[0].id}` } : {}),
  };

  return page({
    content, origin, path: `/venues/${v.slug}`, title: `${v.name} 대관`, active: 'venues', jsonLd, image: ogImage(content, 'venue', v.slug),
    description: `${v.name}${v.address ? ` (${v.address})` : ''}. ${v.headline}. ${v.uses.length ? v.uses.join(', ') + ' 대관 문의.' : ''}`,
    body: head + photos + spec + about + floorGuide(content, v) + plan + access + caseSec + cta,
  });
}

// ── 대관 사례 ─────────────────────────────────────────────────
export function casesPage(content, origin) {
  const venues = content.venues.filter((v) => content.cases.some((c) => c.venue === v.slug));
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">CASES</p>
      <h1>대관 사례</h1>
      <p>메자닌에서 실제로 열린 행사입니다. 비슷한 행사를 준비하고 있다면 어떤 공간을 어떻게 썼는지 참고해 보세요.</p>
      <div class="filters" data-filter role="group" aria-label="지점별 보기">
        <button type="button" class="is-on" data-v="">전체</button>
        ${venues.map((v) => `<button type="button" data-v="${esc(v.slug)}">${esc(short(v))}</button>`).join('')}
      </div>
    </div></section>
    <section class="sec sec-tight"><div class="wrap caselist">
      ${content.cases.map((c) => {
        const v = venueBy(content, c.venue);
        const media = mediaOf(content, `case:${c.id}`);
        const fig = media.length
          ? `<div class="cgal" data-gallery>
              ${galBtn(media[0], c.title, `<span class="cg-main">${imgTag(media[0], { alt: media[0].caption || c.title })}${kindTag(media[0])}</span>`)}
              ${media.length > 1 ? `<div class="cg-row">${media.slice(1, 4).map((m, i) => galBtn(m, m.caption || c.title, `${imgTag(m, { alt: m.caption || '' })}${i === 2 && media.length > 4 ? `<span class="gal-more">+${media.length - 4}</span>` : ''}`)).join('')}</div>` : ''}
              ${hiddenItems(media.slice(4))}
            </div>`
          : c.video
          ? `<button type="button" class="yt" data-yt="${esc(c.video)}" aria-label="${esc(c.title)} 영상 재생"><img src="https://i.ytimg.com/vi/${esc(c.video)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="play" aria-hidden="true"></span></button>`
          : '';
        return `<article class="cdetail${fig ? '' : ' no-fig'}" id="${esc(c.id)}" data-venue="${esc(c.venue)}">
          ${fig ? `<div class="cdetail-fig">${fig}</div>` : ''}
          <div class="cdetail-body">
            <p class="case-meta">${v ? `<a href="/venues/${esc(v.slug)}">${esc(v.name)}</a>` : ''}${c.date ? `<span>${esc(c.date)}</span>` : ''}</p>
            <h2>${esc(c.title)}</h2>
            <p>${esc(c.summary)}</p>
            <dl class="rows rows-sm">
              ${c.type ? `<div><dt>행사 유형</dt><dd>${esc(c.type)}</dd></div>` : ''}
              ${c.scope ? `<div><dt>사용 공간</dt><dd>${esc(c.scope)}</dd></div>` : ''}
              ${(c.facts || []).length ? `<div><dt>규모·운영</dt><dd>${c.facts.map(esc).join(', ')}</dd></div>` : ''}
            </dl>
            ${driveVideos(c.drive_videos, c.title)}
            <p class="links">
              ${v ? `<a class="arrow-link" href="/inquiry?venue=${esc(v.slug)}&type=${encodeURIComponent(c.type || '')}">비슷한 행사 문의 ${ARROW}</a>` : ''}
              ${c.link ? `<a class="text-link" href="${esc(c.link)}" target="_blank" rel="noopener">행사 안내 페이지</a>` : ''}
            </p>
          </div>
        </article>`;
      }).join('')}
    </div></section>
    ${ctaBand('준비 중인 행사를<br>알려 주세요', '행사 성격에 맞는 공간과 구성을 함께 제안합니다.')}`;
  const firstCase = content.cases.find((c) => ogImage(content, 'case', c.id));
  return page({ content, origin, path: '/cases', title: '대관 사례', description: '메자닌 삼성·북가좌·한남에서 열린 팝업, 마켓, 공연, 네트워킹 파티 사례.', body, active: 'cases', image: firstCase ? ogImage(content, 'case', firstCase.id) : '' });
}

// ── 대관 문의 ─────────────────────────────────────────────────
export function inquiryPage(content, origin) {
  const venues = content.venues.map((v) => ({ slug: v.slug, name: v.name, status: v.status, district: v.district, zones: v.zone_options || [] }));
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">INQUIRY</p>
      <h1>대관 문의·견적 요청</h1>
      <p>아는 만큼만 적어 주세요. 정해지지 않은 항목은 비워 두셔도 접수됩니다. 접수 후 발급되는 접수번호로 견적과 답변을 확인할 수 있습니다.</p>
    </div></section>
    <section class="sec sec-tight"><div class="wrap form-wrap">
      <form id="inq" class="form" novalidate>
        <fieldset>
          <legend><span class="step-no">1</span>지점과 공간</legend>
          <div class="pick" role="radiogroup" aria-label="지점 선택">
            ${venues.map((v) => `<label class="pick-item"><input type="radio" name="venue" value="${esc(v.slug)}"><span><b>${esc(v.name)}</b><small>${esc(v.status === 'coming' ? '오픈 알림 신청' : v.district)}</small></span></label>`).join('')}
            <label class="pick-item"><input type="radio" name="venue" value=""><span><b>아직 못 정했어요</b><small>맞는 지점을 추천받기</small></span></label>
          </div>
          <div class="field" id="zones-field" hidden>
            <span class="label" id="zones-label">사용할 공간 <small>여러 개 선택 가능</small></span>
            <div class="checks" id="zones" role="group" aria-labelledby="zones-label"></div>
          </div>
        </fieldset>

        <fieldset data-rental>
          <legend><span class="step-no">2</span>일정</legend>
          <div class="grid2">
            <div class="field"><label for="date_start">시작일</label><input type="date" id="date_start" name="date_start"></div>
            <div class="field"><label for="date_end">종료일</label><input type="date" id="date_end" name="date_end"></div>
            <div class="field"><label for="time_start">시작 시간</label><input type="time" id="time_start" name="time_start" step="1800"></div>
            <div class="field"><label for="time_end">종료 시간</label><input type="time" id="time_end" name="time_end" step="1800"></div>
          </div>
          <p class="avail" id="avail" aria-live="polite" hidden></p>
          <p class="hint">설치와 철수에 필요한 날짜까지 포함해서 적어 주세요.</p>
          <label class="check"><input type="checkbox" name="date_flexible" value="1"><span>날짜를 조정할 수 있습니다</span></label>
        </fieldset>

        <fieldset data-rental>
          <legend><span class="step-no">3</span>행사 내용</legend>
          <div class="grid2">
            <div class="field"><label for="event_type">행사 유형</label>
              <select id="event_type" name="event_type"><option value="">선택</option>${EVENT_TYPES.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
            <div class="field"><label for="headcount">예상 인원</label><input type="number" id="headcount" name="headcount" min="1" max="100000" inputmode="numeric" placeholder="예: 150"></div>
            <div class="field"><label for="event_name">행사명 또는 브랜드</label><input type="text" id="event_name" name="event_name" maxlength="80"></div>
            <div class="field"><label for="budget">대관 예산</label>
              <select id="budget" name="budget">${BUDGETS.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
          </div>
          <div class="field">
            <span class="label" id="opt-label">필요한 것 <small>해당하는 항목 모두</small></span>
            <div class="checks" role="group" aria-labelledby="opt-label">${OPTION_LIST.map((o) => `<label class="check"><input type="checkbox" name="options" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>
          </div>
        </fieldset>

        <fieldset>
          <legend><span class="step-no" data-step-contact>4</span>문의 내용과 연락처</legend>
          <div class="field"><label for="message">문의 내용</label><textarea id="message" name="message" rows="5" maxlength="3000" placeholder="행사 개요, 필요한 설비, 궁금한 점을 자유롭게 적어 주세요."></textarea></div>
          <div class="grid2">
            <div class="field"><label for="name">담당자 이름 <em>필수</em></label><input type="text" id="name" name="name" maxlength="40" autocomplete="name" required></div>
            <div class="field"><label for="company">회사·단체명</label><input type="text" id="company" name="company" maxlength="80" autocomplete="organization"></div>
            <div class="field"><label for="phone">연락처 <em>필수</em></label><input type="tel" id="phone" name="phone" maxlength="30" autocomplete="tel" inputmode="tel" placeholder="010-0000-0000" required></div>
            <div class="field"><label for="email">이메일</label><input type="email" id="email" name="email" maxlength="120" autocomplete="email" placeholder="견적서를 받을 주소"></div>
          </div>
          <div class="field">
            <span class="label" id="pref-label">편한 연락 방법</span>
            <div class="checks" role="radiogroup" aria-labelledby="pref-label">
              ${['전화', '문자', '이메일', '카카오톡'].map((o, i) => `<label class="check"><input type="radio" name="contact_pref" value="${o}"${i === 0 ? ' checked' : ''}><span>${o}</span></label>`).join('')}
            </div>
          </div>
          <div class="hp" aria-hidden="true"><label>이 칸은 비워 두세요<input type="text" name="hp" tabindex="-1" autocomplete="off"></label></div>
          <label class="check agree"><input type="checkbox" name="agree" value="1" required><span>문의 응대를 위한 개인정보 수집·이용에 동의합니다. <small>이름, 연락처, 이메일, 회사명을 상담과 견적 안내 목적으로만 사용하고, 목적을 달성하면 지체 없이 파기합니다(법령에 따라 보관해야 하는 경우는 제외).</small></span></label>
        </fieldset>

        <p class="form-error" id="inq-error" role="alert" hidden></p>
        <button class="btn btn-dark btn-lg btn-block" type="submit" id="inq-submit">문의 접수하기</button>
      </form>

      <div id="inq-done" class="done" hidden tabindex="-1">
        <h2>문의가 접수됐습니다</h2>
        <p>접수번호를 보관해 주세요. 견적과 답변은 아래 주소에서 확인할 수 있습니다.</p>
        <p class="done-code"><span>접수번호</span><strong id="done-code"></strong></p>
        <p class="links"><a class="btn btn-dark btn-lg" id="done-link" href="/my">내 문의 확인하기</a><button class="btn btn-line btn-lg" type="button" id="done-copy">조회 주소 복사</button></p>
        <p class="hint">조회 주소를 잃어버려도 접수번호와 연락처로 다시 찾을 수 있습니다.</p>
      </div>

      <aside class="form-side">
        <h2>접수 후에는</h2>
        <ol class="mini-steps">
          <li>담당자가 내용을 확인하고 연락드립니다.</li>
          <li>공간과 일정에 맞춘 견적서를 보내드립니다.</li>
          <li>내 문의 조회에서 견적을 확인하고 메시지를 주고받습니다.</li>
        </ol>
        ${content.settings.channels.kakao ? `<p class="side-ch">급한 문의는 <a href="${esc(content.settings.channels.kakao)}" target="_blank" rel="noopener">카카오톡 채널</a>로도 받습니다.</p>` : ''}
      </aside>
    </div></section>
    <script type="application/json" id="venues-data">${JSON.stringify(venues).replace(/</g, '\\u003c')}</script>`;
  return page({ content, origin, path: '/inquiry', title: '대관 문의·견적 요청', description: '메자닌 삼성·북가좌·한남 대관 문의와 견적 요청. 지점, 일정, 행사 내용을 남기면 견적서를 보내드립니다.', body, active: 'inquiry', scripts: ['/assets/js/inquiry.js'], bar: false });
}

// ── 내 문의 조회 ──────────────────────────────────────────────
export function myPage(content, origin) {
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">MY INQUIRY</p>
      <h1>내 문의 조회</h1>
      <p>접수한 문의의 진행 상황과 견적서를 확인하고, 담당자와 메시지를 주고받을 수 있습니다.</p>
    </div></section>
    <section class="sec sec-tight"><div class="wrap">
      <form id="lookup" class="form lookup" novalidate>
        <div class="grid2">
          <div class="field"><label for="l-code">접수번호</label><input type="text" id="l-code" name="code" placeholder="MZ-000000-XXXX" autocapitalize="characters" required></div>
          <div class="field"><label for="l-phone">문의할 때 적은 연락처</label><input type="tel" id="l-phone" name="phone" placeholder="010-0000-0000" inputmode="tel" required></div>
        </div>
        <p class="form-error" id="lookup-error" role="alert" hidden></p>
        <button class="btn btn-dark btn-lg" type="submit">문의 찾기</button>
      </form>
      <div id="my" hidden></div>
    </div></section>`;
  return page({ content, origin, path: '/my', title: '내 문의 조회', body, active: 'my', scripts: ['/assets/js/my.js'], noindex: true, bar: false });
}

// ── 이용 안내 ─────────────────────────────────────────────────
export function guidePage(content, origin) {
  const ch = content.settings.channels;
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">GUIDE</p>
      <h1>이용 안내</h1>
      <p>대관 절차와 자주 받는 질문을 모았습니다.</p>
    </div></section>
    <section class="sec sec-tight" aria-labelledby="g-process"><div class="wrap">
      <div class="sec-head"><h2 id="g-process">대관 절차</h2></div>
      <ol class="steps">${PROCESS.map(([t, d]) => `<li><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
    </div></section>
    <section class="sec sec-mist" aria-labelledby="g-notes"><div class="wrap two">
      <div>
        <h2 id="g-notes">사용 전에 알아두실 것</h2>
        <ul class="ticks">${(content.guide.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        <p class="hint">지점과 행사 성격에 따라 세부 조건이 다를 수 있으며, 정확한 내용은 계약 시 안내합니다.</p>
      </div>
      <div>
        <h2>문의 채널</h2>
        <dl class="rows">
          <div><dt>대관 문의</dt><dd><a href="/inquiry">문의·견적 요청 양식</a></dd></div>
          ${ch.kakao ? `<div><dt>카카오톡</dt><dd><a href="${esc(ch.kakao)}" target="_blank" rel="noopener">카카오톡 채널</a></dd></div>` : ''}
          ${ch.instagram ? `<div><dt>인스타그램</dt><dd><a href="${esc(ch.instagram)}" target="_blank" rel="noopener">@mezzanine.seoul</a></dd></div>` : ''}
          ${ch.blog ? `<div><dt>블로그</dt><dd><a href="${esc(ch.blog)}" target="_blank" rel="noopener">네이버 블로그</a></dd></div>` : ''}
          ${content.settings.contact.phone ? `<div><dt>전화</dt><dd>${esc(content.settings.contact.phone)}${content.settings.contact.hours ? ` (${esc(content.settings.contact.hours)})` : ''}</dd></div>` : ''}
        </dl>
      </div>
    </div></section>
    <section class="sec" aria-labelledby="g-faq"><div class="wrap narrow">
      <div class="sec-head"><h2 id="g-faq">자주 묻는 질문</h2></div>
      <div class="faq">${content.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
    </div></section>
    ${ctaBand('더 궁금한 점은 문의로 남겨 주세요', '문의 내용에 질문을 적어 주시면 담당자가 답변드립니다.')}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return page({ content, origin, path: '/guide', title: '이용 안내', description: '메자닌 서울 대관 절차, 이용 안내, 자주 묻는 질문.', body, active: 'guide', jsonLd });
}

export function notFoundPage(content, origin, path) {
  const body = `<section class="phead"><div class="wrap">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소가 바뀌었거나 없는 페이지입니다.</p>
      <p class="links"><a class="btn btn-dark" href="/">홈으로 가기</a><a class="btn btn-line" href="/venues">공간 보기</a></p>
    </div></section>`;
  return page({ content, origin, path, title: '페이지를 찾을 수 없습니다', body, noindex: true });
}
