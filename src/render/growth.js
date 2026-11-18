// 공간소개서 받기, 공간 파트너(호스트) 안내 페이지
import { esc } from '../util.js';
import { page, coverOf, ARROW } from './layout.js';
import { EVENT_TYPES, PARTNER_MODELS, SITE_BROCHURE } from '../seed.js';

const mb = (n) => `${(n / 1048576).toFixed(1)}MB`;

// ── 공간소개서 받기 ───────────────────────────────────────────
export function brochurePage(content, origin) {
  const B = SITE_BROCHURE;
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">SPACE GUIDE 2026</p>
      <h1>공간소개서 받기</h1>
      <p>삼성·북가좌·한남·응암 네 지점을 한 권에 담았습니다. 지점별 층별 사진과 도면, 대관 사례, 진행 순서, 오시는 길까지 확인하실 수 있습니다. 연락처를 남기시면 바로 내려받을 수 있습니다.</p>
    </div></section>
    <section class="sec sec-tight"><div class="wrap bro">
      <div class="bro-decks">
        <p class="label">받으실 소개서</p>
        <div class="deck is-one">
          <span class="deck-fig"><img src="${esc(B.cover)}" alt="${esc(B.name)} 표지" decoding="async" width="1440" height="810"></span>
          <span class="deck-body">
            <span class="en" lang="en">MEZZANINE SEOUL · SPACE GUIDE</span>
            <b>${esc(B.name)}</b>
            <small>${esc(B.label)} · ${B.pages}쪽 PDF · ${mb(B.size)}</small>
            <span class="deck-list">${B.contents.map((t) => `<span>${esc(t)}</span>`).join('')}</span>
          </span>
        </div>
        <p class="label bro-pages-label">미리 보기</p>
        <div class="bro-pages">${B.previews.map(([src, cap]) => `<figure><img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" decoding="async" width="800" height="450"><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div>
        <div class="bro-prev" id="bro-prev" hidden></div>
      </div>

      <div class="bro-form">
        <form id="bro" class="form" novalidate>
          <input type="hidden" name="venues" value="${esc(B.slug)}">
          <div class="grid2">
            <div class="field"><label for="b-name">이름 <em>필수</em></label><input type="text" id="b-name" name="name" maxlength="40" autocomplete="name" required></div>
            <div class="field"><label for="b-company">회사·브랜드</label><input type="text" id="b-company" name="company" maxlength="80" autocomplete="organization"></div>
            <div class="field"><label for="b-phone">연락처 <em>필수</em></label><input type="tel" id="b-phone" name="phone" maxlength="30" autocomplete="tel" inputmode="tel" placeholder="010-0000-0000" required></div>
            <div class="field"><label for="b-email">이메일 <em>필수</em></label><input type="email" id="b-email" name="email" maxlength="120" autocomplete="email" required></div>
            <div class="field"><label for="b-type">행사 종류</label>
              <select id="b-type" name="event_type"><option value="">아직 정하지 않음</option>${EVENT_TYPES.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
            <div class="field"><label for="b-month">예정 시기</label><input type="month" id="b-month" name="event_month"></div>
          </div>
          <label class="check"><input type="checkbox" name="wants_call" value="1"><span>소개서를 보고 담당자와 바로 상담하고 싶습니다</span></label>
          <div class="hp" aria-hidden="true"><label>이 칸은 비워 두세요<input type="text" name="hp" tabindex="-1" autocomplete="off"></label></div>
          <label class="check agree"><input type="checkbox" name="agree" value="1" required><span>소개서 발송과 대관 상담을 위한 개인정보 수집·이용에 동의합니다. <small>이름, 연락처, 이메일, 회사명, 행사 정보를 소개서 제공과 대관 상담 목적으로만 쓰고, 1년이 지나거나 삭제를 요청하시면 지체 없이 파기합니다.</small></span></label>
          <p class="form-error" id="bro-error" role="alert" hidden></p>
          <button class="btn btn-dark btn-lg btn-block" type="submit" id="bro-submit">소개서 받기</button>
          <p class="hint">요청하시면 바로 내려받을 수 있고, 링크는 30일 동안 다시 쓸 수 있습니다.</p>
        </form>

        <div id="bro-done" class="done" hidden tabindex="-1">
          <h2>소개서가 준비됐습니다</h2>
          <p>아래 버튼을 누르면 PDF 파일을 내려받습니다.</p>
          <div class="dl-list" id="bro-files"></div>
          <p class="hint">링크는 30일 동안 쓸 수 있습니다. 이 브라우저에서 다시 들어오시면 바로 내려받을 수 있습니다.</p>
          <div class="bro-next">
            <p>날짜와 규모가 어느 정도 정해졌다면 견적을 먼저 받아 보세요.</p>
            <a class="btn btn-line" id="bro-inquiry" href="/inquiry">대관 문의로 이어가기 ${ARROW}</a>
          </div>
        </div>
      </div>
    </div></section>`;
  return page({
    content, origin, path: '/brochure', title: '공간소개서 받기', active: 'brochure', scripts: ['/assets/js/brochure.js'], bar: false,
    description: '메자닌 서울 공간소개서 2026(PDF). 삼성·북가좌·한남·응암 네 지점의 층별 사진과 도면, 대관 사례, 진행 순서, 오시는 길을 담았습니다.',
    image: B.cover,
    body,
  });
}

export function brochureErrorPage(content, origin, message) {
  const body = `<section class="phead"><div class="wrap">
      <p class="en" lang="en">VENUE GUIDE</p>
      <h1>소개서를 내려받지 못했습니다</h1>
      <p>${esc(message)}</p>
      <p class="links"><a class="btn btn-dark" href="/brochure">소개서 받기로 가기</a> <a class="btn btn-line" href="/inquiry">대관 문의</a></p>
    </div></section>`;
  return page({ content, origin, path: '/brochure', title: '소개서 내려받기', body, noindex: true });
}

// ── 공간 파트너(건물주) 안내 ──────────────────────────────────
const ROLES = [
  ['공간 기획·연출', '건물 구조를 보고 대관에 맞는 동선과 구역을 나눕니다. 꼭 필요한 곳만 손봐서 비용을 줄입니다.'],
  ['브랜딩과 채널', '메자닌 이름으로 지점 페이지, 소개서, 사진을 만들고 홈페이지와 SNS에 올립니다.'],
  ['대관 영업·예약 관리', '문의 응대, 견적, 계약, 일정 관리를 메자닌 예약 시스템으로 처리합니다.'],
  ['현장 운영', '행사 전후 공간 점검과 설치·철수 안내, 기본 관리를 맡습니다.'],
  ['매출 리포트와 정산', '예약과 매출을 호스트센터에 그대로 보여 드리고, 매달 정산 내역을 정리합니다.'],
];

const FIT = [
  '통건물이거나 여러 층을 한 번에 쓸 수 있는 건물',
  '1층이나 지층으로 바로 드나들 수 있고, 기둥이 적은 넓은 공간',
  '다음 임대나 리모델링·재건축 전까지 비어 있는 기간이 있는 건물',
  '팝업·전시 수요가 있는 상권이나 역세권 가까운 곳',
];

const MODELS = [
  ['위탁 운영', '매출 배분', '건물은 지금 그대로 두고 메자닌이 대관 운영을 맡습니다. 대관 매출을 미리 정한 비율로 나눕니다.'],
  ['임차 운영', '마스터리스', '메자닌이 건물을 임차해 직접 운영합니다. 건물주께는 약속한 임대료가 들어갑니다.'],
  ['단기 활용', '공실 기간만', '다음 임차인이 들어오거나 공사를 시작하기 전까지, 남는 기간만 대관 공간으로 씁니다.'],
];

const STEPS = [
  ['입점 문의', '건물 위치와 규모, 비어 있는 시기를 알려 주세요.'],
  ['현장 확인', '담당자가 건물을 직접 보고 대관에 맞는지 살펴봅니다.'],
  ['운영 제안', '공간 구성과 운영 방식, 예상 일정을 정리해 드립니다.'],
  ['계약', '운영 방식과 조건을 확정하고 계약합니다.'],
  ['오픈 준비', '공간 정비, 촬영, 소개서와 지점 페이지를 준비합니다.'],
  ['운영·정산', '대관을 받기 시작하고, 매달 호스트센터에서 정산 내역을 확인합니다.'],
];

const HOST_FEATURES = [
  ['예약 현황', '확정·협의 중인 일정을 달력으로 봅니다.'],
  ['월별 매출과 가동률', '대관 매출과 공간이 쓰인 날의 비율을 달마다 보여 드립니다.'],
  ['정산 내역', '월별 정산 금액과 지급 상태를 확인합니다.'],
  ['공지와 메시지', '메자닌의 공지를 받고, 담당자와 바로 이야기합니다.'],
];

export function hostPage(content, origin) {
  const venues = content.venues;
  const body = `<section class="phead host-head"><div class="wrap">
      <p class="en" lang="en">SPACE PARTNER</p>
      <h1>비어 있는 통건물을<br>메자닌으로.</h1>
      <p>메자닌은 통건물을 대관 공간으로 기획하고 직접 운영합니다. 공간 연출부터 대관 영업, 현장 운영, 매출 정산까지 맡고, 건물주께는 호스트센터에서 예약과 정산을 그대로 보여 드립니다.</p>
      <p class="links"><a class="btn btn-dark btn-lg" href="#apply">입점 문의하기</a> <a class="btn btn-line btn-lg" href="/host/center">호스트센터 로그인</a></p>
    </div></section>

    <section class="sec sec-tight" aria-labelledby="h-roles"><div class="wrap">
      <div class="sec-head"><h2 id="h-roles">메자닌이 맡는 일</h2><p>건물주께서는 공간만 내어 주시면 됩니다. 운영에 필요한 일은 메자닌이 합니다.</p></div>
      <div class="roles">${ROLES.map(([t, d]) => `<div class="role"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
    </div></section>

    <section class="sec sec-tone" aria-labelledby="h-fit"><div class="wrap two">
      <div>
        <h2 id="h-fit">이런 건물을 찾습니다</h2>
        <ul class="ticks">${FIT.map((f) => `<li>${f}</li>`).join('')}</ul>
        <p class="hint">조건이 다 맞지 않아도 괜찮습니다. 위치와 구조를 보고 쓸 수 있는 방법을 함께 찾아보겠습니다.</p>
      </div>
      <div>
        <h2>운영 방식</h2>
        <div class="models">${MODELS.map(([t, s, d]) => `<div class="model"><h3>${t} <small>${s}</small></h3><p>${d}</p></div>`).join('')}</div>
        <p class="hint">비율과 기간, 비용 분담은 건물 상황에 맞춰 함께 정합니다.</p>
      </div>
    </div></section>

    <section class="sec" aria-labelledby="h-now"><div class="wrap">
      <div class="sec-head sec-head-row"><h2 id="h-now">지금 운영 중인 메자닌</h2><a class="arrow-link" href="/venues">공간 전체 보기 ${ARROW}</a></div>
      <div class="host-venues">${venues.map((v) => {
        const cover = coverOf(content, 'venue', v.slug, '');
        return `<a class="hv" href="/venues/${esc(v.slug)}">
          <span class="hv-fig">${cover ? `<img src="${esc(cover.sm)}" alt="" loading="lazy" decoding="async">` : `<span class="hv-blank" lang="en">${esc((v.name_en || '').toUpperCase())}</span>`}</span>
          <span class="hv-name">${esc(v.name)}</span>
          <span class="hv-meta">${esc(v.stats.slice(0, 2).map((x) => x.value).join(' · ') || v.district)}</span>
        </a>`;
      }).join('')}</div>
    </div></section>

    <section class="sec sec-tone" aria-labelledby="h-steps"><div class="wrap">
      <div class="sec-head"><h2 id="h-steps">입점은 이렇게 진행됩니다</h2></div>
      <ol class="steps steps-6">${STEPS.map(([t, d]) => `<li><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
    </div></section>

    <section class="sec" aria-labelledby="h-hc"><div class="wrap two">
      <div>
        <h2 id="h-hc">호스트센터</h2>
        <p>입점한 건물주께 호스트센터 계정을 드립니다. 내 건물에서 열리는 행사와 매출, 정산을 언제든 확인할 수 있습니다.</p>
        <p class="links"><a class="btn btn-line" href="/host/center">호스트센터 로그인</a></p>
      </div>
      <dl class="rows hc-list">${HOST_FEATURES.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>
    </div></section>

    <section class="sec sec-tone" id="apply" aria-labelledby="h-apply"><div class="wrap form-wrap">
      <form id="pt" class="form" novalidate>
        <h2 id="h-apply">입점 문의</h2>
        <p class="hint">아는 만큼만 적어 주세요. 담당자가 확인하고 연락드립니다.</p>
        <div class="grid2">
          <div class="field"><label for="p-name">이름 <em>필수</em></label><input type="text" id="p-name" name="name" maxlength="40" autocomplete="name" required></div>
          <div class="field"><label for="p-rel">건물과의 관계</label>
            <select id="p-rel" name="relation"><option value="">선택</option><option>건물주</option><option>건물주 가족·대리인</option><option>관리인·자산관리사</option><option>중개사</option><option>기타</option></select></div>
          <div class="field"><label for="p-phone">연락처 <em>필수</em></label><input type="tel" id="p-phone" name="phone" maxlength="30" autocomplete="tel" inputmode="tel" placeholder="010-0000-0000" required></div>
          <div class="field"><label for="p-email">이메일</label><input type="email" id="p-email" name="email" maxlength="120" autocomplete="email"></div>
        </div>
        <div class="field"><label for="p-addr">건물 위치 <em>필수</em></label><input type="text" id="p-addr" name="address" maxlength="200" placeholder="예: 서울 마포구 서교동 (동네 이름까지만 적으셔도 됩니다)" required></div>
        <div class="grid2">
          <div class="field"><label for="p-type">건물 형태</label>
            <select id="p-type" name="building_type"><option value="">선택</option><option>통건물</option><option>여러 층(일부)</option><option>1층·지층 단독</option><option>창고·공장형</option><option>기타</option></select></div>
          <div class="field"><label for="p-floors">층수</label><input type="text" id="p-floors" name="floors" maxlength="40" placeholder="예: 지하 1층 ~ 지상 3층"></div>
          <div class="field"><label for="p-area">연면적</label><input type="text" id="p-area" name="area" maxlength="40" placeholder="예: 약 150평"></div>
          <div class="field"><label for="p-vac">지금 상태</label>
            <select id="p-vac" name="vacancy"><option value="">선택</option><option>비어 있음</option><option>임대 중, 곧 비어요</option><option>리모델링·재건축 예정</option><option>일부만 비어 있음</option></select></div>
          <div class="field"><label for="p-from">쓸 수 있는 시기</label><input type="text" id="p-from" name="available_from" maxlength="40" placeholder="예: 2027년 3월부터, 1년 정도"></div>
          <div class="field"><label for="p-model">관심 있는 운영 방식</label>
            <select id="p-model" name="model"><option value="">선택</option>${PARTNER_MODELS.map((m) => `<option>${esc(m)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="p-link">사진·자료 링크</label><input type="url" id="p-link" name="link" maxlength="400" placeholder="구글드라이브, 네이버 지도 링크 등"></div>
        <div class="field"><label for="p-msg">하실 말씀</label><textarea id="p-msg" name="message" rows="4" maxlength="3000" placeholder="건물 특징, 원하시는 조건, 궁금한 점을 자유롭게 적어 주세요."></textarea></div>
        <div class="hp" aria-hidden="true"><label>이 칸은 비워 두세요<input type="text" name="hp" tabindex="-1" autocomplete="off"></label></div>
        <label class="check agree"><input type="checkbox" name="agree" value="1" required><span>입점 상담을 위한 개인정보 수집·이용에 동의합니다. <small>이름, 연락처, 이메일, 건물 정보를 입점 상담 목적으로만 쓰고, 상담이 끝나거나 삭제를 요청하시면 지체 없이 파기합니다.</small></span></label>
        <p class="form-error" id="pt-error" role="alert" hidden></p>
        <button class="btn btn-dark btn-lg btn-block" type="submit" id="pt-submit">입점 문의 보내기</button>
      </form>
      <div id="pt-done" class="done" hidden tabindex="-1">
        <h2>입점 문의가 접수됐습니다</h2>
        <p>담당자가 내용을 확인하고 남겨 주신 연락처로 연락드리겠습니다.</p>
        <p class="done-code"><span>접수번호</span><strong id="pt-code"></strong></p>
      </div>
      <aside class="form-side">
        <h2>자주 묻는 질문</h2>
        <dl class="qa">
          <dt>공사나 개조가 꼭 필요한가요?</dt><dd>건물 상태에 따라 다릅니다. 현장을 보고 그대로 쓸 수 있는 부분과 손봐야 할 부분을 나눠서 제안합니다.</dd>
          <dt>비어 있는 기간이 짧아도 되나요?</dt><dd>공실 기간만 활용하는 방식도 있습니다. 기간을 알려 주시면 가능한 방법을 함께 찾아보겠습니다.</dd>
          <dt>매출과 정산은 어떻게 확인하나요?</dt><dd>입점 후 호스트센터 계정을 드립니다. 예약 일정과 월별 매출, 정산 내역을 언제든 확인할 수 있습니다.</dd>
        </dl>
      </aside>
    </div></section>`;
  return page({
    content, origin, path: '/host', title: '공간 파트너 · 호스트', active: 'host', scripts: ['/assets/js/partner.js'], bar: false,
    description: '비어 있는 통건물을 메자닌 대관 공간으로. 공간 기획, 대관 영업, 현장 운영, 매출 정산까지 메자닌이 맡습니다. 건물주 입점 문의.',
    body,
  });
}
