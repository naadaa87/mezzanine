(() => {
  'use strict';
  const lookup = document.getElementById('lookup');
  const box = document.getElementById('my');
  if (!lookup || !box) return;
  const params = new URLSearchParams(location.search);
  let code = params.get('code') || '';
  let token = params.get('t') || '';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
  const dt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const period = (a, b) => (a ? (b && b !== a ? `${a} ~ ${b}` : a) : '미정');
  const QST = { sent: '확인 대기', accepted: '수락함', declined: '거절함', expired: '기간 만료' };
  const BST = { hold: '가예약', confirmed: '예약 확정', done: '행사 완료' };
  const STEPS = ['문의 접수', '상담', '견적 확인', '계약', '예약 확정'];
  const stepOf = { new: 0, consulting: 1, quoted: 2, contracting: 3, confirmed: 4, done: 4 };

  const api = async (url, body) => {
    const res = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const j = await res.json().catch(() => ({ ok: false, error: '응답을 읽지 못했습니다.' }));
    if (!j.ok) throw new Error(j.error || '요청을 처리하지 못했습니다.');
    return j;
  };

  const quoteHtml = (q) => `<div class="quote" data-q="${q.id}">
      <div class="quote-head"><div><strong>${esc(q.title)}</strong> <span class="st st-${q.status}">${QST[q.status] || q.status}</span></div>
        <span>${esc(q.number)}${q.valid_until ? ` · ${esc(q.valid_until)}까지 유효` : ''}</span></div>
      <div class="table-scroll"><table>
        <thead><tr><th>항목</th><th class="num">수량</th><th class="num">단가</th><th class="num">금액</th></tr></thead>
        <tbody>${q.items.map((it) => `<tr><td>${esc(it.name)}${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</td><td class="num">${esc(it.qty)}${esc(it.unit || '')}</td><td class="num">${won(it.price)}</td><td class="num">${won(it.qty * it.price)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="quote-sum">
        <div><span>공급가액</span><span>${won(q.subtotal)}</span></div>
        ${q.discount ? `<div><span>할인</span><span>− ${won(q.discount)}</span></div>` : ''}
        ${q.vat_mode === 'add' ? `<div><span>부가세(10%)</span><span>${won(q.vat)}</span></div>` : ''}
        <div class="total"><span>합계${q.vat_mode === 'incl' ? ' (부가세 포함)' : q.vat_mode === 'none' ? ' (부가세 없음)' : ''}</span><span>${won(q.total)}</span></div>
      </div>
      ${q.note ? `<p class="quote-note">${esc(q.note)}</p>` : ''}
      <div class="quote-act">
        ${q.status === 'sent' ? `<button class="btn btn-dark" type="button" data-act="accept">이 견적으로 진행</button><button class="btn btn-line" type="button" data-act="decline">거절</button>` : ''}
        <button class="btn btn-line" type="button" data-act="print">인쇄·PDF 저장</button>
      </div>
    </div>`;

  const render = (d) => {
    const i = d.inquiry;
    const notify = i.kind === 'open_notify';
    const closed = i.status === 'cancelled' || i.status === 'hold';
    const now = stepOf[i.status] ?? 0;
    const b = d.booking;
    box.innerHTML = `
      <div class="my-head">
        <div><p>접수번호 ${esc(i.code)} · ${dt(i.created_at)} 접수</p><h2>${esc(i.venue_name)}${i.event_name ? ` · ${esc(i.event_name)}` : ''}</h2></div>
        <span class="chip ${closed ? 'chip-soon' : 'chip-open'}">${esc(i.status_label)}</span>
      </div>
      ${notify ? '<p class="my-alert">오픈 알림을 신청하셨습니다. 대관이 열리면 남겨 주신 연락처로 안내합니다.</p>'
        : closed ? `<p class="my-alert">${i.status === 'cancelled' ? '취소된 문의입니다.' : '진행이 보류된 문의입니다.'} 다시 진행하려면 메시지를 남겨 주세요.</p>`
        : `<ol class="track">${STEPS.map((s, n) => `<li class="${n < now ? 'is-done' : n === now ? 'is-now' : ''}"${n === now ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`}
      <div class="my-grid">
        <div>
          ${b ? `<section class="my-sec"><h3>예약 내용</h3><dl class="rows rows-sm">
              <div><dt>상태</dt><dd>${BST[b.status] || esc(b.status)}</dd></div>
              <div><dt>지점·공간</dt><dd>${esc(b.venue_name)}${b.zones.length ? ` · ${b.zones.map(esc).join(', ')}` : ''}</dd></div>
              <div><dt>일정</dt><dd>${period(b.start_date, b.end_date)}${b.start_time ? ` ${esc(b.start_time)}${b.end_time ? `~${esc(b.end_time)}` : ''}` : ''}</dd></div>
              ${b.amount ? `<div><dt>대관 금액</dt><dd>${won(b.amount)}</dd></div>` : ''}
              ${b.deposit_amount ? `<div><dt>계약금</dt><dd>${won(b.deposit_amount)} · ${b.deposit_paid ? '입금 확인' : '입금 대기'}</dd></div>` : ''}
              ${b.amount ? `<div><dt>잔금</dt><dd>${b.balance_paid ? '입금 확인' : '입금 대기'}</dd></div>` : ''}
            </dl></section>` : ''}
          ${notify ? '' : `<section class="my-sec" id="quotes"><h3>견적</h3>${d.quotes.length ? d.quotes.map(quoteHtml).join('') : '<p class="chat-empty">아직 보낸 견적서가 없습니다. 문의 내용을 확인한 뒤 이곳에 올려드립니다.</p>'}</section>`}
          <section class="my-sec"><h3>문의 내용</h3><dl class="rows rows-sm">
            <div><dt>지점</dt><dd>${esc(i.venue_name)}${i.zones.length ? ` · ${i.zones.map(esc).join(', ')}` : ''}</dd></div>
            ${notify ? '' : `<div><dt>희망 일정</dt><dd>${period(i.date_start, i.date_end)}${i.time_start ? ` ${esc(i.time_start)}${i.time_end ? `~${esc(i.time_end)}` : ''}` : ''}${i.date_flexible ? ' (조정 가능)' : ''}</dd></div>
            <div><dt>행사</dt><dd>${esc(i.event_type || '미정')}${i.headcount ? ` · ${esc(i.headcount)}명` : ''}</dd></div>
            ${i.options.length ? `<div><dt>요청 사항</dt><dd>${i.options.map(esc).join(', ')}</dd></div>` : ''}`}
            <div><dt>문의자</dt><dd>${esc(i.name)}${i.company ? ` (${esc(i.company)})` : ''}</dd></div>
            ${i.message ? `<div><dt>내용</dt><dd style="font-weight:400;white-space:pre-line">${esc(i.message)}</dd></div>` : ''}
          </dl></section>
        </div>
        <div class="my-side">
          <section class="my-sec"><h3>담당자와 메시지</h3>
            <div class="chat" id="chat" aria-live="polite">${d.messages.length ? d.messages.map((m) => `<p class="msg msg-${esc(m.sender)}">${esc(m.body)}<small>${m.sender === 'admin' ? '메자닌 ' : ''}${dt(m.created_at)}</small></p>`).join('') : '<p class="chat-empty">아직 주고받은 메시지가 없습니다. 궁금한 점이나 바뀐 일정을 남겨 주세요.</p>'}</div>
            <form class="chat-form" id="chat-form"><label class="hp" for="chat-body">메시지</label><textarea id="chat-body" rows="2" maxlength="2000" placeholder="메시지를 입력하세요" required></textarea><button class="btn btn-dark" type="submit">보내기</button></form>
            <p class="form-error" id="chat-error" role="alert" hidden></p>
            ${d.channels && d.channels.kakao ? `<p class="hint">급하시면 <a class="more" href="${esc(d.channels.kakao)}" target="_blank" rel="noopener">카카오톡 채널</a>로 접수번호와 함께 연락해 주세요.</p>` : ''}
          </section>
        </div>
      </div>`;
    box.hidden = false;
    lookup.hidden = true;
    const chat = document.getElementById('chat');
    chat.scrollTop = chat.scrollHeight;

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = document.getElementById('chat-body');
      const err = document.getElementById('chat-error');
      err.hidden = true;
      const body = ta.value.trim();
      if (!body) return;
      try {
        await api('/api/my/message', { code, t: token, body });
        await load();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });

    box.querySelectorAll('.quote').forEach((el) => {
      el.addEventListener('click', async (e) => {
        const act = e.target.dataset && e.target.dataset.act;
        if (!act) return;
        if (act === 'print') {
          document.body.classList.add('print-quote');
          el.classList.add('is-print');
          el.closest('.my-sec').classList.add('is-print');
          window.print();
          setTimeout(() => {
            document.body.classList.remove('print-quote');
            el.classList.remove('is-print');
            el.closest('.my-sec').classList.remove('is-print');
          }, 500);
          return;
        }
        const accept = act === 'accept';
        const act2 = el.querySelector('.quote-act');
        // 실수로 누르는 일을 막기 위해 한 번 더 확인
        if (!e.target.dataset.sure) {
          e.target.dataset.sure = '1';
          e.target.textContent = accept ? '한 번 더 누르면 수락됩니다' : '한 번 더 누르면 거절됩니다';
          return;
        }
        try {
          e.target.disabled = true;
          await api('/api/my/quote', { code, t: token, quote_id: Number(el.dataset.q), action: act });
          await load();
        } catch (ex) {
          const p = document.createElement('p');
          p.className = 'form-error';
          p.textContent = ex.message;
          act2.after(p);
        }
      });
    });
  };

  const load = async () => {
    const d = await api(`/api/my?code=${encodeURIComponent(code)}&t=${encodeURIComponent(token)}`);
    render(d);
  };

  lookup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('lookup-error');
    err.hidden = true;
    const fd = new FormData(lookup);
    try {
      const j = await api('/api/my/lookup', { code: String(fd.get('code') || '').trim(), phone: fd.get('phone') });
      code = j.code;
      token = j.token;
      history.replaceState(null, '', `/my?code=${encodeURIComponent(code)}&t=${encodeURIComponent(token)}`);
      await load();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  if (code && token) {
    load().catch((ex) => {
      const err = document.getElementById('lookup-error');
      err.textContent = ex.message;
      err.hidden = false;
      document.getElementById('l-code').value = code;
    });
  } else if (code) {
    document.getElementById('l-code').value = code;
  }
})();
