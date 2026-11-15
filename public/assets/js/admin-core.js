// 메자닌 관리자 — 공통 기능(로그인, 화면 틀, 대시보드)
window.MZ = (() => {
  'use strict';
  const S = { admin: null, content: null, enums: null, newCount: 0 };
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastBox = document.getElementById('toast');
  const views = {};
  const MARK = '<svg class="wm" viewBox="-4.5 -4.5 985 109" role="img" aria-label="MEZZANINE" xmlns="http://www.w3.org/2000/svg"><path d="M0,100V0L52,72L104,0V100M210,0H150V100H210M150,50H202M256,0H328L256,100H328M264,50H320M374,0H446L374,100H446M382,50H438M492,100L536,4L580,100M626,100V0L702,100V0M748,0V100M794,100V0L870,100V0M976,0H916V100H976M916,50H968" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter" stroke-miterlimit="2.6" stroke-linecap="butt"/></svg>';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => Number(n || 0).toLocaleString('ko-KR');
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const day = (iso) => (iso ? dt(iso).slice(0, 10) : '');
  const period = (a, b) => (a ? (b && b !== a ? `${a} ~ ${b}` : a) : '미정');
  const venue = (slug) => (S.content?.venues || []).find((v) => v.slug === slug);
  const venueName = (slug) => venue(slug)?.name?.replace('메자닌 ', '') || '미정';
  const venueColor = (slug) => venue(slug)?.color || '#7b818c';
  const venueDot = (slug) => `<i class="dotv" style="background:${esc(venueColor(slug))}"></i>${esc(venueName(slug))}`;
  const st = (key, label) => `<span class="st st-${esc(key)}">${esc(label)}</span>`;

  async function api(path, { method = 'GET', body, raw } = {}) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (raw) {
      opt.body = raw.body;
      opt.headers['content-type'] = raw.type;
    } else if (body !== undefined) {
      opt.headers['content-type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('/api/admin' + path, opt);
    } catch {
      throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    }
    if (res.status === 401 && S.admin) {
      S.admin = null;
      showAuth(false, '로그인이 만료됐습니다. 다시 로그인해 주세요.');
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

  // 모달 창. 닫기 함수와 본문 요소를 돌려줍니다.
  function modal({ title, body, foot = '', wide = false }) {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal-box${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="modal-x" aria-label="닫기">✕</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
    const close = () => {
      el.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    el.querySelector('.modal-x').addEventListener('click', close);
    el.addEventListener('mousedown', (e) => {
      if (e.target === el) close();
    });
    document.addEventListener('keydown', onKey);
    modalRoot.appendChild(el);
    const first = el.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
    return { el, close, $: (s) => el.querySelector(s), $$: (s) => Array.from(el.querySelectorAll(s)) };
  }

  // 브라우저 기본 확인창 대신 쓰는 확인 모달
  function confirmBox(text, okLabel = '확인', danger = false) {
    return new Promise((resolve) => {
      const m = modal({
        title: '확인',
        body: `<p>${esc(text)}</p>`,
        foot: `<button type="button" class="btn" data-no>취소</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-point'}" data-yes>${esc(okLabel)}</button>`,
      });
      m.$('[data-yes]').addEventListener('click', () => { m.close(); resolve(true); });
      m.$('[data-no]').addEventListener('click', () => { m.close(); resolve(false); });
      m.$('.modal-x').addEventListener('click', () => resolve(false));
      m.$('[data-yes]').focus();
    });
  }

  const formData = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => {
      if (o[k] === undefined) o[k] = v;
      else o[k] = [].concat(o[k], v);
    });
    return o;
  };

  // ── 로그인·첫 설정 ───────────────────────────────────────────
  function showAuth(setup, message = '') {
    app.innerHTML = `<div class="auth"><form class="auth-box" id="auth" novalidate>
      <div class="brand">${MARK}<span>관리자</span></div>
      <h1>${setup ? '관리자 계정 만들기' : '관리자 로그인'}</h1>
      <p>${setup ? '처음 접속하셨습니다. 이 사이트를 관리할 계정을 만들어 주세요. 여기서 정한 아이디와 비밀번호로 로그인하게 됩니다.' : '메자닌 서울 관리자 화면입니다.'}</p>
      ${message ? `<p class="note">${esc(message)}</p>` : ''}
      <p class="err" id="auth-err" hidden></p>
      ${setup ? '<label class="f"><span>이름</span><input type="text" name="name" maxlength="40" autocomplete="name" placeholder="예: 최시준"></label>' : ''}
      <label class="f"><span>아이디</span><input type="text" name="login" maxlength="40" autocomplete="username" autocapitalize="none" required></label>
      <label class="f"><span>비밀번호${setup ? ' <small>8자 이상</small>' : ''}</span><input type="password" name="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required></label>
      ${setup ? '<label class="f"><span>비밀번호 확인</span><input type="password" name="password2" autocomplete="new-password" required></label>' : ''}
      <button class="btn btn-point" type="submit" style="width:100%;min-height:46px">${setup ? '계정 만들고 시작하기' : '로그인'}</button>
    </form></div>`;
    const form = document.getElementById('auth');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('auth-err');
      err.hidden = true;
      const d = formData(form);
      try {
        if (setup && d.password !== d.password2) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        await api(setup ? '/setup' : '/login', { method: 'POST', body: d });
        await start();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // ── 화면 틀 ─────────────────────────────────────────────────
  const NAV = [
    ['', '대시보드'], ['inquiries', '문의 관리'], ['quotes', '견적 관리'], ['bookings', '예약·일정'], ['customers', '고객 관리'],
    [null, '사이트 콘텐츠'], ['venues', '지점 정보'], ['photos', '사진'], ['cases', '대관 사례'], ['faqs', 'FAQ·이용 안내'], ['rates', '요금표'],
    [null, '운영'], ['settings', '설정'],
  ];

  function shell() {
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <a class="brand" href="#/">${MARK}<span>관리자</span></a>
        <nav id="side-nav" aria-label="관리 메뉴"></nav>
        <div class="side-foot"><b>${esc(S.admin.name || S.admin.login)}</b>
          <div class="row"><a href="/" target="_blank" rel="noopener">사이트 보기</a><button type="button" id="logout">로그아웃</button></div>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>`;
    document.getElementById('logout').addEventListener('click', async () => {
      await api('/logout', { method: 'POST' }).catch(() => {});
      S.admin = null;
      showAuth(false);
    });
    drawNav();
  }

  function drawNav() {
    const cur = (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0] || '');
    const nav = document.getElementById('side-nav');
    if (!nav) return;
    nav.innerHTML = NAV.map(([key, label]) =>
      key === null ? `<h2>${label}</h2>`
        : `<a href="#/${key}" class="${cur === key ? 'is-on' : ''}"><span>${label}</span>${key === 'inquiries' && S.newCount ? `<span class="badge">${S.newCount}</span>` : ''}</a>`
    ).join('');
  }

  async function route() {
    if (!S.admin) return;
    modalRoot.innerHTML = '';
    const [pathStr, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const parts = pathStr.split('/').filter(Boolean);
    const name = parts[0] || 'dashboard';
    // 화면을 바꿀 때마다 본문 요소를 새로 만들어 이전 화면의 이벤트가 남지 않게 합니다
    const old = document.getElementById('main');
    const main = old.cloneNode(false);
    old.replaceWith(main);
    drawNav();
    const view = views[name] || views.dashboard;
    main.innerHTML = '<p class="boot">불러오는 중입니다.</p>';
    try {
      await view(main, parts.slice(1), new URLSearchParams(qs));
    } catch (ex) {
      main.innerHTML = `<p class="err">${esc(ex.message)}</p>`;
    }
    window.scrollTo(0, 0);
  }

  async function reloadContent() {
    const b = await api('/bootstrap');
    S.admin = b.admin;
    S.content = b.content;
    S.enums = b.enums;
  }

  async function start() {
    const stt = await api('/state');
    if (stt.setup_needed) return showAuth(true);
    if (!stt.admin) return showAuth(false);
    S.admin = stt.admin;
    await reloadContent();
    shell();
    await route();
  }

  // ── 대시보드 ─────────────────────────────────────────────────
  views.dashboard = async (main) => {
    const d = await api('/dashboard');
    const E = S.enums;
    S.newCount = d.byStatus.new || 0;
    drawNav();
    const open = ['new', 'consulting', 'quoted', 'contracting'].reduce((s, k) => s + (d.byStatus[k] || 0), 0);
    const maxV = Math.max(1, ...d.byVenue.map((x) => x.n));
    const pipe = ['new', 'consulting', 'quoted', 'contracting', 'confirmed', 'done'];
    const maxP = Math.max(1, ...pipe.map((k) => d.byStatus[k] || 0));
    main.innerHTML = `
      <div class="head"><div><h1>대시보드</h1><p>${dt(new Date().toISOString()).slice(0, 10)} 기준</p></div>
        <div class="head-actions"><a class="btn" href="#/bookings">예약·일정 보기</a><a class="btn btn-point" href="#/inquiries/new">문의 직접 등록</a></div></div>
      <div class="kpis">
        <a class="kpi${d.byStatus.new ? ' is-hot' : ''}" href="#/inquiries?status=new"><span>신규 문의</span><strong>${d.byStatus.new || 0}</strong><em>최근 7일 접수 ${d.week_new}건</em></a>
        <a class="kpi${d.unread ? ' is-hot' : ''}" href="#/inquiries"><span>읽지 않은 고객 메시지</span><strong>${d.unread}</strong><em>진행 중인 문의 ${open}건</em></a>
        <a class="kpi" href="#/quotes?status=sent"><span>견적 응답 대기</span><strong>${d.quotes_waiting}</strong><em>고객이 아직 답하지 않은 견적</em></a>
        <a class="kpi" href="#/bookings"><span>이번 달 확정 예약</span><strong>${d.month.n}<small style="font-size:1rem;font-weight:600">건</small></strong><em>${won(d.month.amount)}원${d.hold_amount ? ` · 가예약 ${won(d.hold_amount)}원` : ''}</em></a>
      </div>
      <div class="cols">
        <div>
          <section class="card"><h2>최근 문의 <a class="btn-text small" href="#/inquiries">전체 보기</a></h2>
            ${d.recent.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>접수</th><th>지점</th><th>문의자</th><th>희망일</th><th>상태</th></tr></thead><tbody>
              ${d.recent.map((r) => `<tr data-href="#/inquiries/${r.id}"><td>${day(r.created_at).slice(5)}</td><td>${venueDot(r.venue)}</td><td><b>${esc(r.name)}</b>${r.company ? ` <span class="muted">${esc(r.company)}</span>` : ''}${r.unread_admin ? `<span class="unread">${r.unread_admin}</span>` : ''}</td><td>${r.kind === 'open_notify' ? '<span class="muted">오픈 알림</span>' : esc(period(r.date_start, r.date_end))}</td><td>${st(r.status, E.INQUIRY_STATUS[r.status])}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="empty">아직 접수된 문의가 없습니다. 홈페이지 문의 양식으로 들어온 문의가 여기에 쌓입니다.</p>'}
          </section>
          <section class="card"><h2>진행 단계별 문의</h2>
            <div class="bars">${pipe.map((k) => `<div><span>${E.INQUIRY_STATUS[k]}</span><i style="width:${((d.byStatus[k] || 0) / maxP) * 100}%"></i><span>${d.byStatus[k] || 0}</span></div>`).join('')}</div>
          </section>
        </div>
        <div>
          <section class="card"><h2>다가오는 일정 <a class="btn-text small" href="#/bookings">달력 보기</a></h2>
            ${d.upcoming.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일정</th><th>지점</th><th>내용</th><th>상태</th></tr></thead><tbody>
              ${d.upcoming.map((b) => `<tr data-href="#/bookings/${b.id}"><td>${esc(period(b.start_date, b.end_date))}</td><td>${venueDot(b.venue)}</td><td><b>${esc(b.title)}</b></td><td>${b.kind === 'block' ? st('done', '예약 불가') : st(b.status === 'hold' ? 'hold' : b.status, E.BOOKING_STATUS[b.status])}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="empty">예정된 일정이 없습니다. 예약·일정에서 등록할 수 있습니다.</p>'}
          </section>
          <section class="card"><h2>지점별 문의</h2>
            ${d.byVenue.length ? `<div class="bars">${d.byVenue.map((x) => `<div><span>${esc(venueName(x.venue))}</span><i style="width:${(x.n / maxV) * 100}%;background:${esc(venueColor(x.venue))}"></i><span>${x.n}</span></div>`).join('')}</div>` : '<p class="muted">문의가 쌓이면 지점별 분포가 표시됩니다.</p>'}
          </section>
        </div>
      </div>`;
  };

  // 표의 행을 누르면 해당 화면으로 이동
  document.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a, button, input, select')) location.hash = tr.dataset.href;
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    start().catch((ex) => {
      app.innerHTML = `<div class="auth"><div class="auth-box"><h1>접속할 수 없습니다</h1><p>${esc(ex.message)}</p></div></div>`;
    });
  });

  return { S, api, esc, won, pad, ymd, dt, day, period, venue, venueName, venueColor, venueDot, st, toast, modal, confirmBox, formData, views, route, reloadContent, drawNav };
})();
