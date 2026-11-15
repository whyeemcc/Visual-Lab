/* Measurement charts share the device, bias point and circuit analysis with the main panel.
   Voltages and terminal currents are physical signed values, including PNP. */
window.BJTPlots = (() => {
  'use strict';
  const colors=['#126e66','#b75336','#4d72a7','#7a558d','#8a791b'];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const finite=Number.isFinite;
  const fmt=(v,n=3)=>!finite(v)?'—':v===0?'0':Math.abs(v)<1e-3||Math.abs(v)>=1e5?v.toExponential(1):String(+v.toPrecision(n));
  function eng(v,unit){
    if(!finite(v))return '—';
    const prefixes=['a','f','p','n','µ','m','','k','M','G','T'];
    const tier=v?clamp(Math.floor(Math.log10(Math.abs(v))/3),-6,4):0;
    return fmt(v/10**(tier*3))+' '+prefixes[tier+6]+unit;
  }
  const seq=(a,b,n,fn)=>Array.from({length:n},(_,i)=>fn(a+(b-a)*i/(n-1)));
  const line=(points,key,label,color=colors[0],dash=false)=>({points,key,label,color,dash});
  const row=(title,lines,extra={})=>({title,lines,...extra});
  const read=(name,val)=>'<span><small>'+name+'</small><b>'+val+'</b></span>';
  const opt=(key,label,values,active)=>'<label>'+label+'<select data-key="'+key+'">'+values.map(([v,l])=>'<option value="'+v+'"'+(String(v)===String(active)?' selected':'')+'>'+l+'</option>').join('')+'</select></label>';
  const button=(key,label,active)=>'<button type="button" data-key="'+key+'" aria-pressed="'+!!active+'">'+label+'</button>';
  const range=(key,label)=>'<label>'+label+'<input type="range" aria-label="'+label+'" data-key="'+key+'" min="0" max="1000" step="1"></label>';
  const symlog=v=>v>0?Math.log10(v):null;
  let box,figure,tools,tail,legend,reads,note,hooks,model,device,state,op;
  let mode='',zoom=1,pan=.5,which='a',a=null,b=null,prior='',frozen=null;
  let chart,geom,lastWidth,observer,pointer=null,panStart=null;
  function mount(element,callbacks={}){
    box=element;hooks=callbacks;model=window.BJTPhysics;
    box.innerHTML='<div class="bjp"><div class="bp-tools"></div><div class="bp-legend-group"></div><div class="bp-figure"></div><div class="bp-tail"></div><div class="bp-read" aria-label="测量结果"></div><p class="bp-note"></p></div>';
    [tools,legend,figure,tail,reads,note]=['tools','legend-group','figure','tail','read','note'].map(key=>box.querySelector('.bp-'+key));
    box.addEventListener('click',handle);box.addEventListener('change',handle);box.addEventListener('input',handle);
    figure.addEventListener('pointerdown',e=>{
      if(!chart || e.button!==0)return;
      figure.setPointerCapture(e.pointerId);pointer=e.pointerId;
      const rect=figure.getBoundingClientRect();
      const y=(e.clientY-rect.top)*geom.height/rect.height;
      if(chart.pan && y>geom.bottom){panStart={x:e.clientX,pan};return;}
      pointAt(e);
    });
    figure.addEventListener('pointermove',e=>{
      if(pointer!==e.pointerId)return;
      if(panStart){
        pan=clamp(panStart.pan-(e.clientX-panStart.x)/((geom.right-geom.left)*(zoom-1)),0,1);
        redraw();
      }else pointAt(e);
    });
    figure.addEventListener('lostpointercapture',()=>{pointer=null;panStart=null;});
    if(window.ResizeObserver){
      observer?.disconnect();
      observer=new ResizeObserver(()=>{if(chart && lastWidth!==figure.clientWidth)paint();});
      observer.observe(figure);
    }
  }
  function pointAt(e){
    const rect=figure.getBoundingClientRect();
    const x=(e.clientX-rect.left)*geom.width/rect.width;
    const frac=clamp((x-geom.left)/(geom.right-geom.left),0,1);
    const value=chart.min+frac*(chart.max-chart.min);
    if(state.lesson===3){
      const y=(e.clientY-rect.top)*geom.height/rect.height;
      const vbe=geom.ylow+(geom.yhigh-geom.ylow)*clamp((geom.bottom-y)/(geom.bottom-geom.top),0,1);
      hooks.onBias?.(vbe,vbe-value);
    }else setCursor(value);
  }
  function setCursor(value){
    if(which==='b'&&chart.dual)b=value;else a=value;
    cursorPaint();
  }
  function handle(e){
    const target=e.target.closest('[data-key]');if(!target)return;
    if(e.type!==(target.tagName==='SELECT'?'change':target.tagName==='INPUT'?'input':'click'))return;
    switch(target.dataset.key){
      case 'mode':mode=target.value;frozen=null;a=b=null;break;
      case 'freeze':frozen=frozen?null:chart.rows.map(r=>r.lines.map(s=>({...s})));break;
      case 'a':case 'b':which=target.dataset.key;break;
      case 'x':setCursor(chart.min+Number(target.value)*(chart.max-chart.min)/1000);return;
      case 'zoom':zoom=Number(target.value);break;
      case 'pan':pan=Number(target.value)/1000;break;
      default:return;
    }
    redraw();
  }
  function render(next){
    state=next;device=next.device||model.device(next.params);op=next.op;
    const context=state.lesson+'/'+device.type+'/'+(state.lesson===6?state.driveMode:'');
    if(context!==prior){
      prior=context;mode=({1:'band',2:'minor',4:'width',9:'h21'})[state.lesson]||'';
      frozen=null;a=b=null;zoom=1;pan=.5;which='a';
    }
    redraw();
  }
  function redraw(){
    if(!state)return;
    chart=[null,spatial,spatial,plane,transport,gummel,output,amplifier,switching,frequency][state.lesson]();
    tools.innerHTML=(chart.tools||'')+(chart.freeze?button('freeze',frozen?'清除冻结曲线':'冻结曲线',!!frozen):'');
    const markup=(chart.dual?button('a','游标 A',which==='a')+button('b','游标 B',which==='b'):'')+
      (chart.cursor!==false?range('x',chart.cursorLabel||'测量游标'):'')+
      (chart.pan?range('pan','平移时间轴'):'');
    if(tail.dataset.shape!==markup){tail.innerHTML=markup;tail.dataset.shape=markup;}
    const p=tail.querySelector('[data-key=pan]');if(p)p.value=Math.round(pan*1000);
    note.textContent=chart.note||'';
    if(a===null)a=chart.initA??(chart.min+chart.max)/2;
    if(b===null)b=chart.initB??(chart.min+(chart.max-chart.min)*.67);
    if(!chart.pan){a=clamp(a,chart.min,chart.max);b=clamp(b,chart.min,chart.max);}
    paint();
    if(state.lesson===9)document.dispatchEvent(new CustomEvent('bjt:ac-mode',{detail:mode}));
  }
  function paint(){
    const w=Math.max(170,figure.clientWidth),compact=w<480;
    lastWidth=figure.clientWidth;
    const left=compact?46:59,right=w-(compact?13:21),top=29,rh=chart.rows.length===1?185:114,gap=40;
    const bottom=top+rh*chart.rows.length+gap*(chart.rows.length-1),height=bottom+39;
    const fx=x=>left+(x-chart.min)/(chart.max-chart.min)*(right-left);
    geom={width:w,height,left,right,top,bottom,fx};
    let svg='<svg role="img" aria-label="'+chart.rows.map(r=>r.title).join('，')+'" viewBox="0 0 '+w+' '+height+'">';
    const labels=new Map();
    for(const [i,r] of chart.rows.entries()){
      const y0=top+i*(rh+gap),y1=y0+rh;
      const refs=frozen?.[i]?.map(l=>({...l,dash:true,color:'#88978f',label:'冻结参考'}))||[];
      const lines=[...refs,...r.lines];
      let lo=Infinity,hi=-Infinity;
      function extend(y){if(finite(y)){lo=Math.min(lo,y);hi=Math.max(hi,y);}}
      for(const l of lines)for(const p of l.points)if(p.x>=chart.min&&p.x<=chart.max)extend(p[l.key]);
      if(r.mark)extend(r.mark.y);
      if(r.zero)extend(0);
      if(!finite(lo)){lo=0;hi=1;}
      if(lo===hi){const step=.08*Math.abs(lo)||1;lo-=step;hi+=step;}
      if(r.log){lo=Math.floor(lo);hi=Math.ceil(hi);}
      else{const pad=(hi-lo)*.055;lo-=pad;hi+=pad;}
      if(r.limits)[lo,hi]=r.limits;
      const fy=y=>y1-(y-lo)/(hi-lo)*rh;
      if(i===0)Object.assign(geom,{ylow:lo,yhigh:hi,fy});
      svg+='<defs><clipPath id="bp-clip'+i+'"><rect x="'+left+'" y="'+y0+'" width="'+(right-left)+'" height="'+rh+'"/></clipPath></defs>';
      if(r.regions)for(const [x1,x2,v1,v2,label,color] of r.regions){
        svg+='<rect x="'+fx(x1)+'" y="'+fy(v2)+'" width="'+(fx(x2)-fx(x1))+'" height="'+(fy(v1)-fy(v2))+'" fill="'+color+'"/>';
        svg+='<text x="'+((fx(x1)+fx(x2))/2)+'" y="'+((fy(v1)+fy(v2))/2)+'" text-anchor="middle" font-size="11" fill="#334a42">'+label+'</text>';
      }
      for(const [s,e] of r.shade||[]){
        const x0=fx(clamp(s,chart.min,chart.max)),x1=fx(clamp(e,chart.min,chart.max));
        svg+='<rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+rh+'" fill="#e6e5d2"/>';
      }
      svg+='<text x="'+left+'" y="'+(y0-11)+'" fill="#284e41" font-weight="600" font-size="12">'+r.title+'</text>';
      const base=10**Math.floor(Math.log10((hi-lo)/3.6)),step=r.log?Math.max(1,Math.ceil((hi-lo)/4)):[1,2,2.5,5,10].find(x=>x*base>=(hi-lo)/3.6)*base;
      for(let j=Math.ceil(lo/step);j<=Math.floor(hi/step);j++){
        const val=j*step,y=fy(val);
        svg+='<path d="M'+left+' '+y+'H'+right+'" stroke="'+(val===0?'#aebfb4':'#d8e3dc')+'"/><text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#577165">'+(r.log?'1e'+val:fmt(val,2))+'</text>';
      }
      const xs=chart.logX?logTicks(chart.min,chart.max,compact?4:6):seq(chart.min,chart.max,compact?3:5,x=>x);
      for(const x of xs){
        svg+='<path d="M'+fx(x)+' '+y0+'V'+y1+'" stroke="#d8e3db" stroke-dasharray="2 4"/>';
        if(i===chart.rows.length-1)svg+='<text x="'+fx(x)+'" y="'+(y1+16)+'" fill="#536b60" text-anchor="'+(x===chart.min?'start':x===chart.max?'end':'middle')+'" font-size="10">'+(chart.logX?'1e'+x:fmt(x))+'</text>';
      }
      if(chart.min<0&&chart.max>0)svg+='<path d="M'+fx(0)+' '+y0+'V'+y1+'" stroke="#a4b8ad"/>';
      for(const l of lines){
        let d='',pen=false;
        for(const p of l.points){
          if(!finite(p[l.key])){pen=false;continue;}
          d+=(pen?'L':'M')+fx(p.x).toFixed(2)+' '+fy(p[l.key]).toFixed(2);pen=true;
        }
        svg+='<path d="'+d+'" clip-path="url(#bp-clip'+i+')" fill="none" stroke="'+l.color+'" stroke-width="2" stroke-linejoin="round"'+(l.dash?' stroke-dasharray="5 4"':'')+'/>';
        if(l.label)labels.set(l.label,l);
      }
      if(r.mark&&finite(r.mark.y))svg+='<circle clip-path="url(#bp-clip'+i+')" cx="'+fx(r.mark.x)+'" cy="'+fy(r.mark.y)+'" r="4.5" fill="#193e37" stroke="#fff" stroke-width="1.5"/>';
    }
    legend.innerHTML=[...labels].map(([label,l])=>'<span class="bp-legend"><i style="border-color:'+l.color+';'+(l.dash?'border-top-style:dashed':'')+'"></i>'+label+'</span>').join('');
    figure.innerHTML=svg+'<text x="'+((left+right)/2)+'" y="'+(height-5)+'" text-anchor="middle" fill="#465e53" font-size="11">'+chart.unit+'</text><g class="bp-cursors"></g></svg>';
    cursorPaint();
  }
  function logTicks(lo,hi,n){
    const step=Math.max(1,Math.ceil((hi-lo)/n)),ticks=[];
    for(let i=Math.ceil(lo/step)*step;i<=hi;i+=step)ticks.push(i);
    return ticks;
  }
  function cursorPaint(){
    const g=figure.querySelector('.bp-cursors');
    const marks=chart.cursor===false?[]:chart.dual?[[a,colors[0],'A'],[b,colors[1],'B']]:[[a,colors[0],'']];
    g.innerHTML=marks.filter(([x])=>x>=chart.min&&x<=chart.max).map(([x,c,label])=>'<path d="M'+geom.fx(x)+' '+geom.top+'V'+geom.bottom+'" stroke="'+c+'" stroke-dasharray="4 3"/><circle cx="'+geom.fx(x)+'" cy="'+geom.top+'" r="3" fill="'+c+'"/><text x="'+(geom.fx(x)+(geom.fx(x)>geom.right-16?-12:5))+'" y="'+(geom.top+12)+'" font-size="11" fill="'+c+'">'+label+'</text>').join('');
    const input=tail.querySelector('[data-key=x]');
    if(input)input.value=Math.round(1000*clamp(((which==='b'&&chart.dual?b:a)-chart.min)/(chart.max-chart.min),0,1));
    reads.innerHTML=chart.measure(a,b).map(([key,value])=>read(key,value)).join('');
    if(chart.space)document.dispatchEvent(new CustomEvent('bjt:position',{detail:a}));
  }
  function nearest(data,x,key='x'){
    let lo=0,hi=data.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(data[mid][key]<x)lo=mid+1;else hi=mid;}
    return lo&&x-data[lo-1][key]<data[lo][key]-x?data[lo-1]:data[lo];
  }
  function spatial(){
    const low=-Math.max(.15,op.xe*1.2),high=device.width+Math.max(.15,op.xc*1.25);
    const pts=seq(low,high,401,x=>({x,...model.profile(device,op,x)}));
    const bands=mode==='band',shade=[[-op.xe,op.xbE],[device.width-op.xbC,device.width+op.xc]];
    return {min:low,max:high,unit:'位置 x [µm]，E → B → C',space:true,initA:device.width/2,
      tools:opt('mode','空间剖面',[['band','导带与价带'],['minor','中性基区少子浓度']],mode),
      rows:[row(bands?'能带 [eV]':'少子浓度 [cm⁻³]',bands?[line(pts,'ec','Ec'),line(pts,'ev','Ev',colors[1])]:[line(pts,'minority',device.s>0?'电子浓度':'空穴浓度')],{shade})],
      note:'阴影标出发射结和集电结的耗尽区。位置游标与上方截面同步。能量零点取发射区导带边缘。',
      measure:x=>{const p=model.profile(device,op,x);return [['位置',fmt(x)+' µm'],['导带',fmt(p.ec)+' eV'],['价带',fmt(p.ev)+' eV'],['基区少子',finite(p.minority)?fmt(p.minority)+' cm⁻³':'基区外']];}};
  }
  function plane(){
    const sign=device.s,min=sign===1?-2:-.85,max=sign===1?.85:2;
    const regions=[];
    for(const [xl,xh] of [[min,0],[0,max]])for(const [yl,yh] of [[min,0],[0,max]]){
      const c=(xl+xh)*sign>0,e=(yl+yh)*sign>0;
      regions.push([xl,xh,yl,yh,e?(c?'饱和':'正向放大'):(c?'反向放大':'截止'),e?(c?'#f9ddc9':'#dfefdb'):(c?'#e0e8f7':'#edf0e9')]);
    }
    return {min,max,unit:'VBC [V]',cursor:false,rows:[row('VBE [V]',[],{regions,limits:[min,max],mark:{x:op.vbc,y:op.vbe}})],
      note:'拖动平面设定两结偏压，或使用上方电压控件。边界表示偏压极性，电流随电压连续变化。',
      measure:()=>[['工作区',op.regime],['VBE',fmt(op.vbe)+' V'],['VBC',fmt(op.vbc)+' V'],['VCE',fmt(op.vce)+' V']]};
  }
  function transport(){
    const pts=seq(.3,2,121,x=>{
      const d=model.device({...state.params,width:x}),p=model.at(d,op.vbe,op.vce);
      return {x,beta:p.betaF,gamma:p.gamma*100,alpha:p.alphaT*100};
    });
    return {min:.3,max:2,unit:'几何基区宽度 [µm]',initA:device.width,freeze:true,
      rows:[row('效率 [%]',[line(pts,'gamma','发射效率 γ'),line(pts,'alpha','基区输运因子',colors[1])]),row('正向输运增益 βF',[line(pts,'beta','βF')],{mark:{x:device.width,y:op.betaF}})],
      note:'曲线固定两端电压，扫描几何基宽。βF 仅计中性区输运与反向注入；端口实测 IC/IB 还包含结区复合。',
      measure:x=>{const p=nearest(pts,x);return [['测量宽度',fmt(p.x)+' µm'],['发射效率',fmt(p.gamma,5)+' %'],['基区输运因子',fmt(p.alpha,5)+' %'],['βF',fmt(p.beta)]];}};
  }
  function gummel(){
    const calc=x=>{const v=device.s*x,p=model.at(device,v,v);return {x,ic:symlog(Math.abs(p.ic)),ib:symlog(Math.abs(p.ib)),beta:p.ic/p.ib,raw:p.ic}};
    const pts=seq(.15,.84,181,calc);
    return {min:.15,max:.84,unit:(device.s>0?'VBE':'VEB')+' [V] · VBC = 0',initA:.5,initB:.62,dual:true,freeze:true,
      rows:[row('电流幅值 [A]',[line(pts,'ic','|IC|'),line(pts,'ib','|IB|',colors[1])],{log:true,mark:{x:device.s*op.vbe,y:symlog(Math.abs(op.ic))}}),
        row('直流电流增益',[line(pts,'beta','IC/IB')])],
      note:'游标跨越区间内的电压差除以电流的十进对数差，得到每十倍电流的电压增量。冻结曲线后可改变温度比较。',
      measure:(x,y)=>{const p=calc(x),q=calc(y);return [['A · IC',eng(p.raw,'A')],['B · IC',eng(q.raw,'A')],['集电极斜率',x===y?'—':fmt(1000*(y-x)/(q.ic-p.ic))+' mV/dec'],['A · IC/IB',fmt(p.beta)]];}};
  }
  function output(){
    const d=device,s=d.s,isCurrent=state.driveMode==='current',max=d.vcc;
    const sets=[.55,.8,1,1.25,1.5].map((v,i)=>{
      const param=isCurrent?d.ib*v:Math.max(.1,d.vbe+(i-2)*.018);
      const pts=seq(0,max,101,x=>{
        const p=isCurrent?model.byBase(d,s*param*1e-6,s*x):model.at(d,s*param,s*x);
        return {x,y:s*p.ic*1e3};
      });
      return line(pts,'y',isCurrent?fmt(param)+' µA':fmt(s*param)+' V',colors[i]);
    });
    const load=line([{x:0,y:max/d.rc*1000},{x:max,y:0}],'y','负载线','#617366',true);
    return {min:0,max,unit:(s>0?'VCE':'VEC')+' [V]',initA:s*op.vce,
      rows:[row((s>0?'IC':'−IC')+' [mA]　·　'+(isCurrent?'固定 IB':'固定 VBE'),[...sets,load],{mark:{x:s*op.vce,y:s*op.ic*1e3},limits:[-.05*max/d.rc*1000,1.55*max/d.rc*1000]})],
      note:'交点为带负载工作点。显示范围随电源及集电电阻调整；超出范围的曲线段裁切。游标处分别给出当前驱动方式下的局部输出电阻与工作点中性基宽。',
      measure:x=>{const point=v=>isCurrent?model.byBase(d,s*d.ib*1e-6,s*v):model.at(d,s*d.vbe,s*v);
        const u=point(x),r=s*.0002/(point(x+.0001).ic-point(x-.0001).ic);
        return [['游标 VCE',fmt(s*x)+' V'],['曲线上 IC',eng(u.ic,'A')],['局部输出电阻',eng(r,'Ω')],['工作点中性基宽',fmt(op.w)+' µm']];}};
  }
  function amplifier(){
    const data=state.analysis.samples.map(p=>({...p,x:p.t}));
    return {min:0,max:2000,unit:'时间 [µs] · 1 kHz',dual:true,initA:250,initB:750,
      rows:[row('输入源 [V]',[line(data,'vin','输入')]),row('集电极电压 [V]',[line(data,'vout','非线性输出'),line(data,'linear','工作点切线',colors[1],true)])],
      note:'交流耦合负载在直流时开路；图中输出包含集电极直流分量。游标增益为两个时刻之间的割线斜率。',
      measure:(x,y)=>{const p=nearest(data,x),q=nearest(data,y);return [['A · 输出',fmt(p.vout)+' V'],['B · 输出',fmt(q.vout)+' V'],['游标增益',fmt((p.vout-q.vout)/(p.vin-q.vin))],['小信号增益',fmt(state.analysis.gain)]];}};
  }
  function switching(){
    const an=state.analysis,data=an.samples.map(p=>({...p,x:p.t,b:p.ib*1e6,c:p.ic*1e3,charge:p.q*1e12}));
    const total=data.at(-1).x,span=total/zoom,low=(total-span)*pan;
    return {min:low,max:low+span,unit:'时间 [ns]',dual:true,initA:device.pulse,initB:device.pulse+(an.storage||1),pan:zoom>1,
      tools:opt('zoom','缩放',[[1,'全程'],[4,'4×'],[16,'16×'],[64,'64×']],zoom),
      rows:[row('IB [µA]',[line(data,'b','基极驱动')]),row('IC [mA]',[line(data,'c','集电极电流')]),row('VCE [V]',[line(data,'vce','端口压降')]),row('存储电荷 [pC]',[line(data,'charge','Q')])],
      note:'撤去正向驱动后，IC 幅值降至脉冲末值的 90% 定义存储终点；90% 至 10% 为下降时间。储荷耗尽后抽取脉冲结束。缩放后可拖动底部时间轴。',
      measure:(x,y)=>{const lo=Math.min(x,y),hi=Math.max(x,y);let sum=0;for(let i=1;i<data.length;i++){const p=data[i-1],q=data[i];const dt=Math.max(0,Math.min(hi,q.x)-Math.max(lo,p.x));sum+=dt*1e-9*Math.max(0,-device.s*(p.ib+q.ib)/2);}
        return [['A–B 时间差',fmt(y-x)+' ns'],['A–B 抽取电荷',eng(sum,'C')],['存储时间',fmt(an.storage)+' ns'],['下降时间',fmt(an.fall)+' ns']];}};
  }
  function frequency(){
    const an=state.analysis,short=mode==='h21',data=an.samples.map(p=>({...p,x:Math.log10(p.f),db:20*Math.log10(short?p.h21:p.av)}));
    return {min:0,max:12,logX:true,unit:'频率 [Hz] · 对数坐标',initA:6,
      tools:opt('mode','测试接法',[['h21','集电极交流短路'],['gain','带负载共射放大器']],mode),
      rows:[row(short?'电流增益 [dB]':'电压增益 [dB]',[line(data,'db',short?'|h21|':'|Av|')],{mark:short&&an.ft?{x:Math.log10(an.ft),y:0}:!short&&an.bw?{x:Math.log10(an.bw),y:20*Math.log10(Math.abs(an.gain))-3.01}:null})],
      note:short?'发射极交流接地，集电极交流短路；0 dB 交点给出 fT。':'外部源电阻、发射极电阻与交流负载均参与计算；带宽取相对低频增益下降 3 dB 的首个交点。',
      measure:x=>{const p=nearest(data,x);return [['测量频率',eng(10**x,'Hz')],['增益',fmt(p.db)+' dB'],['fT',eng(an.ft,'Hz')],['共射带宽',eng(an.bw,'Hz')]];}};
  }
  return {mount,render};
})();
