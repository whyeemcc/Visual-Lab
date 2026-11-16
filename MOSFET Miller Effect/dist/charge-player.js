// Charges use pC in the incremental fixtures and nC in the switching fixture.
// A packet follows conventional current. Its position is a function of charge,
// so playing backwards by scrubbing reproduces the same state at the same time.
window.MillerChargePlayer = (() => {
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  const positive='#087252', negative='#82458d';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const fmt=v=>Number(v.toPrecision(3)).toString();
  const routes={
    charge:{
      gs:[138,143],gd:[210,77],
      input:'M61 135V77H138',toGS:'M138 77V140',fromGS:'M138 146V205',
      toGD:'M138 77H207',fromGD:'M213 77H340V132'
    },
    ac:{
      gs:[138,151],gd:[218,54],
      input:'M31 151V99H57l4 -6 6 12 6 -12 6 12 6 -12 4 6h49',toGS:'M138 99V148',fromGS:'M138 154V210',
      toGD:'M138 99V54H215',fromGD:'M221 54H304V99'
    },
    switch:{
      gs:[132,200],gd:[180,137],
      input:'M39 191V176H66l4 -6 6 12 6 -12 6 12 6 -12 4 6h34',toGS:'M132 176V197',fromGS:'M132 203V228',
      toGD:'M132 176V137H177',fromGD:'M183 137H235V114'
    }
  };
  function svgNode(parent,name,attrs={}){
    const el=document.createElementNS(ns,name);
    for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
    parent.appendChild(el);
    return el;
  }
  function overlay(svg,mode){
    // The five paths terminate at the plates; none crosses a dielectric.
    const geom=routes[mode],g=svgNode(svg,'g',{'aria-hidden':true,class:'charge-overlay'});
    function stream(path){
      const rail=svgNode(g,'path',{d:path,fill:'none',stroke:'none'});
      const length=rail.getTotalLength(),count=Math.max(1,Math.round(length/27));
      const dots=Array.from({length:count},()=>svgNode(g,'circle',{r:2.8,fill:positive,stroke:'white','stroke-width':.65}));
      return (charge,current)=>{
        const visible=Math.abs(current)>1e-12;
        for(let i=0;i<count;i++){
          const dot=dots[i];dot.style.display=visible?'':'none';
          if(!visible)continue;
          const cycle=(charge+i+.5)/count;
          const at=rail.getPointAtLength((cycle-Math.floor(cycle))*length);
          dot.setAttribute('cx',at.x);dot.setAttribute('cy',at.y);
        }
      };
    }
    function plateBank(center,vertical){
      const cells=[];
      for(const side of [-1,1]){
        const plate=[];
        for(let k=0;k<16;k++){
          const across=(k%4-1.5)*5.5,depth=side*(6+Math.floor(k/4)*4.8);
          plate.push(svgNode(g,'circle',{cx:center[0]+(vertical?across:depth),
            cy:center[1]+(vertical?depth:across),r:2.25,stroke:'white','stroke-width':.5}));
        }
        cells.push(plate);
      }
      return charge=>{
        cells.forEach((plate,side)=>{
          plate.forEach((dot,k)=>{
            const fraction=clamp(Math.abs(charge)-k,0,1);
            dot.style.display=fraction?'':'none';
            if(fraction){
              dot.setAttribute('fill',(side===0?charge:-charge)>0?positive:negative);
              dot.setAttribute('opacity',fraction);
            }
          });
        });
      };
    }
    const input=stream(geom.input),gsIn=stream(geom.toGS),gsOut=stream(geom.fromGS),
      gdIn=stream(geom.toGD),gdOut=stream(geom.fromGD),gs=plateBank(geom.gs,true),gd=plateBank(geom.gd,false);
    return (frame,unit)=>{
      const qs=frame.qgs/unit,qd=frame.qgd/unit;
      input(qs+qd,frame.igs+frame.igd);
      gsIn(qs,frame.igs);gsOut(qs,frame.igs);
      gdIn(qd,frame.igd);gdOut(qd,frame.igd);
      gs(qs);gd(qd);
    };
  }
  // Both time and |ΔQg| increase along a switching trace. Interpolate on the
  // physical axis so scrubbing on the charge plot returns the matching time.
  function interpolate(samples,key,value){
    let lo=0,hi=samples.length-1;
    while(lo<hi){const m=(lo+hi)>>1;if(samples[m][key]<value)lo=m+1;else hi=m;}
    const b=samples[lo];
    if(!lo||b[key]===value)return b;
    const a=samples[lo-1],f=clamp((value-a[key])/(b[key]-a[key]),0,1);
    const out={};
    for(const k of ['t','x','vg','vd','qgs','qgd','igs','igd'])out[k]=a[k]+f*(b[k]-a[k]);
    return out;
  }
  function chargeStep(samples){
    let peak=0;
    for(const p of samples)peak=Math.max(peak,Math.abs(p.qgs),Math.abs(p.qgd));
    if(!peak)return 1;
    const raw=peak/16,decade=10**Math.floor(Math.log10(raw));
    return [1,2,2.5,5,10].find(k=>k*decade>=raw)*decade;
  }
  function mount(host,diagram,scope){
    const find=name=>host.querySelector('[data-'+name+']');
    const play=find('play'),timeInput=find('time'),speed=find('speed'),jump=find('jump');
    const output={};
    for(const key of ['phase','vg','vd','igs','igd','qgs','qgd','guide','scale','time-value'])output[key]=find(key);
    let run,samples,draw,lastSvg,quantum,t,start,end,frequency;
    let request=null,lastPaint=null,realDuration;
    function pause(){
      if(request!==null)cancelAnimationFrame(request);
      request=null;lastPaint=null;play.textContent='播放';play.setAttribute('aria-pressed','false');
    }
    function drawTime(value,updateScope=false){
      t=clamp(value,start,end);
      const f=interpolate(samples,'t',t);
      draw(f,quantum);
      const norm=(t-start)/(end-start);
      timeInput.value=Math.round(norm*10000);
      output['time-value'].textContent=fmt(t)+' ns';
      timeInput.setAttribute('aria-valuetext',output['time-value'].textContent);
      const power=run.mode==='switch',ac=run.mode==='ac';
      const currentUnit=power?' A':ac?' µA':' mA',qUnit=power?' nC':' pC';
      for(const key of ['vg','vd'])output[key].textContent=fmt(ac?1000*f[key]:f[key])+(ac?' mV':' V');
      for(const key of ['igs','igd'])output[key].textContent=fmt(f[key])+currentUnit;
      for(const key of ['qgs','qgd'])output[key].textContent=fmt(f[key])+qUnit;
      if(power){
        const phase=t<run.bandStart?'转换前':t<=run.bandEnd?'漏压转换中':'转换后';
        output.phase.textContent=(run.on?'开通 · ':'关断 · ')+phase;
        if(run.disconnected)output.guide.textContent='Cgd 已断开，栅极电流全部流入 Cgs 支路。漏压仍会因沟道电流与 Cds 充放电而变化。';
        else if(phase==='漏压转换中'){
          const action=run.on?'下降':'上升';
          const redistribution=f.igs*f.igd<0 && Math.abs(f.igs)>.001*Math.abs(f.igd);
          const reason=redistribution?'两条支路的电流方向相反，Cgs 与 Cgd 之间也在转移电荷。':'栅极电流在 Cgs 与 Cgd 间分流。';
          output.guide.textContent='漏压正在'+action+'。'+reason+'栅压斜率由 Igs / Cgs 决定，此刻为 '+fmt(f.igs*1000/run.cgs)+' V/ns。';
        }else output.guide.textContent=phase==='转换前'?'观察驱动端的绿点如何在 G 节点分流。点击「定位转换中点」可与漏压快速变化时的支路电流对照。':'主要漏压摆幅已完成。比较两支路的电流与极板上的点数，观察栅压接近最终驱动电压。';
      }else if(ac){
        output.phase.textContent='小信号周期 · '+Math.round(norm*360)+'°';
        output.guide.textContent='取波形游标 A 的频率 '+fmt(frequency)+' Hz，以 10 mV 峰值激励播放一周期。极板点数表示相对直流偏置的电荷变化。';
      }else{
        output.phase.textContent=t<0?'斜坡前':t<run.rise?'栅压斜坡':'电压保持';
        output.guide.textContent='极板成对积累等量异号电荷。试选「同向跟随」，观察 Cgd 两端电压差恒定时的电流。';
      }
      if(updateScope&&!ac)scope.moveA(f.x);
    }
    function initSamples(data){
      samples=data;start=data[0].t;end=data[data.length-1].t;quantum=chargeStep(data);
      realDuration=run.mode==='switch'?Math.min(40000,Math.max(12000,3000*(end-start)/(run.bandEnd-run.bandStart))):10000;
      output.scale.textContent='每个满点 = '+fmt(quantum)+(run.mode==='switch'?' nC':' pC');
    }
    function setFrequency(f){
      const fraction=samples&&end>start?clamp((t-start)/(end-start),0,1):0;
      frequency=f;initSamples(run.cycle(f));drawTime(start+(Number.isFinite(fraction)?fraction:0)*(end-start));
    }
    function load(config){
      pause();run=config;
      const svg=diagram.querySelector('svg');
      if(svg!==lastSvg){draw=overlay(svg,run.mode);lastSvg=svg;}
      jump.hidden=run.mode!=='switch'||!Number.isFinite(run.bandStart);
      find('vg-label').textContent=run.mode==='switch'?'VGS':'ΔVG';
      find('vd-label').textContent=run.mode==='switch'?'VDS':'ΔVD';
      if(run.mode==='ac'){samples=null;setFrequency(scope.cursorA);}
      else{
        initSamples(run.samples);
        drawTime(interpolate(samples,'x',scope.cursorA).t);
      }
    }
    function follow(x){
      if(!run)return;
      if(run.mode==='ac'){if(x!==frequency)setFrequency(x);return;}
      const next=interpolate(samples,'x',x).t;
      if(Math.abs(next-t)>(end-start)*1e-10){pause();drawTime(next);}
    }
    function tick(timestamp){
      if(lastPaint===null)lastPaint=timestamp;
      const dt=timestamp-lastPaint;
      if(dt>=30){
        lastPaint=timestamp;
        drawTime(t+(end-start)*dt*Number(speed.value)/realDuration,true);
        if(t>=end){pause();return;}
      }
      request=requestAnimationFrame(tick);
    }
    function resume(){
      pause();
      if(t>=end)drawTime(start,true);
      play.textContent='暂停';play.setAttribute('aria-pressed','true');
      request=requestAnimationFrame(tick);
    }
    play.onclick=()=>request===null?resume():pause();
    find('restart').onclick=()=>{drawTime(start,true);resume();};
    jump.onclick=()=>{pause();drawTime((run.bandStart+run.bandEnd)/2,true);};
    timeInput.oninput=()=>{pause();drawTime(start+(end-start)*timeInput.value/10000,true);};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
    return {load,follow};
  }
  return {mount};
})();
