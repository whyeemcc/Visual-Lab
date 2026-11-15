(() => {
  const icons={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book:'<path d="M12 5.5C9 3.5 5 3.4 2.5 4.8v14c3-1.3 6.6-1.1 9.5 1 2.9-2.1 6.5-2.3 9.5-1v-14C18.5 3.4 15 3.5 12 5.5Z"/><path d="M12 6v13"/>',
    sun:'<circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5m0-14.2-1.5 1.5M6.4 17.6l-1.5 1.5"/>',
    moon:'<path d="M20 15.2A8.6 8.6 0 0 1 8.8 4 8.6 8.6 0 1 0 20 15.2Z"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>', external:'<path d="M6 18 18 6M7 6h11v11"/>',
    wave:'<path d="M2 15h5V7h7v10h5v-6h3"/>', layers:'<path d="m3 8 9-5 9 5-9 5-9-5Zm1 5 8 4 8-4M4 17l8 4 8-4"/>',
    chip:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',
    cap:'<path d="M3 12h6m0-7v14m6-14v14m0-7h6"/>', adjustments:'<path d="M3 6h5m6 0h7M3 12h11m6 0h1M3 18h2m6 0h10"/><circle cx="11" cy="6" r="2.5"/><circle cx="17" cy="12" r="2.5"/><circle cx="8" cy="18" r="2.5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
    reset:'<path d="M3 10a9 9 0 1 1 1 7M3 5v5h5"/>', play:'<path d="m7 4 13 8-13 8Z"/>', pause:'<path d="M8 5v14m8-14v14"/>',
    plus:'<path d="M12 5v14m-7-7h14"/>', minus:'<path d="M5 12h14"/>', fit:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
    down:'<path d="m6 9 6 6 6-6"/>', chevron:'<path d="m9 5 7 7-7 7"/>', back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
    save:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>', bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
    cursor:'<path d="M12 3v18m-5-13 5 5 5-5"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>'
  };
  const icon=(n,s=16)=>'<svg aria-hidden="true" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(icons[n]||'')+'</svg>';
  window.InverterUI={icon};
  const root=document.body.dataset.root || './';
  const header=document.querySelector('header');
  const isHome=document.body.dataset.page==='home';
  header.innerHTML='<div class="bar wrap"><a class="brand" href="'+root+'index.html"><img width="34" height="34" src="'+root+'assets/identity.svg" alt="">Inverter Chain</a><nav aria-label="主导航"><a class="navlink '+(isHome?'active':'')+'" href="'+root+'index.html">'+icon('grid')+'实验目录</a><button class="navlink" data-guide>'+icon('book')+'模型手册</button><span class="navrule"></span><button class="iconbtn" id="theme" aria-label="切换配色"></button></nav></div>';
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon,Number(el.dataset.size)||16));
  let night=false;
  try{night=localStorage.getItem('phase-theme')==='dark';}catch{}
  function theme(){document.documentElement.dataset.theme=night?'dark':'light';const btn=document.querySelector('#theme');btn.innerHTML=icon(night?'moon':'sun',19);btn.title=night?'切换为浅色':'切换为深色';btn.setAttribute('aria-label',btn.title);}
  theme();document.querySelector('#theme').onclick=()=>{night=!night;theme();try{localStorage.setItem('phase-theme',night?'dark':'light')}catch{}};
  const dialog=document.createElement('dialog');
  dialog.innerHTML='<div class="dialogtop"><div><div class="overline">MODEL NOTES</div><h2>模型手册</h2></div><button class="iconbtn" aria-label="关闭手册">'+icon('close',19)+'</button></div>'+
    '<div class="guidebody"><h3>节点如何充放电</h3><p>PMOS 将输出接向电源，NMOS 将输出接向地。每级输出的净电流决定其电压变化速度。</p><div class="equation">Cᵢ · dVᵢ/dt = Iₚ − Iₙ</div><p>求解器按长沟道 MOS 平方律计算截止、线性区和饱和区的漏电流。阈值幅值固定为 0.32 V。对 NMOS，令 u = VGS − VT、v = VDS；PMOS 使用 VSG、VSD 和阈值幅值。</p><div class="equation small">u ≤ 0: I = 0<br>0 ≤ v &lt; u: I = β(uv − v²/2)<br>v ≥ u &gt; 0: I = βu²/2</div>'+
    '<h3>延迟与负载</h3><p>NMOS / PMOS 延迟是在 1.2 V、4 fF 参考条件下，理想阶跃输入后，输出下降 / 上升至 50% 电源电压所需的时间。模型由此校准各管驱动系数 β。实际延迟随电源、负载和输入斜率变化。</p><p>导线电阻为零，相邻级的 OUT 和 IN 共享同一电位。每级有 2 fF 漏端寄生；连接下一级时再加 2 fF 栅负载。可选负载电容只接在级间节点，末级仅保留漏端寄生。</p>'+
    '<h3>数值求解与测量</h3><p>初始状态由直流电流平衡给出，随后用四阶 Runge–Kutta 同步积分各级电压。步长受最快节点时间常数限制，每个激励转折点都落在步边界。波形与测量共用同一组数值解。</p><p>传播延迟按相邻输入、输出的 50% VDD 交叉时刻计量，分别对匹配的上升、下降事件取平均。在输入边沿开始变化后、下一次输入穿越前，匹配首次反向输出穿越。慢输入可能使输出先于输入穿越半电源电压，此时保留负时差。未配对的事件不参与平均。</p>'+
    '<h3>适用范围</h3><p>适合观察电容充放电、边沿不对称和窄脉冲衰减。模型采用恒定电容，省略沟道长度调制、亚阈值漏电、米勒耦合、温度与工艺角效应。工艺级时序验证需使用 PDK 和 SPICE。</p><a class="textlink" href="https://ocw.mit.edu/courses/6-012-microelectronic-devices-and-circuits-fall-2009/c5d77f1bbdd91687cf4173d3de2c6574_MIT6_012F09_lec15_cmos.pdf" target="_blank" rel="noreferrer">参考资料 · MIT 6.012 CMOS Gate Delays '+icon('external',14)+'</a></div>';
  document.body.append(dialog);
  document.querySelectorAll('[data-guide]').forEach(b=>b.addEventListener('click',()=>dialog.showModal()));
  dialog.querySelector('button').onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
})();
