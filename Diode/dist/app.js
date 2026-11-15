(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const P = window.DiodePhysics, lessons = window.diodeLessons;
  const specs = {
    na:['受主浓度 Nₐ',14,19,.05,'cm⁻³',true], nd:['施主浓度 Nᴅ',14,19,.05,'cm⁻³',true],
    temp:['温度 T',240,380,1,'K'], area:['结面积 A',1,1000,1,'μm²'],
    tau:['少子寿命 τ',1,1000,1,'ns'], rs:['串联电阻 Rₛ',0,500,1,'Ω'],
    bias:['端口偏压 V',-3,.9,.005,'V'], forward:['正向驱动',.1,1.2,.01,'V'],
    reverse:['反向驱动幅值',.1,5,.05,'V'], pulse:['正向脉宽',1,1500,1,'ns'], load:['外部限流电阻',10,3000,10,'Ω']
  };
  let lesson,params,view,options,device,point;
  const groups = ['入门','进阶','高级'];
  const session = new Map();
  const initial = n => ({params:{...P.defaults,...lessons[n-1].preset},view:lessons[n-1].view,
    options:{formed:n!==1,drift:true,diffusion:true,carrier:'both',direction:'current'}});
  function format(value,unit){
    if(value===0) return '0 '+unit;
    const magnitude=Math.abs(value);
    const [scale,prefix]=[[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'μ'],[1e-9,'n'],[1e-12,'p'],[1e-15,'f']].find(([s])=>magnitude>=s)||[1e-18,'a'];
    return Number((value/scale).toPrecision(4))+' '+prefix+unit;
  }
  function switchLesson(n,scroll=false){
    if(n<1||n>9) return;
    if(lesson) session.set(lesson,{params,view,options});
    lesson=n;
    ({params,view,options}=session.get(n)||initial(n));
    const info=lessons[n-1];
    $('lessonSelect').value=n;
    document.querySelectorAll('.lesson').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.n===n)));
    $('level').textContent=info.group+'　/　实验 '+String(n).padStart(2,'0');
    $('title').textContent=info.title; $('question').textContent=info.question;
    $('theoryTitle').textContent=info.heading;
    $('formula').innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML">'+info.formula+'</math>';
    $('theoryText').textContent=info.text; $('modelNote').textContent=info.note;
    $('previous').disabled=n===1; $('next').disabled=n===9;
    buildSwitches();buildSliders();render();
    if(scroll) document.querySelector('.lesson-head').scrollIntoView({block:'start'});
  }
  function switchView(next){
    view=next;
    buildSliders();render();
  }
  function buildSwitches(){
    const box=$('switches');box.replaceChildren();
    function button(text,fn,selected){
      const b=document.createElement('button');b.textContent=text;
      if(selected!==undefined)b.setAttribute('aria-pressed',String(selected));
      b.onclick=()=>{fn();buildSwitches();buildSliders();render()};box.append(b);
    }
    if(lesson===1)button(options.formed?'分开材料':'形成 PN 结',()=>{options.formed=!options.formed;if(!options.formed)view='space'});
    if(lesson===2){
      button('漂移',()=>options.drift=!options.drift,options.drift);
      button('扩散',()=>options.diffusion=!options.diffusion,options.diffusion);
      function select(key,label,choices){
        const el=document.createElement('select');el.setAttribute('aria-label',label);
        for(const [value,title] of choices)el.add(new Option(title,value));
        el.value=options[key];el.onchange=()=>{options[key]=el.value;render()};box.append(el);
      }
      select('carrier','选择载流子',[['both','电子与空穴'],['electron','仅电子'],['hole','仅空穴']]);
      select('direction','选择方向',[['current','常规电流方向'],['motion','粒子运动方向']]);
    }
    if(lesson===4||lesson===9){
      const presets=lesson===4?[['对称结',1e16,1e16],['单边突变结',1e16,1e18]]:[['轻掺杂 · 雪崩',1e16,3e16],['重掺杂 · 隧穿',2e18,2e18]];
      for(const [name,na,nd] of presets) button(name,()=>{Object.assign(params,{na,nd});if(lesson===9)params.bias=-Number((P.device(params).bv*1.1).toFixed(2))});
    }
  }
  function spec(key){
    if(lesson===9&&key==='bias')return ['电源电压 Vₛ',-Math.ceil(1.4*P.device(params).bv),0,.01,'V'];
    return specs[key];
  }
  function sliderValue(key){
    const value=params[key],unit=spec(key)[4];
    return (spec(key)[5]?value.toExponential(2):Number(value.toFixed(3)))+' '+unit;
  }
  function buildSliders(){
    const keys=new Set(lessons[lesson-1].controls);
    if(view==='time')for(const key of ['forward','reverse','pulse','load','tau','rs'])keys.add(key);
    if(view==='dc'&&lesson>2)keys.add('bias');
    const box=$('sliders');box.replaceChildren();
    for(const key of keys){
      const [label,min,max,step,,log]=spec(key);
      const cell=document.createElement('div');cell.className='slider';
      cell.innerHTML='<div class="switch-line"><label for="input-'+key+'">'+label+'</label><output for="input-'+key+'"></output></div>';
      const input=document.createElement('input');Object.assign(input,{type:'range',min,max,step,id:'input-'+key,value:log?Math.log10(params[key]):params[key]});
      const out=cell.querySelector('output');out.textContent=sliderValue(key);input.setAttribute('aria-valuetext',out.textContent);
      input.oninput=()=>{
        params[key]=log?10**Number(input.value):Number(input.value);
        out.textContent=sliderValue(key); input.setAttribute('aria-valuetext',out.textContent);
        if(lesson===9&&(key==='na'||key==='nd')){
          const bias=$('input-bias');bias.min=spec('bias')[1];params.bias=Math.max(+bias.min,params.bias);
          bias.value=params.bias;bias.previousElementSibling.querySelector('output').textContent=sliderValue('bias');
          bias.setAttribute('aria-valuetext',sliderValue('bias'));
        }
        render();
      };
      cell.append(input);box.append(cell);
    }
  }
  function render(){
    device=P.device(params);point=P.at(device,params.bias,lesson===9?params.load:0);
    const formed=options.formed;
    $('state').textContent=!formed?'材料分离':point.vj===0?'热平衡':point.vj>0?'正向偏置':'反向偏置';
    DiodeDevice.render($('device'),params,point,{...options,device,lesson});
    const readouts=!formed?[['P 区受主',params.na.toExponential(1)+' cm⁻³'],['N 区施主',params.nd.toExponential(1)+' cm⁻³'],['材料','硅 Si'],['温度',params.temp+' K']]:
      lesson===9?[['电源电压',format(point.vs,'V')],['端口电压',format(point.v,'V')],['结电压',format(point.vj,'V')],['端口电流',format(point.i,'A')]]:
      [['结势垒',format(point.barrier,'V')],['耗尽宽度',format(point.w*1e-6,'m')],['结电压',format(point.vj,'V')],['端口电流',format(point.i,'A')]];
    $('readouts').innerHTML=readouts.map(([label,value])=>'<div class="reading"><small>'+label+'</small><b>'+value+'</b></div>').join('');
    $('limit').textContent= !formed?'点击「形成 PN 结」观察接触后的平衡态。':
      [point.highInjection?'已接近或进入高注入区，低注入电流与浓度仅作外推。':'',
       point.flatBand?'已达到平带，耗尽层宽度近似失效。':point.capContinued?'接近平带，电容采用连续延拓。':'',
       (params.na>1e18||params.nd>1e18)?'高掺杂区未计入简并与带隙变窄。':''].filter(Boolean).join(' ');
    document.querySelectorAll('#views button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.view===view));b.disabled=!formed||(lesson<=2&&b.dataset.view!=='space')});
    $('measure').hidden=!formed;
    if(formed)DiodePlots.render({params:{...params},view,lesson,joined:formed});
  }
  groups.forEach(group=>{
    const heading=document.createElement('div');heading.className='group-title';heading.textContent=group;$('lessons').append(heading);
    const optgroup=document.createElement('optgroup');optgroup.label=group;
    lessons.forEach((info,i)=>{if(info.group!==group)return;const n=i+1,b=document.createElement('button');
      b.className='lesson';b.dataset.n=n;b.innerHTML='<span>'+String(n).padStart(2,'0')+'</span>'+info.name;
      b.onclick=()=>switchLesson(n,true);$('lessons').append(b);optgroup.append(new Option(n+' · '+info.name,n));});
    $('lessonSelect').append(optgroup);
  });
  $('lessonSelect').onchange=e=>switchLesson(+e.target.value);
  $('previous').onclick=()=>switchLesson(lesson-1,true);$('next').onclick=()=>switchLesson(lesson+1,true);
  $('reset').onclick=()=>{session.delete(lesson);const n=lesson;lesson=null;switchLesson(n)};
  $('views').onclick=e=>{if(e.target.dataset.view)switchView(e.target.dataset.view)};
  if(location.hostname.endsWith('.chatgpt.site')){
    for(const link of document.querySelectorAll('header a'))link.href='https://github.com/whyeemcc/Visual-Lab';
    document.querySelector('.home-link').textContent='Visual-Lab 仓库 ↗';
  }
  DiodePlots.mount($('plots'),{onBias:value=>{
    if(lesson<=2)return;
    const specBias=spec('bias');params.bias=Math.min(specBias[2],Math.max(specBias[1],value));
    buildSliders();render();
  }});
  switchLesson(1);
})();
