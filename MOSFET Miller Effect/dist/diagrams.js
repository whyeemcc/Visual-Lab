/* Three test fixtures. All positions are in the same responsive SVG coordinate system. */
(() => {
  'use strict';
  const ink = '#27483f', gate = '#136858', drain = '#955636', feedback = '#bb7430';
  const muted = '#62756c', paper = '#fbfcf7';
  const ns = 'http://www.w3.org/2000/svg';
  const path = (d, color = ink, extra = '') =>
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' + extra + '/>';
  const label = (x, y, text, color = ink, anchor = 'middle', size = 15) =>
    '<text x="' + x + '" y="' + y + '" fill="' + color + '" font-size="' + size + '" text-anchor="' + anchor + '">' + text + '</text>';
  const dot = (x, y, color = ink) => '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="' + color + '"/>';
  const gnd = (x, y) => path('M' + (x - 10) + ' ' + y + 'h20 m-16 4h12 m-9 4h6');
  function resistor(x, y, vertical = false) {
    return '<g transform="translate(' + x + ',' + y + ')' + (vertical ? ' rotate(90)' : '') + '">' +
      path('M0 0h4l4 -6 6 12 6 -12 6 12 6 -12 4 6h4') + '</g>';
  }
  function cap(x, y, vertical = false, color = ink) {
    return '<g transform="translate(' + x + ',' + y + ')' + (vertical ? ' rotate(90)' : '') + '">' +
      path('M-20 0h17m0 -10v20m6 -20v20m0 -10h17', color) + '</g>';
  }
  function source(x, y, shape, mark) {
    let inner = shape === 'diamond'
      ? '<path d="M0 -19L18 0 0 19 -18 0Z" fill="' + paper + '" stroke="' + ink + '" stroke-width="2"/>'
      : '<circle r="16" fill="' + paper + '" stroke="' + ink + '" stroke-width="2"/>';
    if (mark === 'current') inner += path('M0 -9v16m-4 -6 4 6 4 -6');
    else if (mark === 'pulse') inner += path('M-10 5h5V-6H4V5h6', gate);
    else if (mark === 'sine') inner += path('M-11 0q5 -12 11 0t11 0', gate);
    else inner += label(0,-2,'+',ink,'middle',13) + label(0,12,'−',ink,'middle',13);
    return '<g transform="translate(' + x + ',' + y + ')">' + inner + '</g>';
  }
  function chargeDiagram() {
    const pieces = [
      path('M61 135V77H190'), path('M230 77H340V132'), cap(210,77,false,feedback),
      path('M138 77v46m0 40v42'), cap(138,143,true), gnd(138,205),
      source(61,151,'round','voltage'),path('M61 167v38'),gnd(61,205),
      source(340,151,'diamond','voltage'),path('M340 170v35'),gnd(340,205),
      dot(138,77,gate),dot(340,77,drain),
      label(138,61,'G',gate),label(340,61,'D',drain),label(210,51,'Cgd',feedback),
      label(162,149,'Cgs',ink,'start'),label(37,155,'Δvg',gate,'end'),
      label(314,157,'Av · Δvg',drain,'end')
    ];
    return {name:'增量电压测试。独立电压源驱动栅极，受控电压源将漏极增量设为栅极增量的 Av 倍。', height:232, pieces};
  }
  function acDiagram() {
    const pieces = [
      path('M31 151v-52h22'), resistor(53,99), path('M93 99h45V54h60'),
      cap(218,54,false,feedback),path('M238 54h66v45'),label(218,36,'Cgd',feedback),
      source(31,167,'round','sine'),path('M31 183v27'),gnd(31,210),
      label(18,137,'vsig',gate,'start'),label(73,83,'Rs'),
      dot(138,99,gate),label(128,84,'G',gate),
      path('M138 99v32m0 40v39'),cap(138,151,true),gnd(138,210),label(122,175,'Cgs',ink,'end'),
      path('M208 135V99H385v28'),dot(304,99,drain),label(317,86,'D',drain),
      source(208,154,'diamond','current'),path('M208 173v37'),gnd(208,210),
      label(208,237,'gm · vgs'),
      path('M263 99v32m0 40v39'),dot(263,99),resistor(263,131,true),gnd(263,210),
      label(263,237,'ro'),path('M322 99v32m0 40v39'),dot(322,99),resistor(322,131,true),
      gnd(322,210),label(322,237,'RD'),cap(385,147,true),path('M385 167v43'),gnd(385,210),label(385,237,'CL')
    ];
    return {name:'共源级交流小信号等效电路。源极交流接地，受控电流源由漏流向源。RD、ro 和含 Cds 的输出电容 CL 并接至交流地。', height:255, pieces};
  }
  function switchingDiagram(enabled) {
    const fb = enabled ? feedback : muted;
    const pieces = [
      // The current supplied by the inductive load recirculates through a diode
      // from D back to the bus. Its cathode is the horizontal bar on top.
      path('M235 57V39H351v20'),dot(235,39),label(235,24,'+VBUS',drain),
      source(235,73,'round','current'),path('M235 89v25h116V92'),
      path('M351 59v6m-11 0h22m-11 1 -11 19h22Zm0 19v7'),
      label(209,79,'IL',ink,'end'),label(370,70,'K',muted,'start',13),label(370,93,'A',muted,'start',13),
      dot(235,114,drain),label(252,103,'D',drain),
      // Gate-to-drain path (or open branch when coupling is disabled).
      path('M132 176v-39h28',fb),path('M200 137h35v-23',fb),
      enabled ? cap(180,137,false,fb) : path('M160 137h9m0 0 14 -9m4 9h13',fb),
      label(180,119,enabled?'Cgd':'Cgd 断开',fb),
      path('M235 137v17h-13v8m0 7v7m0 7v8h13v37'),path('M215 156v34m-16 -14h16'),
      path('M235 175h-10m4 -3 -4 3 4 3m6 -3v16'),dot(235,191),label(246,213,'S',ink,'start',13),
      dot(329,114),path('M329 114v48m0 40v26'),cap(329,182,true),gnd(329,228),label(347,187,'Cds',ink,'start'),
      path('M39 191v-15h23'),resistor(62,176),path('M102 176h97'),
      label(82,161,'Rg'),source(39,207,'round','pulse'),path('M39 223v5'),gnd(39,228),
      path('M132 176v4m0 40v8'),cap(132,200,true),gnd(132,228),label(153,208,'Cgs',ink,'start'),
      dot(132,176,gate),label(120,164,'G',gate),gnd(235,228)
    ];
    return {name:'低侧 N 沟道 MOSFET 钳位测试电路。恒流近似的感性负载向 D 供电，续流二极管阳极 A 接 D、阴极 K 接母线。', height:255, pieces};
  }
  function render(host, mode, params = {}) {
    const enabled = params.cgdEnabled !== false;
    const key = mode + '-' + enabled;
    if (host.dataset.millerCircuit === key) return;
    const diagram = mode === 'switch' ? switchingDiagram(enabled) : mode === 'ac' ? acDiagram() : chargeDiagram();
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 420 ' + diagram.height);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', diagram.name);
    svg.style.cssText = 'width:100%;height:auto;max-height:330px;display:block;background:#fbfcf7;font-family:ui-monospace,monospace';
    svg.innerHTML = '<title>' + diagram.name + '</title>' + diagram.pieces.join('');
    host.replaceChildren(svg);
    host.dataset.millerCircuit = key;
  }
  window.MillerDiagrams = {render};
})();
