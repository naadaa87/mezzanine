// 메자닌 관리자 — 문의·견적·예약·고객
(() => {
  'use strict';
  const { S, api, esc, won, pad, ymd, dt, day, period, venue, venueName, venueColor, venueDot, st, toast, modal, confirmBox, formData, views } = window.MZ;
  const E = () => S.enums;
  const venueOptions = (sel, withEmpty = '지점 미정') =>
    `${withEmpty ? `<option value="">${withEmpty}</option>` : ''}${S.content.venues.map((v) => `<option value="${esc(v.slug)}"${v.slug === sel ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}`;
  const options = (list, sel, empty) => `${empty !== undefined ? `<option value="">${empty}</option>` : ''}${list.map((o) => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('')}`;
  const zoneChecks = (slug, selected = []) => {
    const zs = venue(slug)?.zone_options || [];
    return zs.length ? zs.map((z) => `<label class="ck"><input type="checkbox" name="zones" value="${esc(z)}"${selected.includes(z) ? ' checked' : ''}>${esc(z)}</label>`).join('') : '<span class="muted small">이 지점은 공간 선택 항목이 없습니다.</span>';
  };
  const arr = (v) => (v === undefined ? [] : [].concat(v));

  // ── 문의 목록 ────────────────────────────────────────────────
  views.inquiries = async (main, parts, q) => {
    if (parts[0] === 'new') return newInquiry(main);
    if (parts[0]) return inquiryDetail(main, Number(parts[0]));
    const state = { status: q.get('status') || '', venue: q.get('venue') || '', q: '', kind: '' };
    main.innerHTML = `
      <div class="head"><div><h1>문의 관리</h1><p>홈페이지로 들어온 대관 문의와 직접 등록한 문의를 한곳에서 관리합니다.</p></div>
        <div class="head-actions"><a class="btn" href="/api/admin/export?type=inquiries">엑셀(CSV) 내려받기</a><a class="btn btn-point" href="#/inquiries/new">문의 직접 등록</a></div></div>
      <div class="seg" id="seg"></div>
      <div class="bar">
        <select id="f-venue" aria-label="지점">${venueOptions(state.venue, '모든 지점')}</select>
        <select id="f-kind" aria-label="구분"><option value="">대관·오픈 알림 전체</option><option value="rental">대관 문의</option><option value="open_notify">오픈 알림 신청</option></select>
        <input type="search" id="f-q" placeholder="접수번호, 이름, 회사, 연락처 검색" aria-label="검색">
      </div>
      <div id="list"></div>`;
    const seg = main.querySelector('#seg');
    const list = main.querySelector('#list');
    const load = async () => {
      const p = new URLSearchParams();
      Object.entries(state).forEach(([k, v]) => v && p.set(k, v));
      p.set('limit', '100');
      const d = await api('/inquiries?' + p);
      seg.innerHTML = [['', '전체'], ...Object.entries(E().INQUIRY_STATUS)].map(([k, label]) => `<button type="button" data-s="${k}" class="${state.status === k ? 'is-on' : ''}">${label}</button>`).join('');
      list.innerHTML = d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>접수번호</th><th>접수일</th><th>지점</th><th>행사</th><th>희망일</th><th>문의자</th><th>상태</th></tr></thead><tbody>
        ${d.items.map((r) => `<tr data-href="#/inquiries/${r.id}">
          <td><b>${esc(r.code)}</b>${r.unread_admin ? `<span class="unread">${r.unread_admin}</span>` : ''}</td><td>${day(r.created_at)}</td><td>${venueDot(r.venue)}</td>
          <td>${r.kind === 'open_notify' ? '<span class="muted">오픈 알림 신청</span>' : `${esc(r.event_type || '')}${r.event_name ? ` <span class="muted">${esc(r.event_name)}</span>` : ''}${r.headcount ? ` <span class="muted">${r.headcount}명</span>` : ''}`}</td>
          <td>${r.kind === 'open_notify' ? '' : esc(period(r.date_start, r.date_end))}</td>
          <td><b>${esc(r.name)}</b>${r.company ? ` <span class="muted">${esc(r.company)}</span>` : ''}</td><td>${st(r.status, E().INQUIRY_STATUS[r.status])}</td></tr>`).join('')}
        </tbody></table></div><p class="muted small" style="margin-top:8px">${d.total}건${d.total > d.items.length ? ` 중 최근 ${d.items.length}건 표시` : ''}</p>`
        : '<div class="tbl-wrap"><p class="empty">조건에 맞는 문의가 없습니다.</p></div>';
    };
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.status = b.dataset.s;
      load();
    });
    main.querySelector('#f-venue').addEventListener('change', (e) => { state.venue = e.target.value; load(); });
    main.querySelector('#f-kind').addEventListener('change', (e) => { state.kind = e.target.value; load(); });
    let t;
    main.querySelector('#f-q').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 300);
    });
    await load();
  };

  // ── 문의 직접 등록(전화·카카오톡으로 받은 문의) ────────────────
  function newInquiry(main) {
    main.innerHTML = `<a class="back" href="#/inquiries">← 문의 목록</a>
      <div class="head"><div><h1>문의 직접 등록</h1><p>전화나 카카오톡, 인스타그램으로 받은 문의를 기록해 두면 견적과 예약까지 같은 흐름으로 관리할 수 있습니다.</p></div></div>
      <form class="card" id="nf" novalidate>
        <p class="err" id="nf-err" hidden></p>
        <div class="g3">
          <label class="f"><span>지점</span><select name="venue" id="nf-venue">${venueOptions('')}</select></label>
          <label class="f"><span>들어온 경로</span><select name="source">${options(['전화', '카카오톡', '인스타그램', '블로그', '소개', '기타'], '전화')}</select></label>
          <label class="f"><span>행사 유형</span><select name="event_type">${options(E().EVENT_TYPES, '', '선택')}</select></label>
        </div>
        <div class="f"><span class="f-label">사용할 공간</span><div id="nf-zones"></div></div>
        <div class="g4">
          <label class="f"><span>시작일</span><input type="date" name="date_start"></label>
          <label class="f"><span>종료일</span><input type="date" name="date_end"></label>
          <label class="f"><span>예상 인원</span><input type="number" name="headcount" min="0"></label>
          <label class="f"><span>행사명·브랜드</span><input type="text" name="event_name" maxlength="80"></label>
        </div>
        <div class="g4">
          <label class="f"><span>담당자 이름</span><input type="text" name="name" maxlength="40" required></label>
          <label class="f"><span>회사·단체</span><input type="text" name="company" maxlength="80"></label>
          <label class="f"><span>연락처</span><input type="tel" name="phone" maxlength="30" required></label>
          <label class="f"><span>이메일</span><input type="email" name="email" maxlength="120"></label>
        </div>
        <label class="f"><span>문의 내용</span><textarea name="message" rows="4" maxlength="3000"></textarea></label>
        <button class="btn btn-point" type="submit">문의 등록</button>
      </form>`;
    const zones = main.querySelector('#nf-zones');
    const sync = () => { zones.innerHTML = zoneChecks(main.querySelector('#nf-venue').value); };
    main.querySelector('#nf-venue').addEventListener('change', sync);
    sync();
    main.querySelector('#nf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = main.querySelector('#nf-err');
      err.hidden = true;
      const d = formData(e.target);
      d.zones = arr(d.zones);
      try {
        const r = await api('/inquiries', { method: 'POST', body: d });
        toast(`문의를 등록했습니다 (${r.code})`);
        location.hash = `#/inquiries/${r.id}`;
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // ── 문의 상세 ────────────────────────────────────────────────
  async function inquiryDetail(main, id) {
    const d = await api(`/inquiries/${id}`);
    const i = d.inquiry;
    const notify = i.kind === 'open_notify';
    const link = location.origin + d.link;
    const reload = () => inquiryDetail(main, id);
    main.innerHTML = `<a class="back" href="#/inquiries">← 문의 목록</a>
      <div class="head"><div><h1>${esc(i.code)} <span class="muted" style="font-weight:600;font-size:1rem">${notify ? '오픈 알림 신청' : '대관 문의'}</span></h1><p>${dt(i.created_at)} 접수 · ${esc(i.source === 'web' ? '홈페이지' : i.source)}</p></div>
        <div class="head-actions">
          <select id="d-status" aria-label="진행 상태" style="width:auto">${Object.entries(E().INQUIRY_STATUS).map(([k, v]) => `<option value="${k}"${i.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <button class="btn" type="button" id="d-link">고객용 조회 주소 복사</button>
          <button class="btn btn-danger" type="button" id="d-del">삭제</button>
        </div></div>
      <div class="cols cols-wide">
        <div>
          <section class="card"><h2>문의 내용 <button type="button" class="btn-text small" id="d-edit">수정</button></h2>
            <dl class="dl">
              <div><dt>지점·공간</dt><dd>${esc(venue(i.venue)?.name || '미정')}${i.zones.length ? `\n${i.zones.map(esc).join(', ')}` : ''}</dd></div>
              ${notify ? '' : `<div><dt>희망 일정</dt><dd>${esc(period(i.date_start, i.date_end))}${i.time_start ? ` ${esc(i.time_start)}${i.time_end ? `~${esc(i.time_end)}` : ''}` : ''}${i.date_flexible ? ' (조정 가능)' : ''}</dd></div>
              <div><dt>행사</dt><dd>${esc(i.event_type || '미정')}${i.event_name ? ` · ${esc(i.event_name)}` : ''}${i.headcount ? ` · ${i.headcount}명` : ''}</dd></div>
              <div><dt>예산</dt><dd>${esc(i.budget || '미정')}</dd></div>
              ${i.options.length ? `<div><dt>요청 사항</dt><dd>${i.options.map(esc).join(', ')}</dd></div>` : ''}`}
              <div><dt>문의 내용</dt><dd style="font-weight:400">${esc(i.message || '없음')}</dd></div>
            </dl>
          </section>
          <section class="card"><h2>문의자 ${d.customer ? `<a class="btn-text small" href="#/customers/${d.customer.id}">고객 정보 보기</a>` : ''}</h2>
            <dl class="dl">
              <div><dt>이름</dt><dd>${esc(i.name)}${i.company ? ` (${esc(i.company)})` : ''}</dd></div>
              <div><dt>연락처</dt><dd><a href="tel:${esc(i.phone)}">${esc(i.phone)}</a></dd></div>
              ${i.email ? `<div><dt>이메일</dt><dd><a href="mailto:${esc(i.email)}">${esc(i.email)}</a></dd></div>` : ''}
              ${i.contact_pref ? `<div><dt>선호 연락</dt><dd>${esc(i.contact_pref)}</dd></div>` : ''}
            </dl>
          </section>
          <section class="card"><h2>내부 메모 <small>고객에게 보이지 않습니다</small></h2>
            <div class="g2"><label class="f"><span>담당자</span><input type="text" id="d-assignee" value="${esc(i.assignee)}" maxlength="40"></label><span></span></div>
            <textarea id="d-memo" rows="4" maxlength="4000" placeholder="통화 내용, 협의 사항, 다음에 할 일">${esc(i.internal_memo)}</textarea>
            <p style="margin-top:10px"><button class="btn" type="button" id="d-memo-save">메모 저장</button></p>
          </section>
          <section class="card"><h2>활동 기록</h2>
            ${d.activity.length ? `<ul class="log">${d.activity.map((a) => `<li><span><b>${esc(a.action)}</b>${a.detail ? ` ${esc(a.detail)}` : ''} <span class="muted">${esc(a.actor)}</span></span><span>${dt(a.created_at)}</span></li>`).join('')}</ul>` : '<p class="muted">기록이 없습니다.</p>'}
          </section>
        </div>
        <div>
          <section class="card"><h2>고객과 메시지 <small>고객은 조회 화면에서 확인합니다</small></h2>
            <div class="chat" id="d-chat">${d.messages.length ? d.messages.map((m) => `<p class="msg msg-${esc(m.sender)}">${esc(m.body)}<small>${m.sender === 'customer' ? esc(m.author || '고객') + ' · ' : m.sender === 'admin' ? esc(m.author || '') + ' · ' : ''}${dt(m.created_at)}</small></p>`).join('') : '<p class="muted">아직 주고받은 메시지가 없습니다.</p>'}</div>
            <form class="chat-form" id="d-msg"><textarea rows="2" maxlength="3000" placeholder="고객에게 보낼 메시지" aria-label="메시지" required></textarea><button class="btn btn-point" type="submit">보내기</button></form>
            <p class="muted small" style="margin-top:8px">메시지를 보내도 고객에게 문자나 메일이 자동으로 가지는 않습니다. 조회 주소를 복사해 카카오톡이나 문자로 알려 주세요.</p>
          </section>
          ${notify ? '' : `<section class="card"><h2>견적 <button class="btn btn-sm btn-point" type="button" id="d-quote-new">견적 작성</button></h2>
            ${d.quotes.length ? d.quotes.map((q) => `<div class="qrow" data-q="${q.id}"><div><b>${won(q.total)}원</b> ${st(q.status, E().QUOTE_STATUS[q.status])}<br><span class="muted small">${esc(q.number)} · ${esc(q.title)}${q.valid_until ? ` · ${esc(q.valid_until)}까지` : ''}</span></div>
              <div class="qrow-act">${q.status !== 'accepted' ? '<button class="btn btn-sm" type="button" data-qa="edit">수정</button>' : ''}${q.status === 'draft' ? '<button class="btn btn-sm btn-point" type="button" data-qa="send">고객에게 보내기</button>' : ''}${q.status === 'accepted' ? '<button class="btn btn-sm btn-point" type="button" data-qa="book">이 견적으로 예약 등록</button>' : ''}<button class="btn btn-sm btn-danger" type="button" data-qa="del">삭제</button></div></div>`).join('') : '<p class="muted">작성한 견적이 없습니다. 견적을 작성해 보내면 고객이 조회 화면에서 확인하고 수락할 수 있습니다.</p>'}
          </section>
          <section class="card"><h2>예약 <button class="btn btn-sm" type="button" id="d-book-new">예약 등록</button></h2>
            ${d.bookings.length ? d.bookings.map((b) => `<div class="qrow"><div><b>${esc(period(b.start_date, b.end_date))}</b> ${st(b.status === 'hold' ? 'hold' : b.status, E().BOOKING_STATUS[b.status])}<br><span class="muted small">${esc(venue(b.venue)?.name || '')}${b.zones.length ? ` · ${b.zones.map(esc).join(', ')}` : ''}${b.amount ? ` · ${won(b.amount)}원` : ''}</span></div>
              <div class="qrow-act"><button class="btn btn-sm" type="button" data-b="${b.id}">수정</button></div></div>`).join('') : '<p class="muted">등록한 예약이 없습니다. 일정이 정해지면 가예약으로 먼저 잡아 두세요.</p>'}
          </section>`}
        </div>
      </div>`;
    const chat = main.querySelector('#d-chat');
    chat.scrollTop = chat.scrollHeight;

    main.querySelector('#d-status').addEventListener('change', async (e) => {
      try { await api(`/inquiries/${id}`, { method: 'PATCH', body: { status: e.target.value } }); toast('상태를 바꿨습니다'); reload(); } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#d-link').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('조회 주소를 복사했습니다'); }
      catch { modal({ title: '고객용 조회 주소', body: `<input type="text" value="${esc(link)}" readonly onclick="this.select()">` }); }
    });
    main.querySelector('#d-del').addEventListener('click', async () => {
      if (!(await confirmBox(`${i.code} 문의를 삭제합니다. 메시지와 견적도 함께 지워지며 되돌릴 수 없습니다.`, '삭제', true))) return;
      try { await api(`/inquiries/${id}`, { method: 'DELETE' }); toast('삭제했습니다'); location.hash = '#/inquiries'; } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#d-memo-save').addEventListener('click', async () => {
      try { await api(`/inquiries/${id}`, { method: 'PATCH', body: { internal_memo: main.querySelector('#d-memo').value, assignee: main.querySelector('#d-assignee').value } }); toast('메모를 저장했습니다'); } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#d-msg').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = e.target.querySelector('textarea');
      if (!ta.value.trim()) return;
      try { await api(`/inquiries/${id}/messages`, { method: 'POST', body: { body: ta.value } }); reload(); } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#d-edit').addEventListener('click', () => editInquiry(i, reload));
    if (notify) return;

    main.querySelector('#d-quote-new').addEventListener('click', () => quoteEditor(i, null, reload));
    main.querySelectorAll('[data-qa]').forEach((btn) => btn.addEventListener('click', async () => {
      const q = d.quotes.find((x) => x.id === Number(btn.closest('[data-q]').dataset.q));
      const act = btn.dataset.qa;
      try {
        if (act === 'edit') return quoteEditor(i, q, reload);
        if (act === 'book') return bookingEditor({ inquiry_id: i.id, quote_id: q.id, venue: i.venue, zones: i.zones, title: i.event_name || `${i.name} ${i.event_type || '대관'}`, start_date: i.date_start, end_date: i.date_end, start_time: i.time_start, end_time: i.time_end, status: 'confirmed', amount: q.total }, reload);
        if (act === 'send') {
          if (!(await confirmBox(`${won(q.total)}원 견적(${q.number})을 고객 조회 화면에 공개합니다.`, '고객에게 보내기'))) return;
          await api(`/quotes/${q.id}`, { method: 'PATCH', body: { status: 'sent' } });
          toast('견적을 보냈습니다. 조회 주소를 고객에게 알려 주세요.');
        }
        if (act === 'del') {
          if (!(await confirmBox(`이 견적(${q.number})을 삭제합니다.`, '삭제', true))) return;
          await api(`/quotes/${q.id}`, { method: 'DELETE' });
          toast('삭제했습니다');
        }
        reload();
      } catch (ex) { toast(ex.message, true); }
    }));
    main.querySelector('#d-book-new').addEventListener('click', () =>
      bookingEditor({ inquiry_id: i.id, venue: i.venue, zones: i.zones, title: i.event_name || `${i.name} ${i.event_type || '대관'}`, start_date: i.date_start, end_date: i.date_end, start_time: i.time_start, end_time: i.time_end, status: 'hold' }, reload));
    main.querySelectorAll('[data-b]').forEach((btn) => btn.addEventListener('click', () => bookingEditor(d.bookings.find((b) => b.id === Number(btn.dataset.b)), reload)));
  }

  function editInquiry(i, done) {
    const m = modal({
      title: '문의 내용 수정',
      body: `<form id="ef"><p class="err" hidden></p>
        <div class="g2"><label class="f"><span>지점</span><select name="venue">${venueOptions(i.venue)}</select></label>
          <label class="f"><span>행사 유형</span><select name="event_type">${options(E().EVENT_TYPES.includes(i.event_type) || !i.event_type ? E().EVENT_TYPES : [i.event_type, ...E().EVENT_TYPES], i.event_type, '선택')}</select></label></div>
        <div class="f"><span class="f-label">사용할 공간</span><div data-zones></div></div>
        <div class="g4"><label class="f"><span>시작일</span><input type="date" name="date_start" value="${esc(i.date_start)}"></label><label class="f"><span>종료일</span><input type="date" name="date_end" value="${esc(i.date_end)}"></label>
          <label class="f"><span>시작 시간</span><input type="time" name="time_start" value="${esc(i.time_start)}"></label><label class="f"><span>종료 시간</span><input type="time" name="time_end" value="${esc(i.time_end)}"></label></div>
        <div class="g2"><label class="f"><span>행사명·브랜드</span><input type="text" name="event_name" value="${esc(i.event_name)}" maxlength="80"></label><label class="f"><span>예상 인원</span><input type="number" name="headcount" value="${esc(i.headcount || '')}" min="0"></label></div>
      </form>`,
      foot: '<button type="button" class="btn" data-cancel>취소</button><button type="button" class="btn btn-point" data-save>저장</button>',
    });
    const sel = m.$('select[name=venue]');
    const sync = (keep) => { m.$('[data-zones]').innerHTML = zoneChecks(sel.value, keep ? i.zones : []); };
    sel.addEventListener('change', () => sync(false));
    sync(true);
    m.$('[data-cancel]').addEventListener('click', m.close);
    m.$('[data-save]').addEventListener('click', async () => {
      const d = formData(m.$('#ef'));
      d.zones = arr(d.zones);
      try { await api(`/inquiries/${i.id}`, { method: 'PATCH', body: d }); m.close(); toast('저장했습니다'); done(); }
      catch (ex) { const e = m.$('.err'); e.textContent = ex.message; e.hidden = false; }
    });
  }

  // ── 견적 작성·수정 ───────────────────────────────────────────
  function quoteEditor(inq, q, done) {
    const rates = (S.content.rates || []).filter((r) => !r.venue || r.venue === inq.venue);
    const items = q ? q.items.slice() : [{ name: `${venue(inq.venue)?.name || '메자닌'} 대관료`, desc: [inq.zones.join(', '), period(inq.date_start, inq.date_end)].filter(Boolean).join(' / '), qty: 1, unit: '식', price: 0 }];
    const valid = q?.valid_until || ymd(new Date(Date.now() + 7 * 86400000));
    const m = modal({
      wide: true,
      title: q ? `견적 수정 (${q.number})` : '견적 작성',
      body: `<p class="err" hidden></p>
        <div class="g2"><label class="f"><span>견적서 제목</span><input type="text" id="q-title" value="${esc(q?.title || '대관 견적서')}" maxlength="100"></label>
          <label class="f"><span>유효기간</span><input type="date" id="q-valid" value="${esc(valid)}"></label></div>
        <table class="items"><thead><tr><th>항목</th><th>설명</th><th class="c-qty">수량</th><th class="c-unit">단위</th><th class="c-price">단가(원)</th><th class="c-amt num">금액</th><th class="c-x"></th></tr></thead><tbody id="q-items"></tbody></table>
        <div class="bar"><button type="button" class="btn btn-sm" id="q-add">항목 추가</button>
          ${rates.length ? `<select id="q-rate" style="width:auto" aria-label="요금표에서 추가"><option value="">요금표에서 추가</option>${rates.map((r, n) => `<option value="${n}">${esc(r.name)} (${won(r.price)}원/${esc(r.unit || '식')})</option>`).join('')}</select>` : '<span class="muted small">자주 쓰는 항목은 요금표에 등록해 두면 여기서 바로 불러올 수 있습니다.</span>'}</div>
        <div class="g2" style="margin-top:14px">
          <div><label class="f"><span>부가세</span><select id="q-vat"><option value="add">별도 (10% 추가)</option><option value="incl">포함</option><option value="none">없음</option></select></label>
            <label class="f"><span>할인 금액(원)</span><input type="text" id="q-discount" inputmode="numeric" value="${q?.discount || 0}"></label>
            <label class="f"><span>안내 사항</span><textarea id="q-note" rows="4" maxlength="2000" placeholder="포함·불포함 내역, 계약금 비율, 입금 계좌 등">${esc(q?.note || '')}</textarea></label></div>
          <div class="sum" id="q-sum"></div>
        </div>`,
      foot: `<button type="button" class="btn left" data-cancel>취소</button><button type="button" class="btn" data-save="draft">작성 중으로 저장</button><button type="button" class="btn btn-point" data-save="sent">저장하고 고객에게 보내기</button>`,
    });
    m.$('#q-vat').value = q?.vat_mode || 'add';
    const tbody = m.$('#q-items');
    const num = (s) => parseInt(String(s).replace(/[^\d-]/g, ''), 10) || 0;
    const read = () => m.$$('#q-items tr').map((tr) => ({
      name: tr.querySelector('[data-k=name]').value.trim(), desc: tr.querySelector('[data-k=desc]').value.trim(),
      qty: parseFloat(tr.querySelector('[data-k=qty]').value) || 0, unit: tr.querySelector('[data-k=unit]').value.trim(), price: num(tr.querySelector('[data-k=price]').value),
    }));
    const sum = () => {
      const its = read();
      m.$$('#q-items tr').forEach((tr, n) => { tr.querySelector('.c-amt').textContent = won(Math.round(its[n].qty * its[n].price)); });
      const subtotal = Math.round(its.reduce((s, it) => s + it.qty * it.price, 0));
      const discount = Math.min(Math.max(0, num(m.$('#q-discount').value)), subtotal);
      const base = subtotal - discount;
      const mode = m.$('#q-vat').value;
      const vat = mode === 'add' ? Math.round(base * 0.1) : mode === 'incl' ? Math.round(base / 11) : 0;
      const total = mode === 'add' ? base + vat : base;
      m.$('#q-sum').innerHTML = `<div><span>공급가액</span><span>${won(subtotal)}원</span></div>${discount ? `<div><span>할인</span><span>− ${won(discount)}원</span></div>` : ''}
        ${mode !== 'none' ? `<div><span>부가세${mode === 'incl' ? ' (포함분)' : ''}</span><span>${won(vat)}원</span></div>` : ''}<div class="total"><span>합계</span><span>${won(total)}원</span></div>`;
    };
    const addRow = (it = { name: '', desc: '', qty: 1, unit: '식', price: 0 }) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input type="text" data-k="name" value="${esc(it.name)}" maxlength="80" aria-label="항목"></td><td><input type="text" data-k="desc" value="${esc(it.desc || '')}" maxlength="200" aria-label="설명"></td>
        <td class="c-qty"><input type="number" data-k="qty" value="${esc(it.qty)}" min="0" step="0.5" aria-label="수량"></td><td class="c-unit"><input type="text" data-k="unit" value="${esc(it.unit || '')}" maxlength="10" aria-label="단위"></td>
        <td class="c-price"><input type="text" data-k="price" value="${esc(it.price)}" inputmode="numeric" aria-label="단가"></td><td class="c-amt num"></td><td class="c-x"><button type="button" class="btn btn-sm btn-danger" aria-label="항목 삭제">✕</button></td>`;
      tr.querySelector('button').addEventListener('click', () => { tr.remove(); sum(); });
      tbody.appendChild(tr);
    };
    items.forEach(addRow);
    sum();
    m.el.addEventListener('input', sum);
    m.$('#q-add').addEventListener('click', () => { addRow(); sum(); });
    const rateSel = m.$('#q-rate');
    if (rateSel) rateSel.addEventListener('change', () => {
      const r = rates[Number(rateSel.value)];
      if (r) addRow({ name: r.name, desc: r.desc || '', qty: 1, unit: r.unit || '식', price: r.price });
      rateSel.value = '';
      sum();
    });
    m.$('[data-cancel]').addEventListener('click', m.close);
    m.$$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const its = read().filter((it) => it.name);
      const err = m.$('.err');
      err.hidden = true;
      if (!its.length) { err.textContent = '견적 항목을 하나 이상 입력해 주세요.'; err.hidden = false; return; }
      const body = { title: m.$('#q-title').value, valid_until: m.$('#q-valid').value, items: its, discount: num(m.$('#q-discount').value), vat_mode: m.$('#q-vat').value, note: m.$('#q-note').value };
      try {
        let qid = q?.id;
        if (q) await api(`/quotes/${q.id}`, { method: 'PATCH', body });
        else qid = (await api(`/inquiries/${inq.id}/quotes`, { method: 'POST', body })).id;
        if (b.dataset.save === 'sent' && (!q || q.status !== 'sent')) await api(`/quotes/${qid}`, { method: 'PATCH', body: { status: 'sent' } });
        m.close();
        toast(b.dataset.save === 'sent' ? '견적을 보냈습니다. 조회 주소를 고객에게 알려 주세요.' : '견적을 저장했습니다');
        done();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    }));
  }

  // ── 견적 목록 ────────────────────────────────────────────────
  views.quotes = async (main, parts, q) => {
    const state = { status: q.get('status') || '' };
    main.innerHTML = `<div class="head"><div><h1>견적 관리</h1><p>문의마다 작성한 견적과 고객 응답을 모아 봅니다. 견적 작성은 문의 상세 화면에서 합니다.</p></div></div>
      <div class="seg" id="seg"></div><div id="list"></div>`;
    const load = async () => {
      const d = await api('/quotes' + (state.status ? `?status=${state.status}` : ''));
      main.querySelector('#seg').innerHTML = [['', '전체'], ...Object.entries(E().QUOTE_STATUS)].map(([k, l]) => `<button type="button" data-s="${k}" class="${state.status === k ? 'is-on' : ''}">${l}</button>`).join('');
      main.querySelector('#list').innerHTML = d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>견적번호</th><th>문의</th><th>지점</th><th>고객</th><th class="num">합계</th><th>유효기간</th><th>상태</th></tr></thead><tbody>
        ${d.items.map((r) => `<tr data-href="#/inquiries/${r.inquiry_id}"><td><b>${esc(r.number)}</b></td><td>${esc(r.code)}</td><td>${venueDot(r.venue)}</td><td>${esc(r.name)}${r.company ? ` <span class="muted">${esc(r.company)}</span>` : ''}</td><td class="num"><b>${won(r.total)}원</b></td><td>${esc(r.valid_until || '')}</td><td>${st(r.status, E().QUOTE_STATUS[r.status])}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="tbl-wrap"><p class="empty">견적이 없습니다. 문의 상세 화면에서 "견적 작성"을 눌러 만들 수 있습니다.</p></div>';
    };
    main.querySelector('#seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.status = b.dataset.s; load(); } });
    await load();
  };

  // ── 예약·일정 ────────────────────────────────────────────────
  function bookingEditor(b, done) {
    const isNew = !b.id;
    const m = modal({
      title: isNew ? (b.kind === 'block' ? '예약 불가 일정 등록' : '예약 등록') : '예약 수정',
      body: `<form id="bf"><p class="err" hidden></p><p class="note" hidden></p>
        <div class="g3"><label class="f"><span>구분</span><select name="kind"><option value="booking">예약</option><option value="block">예약 불가(휴무·공사·내부 사용)</option></select></label>
          <label class="f"><span>지점</span><select name="venue">${venueOptions(b.venue, '')}</select></label>
          <label class="f" data-only="booking"><span>상태</span><select name="status">${Object.entries(E().BOOKING_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
        <label class="f"><span>제목</span><input type="text" name="title" value="${esc(b.title || '')}" maxlength="100" placeholder="행사명 또는 사유"></label>
        <div class="f"><span class="f-label">사용 공간</span><div data-zones></div></div>
        <div class="g4"><label class="f"><span>시작일</span><input type="date" name="start_date" value="${esc(b.start_date || '')}" required></label><label class="f"><span>종료일</span><input type="date" name="end_date" value="${esc(b.end_date || b.start_date || '')}"></label>
          <label class="f"><span>시작 시간</span><input type="time" name="start_time" value="${esc(b.start_time || '')}"></label><label class="f"><span>종료 시간</span><input type="time" name="end_time" value="${esc(b.end_time || '')}"></label></div>
        <div data-only="booking"><div class="g2"><label class="f"><span>대관 금액(원)</span><input type="text" name="amount" inputmode="numeric" value="${esc(b.amount || '')}"></label><label class="f"><span>계약금(원)</span><input type="text" name="deposit_amount" inputmode="numeric" value="${esc(b.deposit_amount || '')}"></label></div>
          <p><label class="ck"><input type="checkbox" name="deposit_paid" value="1"${b.deposit_paid ? ' checked' : ''}>계약금 입금 확인</label><label class="ck"><input type="checkbox" name="balance_paid" value="1"${b.balance_paid ? ' checked' : ''}>잔금 입금 확인</label></p></div>
        <label class="f"><span>메모</span><textarea name="memo" rows="3" maxlength="2000">${esc(b.memo || '')}</textarea></label>
      </form>`,
      foot: `${isNew ? '' : '<button type="button" class="btn btn-danger left" data-del>삭제</button>'}<button type="button" class="btn" data-cancel>취소</button><button type="button" class="btn btn-point" data-save>저장</button>`,
    });
    const f = m.$('#bf');
    f.kind.value = b.kind || 'booking';
    f.status.value = b.status || 'hold';
    const syncKind = () => m.$$('[data-only=booking]').forEach((el) => { el.hidden = f.kind.value !== 'booking'; });
    const syncZones = (keep) => { m.$('[data-zones]').innerHTML = zoneChecks(f.venue.value, keep ? b.zones || [] : []); };
    f.kind.addEventListener('change', syncKind);
    f.venue.addEventListener('change', () => syncZones(false));
    syncKind();
    syncZones(true);
    m.$('[data-cancel]').addEventListener('click', m.close);
    if (!isNew) m.$('[data-del]').addEventListener('click', async () => {
      if (!(await confirmBox('이 일정을 삭제합니다.', '삭제', true))) return;
      try { await api(`/bookings/${b.id}`, { method: 'DELETE' }); m.close(); toast('삭제했습니다'); done(); } catch (ex) { toast(ex.message, true); }
    });
    let warned = false;
    m.$('[data-save]').addEventListener('click', async () => {
      if (warned) { m.close(); done(); return; }
      const d = formData(f);
      d.zones = arr(d.zones);
      d.deposit_paid = !!d.deposit_paid;
      d.balance_paid = !!d.balance_paid;
      if (f.kind.value === 'block') d.status = 'confirmed';
      if (isNew) { d.inquiry_id = b.inquiry_id; d.quote_id = b.quote_id; d.customer_id = b.customer_id; }
      const err = m.$('.err');
      err.hidden = true;
      try {
        const r = await api(isNew ? '/bookings' : `/bookings/${b.id}`, { method: isNew ? 'POST' : 'PATCH', body: d });
        if (r.conflicts && r.conflicts.length && d.status !== 'cancelled') {
          warned = true;
          const note = m.$('.note');
          note.innerHTML = `저장했습니다. 다만 같은 지점에 겹치는 일정이 있습니다: ${r.conflicts.map((c) => `${esc(c.title)} (${esc(period(c.start_date, c.end_date))})`).join(', ')}. 동이나 층이 달라 함께 진행할 수 있는지 확인해 주세요.`;
          note.hidden = false;
          m.$('[data-save]').textContent = '확인했습니다';
          return;
        }
        m.close();
        toast('저장했습니다');
        done();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  }
  window.MZ.bookingEditor = bookingEditor;

  views.bookings = async (main, parts) => {
    const now = new Date();
    const state = { y: now.getFullYear(), m: now.getMonth(), venue: '' };
    main.innerHTML = `<div class="head"><div><h1>예약·일정</h1><p>확정·가예약 일정과 예약 불가 날짜를 관리합니다. 여기 등록한 일정이 홈페이지의 예약 현황에 표시됩니다.</p></div>
        <div class="head-actions"><a class="btn" href="/api/admin/export?type=bookings">엑셀(CSV) 내려받기</a><button class="btn" type="button" id="b-block">예약 불가 일정</button><button class="btn btn-point" type="button" id="b-new">예약 등록</button></div></div>
      <div class="calbar"><button class="btn" type="button" id="c-prev" aria-label="이전 달">‹</button><strong id="c-title"></strong><button class="btn" type="button" id="c-next" aria-label="다음 달">›</button><button class="btn" type="button" id="c-today">이번 달</button>
        <select id="c-venue" style="width:auto" aria-label="지점">${venueOptions('', '모든 지점')}</select></div>
      <div class="cal" id="cal"></div>
      <p class="legend">${S.content.venues.map((v) => `<span><i class="dotv" style="background:${esc(v.color || '#7b818c')}"></i>${esc(v.name.replace('메자닌 ', ''))}</span>`).join('')}<span>실선 = 확정</span><span>점선 = 가예약</span><span>빗금 = 예약 불가</span></p>
      <section class="card" style="margin-top:18px"><h2>이 달의 일정</h2><div id="b-list"></div></section>`;
    let items = [];
    const draw = async () => {
      const first = new Date(state.y, state.m, 1);
      const last = new Date(state.y, state.m + 1, 0);
      const d = await api(`/bookings?from=${ymd(first)}&to=${ymd(last)}${state.venue ? `&venue=${state.venue}` : ''}`);
      items = d.items;
      main.querySelector('#c-title').textContent = `${state.y}년 ${state.m + 1}월`;
      const todayStr = ymd(new Date());
      let cells = ['일', '월', '화', '수', '목', '금', '토'].map((x) => `<div class="cal-dow">${x}</div>`).join('');
      for (let n = 0; n < first.getDay(); n++) cells += '<div class="cal-cell is-out"></div>';
      for (let dd = 1; dd <= last.getDate(); dd++) {
        const ds = `${state.y}-${pad(state.m + 1)}-${pad(dd)}`;
        const evs = items.filter((b) => b.status !== 'cancelled' && ds >= b.start_date && ds <= b.end_date);
        cells += `<div class="cal-cell${ds === todayStr ? ' is-today' : ''}" data-date="${ds}"><span>${dd}</span>${evs.slice(0, 3).map((b) => `<button type="button" class="ev${b.kind === 'block' ? ' is-block' : b.status === 'hold' ? ' is-hold' : b.status === 'done' ? ' is-done' : ''}" style="--c:${esc(venueColor(b.venue))}" data-id="${b.id}" title="${esc(venueName(b.venue))} · ${esc(b.title)}">${esc(b.title)}</button>`).join('')}${evs.length > 3 ? `<span class="muted small">+${evs.length - 3}</span>` : ''}</div>`;
      }
      for (let n = (first.getDay() + last.getDate()) % 7; n > 0 && n < 7; n++) cells += '<div class="cal-cell is-out"></div>';
      main.querySelector('#cal').innerHTML = cells;
      main.querySelector('#b-list').innerHTML = items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일정</th><th>지점·공간</th><th>내용</th><th>고객</th><th class="num">금액</th><th>입금</th><th>상태</th></tr></thead><tbody>
        ${items.map((b) => `<tr data-bid="${b.id}" style="cursor:pointer"><td>${esc(period(b.start_date, b.end_date))}${b.start_time ? `<br><span class="muted small">${esc(b.start_time)}${b.end_time ? `~${esc(b.end_time)}` : ''}</span>` : ''}</td><td>${venueDot(b.venue)}${b.zones.length ? `<br><span class="muted small">${b.zones.map(esc).join(', ')}</span>` : ''}</td>
          <td><b>${esc(b.title)}</b>${b.code ? `<br><a class="btn-text small" href="#/inquiries/${b.inquiry_id}">${esc(b.code)}</a>` : ''}</td><td>${esc(b.customer_name || '')}${b.customer_company ? ` <span class="muted">${esc(b.customer_company)}</span>` : ''}</td>
          <td class="num">${b.kind === 'block' ? '' : `${won(b.amount)}원`}</td><td>${b.kind === 'block' ? '' : `${b.deposit_paid ? '계약금 ✓' : '<span class="muted">계약금 –</span>'} ${b.balance_paid ? '잔금 ✓' : '<span class="muted">잔금 –</span>'}`}</td>
          <td>${b.kind === 'block' ? st('done', '예약 불가') : st(b.status === 'hold' ? 'hold' : b.status, E().BOOKING_STATUS[b.status])}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">이 달에 등록된 일정이 없습니다.</p>';
    };
    const open = (id) => { const b = items.find((x) => x.id === Number(id)); if (b) bookingEditor(b, draw); };
    main.querySelector('#cal').addEventListener('click', (e) => {
      const ev = e.target.closest('.ev');
      if (ev) return open(ev.dataset.id);
      const cell = e.target.closest('.cal-cell[data-date]');
      if (cell) bookingEditor({ venue: state.venue || S.content.venues[0].slug, start_date: cell.dataset.date, end_date: cell.dataset.date, status: 'hold' }, draw);
    });
    main.querySelector('#b-list').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-bid]'); if (tr && !e.target.closest('a')) open(tr.dataset.bid); });
    main.querySelector('#c-prev').addEventListener('click', () => { state.m--; if (state.m < 0) { state.m = 11; state.y--; } draw(); });
    main.querySelector('#c-next').addEventListener('click', () => { state.m++; if (state.m > 11) { state.m = 0; state.y++; } draw(); });
    main.querySelector('#c-today').addEventListener('click', () => { state.y = now.getFullYear(); state.m = now.getMonth(); draw(); });
    main.querySelector('#c-venue').addEventListener('change', (e) => { state.venue = e.target.value; draw(); });
    main.querySelector('#b-new').addEventListener('click', () => bookingEditor({ venue: state.venue || S.content.venues[0].slug, status: 'hold', start_date: ymd(new Date()) }, draw));
    main.querySelector('#b-block').addEventListener('click', () => bookingEditor({ kind: 'block', venue: state.venue || S.content.venues[0].slug, start_date: ymd(new Date()) }, draw));
    await draw();
    if (parts[0]) {
      // 대시보드에서 넘어온 경우 해당 일정 열기
      const all = await api('/bookings');
      const b = all.items.find((x) => x.id === Number(parts[0]));
      if (b) { state.y = Number(b.start_date.slice(0, 4)); state.m = Number(b.start_date.slice(5, 7)) - 1; await draw(); bookingEditor(b, draw); }
    }
  };

  // ── 고객 ────────────────────────────────────────────────────
  views.customers = async (main, parts) => {
    if (parts[0]) return customerDetail(main, Number(parts[0]));
    main.innerHTML = `<div class="head"><div><h1>고객 관리</h1><p>문의를 남긴 사람은 연락처 기준으로 자동 등록됩니다. 같은 연락처로 다시 문의하면 한 고객으로 묶입니다.</p></div>
        <div class="head-actions"><a class="btn" href="/api/admin/export?type=customers">엑셀(CSV) 내려받기</a></div></div>
      <div class="bar"><input type="search" id="c-q" placeholder="이름, 회사, 연락처, 태그 검색" aria-label="검색"></div><div id="list"></div>`;
    const load = async (q = '') => {
      const d = await api('/customers' + (q ? `?q=${encodeURIComponent(q)}` : ''));
      main.querySelector('#list').innerHTML = d.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>이름</th><th>회사·단체</th><th>연락처</th><th>태그</th><th class="num">문의</th><th class="num">예약</th><th class="num">누적 금액</th><th>최근 문의</th></tr></thead><tbody>
        ${d.items.map((c) => `<tr data-href="#/customers/${c.id}"><td><b>${esc(c.name)}</b></td><td>${esc(c.company || '')}</td><td>${esc(c.phone || '')}</td><td>${esc(c.tags || '')}</td><td class="num">${c.inquiry_count}</td><td class="num">${c.booking_count}</td><td class="num">${c.total_amount ? won(c.total_amount) + '원' : ''}</td><td>${day(c.last_inquiry_at)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="tbl-wrap"><p class="empty">등록된 고객이 없습니다.</p></div>';
    };
    let t;
    main.querySelector('#c-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()), 300); });
    await load();
  };

  async function customerDetail(main, id) {
    const d = await api(`/customers/${id}`);
    const c = d.customer;
    main.innerHTML = `<a class="back" href="#/customers">← 고객 목록</a>
      <div class="head"><div><h1>${esc(c.name)}${c.company ? ` <span class="muted" style="font-size:1rem;font-weight:600">${esc(c.company)}</span>` : ''}</h1><p>${day(c.created_at)} 등록</p></div></div>
      <div class="cols cols-wide"><div>
        <form class="card" id="cf"><h2>고객 정보</h2><p class="err" hidden></p>
          <div class="g2"><label class="f"><span>이름</span><input type="text" name="name" value="${esc(c.name)}" maxlength="40"></label><label class="f"><span>회사·단체</span><input type="text" name="company" value="${esc(c.company || '')}" maxlength="80"></label>
            <label class="f"><span>연락처</span><input type="tel" name="phone" value="${esc(c.phone || '')}" maxlength="30"></label><label class="f"><span>이메일</span><input type="email" name="email" value="${esc(c.email || '')}" maxlength="120"></label></div>
          <label class="f"><span>태그 <small>쉼표로 구분 (예: 대행사, 재방문, VIP)</small></span><input type="text" name="tags" value="${esc(c.tags || '')}" maxlength="200"></label>
          <label class="f"><span>메모</span><textarea name="memo" rows="5" maxlength="4000">${esc(c.memo || '')}</textarea></label>
          <button class="btn btn-point" type="submit">저장</button></form>
      </div><div>
        <section class="card"><h2>문의 이력 <small>${d.inquiries.length}건</small></h2>
          ${d.inquiries.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>접수번호</th><th>지점</th><th>행사</th><th>상태</th></tr></thead><tbody>${d.inquiries.map((r) => `<tr data-href="#/inquiries/${r.id}"><td><b>${esc(r.code)}</b><br><span class="muted small">${day(r.created_at)}</span></td><td>${venueDot(r.venue)}</td><td>${r.kind === 'open_notify' ? '오픈 알림' : esc(r.event_type || '')}<br><span class="muted small">${esc(period(r.date_start, r.date_end))}</span></td><td>${st(r.status, E().INQUIRY_STATUS[r.status])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">문의 이력이 없습니다.</p>'}
        </section>
        <section class="card"><h2>예약 이력 <small>${d.bookings.length}건</small></h2>
          ${d.bookings.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일정</th><th>지점</th><th class="num">금액</th><th>상태</th></tr></thead><tbody>${d.bookings.map((b) => `<tr><td>${esc(period(b.start_date, b.end_date))}<br><span class="muted small">${esc(b.title)}</span></td><td>${venueDot(b.venue)}</td><td class="num">${won(b.amount)}원</td><td>${st(b.status === 'hold' ? 'hold' : b.status, E().BOOKING_STATUS[b.status])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">예약 이력이 없습니다.</p>'}
        </section>
      </div></div>`;
    main.querySelector('#cf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = e.target.querySelector('.err');
      err.hidden = true;
      try { await api(`/customers/${id}`, { method: 'PATCH', body: formData(e.target) }); toast('저장했습니다'); } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  }
})();
