(() => {
  const $=id=>document.getElementById(id), M=RingModel,D=RingDevice;
  const fields=[
    ['loop','stages','总级数（含 NAND）','级',3,9,2],
    ['loop','vdd','电源 VDD','V',0.8,1.6,0.05],
    ['drive','tn','NMOS 下拉','ps',8,100,1],
    ['drive','tp','PMOS 上拉','ps',8,100,1],
    ['startup','load','每级附加电容','fF',0,30,1],
    ['startup','on','EN 拉高时刻','ns',0.25,2,0.25],
    ['startup','width','EN 高脉宽','ns',1,36,0.5],
    ['startup','leak','每级背景漏电','nA',0,100,1],
    ['startup','duration','仿真时长','ns',4,40,1]
  ];
  let draft={...M.defaults},active,result,probe=0,timer,worker,serial=0,frame=0,playing=false;
  let preset='base';
  const scope=new VoltageScope($('plot'),(t,v)=>{
    $('scrub').value=t/result.end*10000;
    $('cursor-read').textContent=(t/1000).toFixed(3)+' ns · Q'+(probe+1)+' '+v[probe].toFixed(3)+' V';
    $('en-state').textContent='EN '+v[active.stages].toFixed(2)+' V';
    $('ring-voltage').textContent=v[probe].toFixed(3)+' V';
    $('ring-time').textContent='Q'+(probe+1)+'  /  '+(t/1000).toFixed(3)+' ns';
    document.querySelectorAll('.gate').forEach((g,i)=>{
      const f=v[i]/active.vdd;
      g.querySelector('.symbol').setAttribute('fill','hsl(145 35% '+(14+39*f)+'%)');
    });
  },stop);
  function setup(){
    for(const [group,key,title,unit,min,max,step] of fields){
      const box=document.createElement('div');box.className='field';
      box.innerHTML='<div class="row"><label for="'+key+'">'+title+'</label><output for="'+key+'" id="val-'+key+'"></output></div><input id="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'">';
      $(group).append(box);
      $(key).oninput=e=>{draft[key]=+e.target.value;change();};
    }
    $('enabled').onchange=e=>{draft.enabled=e.target.checked;change();};
    $('loaded').onchange=e=>{draft.loaded=e.target.checked;change();};
    $('preset').onchange=e=>apply(e.target.value);$('reset').onclick=()=>apply(preset);
    $('probe').onchange=e=>selectProbe(+e.target.value);
    $('notes-open').onclick=()=>$('notes').showModal();$('notes-close').onclick=()=>$('notes').close();
    $('play').onclick=togglePlay;
    $('scrub').oninput=e=>{if(result){stop();scope.seek(result.end*e.target.value/10000,true);}};
    $('zoom-in').onclick=()=>scope.zoom(.5);$('zoom-out').onclick=()=>scope.zoom(2);$('fit').onclick=()=>scope.zoom(Infinity);
    for(const id of ['stack','overlay'])$(id).onclick=()=>{
      scope.stacked=id==='stack';$('stack').setAttribute('aria-pressed',scope.stacked);$('overlay').setAttribute('aria-pressed',!scope.stacked);
      scope.dirty=true;scope.draw();
    };
    $('csv').onclick=exportWave;
    apply('base');
  }
  function sync(){
    for(const [,key,,unit] of fields){$(key).value=draft[key];$('val-'+key).textContent=draft[key]+' '+unit;}
    $('enabled').checked=draft.enabled; $('on').disabled=$('width').disabled=!draft.enabled;
    $('loaded').checked=draft.loaded;$('load').disabled=!draft.loaded;
  }
  function change(){$('preset').value='custom';sync();schedule();}
  function apply(k){preset=k;draft={...M.presets[k]};$('preset').value=k;probe=0;sync();schedule();}
  function schedule(){
    const id=++serial,p={...draft};
    clearTimeout(timer);worker?.terminate();worker=null;stop();
    $('status').textContent='正在积分闭环节点电压…';$('csv').disabled=true;
    timer=setTimeout(()=>{
      const finish=r=>{
        if(id!==serial)return;
        worker?.terminate();worker=null;active=p;result=r;
        probe=Math.min(probe,p.stages-1);
        $('probe').innerHTML=r.volts.map((_,i)=>'<option value="'+i+'">Q'+(i+1)+'</option>').join('');
        $('probe').value=probe;drawRing();scope.setData({...r,volts:[...r.volts,r.en]},p);measure();
        $('csv').disabled=false;$('status').textContent='积分完成 · '+r.time.length.toLocaleString()+' 个采样时刻';
      };
      function local(){try{finish(M.solve(p));}catch(e){$('status').textContent='求解失败：'+e.message;}}
      if(location.protocol==='file:'||!window.Worker){local();return;}
      try{worker=new Worker('worker.js');worker.onmessage=e=>finish(e.data);worker.onerror=e=>{e.preventDefault();if(id===serial){worker.terminate();worker=null;local();}};worker.postMessage(p);}catch{local();}
    },60);
  }
  function selectProbe(i){if(!result)return;probe=i;$('probe').value=i;drawRing();measure();scope.seek(scope.time);}
  function drawRing(){
    const n=active.stages,svg=$('schematic');
    const first=76,pitch=78,last=first+(n-1)*pitch,out=last+55,width=out+28;
    svg.setAttribute('viewBox','0 0 '+width+' 158');
    svg.style.minWidth=Math.round(width*.82)+'px';
    const wire=d=>'<path d="'+d+'" fill="none" stroke="#c3ddc9" stroke-width="1.8" stroke-linejoin="round"/>';
    let html='<title>EN 接 NAND 上输入，末级 OUT 经下方导线接回 NAND 下输入。</title>';
    html+=wire('M22 49 V66 H'+first)+wire('M'+out+' 74 V133 H22 V82 H'+first);
    html+='<text id="en-state" x="12" y="40" fill="#efce91" font-family="monospace" font-size="11">EN</text>';
    for(let i=0;i<n;i++){
      const x=first+i*pitch, selected=i===probe, color=scope.colors[i];
      const tip=i?28:36, bubble=tip+3.5, contact=i===n-1?out:x+tip+16;
      const node='Q'+(i+1);
      html+='<g class="gate" transform="translate('+x+' 74)">';
      html+=wire('M'+(bubble+3.5)+' 0 H'+(i===n-1?out-x:pitch));
      const shape=i?'M0 -15 L28 0 L0 15 Z':'M0 -16 H20 A16 16 0 0 1 20 16 H0 Z';
      html+='<path class="symbol" d="'+shape+'" stroke="#cdf5ce" stroke-width="1.8"/><circle cx="'+bubble+'" cy="0" r="3.5" fill="#163128" stroke="#cdf5ce" stroke-width="1.5"/>';
      html+='<text x="15" y="34" text-anchor="middle" font-size="11" font-family="monospace" fill="#b0c7af">'+(i?'INV '+i:'NAND')+'</text>';
      html+='<g class="probe-point" transform="translate('+(contact-x)+' 0)" role="button" tabindex="0" aria-label="探测 '+node+'" aria-pressed="'+selected+'" style="cursor:pointer"><rect x="-13" y="-40" width="32" height="54" fill="transparent"/><circle r="'+(selected?4.8:3)+'" fill="'+color+'" stroke="'+(selected?'white':color)+'"/><text y="-14" text-anchor="middle" fill="'+color+'" font-family="monospace" font-size="12">'+node+'</text>';
      if(i===n-1)html+='<text y="-31" text-anchor="middle" fill="#eef5ea" font-family="monospace" font-size="12">OUT</text>';
      html+='</g></g>';
    }
    svg.innerHTML=html;
    svg.querySelectorAll('.probe-point').forEach((g,i)=>{
      g.onclick=()=>selectProbe(i);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectProbe(i);svg.querySelectorAll('.probe-point')[i].focus();}};
    });
    $('cap').textContent='1 NAND + '+(n-1)+' INV · EN 高有效';
  }
  function measure(){
    const m=M.analyze(result,active,probe),p=m.period,n=active.stages;
    $('freq').textContent=p?(1000/p).toFixed(3):'—';
    $('period').textContent=p?(p/1000).toFixed(3)+' ns':'—';
    $('duty').textContent=p?(100*m.duty).toFixed(2)+' %':'—';
    $('delay').textContent=p?(p/(2*n)).toFixed(2)+' ps':'—';
    $('measurement').textContent=p?'来自 Q'+(probe+1)+' 最近 '+m.k+' 个完整周期。':!active.enabled?'EN 保持低电平，NAND 将 Q1 钳位至高电平。':'EN 高电平窗口内未测到合格周期，可增加脉宽或仿真时长。';
    renderExtraction(m);
    $('threshold').textContent='½ VDD = '+(active.vdd/2).toFixed(3)+' V';
    const fmt=x=>x===null?'—':x.toFixed(2);
    $('delay-table').innerHTML=m.stages.map(({rise,fall},i)=>'<tr><th>'+(i?'INV '+i:'NAND')+'</th><td>Q'+((i+n-1)%n+1)+' → Q'+(i+1)+'</td><td>'+fmt(fall)+'</td><td>'+fmt(rise)+'</td><td>'+fmt(rise===null||fall===null?null:rise-fall)+'</td></tr>').join('');
  }
  function renderExtraction(m){
    const n=active.stages, ns=t=>(t/1000).toFixed(3),fmt=(x,d,u)=>x===null?'—':x.toFixed(d)+' '+u;
    const readings=[
      ['周期 T / 频率 f','T = Δt / K；f = 1 / T',m.k?fmt(m.period/1000,3,'ns')+' / '+fmt(1000/m.period,3,'GHz'):'—','从同一节点连续上升穿越 ½ VDD 的时刻计时。K 为完整周期数，Δt 为所选周期的总时长。'],
      ['环路延迟 / 单级平均延迟','t环 = T / 2；t级 = T / (2N)',m.k?fmt(m.period/2,2,'ps')+' / '+fmt(m.period/(2*n),2,'ps'):'—','一次翻转平均绕环一周用 T/2；回到同一极性需两周。N = '+n+'，包含 NAND。逐级表分别测量各门的实际上升和下降延迟。'],
      ['静态电源电流 IDDQ','IDDQ = ∫静态 IDD(t) dt / Δt静',fmt(m.iddq*1e6,2,'nA'),'取 EN 拉高前、已处于直流稳态的窗口。理想 MOS 截止时电流为零；可设置每级背景漏电，观察静态基线。'],
      ['工作电源电流 IDDA','IDDA = ∫工作 IDD(t) dt / Δt',fmt(m.idda===null?null:m.idda*1000,2,'µA'),'对 EN 高电平内完整振荡周期的电源电流积分。IDD(t) 为所有接 VDD 的 PMOS 支路电流之和，加上背景漏电；EN 驱动器在测量边界之外。'],
      ['环级有效开关电流 Ieff','Ieff,RO = IDDA − IDDQ',fmt(m.ieff===null?null:m.ieff*1000,2,'µA'),'本页采用整环扣除静态基线后的平均开关电流。单管驱动能力另有双偏置定义 Ieff,MOS = (IH + IL)/2，需由单管 I–V 特性提取。'],
      ['有效电容 Ceff · 整环 / 平均每级','Ceff,RO = Ieff,RO / (VDD · f)；Ceff,级 = Ceff,RO / N',m.k?fmt(m.ceff,2,'fF')+' / '+fmt(m.ceff/n,2,'fF'):'—','每周期从电源取得的净电荷为 Ieff,RO × T，再除以电源电压得到等效电容。它包含翻转时的直通电流及内部节点充电贡献，可与设置的节点负载比较。']
    ];
    $('metrics').innerHTML=readings.map(([name,formula,value,note])=>'<div class="metric"><div><h3>'+name+'</h3><strong>'+value+'</strong></div><code>'+formula+'</code><p>'+note+'</p></div>').join('');
    const working=m.windows.map(([a,b])=>ns(a)+'–'+ns(b)).join('、');
    $('windows').textContent='静态窗口 '+ns(m.quietEnd/2)+'–'+ns(m.quietEnd)+' ns；工作窗口 '+(m.k?working+' ns（'+m.k+' 个完整周期）':'暂无完整周期')+'。';
    const r=result,w=720,h=75,max=Math.max(1e-8,r.idd.reduce((a,b)=>Math.max(a,b),0)),x=t=>t/r.end*w;
    const band=(a,b,color)=>'<rect x="'+x(a)+'" y="0" width="'+(x(b)-x(a))+'" height="'+h+'" fill="'+color+'"/>';
    let plot=band(m.quietEnd/2,m.quietEnd,'#f1e5ca')+m.windows.map(([a,b])=>band(a,b,'#d9eddb')).join('');
    const xy=[];for(let pixel=0;pixel<w;pixel++){
      const from=Math.floor(pixel*(r.idd.length-1)/w),to=Math.floor((pixel+1)*(r.idd.length-1)/w);
      let lo=from,hi=from;
      for(let j=from+1;j<=to;j++){if(r.idd[j]<r.idd[lo])lo=j;if(r.idd[j]>r.idd[hi])hi=j;}
      for(const j of [Math.min(lo,hi),Math.max(lo,hi)])xy.push(x(r.time[j]).toFixed(2)+','+(h-2-r.idd[j]/max*(h-6)).toFixed(2));
    }
    $('current-chart').innerHTML=plot+'<polyline fill="none" stroke="#276346" stroke-width="1.2" points="'+xy.join(' ')+'"/>';
    $('current-scale').textContent='IDD(t) · 0–'+(max*1000).toFixed(2)+' µA';
    $('current-end').textContent=ns(r.end)+' ns';
  }
  function stop(){playing=false;cancelAnimationFrame(frame);$('play').textContent='▶ 播放';}
  function togglePlay(){
    if(!result)return;if(playing){stop();return;}
    if(scope.time>=result.end)scope.seek(0,true);
    let last=performance.now();playing=true;$('play').textContent='Ⅱ 暂停';
    function tick(now){if(!playing)return;scope.seek(scope.time+(now-last)*result.end/10000,true);last=now;if(scope.time>=result.end)stop();else frame=requestAnimationFrame(tick);}
    frame=requestAnimationFrame(tick);
  }
  function exportWave(){
    if(!result)return;const rows=['time_ps,EN_V,IDD_mA,'+result.volts.map((_,i)=>'Q'+(i+1)+'_V').join(',')];
    result.time.forEach((t,j)=>rows.push([t.toFixed(5),result.en[j].toFixed(7),result.idd[j].toFixed(9),...result.volts.map(v=>v[j].toFixed(7))].join(',')));
    const url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='ring-oscillator-'+active.stages+'stage.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  setup();
})();
