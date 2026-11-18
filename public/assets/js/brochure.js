// 공간소개서 받기
(() => {
  'use strict';
  const form = document.getElementById('bro');
  if (!form) return;
  const errorBox = document.getElementById('bro-error');
  const submitBtn = document.getElementById('bro-submit');
  const done = document.getElementById('bro-done');
  const filesBox = document.getElementById('bro-files');
  const KEY = 'mz_brochure';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
  const fileButtons = (files) => files.map((f) => `<a class="dl" href="${esc(f.url)}" download="${esc(f.filename || `메자닌_${f.name.replace('메자닌 ', '')}_공간소개서.pdf`)}"><span><b>${esc(f.title || `${f.name} 소개서`)}</b><small>${esc(f.label)}</small></span>${icon}</a>`).join('');

  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };

  // 이 브라우저에서 이미 받은 적이 있으면 바로 내려받을 수 있게 보여 줍니다
  const prev = load();
  if (prev && prev.code && prev.token) {
    fetch(`/api/brochure/links?code=${encodeURIComponent(prev.code)}&t=${encodeURIComponent(prev.token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok || !j.files.length) return;
        const box = document.getElementById('bro-prev');
        box.innerHTML = `<p class="label">이전에 받은 소개서</p><div class="dl-list">${fileButtons(j.files)}</div>`;
        box.hidden = false;
      })
      .catch(() => {});
  }

  const fail = (msg, el) => {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    if (el) el.focus();
    else errorBox.scrollIntoView({ block: 'center' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const venues = fd.getAll('venues');
    if (!String(fd.get('name') || '').trim()) return fail('이름을 적어 주세요.', form.name);
    if (String(fd.get('phone') || '').replace(/\D/g, '').length < 9) return fail('연락처를 확인해 주세요.', form.phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fd.get('email') || '').trim())) return fail('이메일 주소를 확인해 주세요.', form.email);
    if (!fd.get('agree')) return fail('개인정보 수집·이용에 동의해 주세요.', form.agree);
    const body = {
      venues,
      name: fd.get('name'), company: fd.get('company'), phone: fd.get('phone'), email: String(fd.get('email') || '').trim(),
      event_type: fd.get('event_type'), event_month: fd.get('event_month'), wants_call: !!fd.get('wants_call'),
      agree: true, hp: fd.get('hp'), ref: document.referrer || '',
    };
    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = '준비하는 중입니다';
    try {
      const res = await fetch('/api/brochure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || '요청을 처리하지 못했습니다.');
      save({ code: j.code, token: j.token });
      filesBox.innerHTML = fileButtons(j.files);
      const inq = document.getElementById('bro-inquiry');
      if (venues.length === 1 && venues[0] !== 'all') inq.href = `/inquiry?venue=${encodeURIComponent(venues[0])}`;
      form.hidden = true;
      document.getElementById('bro-prev').hidden = true;
      done.hidden = false;
      done.focus();
      done.scrollIntoView({ block: 'start' });
    } catch (err) {
      fail(err.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
})();
