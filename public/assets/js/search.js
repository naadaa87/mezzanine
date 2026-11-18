// 홈 '공간 찾기': 고른 날짜의 지점별 예약 상황을 바로 보여 주고, 견적 요청으로 이어 줍니다.
// 날짜를 고르지 않으면 견적 요청 화면으로 그대로 넘어갑니다(조건은 미리 채워짐).
(() => {
  'use strict';
  const form = document.getElementById('search');
  if (!form) return;
  const out = document.getElementById('search-out');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const t = new Date();
  form.date.min = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;

  const STATE = {
    free: ['so-free', '비어 있음', '현재 예약 현황상 이 날짜는 비어 있습니다.'],
    hold: ['so-hold', '협의 중', '협의 중인 일정이 있습니다. 문의를 남기시면 가능 여부를 바로 확인해 드립니다.'],
    booked: ['so-booked', '예약 있음', '확정된 일정이 있습니다. 일부 공간만 쓰는 경우 가능한지 확인해 드립니다.'],
    closed: ['so-booked', '예약 불가', '이 날짜는 대관이 어렵습니다. 다른 날짜를 함께 알려 주세요.'],
  };

  const inquiryUrl = (slug) => {
    const q = new URLSearchParams();
    if (slug) q.set('venue', slug);
    if (form.date.value) q.set('date', form.date.value);
    if (form.headcount.value) q.set('headcount', form.headcount.value);
    if (form.type.value) q.set('type', form.type.value);
    return `/inquiry?${q}`;
  };

  form.addEventListener('submit', async (e) => {
    const date = form.date.value;
    if (!date) return; // 날짜가 없으면 견적 요청 화면으로
    e.preventDefault();
    const venues = Array.from(form.venue.options)
      .filter((o) => o.value && (!form.venue.value || o.value === form.venue.value))
      .map((o) => ({ slug: o.value, name: o.textContent }));
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    out.hidden = false;
    out.innerHTML = '<p class="so-msg">예약 현황을 확인하고 있습니다.</p>';
    try {
      const rows = await Promise.all(venues.map(async (v) => {
        const r = await fetch(`/api/availability?venue=${encodeURIComponent(v.slug)}&from=${date}&to=${date}`);
        const j = await r.json();
        const st = new Set((j.items || []).map((x) => x.state));
        const key = st.has('closed') ? 'closed' : st.has('booked') ? 'booked' : st.has('hold') ? 'hold' : 'free';
        return { ...v, key };
      }));
      const [y, m, d] = date.split('-');
      out.innerHTML = `<h2>${Number(m)}월 ${Number(d)}일 예약 상황</h2>${rows.map((r) => {
        const [cls, label, msg] = STATE[r.key];
        return `<div class="so-row">
          <span class="so-name">${esc(r.name)} <span class="so-st ${cls}">${label}</span></span>
          <a class="btn btn-soft btn-sm" href="${esc(inquiryUrl(r.slug))}">이 날짜로 견적 요청</a>
          <span class="so-msg">${msg}</span>
        </div>`;
      }).join('')}`;
    } catch {
      out.innerHTML = `<p class="so-msg">예약 현황을 불러오지 못했습니다. <a class="text-link" href="${esc(inquiryUrl(form.venue.value))}">견적 요청</a>을 남겨 주시면 직접 확인해 드립니다.</p>`;
    } finally {
      btn.disabled = false;
    }
  });
})();
