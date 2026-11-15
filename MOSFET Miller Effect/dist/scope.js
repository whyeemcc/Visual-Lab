/* Input points share an ascending physical x axis. xScale:"log" uses Hz (or
   another positive physical unit); cursors always return physical x values. */
window.MillerScope = (() => {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const finite = Number.isFinite;
  const palette = ['#176956', '#ba6b25', '#496f9a', '#985574', '#668342'];
  let serial = 0;

  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  }
  function number(value, digits = 4) {
    if (!finite(value)) return '—';
    if (!value) return '0';
    const magnitude = Math.abs(value);
    return magnitude < .001 || magnitude >= 1e5
      ? Number(value.toPrecision(digits)).toExponential()
      : String(Number(value.toPrecision(digits)));
  }
  function xValue(value, unit) {
    if (unit === 'Hz') {
      const scale = [['GHz', 1e9], ['MHz', 1e6], ['kHz', 1e3]].find(([,k]) => Math.abs(value) >= k);
      if (scale) return number(value / scale[1]) + ' ' + scale[0];
    }
    return number(value) + (unit ? ' ' + unit : '');
  }
  function niceStep(span, count) {
    const raw = span / count;
    const power = 10 ** Math.floor(Math.log10(raw));
    return ([1, 2, 2.5, 5, 10].find(k => k * power >= raw) || 10) * power;
  }
  function ticks(lo, hi, step) {
    const result = [];
    for (let n = Math.ceil(lo / step - 1e-10); n <= Math.floor(hi / step + 1e-10); n++) {
      result.push(n * step);
    }
    return result;
  }

  function mount(host) {
    const uid = 'miller-scope-' + (++serial);
    const root = document.createElement('div');
    root.className = 'ms-scope';
    root.innerHTML = '<div class="ms-legend"></div><div class="ms-plot"></div>' +
      '<div class="ms-tools"><div class="ms-pick" role="group" aria-label="活动游标"><button type="button" data-cursor="0">游标 A</button><button type="button" data-cursor="1">游标 B</button></div>' +
      '<label class="ms-position"><span>位置</span><input type="range" aria-label="活动游标位置" min="0" max="1000" step="1" value="250"></label>' +
      '<label>视窗 <select aria-label="横轴缩放"><option value="1">全程</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option><option value="16">16×</option><option value="32">32×</option></select></label>' +
      '<button type="button" class="ms-reset">复位游标</button><label class="ms-pan" hidden><span>平移</span><input type="range" aria-label="平移横轴" min="0" max="1000" step="1"></label></div>' +
      '<div class="ms-readout"></div>';
    host.replaceChildren(root);
    const legend = root.querySelector('.ms-legend');
    const plot = root.querySelector('.ms-plot');
    const readout = root.querySelector('.ms-readout');
    const slider = root.querySelector('.ms-position input');
    const zoomSelect = root.querySelector('select');
    const panLabel = root.querySelector('.ms-pan');
    const panSlider = panLabel.querySelector('input');
    const cursors = root.querySelectorAll('[data-cursor]');
    let cfg, domain, windowX, layout, points, series, zoom = 1, offset = 0;
    let active = 0, positions = [0, 1], gesture, measuredWidth;
    const toAxis = value => cfg.xScale === 'log' ? Math.log10(value) : value;
    const fromAxis = value => cfg.xScale === 'log' ? 10 ** value : value;

    // First sample on or after x. For a repeated timestamp the latest value
    // defines the right limit at the event.
    function firstAt(x) {
      let lo = 0, hi = points.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (points[mid].x < x) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }
    function sample(x) {
      let i = firstAt(x);
      if (i === points.length) return points[i - 1];
      if (points[i].x === x) {
        while (i + 1 < points.length && points[i + 1].x === x) i++;
        return points[i];
      }
      if (i === 0) return points[0];
      const p = points[i - 1], q = points[i];
      const fraction = (toAxis(x) - toAxis(p.x)) / (toAxis(q.x) - toAxis(p.x));
      const result = {x};
      for (const line of series) {
        result[line.key] = finite(p[line.key]) && finite(q[line.key])
          ? p[line.key] + (q[line.key] - p[line.key]) * fraction : null;
      }
      return result;
    }
    function toPixel(axis) {
      return layout.left + (axis - windowX[0]) * (layout.right - layout.left) / (windowX[1] - windowX[0]);
    }
    function refreshCursors(notify = true) {
      const overlay = plot.querySelector('.ms-cursors');
      if (!overlay) return;
      const labels = ['A', 'B'];
      overlay.innerHTML = positions.map((v, i) => {
        const px = toPixel(toAxis(v));
        if (px < layout.left - .01 || px > layout.right + .01) return '';
        const flip = px > layout.right - 13;
        return '<g class="ms-cursor-' + i + '"><path d="M' + px + ' 12V' + layout.bottom +
          '" stroke-dasharray="4 4"/><text x="' + (px + (flip ? -4 : 4)) + '" y="12" text-anchor="' +
          (flip ? 'end' : 'start') + '">' + labels[i] + '</text></g>';
      }).join('');
      const [a, b] = positions;
      const atA = sample(a), atB = sample(b);
      const row = (label, va, vb, diff) => '<tr><th scope="row">' + escape(label) +
        '</th><td>' + escape(va) + '</td><td>' + escape(vb) + '</td><td>' + escape(diff) + '</td></tr>';
      const rows = [row(cfg.xLabel, xValue(a, cfg.xUnit), xValue(b, cfg.xUnit), xValue(b - a, cfg.xUnit))];
      for (const line of series) {
        const va = atA[line.key], vb = atB[line.key];
        rows.push(row(line.label + (line.unit ? ' [' + line.unit + ']' : ''),
          number(va), number(vb), finite(va) && finite(vb) ? number(vb - va) : '—'));
      }
      readout.innerHTML = '<table aria-label="双游标测量"><thead><tr><th scope="col">测量量</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Δ (B − A)</th></tr></thead><tbody>' +
        rows.join('') + '</tbody></table>';
      slider.value = Math.round(clamp((toAxis(positions[active]) - windowX[0]) / (windowX[1] - windowX[0]), 0, 1) * 1000);
      slider.setAttribute('aria-valuetext', labels[active] + ' ' + xValue(positions[active], cfg.xUnit));
      cursors.forEach((b, i) => b.setAttribute('aria-pressed', String(i === active)));
      if (notify && cfg.onCursor) cfg.onCursor({a, b, atA, atB});
    }

    function paint(notify = false) {
      if (!cfg || !points.length) return;
      const width = Math.max(220, Math.round(plot.clientWidth || 580));
      measuredWidth = plot.clientWidth;
      const small = width < 425, left = small ? 46 : 55, right = width - (small ? 10 : 15);
      const panelH = cfg.rows.length === 1 ? 157 : small ? 88 : 103;
      const track = panelH + 39, top = 35;
      const bottom = top + track * (cfg.rows.length - 1) + panelH;
      layout = {width, left, right, bottom, height:bottom + 46};
      const extent = domain[1] - domain[0], span = extent / zoom;
      const start = domain[0] + offset * (extent - span);
      windowX = [start, start + span];
      const minX = fromAxis(start), maxX = fromAxis(start + span);
      const visible = points.slice(firstAt(minX), firstAt(maxX));
      visible.unshift(sample(minX));
      visible.push(sample(maxX));
      let xTicks;
      if (cfg.xScale === 'log' && span > 1.8) {
        xTicks = ticks(start, start + span, Math.max(1, Math.ceil(span / (small ? 3 : 6))));
      } else {
        xTicks = ticks(start, start + span, niceStep(span, small ? 3 : 5));
      }
      if (xTicks.length < 2) xTicks = [start, start + span];
      const svg = ['<svg role="img" aria-label="' + escape(cfg.rows.map(row => row.label).join('，')) +
        '" viewBox="0 0 ' + width + ' ' + layout.height + '" xmlns="http://www.w3.org/2000/svg">'];
      cfg.rows.forEach((group, rowIndex) => {
        const y0 = top + track * rowIndex, y1 = y0 + panelH;
        let lo = Infinity, hi = -Infinity;
        for (const p of visible) for (const line of group.series) {
          const y = p[line.key];
          if (finite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
        }
        if (!finite(lo)) {lo = 0; hi = 1;}
        const margin = hi > lo ? (hi - lo) * .055 : Math.abs(hi) * .08 || .5;
        lo = finite(group.min) ? group.min : lo - margin;
        hi = finite(group.max) ? group.max : hi + margin;
        if (hi <= lo) hi = lo + margin;
        const fy = v => y1 - (v - lo) / (hi - lo) * panelH;
        const clip = uid + '-clip-' + rowIndex;
        svg.push('<defs><clipPath id="' + clip + '"><rect x="' + left + '" y="' + y0 +
          '" width="' + (right - left) + '" height="' + panelH + '"/></clipPath></defs>');
        svg.push('<text class="ms-axis-title" x="' + left + '" y="' + (y0 - 8) + '">' + escape(group.label) +
          (group.unit ? ' [' + escape(group.unit) + ']' : '') + '</text>');
        if (cfg.band && finite(cfg.band.from) && finite(cfg.band.to)) {
          const low = clamp(toPixel(toAxis(Math.min(cfg.band.from, cfg.band.to))), left, right);
          const high = clamp(toPixel(toAxis(Math.max(cfg.band.from, cfg.band.to))), left, right);
          if (high > low) svg.push('<rect x="' + low + '" y="' + y0 + '" width="' + (high - low) +
            '" height="' + panelH + '" fill="#f2dfb4" opacity=".55"/>');
        }
        for (const y of ticks(lo, hi, niceStep(hi - lo, small ? 2.8 : 3.6))) {
          svg.push('<path class="ms-grid" d="M' + left + ' ' + fy(y) + 'H' + right +
            '"/><text class="ms-tick" text-anchor="end" x="' + (left - 5) + '" y="' + (fy(y) + 3) + '">' +
            number(y, 3) + '</text>');
        }
        for (const axis of xTicks) {
          const x = toPixel(axis);
          svg.push('<path class="ms-grid ms-vertical" d="M' + x + ' ' + y0 + 'V' + y1 + '"/>');
          if (rowIndex === cfg.rows.length - 1) {
            const text = cfg.xScale === 'log' ? xValue(fromAxis(axis), cfg.xUnit) : number(fromAxis(axis), 3);
            svg.push('<text class="ms-tick" text-anchor="' + (x < left + 12 ? 'start' : x > right - 15 ? 'end' : 'middle') +
              '" x="' + x + '" y="' + (bottom + 16) + '">' + text + '</text>');
          }
        }
        for (const line of group.series) {
          const d = [];
          let move = true;
          for (const p of visible) {
            if (!finite(p[line.key])) {move = true; continue;}
            d.push((move ? 'M' : 'L') + toPixel(toAxis(p.x)).toFixed(2) + ' ' + fy(p[line.key]).toFixed(2));
            move = false;
          }
          svg.push('<path clip-path="url(#' + clip + ')" d="' + d.join('') +
            '" stroke="' + escape(line.color) + '" fill="none" stroke-width="2.2" stroke-linejoin="round"' +
            (line.dash ? ' stroke-dasharray="5 4"' : '') + '/>');
        }
      });
      svg.push('<text class="ms-axis-title" text-anchor="middle" x="' + (left + right) / 2 +
        '" y="' + (bottom + 36) + '">' + escape(cfg.xLabel) +
        (cfg.xUnit ? ' [' + escape(cfg.xUnit) + ']' : '') + '</text><g class="ms-cursors"></g></svg>');
      plot.innerHTML = svg.join('');
      zoomSelect.value = zoom;
      panLabel.hidden = zoom === 1;
      panSlider.value = Math.round(offset * 1000);
      refreshCursors(notify);
    }

    function setCursor(axis) {
      positions[active] = fromAxis(clamp(axis, windowX[0], windowX[1]));
      refreshCursors();
    }
    function pointerPoint(e) {
      const bounds = plot.getBoundingClientRect();
      return {x:(e.clientX - bounds.left) * layout.width / bounds.width,
        y:(e.clientY - bounds.top) * layout.height / bounds.height};
    }
    function onMove(e) {
      if (!gesture || gesture.id !== e.pointerId) return;
      const {x} = pointerPoint(e), gap = layout.right - layout.left;
      if (gesture.pan) {
        offset = clamp(gesture.offset + (gesture.x - x) / (gap * (zoom - 1)), 0, 1);
        paint();
      } else setCursor(windowX[0] + (x - layout.left) * (windowX[1] - windowX[0]) / gap);
    }
    plot.addEventListener('pointerdown', e => {
      if (!layout || e.button !== 0) return;
      const {x, y} = pointerPoint(e);
      if (x < layout.left || x > layout.right) return;
      if (y > layout.bottom && zoom === 1) return;
      const pan = y > layout.bottom;
      if (pan) plot.classList.add('ms-panning');
      if (!pan) {
        const other = 1 - active;
        if (Math.abs(toPixel(toAxis(positions[other])) - x) < 10 &&
          Math.abs(toPixel(toAxis(positions[active])) - x) >= 10) active = other;
      }
      plot.setPointerCapture(e.pointerId);
      gesture = {id:e.pointerId, x, pan, offset};
      onMove(e);
    });
    plot.addEventListener('pointermove', onMove);
    plot.addEventListener('lostpointercapture', () => {gesture = null; plot.classList.remove('ms-panning');});
    cursors.forEach((b,i) => b.addEventListener('click', () => {active = i; refreshCursors();}));
    slider.addEventListener('input', () => setCursor(windowX[0] + Number(slider.value) / 1000 * (windowX[1] - windowX[0])));
    zoomSelect.addEventListener('change', () => {
      zoom = Number(zoomSelect.value);
      const span = (domain[1] - domain[0]) / zoom;
      offset = zoom === 1 ? 0 : clamp((toAxis(positions[active]) - span/2 - domain[0]) / (domain[1] - domain[0] - span), 0, 1);
      paint();
    });
    panSlider.addEventListener('input', () => {offset = +panSlider.value / 1000; paint();});
    const observer = window.ResizeObserver && new ResizeObserver(() => {
      if (plot.clientWidth !== measuredWidth) paint();
    });
    if (observer) observer.observe(plot);

    function resetSelection() {
      active = 0; zoom = 1; offset = 0;
      positions = [0,1].map((_,i) => finite(cfg.cursors?.[i]) ? cfg.cursors[i]
        : fromAxis(domain[0] + (.25 + i*.50) * (domain[1] - domain[0])));
    }
    function resetCursors() {
      if (!cfg) return;
      resetSelection();
      paint(true);
    }
    root.querySelector('.ms-reset').addEventListener('click', resetCursors);
    function render(next) {
      const reset = !cfg || cfg.id !== next.id || cfg.xScale !== next.xScale;
      points = next.points;
      let index = 0;
      cfg = {...next, rows:next.rows.map(group => ({...group, series:group.series.map(line => {
        const color = palette[(index++) % palette.length];
        return {...line, color:line.color || color, unit:group.unit || ''};
      })}))};
      series = cfg.rows.flatMap(group => group.series);
      if (!points?.length || !cfg.rows.length) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      domain = [toAxis(points[0].x), toAxis(points[points.length - 1].x)];
      if (domain[0] === domain[1]) domain[1] = domain[0] + 1;
      if (reset) resetSelection();
      positions = positions.map(v => clamp(v, fromAxis(domain[0]), fromAxis(domain[1])));
      legend.innerHTML = series.map(line => '<span><i style="border-color:' + escape(line.color) +
        (line.dash ? ';border-top-style:dashed' : '') + '"></i>' + escape(line.label) + '</span>').join('') +
        (cfg.band && cfg.band.label ? '<span><i class="ms-band-key"></i>' + escape(cfg.band.label) + '</span>' : '');
      paint(true);
    }
    return {render, resetCursors, destroy(){observer?.disconnect(); root.remove();}};
  }
  return {mount};
})();
