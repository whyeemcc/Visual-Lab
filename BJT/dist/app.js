(() => {
  'use strict';
  const P=window.BJTPhysics,L=window.bjtLessons,$=id=>document.getElementById(id);
  const groups=['入门','进阶','高级'];
  const material=['width','ne','nb','nc','tau','area','temp'];
  const shared={...P.defaults},local=Array.from({length:9},()=>({...P.defaults,driveMode:'voltage'}));
  local[2].vce=1.2;local[5].vbe=.75;local[5].driveMode='current';
  let lesson=1,queued=false;
  // Units and scale factors convert only the controls. The model uses physical units.
  const inputs={
    width:['几何基宽','µm',.3,2,.01],ne:['发射区掺杂','×10¹⁸ cm⁻³',.1,20,.1,1e18],
    nb:['基区掺杂','×10¹⁷ cm⁻³',.5,4,.05,1e17],nc:['集电区掺杂','×10¹⁶ cm⁻³',.1,8,.1,1e16],
    tau:['基区少子寿命','ns',1,100,.5],area:['结面积','µm²',20,250,1],temp:['结温','K',270,350,1],
    vbe:['发射结电压 VBE','V',0,.84,.005],vce:['集射电压 VCE','V',0,5,.01],
    ib:['基极电流 IB','µA',.1,60,.1],vcc:['电源电压 VCC','V',1,8,.1],
    rc:['集电电阻 RC','Ω',330,5000,10],re:['发射极电阻 RE','Ω',10,600,5],rs:['源电阻 Rs','Ω',50,10000,50],
    rl:['交流负载 RL','Ω',300,30000,100],amp:['输入峰值','mV',1,400,1],vbias:['基极源直流偏置','V',.58,1.05,.005],
    drive:['正向基极电流','µA',2,240,1],reverse:['反向抽取幅值','µA',1,150,1],pulse:['正向脉宽','ns',10,1000,5],
    cmu:['集电结电容倍率','×',.25,8,.05]
  };
  const storeFor=k=>material.includes(k)?shared:local[lesson-1];
  const sign=()=>shared.type==='PNP'?-1:1;
  const eng=(v,u)=>{
    if(!Number.isFinite(v))return '—';
    const idx=v?Math.min(4,Math.max(-6,Math.floor(Math.log10(Math.abs(v))/3))):0;
    return Number((v/10**(3*idx)).toPrecision(4))+' '+['a','f','p','n','µ','m','','k','M','G','T'][idx+6]+u;
  };
  function params(){const out={...local[lesson-1],type:shared.type};for(const k of material)out[k]=shared[k];
    if(lesson===6){out.re=0;out.rs=0;}return out;}
  function spec(key){
    let [name,unit,min,max,step,scale=1]=inputs[key];
    if(key==='vbe'&&lesson===3){min=-2;max=.85;}
    if(key==='vce'&&lesson===3){min=-2.85;max=2.85;}
    if(key==='vbe'&&lesson===5)min=.15;
    const signed=['vbe','vce','vcc','ib','vbias','drive'].includes(key);
    if(signed&&sign()<0){[min,max]=[-max,-min];scale*=-1;}
    return {name,unit,min,max,step,scale};
  }
  function buildControl(key){
    const {name,unit,min,max,step,scale}=spec(key),el=document.createElement('div');
    el.className='param';const value=Number((storeFor(key)[key]/scale).toPrecision(7));
    el.innerHTML='<div class="param-head"><label for="num-'+key+'">'+name+'</label><span class="unit">'+unit+'</span></div>';
    const num=document.createElement('input'),range=document.createElement('input');
    for(const [i,type] of [[num,'number'],[range,'range']]){
      Object.assign(i,{type,id:(type==='number'?'num-':'range-')+key,min,max,step,value});
      i.setAttribute('aria-label',name+'（'+unit+'）'+(type==='range'?'滑块':'数值'));
      el.append(i);
    }
    function update(val){
      const v=Math.min(max,Math.max(min,val));storeFor(key)[key]=v*scale;num.value=v;range.value=v;
      if(lesson===3&&(key==='vbe'||key==='vce')){
        const cfg=local[2];cfg.vce=Math.min(cfg.vbe+2,Math.max(cfg.vbe-.85,cfg.vce));
        for(const id of ['num-vce','range-vce'])$(id).value=Number((sign()*cfg.vce).toFixed(4));
      }
      schedule();
    }
    range.oninput=()=>update(+range.value);
    num.onchange=()=>update(num.value!==''&&Number.isFinite(+num.value)?+num.value:storeFor(key)[key]/scale);
    return el;
  }
  function button(box,name,fn,active){
    const b=document.createElement('button');b.textContent=name;if(active!==undefined)b.setAttribute('aria-pressed',active);
    b.onclick=fn;box.append(b);
  }
  function controls(){
    const meta=L[lesson-1],cfg=local[lesson-1],main=$('inputs'),extra=$('materialInputs'),modes=$('modes');
    modes.replaceChildren();main.replaceChildren();extra.replaceChildren();
    const keys=[...meta.controls];
    if(lesson===6||(lesson===2||lesson===4)){
      for(const [value,name] of [['voltage','电压驱动'],['current','基极电流驱动']])button(modes,name,()=>{
        cfg.driveMode=value;controls();schedule();
      },cfg.driveMode===value);
      if(lesson===6)keys.unshift(cfg.driveMode==='current'?'ib':'vbe');
      else if(cfg.driveMode==='current')keys[keys.indexOf('vbe')]='ib';
    }
    if(lesson===3){
      for(const [name,be,bc] of [['截止',-.2,-1],['正向放大',.66,-1],['饱和',.72,.67],['反向放大',-.15,.63]]){
        button(modes,name,()=>setPlane(sign()*be,sign()*(be-bc)));
      }
    }
    keys.forEach(k=>main.append(buildControl(k)));
    material.filter(k=>!keys.includes(k)).forEach(k=>extra.append(buildControl(k)));
    $('materialDetails').hidden=!extra.childElementCount;
  }
  function setPlane(vbe,vce){
    const s=sign(),be=Math.max(-2,Math.min(.85,s*vbe)),bc=Math.max(-2,Math.min(.85,s*(vbe-vce)));
    Object.assign(local[2],{vbe:be,vce:be-bc});
    controls();schedule();
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;measure();});}
  function measure(){
    const cfg=params(),d=P.device(cfg),s=d.s,base=cfg.driveMode==='current'?s*cfg.ib*1e-6:s*cfg.vbe;
    let p,analysis=null;
    if(lesson===1)p=P.at(d,0,0);
    else if(lesson===5)p=P.at(d,s*cfg.vbe,s*cfg.vbe);
    else if(lesson===6)p=P.loaded(d,base,cfg.driveMode);
    else if(lesson===7){analysis=P.amplifier(d);p=analysis.op;}
    else if(lesson===8){analysis=P.switching(d);p=analysis.switchPoint;}
    else if(lesson===9){p=P.loaded(d,s*d.vbias);analysis=P.frequency(d,p);}
    else if(cfg.driveMode==='current')p=P.byBase(d,s*cfg.ib*1e-6,s*cfg.vce);
    else p=P.at(d,s*cfg.vbe,s*cfg.vce);
    const context={lesson,op:p,device:d,params:cfg,driveMode:cfg.driveMode,analysis};
    BJTDevice.render($('device'),context);
    BJTPlots.render(context);
    const ac=lesson===7||lesson===9?P.small(d,p):null;
    const metrics=lesson===1?[['发射结内建电势',eng(d.vbiE,'V')],['集电结内建电势',eng(d.vbiC,'V')],['中性基宽',eng(p.w*1e-6,'m')],['端口电流 IC',eng(p.ic,'A')]]:
      lesson===4?[['发射效率 γ',(100*p.gamma).toFixed(3)+' %'],['输运因子 αT',(100*p.alphaT).toFixed(3)+' %'],['正向输运增益 βF',p.betaF.toFixed(2)],['实测 IC/IB',p.ib?Number((p.ic/p.ib).toPrecision(4)):'—']]:
      ac?[['跨导 gm',eng(ac.gm,'S')],['输入电阻 rπ',eng(ac.rpi,'Ω')],['输出电阻 ro',eng(ac.ro,'Ω')],['静态 IC',eng(p.ic,'A')]]:
      lesson===8?[['脉冲末 VCE',eng(p.vce,'V')],['脉冲末储荷',eng(p.charge,'C')],['导通延迟',eng(analysis.delay===null?null:analysis.delay*1e-9,'s')],['上升时间',eng(analysis.rise===null?null:analysis.rise*1e-9,'s')]]:
      [['集电极 IC',eng(p.ic,'A')],['基极 IB',eng(p.ib,'A')],['发射极 IE',eng(p.ie,'A')],['集射电压 VCE',eng(p.vce,'V')]];
    if(lesson===2)metrics.push(['基区复合',eng(p.baseRec,'A')],['外区反向注入',eng(p.backInj,'A')],['结区复合',eng(p.scrRec,'A')],['实测 IC/IB',p.ib?Number((p.ic/p.ib).toPrecision(4)):'—']);
    $('metrics').innerHTML=metrics.map(([k,v])=>'<div class="metric"><small>'+k+'</small><b>'+v+'</b></div>').join('');
    $('state').textContent=d.type+' · '+p.regime+(lesson===8?'（脉冲末端）':'');
    $('warning').textContent=[p.punchThrough?'耗尽区接近贯通，基宽采用下限保护，本点超出一维模型范围。':'',
      p.flat?'结电压已接近平带，耗尽近似精度下降。':'',p.highInjection?'达到高注入条件，电流和增益为低注入模型外推。':'',
      lesson===9&&p.mode!=='active'?'该偏置超出正向放大区，混合 π 高频结果仅作外推。':''].filter(Boolean).join(' ');
  }
  function show(n,scroll){
    lesson=n;const m=L[n-1],idx=Math.floor((n-1)/3);
    $('title').textContent=m.title;$('stage').textContent=groups[idx]+'　/　实验 '+String(n).padStart(2,'0');$('question').textContent=m.q;
    $('deviceTitle').textContent=n>=6?'器件与测试电路':'器件截面';$('measurement').textContent=m.measure;$('concept').textContent=m.heading;
    $('equation').innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML">'+m.eq+'</math>';
    $('interpret').textContent=m.text;$('limits').textContent=m.limit;$('reading').href='https://ocw.mit.edu/courses/6-012-microelectronic-devices-and-circuits-spring-2009/pages/lecture-notes/';
    $('mobileNav').value=n;$('prev').disabled=n===1;$('next').disabled=n===9;
    document.querySelectorAll('.nav-item').forEach(b=>b.setAttribute('aria-current',+b.dataset.n===n));
    document.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.type===shared.type));
    controls();measure();
    if(scroll)document.querySelector('.heading').scrollIntoView({block:'start'});
  }
  groups.forEach((g,j)=>{
    const label=document.createElement('p');label.className='nav-group';label.textContent=g;$('nav').append(label);
    const options=document.createElement('optgroup');options.label=g;
    L.slice(j*3,j*3+3).forEach((m,i)=>{
      const n=j*3+i+1,b=document.createElement('button');b.className='nav-item';b.dataset.n=n;b.innerHTML='<i>'+String(n).padStart(2,'0')+'</i>'+m.name;
      b.onclick=()=>show(n,true);$('nav').append(b);options.append(new Option(n+' · '+m.name,n));
    });$('mobileNav').append(options);
  });
  $('mobileNav').onchange=e=>show(+e.target.value,false);$('prev').onclick=()=>show(lesson-1,true);$('next').onclick=()=>show(lesson+1,true);
  $('reset').onclick=()=>{
    for(const k of material)shared[k]=P.defaults[k];
    Object.assign(local[lesson-1],P.defaults,{driveMode:lesson===6?'current':'voltage'});
    if(lesson===6)local[5].vbe=.75;if(lesson===3)local[2].vce=1.2;
    show(lesson,false);
  };
  for(const b of document.querySelectorAll('[data-type]'))b.onclick=()=>{shared.type=b.dataset.type;show(lesson,false);};
  if(location.hostname.endsWith('.chatgpt.site')){
    document.querySelectorAll('header a').forEach(a=>a.href='https://github.com/whyeemcc/Visual-Lab');
    document.querySelector('.home').textContent='Visual-Lab 仓库 ↗';
  }
  BJTPlots.mount($('plots'),{onBias:setPlane});
  show(1,false);
})();
