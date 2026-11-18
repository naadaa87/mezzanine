// 메자닌 관리자 — KPI: 방문 분석, 페이지·클릭, 인기 정보, 고객·회원
(() => {
  'use strict';
  const { S, api, esc, won, pad, ymd, day, venueName, venueDot, views } = window.MZ;
  const N = (n) => Number(n || 0).toLocaleString('ko-KR');
  const pct = (x) => (x == null ? '–' : `${Math.round(x * 1000) / 10}%`);
  const dur = (ms) => {
    if (ms == null) return '–';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}초`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}분 ${pad(s % 60)}초` : `${Math.floor(m / 60)}시간 ${m % 60}분`;
  };
  const ratio = (a, b) => (b ? a / b : null);
  // 지난 기간 대비. lowerIsBetter이면 내려간 것을 좋은 쪽으로 표시합니다
  const delta = (cur, prev, lowerIsBetter = false) => {
    if (cur == null) return '<em class="muted">기록 없음</em>';
    if (!prev) return cur ? '<em class="muted">지난 기간 기록 없음</em>' : '<em class="muted">지난 기간과 같음</em>';
    const r = Math.round(((cur - prev) / prev) * 100);
    if (r === 0) return '<em class="muted">지난 기간과 같음</em>';
    const good = lowerIsBetter ? r < 0 : r > 0;
    return `<em class="delta ${good ? 'up' : 'down'}">${r > 0 ? '▲' : '▼'} ${Math.abs(r)}%</em> <em class="muted">지난 기간 대비</em>`;
  };
  // 표 안에 넣는 짧은 비교(지난 기간 기록이 없으면 비워 둡니다)
  const dshort = (cur, prev) => {
    if (!prev || cur == null) return '';
    const r = Math.round(((cur - prev) / prev) * 100);
    if (r === 0) return '';
    return `<br><em class="delta ${r > 0 ? 'up' : 'down'} small">${r > 0 ? '▲' : '▼'} ${Math.abs(r)}%</em>`;
  };
  const card = (label, value, sub, cls = '') => `<div class="kpi${cls}"><span>${label}</span><strong>${value}</strong><em>${sub}</em></div>`;

  const PAGE = { '/': '홈', '/venues': '공간 찾기', '/cases': '대관 사례', '/guide': '이용 안내', '/inquiry': '견적 요청', '/brochure': '공간소개서 받기', '/host': '공간 파트너', '/my': '내 문의 조회' };
  const pageName = (p) => {
    const m = String(p || '').match(/^\/venues\/(.+)$/);
    if (m) return `지점 · ${venueName(m[1])}`;
    return PAGE[p] || p || '–';
  };
  const TYPE = { cta: '주요 버튼', venue: '지점 열기', type: '행사 종류', out: '외부 채널', contact: '연락', faq: '자주 묻는 질문', photo: '사진 크게 보기', video: '영상 재생', tab: '탭', filter: '거르기', submit: '보내기', nav: '메뉴·링크', download: '내려받기', button: '기타 버튼' };
  const FORM = { search: '공간 찾기 검색', inq: '견적 요청 보내기', bro: '소개서 받기', 'pt-form': '입점 문의 보내기', lookup: '내 문의 조회', 'chat-form': '메시지 보내기' };
  const clickName = (g) => {
    if (g.type === 'venue') return venueName(g.detail);
    if (g.type === 'nav') return pageName(g.detail);
    if (g.type === 'photo') return `${pageName(g.detail)} 사진`;
    if (g.type === 'submit') return FORM[g.detail] || g.label || g.detail;
    return g.detail || g.label || '–';
  };
  const SOURCE = { web: '홈페이지 문의', admin: '직접 등록', brochure: '소개서 요청', 전화: '전화', 카카오톡: '카카오톡', 인스타그램: '인스타그램', 블로그: '블로그', 소개: '소개', 기타: '기타' };
  const HC = { 50: '50명 이하', 150: '50–150명', 300: '150–300명', '300+': '300명 이상' };
  const rankList = (rows, { name = (r) => r.k, value = (r) => r.n, fmt = N, empty = '아직 기록이 없습니다.', sub } = {}) => {
    if (!rows.length) return `<p class="empty">${empty}</p>`;
    const max = Math.max(1, ...rows.map(value));
    return `<ul class="rank">${rows.map((r) => `<li><span>${esc(name(r))}${sub ? ` <span class="muted small">${esc(sub(r) || '')}</span>` : ''}</span><b>${fmt(value(r))}</b><i style="width:${(value(r) / max) * 100}%"></i></li>`).join('')}</ul>`;
  };

  // ── 기간 고르기와 KPI 탭 ─────────────────────────────────
  const today = () => ymd(new Date());
  const addMonth = (m, n) => {
    const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const presets = () => {
    const t = today();
    const m = addMonth(t.slice(0, 7), -1);
    const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
    const d7 = ymd(new Date(Date.now() - 6 * 86400000));
    const d30 = ymd(new Date(Date.now() - 29 * 86400000));
    return { d7: [d7, t], d30: [d30, t], month: [t.slice(0, 8) + '01', t], last: [`${m}-01`, `${m}-${pad(last)}`], year: [`${t.slice(0, 4)}-01-01`, t] };
  };
  const TABS = [['', '요약'], ['traffic', '방문 분석'], ['pages', '페이지·클릭'], ['content', '인기 정보'], ['members', '고객·회원']];
  const tabs = (cur, d) => `<div class="kpi-tabs" role="tablist">${TABS.map(([k, l]) => `<a href="#/kpi${k ? `/${k}` : ''}?from=${d.from}&to=${d.to}" class="${cur === k ? 'is-on' : ''}"${cur === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</div>`;
  const periodBar = (d, sub, extra = '') => {
    const P = presets();
    const which = Object.entries(P).find(([, [a, b]]) => a === d.from && b === d.to)?.[0] || '';
    return `<div class="periods">
      <div class="seg" style="margin:0">${[['d7', '최근 7일'], ['d30', '최근 30일'], ['month', '이번 달'], ['last', '지난 달'], ['year', '올해']].map(([k, l]) => `<button type="button" data-p="${k}" class="${which === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      <input type="date" id="k-from" value="${esc(d.from)}" aria-label="시작일"> ~ <input type="date" id="k-to" value="${esc(d.to)}" aria-label="종료일">${extra}
    </div>`;
  };
  const bindPeriod = (main, sub, extraQs = () => '') => {
    const P = presets();
    const go = (f, t) => (location.hash = `#/kpi/${sub}?from=${f}&to=${t}${extraQs()}`);
    main.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => go(...P[b.dataset.p])));
    const apply = () => {
      const f = main.querySelector('#k-from').value;
      const t = main.querySelector('#k-to').value;
      if (f && t) go(f, t);
    };
    main.querySelector('#k-from').addEventListener('change', apply);
    main.querySelector('#k-to').addEventListener('change', apply);
  };
  const qs = (q) => {
    const P = presets();
    const from = q.get('from') || P.d30[0];
    const to = q.get('to') || P.d30[1];
    return `from=${from}&to=${to}`;
  };
  const sinceNote = (since) => `<p class="muted small kpi-note">방문(세션)·머문 시간·클릭·들어온 경로는 ${since ? `${esc(since)}부터` : '이번 업데이트부터'} 모은 기록입니다. 방문자와 페이지뷰는 그 전부터 모았습니다. 쿠키 없이 숫자만 모읍니다.</p>`;
  const head = (title, desc, d) => `<div class="head"><div><h1>${title}</h1><p>${desc} <span class="muted">${esc(d.from)} ~ ${esc(d.to)}${d.prev?.from ? ` · 비교: ${esc(d.prev.from)} ~ ${esc(d.prev.to)}` : ''}</span></p></div></div>`;
  const dayLabel = (k) => (k.length === 7 ? `${Number(k.slice(5))}월` : `${Number(k.slice(8))}`);
  const dayFull = (k) => (k.length === 7 ? `${k.slice(0, 4)}년 ${Number(k.slice(5))}월` : `${Number(k.slice(5, 7))}월 ${Number(k.slice(8))}일 (${'일월화수목금토'[new Date(k).getDay()]})`);

  // ── 방문 분석 ───────────────────────────────────────────
  async function traffic(main, q) {
    const d = await api(`/kpi/traffic?${qs(q)}`);
    const p = d.prev;
    const devName = { desktop: 'PC', mobile: '휴대폰', tablet: '태블릿' };
    const devTotal = d.devices.reduce((a, x) => a + x.n, 0);
    main.innerHTML = `${head('방문 분석', '홈페이지에 얼마나 들어오고, 어디서 들어와 얼마나 머무는지 봅니다.', d)}
      ${tabs('traffic', d)}${periodBar(d, 'traffic')}
      <div class="kpis kpis-5">
        ${card('방문자', N(d.visitors), delta(d.visitors, p.visitors))}
        ${card('페이지뷰', N(d.pageviews), delta(d.pageviews, p.pageviews))}
        ${card('방문(세션)', N(d.sessions), delta(d.sessions, p.sessions))}
        ${card('방문당 본 페이지', d.pages_per_session == null ? '–' : (Math.round(d.pages_per_session * 10) / 10).toFixed(1), delta(d.pages_per_session, p.pages_per_session))}
        ${card('평균 머문 시간 <small>방문당</small>', dur(d.avg_session_ms), delta(d.avg_session_ms, p.avg_session_ms))}
        ${card('페이지당 머문 시간', dur(d.avg_page_ms), delta(d.avg_page_ms, p.avg_page_ms))}
        ${card('이탈률', pct(d.bounce), delta(d.bounce, p.bounce, true))}
        ${card('클릭', N(d.clicks), delta(d.clicks, p.clicks))}
        ${card('공간 찾기 검색', N(d.searches), delta(d.searches, p.searches))}
        ${card('문의·소개서 전환율', pct(d.conv_rate), `문의 ${N(d.conv_inquiry)} · 소개서 ${N(d.conv_brochure)}`)}
      </div>
      <div class="cols">
        <div>
          <section class="card"><h2>${d.monthly ? '월별' : '날짜별'} 방문자</h2><div id="t-uv"></div></section>
          <section class="card"><h2>시간대별 페이지뷰 <small>한국 시간</small></h2><div id="t-hour"></div></section>
          <section class="card"><h2>들어온 경로</h2>${d.channels.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>경로</th><th class="num">방문</th><th class="num">방문당 페이지</th><th class="num">평균 머문 시간</th><th class="num">이탈률</th><th class="num">문의</th><th class="num">소개서</th></tr></thead><tbody>
            ${d.channels.map((c) => `<tr><td><b>${esc(c.channel)}</b></td><td class="num">${N(c.n)}</td><td class="num">${c.n ? (c.pages / c.n).toFixed(1) : '–'}</td><td class="num">${dur(c.n ? c.ms / c.n : null)}</td><td class="num">${pct(ratio(c.bounce, c.n))}</td><td class="num">${N(c.ci)}</td><td class="num">${N(c.cb)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="empty">아직 모은 방문 기록이 없습니다.</p>'}
          <p class="muted small" style="margin-top:12px">인스타그램·블로그·소개서 QR 같은 링크 끝에 <code>?utm_source=instagram&amp;utm_medium=social</code>처럼 붙여 두면 경로를 더 정확히 나눠 봅니다. QR 코드는 <code>utm_medium=qr</code>로 표시하면 'QR 코드'로 따로 셉니다.</p></section>
          <section class="card"><h2>자세한 출처 <small>utm 값 또는 들어온 사이트</small></h2>${rankList(d.sources, { name: (r) => r.source, sub: (r) => `${r.channel}${r.ci || r.cb ? ` · 문의 ${r.ci} · 소개서 ${r.cb}` : ''}`, empty: '다른 사이트나 utm 링크로 들어온 방문이 아직 없습니다.' })}</section>
        </div>
        <div>
          <section class="card"><h2>${d.monthly ? '월별' : '날짜별'} 페이지뷰</h2><div id="t-pv"></div></section>
          <section class="card"><h2>요일별 방문자</h2><div id="t-week"></div></section>
          <section class="card"><h2>기기</h2>${d.devices.length ? `<ul class="rank">${d.devices.sort((a, b) => b.n - a.n).map((x) => `<li><span>${esc(devName[x.dev] || x.dev)}</span><b>${N(x.n)}명 · ${pct(ratio(x.n, devTotal))}</b><i style="width:${(x.n / Math.max(1, devTotal)) * 100}%"></i></li>`).join('')}</ul>` : '<p class="empty">기기 정보는 이번 업데이트부터 모읍니다.</p>'}
            ${d.device_sessions.length ? `<div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>기기</th><th class="num">방문</th><th class="num">평균 머문 시간</th><th class="num">이탈률</th><th class="num">문의·소개서</th></tr></thead><tbody>
              ${d.device_sessions.map((x) => `<tr><td>${esc(devName[x.dev] || x.dev || '–')}</td><td class="num">${N(x.n)}</td><td class="num">${dur(x.n ? x.ms / x.n : null)}</td><td class="num">${pct(ratio(x.bounce, x.n))}</td><td class="num">${N(x.ci + x.cb)}</td></tr>`).join('')}
            </tbody></table></div>` : ''}</section>
          <section class="card"><h2>캠페인 <small>utm_campaign</small></h2>${d.campaigns.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>출처 / 매체</th><th>캠페인</th><th class="num">방문</th><th class="num">문의</th><th class="num">소개서</th></tr></thead><tbody>
            ${d.campaigns.map((c) => `<tr><td>${esc(c.src || '–')}${c.med ? ` / ${esc(c.med)}` : ''}</td><td>${esc(c.camp || '–')}</td><td class="num">${N(c.n)}</td><td class="num">${N(c.ci)}</td><td class="num">${N(c.cb)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="empty">utm 링크로 들어온 방문이 아직 없습니다.</p>'}</section>
          <section class="card"><h2>들어온 사이트 <small>페이지를 연 기록 기준</small></h2>${rankList(d.referrers, { name: (r) => r.host, empty: '다른 사이트에서 들어온 기록이 아직 없습니다.' })}</section>
        </div>
      </div>
      ${sinceNote(d.since)}
      <p class="muted small kpi-note">방문자: 하루 단위로 같은 사람은 한 번만 셉니다(다른 날 다시 오면 다시 셈). 방문(세션): 브라우저 탭 하나에서 이어진 한 번의 방문. 이탈률: 한 페이지만 보고 10초 안에, 아무것도 누르지 않고 떠난 방문의 비율. 머문 시간: 화면을 보고 있으면서 2분 안에 움직임이 있었던 시간만 셉니다.</p>`;
    const tr = d.trend;
    MZChart.bars(main.querySelector('#t-uv'), tr.map((t) => ({ label: dayLabel(t.d), full: dayFull(t.d), value: t.visitors, tip: `${N(t.visitors)}명` })), { name: '방문자(명)', unit: '명', col: '날짜', height: 180 });
    MZChart.bars(main.querySelector('#t-pv'), tr.map((t) => ({ label: dayLabel(t.d), full: dayFull(t.d), value: t.pageviews, tip: `${N(t.pageviews)}회 · 방문 ${N(t.sessions)}` })), { name: '페이지뷰(회)', unit: '회', col: '날짜', height: 180 });
    MZChart.bars(main.querySelector('#t-hour'), d.hours.map((v, h) => ({ label: `${h}`, full: `${h}시~${h + 1}시`, value: v, tip: `${N(v)}회` })), { name: '시간대별 페이지뷰(회)', unit: '회', col: '시간', height: 160, every: 3 });
    const W = ['일', '월', '화', '수', '목', '금', '토'];
    const order = [1, 2, 3, 4, 5, 6, 0];
    MZChart.bars(main.querySelector('#t-week'), order.map((w) => ({ label: W[w], full: `${W[w]}요일`, value: d.weekdays[w], tip: `${N(d.weekdays[w])}명` })), { name: '요일별 방문자(명)', unit: '명', col: '요일', height: 160 });
    bindPeriod(main, 'traffic');
  }

  // ── 페이지·클릭 ─────────────────────────────────────────
  async function pages(main, q) {
    const d = await api(`/kpi/pages?${qs(q)}`);
    const maxV = Math.max(1, ...d.pages.map((r) => r.views));
    main.innerHTML = `${head('페이지·클릭', '페이지마다 몇 명이 보고 얼마나 머무는지, 어떤 버튼을 어디서 누르는지 봅니다.', d)}
      ${tabs('pages', d)}${periodBar(d, 'pages')}
      <div class="kpis">
        ${card('페이지뷰', N(d.pages.reduce((a, r) => a + r.views, 0)), `${N(d.pages.length)}개 페이지`)}
        ${card('클릭', N(d.total_clicks), delta(d.total_clicks, d.prev_clicks))}
        ${card('방문당 클릭', d.sessions ? (d.total_clicks / d.sessions).toFixed(1) : '–', `방문 ${N(d.sessions)}번 기준`)}
        ${card('가장 많이 본 페이지', esc(d.pages[0] ? pageName(d.pages[0].path) : '–'), d.pages[0] ? `${N(d.pages[0].views)}회 · 방문자 ${N(d.pages[0].visitors)}명` : '기록 없음')}
      </div>
      <section class="card"><h2>페이지별 <small>조회 수 순</small></h2>${d.pages.length ? `<div class="tbl-wrap"><table class="tbl kpi-pages"><thead><tr><th>페이지</th><th class="num">조회 수</th><th class="num">방문자 수</th><th class="num">평균 머문 시간</th><th class="num">스크롤 깊이</th><th class="num">첫 페이지로 들어옴</th><th class="num">이탈률</th><th class="num">마지막 페이지</th><th class="num">클릭</th><th class="num">문의·소개서</th></tr></thead><tbody>
        ${d.pages.map((r) => `<tr><td><b>${esc(pageName(r.path))}</b><br><span class="muted small">${esc(r.path)}</span><div class="bar-in"><i style="width:${(r.views / maxV) * 100}%"></i></div></td>
          <td class="num">${N(r.views)}${dshort(r.views, r.prev_views)}</td><td class="num">${N(r.visitors)}</td><td class="num">${dur(r.avg_ms)}</td><td class="num">${r.avg_depth == null ? '–' : `${Math.round(r.avg_depth)}%`}</td>
          <td class="num">${N(r.entrances)}</td><td class="num">${pct(r.bounce)}</td><td class="num">${N(r.exits)}</td><td class="num">${N(r.clicks)}</td><td class="num">${N(r.conv)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">아직 집계된 방문이 없습니다.</p>'}
      <p class="muted small" style="margin-top:12px">방문자 수: 그 페이지를 본 사람(하루 단위). 스크롤 깊이: 페이지를 평균 어디까지 내려 봤는지. 문의·소개서: 그 페이지로 들어온 방문 중 문의나 소개서 요청까지 간 수.</p></section>
      <div class="cols">
        <section class="card"><h2>많이 누른 버튼·링크</h2>${d.clicks.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>무엇을</th><th>어디서</th><th class="num">클릭</th></tr></thead><tbody>
          ${d.clicks.map((g) => `<tr><td><span class="badge-kind" style="margin:0 6px 0 0">${esc(TYPE[g.type] || g.type)}</span><b>${esc(clickName(g))}</b>${g.label && g.label !== clickName(g) && g.type !== 'faq' ? `<br><span class="muted small">"${esc(g.label)}"</span>` : ''}</td>
            <td class="small">${g.places.slice(0, 4).map((x) => `${esc(x.place || '–')} <b>${N(x.n)}</b>`).join('<br>')}</td><td class="num">${N(g.n)}${dshort(g.n, g.prev)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">클릭 기록은 이번 업데이트부터 모읍니다.</p>'}</section>
        <section class="card"><h2>클릭 종류</h2>${rankList(d.click_types, { name: (r) => TYPE[r.type] || r.type })}
          <p class="muted small" style="margin-top:12px">주요 버튼: 견적 요청, 소개서 받기, 공간 파트너, 내 문의 조회로 가는 버튼. 외부 채널: 카카오톡·인스타그램·블로그·지도·유튜브.</p></section>
      </div>
      ${sinceNote(d.since)}`;
    bindPeriod(main, 'pages');
  }

  // ── 인기 정보 ───────────────────────────────────────────
  async function content(main, q) {
    const d = await api(`/kpi/content?${qs(q)}`);
    const top = d.top_pages[0];
    const topVenue = d.venues.find((v) => v.status === 'open');
    const topType = d.type_buttons[0] || d.search.type[0];
    const topFaq = d.faq[0];
    main.innerHTML = `${head('인기 정보', '방문자가 가장 많이 찾아보는 지점, 행사 종류, 질문, 자료를 모았습니다.', d)}
      ${tabs('content', d)}${periodBar(d, 'content')}
      <div class="kpis">
        ${card('가장 많이 본 페이지', esc(top ? pageName(top.path) : '–'), top ? `${N(top.views)}회` : '기록 없음')}
        ${card('관심이 가장 많은 지점', esc(topVenue ? topVenue.name.replace('메자닌 ', '') : '–'), topVenue ? `조회 ${N(topVenue.views)} · 카드 클릭 ${N(topVenue.card_clicks)} · 문의 ${N(topVenue.inquiries)}` : '기록 없음')}
        ${card('많이 찾는 행사 종류', esc(topType ? topType.k : '–'), topType ? `${N(topType.n)}회` : '기록 없음')}
        ${card('많이 연 질문', `<span style="font-size:1.05rem;line-height:1.4;display:block">${esc(topFaq ? topFaq.k : '–')}</span>`, topFaq ? `${N(topFaq.n)}회` : '기록 없음')}
      </div>
      <section class="card"><h2>지점별 관심도 <small>조회 + 카드 클릭 순</small></h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>지점</th><th class="num">페이지 조회</th><th class="num">방문자</th><th class="num">평균 머문 시간</th><th class="num">지점 카드 클릭</th><th class="num">공간 찾기에서 고름</th><th class="num">대관 문의</th><th class="num">확정 예약</th><th class="num">확정 매출</th></tr></thead><tbody>
        ${d.venues.map((v) => `<tr><td>${venueDot(v.slug)}${v.status !== 'open' ? ' <span class="badge-kind">오픈 예정</span>' : ''}</td><td class="num">${N(v.views)}</td><td class="num">${N(v.visitors)}</td><td class="num">${dur(v.avg_ms)}</td><td class="num">${N(v.card_clicks)}</td><td class="num">${N(v.searched)}</td><td class="num">${N(v.inquiries)}${v.notify ? `<br><span class="muted small">오픈 알림 ${N(v.notify)}</span>` : ''}</td><td class="num">${N(v.bookings)}</td><td class="num">${won(v.revenue)}</td></tr>`).join('')}
      </tbody></table></div></section>
      <div class="cols">
        <div>
          <section class="card"><h2>많이 본 페이지</h2>${rankList(d.top_pages, { name: (r) => pageName(r.path), value: (r) => r.views, sub: (r) => `방문자 ${N(r.visitors)}명${r.avg_ms != null ? ` · ${dur(r.avg_ms)}` : ''}` })}</section>
          <section class="card"><h2>행사 종류 버튼 <small>홈·공간 찾기에서 누른 수</small></h2>${rankList(d.type_buttons, { empty: '행사 종류 버튼을 누른 기록이 아직 없습니다.' })}</section>
          <section class="card"><h2>공간 찾기 검색 <small>${N(d.search.total)}번</small></h2>
            <div class="mini-cols">
              <div><h3>지점</h3>${rankList(d.search.venue, { name: (r) => (r.k === 'all' ? '전체 지점' : venueName(r.k)), empty: '기록 없음' })}</div>
              <div><h3>행사 종류</h3>${rankList(d.search.type, { empty: '기록 없음' })}</div>
              <div><h3>예상 인원</h3>${rankList(d.search.headcount, { name: (r) => HC[r.k] || r.k, empty: '기록 없음' })}</div>
              <div><h3>희망 시기</h3>${rankList(d.search.month, { name: (r) => `${r.k.slice(0, 4)}년 ${Number(r.k.slice(5))}월`, empty: '기록 없음' })}</div>
            </div></section>
          <section class="card"><h2>실제 문의한 행사 종류</h2>${rankList(d.inquiry_types, { name: (r) => r.t, empty: '이 기간에 들어온 문의가 없습니다.' })}
            ${d.lead_types.length ? `<h3 class="sub-h">소개서를 받아 간 사람이 고른 행사 종류</h3>${rankList(d.lead_types, { name: (r) => r.t })}` : ''}</section>
        </div>
        <div>
          <section class="card"><h2>많이 연 자주 묻는 질문 <small>이용 안내</small></h2>${rankList(d.faq, { empty: '질문을 연 기록이 아직 없습니다.' })}</section>
          <section class="card"><h2>공간소개서</h2>
            <ul class="rank"><li><span>소개서 받기 버튼 클릭</span><b>${N(d.brochure.clicks)}</b></li><li><span>소개서 요청</span><b>${N(d.brochure.n)}</b></li><li><span>실제로 내려받은 요청</span><b>${N(d.brochure.dl)}</b></li><li><span>내려받은 횟수</span><b>${N(d.brochure.downloads)}</b></li></ul></section>
          <section class="card"><h2>외부 채널·연락</h2>${rankList(d.outbound, { empty: '카카오톡·인스타그램·지도 등을 누른 기록이 아직 없습니다.' })}</section>
          <section class="card"><h2>주요 버튼</h2>${rankList(d.ctas, { sub: (r) => r.places.slice(0, 3).map((x) => `${x.place} ${x.n}`).join(' · '), empty: '기록 없음' })}</section>
          <section class="card"><h2>사진·영상</h2>${rankList([...d.photos.map((r) => ({ ...r, k: `${pageName(r.k)} 사진` })), ...d.videos.map((r) => ({ ...r, k: `영상 · ${r.k}` }))].sort((a, b) => b.n - a.n), { empty: '사진을 크게 보거나 영상을 재생한 기록이 아직 없습니다.' })}</section>
        </div>
      </div>
      ${sinceNote(d.since)}`;
    bindPeriod(main, 'content');
  }

  // ── 고객·회원 ───────────────────────────────────────────
  async function members(main, q) {
    const all = q.get('all') === '1';
    const d = await api(`/kpi/members?${qs(q)}${all ? '&all=1' : ''}`);
    const HS = S.enums.HOST_STATUS || {};
    const short = (m) => `${Number(m.slice(5))}월`;
    const months = [];
    for (let i = 11; i >= 0; i--) months.push(addMonth(today().slice(0, 7), -i));
    const mm = Object.fromEntries(d.monthly.map((x) => [x.m, x.n]));
    main.innerHTML = `${head('고객·회원', '연락처를 남긴 고객(문의·소개서 요청)과 호스트센터에 가입한 공간 파트너를 봅니다.', d)}
      ${tabs('members', d)}${periodBar(d, 'members')}
      <div class="kpis kpis-5">
        ${card('전체 고객', N(d.total), '연락처 기준, 지금까지')}
        ${card('새 고객', N(d.new_customers), delta(d.new_customers, d.prev.new_customers))}
        ${card('문의한 고객', N(d.with_inquiry), `소개서만 받은 고객 ${N(d.lead_only)}명`)}
        ${card('다시 문의한 고객', N(d.repeat), `문의 2건 이상 · ${pct(ratio(d.repeat, d.with_inquiry))}`)}
        ${card('예약까지 한 고객', N(d.booked), `문의한 고객의 ${pct(ratio(d.booked, d.with_inquiry))}`)}
        ${card('대관 문의', N(d.inquiries), '이 기간')}
        ${card('소개서 요청', N(d.leads), '이 기간')}
        ${card('입점 문의', N(d.partner_apps), '이 기간')}
        ${card('호스트(가입 회원)', N(d.host_counts.active), `초대 중 ${N(d.host_counts.invited)} · 일시 중지 ${N(d.host_counts.paused)}`)}
        ${card('관리자 계정', N(d.admins), '<a href="#/settings">설정에서 관리</a>')}
      </div>
      <div class="cols">
        <section class="card"><h2>월별 새 고객 <small>최근 12개월</small></h2><div id="m-new"></div></section>
        <section class="card"><h2>새 고객이 처음 남긴 연락 <small>이 기간</small></h2>${rankList(d.first_touch, { name: (r) => SOURCE[r.k] || r.k, empty: '이 기간에 새로 등록된 고객이 없습니다.' })}
          <p class="muted small" style="margin-top:12px">홈페이지에는 따로 회원가입이 없습니다. 견적 요청이나 소개서 요청으로 연락처를 남기면 고객으로 등록되고, 같은 연락처로 다시 오면 한 고객으로 묶입니다.</p></section>
      </div>
      <section class="card"><h2>${all ? '전체 고객' : '이 기간에 새로 등록된 고객'} <small>${N(d.list.length)}명${d.list.length >= 300 ? ' (최근 300명까지)' : ''}</small>
        <span class="head-actions"><a class="btn btn-sm" href="#/kpi/members?${qs(q)}${all ? '' : '&all=1'}">${all ? '이 기간만 보기' : '전체 고객 보기'}</a><a class="btn btn-sm" href="/api/admin/export?type=customers">CSV 내려받기</a></span></h2>
        ${d.list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>등록일</th><th>이름</th><th>연락처</th><th class="num">문의</th><th class="num">소개서</th><th class="num">예약</th><th class="num">누적 금액</th><th>최근 연락</th></tr></thead><tbody>
          ${d.list.map((c) => `<tr data-href="#/customers/${c.id}"><td>${esc(day(c.created_at))}</td><td><b>${esc(c.name || '–')}</b>${c.company ? ` <span class="muted">${esc(c.company)}</span>` : ''}${c.tags ? `<br><span class="muted small">${esc(c.tags)}</span>` : ''}</td><td>${esc(c.phone || '')}<br><span class="muted small">${esc(c.email || '')}</span></td>
            <td class="num">${N(c.inquiries)}</td><td class="num">${N(c.leads)}</td><td class="num">${N(c.bookings)}</td><td class="num">${c.revenue ? won(c.revenue) : '–'}</td><td>${c.last_at ? esc(day(c.last_at)) : '–'}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">이 기간에 새로 등록된 고객이 없습니다.</p>'}</section>
      <section class="card"><h2>호스트(공간 파트너) 회원 <small>${N(d.hosts.length)}명</small><span class="head-actions"><a class="btn btn-sm" href="#/hosts">호스트 관리</a></span></h2>
        ${d.hosts.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>이름</th><th>연결된 공간</th><th>상태</th><th>등록일</th><th>최근 로그인</th></tr></thead><tbody>
          ${d.hosts.map((h) => `<tr data-href="#/hosts/${h.id}"><td><b>${esc(h.name || '–')}</b>${h.company ? ` <span class="muted">${esc(h.company)}</span>` : ''}</td><td>${h.venues.map((v) => venueDot(v)).join(' ') || '–'}</td><td>${esc(HS[h.status] || h.status)}</td><td>${esc(day(h.created_at))}</td><td>${h.last_login_at ? esc(day(h.last_login_at)) : '<span class="muted">아직 없음</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">아직 등록된 호스트가 없습니다.</p>'}</section>`;
    MZChart.bars(main.querySelector('#m-new'), months.map((m) => ({ label: short(m), full: `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`, value: mm[m] || 0, tip: `${N(mm[m] || 0)}명` })), { name: '월별 새 고객(명)', unit: '명', col: '월', height: 170, highlightLast: true });
    main.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.href)));
    bindPeriod(main, 'members', () => (all ? '&all=1' : ''));
  }

  // ── 요약은 admin-growth.js의 화면을 그대로 쓰고, 나머지 탭은 여기서 그립니다 ─────────
  const summary = views.kpi;
  const SUB = { traffic, pages, content, members };
  views.kpi = (main, parts, q) => (parts[0] && SUB[parts[0]] ? SUB[parts[0]](main, q) : summary(main, parts, q));
  window.MZK = { tabs, card, dur, pct, delta, N };
})();
