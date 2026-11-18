// 관리자·호스트센터 공통 막대 그래프 (한 가지 값만 그립니다. 두 값은 그래프를 나눠서 그립니다)
// - 막대 두께 최대 24px, 위쪽만 4px 둥글게, 기준선에서 올라감
// - 마우스·키보드로 막대를 고르면 값이 뜨고, 아래 '표로 보기'에 같은 값이 있습니다
window.MZChart = (() => {
  'use strict';
  const COLOR = '#1d7a56';
  const GRID = '#ecece8';
  const AXIS = '#8a8d8f';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const won = (n) => {
    const a = Math.abs(n);
    if (a >= 1e8) return `${(n / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '')}억`;
    if (a >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만`;
    return Number(n).toLocaleString('ko-KR');
  };
  const count = (n) => Number(n).toLocaleString('ko-KR');

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  // rows: [{ label, value, tip? }], opt: { fmt, unit, height, name, highlightLast }
  function bars(el, rows, opt = {}) {
    const fmt = opt.fmt || count;
    const H = opt.height || 190;
    el.classList.add('mzc');
    const draw = () => {
      const W = Math.max(260, el.clientWidth || 600);
      const padL = 46;
      const padR = 8;
      const padT = 22;
      const padB = 28;
      const vals = rows.map((r) => Number(r.value) || 0);
      const empty = vals.every((v) => v === 0);
      let max = niceMax(Math.max(...vals, 0));
      // 건수처럼 정수인 값은 눈금도 정수로(0 / 1 / 2)
      if (opt.fmt !== won) {
        max = Math.max(2, Math.ceil(max));
        if (max % 2) max += 1;
      }
      const ih = H - padT - padB;
      const band = (W - padL - padR) / Math.max(1, rows.length);
      const bw = Math.min(24, Math.max(6, band * 0.56));
      const y = (v) => padT + ih - (v / max) * ih;
      const ticks = [0, max / 2, max];
      const maxI = vals.indexOf(Math.max(...vals));
      const lastI = rows.length - 1;
      const every = opt.every || (band < 34 ? (band < 15 ? 4 : 2) : 1);
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opt.name || '그래프')}">`;
      for (const t of ticks) {
        svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" stroke-width="1"/>`;
        svg += `<text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="${AXIS}">${esc(fmt(t))}</text>`;
      }
      rows.forEach((r, i) => {
        const v = vals[i];
        const cx = padL + band * i + band / 2;
        const x = cx - bw / 2;
        const top = y(v);
        const base = y(0);
        const h = base - top;
        if (h > 0.5) {
          const rr = Math.min(4, h, bw / 2);
          svg += `<path d="M${x},${base}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + bw - rr}Q${x + bw},${top} ${x + bw},${top + rr}V${base}Z" fill="${COLOR}" opacity="${opt.highlightLast && i !== lastI ? 0.55 : 1}"/>`;
        }
        if (v > 0 && (i === maxI || (opt.highlightLast && i === lastI))) {
          svg += `<text x="${cx}" y="${top - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="#282a2b">${esc(fmt(v))}</text>`;
        }
        if (i % every === 0 || i === lastI) svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${AXIS}">${esc(r.label)}</text>`;
        svg += `<rect class="mzc-hit" data-i="${i}" x="${padL + band * i}" y="${padT - 6}" width="${band}" height="${ih + 6}" fill="transparent" tabindex="0" aria-label="${esc(`${r.label} ${r.tip || fmt(v) + (opt.unit || '')}`)}"/>`;
      });
      if (empty) svg += `<text x="${padL + (W - padL - padR) / 2}" y="${padT + ih / 2}" text-anchor="middle" font-size="12" fill="${AXIS}">이 기간에는 기록이 없습니다</text>`;
      svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" stroke="#c9cbc6" stroke-width="1"/></svg>`;
      el.innerHTML = `<div class="mzc-plot">${svg}<div class="mzc-tip" hidden></div></div>
        <details class="mzc-tbl"><summary>표로 보기</summary><table class="tbl"><thead><tr><th>${esc(opt.col || '기간')}</th><th class="num">${esc(opt.name || '값')}</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td>${esc(r.full || r.label)}</td><td class="num">${esc(r.tip || fmt(vals[i]) + (opt.unit || ''))}</td></tr>`).join('')}</tbody></table></details>`;
      const tip = el.querySelector('.mzc-tip');
      const show = (rect) => {
        const i = Number(rect.dataset.i);
        const r = rows[i];
        tip.innerHTML = `<b>${esc(r.full || r.label)}</b><span>${esc(r.tip || fmt(vals[i]) + (opt.unit || ''))}</span>`;
        tip.hidden = false;
        const bx = padL + band * i + band / 2;
        const scale = (el.querySelector('svg').getBoundingClientRect().width || W) / W;
        tip.style.left = `${Math.min(Math.max(bx * scale, 60), W * scale - 60)}px`;
        tip.style.top = `${Math.max(0, y(vals[i]) * scale - 46)}px`;
      };
      el.querySelectorAll('.mzc-hit').forEach((rect) => {
        rect.addEventListener('mouseenter', () => show(rect));
        rect.addEventListener('focus', () => show(rect));
        rect.addEventListener('mouseleave', () => (tip.hidden = true));
        rect.addEventListener('blur', () => (tip.hidden = true));
      });
    };
    draw();
    if (window.ResizeObserver) {
      let w = el.clientWidth;
      new ResizeObserver(() => {
        if (Math.abs(el.clientWidth - w) > 8) {
          w = el.clientWidth;
          draw();
        }
      }).observe(el);
    }
  }

  // 단계별 가로 막대(퍼널). steps: [{ label, value, note? }]
  function funnel(el, steps) {
    const max = Math.max(1, ...steps.map((s) => s.value || 0));
    el.innerHTML = `<div class="mzf">${steps
      .map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        const rate = prev ? Math.round(((s.value || 0) / prev) * 1000) / 10 : null;
        return `<div class="mzf-row">
          <span class="mzf-label">${esc(s.label)}</span>
          <span class="mzf-track"><i style="width:${Math.max(s.value ? 1.5 : 0, ((s.value || 0) / max) * 100)}%"></i></span>
          <span class="mzf-val">${count(s.value || 0)}</span>
          <span class="mzf-rate">${rate === null ? '' : `이전 단계의 ${rate}%`}${s.note ? ` · ${esc(s.note)}` : ''}</span>
        </div>`;
      })
      .join('')}</div>`;
  }

  return { bars, funnel, won, count, COLOR };
})();
