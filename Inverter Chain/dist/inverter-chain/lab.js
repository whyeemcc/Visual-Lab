(() => {
  'use strict';
  const P=InverterPhysics, $=id=>document.getElementById(id), icon=InverterUI.icon;
  const req=new URLSearchParams(location.search).get('preset');
  let preset=Object.hasOwn(P.presets,req)?req:'basic', draft={...P.presets[preset]};
  let result=null,active=null,selected=0,worker=null,timer=0,job=0,playing=false,frame=0,stageDelays=[];
  const spec={
    stages:['反相器数量','级',1,10,1,true],vdd:['电源 VDD','V',0.8,1.8,0.05,true],
    tn:['NMOS · 下拉','ps',5,180,1,true],tp:['PMOS · 上拉','ps',5,180,1,true],
    load:['每处附加电容','fF',0,60,0.5,true],period:['周期','ns',0.1,5,0.01],
    duty:['占空比','%',1,99,1],low:['低电平','V',0,1.8,0.01],high:['高电平','V',0.01,1.8,0.01],
    rise:['上升时间','ps',1,1000,1],fall:['下降时间','ps',1,1000,1],start:['起始延时','ns',0,5,0.01],cycles:['周期数','次',1,8,1]
  };
  const diagram=new ChainDiagram($('diagram'),chooseStage);
  const scope=new VoltageScope($('plot'),(time,values)=>{
    $('time-label').textContent='t = '+(time/1000).toFixed(3)+' ns';
    $('scrub').value=Math.round(time/result.end*10000);
    diagram.update(values);
  },stop);
  function buildFields(){
    document.querySelectorAll('[data-field]').forEach(el=>{
      const k=el.dataset.field,[label,unit,min,max,step,slider]=spec[k], attrs=' min="'+min+'" max="'+max+'" step="'+step+'"';
      el.classList.add('field');
      el.innerHTML='<div class="fieldtop"><label for="n-'+k+'">'+label+'</label><span class="numberbox"><input type="number" id="n-'+k+'"'+attrs+' required><small>'+unit+'</small></span></div>'+
        (slider?'<input type="range" id="r-'+k+'" aria-label="'+label+'滑块"'+attrs+'>':'');
      const number=$('n-'+k),range=$('r-'+k);
      number.addEventListener('input',()=>change(k,number.valueAsNumber,number.validity.valid));
      if(range)range.addEventListener('input',()=>{number.value=range.value;change(k,+range.value,true);});
    });
  }
  function syncFields(){
    for(const k of Object.keys(spec)){
      $('n-'+k).value=draft[k];if($('r-'+k))$('r-'+k).value=draft[k];
    }
    $('loaded').checked=draft.loaded;$('mode').value=draft.mode;$('points').value=draft.points;syncState();
  }
  function syncState(){
    const pwl=draft.mode==='pwl', noInterconnect=draft.stages===1;
    $('pulse-fields').hidden=pwl;$('pwl-fields').hidden=!pwl;$('loaded').disabled=noInterconnect;
    $('n-load').disabled=$('r-load').disabled=!draft.loaded||noInterconnect;
    $('loadnote').textContent=noInterconnect?'单级链无级间连接，输出寄生为 2 fF。':'级间总电容 = 4 fF 固有负载 + 附加电容。';
    for(const k of ['low','high'])$('n-'+k).max=draft.vdd;
  }
  function change(k,value,valid){
    $('preset').value='custom';
    if(k==='vdd' && valid && draft.high===draft.vdd){draft.high=value;$('n-high').value=value;}
    draft[k]=value;
    if(valid&&$('r-'+k))$('r-'+k).value=value;
    syncState();schedule();
  }
  function issue(){
    for(const k of Object.keys(spec)){
      if(k==='load' && (!draft.loaded||draft.stages===1))continue;
      if(draft.mode==='pwl'&&['period','duty','low','high','rise','fall','start','cycles'].includes(k))continue;
      if(!$('n-'+k).validity.valid||!Number.isFinite(draft[k])){
        const [name,unit,min,max,step]=spec[k];throw Error(name+'须为 '+min+'–'+$('n-'+k).max+' '+unit+' 范围内的数值，步进 '+step+'。');
      }
    }
    P.stimulus(draft);
  }
  function setError(message){
    $('error').hidden=false;$('error').textContent=message;
    $('status').textContent='参数待修正';document.querySelector('.workbench').classList.add('is-stale');$('export').disabled=true;
  }
  function schedule(){
    stop();clearTimeout(timer);job++;
    if(worker){worker.terminate();worker=null;}
    try{issue();}catch(e){setError(e.message);return;}
    $('error').hidden=true;
    document.querySelector('.workbench').classList.add('is-stale');$('status').textContent='正在求解…';$('export').disabled=true;
    const id=job,p={...draft};
    timer=setTimeout(()=>solve(id,p),55);
  }
  function solve(id,p){
    function done(r){
      if(id!==job)return;
      if(worker){worker.terminate();worker=null;}
      if(r.error){setError(r.error);return;}
      result=r;active=p;selected=Math.min(p.stages-1,selected);
      const edges=r.volts.map(v=>P.crossings(r.time,v,p.vdd/2));
      stageDelays=edges.slice(1).map((out,i)=>P.delays(edges[i],out));
      renderStageDelays();
      $('which').innerHTML=Array.from({length:p.stages},(_,i)=>'<option value="'+i+'">INV '+(i+1)+'</option>').join('');
      $('which').value=selected;
      diagram.render(p,r,selected);scope.setData(r,p);measure();
      $('error').hidden=true;document.querySelector('.workbench').classList.remove('is-stale');
      $('status').textContent='求解完成 · '+r.time.length.toLocaleString()+' 个时间点';$('export').disabled=false;
    }
    function local(){
      if(id!==job)return;
      try{done(P.simulate(p));}catch(e){setError(e.message);}
    }
    if(location.protocol==='file:'||typeof Worker==='undefined'){local();return;}
    try{
      worker=new Worker('solver-worker.js');
      worker.onmessage=e=>done(e.data);
      worker.onerror=e=>{e.preventDefault();if(id!==job)return;worker.terminate();worker=null;local();};
      worker.postMessage(p);
    }catch{local();}
  }
  function renderStageDelays(){
    const summary=[], details=[];
    const fmt=value=>value===null?'—':value.toFixed(2);
    const table=(headers,rows)=>'<table><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+
      '</tr></thead><tbody>'+rows.map(row=>'<tr><th scope="row">'+row[0]+'</th>'+row.slice(1).map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    for(let i=1;i<stageDelays.length;i++){
      const {rise,fall,events}=stageDelays[i], stage='INV '+(i+1);
      const both=rise!==null && fall!==null;
      summary.push([stage,fmt(fall),fmt(rise),fmt(both?(rise+fall)/2:null),fmt(both?rise-fall:null)]);
      for(const e of events){
        details.push([stage,e.up?'IN ↑ → OUT ↓':'IN ↓ → OUT ↑',fmt(e.input),fmt(e.output),fmt(e.delay)]);
      }
    }
    $('stage-threshold').textContent='½ VDD = '+(active.vdd/2).toFixed(3)+' V';
    $('stage-summary').innerHTML=summary.length?
      table(['反相器','下拉 tPHL','上拉 tPLH','单级 tPD','不平衡量'],summary)+
      '<p class="delay-note">单位 ps。tPHL、tPLH 分别对成功配对的边沿取平均。tPD = (tPLH + tPHL) / 2，不平衡量 = tPLH − tPHL。末级只带输出寄生电容。</p>':
      '<p class="delay-note">将反相器数量设为 2 或更多，即可比较后续各级。</p>';
    $('stage-events').parentElement.hidden=!summary.length;
    $('stage-events').innerHTML=details.length?
      table(['反相器','翻转方向','IN 时刻 (ps)','OUT 时刻 (ps)','OUT − IN (ps)'],details)+
      '<p class="delay-note">— 表示未找到对应的输出穿越。慢输入和不对称驱动可能使 OUT 先于 IN 穿越半电源电压，此时时差为负。</p>':
      '<p class="delay-note">后续各级输入均未穿越阈值。</p>';
  }
  function measure(){
    const m=stageDelays[selected];
    $('measured-stage').textContent='INV '+(selected+1);
    $('measured-rise').textContent=m.rise===null?'—':m.rise.toFixed(1)+' ps';
    $('measured-fall').textContent=m.fall===null?'—':m.fall.toFixed(1)+' ps';
    $('measurehint').textContent=m.rise===null||m.fall===null?'“—” 表示在对应输入翻转窗口内未测到完整的阈值穿越。':'对本次仿真中匹配的上升和下降沿分别取平均。';
  }
  function chooseStage(i){
    if(!active)return;
    selected=i;$('which').value=i;diagram.render(active,result,i);diagram.update(P.read(result,scope.time));measure();
  }
  function updatePlay(){
    $('play').innerHTML=icon(playing?'pause':'play',14);
    $('play').setAttribute('aria-label',playing?'暂停时间游标':'播放时间游标');$('play').title=$('play').getAttribute('aria-label');
  }
  function stop(){playing=false;cancelAnimationFrame(frame);updatePlay();}
  function startPlayback(){
    if(!result)return;if(playing){stop();return;}
    if(scope.time>=result.end)scope.seek(0,true);
    playing=true;updatePlay();let prev=performance.now();
    function tick(now){
      if(!playing)return;
      const next=scope.time+(now-prev)/8000*result.end*Number($('speed').value);
      prev=now;scope.seek(next,true);if(next>=result.end)stop();else frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  function applyPreset(k){
    preset=k;draft={...P.presets[k]};selected=0;$('preset').value=k;scope.visible=undefined;scope.time=undefined;syncFields();schedule();
  }
  buildFields();updatePlay();$('preset').value=preset;syncFields();
  if(window.matchMedia('(max-width:760px)').matches)document.querySelectorAll('.settings details').forEach(d=>d.open=false);
  $('loaded').onchange=()=>change('loaded',$('loaded').checked,true);
  $('mode').onchange=()=>change('mode',$('mode').value,true);
  $('points').oninput=()=>change('points',$('points').value,true);
  $('preset').onchange=e=>applyPreset(e.target.value);
  $('reset').onclick=()=>applyPreset(preset);
  $('which').onchange=e=>chooseStage(+e.target.value);
  function selectView(a,b,callback){for(const [id,other] of [[a,b],[b,a]])$(id).onclick=()=>{
    $(id).setAttribute('aria-pressed','true');$(other).setAttribute('aria-pressed','false');callback(id===a);
  };}
  selectView('logic','mos',logic=>{diagram.mos=!logic;if(active)chooseStage(selected);});
  selectView('stack','overlay',stack=>{scope.stacked=stack;scope.dirty=true;scope.draw();});
  $('play').onclick=startPlayback;
  $('scrub').oninput=e=>{if(!result)return;stop();scope.seek(+e.target.value/10000*result.end,true);};
  $('zoom-in').onclick=()=>scope.zoom(.5);$('zoom-out').onclick=()=>scope.zoom(2);$('fit').onclick=()=>scope.zoom(Infinity);
  $('export').onclick=()=>{
    if(!result)return;
    const cols=result.volts.map((v,j)=>j?'OUT'+j+'_V':'VIN_V');
    const rows=['time_ps,'+cols.join(',')];
    for(let i=0;i<result.time.length;i++)rows.push([result.time[i].toFixed(6),...result.volts.map(v=>v[i].toFixed(7))].join(','));
    const url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='inverter-chain-'+active.stages+'stage.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  schedule();
})();
