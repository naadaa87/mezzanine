// 메자닌 호스트센터 — 공간 파트너(건물주)용 화면
(() => {
  'use strict';
  const app = document.getElementById('app');
  const toastBox = document.getElementById('toast');
  const S = { host: null };
  const MARK = '<svg class="wm" viewBox="-4.5 -4.5 985 109" role="img" aria-label="MEZZANINE" xmlns="http://www.w3.org/2000/svg"><path d="M0,100V0L52,72L104,0V100M210,0H150V100H210M150,50H202M256,0H328L256,100H328M264,50H320M374,0H446L374,100H446M382,50H438M492,100L536,4L580,100M626,100V0L702,100V0M748,0V100M794,100V0L870,100V0M976,0H916V100H976M916,50H968" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter" stroke-miterlimit="2.6"/></svg>';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => Number(n || 0).toLocaleString('ko-KR');
  const pad = (n) => String(n).padStart(2, '0');
  const dt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const period = (a, b) => (a ? (b && b !== a ? `${a} ~ ${b}` : a) : '');
  const pct = (x) => (x == null ? '–' : `${Math.round(x * 1000) / 10}%`);
  const monthLabel = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;
  const addMonth = (m, n) => {
    const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const nowMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const st = (status, label) => `<span class="st st-${esc(status === 'hold' ? 'hold' : status === 'paid' ? 'done' : status)}">${esc(label)}</span>`;

  async function api(path, { method = 'GET', body } = {}) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opt.headers['content-type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('/api/host' + path, opt);
    } catch {
      throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    }
    if (res.status === 401 && S.host) {
      S.host = null;
      showLogin('로그인이 만료됐습니다. 다시 로그인해 주세요.');
      throw new Error('로그인이 만료됐습니다.');
    }
    const j = await res.json().catch(() => ({ ok: false, error: '응답을 읽지 못했습니다.' }));
    if (!j.ok) throw new Error(j.error || '요청을 처리하지 못했습니다.');
    return j;
  }

  function toast(msg, bad = false) {
    const p = document.createElement('p');
    p.textContent = msg;
    if (bad) p.className = 'is-bad';
    toastBox.appendChild(p);
    setTimeout(() => p.remove(), bad ? 5000 : 2600);
  }

  const hashParts = () => {
    const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
    return { name: path.split('/')[0] || '', q: new URLSearchParams(qs) };
  };

  // ── 로그인·가입 ──
  function showLogin(message = '') {
    app.innerHTML = `<div class="auth"><form class="auth-box" id="auth" novalidate>
      <div class="brand">${MARK}<span>호스트센터</span></div>
      <h1>호스트센터 로그인</h1>
      <p>메자닌에 공간을 맡기신 파트너 전용 화면입니다. 내 건물의 예약 일정과 매출, 정산 내역을 확인할 수 있습니다.</p>
      ${message ? `<p class="note">${esc(message)}</p>` : ''}
      <p class="err" id="auth-err" hidden></p>
      <label class="f"><span>아이디</span><input type="text" name="login" maxlength="40" autocomplete="username" autocapitalize="none" required></label>
      <label class="f"><span>비밀번호</span><input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn btn-point" type="submit" style="width:100%;min-height:46px">로그인</button>
      <p class="muted small" style="margin-top:18px">계정이 없으시면 메자닌 담당자가 보내 드린 초대 링크로 처음 가입해 주세요. <a href="/host" style="border-bottom:1px solid currentColor">공간 파트너 안내</a></p>
    </form></div>`;
    const form = document.getElementById('auth');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('auth-err');
      err.hidden = true;
      try {
        await api('/login', { method: 'POST', body: { login: form.login.value, password: form.password.value } });
        await start();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  async function showJoin(code) {
    let inv;
    try {
      inv = await api(`/invite?code=${encodeURIComponent(code)}`);
    } catch (ex) {
      return showLogin(ex.message);
    }
    app.innerHTML = `<div class="auth"><form class="auth-box" id="join" novalidate>
      <div class="brand">${MARK}<span>호스트센터</span></div>
      <h1>호스트센터 가입</h1>
      <p>${esc(inv.name)}님${inv.company ? `(${esc(inv.company)})` : ''}, 반갑습니다. 앞으로 로그인할 아이디와 비밀번호를 정해 주세요.</p>
      ${inv.venues.length ? `<p class="note">연결된 공간: ${esc(inv.venues.join(', '))}</p>` : ''}
      <p class="err" id="join-err" hidden></p>
      <label class="f"><span>아이디 <small>영문 소문자·숫자</small></span><input type="text" name="login" maxlength="40" autocomplete="username" autocapitalize="none" value="${esc(inv.login)}" required></label>
      <label class="f"><span>비밀번호 <small>8자 이상</small></span><input type="password" name="password" autocomplete="new-password" required></label>
      <label class="f"><span>비밀번호 확인</span><input type="password" name="password2" autocomplete="new-password" required></label>
      <button class="btn btn-point" type="submit" style="width:100%;min-height:46px">가입하고 시작하기</button>
    </form></div>`;
    const form = document.getElementById('join');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('join-err');
      err.hidden = true;
      try {
        if (form.password.value !== form.password2.value) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        await api('/join', { method: 'POST', body: { code, login: form.login.value, password: form.password.value } });
        history.replaceState(null, '', '/host/center#/');
        await start();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // ── 화면 틀 ──
  const NAV = [['', '대시보드'], ['schedule', '예약 일정'], ['settlements', '정산 내역'], ['messages', '메시지'], ['account', '내 정보']];

  function shell() {
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <a class="brand" href="#/">${MARK}<span>호스트센터</span></a>
        <nav id="side-nav" aria-label="호스트센터 메뉴"></nav>
        <div class="side-foot"><b>${esc(S.host.name || S.host.login)}</b>${S.host.company ? `<span class="muted small" style="display:block">${esc(S.host.company)}</span>` : ''}
          <div class="row"><a href="/" target="_blank" rel="noopener">메자닌 사이트</a><button type="button" id="logout">로그아웃</button></div>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>`;
    document.getElementById('logout').addEventListener('click', async () => {
      await api('/logout', { method: 'POST' }).catch(() => {});
      S.host = null;
      showLogin();
    });
  }

  function drawNav() {
    const cur = hashParts().name;
    document.getElementById('side-nav').innerHTML = NAV.map(([k, l]) => `<a href="#/${k}" class="${cur === k ? 'is-on' : ''}"><span>${l}</span>${k === 'messages' && S.host.unread ? `<span class="badge">${S.host.unread}</span>` : ''}</a>`).join('');
  }

  const views = {};

  views[''] = async (main, q) => {
    const month = /^\d{4}-\d{2}$/.test(q.get('month') || '') ? q.get('month') : nowMonth();
    const d = await api(`/dashboard?month=${month}`);
    S.host.unread = d.unread;
    drawNav();
    const tot = d.venues.reduce((a, v) => ({ revenue: a.revenue + v.revenue, bookings: a.bookings + v.bookings, hold: a.hold + v.hold, used: a.used + v.used_days, days: a.days + v.days }), { revenue: 0, bookings: 0, hold: 0, used: 0, days: 0 });
    const lastSettle = d.settlements[0];
    main.innerHTML = `
      <div class="head"><div><h1>${esc(S.host.venues.map((v) => v.name).join(' · ') || '내 공간')}</h1><p>${esc(monthLabel(month))} 현황</p></div>
        <div class="head-actions"><a class="btn" href="#/?month=${addMonth(month, -1)}" aria-label="이전 달">← ${Number(addMonth(month, -1).slice(5))}월</a><a class="btn" href="#/?month=${addMonth(month, 1)}" aria-label="다음 달">${Number(addMonth(month, 1).slice(5))}월 →</a></div></div>
      ${S.host.venues.length ? '' : '<p class="note">아직 연결된 공간이 없습니다. 메자닌 담당자에게 문의해 주세요.</p>'}
      <div class="kpis">
        <div class="kpi"><span>대관 매출</span><strong>${won(tot.revenue)}<small style="font-size:1rem;font-weight:600">원</small></strong><em>확정·완료 예약, 행사 시작일 기준</em></div>
        <div class="kpi"><span>확정 예약</span><strong>${tot.bookings}<small style="font-size:1rem;font-weight:600">건</small></strong><em>협의 중(가예약) ${tot.hold}건</em></div>
        <div class="kpi"><span>가동률</span><strong>${pct(tot.days ? tot.used / tot.days : null)}</strong><em>행사로 쓰인 날 ${tot.used}일 / ${tot.days}일</em></div>
        <div class="kpi"><span>최근 정산</span><strong>${lastSettle ? won(lastSettle.payout) : '–'}${lastSettle ? '<small style="font-size:1rem;font-weight:600">원</small>' : ''}</strong><em>${lastSettle ? `${esc(monthLabel(lastSettle.month))} · ${esc(lastSettle.status_label)}` : '아직 정산 내역이 없습니다'}</em></div>
      </div>
      <div class="cols">
        <div>
          <section class="card"><h2>최근 12개월 대관 매출</h2><div id="ch-rev"></div></section>
          <section class="card"><h2>최근 12개월 행사로 쓰인 날</h2><div id="ch-days"></div></section>
          ${d.venues.length > 1 ? `<section class="card"><h2>공간별 ${esc(monthLabel(month))}</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>공간</th><th class="num">확정 예약</th><th class="num">대관 매출</th><th class="num">가동률</th></tr></thead><tbody>
            ${d.venues.map((v) => `<tr><td>${esc(v.name)}</td><td class="num">${v.bookings}</td><td class="num">${won(v.revenue)}원</td><td class="num">${pct(v.occupancy)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        </div>
        <div>
          <section class="card"><h2>다가오는 일정 <a class="btn-text small" href="#/schedule">전체 보기</a></h2>
            ${d.upcoming.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일정</th><th>내용</th><th>상태</th></tr></thead><tbody>
              ${d.upcoming.map((b) => `<tr><td>${esc(period(b.start_date, b.end_date))}${S.host.venues.length > 1 ? `<br><span class="muted small">${esc(venueName(b.venue))}</span>` : ''}</td><td>${esc(b.label)}${b.zones.length ? `<br><span class="muted small">${esc(b.zones.join(', '))}</span>` : ''}</td><td>${st(b.kind === 'block' ? 'done' : b.status, b.status_label)}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="empty">앞으로 잡힌 일정이 없습니다.</p>'}
          </section>
          <section class="card"><h2>메자닌 공지</h2>
            ${d.notices.length ? `<ul class="notice-list">${d.notices.map((n) => `<li><b>${esc(n.title)}</b><span class="muted small">${esc(n.date || '')}</span>${n.body ? `<p>${esc(n.body)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="empty">새 공지가 없습니다.</p>'}
          </section>
        </div>
      </div>`;
    const short = (m) => `${Number(m.slice(5))}월`;
    MZChart.bars(main.querySelector('#ch-rev'), d.trend.map((t) => ({ label: short(t.month), full: monthLabel(t.month), value: t.revenue, tip: `${won(t.revenue)}원 · 확정 ${t.bookings}건` })), { fmt: MZChart.won, name: '월별 대관 매출(원)', col: '월', highlightLast: true });
    MZChart.bars(main.querySelector('#ch-days'), d.trend.map((t) => ({ label: short(t.month), full: monthLabel(t.month), value: t.used_days, tip: `${t.used_days}일 · 가동률 ${pct(t.occupancy)}` })), { name: '행사로 쓰인 날(일)', unit: '일', col: '월', highlightLast: true });
  };

  const venueName = (slug) => S.host.venues.find((v) => v.slug === slug)?.name || slug;

  views.schedule = async (main, q) => {
    const month = /^\d{4}-\d{2}$/.test(q.get('month') || '') ? q.get('month') : nowMonth();
    const d = await api(`/calendar?month=${month}`);
    main.innerHTML = `
      <div class="head"><div><h1>예약 일정</h1><p>${esc(monthLabel(month))}. 고객 개인정보는 표시하지 않습니다.</p></div>
        <div class="head-actions"><a class="btn" href="#/schedule?month=${addMonth(month, -1)}">← 이전 달</a><a class="btn" href="#/schedule?month=${addMonth(month, 1)}">다음 달 →</a></div></div>
      <section class="card">${d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일정</th>${S.host.venues.length > 1 ? '<th>공간</th>' : ''}<th>내용</th><th>사용 공간</th><th>시간</th><th>상태</th><th class="num">대관료</th></tr></thead><tbody>
        ${d.items.map((b) => `<tr><td>${esc(period(b.start_date, b.end_date))}</td>${S.host.venues.length > 1 ? `<td>${esc(venueName(b.venue))}</td>` : ''}<td>${esc(b.label)}</td><td>${esc(b.zones.join(', ') || '–')}</td><td>${esc([b.start_time, b.end_time].filter(Boolean).join('~') || '–')}</td><td>${st(b.kind === 'block' ? 'done' : b.status, b.status_label)}</td><td class="num">${b.amount == null ? '–' : `${won(b.amount)}원`}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">이 달에는 잡힌 일정이 없습니다.</p>'}</section>
      <p class="muted small">대관료는 확정·완료된 예약만 표시합니다. 협의 중인 일정은 금액이 바뀔 수 있습니다.</p>`;
  };

  views.settlements = async (main) => {
    const d = await api('/settlements');
    main.innerHTML = `
      <div class="head"><div><h1>정산 내역</h1><p>메자닌이 확정한 정산만 표시합니다. 금액 문의는 메시지로 남겨 주세요.</p></div></div>
      <section class="card">${d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>정산 월</th><th>공간</th><th class="num">확정 예약</th><th class="num">대관 매출</th><th class="num">배분율</th><th class="num">배분 금액</th><th class="num">조정</th><th class="num">지급액</th><th>상태</th></tr></thead><tbody>
        ${d.items.map((s) => `<tr><td>${esc(monthLabel(s.month))}</td><td>${esc(s.venue_name)}</td><td class="num">${s.bookings}</td><td class="num">${won(s.gross)}</td><td class="num">${s.share_rate}%</td><td class="num">${won(s.host_amount)}</td><td class="num">${s.adjust ? won(s.adjust) : '–'}</td><td class="num"><b>${won(s.payout)}</b></td><td>${st(s.status, s.status_label)}${s.paid_at ? `<br><span class="muted small">${esc(s.paid_at)} 지급</span>` : ''}${s.memo ? `<br><span class="muted small">${esc(s.memo)}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">아직 확정된 정산이 없습니다. 매달 정산이 확정되면 여기에 표시됩니다.</p>'}</section>`;
  };

  views.messages = async (main) => {
    const d = await api('/messages');
    S.host.unread = 0;
    drawNav();
    main.innerHTML = `
      <div class="head"><div><h1>메시지</h1><p>메자닌 담당자와 주고받는 메시지입니다.</p></div></div>
      <section class="card">
        <div class="chat" id="chat">${d.items.length ? d.items.map((m) => `<div class="msg ${m.sender === 'host' ? 'msg-admin' : 'msg-customer'}"><p>${esc(m.body)}</p><span>${esc(m.sender === 'host' ? '나' : m.author || '메자닌')} · ${esc(dt(m.created_at))}</span></div>`).join('') : '<p class="empty">아직 주고받은 메시지가 없습니다.</p>'}</div>
        <form class="chat-form" id="chat-form"><textarea name="body" rows="3" maxlength="2000" placeholder="메자닌 담당자에게 보낼 내용을 적어 주세요." aria-label="메시지 내용"></textarea><button class="btn btn-point" type="submit">보내기</button></form>
      </section>`;
    const chat = main.querySelector('#chat');
    chat.scrollTop = chat.scrollHeight;
    main.querySelector('#chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = e.target.body.value.trim();
      if (!body) return;
      try {
        await api('/messages', { method: 'POST', body: { body } });
        toast('메시지를 보냈습니다');
        await route();
      } catch (ex) {
        toast(ex.message, true);
      }
    });
  };

  views.account = async (main) => {
    main.innerHTML = `
      <div class="head"><div><h1>내 정보</h1></div></div>
      <div class="cols">
        <section class="card"><h2>계정</h2><dl class="kv">
          <div><dt>이름</dt><dd>${esc(S.host.name)}</dd></div>
          <div><dt>회사</dt><dd>${esc(S.host.company || '–')}</dd></div>
          <div><dt>아이디</dt><dd>${esc(S.host.login)}</dd></div>
          <div><dt>연결된 공간</dt><dd>${esc(S.host.venues.map((v) => v.name).join(', ') || '–')}</dd></div>
          <div><dt>매출 배분율</dt><dd>${S.host.share_rate ? `${S.host.share_rate}%` : '계약 조건에 따름'}</dd></div>
        </dl><p class="muted small" style="margin-top:12px">정보 변경은 메시지로 요청해 주세요.</p></section>
        <section class="card"><h2>비밀번호 바꾸기</h2>
          <form id="pw" novalidate>
            <label class="f"><span>지금 비밀번호</span><input type="password" name="current" autocomplete="current-password" required></label>
            <label class="f"><span>새 비밀번호 <small>8자 이상</small></span><input type="password" name="next" autocomplete="new-password" required></label>
            <button class="btn btn-point" type="submit">비밀번호 바꾸기</button>
          </form></section>
      </div>`;
    main.querySelector('#pw').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/password', { method: 'POST', body: { current: e.target.current.value, next: e.target.next.value } });
        e.target.reset();
        toast('비밀번호를 바꿨습니다');
      } catch (ex) {
        toast(ex.message, true);
      }
    });
  };

  async function route() {
    if (!S.host) return;
    const { name, q } = hashParts();
    if (name === 'join') return showJoin(q.get('code') || '');
    const old = document.getElementById('main');
    if (!old) shell();
    const cur = document.getElementById('main');
    const main = cur.cloneNode(false);
    cur.replaceWith(main);
    drawNav();
    main.innerHTML = '<p class="boot">불러오는 중입니다.</p>';
    try {
      await (views[name] || views[''])(main, q);
    } catch (ex) {
      main.innerHTML = `<p class="err">${esc(ex.message)}</p>`;
    }
    window.scrollTo(0, 0);
  }

  async function start() {
    const { name, q } = hashParts();
    if (name === 'join') return showJoin(q.get('code') || '');
    const s = await api('/state');
    if (!s.host) return showLogin();
    S.host = s.host;
    shell();
    await route();
  }

  window.addEventListener('hashchange', () => {
    const { name, q } = hashParts();
    if (name === 'join') return showJoin(q.get('code') || '');
    route();
  });
  window.addEventListener('DOMContentLoaded', () => {
    start().catch((ex) => {
      app.innerHTML = `<div class="auth"><div class="auth-box"><h1>접속할 수 없습니다</h1><p>${esc(ex.message)}</p></div></div>`;
    });
  });
})();
