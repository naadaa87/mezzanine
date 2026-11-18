(() => {
  'use strict';
  const form = document.getElementById('inq');
  if (!form) return;
  const venues = JSON.parse(document.getElementById('venues-data').textContent);
  const zonesField = document.getElementById('zones-field');
  const zonesBox = document.getElementById('zones');
  const errorBox = document.getElementById('inq-error');
  const submitBtn = document.getElementById('inq-submit');
  const rentalSets = Array.from(form.querySelectorAll('[data-rental]'));
  const contactNo = form.querySelector('[data-step-contact]');
  const params = new URLSearchParams(location.search);

  const currentVenue = () => {
    const r = form.querySelector('input[name="venue"]:checked');
    return r ? venues.find((v) => v.slug === r.value) || null : null;
  };

  // 지점에 따라 고를 수 있는 공간과 입력 항목이 달라집니다
  const applyVenue = () => {
    const v = currentVenue();
    const coming = !!v && v.status === 'coming';
    rentalSets.forEach((fs) => {
      fs.hidden = coming;
    });
    contactNo.textContent = coming ? '2' : '4';
    submitBtn.textContent = coming ? '오픈 알림 신청하기' : '문의 접수하기';
    document.getElementById('message').placeholder = coming
      ? '어떤 행사를 생각하고 계신지 적어 주시면 오픈 때 맞춰 안내합니다.'
      : '행사 개요, 필요한 설비, 궁금한 점을 자유롭게 적어 주세요.';
    zonesBox.textContent = '';
    const zones = v && !coming ? v.zones : [];
    zonesField.hidden = zones.length < 2;
    zones.forEach((z) => {
      const label = document.createElement('label');
      label.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'zones';
      input.value = z;
      if (zones.length === 1) input.checked = true;
      const span = document.createElement('span');
      span.textContent = z;
      label.append(input, span);
      zonesBox.appendChild(label);
    });
  };
  form.querySelectorAll('input[name="venue"]').forEach((r) => r.addEventListener('change', applyVenue));

  // 주소로 넘어온 지점·행사 유형 미리 채우기
  const pre = params.get('venue');
  if (pre) {
    const r = form.querySelector(`input[name="venue"][value="${CSS.escape(pre)}"]`);
    if (r) r.checked = true;
  }
  const preType = params.get('type');
  if (preType) {
    const sel = document.getElementById('event_type');
    Array.from(sel.options).forEach((o) => {
      if (o.value === preType || o.text === preType) sel.value = o.value || o.text;
    });
  }
  applyVenue();

  // 날짜는 오늘 이후, 종료일은 시작일 이후
  const pad = (n) => String(n).padStart(2, '0');
  const t = new Date();
  const todayStr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  const ds = document.getElementById('date_start');
  const de = document.getElementById('date_end');
  ds.min = de.min = todayStr;
  ds.addEventListener('change', () => {
    de.min = ds.value || todayStr;
    if (!de.value || de.value < ds.value) de.value = ds.value;
  });
  // 홈 '공간 찾기'에서 넘어온 날짜·인원
  const preDate = params.get('date');
  if (preDate && /^\d{4}-\d{2}-\d{2}$/.test(preDate) && preDate >= todayStr) {
    ds.value = preDate;
    de.value = preDate;
    de.min = preDate;
  }
  const preCount = parseInt(params.get('headcount') || '', 10);
  const hc = document.getElementById('headcount');
  if (hc && preCount > 0) hc.value = String(preCount);

  // 고른 날짜의 예약 현황을 바로 알려 줍니다
  const availBox = document.getElementById('avail');
  let availSeq = 0;
  const checkAvail = async () => {
    const v = currentVenue();
    const from = ds.value;
    const to = de.value || ds.value;
    if (!availBox) return;
    if (!v || v.status === 'coming' || !from) { availBox.hidden = true; return; }
    const seq = ++availSeq;
    try {
      const r = await fetch(`/api/availability?venue=${encodeURIComponent(v.slug)}&from=${from}&to=${to}`);
      const j = await r.json();
      if (seq !== availSeq || !j.ok) return;
      const states = new Set(j.items.map((x) => x.state));
      let cls = 'is-free';
      let msg = `${v.name}의 ${from === to ? from : `${from} ~ ${to}`} 일정은 현재 예약 현황상 비어 있습니다.`;
      if (states.has('booked')) { cls = 'is-booked'; msg = '선택한 기간에 확정된 일정이 있습니다. 일부 공간만 쓰는 경우 함께 쓸 수 있는지 확인해 드리니, 다른 후보 날짜도 함께 적어 주세요.'; }
      else if (states.has('closed')) { cls = 'is-booked'; msg = '선택한 기간에 대관이 어려운 날짜가 포함되어 있습니다. 다른 날짜를 함께 적어 주세요.'; }
      else if (states.has('hold')) { cls = 'is-hold'; msg = '선택한 기간에 협의 중인 일정이 있습니다. 문의를 남겨 주시면 가능 여부를 바로 확인해 드립니다.'; }
      availBox.className = `avail ${cls}`;
      availBox.textContent = msg;
      availBox.hidden = false;
    } catch {
      availBox.hidden = true;
    }
  };
  ds.addEventListener('change', checkAvail);
  de.addEventListener('change', checkAvail);
  form.querySelectorAll('input[name="venue"]').forEach((r) => r.addEventListener('change', checkAvail));
  if (ds.value) checkAvail();

  // 전화번호 자동 하이픈
  const phone = document.getElementById('phone');
  phone.addEventListener('input', () => {
    const d = phone.value.replace(/\D/g, '').slice(0, 11);
    phone.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  });

  const fail = (msg, el) => {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    form.querySelectorAll('.is-invalid').forEach((x) => x.classList.remove('is-invalid'));
    if (el) {
      el.classList.add('is-invalid');
      el.focus();
    } else errorBox.scrollIntoView({ block: 'center' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const v = currentVenue();
    const coming = !!v && v.status === 'coming';
    if (!form.querySelector('input[name="venue"]:checked')) return fail('지점을 선택해 주세요. 아직 못 정했다면 "아직 못 정했어요"를 골라 주세요.', form.querySelector('input[name="venue"]'));
    if (!String(fd.get('name') || '').trim()) return fail('담당자 이름을 적어 주세요.', document.getElementById('name'));
    if (String(fd.get('phone') || '').replace(/\D/g, '').length < 9) return fail('연락받을 전화번호를 확인해 주세요.', phone);
    const email = String(fd.get('email') || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('이메일 주소를 확인해 주세요.', document.getElementById('email'));
    if (!fd.get('agree')) return fail('개인정보 수집·이용에 동의해 주세요.', form.querySelector('input[name="agree"]'));

    const body = {
      kind: coming ? 'open_notify' : 'rental',
      venue: fd.get('venue') || '',
      zones: coming ? [] : fd.getAll('zones'),
      date_start: coming ? '' : fd.get('date_start'),
      date_end: coming ? '' : fd.get('date_end'),
      time_start: coming ? '' : fd.get('time_start'),
      time_end: coming ? '' : fd.get('time_end'),
      date_flexible: !coming && !!fd.get('date_flexible'),
      event_type: coming ? '' : fd.get('event_type'),
      headcount: coming ? '' : fd.get('headcount'),
      event_name: coming ? '' : fd.get('event_name'),
      budget: coming ? '' : fd.get('budget'),
      options: coming ? [] : fd.getAll('options'),
      message: fd.get('message'),
      name: fd.get('name'),
      company: fd.get('company'),
      phone: fd.get('phone'),
      email,
      contact_pref: fd.get('contact_pref'),
      agree: true,
      hp: fd.get('hp'),
    };

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = '접수하는 중입니다';
    try {
      const res = await fetch('/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || '문의를 접수하지 못했습니다.');
      window.mzTrack?.('conv:inquiry');
      const link = `${location.origin}/my?code=${encodeURIComponent(j.code)}&t=${encodeURIComponent(j.token)}`;
      form.hidden = true;
      const done = document.getElementById('inq-done');
      done.hidden = false;
      document.getElementById('done-code').textContent = j.code;
      document.getElementById('done-link').href = link;
      document.getElementById('done-copy').addEventListener('click', async (ev) => {
        try {
          await navigator.clipboard.writeText(link);
          ev.target.textContent = '복사했습니다';
        } catch {
          prompt('아래 주소를 복사해 보관해 주세요.', link);
        }
      });
      if (coming) done.querySelector('h2').textContent = '오픈 알림을 신청했습니다';
      done.focus();
      done.scrollIntoView({ block: 'start' });
    } catch (err) {
      fail(err.message || '문의를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
})();
