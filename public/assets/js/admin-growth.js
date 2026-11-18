// 메자닌 관리자 — KPI, 소개서 요청·파일, 공간 파트너(입점 문의·호스트·정산)
(() => {
  'use strict';
  const { S, api, esc, won, pad, ymd, dt, day, venueName, venueDot, st, toast, modal, confirmBox, formData, views, route, reloadContent, drawNav } = window.MZ;
  const pct = (x) => (x == null ? '–' : `${Math.round(x * 1000) / 10}%`);
  const monthLabel = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;
  const addMonth = (m, n) => {
    const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const thisMonth = () => ymd(new Date()).slice(0, 7);
  const venuesOpen = () => S.content.venues.filter((v) => v.status === 'open');
  const SOURCE = { web: '홈페이지 문의', admin: '직접 등록', brochure: '소개서 요청에서 전환', 전화: '전화', 카카오톡: '카카오톡', 인스타그램: '인스타그램', 블로그: '블로그', 소개: '소개', 기타: '기타' };
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('복사했습니다');
    } catch {
      toast('복사하지 못했습니다. 직접 선택해서 복사해 주세요.', true);
    }
  };
  const delta = (cur, prev) => {
    if (!prev) return cur ? '<em class="delta up">▲ 새로 생김</em>' : '<em class="muted">지난 기간과 같음</em>';
    const r = Math.round(((cur - prev) / prev) * 100);
    if (r === 0) return '<em class="muted">지난 기간과 같음</em>';
    return `<em class="delta ${r > 0 ? 'up' : 'down'}">${r > 0 ? '▲' : '▼'} ${Math.abs(r)}%</em> <em class="muted">지난 기간 대비</em>`;
  };

  // ── KPI ──────────────────────────────────────────────────────
  views.kpi = async (main, parts, q) => {
    const today = ymd(new Date());
    const presets = {
      month: [today.slice(0, 8) + '01', today],
      last: (() => {
        const m = addMonth(today.slice(0, 7), -1);
        const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
        return [`${m}-01`, `${m}-${pad(last)}`];
      })(),
      q3: [`${addMonth(today.slice(0, 7), -2)}-01`, today],
      year: [`${today.slice(0, 4)}-01-01`, today],
    };
    const from = q.get('from') || presets.month[0];
    const to = q.get('to') || presets.month[1];
    const venue = q.get('venue') || '';
    const d = await api(`/kpi?from=${from}&to=${to}${venue ? `&venue=${venue}` : ''}`);
    const K = window.MZK;
    const B = d.behavior;
    const which = Object.entries(presets).find(([, [a, b]]) => a === d.from && b === d.to)?.[0] || '';
    const go = (f, t, v = venue) => (location.hash = `#/kpi?from=${f}&to=${t}${v ? `&venue=${v}` : ''}`);
    const avg = d.bookings ? Math.round(d.revenue / d.bookings) : 0;
    const prevAvg = d.prev.bookings ? Math.round(d.prev.revenue / d.prev.bookings) : 0;
    const resp = d.response;
    const maxEt = Math.max(1, ...d.event_types.map((x) => x.n));
    const maxRef = Math.max(1, ...d.referrers.map((x) => x.n));
    const maxPg = Math.max(1, ...d.pages.map((x) => x.n));
    const pageName = (p) => {
      if (p === '/') return '홈';
      const m = p.match(/^\/venues\/(.+)$/);
      if (m) return `공간 · ${venueName(m[1])}`;
      return { '/venues': '공간 목록', '/cases': '대관 사례', '/guide': '이용 안내', '/inquiry': '대관 문의', '/brochure': '소개서 받기', '/host': '공간 파트너' }[p] || p;
    };

    main.innerHTML = `
      <div class="head"><div><h1>KPI 요약</h1><p>방문부터 문의, 예약, 매출까지 한눈에 봅니다. <span class="muted">${esc(d.from)} ~ ${esc(d.to)}${venue ? ` · ${esc(venueName(venue))}` : ' · 전체 지점'} · 비교: ${esc(d.prev.from)} ~ ${esc(d.prev.to)}</span></p></div>
        <div class="head-actions"><a class="btn" href="/api/admin/export?type=leads">소개서 요청 CSV</a><a class="btn" href="/api/admin/export?type=inquiries">문의 CSV</a></div></div>
      ${K ? K.tabs('', d) : ''}
      <div class="periods">
        <div class="seg" style="margin:0">${[['month', '이번 달'], ['last', '지난 달'], ['q3', '최근 3개월'], ['year', '올해']].map(([k, l]) => `<button type="button" data-p="${k}" class="${which === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
        <input type="date" id="k-from" value="${esc(d.from)}" aria-label="시작일"> ~ <input type="date" id="k-to" value="${esc(d.to)}" aria-label="종료일">
        <select id="k-venue" aria-label="지점"><option value="">전체 지점</option>${venuesOpen().map((v) => `<option value="${esc(v.slug)}"${v.slug === venue ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      </div>
      ${K && B ? `<h2 class="kpi-group">방문·행동 <a href="#/kpi/traffic?from=${d.from}&to=${d.to}">방문 분석 자세히</a></h2>
      <div class="kpis kpis-5">
        ${K.card('방문자', K.N(d.visitors), delta(d.visitors, d.prev.visitors))}
        ${K.card('페이지뷰', K.N(B.cur.pageviews), delta(B.cur.pageviews, B.prev.pageviews))}
        ${K.card('평균 머문 시간 <small>방문당</small>', K.dur(B.cur.avg_session_ms), K.delta(B.cur.avg_session_ms, B.prev.avg_session_ms))}
        ${K.card('이탈률', K.pct(B.cur.bounce), K.delta(B.cur.bounce, B.prev.bounce, true))}
        ${K.card('클릭', K.N(B.cur.clicks), delta(B.cur.clicks, B.prev.clicks))}
      </div>
      <h2 class="kpi-group">고객·영업 <a href="#/kpi/members?from=${d.from}&to=${d.to}">고객·회원 자세히</a></h2>` : ''}
      <div class="kpis kpis-5">
        ${venue ? `<div class="kpi"><span>공간 페이지 조회</span><strong>${d.pageviews}</strong><em>${delta(d.pageviews, d.prev.pageviews)}</em></div>`
          : K && B ? K.card('새 고객', K.N(B.cur.new_customers), delta(B.cur.new_customers, B.prev.new_customers))
          : `<div class="kpi"><span>방문자</span><strong>${d.visitors}</strong><em>${delta(d.visitors, d.prev.visitors)}</em></div>`}
        <div class="kpi"><span>소개서 요청</span><strong>${d.leads}</strong><em>${delta(d.leads, d.prev.leads)}</em></div>
        <div class="kpi"><span>대관 문의</span><strong>${d.inquiries}</strong><em>${delta(d.inquiries, d.prev.inquiries)}</em></div>
        <div class="kpi"><span>확정 매출</span><strong>${MZChart.won(d.revenue)}<small style="font-size:1rem;font-weight:600">원</small></strong><em>${delta(d.revenue, d.prev.revenue)}</em></div>
        <div class="kpi"><span>확정 예약</span><strong>${d.bookings}<small style="font-size:1rem;font-weight:600">건</small></strong><em>${delta(d.bookings, d.prev.bookings)}</em></div>
        <div class="kpi"><span>평균 객단가</span><strong>${avg ? MZChart.won(avg) : '–'}${avg ? '<small style="font-size:1rem;font-weight:600">원</small>' : ''}</strong><em>${avg ? delta(avg, prevAvg) : '확정 예약이 없습니다'}</em></div>
        <div class="kpi"><span>가동률</span><strong>${pct(d.occupancy)}</strong><em>행사로 쓰인 날 ÷ 기간 일수</em></div>
        <div class="kpi"><span>문의 → 예약 확정</span><strong>${pct(d.cohort.rate)}</strong><em>기간 안 문의 ${d.cohort.total}건 중 ${d.cohort.won}건 확정</em></div>
        <div class="kpi${resp.waiting ? ' is-hot' : ''}"><span>첫 응답(중앙값)</span><strong>${resp.median_hours == null ? '–' : resp.median_hours < 1 ? `${Math.max(1, Math.round(resp.median_hours * 60))}분` : `${Math.round(resp.median_hours * 10) / 10}시간`}</strong><em>24시간 안 응답 ${pct(resp.within24)}${resp.waiting ? ` · 응답 전 ${resp.waiting}건` : ''}</em></div>
        <div class="kpi"><span>행사까지 남은 기간</span><strong>${d.lead_days == null ? '–' : `${d.lead_days}일`}</strong><em>문의일부터 희망 시작일까지 평균</em></div>
      </div>
      <div class="cols">
        <div>
          <section class="card"><h2>단계별 흐름 <span class="muted small">기간 안에 일어난 건수</span></h2><div id="k-funnel"></div>
            <p class="muted small" style="margin-top:10px">방문자는 쿠키 없이 하루 단위로 센 값입니다(같은 사람이 다른 날 다시 오면 다시 셉니다). ${venue ? '지점을 고르면 방문자 대신 그 지점 공간 페이지 조회 수를 씁니다.' : ''}</p></section>
          <section class="card"><h2>지점별</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>지점</th><th class="num">문의</th><th class="num">확정 예약</th><th class="num">확정 매출</th><th class="num">객단가</th><th class="num">가동률</th></tr></thead><tbody>
            ${d.by_venue.map((v) => `<tr><td>${venueDot(v.slug)}</td><td class="num">${v.inquiries}</td><td class="num">${v.bookings}</td><td class="num">${won(v.revenue)}</td><td class="num">${v.bookings ? won(Math.round(v.revenue / v.bookings)) : '–'}</td><td class="num">${pct(v.occupancy)} <span class="muted small">${v.used_days}/${v.days}일</span></td></tr>`).join('')}
          </tbody></table></div></section>
          <section class="card"><h2>행사 유형</h2>${d.event_types.length ? `<ul class="rank">${d.event_types.map((x) => `<li><span>${esc(x.t)}</span><b>${x.n}</b><i style="width:${(x.n / maxEt) * 100}%"></i></li>`).join('')}</ul>` : '<p class="empty">이 기간에 들어온 문의가 없습니다.</p>'}</section>
          <section class="card"><h2>문의 경로</h2>${d.sources.length ? `<ul class="rank">${d.sources.map((x) => `<li><span>${esc(SOURCE[x.source] || x.source)}</span><b>${x.n}</b></li>`).join('')}</ul>` : '<p class="empty">이 기간에 들어온 문의가 없습니다.</p>'}
            <p class="muted small" style="margin-top:10px">소개서 요청 ${d.leads}건 중 상담 연락을 원한 요청 ${d.lead_calls}건, 실제로 내려받은 요청 ${d.lead_downloads}건${d.open_notify ? ` · 응암 오픈 알림 신청 ${d.open_notify}건` : ''}${d.partner_apps ? ` · 공간 파트너 입점 문의 ${d.partner_apps}건` : ''}</p></section>
        </div>
        <div>
          <section class="card"><h2>월별 확정 매출 <span class="muted small">행사 시작일 기준</span></h2><div id="k-rev"></div></section>
          <section class="card"><h2>월별 대관 문의</h2><div id="k-inq"></div></section>
          <section class="card"><h2>월별 소개서 요청</h2><div id="k-lead"></div></section>
          <section class="card"><h2>월별 방문자</h2><div id="k-uv"></div></section>
          <section class="card"><h2>들어온 사이트</h2>${d.referrers.length ? `<ul class="rank">${d.referrers.map((x) => `<li><span>${esc(x.host)}</span><b>${x.n}</b><i style="width:${(x.n / maxRef) * 100}%"></i></li>`).join('')}</ul>` : '<p class="empty">다른 사이트에서 들어온 기록이 아직 없습니다.</p>'}</section>
          <section class="card"><h2>많이 본 페이지 <a class="small" href="#/kpi/pages?from=${d.from}&to=${d.to}" style="font-weight:600">페이지·클릭 자세히</a></h2>${d.pages.length ? `<ul class="rank">${d.pages.map((x) => `<li><span>${esc(pageName(x.path))}</span><b>${x.n}</b><i style="width:${(x.n / maxPg) * 100}%"></i></li>`).join('')}</ul>` : '<p class="empty">아직 집계된 방문이 없습니다.</p>'}</section>
        </div>
      </div>`;

    MZChart.funnel(main.querySelector('#k-funnel'), [
      { label: venue ? '공간 페이지 조회' : '방문자', value: venue ? d.pageviews : d.visitors },
      { label: '소개서 요청', value: d.leads },
      { label: '대관 문의', value: d.inquiries },
      { label: '견적 발송', value: d.quotes_sent },
      { label: '견적 수락', value: d.quotes_accepted },
      { label: '예약 확정', value: d.bookings },
    ]);
    const short = (m) => `${Number(m.slice(5))}월`;
    const rows = (key, fmt, unit = '') => d.monthly.map((t) => ({ label: short(t.month), full: monthLabel(t.month), value: t[key], tip: `${fmt(t[key])}${unit}` }));
    MZChart.bars(main.querySelector('#k-rev'), rows('revenue', won, '원'), { fmt: MZChart.won, name: '월별 확정 매출(원)', col: '월', highlightLast: true });
    MZChart.bars(main.querySelector('#k-inq'), rows('inquiries', MZChart.count, '건'), { name: '월별 대관 문의(건)', unit: '건', col: '월', highlightLast: true, height: 160 });
    MZChart.bars(main.querySelector('#k-lead'), rows('leads', MZChart.count, '건'), { name: '월별 소개서 요청(건)', unit: '건', col: '월', highlightLast: true, height: 160 });
    MZChart.bars(main.querySelector('#k-uv'), rows('visitors', MZChart.count, '명'), { name: '월별 방문자(명)', unit: '명', col: '월', highlightLast: true, height: 160 });

    main.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => go(...presets[b.dataset.p])));
    const apply = () => {
      const f = main.querySelector('#k-from').value;
      const t = main.querySelector('#k-to').value;
      if (f && t) go(f, t, main.querySelector('#k-venue').value);
    };
    main.querySelector('#k-from').addEventListener('change', apply);
    main.querySelector('#k-to').addEventListener('change', apply);
    main.querySelector('#k-venue').addEventListener('change', apply);
  };

  // ── 소개서 요청 ──────────────────────────────────────────────
  views.leads = async (main, parts, q) => {
    const status = q.get('status') || '';
    const d = await api(`/leads?${new URLSearchParams({ status, q: q.get('q') || '' })}`);
    const L = S.enums.LEAD_STATUS;
    main.innerHTML = `
      <div class="head"><div><h1>소개서 요청</h1><p>홈페이지에서 공간소개서를 받아 간 사람들입니다. 상담을 원한 요청부터 연락해 보세요.</p></div>
        <div class="head-actions"><a class="btn" href="/api/admin/export?type=leads">CSV 내려받기</a><a class="btn" href="#/files">소개서 파일 관리</a></div></div>
      <div class="seg">${[['', '전체'], ...Object.entries(L)].map(([k, l]) => `<button type="button" data-st="${k}" class="${status === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      <form class="bar" id="l-search"><input type="search" name="q" value="${esc(q.get('q') || '')}" placeholder="이름, 회사, 연락처, 요청번호" aria-label="검색"><button class="btn" type="submit">찾기</button></form>
      <section class="card">${d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>요청일</th><th>받은 소개서</th><th>요청한 사람</th><th>연락처</th><th>행사·시기</th><th class="num">받은 횟수</th><th>상태</th></tr></thead><tbody>
        ${d.items.map((r) => `<tr data-lead="${r.id}" style="cursor:pointer"><td>${esc(day(r.created_at))}</td><td>${r.venues.map((v) => venueDot(v)).join('<br>')}</td><td><b>${esc(r.name)}</b>${r.company ? ` <span class="muted">${esc(r.company)}</span>` : ''}${r.wants_call ? ' <span class="badge-kind">상담 희망</span>' : ''}</td><td>${esc(r.phone)}<br><span class="muted small">${esc(r.email)}</span></td><td>${esc(r.event_type || '–')}${r.event_month ? `<br><span class="muted small">${esc(r.event_month)}</span>` : ''}</td><td class="num">${r.downloads}</td><td>${st(r.status === 'new' ? 'new' : r.status === 'converted' ? 'confirmed' : r.status === 'closed' ? 'cancelled' : 'consulting', L[r.status])}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">아직 소개서 요청이 없습니다. 홈페이지의 소개서 받기 화면에서 들어온 요청이 여기에 쌓입니다.</p>'}</section>`;
    main.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => (location.hash = `#/leads?status=${b.dataset.st}`)));
    main.querySelector('#l-search').addEventListener('submit', (e) => {
      e.preventDefault();
      location.hash = `#/leads?status=${status}&q=${encodeURIComponent(e.target.q.value)}`;
    });
    main.querySelectorAll('[data-lead]').forEach((tr) => tr.addEventListener('click', () => leadModal(Number(tr.dataset.lead))));
  };

  async function leadModal(id) {
    const d = await api(`/leads/${id}`);
    const r = d.item;
    const L = S.enums.LEAD_STATUS;
    const m = modal({
      title: `소개서 요청 ${r.code}`,
      wide: true,
      body: `<dl class="kv">
          <div><dt>요청일시</dt><dd>${esc(dt(r.created_at))}</dd></div>
          <div><dt>받은 소개서</dt><dd>${r.venues.map((v) => esc(venueName(v))).join(', ')}</dd></div>
          <div><dt>이름</dt><dd>${esc(r.name)}${r.company ? ` · ${esc(r.company)}` : ''}</dd></div>
          <div><dt>연락처</dt><dd><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a> · <a href="mailto:${esc(r.email)}">${esc(r.email)}</a></dd></div>
          <div><dt>행사</dt><dd>${esc(r.event_type || '미정')}${r.event_month ? ` · ${esc(r.event_month)}` : ''}</dd></div>
          <div><dt>상담 희망</dt><dd>${r.wants_call ? '예, 상담 연락을 원합니다' : '아니요'}</dd></div>
          <div><dt>내려받은 횟수</dt><dd>${r.downloads}회${r.last_download_at ? ` · 마지막 ${esc(dt(r.last_download_at))}` : ''}</dd></div>
          ${r.referrer ? `<div><dt>들어온 곳</dt><dd>${esc(r.referrer)}</dd></div>` : ''}
          ${d.inquiries.length ? `<div><dt>같은 고객의 문의</dt><dd>${d.inquiries.map((i) => `<a href="#/inquiries/${i.id}" style="border-bottom:1px solid currentColor">${esc(i.code)}</a>`).join(', ')}</dd></div>` : ''}
        </dl>
        <div class="g2" style="margin-top:16px">
          <label class="f"><span>상태</span><select id="l-status">${Object.entries(L).map(([k, l]) => `<option value="${k}"${k === r.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <label class="f"><span>메모</span><textarea id="l-memo" rows="3" maxlength="3000">${esc(r.memo || '')}</textarea></label>`,
      foot: `<button type="button" class="btn btn-danger" data-del>삭제</button><span style="flex:1"></span>${r.inquiry_id ? `<a class="btn" href="#/inquiries/${r.inquiry_id}">전환된 문의 보기</a>` : '<button type="button" class="btn" data-conv>대관 문의로 전환</button>'}<button type="button" class="btn btn-point" data-save>저장</button>`,
    });
    m.$('[data-save]').addEventListener('click', async () => {
      try {
        await api(`/leads/${id}`, { method: 'PATCH', body: { status: m.$('#l-status').value, memo: m.$('#l-memo').value } });
        toast('저장했습니다');
        m.close();
        route();
      } catch (ex) { toast(ex.message, true); }
    });
    m.$('[data-conv]')?.addEventListener('click', async () => {
      try {
        const res = await api(`/leads/${id}/convert`, { method: 'POST' });
        m.close();
        toast('대관 문의로 옮겼습니다');
        location.hash = `#/inquiries/${res.inquiry_id}`;
      } catch (ex) { toast(ex.message, true); }
    });
    m.$('[data-del]').addEventListener('click', async () => {
      if (!(await confirmBox('이 소개서 요청을 지울까요? 지운 기록은 되돌릴 수 없습니다.', '삭제', true))) return;
      try {
        await api(`/leads/${id}`, { method: 'DELETE' });
        m.close();
        route();
      } catch (ex) { toast(ex.message, true); }
    });
  }

  // ── 소개서 파일 ──────────────────────────────────────────────
  views.files = async (main) => {
    const d = await api('/files');
    const mb = (n) => `${(n / 1048576).toFixed(1)}MB`;
    const sb = d.site;
    main.innerHTML = `
      <div class="head"><div><h1>공간소개서</h1><p>홈페이지에서 연락처를 남긴 사람이 내려받는 PDF입니다. 지금은 네 지점을 한 권에 담은 통합 소개서를 드립니다.</p></div>
        <div class="head-actions"><a class="btn" href="/brochure" target="_blank" rel="noopener">소개서 받기 화면 보기</a><a class="btn" href="#/leads">소개서 요청 보기</a></div></div>
      ${sb ? `<section class="card filecard site-bro">
        <img src="${esc(sb.cover)}" alt="" style="width:180px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--line);flex:none">
        <div style="flex:1;min-width:0">
          <h3>${esc(sb.name)} <span class="st st-confirmed" style="margin-left:6px">홈페이지에서 받는 소개서</span></h3>
          <p class="muted small">${esc(sb.label)} · ${sb.pages}쪽</p>
          <p class="muted small">${sb.file ? `직접 올린 파일로 바꿔 쓰는 중 · ${mb(sb.file.size)} · ${esc(dt(sb.file.updated_at))}` : `사이트에 함께 올린 파일 · ${mb(sb.size)}`}</p>
          <p class="small" style="margin-top:6px">요청 ${sb.leads}건 · 내려받기 ${sb.downloads}회</p>
        </div>
        <div class="head-actions">
          <a class="btn btn-sm" href="/api/admin/files/brochure/${esc(sb.slug)}" target="_blank" rel="noopener">미리 보기</a>
          <label class="btn btn-sm" style="cursor:pointer">새 PDF로 바꾸기<input type="file" accept="application/pdf" data-site-up hidden></label>
          ${sb.file ? '<button type="button" class="btn btn-sm" data-site-reset>원래 파일로 되돌리기</button>' : ''}
        </div>
      </section>` : ''}
      <h2 style="font-size:1rem;margin:28px 0 4px">지점별 소개서 <span class="muted small" style="font-weight:400">보관용 · 지금은 홈페이지에 보이지 않습니다</span></h2>
      ${d.items.filter((v) => v.status !== 'coming').map((v) => `<section class="card filecard" data-slug="${esc(v.slug)}">
        <div>
          <h3>${esc(v.name)}</h3>
          <p class="muted small">${v.file && v.file.state === 1 ? `저장됨 · ${mb(v.file.size)} · ${esc(dt(v.file.updated_at))} · ${v.file.src === 'upload' ? '직접 올린 파일' : '드라이브에서 받은 파일'}` : v.drive_id ? '아직 저장 전입니다. 첫 요청 때 드라이브에서 받아 오거나, 아래 "드라이브에서 받기"를 누르세요.' : '소개서가 없습니다. PDF를 올리거나 지점 정보에 드라이브 링크를 넣어 주세요.'}</p>
          <p class="small" style="margin-top:6px">요청 ${v.leads}건 · 내려받기 ${v.downloads}회${v.brochure ? ` · <a href="${esc(v.brochure)}" target="_blank" rel="noopener" style="border-bottom:1px solid currentColor">드라이브 원본</a>` : ''}</p>
        </div>
        <div class="head-actions">
          ${v.file && v.file.state === 1 ? `<a class="btn btn-sm" href="/api/admin/files/brochure/${esc(v.slug)}" target="_blank" rel="noopener">미리 보기</a>` : ''}
          ${v.drive_id ? '<button type="button" class="btn btn-sm" data-fetch>드라이브에서 받기</button>' : ''}
          <label class="btn btn-sm" style="cursor:pointer">PDF 올리기<input type="file" accept="application/pdf" data-up hidden></label>
          ${v.file ? '<button type="button" class="btn btn-sm btn-danger" data-del>지우기</button>' : ''}
        </div>
      </section>`).join('')}
      <p class="muted small">드라이브 링크는 지점 정보에서 바꿀 수 있습니다. 파일 공유는 "링크가 있는 모든 사용자"여야 합니다. 직접 올린 파일이 있으면 그 파일을 먼저 씁니다.</p>`;
    main.querySelector('[data-site-up]')?.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 25_000_000) return toast('25MB 이하의 PDF만 올릴 수 있습니다.', true);
      toast('올리는 중입니다');
      try {
        await api(`/files/brochure/${sb.slug}`, { method: 'PUT', raw: { body: f, type: 'application/pdf' } });
        toast('새 소개서로 바꿨습니다');
      } catch (ex) { toast(ex.message, true); }
      route();
    });
    main.querySelector('[data-site-reset]')?.addEventListener('click', async () => {
      if (!(await confirmBox('직접 올린 소개서를 지우고 사이트에 함께 올린 원래 파일로 되돌릴까요?', '되돌리기', true))) return;
      try {
        await api(`/files/brochure/${sb.slug}`, { method: 'DELETE' });
        toast('원래 파일로 되돌렸습니다');
      } catch (ex) { toast(ex.message, true); }
      route();
    });
    main.querySelectorAll('.filecard[data-slug]').forEach((card) => {
      const slug = card.dataset.slug;
      card.querySelector('[data-fetch]')?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        e.target.textContent = '받는 중입니다';
        try {
          await api(`/files/brochure/${slug}/fetch`, { method: 'POST' });
          toast('드라이브에서 받아 저장했습니다');
        } catch (ex) { toast(ex.message, true); }
        route();
      });
      card.querySelector('[data-up]').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 25_000_000) return toast('25MB 이하의 PDF만 올릴 수 있습니다.', true);
        toast('올리는 중입니다');
        try {
          await api(`/files/brochure/${slug}`, { method: 'PUT', raw: { body: f, type: 'application/pdf' } });
          toast('소개서를 올렸습니다');
        } catch (ex) { toast(ex.message, true); }
        route();
      });
      card.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmBox('저장된 소개서 파일을 지울까요? 드라이브 링크가 있으면 다음 요청 때 다시 받아 옵니다.', '지우기', true))) return;
        try {
          await api(`/files/brochure/${slug}`, { method: 'DELETE' });
        } catch (ex) { toast(ex.message, true); }
        route();
      });
    });
  };

  // ── 입점 문의 ────────────────────────────────────────────────
  views.partners = async (main, parts, q) => {
    const P = S.enums.PARTNER_STATUS;
    if (parts[0]) return partnerDetail(main, Number(parts[0]));
    const status = q.get('status') || '';
    const d = await api(`/partners${status ? `?status=${status}` : ''}`);
    main.innerHTML = `
      <div class="head"><div><h1>입점 문의</h1><p>홈페이지 공간 파트너 페이지로 들어온 건물주 문의입니다.</p></div>
        <div class="head-actions"><a class="btn" href="/host" target="_blank" rel="noopener">공간 파트너 페이지 보기</a><a class="btn" href="/api/admin/export?type=partners">CSV 내려받기</a></div></div>
      <div class="seg">${[['', '전체'], ...Object.entries(P)].map(([k, l]) => `<button type="button" data-st="${k}" class="${status === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      <section class="card">${d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>접수일</th><th>건물 위치</th><th>문의한 사람</th><th>건물</th><th>지금 상태</th><th>운영 방식</th><th>상태</th></tr></thead><tbody>
        ${d.items.map((r) => `<tr data-href="#/partners/${r.id}"><td>${esc(day(r.created_at))}</td><td><b>${esc(r.address)}</b></td><td>${esc(r.name)}${r.relation ? ` <span class="muted small">${esc(r.relation)}</span>` : ''}<br><span class="muted small">${esc(r.phone)}</span></td><td>${esc([r.building_type, r.floors, r.area].filter(Boolean).join(' · ') || '–')}</td><td>${esc(r.vacancy || '–')}${r.available_from ? `<br><span class="muted small">${esc(r.available_from)}</span>` : ''}</td><td>${esc(r.model || '–')}</td><td>${st(r.status === 'contracted' ? 'confirmed' : r.status === 'declined' ? 'cancelled' : r.status === 'new' ? 'new' : 'consulting', P[r.status])}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">아직 들어온 입점 문의가 없습니다.</p>'}</section>`;
    main.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => (location.hash = `#/partners?status=${b.dataset.st}`)));
  };

  async function partnerDetail(main, id) {
    const P = S.enums.PARTNER_STATUS;
    const { item: r } = await api(`/partners/${id}`);
    main.innerHTML = `
      <p><a class="back" href="#/partners">← 입점 문의 목록</a></p>
      <div class="head"><div><h1>${esc(r.address)}</h1><p>${esc(r.code)} · ${esc(dt(r.created_at))} 접수</p></div>
        <div class="head-actions">${r.host_id ? `<a class="btn" href="#/hosts/${r.host_id}">연결된 호스트 보기</a>` : '<button type="button" class="btn btn-point" id="p-host">호스트 계정 만들기</button>'}</div></div>
      <div class="cols">
        <section class="card"><h2>문의 내용</h2><dl class="kv">
          <div><dt>문의한 사람</dt><dd>${esc(r.name)}${r.relation ? ` (${esc(r.relation)})` : ''}${r.company ? ` · ${esc(r.company)}` : ''}</dd></div>
          <div><dt>연락처</dt><dd><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${r.email ? ` · <a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''}</dd></div>
          <div><dt>건물 위치</dt><dd>${esc(r.address)}</dd></div>
          <div><dt>건물 형태</dt><dd>${esc(r.building_type || '–')}</dd></div>
          <div><dt>층수 · 연면적</dt><dd>${esc([r.floors, r.area].filter(Boolean).join(' · ') || '–')}</dd></div>
          <div><dt>지금 상태</dt><dd>${esc(r.vacancy || '–')}</dd></div>
          <div><dt>쓸 수 있는 시기</dt><dd>${esc(r.available_from || '–')}</dd></div>
          <div><dt>관심 운영 방식</dt><dd>${esc(r.model || '–')}</dd></div>
          <div><dt>자료 링크</dt><dd>${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer" style="border-bottom:1px solid currentColor">${esc(r.link)}</a>` : '–'}</dd></div>
        </dl>${r.message ? `<p style="margin-top:14px;white-space:pre-line">${esc(r.message)}</p>` : ''}</section>
        <section class="card"><h2>진행 관리</h2>
          <label class="f"><span>상태</span><select id="p-status">${Object.entries(P).map(([k, l]) => `<option value="${k}"${k === r.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="f"><span>메모 <small>현장 확인 결과, 제안 조건 등</small></span><textarea id="p-memo" rows="8" maxlength="5000">${esc(r.memo || '')}</textarea></label>
          <p style="display:flex;gap:8px"><button type="button" class="btn btn-point" id="p-save">저장</button><button type="button" class="btn btn-danger" id="p-del">삭제</button></p>
        </section>
      </div>`;
    main.querySelector('#p-save').addEventListener('click', async () => {
      try {
        await api(`/partners/${id}`, { method: 'PATCH', body: { status: main.querySelector('#p-status').value, memo: main.querySelector('#p-memo').value } });
        toast('저장했습니다');
      } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#p-del').addEventListener('click', async () => {
      if (!(await confirmBox('이 입점 문의를 지울까요?', '삭제', true))) return;
      await api(`/partners/${id}`, { method: 'DELETE' }).catch((ex) => toast(ex.message, true));
      location.hash = '#/partners';
    });
    main.querySelector('#p-host')?.addEventListener('click', () => hostForm({ name: r.name, company: r.company, phone: r.phone, email: r.email, venues: [], share_rate: '', memo: `입점 문의 ${r.code} (${r.address})` }, { fromApp: id }));
  }

  // ── 호스트 ───────────────────────────────────────────────────
  const hostFields = (h) => `
    <div class="g2">
      <label class="f"><span>이름 <small>필수</small></span><input type="text" name="name" maxlength="40" value="${esc(h.name || '')}" required></label>
      <label class="f"><span>회사·법인</span><input type="text" name="company" maxlength="80" value="${esc(h.company || '')}"></label>
      <label class="f"><span>연락처</span><input type="tel" name="phone" maxlength="30" value="${esc(h.phone || '')}"></label>
      <label class="f"><span>이메일</span><input type="email" name="email" maxlength="120" value="${esc(h.email || '')}"></label>
    </div>
    <div class="f"><span>연결할 공간 <small>호스트는 이 공간의 일정·매출만 봅니다</small></span><div class="ck">${S.content.venues.map((v) => `<label><input type="checkbox" name="venues" value="${esc(v.slug)}"${(h.venues || []).includes(v.slug) ? ' checked' : ''}> ${esc(v.name)}</label>`).join('')}</div></div>
    <div class="g2"><label class="f"><span>매출 배분율(%) <small>호스트에게 돌아가는 비율</small></span><input type="number" name="share_rate" min="0" max="100" step="0.1" value="${esc(h.share_rate ?? '')}"></label></div>
    <label class="f"><span>메모 <small>계약 조건 등, 호스트에게는 보이지 않습니다</small></span><textarea name="memo" rows="3" maxlength="2000">${esc(h.memo || '')}</textarea></label>`;

  const inviteBox = (url, expires) => `<p>아래 초대 링크를 호스트에게 카카오톡이나 문자로 보내 주세요. 링크를 열어 아이디와 비밀번호를 정하면 호스트센터를 쓸 수 있습니다.</p>
    <div class="invite"><input type="text" readonly value="${esc(url)}" onclick="this.select()" aria-label="초대 링크"><button type="button" class="btn" data-copy>복사</button></div>
    <p class="muted small" style="margin-top:8px">${esc(day(expires))}까지 쓸 수 있습니다. 이미 가입한 호스트가 이 링크를 열면 비밀번호를 새로 정할 수 있습니다.</p>`;

  function showInvite(url, expires) {
    const m = modal({ title: '호스트 초대 링크', body: inviteBox(url, expires), foot: '<button type="button" class="btn btn-point" data-ok>확인</button>' });
    m.$('[data-copy]').addEventListener('click', () => copyText(url));
    m.$('[data-ok]').addEventListener('click', m.close);
  }

  function hostForm(h, { fromApp = 0 } = {}) {
    const m = modal({
      title: '호스트 추가',
      wide: true,
      body: `<form id="h-form" novalidate>${hostFields(h)}</form>`,
      foot: '<button type="button" class="btn" data-no>취소</button><button type="button" class="btn btn-point" data-yes>추가하고 초대 링크 만들기</button>',
    });
    m.$('[data-no]').addEventListener('click', m.close);
    m.$('[data-yes]').addEventListener('click', async () => {
      const f = formData(m.$('#h-form'));
      try {
        const r = await api('/hosts', { method: 'POST', body: { ...f, venues: [].concat(f.venues || []), from_app: fromApp } });
        m.close();
        location.hash = `#/hosts/${r.id}`;
        setTimeout(() => showInvite(r.invite_url, r.invite_expires), 300);
      } catch (ex) { toast(ex.message, true); }
    });
  }

  views.hosts = async (main, parts, q) => {
    if (parts[0] === 'notices') return noticesView(main);
    if (parts[0]) return hostDetail(main, Number(parts[0]));
    const d = await api('/hosts');
    const H = S.enums.HOST_STATUS;
    main.innerHTML = `
      <div class="head"><div><h1>호스트</h1><p>메자닌에 공간을 맡긴 건물주(공간 파트너) 계정입니다. 호스트는 호스트센터(/host/center)에서 자기 공간의 일정, 매출, 정산만 볼 수 있고 고객 개인정보는 보지 못합니다.</p></div>
        <div class="head-actions"><a class="btn" href="#/hosts/notices">호스트 공지</a><a class="btn" href="#/settlements">정산</a><button type="button" class="btn btn-point" id="h-add">호스트 추가</button></div></div>
      <section class="card">${d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>호스트</th><th>연결된 공간</th><th class="num">배분율</th><th>상태</th><th>최근 로그인</th></tr></thead><tbody>
        ${d.items.map((h) => `<tr data-href="#/hosts/${h.id}"><td><b>${esc(h.name)}</b>${h.company ? ` <span class="muted">${esc(h.company)}</span>` : ''}${h.unread_admin ? `<span class="unread">${h.unread_admin}</span>` : ''}${h.login ? `<br><span class="muted small">${esc(h.login)}</span>` : ''}</td><td>${h.venues.map((v) => venueDot(v)).join('<br>') || '<span class="muted">없음</span>'}</td><td class="num">${h.share_rate ? `${h.share_rate}%` : '–'}</td><td>${st(h.status === 'active' ? 'confirmed' : h.status === 'paused' ? 'cancelled' : 'new', H[h.status] || h.status)}</td><td>${h.last_login_at ? esc(dt(h.last_login_at)) : '<span class="muted">아직 없음</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">아직 호스트가 없습니다. 입점이 확정되면 "호스트 추가"로 계정을 만들고 초대 링크를 보내 주세요.</p>'}</section>`;
    main.querySelector('#h-add').addEventListener('click', () => hostForm({ venues: [] }));
  };

  async function hostDetail(main, id) {
    const d = await api(`/hosts/${id}`);
    const h = d.item;
    const H = S.enums.HOST_STATUS;
    const SS = S.enums.SETTLE_STATUS;
    main.innerHTML = `
      <p><a class="back" href="#/hosts">← 호스트 목록</a></p>
      <div class="head"><div><h1>${esc(h.name)}${h.company ? ` <span class="muted" style="font-size:1rem;font-weight:600">${esc(h.company)}</span>` : ''}</h1>
        <p>${st(h.status === 'active' ? 'confirmed' : h.status === 'paused' ? 'cancelled' : 'new', H[h.status])} ${h.login ? `아이디 ${esc(h.login)} · ` : '아직 가입 전 · '}${h.last_login_at ? `최근 로그인 ${esc(dt(h.last_login_at))}` : '로그인 기록 없음'}</p></div>
        <div class="head-actions"><button type="button" class="btn" id="h-invite">${h.login ? '비밀번호 재설정 링크' : '초대 링크 다시 만들기'}</button><button type="button" class="btn btn-danger" id="h-del">삭제</button></div></div>
      <div class="cols">
        <div>
          <section class="card"><h2>호스트 정보</h2><form id="h-form" novalidate>${hostFields(h)}
            <label class="f"><span>계정 상태</span><select name="status">${Object.entries(H).map(([k, l]) => `<option value="${k}"${k === h.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <button type="submit" class="btn btn-point">저장</button></form></section>
          <section class="card"><h2>정산 <a class="btn-text small" href="#/settlements">정산 화면</a></h2>${d.settlements.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>월</th><th>공간</th><th class="num">매출</th><th class="num">지급액</th><th>상태</th></tr></thead><tbody>
            ${d.settlements.map((s) => `<tr><td>${esc(s.month)}</td><td>${venueDot(s.venue)}</td><td class="num">${won(s.gross)}</td><td class="num">${won(s.payout)}</td><td>${st(s.status === 'paid' ? 'done' : s.status === 'confirmed' ? 'confirmed' : 'new', SS[s.status])}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="empty">아직 정산이 없습니다. 정산 화면에서 달마다 만들 수 있습니다.</p>'}</section>
        </div>
        <section class="card"><h2>메시지</h2>
          <div class="chat" id="chat">${d.messages.length ? d.messages.map((m) => `<div class="msg ${m.sender === 'admin' ? 'msg-admin' : 'msg-customer'}"><p>${esc(m.body)}</p><span>${esc(m.sender === 'admin' ? m.author || '관리자' : h.name)} · ${esc(dt(m.created_at))}</span></div>`).join('') : '<p class="empty">아직 주고받은 메시지가 없습니다.</p>'}</div>
          <form class="chat-form" id="chat-form"><textarea name="body" rows="3" maxlength="2000" placeholder="호스트에게 보낼 내용" aria-label="메시지 내용"></textarea><button class="btn btn-point" type="submit">보내기</button></form>
          <p class="muted small">호스트는 호스트센터의 메시지 메뉴에서 확인합니다.</p>
        </section>
      </div>`;
    const chat = main.querySelector('#chat');
    chat.scrollTop = chat.scrollHeight;
    main.querySelector('#h-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(e.target);
      try {
        await api(`/hosts/${id}`, { method: 'PATCH', body: { ...f, venues: [].concat(f.venues || []) } });
        toast('저장했습니다');
        route();
      } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#h-invite').addEventListener('click', async () => {
      try {
        const r = await api(`/hosts/${id}/invite`, { method: 'POST' });
        showInvite(r.invite_url, r.invite_expires);
      } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#h-del').addEventListener('click', async () => {
      if (!(await confirmBox('이 호스트 계정을 지울까요? 메시지와 작성 중인 정산도 함께 지워집니다. 확정·지급된 정산 기록은 남습니다.', '삭제', true))) return;
      await api(`/hosts/${id}`, { method: 'DELETE' }).catch((ex) => toast(ex.message, true));
      location.hash = '#/hosts';
    });
    main.querySelector('#chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = e.target.body.value.trim();
      if (!body) return;
      try {
        await api(`/hosts/${id}/messages`, { method: 'POST', body: { body } });
        route();
      } catch (ex) { toast(ex.message, true); }
    });
  }

  async function noticesView(main) {
    let list = (S.content.host_notices || []).map((n) => ({ ...n }));
    const draw = () => {
      main.innerHTML = `
        <p><a class="back" href="#/hosts">← 호스트 목록</a></p>
        <div class="head"><div><h1>호스트 공지</h1><p>호스트센터 대시보드에 보이는 공지입니다. 공간을 고르지 않으면 모든 호스트에게 보입니다.</p></div>
          <div class="head-actions"><button type="button" class="btn" id="n-add">공지 추가</button><button type="button" class="btn btn-point" id="n-save">저장</button></div></div>
        ${list.length ? list.map((n, i) => `<section class="card" data-i="${i}">
          <div class="g2"><label class="f"><span>날짜</span><input type="date" data-k="date" value="${esc(n.date || '')}"></label><label class="f"><span>제목</span><input type="text" data-k="title" maxlength="80" value="${esc(n.title || '')}"></label></div>
          <label class="f"><span>내용</span><textarea data-k="body" rows="3" maxlength="2000">${esc(n.body || '')}</textarea></label>
          <div class="f"><span>보여 줄 공간 <small>고르지 않으면 전체</small></span><div class="ck">${S.content.venues.map((v) => `<label><input type="checkbox" data-v="${esc(v.slug)}"${(n.venues || []).includes(v.slug) ? ' checked' : ''}> ${esc(v.name)}</label>`).join('')}</div></div>
          <button type="button" class="btn btn-sm btn-danger" data-rm>이 공지 지우기</button>
        </section>`).join('') : '<section class="card"><p class="empty">공지가 없습니다. 정산 일정, 점검 안내 같은 내용을 올려 보세요.</p></section>'}`;
      const read = () => {
        list = Array.from(main.querySelectorAll('[data-i]')).map((card) => ({
          date: card.querySelector('[data-k=date]').value,
          title: card.querySelector('[data-k=title]').value.trim(),
          body: card.querySelector('[data-k=body]').value.trim(),
          venues: Array.from(card.querySelectorAll('[data-v]:checked')).map((x) => x.dataset.v),
        }));
      };
      main.querySelector('#n-add').addEventListener('click', () => {
        read();
        list.unshift({ date: ymd(new Date()), title: '', body: '', venues: [] });
        draw();
      });
      main.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
        read();
        list.splice(Number(b.closest('[data-i]').dataset.i), 1);
        draw();
      }));
      main.querySelector('#n-save').addEventListener('click', async () => {
        read();
        try {
          await api('/content/host_notices', { method: 'PUT', body: { value: list.filter((n) => n.title) } });
          await reloadContent();
          toast('저장했습니다');
        } catch (ex) { toast(ex.message, true); }
      });
    };
    draw();
  }

  // ── 정산 ─────────────────────────────────────────────────────
  views.settlements = async (main, parts, q) => {
    const month = /^\d{4}-\d{2}$/.test(q.get('month') || '') ? q.get('month') : addMonth(thisMonth(), -1);
    const d = await api(`/settlements?month=${month}`);
    const SS = S.enums.SETTLE_STATUS;
    const total = d.items.reduce((a, s) => ({ gross: a.gross + s.gross, payout: a.payout + s.payout }), { gross: 0, payout: 0 });
    main.innerHTML = `
      <div class="head"><div><h1>정산</h1><p>${esc(monthLabel(month))} · 확정·완료된 예약의 대관료(행사 시작일 기준)에 호스트 배분율을 곱해 만듭니다. "확정"한 정산부터 호스트센터에 보입니다.</p></div>
        <div class="head-actions"><a class="btn" href="#/settlements?month=${addMonth(month, -1)}">← 이전 달</a><a class="btn" href="#/settlements?month=${addMonth(month, 1)}">다음 달 →</a><button type="button" class="btn btn-point" id="s-gen">${esc(monthLabel(month))} 정산 만들기</button></div></div>
      <div>
        <section class="card">${d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>호스트</th><th>공간</th><th class="num">확정 예약</th><th class="num">대관 매출</th><th class="num">배분</th><th>조정(원)</th><th class="num">지급액</th><th>상태</th><th>메모</th><th></th></tr></thead><tbody>
          ${d.items.map((s) => `<tr data-id="${s.id}"><td><a href="#/hosts/${s.host_id}"><b>${esc(s.host_name || '삭제된 호스트')}</b></a></td><td>${venueDot(s.venue)}</td><td class="num">${s.bookings}</td><td class="num">${won(s.gross)}</td><td class="num">${s.share_rate}%<br><span class="muted small">${won(s.host_amount)}</span></td>
            <td><input type="number" data-k="adjust" value="${s.adjust || 0}" step="1000" style="width:110px" aria-label="조정 금액"></td><td class="num"><b>${won(s.payout)}</b></td>
            <td><select data-k="status" aria-label="정산 상태">${Object.entries(SS).map(([k, l]) => `<option value="${k}"${k === s.status ? ' selected' : ''}>${l}</option>`).join('')}</select>${s.paid_at ? `<br><span class="muted small">${esc(s.paid_at)}</span>` : ''}</td>
            <td><input type="text" data-k="memo" value="${esc(s.memo || '')}" maxlength="2000" style="min-width:140px" aria-label="메모"></td>
            <td><button type="button" class="btn btn-sm" data-save>저장</button></td></tr>`).join('')}
          </tbody><tfoot><tr><th colspan="3">합계</th><th class="num">${won(total.gross)}</th><th></th><th></th><th class="num">${won(total.payout)}</th><th colspan="3"></th></tr></tfoot></table></div>`
          : `<p class="empty">${esc(monthLabel(month))} 정산이 아직 없습니다. 위의 "정산 만들기"를 누르면 호스트별·공간별로 계산합니다.</p>`}
        </section>
        <section class="card"><h2>지난 정산</h2>${d.months.length ? `<ul class="rank">${d.months.map((x) => `<li><a href="#/settlements?month=${esc(x.month)}">${esc(monthLabel(x.month))}</a><b>${won(x.payout)}원</b><span class="muted small" style="grid-column:1/-1">${x.n}건 중 지급 완료 ${x.paid}건</span></li>`).join('')}</ul>` : '<p class="empty">아직 정산 기록이 없습니다.</p>'}
          <p style="margin-top:14px"><a class="btn btn-sm" href="/api/admin/export?type=settlements">정산 CSV 내려받기</a></p></section>
      </div>`;
    main.querySelector('#s-gen').addEventListener('click', async () => {
      try {
        const r = await api('/settlements/generate', { method: 'POST', body: { month } });
        toast(r.made ? `${r.made}건을 계산했습니다${r.kept ? ` (확정된 ${r.kept}건은 그대로 둠)` : ''}` : '정산할 호스트·공간이 없습니다. 호스트에 공간을 먼저 연결해 주세요.', !r.made);
        route();
      } catch (ex) { toast(ex.message, true); }
    });
    main.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      try {
        await api(`/settlements/${tr.dataset.id}`, { method: 'PATCH', body: { adjust: tr.querySelector('[data-k=adjust]').value, status: tr.querySelector('[data-k=status]').value, memo: tr.querySelector('[data-k=memo]').value } });
        toast('저장했습니다');
        route();
      } catch (ex) { toast(ex.message, true); }
    }));
  };
})();
