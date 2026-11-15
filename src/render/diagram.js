import { esc } from '../util.js';

// 지점의 건물·층 구성을 단면도로 그립니다. 사진이 없어도 공간 규모와 연결 구조가 한눈에 보이게 하는 그림입니다.
const W = 760;
const H = 440;
const G = 300; // 지면 높이
const FH = 66; // 지상층 높이
const BH = 56; // 지하층 높이
const RH = 30; // 루프탑 표시 높이
const GAP = 70;

const floorNo = (f) => parseInt(f, 10) || 0;

function widthOf(b) {
  if (b.wide) return 440;
  const mx = Math.max(0, ...b.floors.map((f) => f.area || 0));
  return mx ? Math.round(70 + Math.sqrt(mx) * 13) : 150;
}

export function sectionSVG(venue) {
  const blds = venue.buildings || [];
  const label = `${venue.name} 건물 구성 단면도`;
  if (!blds.length) return placeholderSVG(venue, label);

  const widths = blds.map(widthOf);
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (blds.length - 1);
  let x = Math.round((W - total) / 2);
  const cols = blds.map((b, i) => {
    const o = { b, x, w: widths[i] };
    x += widths[i] + GAP;
    return o;
  });

  let out = '';
  let minTop = G;
  let maxBottom = G + 16;
  const x0 = cols[0].x - 36;
  const x1 = cols[cols.length - 1].x + cols[cols.length - 1].w + 36;
  // 지면
  out += `<rect class="sd-earth" x="${x0}" y="${G}" width="${x1 - x0}" height="10"/>`;
  out += `<line class="sd-ground" x1="${x0}" y1="${G}" x2="${x1}" y2="${G}"/>`;

  // 메자닌(2층 연결)
  let linkLabelDone = false;
  if (venue.linked) {
    for (let i = 0; i < cols.length - 1; i++) {
      const a = cols[i];
      const c = cols[i + 1];
      const has2 = (o) => o.b.floors.some((f) => f.f === '2F' && !f.ghost);
      if (!has2(a) || !has2(c)) continue;
      const y = G - 2 * FH + 26;
      out += `<rect class="sd-link" x="${a.x + a.w}" y="${y}" width="${c.x - a.x - a.w}" height="14"/>`;
      if (!linkLabelDone) {
        out += `<text class="sd-linklabel" x="${a.x + a.w + (c.x - a.x - a.w) / 2}" y="${y - 10}" text-anchor="middle">메자닌</text>`;
        linkLabelDone = true;
      }
    }
  }
  if (venue.courtyard && cols.length > 1) {
    const a = cols[0];
    const c = cols[1];
    out += `<text class="sd-note" x="${a.x + a.w + (c.x - a.x - a.w) / 2}" y="${G - 12}" text-anchor="middle">중정</text>`;
  }

  for (const { b, x: bx, w } of cols) {
    const above = b.floors.filter((f) => /^\d+F$/.test(f.f)).sort((p, q) => floorNo(p.f) - floorNo(q.f));
    const below = b.floors.filter((f) => /^B\d/.test(f.f)).sort((p, q) => floorNo(p.f.slice(1)) - floorNo(q.f.slice(1)));
    const roof = b.floors.find((f) => f.f === 'RT');
    let top = G - above.length * FH;

    const cell = (f, y, h, cls) => {
      const name = `${b.name} ${f.f === 'RT' ? '루프탑' : f.f}${f.area ? ` · ${f.area}평` : ''}`;
      const interactive = !f.ghost;
      let s = `<g class="sd-floor ${cls}${f.ghost ? ' is-ghost' : ''}"${interactive ? ` tabindex="0" role="button" data-name="${esc(name)}" data-desc="${esc(f.desc || '')}"` : ''}>`;
      s += `<title>${esc(name)}${f.desc ? ` — ${esc(f.desc)}` : ''}</title>`;
      s += `<rect x="${bx}" y="${y}" width="${w}" height="${h}"/>`;
      s += `<text class="sd-f" x="${bx + 14}" y="${y + h / 2 + 6}">${f.f === 'RT' ? '루프탑' : esc(f.f)}</text>`;
      if (f.area) s += `<text class="sd-a" x="${bx + w - 14}" y="${y + h / 2 + 6}" text-anchor="end">${f.area}평</text>`;
      s += '</g>';
      return s;
    };

    above.forEach((f, i) => {
      out += cell(f, G - (i + 1) * FH, FH, 'is-above');
    });
    if (roof) {
      top -= RH;
      out += cell(roof, top, RH, 'is-roof');
    }
    below.forEach((f, j) => {
      const y = G + j * BH;
      out += cell(f, y, BH, 'is-below');
      maxBottom = Math.max(maxBottom, y + BH + 14);
      if (f.dim) {
        const dy = y + BH + 24;
        maxBottom = Math.max(maxBottom, dy + 34);
        out += `<line class="sd-dim" x1="${bx}" y1="${dy}" x2="${bx + w}" y2="${dy}"/>`;
        out += `<line class="sd-dim" x1="${bx}" y1="${dy - 6}" x2="${bx}" y2="${dy + 6}"/>`;
        out += `<line class="sd-dim" x1="${bx + w}" y1="${dy - 6}" x2="${bx + w}" y2="${dy + 6}"/>`;
        out += `<text class="sd-dimlabel" x="${bx + w / 2}" y="${dy + 22}" text-anchor="middle">${esc(f.dim)}</text>`;
      }
    });
    out += `<text class="sd-bname" x="${bx}" y="${top - 14}">${esc(b.name)}${b.total ? ` <tspan class="sd-btotal">${b.total}평</tspan>` : ''}</text>`;
    minTop = Math.min(minTop, top - 44);
  }

  return `<svg class="sd" viewBox="${x0} ${minTop} ${x1 - x0} ${maxBottom - minTop}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

function placeholderSVG(venue, label) {
  const boxes = [
    [150, 168, 160, 132],
    [380, 168, 130, 132],
    [580, 102, 110, 198],
  ];
  let out = `<rect class="sd-earth" x="100" y="${G}" width="560" height="10"/><line class="sd-ground" x1="100" y1="${G}" x2="660" y2="${G}"/>`;
  for (const [bx, by, bw, bh] of boxes) if (bw) out += `<rect class="sd-soon" x="${bx}" y="${by}" width="${bw}" height="${bh}"/>`;
  out += `<text class="sd-soonlabel" x="${W / 2}" y="${G + 62}" text-anchor="middle">${esc(venue.name)} 오픈 준비 중</text>`;
  return `<svg class="sd" viewBox="60 60 640 330" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}
