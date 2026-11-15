// MEZZANINE 워드마크. 브랜드 로고(01번)처럼 얇은 직선 획으로 그립니다.
// A는 가로획이 없고, 두 Z에는 가운데를 지나는 짧은 가로 막대가 있습니다(층과 층 사이의 메자닌).
const H = 100;
const GAP = 46;
const LETTERS = {
  M: { w: 104, d: (x) => `M${x},${H}V0L${x + 52},72L${x + 104},0V${H}` },
  E: { w: 60, d: (x) => `M${x + 60},0H${x}V${H}H${x + 60}M${x},50H${x + 52}` },
  Z: { w: 72, d: (x) => `M${x},0H${x + 72}L${x},${H}H${x + 72}M${x + 8},50H${x + 64}` },
  A: { w: 88, d: (x) => `M${x},${H}L${x + 44},4L${x + 88},${H}` },
  N: { w: 76, d: (x) => `M${x},${H}V0L${x + 76},${H}V0` },
  I: { w: 0, d: (x) => `M${x},0V${H}` },
};

function build(word) {
  let x = 0;
  const parts = [];
  for (const ch of word) {
    const L = LETTERS[ch];
    parts.push(L.d(x));
    x += L.w + GAP;
  }
  return { d: parts.join(''), w: x - GAP };
}

const MARK = build('MEZZANINE');

// stroke: 획 두께(글자 높이 100 기준)
export function wordmark({ cls = 'wm', stroke = 5.5, title = 'MEZZANINE' } = {}) {
  const p = stroke / 2 + 1;
  return `<svg class="${cls}" viewBox="${-p} ${-p} ${MARK.w + p * 2} ${H + p * 2}" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg"><path d="${MARK.d}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linejoin="miter" stroke-miterlimit="2.6" stroke-linecap="butt"/></svg>`;
}

export const WORDMARK_PATH = MARK;
