import { esc } from '../util.js';
import { page, coverOf, venueBy, statusChip } from './layout.js';
import { sectionSVG } from './diagram.js';
import { EVENT_TYPES, OPTION_LIST, BUDGETS } from '../seed.js';

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

// 구글드라이브 영상: 미리보기 이미지를 누르면 드라이브 플레이어가 열립니다.
function driveVideos(ids, label) {
  if (!ids || !ids.length) return '';
  return `<div class="dvs"><h3>현장 영상</h3><div class="dv-grid">${ids
    .map((id, i) => `<button type="button" class="dv" data-dv="${esc(id)}" aria-label="${esc(label)} 영상 ${i + 1} 재생"><img src="/media/dv/${esc(id)}" alt="" loading="lazy" width="480" height="270"><span class="yt-play" aria-hidden="true"></span></button>`)
    .join('')}</div></div>`;
}

const ogImage = (content, type, id) => {
  const m = content.media[`${type}:${id}`];
  return m && m.length ? `/media/${m[0].id}` : '';
};

const venueSpec = (v) => v.stats.slice(0, 3).map((s) => `<span><b>${esc(s.value)}</b> ${esc(s.label)}</span>`).join('');

function caseCard(content, c, { heading = 'h3' } = {}) {
  const v = venueBy(content, c.venue);
  const cover = coverOf(content, 'case', c.id, c.video);
  const media = cover
    ? `<img src="${esc(cover.src)}" alt="" loading="lazy" width="${cover.w || 480}" height="${cover.h || 360}">`
    : `<span class="case-ph" aria-hidden="true">${esc(c.type || '')}</span>`;
  return `<article class="case" data-venue="${esc(c.venue)}">
    <a class="case-media${cover ? '' : ' is-empty'}" href="/cases#${esc(c.id)}" tabindex="-1" aria-hidden="true">${media}</a>
    <div class="case-body">
      <p class="case-meta">${v ? esc(v.name) : ''}${c.date ? `<span>${esc(c.date)}</span>` : ''}</p>
      <${heading} class="case-title"><a href="/cases#${esc(c.id)}">${esc(c.title)}</a></${heading}>
      <p class="case-sum">${esc(c.summary)}</p>
    </div>
  </article>`;
}

// ── 홈 ───────────────────────────────────────────────────────
export function homePage(content, origin) {
  const venues = content.venues;
  const first = venues[0];
  const s = content.settings;
  const openVenues = venues.filter((v) => v.status === 'open');

  const hero = `<section class="hero">
    <div class="wrap hero-in">
      <div class="hero-copy">
        <h1>건물 한 채를<br>통째로 빌립니다</h1>
        <p class="hero-lead">메자닌 서울은 서로 다른 건물을 2층에서 이어 붙인 복합 대관 공간입니다. 팝업과 전시, 브랜드 행사, 공연을 한 동부터 건물 전체까지 필요한 만큼 열 수 있습니다.</p>
        <div class="hero-cta">
          <a class="btn btn-point btn-lg" href="/inquiry">대관 문의하기</a>
          <a class="btn btn-line btn-lg" href="/venues">지점 둘러보기</a>
        </div>
        <dl class="hero-facts">
          <div><dt>지점</dt><dd>삼성 · 북가좌 · 한남</dd></div>
          <div><dt>규모</dt><dd>삼성·북가좌 약 600평</dd></div>
          <div><dt>오픈 예정</dt><dd>응암</dd></div>
        </dl>
      </div>
      <div class="hero-fig" data-tabs>
        <div class="tabs" role="tablist" aria-label="지점별 건물 구성">
          ${venues.map((v, i) => `<button role="tab" type="button" id="tab-${esc(v.slug)}" aria-controls="pane-${esc(v.slug)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(v.name.replace('메자닌 ', ''))}</button>`).join('')}
        </div>
        ${venues.map((v, i) => `<div class="pane" role="tabpanel" id="pane-${esc(v.slug)}" aria-labelledby="tab-${esc(v.slug)}"${i === 0 ? '' : ' hidden'}>
          ${sectionSVG(v)}
          <div class="pane-foot">
            <p class="sd-cap" data-default="${esc(v.headline)}">${esc(v.headline)}</p>
            <a class="more" href="/venues/${esc(v.slug)}">${esc(v.name)} 자세히 보기</a>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;

  const index = `<section class="sec" aria-labelledby="h-venues">
    <div class="wrap">
      <div class="sec-head">
        <h2 id="h-venues">지점</h2>
        <p>서울 네 곳. 건물의 생김새와 동네가 모두 달라 행사 성격에 맞춰 고를 수 있습니다.</p>
      </div>
      <ul class="vlist">
        ${venues.map((v) => `<li>
          <a class="vrow" href="/venues/${esc(v.slug)}">
            <span class="vrow-name">${esc(v.name)}</span>
            <span class="vrow-where">${esc(v.district)}</span>
            <span class="vrow-spec">${v.status === 'coming' ? '<span>공간 정보는 오픈과 함께 공개합니다</span>' : venueSpec(v)}</span>
            ${statusChip(v)}
          </a>
        </li>`).join('')}
      </ul>
    </div>
  </section>`;

  const why = `<section class="sec sec-mist" aria-labelledby="h-why">
    <div class="wrap why">
      <div class="why-head">
        <h2 id="h-why">메자닌은 건물 사이를 잇는 층입니다</h2>
        <p>메자닌 서울은 따로 서 있던 건물들을 2층에서 연결했습니다. 건물마다 구조와 분위기가 달라서, 하나의 행사 안에 전혀 다른 장면을 여러 개 만들 수 있습니다.</p>
      </div>
      <ul class="why-list">
        <li><h3>한 동만, 또는 전부</h3><p>행사 규모에 맞춰 한 층이나 한 동만 쓸 수도, 세 동과 마당을 모두 열 수도 있습니다. 쓰는 만큼만 견적을 냅니다.</p></li>
        <li><h3>2층에서 이어지는 동선</h3><p>관람객이 밖으로 나오지 않고 건물 사이를 오갑니다. 전시와 판매, 공연과 리셉션을 동마다 나눠 배치하기 좋습니다.</p></li>
        <li><h3>실내와 마당을 함께</h3><p>중정과 테라스, 루프탑까지 한 번에 씁니다. 대기 줄이나 야외 프로그램을 건물 안쪽에서 해결할 수 있습니다.</p></li>
      </ul>
    </div>
  </section>`;

  const uses = `<section class="sec" aria-labelledby="h-uses">
    <div class="wrap">
      <div class="sec-head">
        <h2 id="h-uses">어떤 행사를 어디에서</h2>
        <p>지금까지 지점별로 진행했거나 구조상 잘 맞는 행사입니다. 표에 없는 형태도 문의 주시면 검토합니다.</p>
      </div>
      <div class="table-scroll">
        <table class="matrix">
          <thead><tr><th scope="col">행사</th>${openVenues.map((v) => `<th scope="col"><a href="/venues/${esc(v.slug)}">${esc(v.name.replace('메자닌 ', ''))}</a></th>`).join('')}</tr></thead>
          <tbody>
            ${USE_ROWS.map(([label, keys]) => `<tr><th scope="row">${label}</th>${openVenues.map((v) => {
              const ok = (v.uses || []).some((u) => keys.some((k) => u.includes(k)));
              return `<td>${ok ? '<span class="dot" role="img" aria-label="가능"></span>' : '<span class="nodot" role="img" aria-label="문의"></span>'}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;

  const cases = content.cases.slice(0, 3);
  const caseSec = cases.length ? `<section class="sec sec-mist" aria-labelledby="h-cases">
    <div class="wrap">
      <div class="sec-head sec-head-row">
        <div><h2 id="h-cases">이런 행사가 열렸습니다</h2></div>
        <a class="more" href="/cases">대관 사례 전체 보기</a>
      </div>
      <div class="cases cases-3">${cases.map((c) => caseCard(content, c)).join('')}</div>
    </div>
  </section>` : '';

  const process = `<section class="sec" aria-labelledby="h-process">
    <div class="wrap">
      <div class="sec-head"><h2 id="h-process">대관은 이렇게 진행됩니다</h2></div>
      <ol class="steps">
        ${PROCESS.map(([t, d]) => `<li><h3>${t}</h3><p>${d}</p></li>`).join('')}
      </ol>
    </div>
  </section>`;

  const cta = ctaBand('행사 일정이 정해졌다면 먼저 날짜부터 확인하세요', '지점과 날짜, 대략의 규모만 적어 주셔도 됩니다. 접수 후 내 문의 조회에서 견적과 답변을 확인할 수 있습니다.');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: s.brand,
    alternateName: s.brand_en,
    url: (s.site_url || origin) + '/',
    sameAs: Object.values(s.channels || {}).filter(Boolean),
  };

  return page({ content, origin, path: '/', title: '', body: hero + index + why + uses + caseSec + process + cta, jsonLd });
}

function ctaBand(title, text, venue = '') {
  return `<section class="cta">
    <div class="wrap cta-in">
      <div><h2>${title}</h2><p>${text}</p></div>
      <div class="cta-btns">
        <a class="btn btn-white btn-lg" href="/inquiry${venue ? `?venue=${esc(venue)}` : ''}">대관 문의하기</a>
        <a class="btn btn-ghost btn-lg" href="/my">내 문의 조회</a>
      </div>
    </div>
  </section>`;
}

// ── 지점 목록 ─────────────────────────────────────────────────
export function venuesPage(content, origin) {
  const body = `<section class="phead"><div class="wrap">
      <h1>지점</h1>
      <p>메자닌 서울의 네 지점입니다. 건물 구성과 위치를 비교해 보고, 맞는 곳에 문의를 남겨 주세요.</p>
    </div></section>
    <section class="sec sec-tight"><div class="wrap vcards">
      ${content.venues.map((v) => {
        const cover = coverOf(content, 'venue', v.slug, '');
        return `<article class="vcard">
          <a class="vcard-fig" href="/venues/${esc(v.slug)}" aria-hidden="true" tabindex="-1">${cover ? `<img src="${esc(cover.src)}" alt="" loading="lazy">` : sectionSVG(v)}</a>
          <div class="vcard-body">
            <p class="vcard-top">${statusChip(v)}<span>${esc(v.district)}</span></p>
            <h2><a href="/venues/${esc(v.slug)}">${esc(v.name)}</a></h2>
            <p class="vcard-sum">${esc(v.headline)}</p>
            ${v.stats.length ? `<dl class="spec">${v.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>` : ''}
            <p class="vcard-links"><a class="btn btn-line" href="/venues/${esc(v.slug)}">공간 자세히 보기</a><a class="btn btn-point" href="/inquiry?venue=${esc(v.slug)}">${v.status === 'coming' ? '오픈 알림 신청' : '이 지점 문의'}</a></p>
          </div>
        </article>`;
      }).join('')}
    </div></section>`;
  return page({ content, origin, path: '/venues', title: '지점 안내', description: '메자닌 삼성, 북가좌, 한남, 응암(오픈 예정)의 건물 구성과 위치를 비교해 보세요.', body, active: 'venues' });
}

// ── 지점 상세 ─────────────────────────────────────────────────
export function venuePage(content, origin, v) {
  const s = content.settings;
  const coming = v.status === 'coming';
  const media = content.media[`venue:${v.slug}`] || [];
  const cases = content.cases.filter((c) => c.venue === v.slug);

  const head = `<section class="vhead"><div class="wrap">
    <p class="crumb"><a href="/venues">지점</a></p>
    <div class="vhead-row">
      <div>
        <h1>${esc(v.name)}</h1>
        <p class="vhead-en" lang="en">${esc(v.name_en || '')}</p>
      </div>
      ${statusChip(v)}
    </div>
    <p class="vhead-line">${esc(v.headline)}</p>
    ${v.stats.length ? `<dl class="spec spec-lg">${v.stats.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>` : ''}
    <div class="vhead-cta">
      <a class="btn btn-point btn-lg" href="/inquiry?venue=${esc(v.slug)}">${coming ? '오픈 알림 신청' : '이 지점 대관 문의'}</a>
      ${v.brochure ? `<a class="btn btn-line btn-lg" href="${esc(v.brochure)}" target="_blank" rel="noopener">공간 소개서 (PDF)</a>` : ''}
      ${v.map?.naver ? `<a class="btn btn-line btn-lg" href="${esc(v.map.naver)}" target="_blank" rel="noopener">네이버 지도</a>` : ''}
    </div>
  </div></section>`;

  const gallery = media.length
    ? `<section class="sec sec-tight" aria-label="공간 사진"><div class="wrap">
        <div class="gal gal-${Math.min(media.length, 5)}" data-gallery>
          ${media.slice(0, 5).map((m, i) => `<button type="button" class="gal-item" data-full="/media/${m.id}" data-cap="${esc(m.caption || '')}"><img src="/media/${m.id}" alt="${esc(m.caption || `${v.name} 사진 ${i + 1}`)}" ${i ? 'loading="lazy"' : ''} width="${m.width || 1600}" height="${m.height || 1067}">${i === 4 && media.length > 5 ? `<span class="gal-more">사진 ${media.length}장 모두 보기</span>` : ''}</button>`).join('')}
          ${media.slice(5).map((m) => `<button type="button" class="gal-item" hidden data-full="/media/${m.id}" data-cap="${esc(m.caption || '')}"></button>`).join('')}
        </div>
      </div></section>`
    : '';

  const about = `<section class="sec sec-tight"><div class="wrap about">
    <div class="about-text">
      <h2>공간 소개</h2>
      <p>${esc(v.summary)}</p>
      ${v.features.length ? `<ul class="ticks">${v.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${v.uses.length ? `<h3>잘 맞는 행사</h3><p class="tags">${v.uses.map((u) => `<span>${esc(u)}</span>`).join('')}</p>` : ''}
    </div>
    ${!coming && (v.video || (v.drive_videos || []).length) ? `<div class="about-video">${v.video ? `<button type="button" class="yt" data-yt="${esc(v.video)}" aria-label="${esc(v.name)} 영상 재생"><img src="https://i.ytimg.com/vi/${esc(v.video)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="yt-play" aria-hidden="true"></span></button><p class="yt-cap">${esc(v.name)} 영상</p>` : ''}${driveVideos(v.drive_videos, v.name)}</div>` : ''}
  </div></section>`;

  const rows = (v.buildings || []).flatMap((b) => b.floors.filter((f) => !f.ghost).map((f, i, arr) => `<tr>
      ${i === 0 ? `<th scope="rowgroup" rowspan="${arr.length}">${esc(b.name)}${b.total ? `<small>${b.total}평</small>` : ''}</th>` : ''}
      <td>${f.f === 'RT' ? '루프탑' : esc(f.f)}</td>
      <td class="num">${f.area ? `${f.area}평` : '<span class="muted">문의</span>'}</td>
      <td>${f.desc ? esc(f.desc) : '<span class="muted">문의 시 안내합니다</span>'}</td>
    </tr>`));

  const plan = (v.buildings || []).length ? `<section class="sec sec-mist" aria-labelledby="h-plan"><div class="wrap">
    <div class="sec-head"><h2 id="h-plan">건물 구성</h2><p>그림에서 층을 누르면 설명이 나옵니다.${v.linked ? ' 파란 선이 건물 사이를 잇는 메자닌입니다.' : ''}</p></div>
    <div class="plan">
      <div class="plan-fig">${sectionSVG(v)}<p class="sd-cap" data-default="${esc(v.headline)}">${esc(v.headline)}</p></div>
      <div class="table-scroll"><table class="floors">
        <thead><tr><th scope="col">동</th><th scope="col">층</th><th scope="col">면적</th><th scope="col">특징</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>
    </div>
  </div></section>` : `<section class="sec sec-mist"><div class="wrap"><div class="plan-fig plan-fig-solo">${sectionSVG(v)}</div></div></section>`;

  const access = !coming ? `<section class="sec" aria-labelledby="h-access"><div class="wrap two">
    <div>
      <h2 id="h-access">오시는 길</h2>
      <dl class="rows">
        <div><dt>주소</dt><dd>${esc(v.address)}</dd></div>
        ${v.access.map((a) => `<div><dt>${esc(a.label)}</dt><dd>${esc(a.value)}</dd></div>`).join('')}
        ${v.parking ? `<div><dt>주차</dt><dd>${esc(v.parking)}</dd></div>` : ''}
      </dl>
      <p class="links">
        ${v.map?.naver ? `<a class="btn btn-line" href="${esc(v.map.naver)}" target="_blank" rel="noopener">네이버 지도에서 보기</a>` : ''}
        ${v.map?.kakao ? `<a class="btn btn-line" href="${esc(v.map.kakao)}" target="_blank" rel="noopener">카카오맵에서 보기</a>` : ''}
        ${!v.map?.naver && !v.map?.kakao ? `<a class="btn btn-line" href="https://map.naver.com/p/search/${encodeURIComponent(v.address)}" target="_blank" rel="noopener">지도에서 주소 검색</a>` : ''}
        ${v.instagram ? `<a class="btn btn-line" href="${esc(v.instagram)}" target="_blank" rel="noopener">지점 인스타그램</a>` : ''}
      </p>
    </div>
    <div>
      <h2>예약 현황</h2>
      <p class="hint">확정된 일정과 협의 중인 일정을 표시합니다. 비어 있는 날도 준비 일정이 있을 수 있으니 문의로 확인해 주세요.</p>
      <div class="cal" data-calendar="${esc(v.slug)}"><p class="cal-loading">예약 현황을 불러오는 중입니다.</p></div>
    </div>
  </div></section>` : '';

  const caseSec = cases.length ? `<section class="sec sec-mist" aria-labelledby="h-vcases"><div class="wrap">
    <div class="sec-head"><h2 id="h-vcases">${esc(v.name)}에서 열린 행사</h2></div>
    <div class="cases cases-3">${cases.slice(0, 6).map((c) => caseCard(content, c)).join('')}</div>
  </div></section>` : '';

  const cta = coming
    ? ctaBand(`${esc(v.name)} 오픈 소식을 먼저 받아보세요`, '연락처를 남겨 두시면 대관이 열릴 때 가장 먼저 안내합니다.', v.slug).replace('대관 문의하기', '오픈 알림 신청')
    : ctaBand(`${esc(v.name)} 대관을 검토 중이신가요`, '날짜와 대략의 규모만 알려 주셔도 견적을 준비할 수 있습니다.', v.slug);

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
    body: head + gallery + about + plan + access + caseSec + cta,
  });
}

// ── 대관 사례 ─────────────────────────────────────────────────
export function casesPage(content, origin) {
  const venues = content.venues.filter((v) => content.cases.some((c) => c.venue === v.slug));
  const body = `<section class="phead"><div class="wrap">
      <h1>대관 사례</h1>
      <p>메자닌에서 실제로 열린 행사입니다. 비슷한 행사를 준비하고 있다면 어떤 공간을 어떻게 썼는지 참고해 보세요.</p>
      <div class="filters" data-filter role="group" aria-label="지점별 보기">
        <button type="button" class="is-on" data-v="">전체</button>
        ${venues.map((v) => `<button type="button" data-v="${esc(v.slug)}">${esc(v.name.replace('메자닌 ', ''))}</button>`).join('')}
      </div>
    </div></section>
    <section class="sec sec-tight"><div class="wrap caselist">
      ${content.cases.map((c) => {
        const v = venueBy(content, c.venue);
        const media = content.media[`case:${c.id}`] || [];
        const fig = media.length
          ? `<div class="gal gal-${Math.min(media.length, 3)}" data-gallery>${media.slice(0, 3).map((m, i) => `<button type="button" class="gal-item" data-full="/media/${m.id}" data-cap="${esc(m.caption || '')}"><img src="/media/${m.id}" alt="${esc(m.caption || `${c.title} 사진 ${i + 1}`)}" loading="lazy" width="${m.width || 1600}" height="${m.height || 1067}">${i === 2 && media.length > 3 ? `<span class="gal-more">사진 ${media.length}장</span>` : ''}</button>`).join('')}${media.slice(3).map((m) => `<button type="button" class="gal-item" hidden data-full="/media/${m.id}" data-cap="${esc(m.caption || '')}"></button>`).join('')}</div>`
          : c.video
          ? `<button type="button" class="yt" data-yt="${esc(c.video)}" aria-label="${esc(c.title)} 영상 재생"><img src="https://i.ytimg.com/vi/${esc(c.video)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="yt-play" aria-hidden="true"></span></button>`
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
              ${v ? `<a class="btn btn-line" href="/inquiry?venue=${esc(v.slug)}&type=${encodeURIComponent(c.type || '')}">비슷한 행사 문의</a>` : ''}
              ${c.link ? `<a class="more" href="${esc(c.link)}" target="_blank" rel="noopener">행사 안내 페이지</a>` : ''}
            </p>
          </div>
        </article>`;
      }).join('')}
    </div></section>
    ${ctaBand('준비 중인 행사를 알려 주세요', '행사 성격에 맞는 지점과 공간 구성을 함께 제안합니다.')}`;
  const firstCase = content.cases.find((c) => ogImage(content, 'case', c.id));
  return page({ content, origin, path: '/cases', title: '대관 사례', description: '메자닌 삼성·북가좌·한남에서 열린 팝업, 마켓, 공연, 네트워킹 파티 사례.', body, active: 'cases', image: firstCase ? ogImage(content, 'case', firstCase.id) : '' });
}

// ── 대관 문의 ─────────────────────────────────────────────────
export function inquiryPage(content, origin) {
  const venues = content.venues.map((v) => ({ slug: v.slug, name: v.name, status: v.status, district: v.district, zones: v.zone_options || [] }));
  const body = `<section class="phead"><div class="wrap">
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
        <button class="btn btn-point btn-lg btn-block" type="submit" id="inq-submit">문의 접수하기</button>
      </form>

      <div id="inq-done" class="done" hidden tabindex="-1">
        <h2>문의가 접수됐습니다</h2>
        <p>접수번호를 보관해 주세요. 견적과 답변은 아래 주소에서 확인할 수 있습니다.</p>
        <p class="done-code"><span>접수번호</span><strong id="done-code"></strong></p>
        <p class="links"><a class="btn btn-point btn-lg" id="done-link" href="/my">내 문의 확인하기</a><button class="btn btn-line btn-lg" type="button" id="done-copy">조회 주소 복사</button></p>
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
  return page({ content, origin, path: '/inquiry', title: '대관 문의·견적 요청', description: '메자닌 삼성·북가좌·한남 대관 문의와 견적 요청. 지점, 일정, 행사 내용을 남기면 견적서를 보내드립니다.', body, scripts: ['/assets/js/inquiry.js'] });
}

// ── 내 문의 조회 ──────────────────────────────────────────────
export function myPage(content, origin) {
  const body = `<section class="phead"><div class="wrap">
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
        <button class="btn btn-point btn-lg" type="submit">문의 찾기</button>
      </form>
      <div id="my" hidden></div>
    </div></section>`;
  return page({ content, origin, path: '/my', title: '내 문의 조회', body, active: 'my', scripts: ['/assets/js/my.js'], noindex: true });
}

// ── 이용 안내 ─────────────────────────────────────────────────
export function guidePage(content, origin) {
  const ch = content.settings.channels;
  const body = `<section class="phead"><div class="wrap">
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
      <p class="links"><a class="btn btn-point" href="/">홈으로 가기</a><a class="btn btn-line" href="/venues">지점 보기</a></p>
    </div></section>`;
  return page({ content, origin, path, title: '페이지를 찾을 수 없습니다', body, noindex: true });
}
