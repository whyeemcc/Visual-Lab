/* The section magnifies a finite region around x = 0. Coordinates shared with
   the profile plots are in micrometres; symbols denote species, not counts. */
(() => {
  'use strict';
  const hosts = new Map();
  let sequence = 0;
  let lastPosition = null;
  const pColor = '#ac493c', nColor = '#146d67';
  const limit = (value, low, high) => Math.min(high, Math.max(low, value));

  function distance(value) {
    return value < 0.1 ? (value * 1000).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) + ' nm'
      : value.toLocaleString('zh-CN', { maximumFractionDigits: 3 }) + ' µm';
  }

  function density(value) {
    const [coefficient, exponent] = value.toExponential(1).split('e');
    const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const power = String(Number(exponent)).replace(/\d/g, digit => superscripts[digit]).replace('-', '⁻');
    return Number(coefficient) + ' × 10' + power + ' cm⁻³';
  }

  function species(id, name, x, y) {
    return '<use href="#' + id + '-' + name + '" x="' + x + '" y="' + y + '"/>';
  }

  function neutralCarriers(id, type, start, end, doping) {
    const w = end - start;
    if (w < 13) return '';
    const spacing = limit(32 - 2 * (Math.log10(doping) - 16), 23, 38);
    const columns = Math.max(1, Math.floor(w / spacing));
    let result = '';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < columns; col++) {
        const shift = 0.16 * Math.sin(12 * row + 3 * col + 1);
        const x = start + (col + 0.5 + shift) * w / columns;
        const y = 90 + 25 * row + 3 * Math.sin(col * 5 + row);
        result += species(id, type, x.toFixed(2), y.toFixed(2));
      }
    }
    return result;
  }

  function fixedIons(id, type, start, end) {
    const w = end - start;
    if (w < 10) return '';
    const cols = Math.max(1, Math.min(3, Math.floor(w / 23)));
    let result = '';
    for (let col = 0; col < cols; col++) {
      const x = start + (col + 0.5) * w / cols;
      for (const y of [89, 115, 141]) result += species(id, type, x.toFixed(2), y);
    }
    return result;
  }

  function symbolDefinitions(id) {
    return '<defs>' +
      '<pattern id="' + id + '-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#769085" opacity=".35"/></pattern>' +
      '<pattern id="' + id + '-metal" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(34)"><rect width="5" height="5" fill="#73867f"/><path d="M0 0 V5" stroke="#b1bfb6" stroke-width="1.6"/></pattern>' +
      '<g id="' + id + '-hole"><circle r="5.6" fill="#fff7ed" stroke="' + pColor + '" stroke-width="1.6"/><path d="M-2.6 0h5.2 M0 -2.6v5.2" stroke="' + pColor + '" stroke-width="1.1"/></g>' +
      '<g id="' + id + '-electron"><circle r="5.4" fill="' + nColor + '"/><path d="M-2.5 0h5" stroke="#fff" stroke-width="1.5"/></g>' +
      '<g id="' + id + '-acceptor"><rect x="-4.5" y="-4.5" width="9" height="9" rx="1.3" fill="#fff6ed" stroke="' + pColor + '"/><path d="M-2.5 0h5" stroke="' + pColor + '" stroke-width="1.2"/></g>' +
      '<g id="' + id + '-donor"><rect x="-4.5" y="-4.5" width="9" height="9" rx="1.3" fill="#f3fbf5" stroke="' + nColor + '"/><path d="M-2.6 0h5.2 M0 -2.6v5.2" stroke="' + nColor + '" stroke-width="1.1"/></g></defs>';
  }

  function crossSection(record, width) {
    const { id, options, op, device } = record;
    const formed = options.formed !== false;
    const mid = width / 2, left = 24, right = width - left;
    const positiveEdge = op.xn, negativeEdge = -op.xp;
    // Use the equilibrium W as a reference so a bias sweep visibly changes W.
    const referenceW = window.DiodePhysics.at(device, 0).w;
    record.extent = Math.max(referenceW * 1.35, Math.max(op.xp, op.xn) * 1.28, 0.001);
    const scale = (mid - left) / record.extent;
    const pEdge = mid + scale * negativeEdge, nEdge = mid + scale * positiveEdge;
    const gap = formed ? 0 : Math.min(20, width * 0.048);
    const pEnd = mid - gap, nStart = mid + gap;
    const band = (x, w, fill) => '<rect x="' + x + '" y="73" width="' + w + '" height="84" fill="' + fill + '"/>';
    let material = band(left, pEnd - left, '#f2d2bc') + band(nStart, right - nStart, '#b6dcd0');
    if (formed) material += band(pEdge, Math.max(0, mid - pEdge), '#f8eee0') + band(mid, Math.max(0, nEdge - mid), '#e6eee3');
    material += band(left, pEnd - left, 'url(#' + id + '-dots)') + band(nStart, right - nStart, 'url(#' + id + '-dots)');
    for (const [x, w, stroke] of [[left, pEnd - left, '#c78f72'], [nStart, right - nStart, '#77a99c']]) {
      material += '<rect x="' + x + '" y="73" width="' + w + '" height="84" fill="none" stroke="' + stroke + '"/>';
    }
    material += neutralCarriers(id, 'hole', left + 3, (formed ? pEdge : pEnd) - 2, device.na);
    material += neutralCarriers(id, 'electron', (formed ? nEdge : nStart) + 2, right - 3, device.nd);
    if (formed) {
      material += fixedIons(id, 'acceptor', pEdge, mid) + fixedIons(id, 'donor', mid, nEdge);
      material += '<path d="M' + pEdge + ' 66v98 M' + nEdge + ' 66v98" stroke="#80673f" stroke-width="1" stroke-dasharray="3 4" fill="none"/>';
      material += '<path d="M' + mid + ' 64v101" stroke="#3d4a43" opacity=".65" stroke-dasharray="2 3"/>';
    }
    const cap = x => '<rect x="' + x + '" y="72" width="7" height="86" rx="1" fill="url(#' + id + '-metal)"/>';
    const electrodes = '<path d="M5 115H' + left + ' M' + right + ' 115h19" stroke="#57665f" stroke-width="2"/>' + cap(left - 7) + cap(right);
    let measure = '';
    if (formed) {
      const center = (pEdge + nEdge) / 2;
      measure = '<path d="M' + pEdge + ' 169v8 m0 -4H' + nEdge + ' m0 -4v8" fill="none" stroke="#786342"/>' +
        '<text x="' + limit(center, 65, width - 65) + '" y="194" text-anchor="middle" font-size="12" fill="#675434">耗尽宽度 ' + distance(op.w) + '</text>';
      const arrowTip = mid - 16;
      if (!op.flatBand) measure += '<g fill="#52665c" stroke="#52665c"><path d="M' + (mid + 16) + ' 53 h-32" fill="none" stroke-width="1.6"/>' +
        '<path d="M' + arrowTip + ' 53 l6 -3 v6z"/></g><text x="' + mid + '" y="42" text-anchor="middle" font-size="11" fill="#52665c">电场 E</text>';
    } else {
      measure = '<text x="' + mid + '" y="185" text-anchor="middle" font-size="12" fill="#57665f">两块材料分离，各自保持电中性</text>';
    }
    return '<svg viewBox="0 0 ' + width + ' 207" style="display:block;width:100%;height:auto;font-family:inherit" role="img" aria-label="' +
      (formed ? 'PN 结截面。P 区在左侧，N 区在右侧。耗尽层宽度 ' + distance(op.w) + (op.flatBand ? '，已达平带近似边界。' : '，结内电场由 N 指向 P。') : '尚未接触的 P 型与 N 型硅。') + '">' +
      symbolDefinitions(id) +
      '<g fill="' + pColor + '"><text x="' + left + '" y="30" font-size="17" font-weight="650">P 型硅</text><text x="' + left + '" y="51" font-size="11">' + density(device.na) + '</text></g>' +
      '<g fill="' + nColor + '" text-anchor="end"><text x="' + right + '" y="30" font-size="17" font-weight="650">N 型硅</text><text x="' + right + '" y="51" font-size="11">' + density(device.nd) + '</text></g>' +
      material + electrodes + measure +
      '<g data-position-marker visibility="hidden" pointer-events="none"><path d="M0 67v94" stroke="#375ac1" stroke-width="1.6"/><path d="M-4 64 h8l-4 5z" fill="#375ac1"/></g></svg>';
  }

  function legend(formed) {
    const items = [
      ['+', '空穴', pColor, '50%', '#fff7ed'], ['−', '电子', '#fff', '50%', nColor],
      ...(formed ? [['−', '固定受主', pColor, '2px', '#fff6ed'], ['+', '固定施主', nColor, '2px', '#f3fbf5']] : [])
    ];
    return '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:5px 14px;font-size:12px;color:#485c52">' +
      items.map(([sign, text, color, radius, bg]) => '<span style="display:inline-flex;align-items:center;gap:5px"><b aria-hidden="true" style="display:inline-grid;place-items:center;border:1px solid ' +
        (text === '电子' ? nColor : color) + ';border-radius:' + radius + ';background:' + bg + ';color:' + color +
        ';font:600 12px/1 system-ui;width:14px;height:14px">' + sign + '</b>' + text + '</span>').join('') + '</div>' +
      '<div style="text-align:center;font-size:11px;color:#62756a;margin-top:5px">粒子符号仅标识种类</div>';
  }

  function flow(options) {
    const motion = options.direction === 'motion';
    const selection = options.carrier || 'both';
    let rows = '';
    for (const [type, label, color] of [['electron', '电子', nColor], ['hole', '空穴', pColor]]) {
      if (selection !== 'both' && type !== selection) continue;
      const reversed = motion && type === 'electron';
      const glyph = startsRight => startsRight ? '←' : '→';
      const arrow = (label, show, right) => show ? '<span><strong style="font-size:18px;color:' + color + '">' + glyph(right) + '</strong> ' + label + '</span>' : '';
      rows += '<div style="display:flex;align-items:baseline;justify-content:center;gap:13px"><b style="color:' + color + '">' + label + (motion ? '运动' : '电流') + '</b>' +
        arrow('扩散', options.diffusion !== false, reversed) + arrow('漂移', options.drift !== false, !reversed) + '</div>';
    }
    return '<div style="display:grid;gap:2px;padding:9px 4px 0;font-size:12px;color:#43554b">' + rows + '</div>';
  }

  function breakdown(id, device, op) {
    const tunnel = device.tunnelFraction >= 0.5;
    const title = tunnel ? '带间隧穿' : '碰撞电离';
    const detail = tunnel ? '窄势垒使电子可由 P 区价带隧穿至 N 区导带，P 区留下空穴。' : '强电场加速载流子。碰撞产生的电子、空穴再次加速，可引起雪崩倍增。';
    const numbers = op.vj < 0 ? '当前反偏 ' + Math.abs(op.vj).toFixed(2) + ' V' : '当前未反偏';
    const sketch = tunnel
      ? '<path d="M10 15H61 L98 47H145 M10 43H61 L98 75H145" fill="none" stroke="#647c70" stroke-width="2"/><path d="M44 44h64 m-4 -3l5 3 -5 3" fill="none" stroke="' + nColor + '" stroke-dasharray="4 2"/>' + species(id, 'hole', 38, 43) + species(id, 'electron', 119, 47)
      : '<path d="M11 43h51 m-6 -4l6 4 -6 4 M63 42l55 -20 m-7 -2l7 2 -4 6 M63 43l55 19 m-6 -5l6 5 -8 1 M60 44l-27 20 m4 -7l-4 7 8 -1" fill="none" stroke="#6c8775" stroke-width="1.5"/>' + species(id, 'electron', 129, 17) + species(id, 'electron', 129, 67) + species(id, 'hole', 23, 70);
    return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:10px;border-top:1px solid #dce4dc;padding:8px 2px 0">' +
      '<svg style="width:105px;flex:none" viewBox="0 0 155 86" role="img" aria-label="' + title + '机制示意">' + sketch + '</svg>' +
      '<div style="flex:1 1 150px;font-size:12px;color:#4c6055;line-height:1.55"><strong style="color:#314c40">' + title + ' · 机制示意</strong><br>' + detail +
      '<br>' + numbers + '，模型击穿电压 ' + device.bv.toFixed(2) + ' V。</div></div>';
  }

  function paint(host, record) {
    const width = Math.max(260, Math.min(800, Math.round(host.getBoundingClientRect().width) || 520));
    record.width = width;
    const { formed, lesson } = record.options;
    host.innerHTML = crossSection(record, width) + legend(formed !== false) +
      (Number(lesson) === 2 && formed !== false ? flow(record.options) : '') +
      (Number(lesson) === 9 && formed !== false ? breakdown(record.id, record.device, record.op) : '');
    mark(host, record);
  }

  function mark(host, record) {
    const marker = host.querySelector('[data-position-marker]');
    if (!marker) return;
    const x = record.options.cursor ?? lastPosition;
    const visible = Number.isFinite(x) && Math.abs(x) <= record.extent && record.options.formed !== false;
    marker.setAttribute('visibility', visible ? 'visible' : 'hidden');
    if (visible) marker.setAttribute('transform', 'translate(' + (record.width / 2 + x * (record.width / 2 - 24) / record.extent) + ' 0)');
  }

  document.addEventListener('diode:position', event => {
    lastPosition = event.detail;
    for (const [host, record] of hosts) {
      record.options.cursor = lastPosition;
      mark(host, record);
    }
  });

  function render(host, settings, op, options = {}) {
    let record = hosts.get(host);
    if (!record) {
      record = { id: 'diode-section-' + (++sequence) };
      hosts.set(host, record);
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          const width = Math.max(260, Math.min(800, Math.round(host.getBoundingClientRect().width) || 520));
          if (record.width !== width) paint(host, record);
        });
        observer.observe(host);
      }
    }
    Object.assign(record, { options: { ...options }, op, device: options.device || window.DiodePhysics.device(settings) });
    paint(host, record);
  }
  window.DiodeDevice = { render };
})();
