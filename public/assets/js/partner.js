// 공간 파트너 입점 문의
(() => {
  'use strict';
  const form = document.getElementById('pt');
  if (!form) return;
  const errorBox = document.getElementById('pt-error');
  const submitBtn = document.getElementById('pt-submit');
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
    if (!String(fd.get('name') || '').trim()) return fail('이름을 적어 주세요.', form.name);
    if (String(fd.get('phone') || '').replace(/\D/g, '').length < 9) return fail('연락처를 확인해 주세요.', form.phone);
    if (!String(fd.get('address') || '').trim()) return fail('건물 위치를 적어 주세요.', form.address);
    if (!fd.get('agree')) return fail('개인정보 수집·이용에 동의해 주세요.', form.agree);
    const body = Object.fromEntries(fd.entries());
    body.agree = true;
    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = '보내는 중입니다';
    try {
      const res = await fetch('/api/partners', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || '접수하지 못했습니다.');
      form.hidden = true;
      const done = document.getElementById('pt-done');
      document.getElementById('pt-code').textContent = j.code;
      done.hidden = false;
      done.focus();
      done.scrollIntoView({ block: 'start' });
    } catch (err) {
      fail(err.message || '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
})();
