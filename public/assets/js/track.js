// 방문 분석: 쿠키를 쓰지 않습니다. 탭을 닫으면 사라지는 임의 번호(sessionStorage)로 한 번의 방문만 묶습니다.
// 보내는 것: 연 페이지, 화면을 보고 있던 시간, 스크롤 깊이, 누른 버튼·링크의 종류와 위치, 들어온 사이트 주소(도메인), utm 값.
// 이름·연락처 같은 입력 내용은 보내지 않습니다.
(() => {
  'use strict';
  if (navigator.webdriver) return;
  const path = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/';

  let sid = '';
  try {
    sid = sessionStorage.getItem('mz_sid') || '';
  } catch {}
  if (!/^[a-z0-9]{12,32}$/.test(sid)) {
    sid = (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 24);
    try {
      sessionStorage.setItem('mz_sid', sid);
    } catch {}
  }

  const send = (o) => {
    const body = JSON.stringify({ sid, p: path, ...o });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return;
    } catch {}
    fetch('/api/t', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  };

  // 페이지 열기
  const q = new URLSearchParams(location.search);
  let ref = '';
  try {
    const r = new URL(document.referrer);
    if (r.hostname !== location.hostname) ref = r.hostname;
  } catch {}
  send({ e: 'pv', r: ref, us: q.get('utm_source') || '', um: q.get('utm_medium') || '', uc: q.get('utm_campaign') || '' });

  // 머문 시간: 화면이 보이고, 최근 2분 안에 움직임(스크롤·마우스·키보드·터치)이 있었던 시간만 5초 단위로 셉니다
  let lastInput = Date.now();
  let acc = 0;
  let maxDepth = 0;
  let sentDepth = 0;
  const depth = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    return h <= 0 ? 100 : Math.min(100, Math.round((scrollY / h) * 100));
  };
  const touch = () => {
    lastInput = Date.now();
  };
  ['scroll', 'mousemove', 'keydown', 'touchstart', 'pointerdown'].forEach((t) => addEventListener(t, touch, { passive: true }));
  addEventListener('scroll', () => {
    const d = depth();
    if (d > maxDepth) maxDepth = d;
  }, { passive: true });
  addEventListener('load', () => {
    maxDepth = Math.max(maxDepth, depth());
  });
  // 30초가 모이면 중간에도 보냅니다(창을 닫을 때 기록이 빠져도 대부분 남도록)
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < 120000) {
      acc += 5000;
      if (acc >= 30000) flush();
    }
  }, 5000);
  function flush() {
    if (acc >= 1000 || maxDepth > sentDepth) {
      send({ e: 'leave', ms: acc, d: maxDepth - sentDepth });
      acc = 0;
      sentDepth = maxDepth;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else touch();
  });
  addEventListener('pagehide', flush);

  // 버튼·링크: 무엇을 어디서 눌렀는지
  const PLACES = [
    ['.top', '상단 메뉴'], ['.mbar', '하단 고정 바'], ['.foot', '바닥글'], ['#search', '공간 찾기'], ['.hx', '첫 화면'],
    ['.cta', '문의 안내 띠'], ['.vc', '지점 카드'], ['.vhead', '지점 상단'], ['.vhead-cta', '지점 상단'], ['.vspec', '지점 상단'], ['.filters', '사례 거르기'], ['.phead', '페이지 머리'], ['.ccard', '안내 카드'], ['.hcase', '최근 열린 행사'],
    ['.type-card', '행사별 추천'], ['.chips', '행사 종류 버튼'], ['.fg-box', '층별 안내'], ['.fig-box', '건물 구성'], ['.cdetail', '사례'],
    ['.faq', '자주 묻는 질문'], ['.bro', '소개서 받기'], ['#apply', '입점 문의'], ['.compare', '비교 표'], ['.stations', '오시는 길'],
    ['.vphotos', '사진'], ['.cal', '예약 현황'], ['.form-side', '진행 안내'], ['.done', '접수 완료'], ['form', '양식'],
  ];
  const placeOf = (el) => {
    for (const [sel, name] of PLACES) if (el.closest(sel)) return name;
    const sec = el.closest('section');
    const h = sec?.querySelector('h2');
    return (h ? h.textContent : sec?.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  };
  const textOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const channel = (host) => {
    const h = host.replace(/^(www|m)\./, '');
    if (/kakao/.test(h) && !/map\.kakao/.test(h)) return '카카오톡';
    if (/instagram/.test(h)) return '인스타그램';
    if (/blog\.naver/.test(h)) return '네이버 블로그';
    if (/map\.naver|naver\.me|map\.kakao/.test(h)) return '지도';
    if (/youtu/.test(h)) return '유튜브';
    return h;
  };
  const keyOf = (el) => {
    const text = textOf(el);
    if (el.dataset.track) return [el.dataset.track, text];
    if (el.matches('summary')) return [`faq|${text}`, text];
    if (el.matches('.yt, .dv')) return [`video|${el.dataset.title || el.closest('figure')?.querySelector('figcaption')?.textContent?.trim().slice(0, 40) || text || '영상'}`, text];
    if (el.matches('.gal-item, .fg-main, .map-img')) return [`photo|${path}`, text];
    if (el.matches('a[href]')) {
      const href = el.getAttribute('href') || '';
      if (href.startsWith('tel:')) return ['contact|전화', text];
      if (href.startsWith('mailto:')) return ['contact|이메일', text];
      let u;
      try {
        u = new URL(el.href, location.href);
      } catch {
        return null;
      }
      if (u.hostname !== location.hostname) return [`out|${channel(u.hostname)}`, text];
      const pth = u.pathname.replace(/\/+$/, '') || '/';
      if (pth === '/venues' && u.searchParams.get('type')) return [`type|${u.searchParams.get('type')}`, text];
      const m = pth.match(/^\/venues\/([a-z0-9-]+)$/);
      if (m) return [`venue|${m[1]}`, text];
      if (pth === '/inquiry') return ['cta|견적 요청', text];
      if (pth === '/brochure') return ['cta|소개서 받기', text];
      if (pth.startsWith('/brochure/download')) return ['download|공간소개서', text];
      if (pth === '/host') return ['cta|공간 파트너', text];
      if (pth === '/my') return ['cta|내 문의 조회', text];
      if (u.hash && pth === path) return null;
      return [`nav|${pth}`, text];
    }
    if (el.matches('button')) {
      if (el.matches('.menu-btn') || el.closest('.lb')) return null;
      if (el.type === 'submit') return [`submit|${el.form?.id || text}`, text];
      if (el.closest('.tabs')) return [`tab|${text}`, text];
      if (el.closest('.filters')) return [`filter|${text}`, text];
      if (el.closest('.cal-nav')) return ['button|예약 현황 달 넘기기', text];
      return [`button|${text}`, text];
    }
    return null;
  };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-track], a[href], button, summary');
    if (!el) return;
    // 다른 페이지로 넘어가는 링크면 지금까지 머문 시간을 먼저 보냅니다
    if (el.matches('a[href]') && !(el.getAttribute('href') || '').startsWith('#')) flush();
    const k = keyOf(el);
    if (!k || !k[0]) return;
    send({ e: 'click', k: `${k[0]}|@${placeOf(el)}`.slice(0, 120), l: k[1] });
  }, true);

  // 다른 스크립트가 남기는 기록: 문의·소개서 요청 완료, 공간 찾기 검색
  window.mzTrack = (k, l = '') => send({ e: 'ev', k, l });
})();
