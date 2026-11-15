(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // 스크롤하면 상단에 얇은 선
  const top = $('.top');
  if (top) {
    const onScroll = () => top.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 영상 미리보기 이미지를 못 받으면 깨진 아이콘 대신 어두운 바탕과 재생 버튼만 둡니다
  const dropBroken = (img) => { img.style.visibility = 'hidden'; };
  $$('.dv img, .yt img').forEach((img) => {
    if (img.complete && !img.naturalWidth) dropBroken(img);
    img.addEventListener('error', () => dropBroken(img), { once: true });
  });

  // 홈 대표 이미지: 여러 장이면 천천히 바꿔 보여줍니다(움직임 줄이기 설정이면 멈춤)
  $$('[data-slides]').forEach((fig) => {
    const slides = $$('.hero-slide', fig);
    const cap = $('[data-cap-out]', fig);
    if (slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      slides[i].classList.remove('is-on');
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-on');
      if (cap) cap.textContent = slides[i].dataset.cap || '';
    }, 7000);
  });

  // 모바일 메뉴
  const menuBtn = $('.menu-btn');
  const nav = $('#nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      const label = $('.menu-label', menuBtn);
      if (label) label.textContent = open ? '닫기' : '메뉴';
    });
  }

  // 지점 탭(홈)
  $$('[data-tabs]').forEach((box) => {
    const tabs = $$('[role="tab"]', box);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const pane = document.getElementById(t.getAttribute('aria-controls'));
        if (pane) pane.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length], true);
        if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length], true);
      });
    });
  });

  // 단면도의 층을 누르면 설명 표시
  $$('.sd').forEach((svg) => {
    const scope = svg.closest('.pane, .plan-fig') || svg.parentElement;
    const cap = $('.sd-cap', scope);
    if (!cap) return;
    const floors = $$('.sd-floor[tabindex]', svg);
    const show = (g) => {
      floors.forEach((f) => f.classList.toggle('is-on', f === g));
      cap.textContent = '';
      const b = document.createElement('b');
      b.textContent = g.dataset.name;
      cap.append(b, g.dataset.desc || '자세한 구성은 문의 시 안내합니다.');
    };
    floors.forEach((g) => {
      g.addEventListener('click', () => show(g));
      g.addEventListener('mouseenter', () => show(g));
      g.addEventListener('focus', () => show(g));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          show(g);
        }
      });
    });
  });

  // 유튜브: 누르기 전에는 썸네일만 불러옵니다
  $$('.yt[data-yt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(btn.dataset.yt)}?autoplay=1&rel=0`;
      f.title = btn.getAttribute('aria-label') || '영상';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      const wrap = document.createElement('div');
      wrap.className = 'yt';
      wrap.appendChild(f);
      btn.replaceWith(wrap);
    });
  });

  // 구글드라이브 영상 재생
  let vd;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.dv[data-dv]');
    if (!btn) return;
    if (!vd) {
      vd = document.createElement('dialog');
      vd.className = 'lb vd';
      vd.innerHTML = '<div class="lb-in"><div class="vd-frame"></div><p class="lb-cap"></p></div><button type="button" class="lb-close" aria-label="닫기">✕</button>';
      document.body.appendChild(vd);
      $('.lb-close', vd).addEventListener('click', () => vd.close());
      vd.addEventListener('click', (ev) => {
        if (ev.target === vd || ev.target.classList.contains('lb-in')) vd.close();
      });
      vd.addEventListener('close', () => {
        $('.vd-frame', vd).textContent = '';
      });
    }
    const f = document.createElement('iframe');
    f.src = `https://drive.google.com/file/d/${encodeURIComponent(btn.dataset.dv)}/preview`;
    f.title = btn.getAttribute('aria-label') || '영상';
    f.allow = 'autoplay; fullscreen';
    f.allowFullscreen = true;
    $('.vd-frame', vd).replaceChildren(f);
    $('.lb-cap', vd).textContent = btn.getAttribute('aria-label') ? btn.getAttribute('aria-label').replace(/ 재생$/, '') : '';
    vd.showModal();
  });

  // 사진 크게 보기
  let lb;
  const openLightbox = (items, index) => {
    if (!lb) {
      lb = document.createElement('dialog');
      lb.className = 'lb';
      lb.innerHTML = '<div class="lb-in"><img alt=""><p class="lb-cap"></p></div><button type="button" class="lb-close" aria-label="닫기">✕</button><button type="button" class="lb-prev" aria-label="이전 사진">‹</button><button type="button" class="lb-next" aria-label="다음 사진">›</button>';
      document.body.appendChild(lb);
      $('.lb-close', lb).addEventListener('click', () => lb.close());
      lb.addEventListener('click', (e) => {
        if (e.target === lb || e.target.classList.contains('lb-in')) lb.close();
      });
      lb.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') lb._go(1);
        if (e.key === 'ArrowLeft') lb._go(-1);
      });
      $('.lb-prev', lb).addEventListener('click', () => lb._go(-1));
      $('.lb-next', lb).addEventListener('click', () => lb._go(1));
    }
    let i = index;
    const render = () => {
      $('img', lb).src = items[i].full;
      $('img', lb).alt = items[i].cap || '';
      $('.lb-cap', lb).textContent = `${items[i].cap ? items[i].cap + '  ' : ''}${i + 1} / ${items.length}`;
    };
    lb._go = (d) => {
      i = (i + d + items.length) % items.length;
      render();
    };
    $('.lb-prev', lb).hidden = $('.lb-next', lb).hidden = items.length < 2;
    render();
    lb.showModal();
  };
  $$('[data-gallery]').forEach((g) => {
    const btns = $$('.gal-item', g);
    const items = btns.map((b) => ({ full: b.dataset.full, cap: b.dataset.cap }));
    btns.forEach((b, i) => b.addEventListener('click', () => openLightbox(items, i)));
  });

  // 사례 지점별 보기
  $$('[data-filter]').forEach((box) => {
    const btns = $$('button', box);
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        btns.forEach((x) => x.classList.toggle('is-on', x === b));
        $$('.cdetail').forEach((c) => {
          c.hidden = !!b.dataset.v && c.dataset.venue !== b.dataset.v;
        });
      })
    );
  });

  // 예약 현황 달력
  $$('[data-calendar]').forEach((el) => {
    const venue = el.dataset.calendar;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cur = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxMonth = new Date(today.getFullYear(), today.getMonth() + 11, 1);
    const cache = {};

    const load = async (first) => {
      const key = ymd(first).slice(0, 7);
      if (cache[key]) return cache[key];
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      try {
        const r = await fetch(`/api/availability?venue=${encodeURIComponent(venue)}&from=${ymd(first)}&to=${ymd(last)}`);
        const j = await r.json();
        cache[key] = j.ok ? j.items : [];
      } catch {
        cache[key] = null;
      }
      return cache[key];
    };

    const draw = async () => {
      const items = await load(cur);
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const startDow = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const stateOf = (ds) => {
        if (!items) return '';
        let st = '';
        for (const it of items) {
          if (ds >= it.start && ds <= it.end) {
            if (it.state === 'booked') return 'booked';
            if (it.state === 'closed') st = st || 'closed';
            if (it.state === 'hold') st = 'hold';
          }
        }
        return st;
      };
      const label = { booked: '예약 마감', hold: '협의 중', closed: '대관 불가' };
      let cells = ['일', '월', '화', '수', '목', '금', '토'].map((d) => `<span class="cal-dow">${d}</span>`).join('');
      for (let i = 0; i < startDow; i++) cells += '<span></span>';
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const ds = ymd(date);
        const st = stateOf(ds);
        const cls = ['cal-day'];
        if (date < today) cls.push('is-past');
        else if (st) cls.push(`is-${st}`);
        if (date.getTime() === today.getTime()) cls.push('is-today');
        cells += `<span class="${cls.join(' ')}"${st && date >= today ? ` title="${label[st]}" aria-label="${m + 1}월 ${d}일 ${label[st]}"` : ''}>${d}</span>`;
      }
      el.innerHTML = `<div class="cal-head"><strong>${y}년 ${m + 1}월</strong><div class="cal-nav"><button type="button" data-d="-1" aria-label="이전 달"${cur <= new Date(today.getFullYear(), today.getMonth(), 1) ? ' disabled' : ''}>‹</button><button type="button" data-d="1" aria-label="다음 달"${cur >= maxMonth ? ' disabled' : ''}>›</button></div></div>
        <div class="cal-grid">${cells}</div>
        ${items ? '<p class="cal-legend"><span><i class="lg-booked"></i>예약 마감</span><span><i class="lg-hold"></i>협의 중</span><span><i class="lg-closed"></i>대관 불가</span></p>' : '<p class="cal-loading">예약 현황을 불러오지 못했습니다. 문의로 일정을 확인해 주세요.</p>'}`;
      $$('.cal-nav button', el).forEach((b) =>
        b.addEventListener('click', () => {
          cur = new Date(cur.getFullYear(), cur.getMonth() + Number(b.dataset.d), 1);
          draw();
        })
      );
    };
    draw();
  });
})();
