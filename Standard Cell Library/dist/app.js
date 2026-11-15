(()=>{
  const $=id=>document.getElementById(id),{cells,groups}=Library;
  let cell,view='sch',pins={},q=0,held=0,message='';
  const enabled=Object.fromEntries(Object.keys(Drawings.layers).map(k=>[k,true]));
  $('group').innerHTML='<option value="">所有类别</option>'+groups.map(g=>'<option>'+g+'</option>').join('');
  $('query').oninput=filter;$('group').onchange=filter;
  function matches(){
    const query=$('query').value.trim().toLowerCase();
    return cells.filter(c=>(!$('group').value||c.group===$('group').value)&&[c.id,c.name,c.use,c.group,...c.pins].join(' ').toLowerCase().includes(query));
  }
  function filter(){
    const hits=matches();
    if(hits.length&&!hits.includes(cell)){select(hits[0]);return;}
    list();
  }
  function list(){
    const hits=matches();$('count').textContent=hits.length===cells.length?cells.length+' 个单元':hits.length+' / '+cells.length+' 个单元';
    $('detail').hidden=!hits.length;
    $('list').innerHTML=hits.length?groups.map(g=>{
      const set=hits.filter(c=>c.group===g);if(!set.length)return '';
      return '<p class="groupname">'+g+'</p>'+set.map(c=>'<button class="item" data-cell="'+c.id+'" aria-current="'+(c===cell)+'"><b>'+c.id+'</b><span>'+c.name+'</span></button>').join('');
    }).join(''):'<p class="empty">没有匹配的单元。请更换关键词或类别。</p>';
    $('list').querySelectorAll('button').forEach(b=>b.onclick=()=>select(cells.find(c=>c.id===b.dataset.cell)));
  }
  function select(c){cell=c;pins=Object.fromEntries(c.pins.map(p=>[p,0]));q=0;held=0;message='演示初态 Q = 0。';
    try{history.replaceState(null,'','#'+c.id);}catch{}
    $('name').textContent=c.id;$('cn').textContent=c.name;$('family').textContent=c.group;$('expr').textContent=c.expr;
    $('principle').textContent=c.principle;$('use').textContent=c.use;list();signals();draw();
  }
  function toggle(pin){
    const before=pins.CLK;pins[pin]^=1;
    if(cell.id==='LATCH'){if(pins.EN)q=pins.D;message=pins.EN?'EN 高，Q 跟随 D。':'EN 低，反馈环保持 Q。';}
    else if(cell.id==='ICG'){if(!pins.CLK)held=pins.EN;q=pins.CLK&held;message='锁存使能 Eₗ = '+held+'；'+(pins.CLK?'高相期间保持。':'低相期间跟随 EN。');}
    else if(!cell.fn){
      if(cell.id==='DFFR'&&pins.RST){q=0;message='RST 有效，Q 已异步清零。';}
      else if(pin==='CLK'&&!before&&pins.CLK){const source=cell.id==='SDFF'&&pins.SE?'SI':'D';q=pins[source];message='CLK 上升沿：采样 '+source+' = '+q+'。';}
      else message='未出现有效采样沿，Q 保持 '+q+'。';
    }
    signals(pin);if(view==='sch')draw();
  }
  function signals(focus){
    $('tester').hidden=!cell.out;if(!cell.out)return;
    const val=cell.fn?cell.fn(pins):q;
    $('mode').textContent=cell.pins.length?'点击输入切换 0 / 1':'常量输出';
    $('signals').innerHTML=cell.pins.map(p=>'<button data-pin="'+p+'" aria-label="切换 '+p+'" aria-pressed="'+Boolean(pins[p])+'">'+p+'　'+pins[p]+'</button>').join('')+'<span class="output">'+cell.out+'　'+val+'</span>';
    $('signals').querySelectorAll('button').forEach(b=>b.onclick=()=>toggle(b.dataset.pin));
    if(focus)$('signals').querySelector('[data-pin="'+focus+'"]').focus();
    $('state-msg').textContent=cell.fn?'':cell.id==='ICG'&&!message.includes('锁存使能')?'低相锁存 EN；升高 CLK 可观察门控输出。':message;
  }
  function draw(){
    const plan=view==='lay',physical=!cell.blocks.length;
    $('sch').setAttribute('aria-pressed',!plan);$('lay').setAttribute('aria-pressed',plan);
    $('diagram-note').textContent=plan?cell.layout+' 教学俯视图；重复网名相连，省略信号金属走线。':physical?'物理单元的电气等效与供电连接。':'每个框为一个连接段，同名端口电气相连。带栅极圆圈的是 PMOS；已知输入控制的导通管以绿色显示。';
    const labels={fin:'鳍 / 有源区',gate:'栅',contact:'接触',metal:'电源金属'};
    const masks=physical?({FILL:['metal'],ENDCAP:['fin','gate','metal'],TAP:['contact','metal'],DECAP:Object.keys(labels)})[cell.id]:Object.keys(labels);
    $('layers').innerHTML=plan?'<div class="layer-controls">'+masks.map(k=>'<label><input data-mask="'+k+'" type="checkbox" '+(enabled[k]?'checked':'')+'><i class="swatch" style="background:'+Drawings.layers[k]+'"></i>'+labels[k]+'</label>').join('')+'</div>':'';
    function fig(title,body){return '<div class="figure"><h4>'+title+'</h4><div class="figbody">'+body+'</div></div>';}
    const signalMap={...pins};if(cell.out)signalMap[cell.out]=cell.fn?cell.fn(pins):q;
    if('CLK' in pins)signalMap.CKB=1-pins.CLK;
    $('diagrams').className='schemes'+(plan?' plan':'');
    $('diagrams').innerHTML=physical?fig(cell.id,Drawings.physical(cell.id,plan)):cell.blocks.map(b=>fig(b.name,plan?Drawings.layout(b,cell.id.startsWith('CLK')):Drawings.circuit(b,signalMap))).join('');
    function visibility(){document.querySelectorAll('#diagrams [data-layer]').forEach(g=>g.style.display=enabled[g.dataset.layer]?'':'none');}
    if(plan){visibility();$('layers').querySelectorAll('input').forEach(el=>el.onchange=()=>{enabled[el.dataset.mask]=el.checked;visibility();});}
  }
  for(const v of ['sch','lay'])$(v).onclick=()=>{view=v;draw();};
  select(cells.find(c=>c.id===location.hash.slice(1).toUpperCase())||cells[0]);
})();
