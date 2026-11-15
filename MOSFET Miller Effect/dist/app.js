(() => {
  'use strict';
  const $=id=>document.getElementById(id), P=window.MillerModel, S=window.MillerSwitch;
  const order=['charge','ac','switch'];
  const initial={charge:P.chargeDefaults,ac:P.acDefaults,switch:S.defaults};
  const state=Object.fromEntries(order.map(key=>[key,{...initial[key]}]));
  const lab={
    charge:{
      title:'同一次栅压变化，需要多少电荷？',question:'依次让漏极跟随、保持不动、反向摆动。比较栅漏电压差与驱动源送入的电荷。',
      circuit:'增量电压测试',caption:'源极接地。两个理想激励分别设定栅、漏的增量电压。漏端受控源用来单独考察增益的作用。',
      scope:'节点电压与栅极电荷',controls:['gain','stepV','cgd','cgs'],extra:['tr'],
      heading:'栅漏电容两端都在动',text:'当漏极与栅极等幅同向变化时，栅漏电压差保持恒定。反向变化时，驱动源既要给栅源电容充电，还要承担更大的栅漏电荷变化。等效输入电容可用栅极总电荷变化除以栅压变化求出。',
      method:'本节使用线性电容与规定斜率的电压源。Av 是 ΔVD / ΔVG，两端电压均为工作点附近的变化量。栅极电荷参考值取斜坡开始时的值。该电路隔离了电容机制，不计算偏置与沟道电流。'
    },
    ac:{
      title:'栅漏反馈怎样改变放大器带宽？',question:'增大源电阻或跨导，对照完整电路与输入单极点近似。两条曲线从哪个频段开始分开？',
      circuit:'共源级 · 小信号',caption:'源极为交流地。RD 与 ro 并联，CL 包含漏源电容及外部负载电容。输入源通过 Rs 驱动栅极。',
      scope:'频率响应与输入电容',controls:['rs','gm','cgd','rd'],extra:['ro','cgs','cds'],
      heading:'输入电容取决于栅到漏的增益',text:'共源级在低频反相。栅到漏的增益越大，栅极看到的等效电容通常越大。频率升高后，漏极的增益和相位都会变化，用低频增益折算的单极点模型便可能偏离实际曲线。',
      method:'完整响应在每个频率联立求解栅、漏两节点的复数电流方程。增益曲线为漏极电压与信号源电压之比；计算米勒电容使用漏极与栅极之间的增益。输入等效电容取栅端导纳虚部除以角频率。−3 dB 带宽以低频幅值除以 √2 为判据。小信号参数对应固定偏置，不计源极退化及走线电感。'
    },
    switch:{
      title:'栅压出现平台时，电荷流向哪里？',question:'切换开通与关断，再改变栅电阻。用双游标读出漏压转换时间，观察栅极电流和栅漏支路电流。',
      circuit:'低侧 NMOS · 感性负载',caption:'负载电感在单个边沿内近似为恒流源。续流二极管将漏极钳位在母线，驱动器经 Rg 给栅极充放电。',
      scope:'开关波形与电荷',controls:['rg','vbus','load','vdrive'],extra:['cgd','cgs','cds','vth','k'],
      heading:'米勒平台出现在漏压快速变化的阶段',text:'开通时，沟道先接管负载电流，随后漏压下降。此时一部分栅极电流用于改变栅漏电荷，栅压上升减慢。关断时电荷沿相反方向流动。改变驱动电阻后，对照漏压摆幅、转换时间与平台期间的栅压。',
      method:'求解器在每一步联立栅极电荷守恒、漏极电流平衡、分段平方律沟道和理想钳位二极管。Cgs、Cds 为常数。非线性模式对 Cgd(Vgd) 积分得到支路电荷，再对电荷步进求解。采用归一化经验曲线，未校准具体型号。忽略漏感、反向恢复及温升。'
    }
  };
  // name, unit, min, max, step (pF, kΩ, mS or ns as labelled).
  const specs={
    gain:['漏 / 栅电压增益 Av','V/V',-20,1,.1],stepV:['栅压变化 ΔVG','V',.1,2,.05],tr:['栅压斜坡时间','ns',5,150,1],
    cgs:['栅源电容 Cgs','pF',.5,20,.1],cgd:['栅漏电容 Cgd','pF',0,6,.05],cds:['输出电容 CL','pF',.5,150,.5],
    gm:['跨导 gm','mS',.2,12,.1],rs:['源电阻 Rs','kΩ',.1,100,.1],rd:['漏极电阻 RD','kΩ',.5,15,.1],ro:['输出电阻 ro','kΩ',5,150,1],
    rg:['驱动电阻 Rg','Ω',2,60,.5],vbus:['母线电压','V',12,80,1],load:['负载电流 IL','A',1,8,.1],vdrive:['栅极驱动幅值','V',8,15,.1],
    vth:['阈值电压 Vth','V',1.5,3.5,.05],k:['沟道系数 k','A/V²',2,6,.1]
  };
  const powerCaps={cgs:['栅源电容 Cgs','pF',300,2200,10],cgd:['栅漏参考电容 C₀','pF',20,400,5],cds:['漏源电容 Cds','pF',60,500,5]};
  const palette={green:'#146854',amber:'#a85b23',blue:'#356c9b',grey:'#6b7270',purple:'#845b88'};
  const sub=(v,i)=>'<msub><mi>'+v+'</mi><mi>'+i+'</mi></msub>',cap=k=>sub('C',k),v=k=>sub('V',k);
  const frac=(a,b)=>'<mfrac><mrow>'+a+'</mrow><mrow>'+b+'</mrow></mfrac>';
  const math=content=>'<math xmlns="http://www.w3.org/1998/Math/MathML">'+content+'</math>';
  const inputEq=cap('gs')+'<mo>+</mo>'+cap('gd')+'<mo>(</mo><mn>1</mn><mo>−</mo>'+sub('A','v')+'<mo>)</mo>';
  const formula={
    charge:sub('Q','g')+'<mo>=</mo>'+cap('gs')+v('gs')+'<mo>+</mo>'+cap('gd')+'<mo>(</mo>'+v('g')+'<mo>−</mo>'+v('d')+'<mo>)</mo>',
    ac:sub('C','in,LF')+'<mo>=</mo>'+inputEq,
    switch:sub('i','g')+'<mo>=</mo>'+cap('gs')+frac('<mi>d</mi>'+v('gs'),'<mi>d</mi><mi>t</mi>')+'<mo>+</mo>'+cap('gd')+'<mo>(</mo>'+v('gd')+'<mo>)</mo>'+frac('<mi>d</mi>'+v('gd'),'<mi>d</mi><mi>t</mi>')
  };
  const refs={
    mit:'<a href="https://ocw.mit.edu/courses/6-012-microelectronic-devices-and-circuits-spring-2009/f02902b282fa9614edb6e7d9f9aac464_MIT6_012S09_rec22.pdf" target="_blank" rel="noreferrer">MIT 6.012 · 共源级频率响应与米勒近似 ↗</a>',
    ti:'<a href="https://www.ti.com/lit/ml/slua618a/slua618a.pdf" target="_blank" rel="noreferrer">Texas Instruments · MOSFET 栅极驱动与栅极电荷 ↗</a>'
  };
  const scope=MillerScope.mount($('scope'));
  let mode='charge',switchView='time',approx=true,compare=true,pending=false;
  const sig=(x,n=4)=>Number.isFinite(x)?Number(x.toPrecision(n)).toString():'—';
  const hz=x=>x>=1e9?sig(x/1e9)+' GHz':x>=1e6?sig(x/1e6)+' MHz':x>=1e3?sig(x/1e3)+' kHz':sig(x)+' Hz';
  const series=(key,label,color,dash=false)=>({key,label,color:palette[color],dash});
  const row=(label,unit,...series)=>({label,unit,series});
  function numbers(entries){
    $('readouts').innerHTML=entries.map(([label,value])=>'<div class="readout"><small>'+label+'</small><strong>'+value+'</strong></div>').join('');
  }
  function renderCharge(p){
    const r=P.ramp(p);
    numbers([['漏 / 栅电压增益 Av',sig(p.gain)+' V/V'],['等效输入电容',sig(r.cin)+' pF'],['栅极总电荷变化',sig(r.deltaQ)+' pC'],['斜坡期间的栅电流',sig(r.ig)+' mA']]);
    scope.render({id:'charge',points:r.points,xLabel:'时间',xUnit:'ns',cursors:[0,p.tr],rows:[
      row('节点电压变化','V',series('vg','ΔVG','green'),series('vd','ΔVD','amber')),
      row('栅侧电荷变化','pC',series('qg','总电荷','green'),series('qgd','栅漏支路','amber',true),series('qgs','栅源支路','blue',true))
    ]});
    $('measurementNote').textContent='默认游标位于斜坡两端。用总电荷的 B−A 读数除以栅压的 B−A 读数，可复核上方的等效输入电容。';
  }
  function renderAc(p){
    const r=P.ac(p);
    numbers([['低频栅到漏增益',sig(r.gain)+' V/V'],['低频等效输入电容',sig(r.cin)+' pF'],['完整电路 −3 dB',hz(r.bw)],['输入单极点估算',hz(r.fm)]]);
    const lines=[series('gain','完整电路','green')];
    if(approx)lines.push(series('approx','输入单极点','amber',true));
    if(compare)lines.push(series('noFeedback','断开 Cgd','blue',true));
    scope.render({id:'ac',points:r.points,xLabel:'频率',xUnit:'Hz',xScale:'log',cursors:[r.bw,r.fm],rows:[
      row('源到漏极的幅值增益','dB',...lines),
      row('栅端等效输入电容','pF',series('cin','由栅端导纳提取','green'),series('staticCap','低频值','amber',true))
    ]});
    $('measurementNote').textContent='耦合支路断开时，完整电路带宽为 '+hz(r.noFeedbackBW)+'。输入单极点估算只计入 Rs 与低频等效输入电容，输出极点和前馈零点会造成偏差。';
  }
  function renderSwitch(p){
    const r=S.simulate(p),hasBand=Number.isFinite(r.start)&&Number.isFinite(r.end);
    numbers([['漏压转换时间',sig(r.duration)+' ns'],['转换区平均 VGS',sig(r.plateau)+' V'],['转换区 |ΔQgd|',sig(r.qgd)+' nC'],['平均 dVDS/dt',sig(r.slew)+' V/ns']]);
    const xCharge=switchView==='gate';
    const points=r.samples.map(pt=>({...pt,x:xCharge?Math.abs(pt.qg):pt.t}));
    function getX(t){
      if(!xCharge)return t;
      const j=points.findIndex(item=>item.t>=t);
      if(j<=0)return points[0].x;
      const a=points[j-1],b=points[j];return a.x+(b.x-a.x)*(t-a.t)/(b.t-a.t);
    }
    const band=hasBand?{from:getX(r.start),to:getX(r.end),label:'漏压 10%–90% 转换区'}:undefined;
    const rows=xCharge?[
      row('栅源电压','V',series('vg','VGS','green')),
      row('漏源电压','V',series('vd','VDS','amber')),
      row('瞬时栅漏电容','pF',series('cgd','Cgd(Vgd)','blue'))
    ]:[
      row('栅源电压','V',series('vg','VGS','green')),
      row('漏源电压','V',series('vd','VDS','amber')),
      row('栅极电流','A',series('ig','总栅极电流','green'),series('igd','流入 Cgd 栅侧','amber',true)),
      row('换流过程','A',series('id','沟道电流','blue'),series('diode','续流二极管','purple'))
    ];
    scope.render({id:'switch-'+switchView+'-'+p.edge,points,xLabel:xCharge?'从边沿开始的栅极电荷变化幅值':'时间',xUnit:xCharge?'nC':'ns',band,cursors:band?[band.from,band.to]:undefined,rows});
    $('measurementNote').textContent=(p.capMode==='off'?'Cgd 断开时，漏端仍需对 Cds 充放电。':'阴影标出实际漏压摆幅的中央 80%。')+' 窗口内沟道耗散能量 ∫VDS·Ich dt = '+sig(r.energy)+' µJ。|ΔQgd| 只计栅漏支路，横轴 |ΔQg|（栅极电荷视图）还包含栅源电荷。';
  }
  function plot(){
    const p=state[mode];
    MillerDiagrams.render($('diagram'),mode,{...p,cgdEnabled:mode==='switch'?p.capMode!=='off':p.cgd>0});
    if(mode==='charge')renderCharge(p);
    else if(mode==='ac')renderAc(p);
    else renderSwitch(p);
  }
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;plot();});}
  function makeInput(k){
    const [name,unit,min,max,step]=mode==='switch'&&powerCaps[k]?powerCaps[k]:specs[k];
    const p=state[mode],el=document.createElement('div');
    el.innerHTML='<label for="number-'+k+'">'+name+'</label><div class="num-box"><input id="number-'+k+'" type="number"><small>'+unit+'</small></div><input type="range" aria-label="'+name+'滑块">';
    const [number,range]=el.querySelectorAll('input');
    for(const input of [number,range])Object.assign(input,{min,max,step,value:p[k]});
    function change(v){
      const value=Math.max(min,Math.min(max,v));
      p[k]=value;number.value=value;range.value=value;
      if(mode==='charge'&&k==='gain')drawButtons();
      schedule();
    }
    number.onchange=()=>change(number.value!==''&&Number.isFinite(+number.value)?+number.value:p[k]);
    range.oninput=()=>change(+range.value);
    return el;
  }
  function button(el,text,click,active){
    const b=document.createElement('button');b.textContent=text;
    if(active!==undefined)b.setAttribute('aria-pressed',String(active));b.onclick=click;el.append(b);
  }
  function drawButtons(){
    const actions=$('actions'),views=$('views');actions.replaceChildren();views.replaceChildren();
    const p=state[mode];
    if(mode==='charge'){
      for(const [name,gain] of [['同向跟随',1],['漏极固定',0],['反向放大',-10]])button(actions,name,()=>{
        p.gain=gain;$('number-gain').value=gain;$('number-gain').parentElement.nextElementSibling.value=gain;drawButtons();plot();
      },p.gain===gain);
    }else if(mode==='ac'){
      button(views,'输入单极点近似',()=>{approx=!approx;drawButtons();plot();},approx);
      button(views,'断开 Cgd 对照',()=>{compare=!compare;drawButtons();plot();},compare);
    }else{
      for(const [value,name] of [['on','开通'],['off','关断']])button(actions,name,()=>{p.edge=value;drawButtons();plot();},p.edge===value);
      const label=document.createElement('label');label.textContent='栅漏支路';const select=document.createElement('select');
      for(const [id,word] of [['nonlinear','电压相关 Cgd'],['constant','恒定 Cgd'],['off','断开 Cgd']])select.add(new Option(word,id));
      select.value=p.capMode;select.onchange=()=>{p.capMode=select.value;plot();};label.append(select);actions.append(label);
      for(const [value,name] of [['time','时间波形'],['gate','栅极电荷曲线']])button(views,name,()=>{switchView=value;drawButtons();plot();},switchView===value);
    }
  }
  function openLab(m){
    mode=m;const l=lab[m],i=order.indexOf(m);
    for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-current',String(b.dataset.mode===m));
    $('title').textContent=l.title;$('question').textContent=l.question;$('circuitType').textContent=l.circuit;$('circuitNote').textContent=l.caption;
    $('scopeTitle').textContent=l.scope;$('finding').textContent=l.heading;$('explanation').textContent=l.text;$('formula').innerHTML=math(formula[m]);
    const note=m==='switch'?'<p>转换窗口从 VDS 实际总摆幅的 90% 到 10%（开通），或 10% 到 90%（关断）。平台读数取该窗口的时间平均。测得的支路电荷只覆盖这个窗口，与数据手册在特定测试条件下标注的整段 Qgd 口径可能不同。</p>':'';
    $('methodBody').innerHTML='<p>'+l.method+'</p>'+note+'<p>'+(m==='switch'?refs.ti:refs.mit)+'</p>';
    $('controls').replaceChildren(...l.controls.map(makeInput));$('extra').replaceChildren(...l.extra.map(makeInput));
    $('prev').disabled=i===0;$('next').disabled=i===2;drawButtons();plot();
  }
  for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>openLab(b.dataset.mode);
  $('reset').onclick=()=>{state[mode]={...initial[mode]};if(mode==='switch')switchView='time';if(mode==='ac')approx=compare=true;openLab(mode);scope.resetCursors();};
  for(const [id,delta] of [['prev',-1],['next',1]])$(id).onclick=()=>{openLab(order[order.indexOf(mode)+delta]);document.querySelector('.chapters').scrollIntoView({block:'start'});};
  openLab('charge');
})();
