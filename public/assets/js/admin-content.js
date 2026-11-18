// 메자닌 관리자 — 사이트 콘텐츠(지점·사진·사례·FAQ·요금표)와 설정
(() => {
  'use strict';
  const { S, api, esc, won, dt, day, toast, modal, confirmBox, formData, views, reloadContent } = window.MZ;
  const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const commas = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  async function saveContent(key, value, msg = '저장했습니다. 홈페이지에는 잠시 뒤 반영됩니다.') {
    await api(`/content/${key}`, { method: 'PUT', body: { value } });
    await reloadContent();
    toast(msg);
  }

  // ── 지점 정보 ────────────────────────────────────────────────
  // 건물 구성은 "동 | 층 | 면적 | 설명" 형식의 줄로 편집합니다.
  const buildingsToText = (bs) => (bs || []).flatMap((b) => b.floors.map((f) => [b.name, f.f, f.area ?? '', f.desc || ''].join(' | '))).join('\n');
  function textToBuildings(text, prev = []) {
    const out = [];
    for (const line of lines(text)) {
      const [name, f, area, ...rest] = line.split('|').map((x) => x.trim());
      if (!name || !f) continue;
      let b = out.find((x) => x.name === name);
      if (!b) {
        const old = prev.find((x) => x.name === name) || {};
        b = { ...old, name, floors: [] };
        out.push(b);
      }
      const oldF = (prev.find((x) => x.name === name)?.floors || []).find((x) => x.f === f.toUpperCase()) || {};
      const a = parseFloat(area);
      b.floors.push({ ...oldF, f: f.toUpperCase(), area: Number.isFinite(a) ? a : null, desc: rest.join(' | ') });
    }
    for (const b of out) {
      const sum = b.floors.filter((f) => f.f !== 'RT' && !f.ghost).reduce((s, f) => s + (f.area || 0), 0);
      if (b.total && sum && Math.abs(b.total - sum) > 3) b.total = Math.round(sum);
    }
    return out;
  }

  views.venues = async (main, parts) => {
    const venues = JSON.parse(JSON.stringify(S.content.venues));
    if (!parts[0]) {
      main.innerHTML = `<div class="head"><div><h1>지점 정보</h1><p>홈페이지에 보이는 지점 소개, 건물 구성, 오시는 길을 수정합니다.</p></div>
          <div class="head-actions"><button class="btn" type="button" id="v-add">지점 추가</button></div></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>지점</th><th>상태</th><th>주소</th><th>사진</th><th></th></tr></thead><tbody>
        ${venues.map((v, i) => `<tr data-href="#/venues/${esc(v.slug)}"><td><b>${esc(v.name)}</b><br><span class="muted small">/venues/${esc(v.slug)}</span></td><td>${v.status === 'coming' ? '오픈 예정' : '운영 중'}</td><td>${esc(v.address || '')}</td>
          <td><a class="btn-text" href="#/photos/venue:${esc(v.slug)}">사진 관리</a></td><td><button class="btn btn-sm" type="button" data-up="${i}" aria-label="위로">↑</button> <button class="btn btn-sm" type="button" data-down="${i}" aria-label="아래로">↓</button></td></tr>`).join('')}
        </tbody></table></div>`;
      main.querySelectorAll('[data-up],[data-down]').forEach((b) => b.addEventListener('click', async () => {
        move(venues, Number(b.dataset.up ?? b.dataset.down), b.dataset.up !== undefined ? -1 : 1);
        try { await saveContent('venues', venues, '순서를 바꿨습니다'); window.MZ.route(); } catch (ex) { toast(ex.message, true); }
      }));
      main.querySelector('#v-add').addEventListener('click', () => {
        const m = modal({ title: '지점 추가', body: `<p class="err" hidden></p><label class="f"><span>지점명</span><input type="text" id="n-name" placeholder="예: 메자닌 성수"></label><label class="f"><span>주소용 영문 이름 <small>소문자·숫자·하이픈. 예: seongsu → /venues/seongsu</small></span><input type="text" id="n-slug" placeholder="seongsu"></label>`,
          foot: '<button class="btn btn-point" type="button" data-ok>추가</button>' });
        m.$('[data-ok]').addEventListener('click', async () => {
          const name = m.$('#n-name').value.trim();
          const slug = m.$('#n-slug').value.trim().toLowerCase();
          const err = m.$('.err');
          if (!name || !/^[a-z0-9-]{2,30}$/.test(slug) || venues.some((v) => v.slug === slug)) { err.textContent = '지점명을 적고, 겹치지 않는 영문 이름을 소문자·숫자·하이픈으로 적어 주세요.'; err.hidden = false; return; }
          venues.push({ slug, name, name_en: '', status: 'coming', district: '오픈 준비 중', address: '', color: '#7b818c', headline: '', summary: '', stats: [], linked: false, courtyard: false, buildings: [], features: [], uses: [], zone_options: [], access: [], parking: '', map: { naver: '', kakao: '' }, brochure: '', video: '', instagram: '' });
          try { await saveContent('venues', venues, '지점을 추가했습니다'); m.close(); location.hash = `#/venues/${slug}`; } catch (ex) { err.textContent = ex.message; err.hidden = false; }
        });
      });
      return;
    }
    const idx = venues.findIndex((v) => v.slug === parts[0]);
    if (idx < 0) { main.innerHTML = '<p class="err">없는 지점입니다.</p>'; return; }
    const v = venues[idx];
    const kvRows = (list) => (list || []).map((x) => `<div class="kv"><input type="text" value="${esc(x.label)}" placeholder="항목" aria-label="항목"><input type="text" value="${esc(x.value)}" placeholder="내용" aria-label="내용"><button type="button" class="btn btn-sm btn-danger" aria-label="삭제">✕</button></div>`).join('');
    main.innerHTML = `<a class="back" href="#/venues">← 지점 목록</a>
      <div class="head"><div><h1>${esc(v.name)}</h1><p><a class="btn-text" href="/venues/${esc(v.slug)}" target="_blank" rel="noopener">홈페이지에서 보기</a> · <a class="btn-text" href="#/photos/venue:${esc(v.slug)}">사진 관리</a></p></div></div>
      <form id="vf">
        <section class="card"><h2>기본 정보</h2>
          <div class="g3"><label class="f"><span>지점명</span><input type="text" name="name" value="${esc(v.name)}" required></label><label class="f"><span>영문 이름</span><input type="text" name="name_en" value="${esc(v.name_en || '')}"></label>
            <label class="f"><span>상태</span><select name="status"><option value="open"${v.status === 'open' ? ' selected' : ''}>운영 중 (대관 가능)</option><option value="coming"${v.status === 'coming' ? ' selected' : ''}>오픈 예정</option></select></label></div>
          <div class="g3"><label class="f"><span>지역 표기</span><input type="text" name="district" value="${esc(v.district || '')}" placeholder="예: 강남구 삼성동"></label><label class="f"><span>주소</span><input type="text" name="address" value="${esc(v.address || '')}"></label>
            <label class="f"><span>달력 표시 색</span><input type="text" name="color" value="${esc(v.color || '')}" placeholder="#2447F0"></label></div>
          <label class="f"><span>한 줄 소개</span><input type="text" name="headline" value="${esc(v.headline || '')}" maxlength="80"></label>
          <label class="f"><span>공간 소개</span><textarea name="summary" rows="4">${esc(v.summary || '')}</textarea></label>
        </section>
        <section class="card"><h2>핵심 수치 <small>지점 이름 아래에 표시됩니다 (최대 4개)</small></h2><div id="v-stats">${kvRows(v.stats)}</div><button type="button" class="btn btn-sm" data-add="v-stats">항목 추가</button></section>
        <section class="card"><h2>건물 구성</h2>
          <label class="f"><span>한 줄에 한 층씩: 동 | 층 | 면적(평) | 설명 <small>층은 2F, 1F, B1, RT(루프탑)처럼 적습니다. 면적을 모르면 비워 둡니다.</small></span><textarea name="buildings" rows="9" style="font-variant-numeric:tabular-nums">${esc(buildingsToText(v.buildings))}</textarea></label>
          <p><label class="ck"><input type="checkbox" name="linked" value="1"${v.linked ? ' checked' : ''}>2층이 메자닌으로 연결됨</label><label class="ck"><input type="checkbox" name="courtyard" value="1"${v.courtyard ? ' checked' : ''}>중정 있음</label></p>
          <label class="f"><span>문의 양식에서 고를 수 있는 공간 <small>쉼표로 구분</small></span><input type="text" name="zone_options" value="${esc((v.zone_options || []).join(', '))}"></label>
        </section>
        <section class="card"><h2>특징과 용도</h2>
          <label class="f"><span>특징 <small>한 줄에 하나씩</small></span><textarea name="features" rows="5">${esc((v.features || []).join('\n'))}</textarea></label>
          <label class="f"><span>잘 맞는 행사 <small>쉼표로 구분</small></span><input type="text" name="uses" value="${esc((v.uses || []).join(', '))}"></label>
        </section>
        <section class="card"><h2>오시는 길·링크</h2>
          <div id="v-access">${kvRows(v.access)}</div><button type="button" class="btn btn-sm" data-add="v-access">교통 항목 추가</button>
          <div class="g2" style="margin-top:14px"><label class="f"><span>주차</span><input type="text" name="parking" value="${esc(v.parking || '')}"></label><label class="f"><span>유튜브 영상 ID <small>주소의 v= 뒤 11자</small></span><input type="text" name="video" value="${esc(v.video || '')}"></label>
            <label class="f"><span>네이버 지도 링크</span><input type="url" name="map_naver" value="${esc(v.map?.naver || '')}"></label><label class="f"><span>카카오맵 링크</span><input type="url" name="map_kakao" value="${esc(v.map?.kakao || '')}"></label>
            <label class="f"><span>공간소개서 PDF 드라이브 링크 <small>링크가 있는 모든 사용자 공유</small></span><input type="url" name="brochure" value="${esc(v.brochure || '')}"></label><label class="f"><span>지점 인스타그램</span><input type="url" name="instagram" value="${esc(v.instagram || '')}"></label></div>
          <label class="f"><span>드라이브 영상 ID <small>쉼표로 구분</small></span><input type="text" name="drive_videos" value="${esc((v.drive_videos || []).join(', '))}"></label>
        </section>
        <div class="savebar"><button type="button" class="btn btn-danger" id="v-del" style="margin-right:auto">지점 삭제</button><button class="btn btn-point" type="submit">저장</button></div>
      </form>`;
    main.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) document.getElementById(add.dataset.add).insertAdjacentHTML('beforeend', kvRows([{ label: '', value: '' }]));
      const del = e.target.closest('.kv button');
      if (del) del.closest('.kv').remove();
    });
    const readKv = (id) => Array.from(main.querySelectorAll(`#${id} .kv`)).map((r) => ({ label: r.children[0].value.trim(), value: r.children[1].value.trim() })).filter((x) => x.label || x.value);
    main.querySelector('#vf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(e.target);
      Object.assign(v, {
        name: d.name.trim(), name_en: d.name_en.trim(), status: d.status, district: d.district.trim(), address: d.address.trim(), color: /^#[0-9a-fA-F]{6}$/.test(d.color.trim()) ? d.color.trim() : v.color,
        headline: d.headline.trim(), summary: d.summary.trim(), stats: readKv('v-stats').slice(0, 4), buildings: textToBuildings(d.buildings, v.buildings), linked: !!d.linked, courtyard: !!d.courtyard,
        zone_options: commas(d.zone_options), features: lines(d.features), uses: commas(d.uses), access: readKv('v-access'), parking: d.parking.trim(), video: d.video.trim(),
        map: { naver: d.map_naver.trim(), kakao: d.map_kakao.trim() }, brochure: d.brochure.trim(), instagram: d.instagram.trim(), drive_videos: commas(d.drive_videos),
      });
      try { await saveContent('venues', venues); } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#v-del').addEventListener('click', async () => {
      if (!(await confirmBox(`${v.name} 지점을 홈페이지에서 삭제합니다. 이 지점의 문의와 예약 기록은 남습니다.`, '지점 삭제', true))) return;
      venues.splice(idx, 1);
      try { await saveContent('venues', venues, '지점을 삭제했습니다'); location.hash = '#/venues'; } catch (ex) { toast(ex.message, true); }
    });
  };

  // ── 사진 ────────────────────────────────────────────────────
  // 올리기 전에 브라우저에서 긴 변 1920px, WebP로 줄여서 저장합니다.
  async function compress(file, maxSide = 1920, maxBytes = 1_500_000) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    let q = 0.82;
    let max = maxSide;
    for (let n = 0; n < 5; n++) {
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      let blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
      if (blob.size <= maxBytes) return { blob, w, h };
      q -= 0.12;
      max = Math.round(max * 0.85);
    }
    throw new Error('사진 용량을 줄이지 못했습니다.');
  }

  views.photos = async (main, parts) => {
    const owners = [
      { key: 'site:hero', label: '홈 · 대표 이미지(맨 위 큰 사진)', hint: '홈 맨 위에 크게 보이는 사진입니다. 여러 장이면 7초마다 바뀝니다. 가로로 긴 사진이 잘 맞습니다.' },
      { key: 'site:use', label: '홈 · 이렇게 쓰입니다(활용 예시)', hint: '홈의 "이렇게 쓰입니다"에 보이는 정사각형 사진 3장입니다. 실제 행사가 아니라면 종류를 "연출 이미지"로 두세요.' },
      { key: 'site:og', label: '공유 미리보기 이미지', hint: '카카오톡·SNS에 주소를 공유할 때 보이는 첫 번째 사진입니다.' },
      ...S.content.venues.map((v) => ({ key: `venue:${v.slug}`, label: `공간 · ${v.name}`, hint: '첫 번째 사진이 공간 페이지 맨 위 큰 사진과 목록 대표 사진으로 쓰입니다.' })),
      ...S.content.cases.map((c) => ({ key: `case:${c.id}`, label: `사례 · ${c.title}`, hint: '첫 번째 사진이 사례 대표 사진으로 쓰입니다.' })),
    ];
    const KIND = { photo: '실제 사진', brand: '브랜드 이미지(보정)', staged: '연출 이미지' };
    const cur = decodeURIComponent(parts.join('/') || owners[0]?.key || '');
    const [type, ...rest] = cur.split(':');
    const ownerId = rest.join(':');
    const curOwner = owners.find((o) => o.key === cur);
    main.innerHTML = `<div class="head"><div><h1>사진</h1><p>홈, 공간, 대관 사례에 보여 줄 사진을 관리합니다. 실제 사진이 아닌 이미지는 종류를 바꿔 두면 사이트에 "브랜드 이미지", "연출 이미지"로 표시됩니다.</p></div>
        <div class="head-actions"><button class="btn btn-point" type="button" id="p-drive">구글드라이브에서 가져오기</button></div></div>
      <div class="bar"><select id="p-owner" aria-label="사진을 넣을 곳" style="max-width:420px">${owners.map((o) => `<option value="${esc(o.key)}"${o.key === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
      ${curOwner?.hint ? `<p class="muted small" style="margin:-4px 0 14px">${esc(curOwner.hint)}</p>` : ''}
      <p class="note" id="p-wait" hidden></p>
      <div class="drop" id="p-drop"><b>사진을 여기에 끌어다 놓거나 눌러서 선택하세요</b>여러 장을 한 번에 올릴 수 있습니다. 큰 사진은 자동으로 줄여서 저장합니다.
        <input type="file" id="p-file" accept="image/*" multiple hidden><p class="progress" id="p-prog" hidden></p></div>
      <div class="photos" id="p-grid"></div>`;
    const grid = main.querySelector('#p-grid');
    let items = [];
    const load = async () => {
      items = (await api(`/media?owner_type=${encodeURIComponent(type)}&owner_id=${encodeURIComponent(ownerId)}`)).items;
      const waiting = items.filter((p) => !p.size);
      const failed = waiting.filter((p) => p.fetch_state === -1);
      const wait = main.querySelector('#p-wait');
      wait.hidden = !waiting.length;
      wait.innerHTML = waiting.length ? `드라이브에서 아직 받지 못한 사진이 ${waiting.length}장 있습니다.${failed.length ? ' 드라이브 폴더의 공유 설정이 "링크가 있는 모든 사용자"인지 확인해 주세요.' : ' 15분 안에 자동으로 받아 옵니다.'} 저장 전인 사진은 사이트에 보이지 않습니다. <button type="button" class="btn btn-sm" id="p-fetch">지금 받기</button>` : '';
      grid.innerHTML = items.length ? items.map((p, i) => `<div class="photo" data-id="${p.id}">${p.size ? `<img src="/media/${p.id}?s=sm" alt="" loading="lazy">` : `<div style="aspect-ratio:4/3;display:grid;place-items:center;background:var(--mist);color:var(--sub);font-size:.84rem">${p.fetch_state === -1 ? '받기 실패' : '받는 중'}</div>`}
        <div class="photo-body"><input type="text" value="${esc(p.caption || '')}" placeholder="사진 설명(선택)" maxlength="120" aria-label="사진 설명">
          <select data-kind aria-label="사진 종류" style="min-height:32px;padding:4px 8px;font-size:.84rem;margin-top:6px">${Object.entries(KIND).map(([k, l]) => `<option value="${k}"${(p.kind || 'photo') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <div class="photo-act"><button type="button" class="btn btn-sm" data-mv="-1" aria-label="앞으로"${i === 0 ? ' disabled' : ''}>←</button><button type="button" class="btn btn-sm" data-mv="1" aria-label="뒤로"${i === items.length - 1 ? ' disabled' : ''}>→</button>
            <span class="muted small" style="margin:auto">${i === 0 ? '대표' : ''} ${p.size ? `${Math.round(p.size / 1024)}KB` : ''}</span><button type="button" class="btn btn-sm btn-danger" data-rm>삭제</button></div></div></div>`).join('')
        : '<p class="muted">아직 올린 사진이 없습니다.</p>';
      const fb = main.querySelector('#p-fetch');
      if (fb) fb.addEventListener('click', async () => {
        fb.disabled = true;
        fb.textContent = '받는 중입니다';
        try { const r = await api('/media/fetch', { method: 'POST' }); toast(r.ok ? `${r.ok}장을 받았습니다` : '받지 못했습니다. 공유 설정을 확인해 주세요.', !r.ok); } catch (ex) { toast(ex.message, true); }
        await load();
      });
    };
    main.querySelector('#p-owner').addEventListener('change', (e) => { location.hash = `#/photos/${e.target.value}`; });
    main.querySelector('#p-drive').addEventListener('click', () => driveImport(type, ownerId, owners.find((o) => o.key === cur)?.label || '', load));
    const drop = main.querySelector('#p-drop');
    const fileInput = main.querySelector('#p-file');
    const prog = main.querySelector('#p-prog');
    const upload = async (files) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      prog.hidden = false;
      let ok = 0;
      for (let n = 0; n < list.length; n++) {
        prog.textContent = `${list.length}장 중 ${n + 1}번째 사진을 올리는 중입니다`;
        try {
          const { blob, w, h } = await compress(list[n]);
          const kind = type === 'site' && ownerId === 'use' ? 'staged' : 'photo';
          const r = await api(`/media?owner_type=${encodeURIComponent(type)}&owner_id=${encodeURIComponent(ownerId)}&w=${w}&h=${h}&kind=${kind}`, { method: 'PUT', raw: { body: blob, type: blob.type } });
          // 목록용 작은 사진도 함께 만들어 둡니다
          try {
            const t = await compress(list[n], 720, 380_000);
            await api(`/media/${r.id}/thumb`, { method: 'PUT', raw: { body: t.blob, type: t.blob.type } });
          } catch {}
          ok++;
        } catch (ex) {
          toast(`${list[n].name}: ${ex.message}`, true);
        }
      }
      prog.hidden = true;
      if (ok) toast(`사진 ${ok}장을 올렸습니다`);
      await load();
    };
    drop.addEventListener('click', (e) => { if (e.target !== fileInput) fileInput.click(); });
    fileInput.addEventListener('change', () => { upload(fileInput.files); fileInput.value = ''; });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); upload(e.dataTransfer.files); });
    grid.addEventListener('click', async (e) => {
      const card = e.target.closest('.photo');
      if (!card) return;
      const id = Number(card.dataset.id);
      try {
        if (e.target.closest('[data-rm]')) {
          if (!(await confirmBox('이 사진을 삭제합니다.', '삭제', true))) return;
          await api(`/media/${id}`, { method: 'DELETE' });
          await load();
        }
        const mv = e.target.closest('[data-mv]');
        if (mv) {
          const ids = items.map((x) => x.id);
          move(ids, ids.indexOf(id), Number(mv.dataset.mv));
          await api('/media/reorder', { method: 'POST', body: { ids } });
          await load();
        }
      } catch (ex) { toast(ex.message, true); }
    });
    grid.addEventListener('change', async (e) => {
      const card = e.target.closest('.photo');
      if (card && e.target.matches('[data-kind]')) {
        try { await api(`/media/${card.dataset.id}`, { method: 'PATCH', body: { kind: e.target.value } }); toast('사진 종류를 바꿨습니다'); } catch (ex) { toast(ex.message, true); }
        return;
      }
      if (!card || e.target.tagName !== 'INPUT') return;
      try { await api(`/media/${card.dataset.id}`, { method: 'PATCH', body: { caption: e.target.value } }); toast('설명을 저장했습니다'); } catch (ex) { toast(ex.message, true); }
    });
    if (owners.length) await load();
  };

  // ── 구글드라이브에서 가져오기 ─────────────────────────────────
  function driveImport(type, ownerId, label, done) {
    const m = modal({
      wide: true,
      title: '구글드라이브에서 가져오기',
      body: `<p class="muted" style="margin-bottom:12px">공유 설정이 "링크가 있는 모든 사용자"인 폴더의 링크를 붙여 넣으세요. 고른 사진은 <b>${esc(label)}</b>에 추가되고, 서버가 사진을 받아 사이트에 따로 저장합니다.</p>
        <p class="err" hidden></p>
        <div class="bar"><input type="url" id="d-url" placeholder="https://drive.google.com/drive/folders/..." style="flex:1;min-width:240px" aria-label="드라이브 폴더 링크"><button type="button" class="btn" id="d-load">폴더 열기</button></div>
        <div class="bar"><label class="small muted" for="d-kind">가져올 사진의 종류</label><select id="d-kind" style="width:auto"><option value="photo">실제 사진</option><option value="brand">브랜드 이미지(보정)</option><option value="staged">연출 이미지</option></select></div>
        <div id="d-list"></div>`,
      foot: '<span class="muted small left" id="d-count"></span><button type="button" class="btn" data-cancel>닫기</button><button type="button" class="btn btn-point" id="d-go" disabled>가져오기</button>',
    });
    let items = [];
    const sel = new Set();
    const count = () => {
      const ni = items.filter((x) => x.kind === 'image' && sel.has(x.id)).length;
      const nv = items.filter((x) => x.kind === 'video' && sel.has(x.id)).length;
      m.$('#d-count').textContent = ni || nv ? `사진 ${ni}장${nv ? `, 영상 ${nv}개` : ''} 선택` : '';
      m.$('#d-go').disabled = !(ni || nv);
    };
    const draw = () => {
      const imgs = items.filter((x) => x.kind === 'image');
      const vids = items.filter((x) => x.kind === 'video');
      m.$('#d-list').innerHTML = `
        ${imgs.length ? `<div class="bar" style="margin-top:6px"><b>사진 ${imgs.length}장</b><button type="button" class="btn btn-sm" data-all="image">모두 선택</button><button type="button" class="btn btn-sm" data-none>선택 해제</button></div>
          <div class="photos" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));max-height:52vh;overflow:auto">${imgs.map((x) => `<label class="photo" style="cursor:pointer;${sel.has(x.id) ? 'outline:3px solid var(--point)' : ''}"><img src="https://drive.google.com/thumbnail?id=${esc(x.id)}&sz=w320" alt="" loading="lazy"><span class="photo-body small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-id="${esc(x.id)}"${sel.has(x.id) ? ' checked' : ''}><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</span></span></label>`).join('')}</div>` : ''}
        ${vids.length ? `<p style="margin-top:14px"><b>영상 ${vids.length}개</b> <span class="muted small">고른 영상은 해당 페이지에 "현장 영상"으로 붙고, 드라이브 플레이어로 재생됩니다.</span></p>
          <p>${vids.map((x) => `<label class="ck"><input type="checkbox" data-id="${esc(x.id)}"${sel.has(x.id) ? ' checked' : ''}>${esc(x.name)}</label>`).join('')}</p>` : ''}
        ${!imgs.length && !vids.length ? '<p class="muted">이 폴더에는 가져올 사진이나 영상이 없습니다.</p>' : ''}`;
      count();
    };
    m.$('#d-list').addEventListener('change', (e) => {
      const id = e.target.dataset && e.target.dataset.id;
      if (!id) return;
      if (e.target.checked) sel.add(id); else sel.delete(id);
      const card = e.target.closest('.photo');
      if (card) card.style.outline = e.target.checked ? '3px solid var(--point)' : '';
      count();
    });
    m.$('#d-list').addEventListener('click', (e) => {
      if (e.target.closest('[data-all]')) { items.filter((x) => x.kind === 'image').forEach((x) => sel.add(x.id)); draw(); }
      if (e.target.closest('[data-none]')) { sel.clear(); draw(); }
    });
    const err = m.$('.err');
    m.$('#d-load').addEventListener('click', async () => {
      err.hidden = true;
      m.$('#d-list').innerHTML = '<p class="muted">폴더를 여는 중입니다.</p>';
      try {
        const d = await api(`/drive/list?url=${encodeURIComponent(m.$('#d-url').value)}`);
        items = d.items;
        sel.clear();
        draw();
      } catch (ex) { m.$('#d-list').innerHTML = ''; err.textContent = ex.message; err.hidden = false; }
    });
    m.$('#d-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); m.$('#d-load').click(); } });
    m.$('[data-cancel]').addEventListener('click', m.close);
    m.$('#d-go').addEventListener('click', async () => {
      const images = items.filter((x) => x.kind === 'image' && sel.has(x.id)).map((x) => ({ id: x.id, caption: '' }));
      const videos = items.filter((x) => x.kind === 'video' && sel.has(x.id)).map((x) => x.id);
      const go = m.$('#d-go');
      go.disabled = true;
      err.hidden = true;
      try {
        const r = await api('/media/drive', { method: 'POST', body: { owner_type: type, owner_id: ownerId, images, videos, kind: m.$('#d-kind').value } });
        // 서버가 드라이브에서 사진을 받아 저장하도록 한 장씩 열어 둡니다
        let ok = 0;
        for (let n = 0; n < r.ids.length; n++) {
          go.textContent = `사진 저장 중 ${n + 1}/${r.ids.length}`;
          const res = await fetch(`/media/${r.ids[n]}?s=sm`).catch(() => null);
          if (res && res.ok) ok++;
        }
        if (videos.length) await reloadContent();
        m.close();
        toast(ok < r.ids.length ? `사진 ${ok}장을 저장했습니다. ${r.ids.length - ok}장은 드라이브에서 받지 못했습니다.` : `사진 ${ok}장${videos.length ? `, 영상 ${videos.length}개` : ''}를 가져왔습니다`, ok < r.ids.length);
        done();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; go.disabled = false; go.textContent = '가져오기'; }
    });
    m.$('#d-url').focus();
  }

  // ── 대관 사례 ────────────────────────────────────────────────
  views.cases = async (main) => {
    const cases = JSON.parse(JSON.stringify(S.content.cases));
    const draw = () => {
      main.innerHTML = `<div class="head"><div><h1>대관 사례</h1><p>홈페이지의 대관 사례에 보이는 행사입니다. 위에 있는 순서대로, 처음 4개가 홈 화면의 "최근 열린 행사"에 나옵니다.</p></div>
          <div class="head-actions"><button class="btn" type="button" id="c-add">사례 추가</button><button class="btn btn-point" type="button" id="c-save">저장</button></div></div>
        ${cases.map((c, i) => `<div class="rowed" data-i="${i}"><div class="rowed-head"><b>${esc(c.title || '새 사례')}</b><span><a class="btn-text small" href="#/photos/case:${esc(c.id)}">사진 관리</a> <button type="button" class="btn btn-sm" data-mv="-1" aria-label="위로">↑</button> <button type="button" class="btn btn-sm" data-mv="1" aria-label="아래로">↓</button> <button type="button" class="btn btn-sm btn-danger" data-rm>삭제</button></span></div>
          <div class="g4"><label class="f"><span>행사명</span><input type="text" data-k="title" value="${esc(c.title)}"></label><label class="f"><span>지점</span><select data-k="venue">${S.content.venues.map((v) => `<option value="${esc(v.slug)}"${v.slug === c.venue ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
            <label class="f"><span>행사 유형</span><input type="text" data-k="type" value="${esc(c.type || '')}"></label><label class="f"><span>일자</span><input type="text" data-k="date" value="${esc(c.date || '')}" placeholder="2026.05.29 – 05.31"></label></div>
          <label class="f"><span>소개</span><textarea data-k="summary" rows="2">${esc(c.summary || '')}</textarea></label>
          <div class="g4"><label class="f"><span>사용 공간</span><input type="text" data-k="scope" value="${esc(c.scope || '')}"></label><label class="f"><span>규모·운영 <small>쉼표 구분</small></span><input type="text" data-k="facts" value="${esc((c.facts || []).join(', '))}"></label>
            <label class="f"><span>유튜브 영상 ID</span><input type="text" data-k="video" value="${esc(c.video || '')}"></label><label class="f"><span>관련 링크</span><input type="url" data-k="link" value="${esc(c.link || '')}"></label></div>
          <label class="f"><span>드라이브 영상 ID <small>쉼표로 구분. 사진 → 구글드라이브에서 가져오기로도 추가됩니다</small></span><input type="text" data-k="drive_videos" value="${esc((c.drive_videos || []).join(', '))}"></label></div>`).join('')}`;
    };
    const collect = () => main.querySelectorAll('.rowed').forEach((el) => {
      const c = cases[Number(el.dataset.i)];
      el.querySelectorAll('[data-k]').forEach((inp) => { c[inp.dataset.k] = ['facts', 'drive_videos'].includes(inp.dataset.k) ? commas(inp.value) : inp.value.trim(); });
    });
    draw();
    main.addEventListener('click', async (e) => {
      const row = e.target.closest('.rowed');
      if (e.target.closest('#c-add')) { collect(); cases.unshift({ id: 'case-' + Date.now().toString(36), title: '', venue: S.content.venues[0].slug, type: '', date: '', scope: '', summary: '', facts: [], video: '', link: '' }); draw(); return; }
      if (e.target.closest('#c-save')) { collect(); try { await saveContent('cases', cases.filter((c) => c.title)); window.MZ.route(); } catch (ex) { toast(ex.message, true); } return; }
      if (!row) return;
      const i = Number(row.dataset.i);
      if (e.target.closest('[data-rm]')) { collect(); cases.splice(i, 1); draw(); }
      const mv = e.target.closest('[data-mv]');
      if (mv) { collect(); move(cases, i, Number(mv.dataset.mv)); draw(); }
    });
  };

  // ── FAQ·이용 안내 ────────────────────────────────────────────
  views.faqs = async (main) => {
    const faqs = JSON.parse(JSON.stringify(S.content.faqs));
    const notes = (S.content.guide?.notes || []).join('\n');
    const draw = () => {
      main.innerHTML = `<div class="head"><div><h1>FAQ·이용 안내</h1><p>홈페이지의 이용 안내 페이지에 보이는 내용입니다.</p></div>
          <div class="head-actions"><button class="btn" type="button" id="f-add">질문 추가</button><button class="btn btn-point" type="button" id="f-save">저장</button></div></div>
        <section class="card"><h2>사용 전에 알아두실 것 <small>한 줄에 하나씩</small></h2><textarea id="f-notes" rows="5">${esc(document.getElementById('f-notes')?.value ?? notes)}</textarea></section>
        ${faqs.map((f, i) => `<div class="rowed" data-i="${i}"><div class="rowed-head"><b>질문 ${i + 1}</b><span><button type="button" class="btn btn-sm" data-mv="-1" aria-label="위로">↑</button> <button type="button" class="btn btn-sm" data-mv="1" aria-label="아래로">↓</button> <button type="button" class="btn btn-sm btn-danger" data-rm>삭제</button></span></div>
          <label class="f"><span>질문</span><input type="text" data-k="q" value="${esc(f.q)}"></label><label class="f"><span>답변</span><textarea data-k="a" rows="3">${esc(f.a)}</textarea></label></div>`).join('')}`;
    };
    const collect = () => main.querySelectorAll('.rowed').forEach((el) => { const f = faqs[Number(el.dataset.i)]; el.querySelectorAll('[data-k]').forEach((inp) => { f[inp.dataset.k] = inp.value.trim(); }); });
    draw();
    main.addEventListener('click', async (e) => {
      if (e.target.closest('#f-add')) { collect(); faqs.push({ q: '', a: '' }); draw(); return; }
      if (e.target.closest('#f-save')) {
        collect();
        try {
          await api('/content/guide', { method: 'PUT', body: { value: { notes: lines(main.querySelector('#f-notes').value) } } });
          await saveContent('faqs', faqs.filter((f) => f.q));
          window.MZ.route();
        } catch (ex) { toast(ex.message, true); }
        return;
      }
      const row = e.target.closest('.rowed');
      if (!row) return;
      const i = Number(row.dataset.i);
      if (e.target.closest('[data-rm]')) { collect(); faqs.splice(i, 1); draw(); }
      const mv = e.target.closest('[data-mv]');
      if (mv) { collect(); move(faqs, i, Number(mv.dataset.mv)); draw(); }
    });
  };

  // ── 요금표 ──────────────────────────────────────────────────
  views.rates = async (main) => {
    const rates = JSON.parse(JSON.stringify(S.content.rates || []));
    const draw = () => {
      main.innerHTML = `<div class="head"><div><h1>요금표</h1><p>견적서를 쓸 때 불러다 쓰는 항목입니다. 홈페이지에는 공개되지 않습니다.</p></div>
          <div class="head-actions"><button class="btn" type="button" id="r-add">항목 추가</button><button class="btn btn-point" type="button" id="r-save">저장</button></div></div>
        ${rates.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:150px">지점</th><th>항목</th><th style="width:90px">단위</th><th style="width:150px">단가(원)</th><th>설명</th><th style="width:50px"></th></tr></thead><tbody>
          ${rates.map((r, i) => `<tr data-i="${i}"><td><select data-k="venue"><option value="">공통</option>${S.content.venues.map((v) => `<option value="${esc(v.slug)}"${v.slug === r.venue ? ' selected' : ''}>${esc(v.name.replace('메자닌 ', ''))}</option>`).join('')}</select></td>
            <td><input type="text" data-k="name" value="${esc(r.name)}" placeholder="예: A동 전체 대관" aria-label="항목"></td><td><input type="text" data-k="unit" value="${esc(r.unit || '')}" placeholder="일" aria-label="단위"></td>
            <td><input type="text" data-k="price" value="${esc(r.price || '')}" inputmode="numeric" aria-label="단가"></td><td><input type="text" data-k="desc" value="${esc(r.desc || '')}" aria-label="설명"></td><td><button type="button" class="btn btn-sm btn-danger" data-rm aria-label="삭제">✕</button></td></tr>`).join('')}
          </tbody></table></div>` : '<div class="tbl-wrap"><p class="empty">등록한 요금 항목이 없습니다. "항목 추가"로 지점별 대관료, 장비 대여료 같은 항목을 넣어 두면 견적 작성이 빨라집니다.</p></div>'}`;
    };
    const collect = () => main.querySelectorAll('tr[data-i]').forEach((tr) => { const r = rates[Number(tr.dataset.i)]; tr.querySelectorAll('[data-k]').forEach((inp) => { r[inp.dataset.k] = inp.dataset.k === 'price' ? parseInt(inp.value.replace(/[^\d]/g, ''), 10) || 0 : inp.value.trim(); }); });
    draw();
    main.addEventListener('click', async (e) => {
      if (e.target.closest('#r-add')) { collect(); rates.push({ venue: '', name: '', unit: '일', price: 0, desc: '' }); draw(); return; }
      if (e.target.closest('#r-save')) { collect(); try { await saveContent('rates', rates.filter((r) => r.name), '요금표를 저장했습니다'); window.MZ.route(); } catch (ex) { toast(ex.message, true); } return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) { collect(); rates.splice(Number(rm.closest('tr').dataset.i), 1); draw(); }
    });
  };

  // ── 설정 ────────────────────────────────────────────────────
  views.settings = async (main) => {
    const s = S.content.settings;
    const admins = (await api('/admins')).items;
    main.innerHTML = `<div class="head"><div><h1>설정</h1></div></div>
      <div class="cols"><div>
        <form class="card" id="sf"><h2>사이트 정보</h2>
          <label class="f"><span>상단 공지 <small>적으면 모든 페이지 맨 위에 띠로 표시됩니다</small></span><input type="text" name="notice" value="${esc(s.notice || '')}" maxlength="120"></label>
          <label class="f"><span>사이트 소개 문구 <small>검색 결과에 보이는 설명</small></span><textarea name="description" rows="2">${esc(s.description || '')}</textarea></label>
          <label class="f"><span>대표 주소 <small>도메인을 연결했다면 https://로 시작하는 주소</small></span><input type="url" name="site_url" value="${esc(s.site_url || '')}" placeholder="https://"></label>
          <h2 style="margin-top:20px">연락 채널</h2>
          <div class="g2"><label class="f"><span>카카오톡 채널</span><input type="url" name="kakao" value="${esc(s.channels.kakao || '')}"></label><label class="f"><span>인스타그램</span><input type="url" name="instagram" value="${esc(s.channels.instagram || '')}"></label>
            <label class="f"><span>네이버 블로그</span><input type="url" name="blog" value="${esc(s.channels.blog || '')}"></label><label class="f"><span>유튜브</span><input type="url" name="youtube" value="${esc(s.channels.youtube || '')}"></label>
            <label class="f"><span>대표 전화 <small>비우면 표시하지 않습니다</small></span><input type="tel" name="phone" value="${esc(s.contact.phone || '')}"></label><label class="f"><span>상담 가능 시간</span><input type="text" name="hours" value="${esc(s.contact.hours || '')}" placeholder="평일 10:00~18:00"></label>
            <label class="f"><span>대표 이메일</span><input type="email" name="email" value="${esc(s.contact.email || '')}"></label></div>
          <h2 style="margin-top:20px">사업자 정보 <small>홈페이지 맨 아래에 표시</small></h2>
          <div class="g2"><label class="f"><span>상호</span><input type="text" name="company" value="${esc(s.business.company || '')}"></label><label class="f"><span>대표자</span><input type="text" name="ceo" value="${esc(s.business.ceo || '')}"></label>
            <label class="f"><span>사업자등록번호</span><input type="text" name="regno" value="${esc(s.business.regno || '')}"></label><label class="f"><span>사업장 주소</span><input type="text" name="baddress" value="${esc(s.business.address || '')}"></label></div>
          <h2 style="margin-top:20px">새 문의 알림</h2>
          <label class="f"><span>알림 받을 주소 <small>슬랙·디스코드의 수신 웹훅 주소를 넣으면 새 문의, 고객 메시지, 견적 응답이 올 때 알려 줍니다</small></span><input type="url" name="webhook" value="${esc(s.notify.webhook || '')}" placeholder="https://hooks.slack.com/..."></label>
          <button class="btn btn-point" type="submit">설정 저장</button>
        </form>
      </div><div>
        <section class="card"><h2>관리자 계정</h2>
          <div class="tbl-wrap" style="margin-bottom:14px"><table class="tbl"><thead><tr><th>이름</th><th>아이디</th><th>최근 로그인</th><th></th></tr></thead><tbody>
            ${admins.map((a) => `<tr><td><b>${esc(a.name || '')}</b>${a.role === 'owner' ? ' <span class="muted small">대표</span>' : ''}</td><td>${esc(a.login)}</td><td>${a.last_login_at ? dt(a.last_login_at) : ''}</td><td>${a.id !== S.admin.id && S.admin.role === 'owner' ? `<button class="btn btn-sm btn-danger" type="button" data-adel="${a.id}" data-name="${esc(a.name || a.login)}">삭제</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div>
          ${S.admin.role === 'owner' ? `<form id="af"><p class="err" hidden></p><div class="g3"><label class="f"><span>이름</span><input type="text" name="name" maxlength="40"></label><label class="f"><span>아이디</span><input type="text" name="login" maxlength="40" autocomplete="off" autocapitalize="none"></label><label class="f"><span>비밀번호 <small>8자 이상</small></span><input type="password" name="password" autocomplete="new-password"></label></div><button class="btn" type="submit">계정 추가</button></form>` : ''}
        </section>
        <form class="card" id="pf"><h2>내 비밀번호 변경</h2><p class="err" hidden></p>
          <div class="g2"><label class="f"><span>현재 비밀번호</span><input type="password" name="current" autocomplete="current-password"></label><label class="f"><span>새 비밀번호 <small>8자 이상</small></span><input type="password" name="next" autocomplete="new-password"></label></div>
          <button class="btn" type="submit">비밀번호 변경</button></form>
        <section class="card"><h2>캘린더 구독</h2>
          <p class="muted" style="margin-bottom:12px">예약·일정을 구글 캘린더나 휴대폰 캘린더에서 볼 수 있습니다. 구글 캘린더 → 다른 캘린더 추가 → URL로 추가에 아래 주소를 넣으세요. 주소를 아는 사람은 일정을 볼 수 있으니 외부에 공유하지 마세요.</p>
          <div id="ics-box"></div></section>
        <section class="card"><h2>자료 내려받기</h2><p class="muted" style="margin-bottom:12px">엑셀에서 바로 열리는 CSV 파일입니다.</p>
          <p><a class="btn" href="/api/admin/export?type=inquiries">문의</a> <a class="btn" href="/api/admin/export?type=bookings">예약·일정</a> <a class="btn" href="/api/admin/export?type=customers">고객</a></p></section>
      </div></div>`;
    const icsBox = main.querySelector('#ics-box');
    const drawIcs = (token) => {
      const url = token ? `${location.origin}/calendar/${token}.ics` : '';
      icsBox.innerHTML = url
        ? `<input type="text" readonly value="${esc(url)}" onclick="this.select()" aria-label="캘린더 구독 주소"><p style="margin-top:10px"><button class="btn btn-sm" type="button" data-ics="copy">주소 복사</button> <button class="btn btn-sm" type="button" data-ics="new">새 주소 만들기</button> <button class="btn btn-sm btn-danger" type="button" data-ics="off">구독 끄기</button></p>`
        : '<button class="btn" type="button" data-ics="new">구독 주소 만들기</button>';
    };
    drawIcs(s.calendar_token);
    icsBox.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ics]');
      if (!b) return;
      try {
        if (b.dataset.ics === 'copy') { await navigator.clipboard.writeText(icsBox.querySelector('input').value); toast('주소를 복사했습니다'); return; }
        if (b.dataset.ics === 'new' && s.calendar_token && !(await confirmBox('새 주소를 만들면 이전 주소로는 더 이상 일정을 볼 수 없습니다.', '새 주소 만들기'))) return;
        const r = await api('/calendar/token', { method: 'POST', body: { off: b.dataset.ics === 'off' } });
        await reloadContent();
        s.calendar_token = r.token;
        drawIcs(r.token);
        toast(r.token ? '구독 주소를 만들었습니다' : '캘린더 구독을 껐습니다');
      } catch (ex) { toast(ex.message, true); }
    });
    main.querySelector('#sf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(e.target);
      const value = { ...s, notice: d.notice.trim(), description: d.description.trim(), site_url: d.site_url.trim().replace(/\/$/, ''),
        channels: { kakao: d.kakao.trim(), instagram: d.instagram.trim(), blog: d.blog.trim(), youtube: d.youtube.trim() },
        contact: { phone: d.phone.trim(), hours: d.hours.trim(), email: d.email.trim() },
        business: { company: d.company.trim(), ceo: d.ceo.trim(), regno: d.regno.trim(), address: d.baddress.trim() },
        notify: { webhook: d.webhook.trim() } };
      try { await saveContent('settings', value, '설정을 저장했습니다'); } catch (ex) { toast(ex.message, true); }
    });
    const af = main.querySelector('#af');
    if (af) af.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = af.querySelector('.err');
      err.hidden = true;
      try { await api('/admins', { method: 'POST', body: formData(af) }); toast('계정을 추가했습니다'); window.MZ.route(); } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
    main.querySelectorAll('[data-adel]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox(`${b.dataset.name} 계정을 삭제합니다.`, '삭제', true))) return;
      try { await api(`/admins/${b.dataset.adel}`, { method: 'DELETE' }); toast('삭제했습니다'); window.MZ.route(); } catch (ex) { toast(ex.message, true); }
    }));
    main.querySelector('#pf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = e.target.querySelector('.err');
      err.hidden = true;
      try { await api('/password', { method: 'POST', body: formData(e.target) }); toast('비밀번호를 바꿨습니다'); e.target.reset(); } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  };
})();
