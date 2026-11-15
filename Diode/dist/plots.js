/* Interactive measurement views. All voltages, currents and charge come from DiodePhysics. */
window.DiodePlots = (() => {
  'use strict';
  const teal = '#08796d', coral = '#bd563d', blue = '#416fa4', purple = '#7951a2';
  let host, hooks, state, device, op, plotBox, readBox, toolBox;
  let domain, paintCursors, drag = null, refParams = null, cachedKey, cached;
  let family = 'field', dcType = 'iv', scale = 'linear', position = 0, second = .5;
  let zoom = 1, pan = 0, activeCursor = 'a', timeA = null, timeB = null, currentPoint = null;
  let priorLesson, priorView, axisWidth = 0, observer, panDrag;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const finite = Number.isFinite;
  const num = (v,n=3) => {
    if (!finite(v)) return '—';
    if (v === 0) return '0';
    return Math.abs(v)>=1e5 || Math.abs(v)<1e-3 ? v.toExponential(1) : String(Number(v.toPrecision(n)));
  };
  const si = (v,unit) => {
    if (!finite(v)) return '—';
    if (!v) return '0 '+unit;
    const prefixes = ['a','f','p','n','µ','m','','k','M','G'];
    const power = clamp(Math.floor(Math.log10(Math.abs(v))/3),-6,3);
    return num(v/10**(power*3))+' '+prefixes[power+6]+unit;
  };
  const sample = (a,b,count,fn) => Array.from({length:count},(_,i)=>fn(a+(b-a)*i/(count-1)));
  const options = (arr,selected) => arr.map(([v,label])=>'<option value="'+v+'"'+(v===selected?' selected':'')+'>'+label+'</option>').join('');
  const select = (label,id,items,value) => '<label>'+label+'<select data-tool="'+id+'">'+options(items,value)+'</select></label>';
  const btn = (id,label,on) => '<button type="button" data-tool="'+id+'"'+(on!==undefined?' aria-pressed="'+on+'"':'')+'>'+label+'</button>';
  const range = (id,label,value,max=1000) => '<label class="dg-range">'+label+'<input type="range" aria-label="'+label+'" data-tool="'+id+'" min="0" max="'+max+'" step="1" value="'+value+'"></label>';
  const numbox = (id,label,value,step) => '<label>'+label+'<input type="number" data-tool="'+id+'" step="'+step+'" value="'+value+'"></label>';
  const reading = (k,v) => '<span><small>'+k+'</small><b>'+v+'</b></span>';
  const P = () => window.DiodePhysics;

  function mount(el, callbacks={}) {
    observer?.disconnect();
    host = typeof el==='string'?document.querySelector(el):el;
    hooks=callbacks;
    if (!document.querySelector('#diode-graph-css')) {
      const style = document.createElement('style');
      style.id='diode-graph-css';
      style.textContent=`
      .dg{min-width:0;color:#203c39;font-family:inherit}.dg-tools,.dg-tail{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}.dg-tools{margin:0 0 14px}.dg label{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:12px;line-height:1.4;color:#3f5652}.dg select,.dg button,.dg input[type=number]{border:1px solid #c6d5cf;background:#fff;color:#264b43;border-radius:6px;padding:5px 9px;font:inherit;font-size:12px;min-height:32px}.dg button{cursor:pointer}.dg button:hover,.dg button[aria-pressed=true]{background:#e6f2eb;border-color:#85b3a3}.dg :focus-visible{outline:2px solid #197c66;outline-offset:2px}.dg input[type=number]{width:82px}.dg input[type=range]{width:clamp(90px,18vw,148px);accent-color:#117b69}.dg-figure{border:1px solid #d5dfd9;border-radius:9px;background:#fbfcf9;overflow:hidden;min-width:0}.dg-figure svg{display:block;width:100%;touch-action:pan-y;cursor:crosshair;user-select:none}.dg-figure svg text{font-family:ui-monospace,'PingFang SC',monospace}.dg-tail{margin-top:10px}.dg-readout{display:flex;flex-wrap:wrap;gap:9px 20px;padding:14px 0 2px}.dg-readout span{display:grid;gap:3px}.dg-readout small{font:inherit;font-size:11px;letter-spacing:0;color:#566b64}.dg-readout b{font:600 13px/1.4 ui-monospace,'PingFang SC',monospace;color:#24493f}.dg .dg-note{font:inherit;font-size:12px;line-height:1.6;color:#546a63;margin:10px 0 0}.dg-empty{padding:2rem;text-align:center;color:#456457}.dg svg .dg-line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
      `;
      document.head.appendChild(style);
    }
    host.innerHTML = '<div class="dg"><div class="dg-tools"></div><div class="dg-figure"></div><div class="dg-tail"></div><div class="dg-readout" aria-label="测量读数"></div><p class="dg-note"></p></div>';
    plotBox=host.querySelector('.dg-figure'); readBox=host.querySelector('.dg-readout'); toolBox=host.querySelector('.dg-tools');
    host.addEventListener('click',onTool); host.addEventListener('change',onTool); host.addEventListener('input',onTool);
    plotBox.addEventListener('pointerdown',e=>{
      if (!domain || (e.button!==0 && e.pointerType==='mouse')) return;
      drag=e.pointerId;
      plotBox.setPointerCapture(e.pointerId);
      const y=e.clientY-plotBox.getBoundingClientRect().top;
      if(state.view==='time' && zoom>1 && y>=domain.bottom) {
        panDrag={start:e.clientX, pan};
      } else movePointer(e);
    });
    plotBox.addEventListener('pointermove',e=>{
      if(drag!==e.pointerId) return;
      if(panDrag) {
        pan=clamp(panDrag.pan-(e.clientX-panDrag.start)/((axisWidth-domain.left-domain.right)*(zoom-1)),0,1);
        draw(false);
        toolBox.querySelector('[data-tool=pan]').value=String(Math.round(1000*pan));
      } else movePointer(e);
    });
    plotBox.addEventListener('lostpointercapture',()=>{ drag=null; panDrag=null; });
    if (window.ResizeObserver) {
      observer=new ResizeObserver(()=>{if(state && Math.abs(plotBox.clientWidth-axisWidth)>1) draw();});
      observer.observe(plotBox);
    }
  }

  function render(next) {
    state=next;
    device=P().device(next.params);
    op=P().at(device,device.bias,next.lesson===9?device.load:0);
    if (next.lesson!==priorLesson || next.view!==priorView) {
      family=next.lesson===5?'minority':next.lesson===3 || next.lesson===9?'band':'field';
      dcType=next.lesson===7?'cap':'iv';
      scale=next.lesson===6?'log':'linear';
      zoom=1; pan=0; timeA=null; timeB=null;
      priorLesson=next.lesson; priorView=next.view;
      activeCursor='a';
    }
    draw();
  }
  function movePointer(e) {
    const rect=plotBox.getBoundingClientRect();
    const f=clamp((e.clientX-rect.left-domain.left)/(axisWidth-domain.left-domain.right),0,1);
    selectX(domain.min+f*(domain.max-domain.min));
  }
  function selectX(x) {
    if (state.view==='space') position=x;
    else if (state.view==='time') {
      if (activeCursor==='a') timeA=x; else timeB=x;
    } else if(activeCursor==='b' && dcType==='iv') second=x;
    else { hooks.onBias?.(x); return; }
    paintCursors();
  }
  function onTool(e) {
    const el=e.target.closest('[data-tool]');
    if (!el) return;
    const id=el.dataset.tool;
    if (el.tagName==='BUTTON' && e.type!=='click') return;
    if (el.tagName==='SELECT' && e.type!=='change') return;
    if(el.tagName==='INPUT' && e.type!==(el.type==='range'?'input':'change')) return;
    switch(id) {
      case 'family': family=el.value; break;
      case 'dc': dcType=el.value; activeCursor='a'; break;
      case 'scale': scale=el.value; break;
      case 'freeze': refParams=refParams?null:{...state.params}; break;
      case 'a': case 'b': activeCursor=id; break;
      case 'x': selectX(domain.min+(domain.max-domain.min)*Number(el.value)/1000); return;
      case 'zoom': zoom=Number(el.value); break;
      case 'pan': pan=Number(el.value)/1000; draw(false); return;
      case 'current': {
        const target=Number(el.value)*1e-6;
        if (!finite(target)||!el.value) return;
        const res=P().atCurrent(device,target);
        const requested=res.v+(state.lesson===9?res.i*device.load:0);
        if (!finite(requested)||requested<domain.min||requested>domain.max) {
          host.querySelector('.dg-note').textContent='目标电流超出本次扫描范围，请在曲线上读取可达电流后重试。'; return;
        }
        hooks.onBias?.(requested); return;
      }
      default:return;
    }
    draw();
  }

  function strokePath(points,fx,fy,key) {
    let pen=false, d='';
    for (const p of points) {
      const y=p[key];
      if(!finite(y)) { pen=false; continue; }
      d+=(pen?'L':'M')+fx(p.x).toFixed(2)+' '+fy(y).toFixed(2);
      pen=true;
    }
    return d;
  }

  // Draw stacked axes with identical x bounds and independent, explicitly labeled y scales.
  function chart(rows,min,max,xUnit,opts={}) {
    axisWidth=Math.max(120,plotBox.clientWidth);
    const width=axisWidth, compact=width<475;
    const wrapLegend=width<365 && rows.some(r=>r.lines.filter(l=>l.label).length>1);
    const left=compact?47:57,right=compact?14:21,top=wrapLegend?45:32;
    const rowHeight=rows.length===1?190:124, gap=wrapLegend?53:41;
    const bottom=top+rowHeight*rows.length+gap*(rows.length-1),height=bottom+39;
    const fx=x=>left+(x-min)/(max-min)*(width-left-right);
    domain={min,max,left,right,fx,top,bottom};
    let markup='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+rows.map(r=>r.title).join('，')+'，横轴'+xUnit+'">';
    rows.forEach((row,index)=>{
      const y0=top+index*(rowHeight+gap),y1=y0+rowHeight;
      let lo=Infinity,hi=-Infinity;
      for(const curve of row.lines) for(const p of curve.data) {
        if(finite(p[curve.key]) && p.x>=min && p.x<=max) {
          lo=Math.min(lo,p[curve.key]);hi=Math.max(hi,p[curve.key]);
        }
      }
      if(!finite(lo)) {lo=0;hi=1;}
      if(row.zero) {lo=Math.min(lo,0);hi=Math.max(hi,0);}
      if(hi===lo || hi-lo<Math.max(Math.abs(hi),Math.abs(lo))*1e-10) { const padding=Math.abs(hi)*.05 || 1;lo-=padding;hi+=padding; }
      if(row.log) {lo=Math.floor(lo);hi=Math.max(lo+1,Math.ceil(hi));}
      else {const pad=(hi-lo)*.06;hi+=pad;lo-=pad;}
      const fy=y=>y1-(y-lo)/(hi-lo)*rowHeight;
      const labels=row.lines.filter(l=>l.label);
      markup+='<text x="'+left+'" y="'+(y0-(wrapLegend?26:12))+'" fill="#29493f" font-size="12" font-weight="600">'+row.title+'</text>';
      let legendX=width-right;
      for(const curve of [...labels].reverse()) {
        legendX-=curve.label.length*9+3;
        markup+='<text x="'+legendX+'" y="'+(y0-12)+'" fill="'+curve.color+'" font-size="10">'+curve.label+'</text>';
        markup+='<line x1="'+(legendX-15)+'" x2="'+(legendX-4)+'" y1="'+(y0-15)+'" y2="'+(y0-15)+'" stroke="'+curve.color+'" stroke-width="2" '+(curve.dash?'stroke-dasharray="3 2"':'')+'/>';
        legendX-=23;
      }
      markup+='<defs><clipPath id="dg-clip-'+index+'"><rect x="'+left+'" y="'+y0+'" width="'+(width-left-right)+'" height="'+rowHeight+'"/></clipPath></defs>';
      if(opts.shade) {
        const x0=fx(clamp(opts.shade[0],min,max)),x1=fx(clamp(opts.shade[1],min,max));
        markup+='<rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+rowHeight+'" fill="#d7e6dc" opacity=".60"/>';
      }
      let yTicks;
      if(row.log) {
        const step=Math.max(1,Math.ceil((hi-lo)/4));
        yTicks=[];for(let y=Math.ceil(lo/step)*step;y<=hi;y+=step)yTicks.push(y);
      } else {
        const rough=(hi-lo)/4, base=10**Math.floor(Math.log10(rough));
        const step=[1,2,2.5,5,10].find(n=>n*base>=rough)*base;
        yTicks=[];for(let i=Math.ceil(lo/step);i<=Math.floor(hi/step);i++) yTicks.push(i*step);
      }
      for(const y of yTicks) {
        const yz=fy(y);
        const label=row.log?'1e'+y:num(y,2);
        markup+='<path d="M'+left+' '+yz+'H'+(width-right)+'" stroke="#dce6df"/><text x="'+(left-5)+'" y="'+(yz+3)+'" text-anchor="end" font-size="10" fill="#607770">'+label+'</text>';
      }
      const nTicks=compact?3:5;
      for(let i=0;i<nTicks;i++) {
        const t=min+(max-min)*i/(nTicks-1),x=fx(t);
        markup+='<path d="M'+x+' '+y0+'V'+y1+'" stroke="#dde5df" stroke-dasharray="2 4"/>';
        if(index===rows.length-1) markup+='<text x="'+x+'" y="'+(y1+15)+'" text-anchor="'+(i===0?'start':i===nTicks-1?'end':'middle')+'" font-size="11" fill="#506861">'+num(t,3)+'</text>';
      }
      if(lo<0&&hi>0&&!row.log) markup+='<path d="M'+left+' '+fy(0)+'H'+(width-right)+'" stroke="#9bb5aa"/>';
      if(min<0&&max>0) markup+='<path d="M'+fx(0)+' '+y0+'V'+y1+'" stroke="#a1b9ae" stroke-dasharray="4 4"/>';
      for(const curve of row.lines) markup+='<path clip-path="url(#dg-clip-'+index+')" class="dg-line" d="'+strokePath(curve.data,fx,fy,curve.key)+'" stroke="'+curve.color+'" '+(curve.dash?'stroke-dasharray="5 4"':'')+'/>';
      if(row.marker && finite(row.marker.y) && row.marker.x>=min && row.marker.x<=max) markup+='<circle cx="'+fx(row.marker.x)+'" cy="'+fy(row.marker.y)+'" r="4.5" fill="'+teal+'" stroke="#fff" stroke-width="1.5"/>';
    });
    plotBox.innerHTML=markup+'<text x="'+((left+width-right)/2)+'" y="'+(height-5)+'" text-anchor="middle" fill="#435e54" font-size="11">'+xUnit+'</text><g class="dg-cursors"></g></svg>';
  }
  const line=(data,key,color,label='',dash=false)=>({data,key,color,label,dash});
  function cursors(items) {
    const g=plotBox.querySelector('.dg-cursors');
    g.innerHTML=items.filter(m=>m.x>=domain.min && m.x<=domain.max).map(m=>{
      const x=domain.fx(m.x);
      return '<path d="M'+x+' '+domain.top+'V'+domain.bottom+'" stroke="'+m.color+'" stroke-width="1.2" stroke-dasharray="4 3"/><rect x="'+(x-5)+'" y="'+(domain.top-4)+'" width="10" height="10" rx="2" fill="'+m.color+'"/>';
    }).join('');
  }
  function draw(tools=true) {
    if(!host||!state) return;
    if(state.lesson===1 && state.joined===false && state.view==='space') {
      domain=null;axisWidth=plotBox.clientWidth;
      plotBox.innerHTML='<div class="dg-empty">形成 PN 结后可测量空间剖面。</div>';
      toolBox.innerHTML=readBox.innerHTML=host.querySelector('.dg-tail').innerHTML=host.querySelector('.dg-note').textContent='';return;
    }
    if(state.view==='dc') drawDC(tools);
    else if(state.view==='time') drawTime(tools);
    else drawSpace(tools);
  }
  function panels(toolbar,tail,note,update) {
    if(update) {
      // Keep focused sliders and number fields alive while a linked control
      // rerenders the surrounding experiment, including during touch gestures.
      [ [toolBox,toolbar], [host.querySelector('.dg-tail'),tail] ].forEach(([box,html])=>{
        const shape=html.replace(/ value="[^"]*"/g,'');
        if(box._controlShape!==shape || !box.childElementCount) {
          box.innerHTML=html;box._controlShape=shape;
        } else {
          const template=document.createElement('template');
          template.innerHTML=html;
          for(const field of template.content.querySelectorAll('input')) {
            const old=box.querySelector('[data-tool="'+field.dataset.tool+'"]');
            if(old && old!==document.activeElement) old.value=field.value;
          }
        }
      });
    }
    host.querySelector('.dg-note').textContent=note;
  }
  function syncRange(x) {
    const el=host.querySelector('[data-tool=x]');
    if(el) el.value=String(Math.round(clamp((x-domain.min)/(domain.max-domain.min),0,1)*1000));
  }
  function drawSpace(tools) {
    const extended=family==='minority'||family==='current', w=Math.max(op.w,.025);
    const min=-op.xp-(extended?3*device.ln:.72*w),max=op.xn+(extended?3*device.lp:.72*w);
    const xs=new Set(sample(min,max,220,x=>x));
    // Include both sides of each abrupt junction edge to retain narrow features.
    const eps=(max-min)*1e-7;
    for(const edge of [-op.xp,0,op.xn]) for(const off of [-eps,0,eps]) xs.add(clamp(edge+off,min,max));
    const data=[...xs].sort((a,b)=>a-b).map(x=>{
      const s=P().profile(device,op,x);
      return {...s,x,field:s.field/1e3,minor:s.minority>0?Math.log10(s.minority):null};
    });
    const rows=family==='field'?[
      {title:'净电荷 ρ  [C/cm³]',zero:true,lines:[line(data,'rho',coral)]},
      {title:'电场 E  [kV/cm]',zero:true,lines:[line(data,'field',teal)]},
      {title:'电势 φ  [V]',zero:true,lines:[line(data,'phi',blue)]}
    ]:family==='band'?[
      {title:'能带  [eV]',lines:[line(data,'ec',teal,'Ec'),line(data,'ev',coral,'Ev')]}
    ]:family==='minority'?[
      {title:'少子浓度  [cm⁻³]',log:true,lines:[line(data,'minor',teal)]}
    ]:[
      {title:'电流密度  [A/cm²]',lines:[line(data,'jn',blue,'Jn'),line(data,'jp',coral,'Jp'),line(data.map(p=>({...p,total:p.jn+p.jp})),'total',teal,'总计',true)]}
    ];
    panels(select('剖面','family',[['field','电荷 · 电场 · 电势'],['band','导带与价带'],['minority','少数载流子'],['current','电子与空穴电流']],family),range('x','位置游标',0), '阴影为耗尽区。沿横轴拖动，读取同一位置的各项数值。',tools);
    chart(rows,min,max,'位置 x  [µm]',{shade:[-op.xp,op.xn]});
    position=clamp(position,min,max);
    paintCursors=()=>{
      const s=P().profile(device,op,position);
      cursors([{x:position,color:purple}]);syncRange(position);
      let r=reading('位置 x',num(position)+' µm');
      if(family==='field') r+=reading('电荷密度',num(s.rho)+' C/cm³')+reading('电场',num(s.field/1e3)+' kV/cm')+reading('电势',si(s.phi,'V'))+reading('P 侧耗尽宽度 xₚ',num(op.xp)+' µm')+reading('N 侧耗尽宽度 xₙ',num(op.xn)+' µm');
      if(family==='band') r+=reading('导带底',num(s.ec)+' eV')+reading('价带顶',num(s.ev)+' eV')+reading('带隙',num(device.eg)+' eV');
      if(family==='minority') r+=reading('少子浓度',s.minority===null?'耗尽区内':num(s.minority)+' cm⁻³')+reading('电子扩散长度',num(device.ln)+' µm')+reading('空穴扩散长度',num(device.lp)+' µm');
      if(family==='current') r+=reading('电子电流密度',num(s.jn)+' A/cm²')+reading('空穴电流密度',num(s.jp)+' A/cm²')+reading('总电流密度',num(s.jn+s.jp)+' A/cm²');
      readBox.innerHTML=r;
      document.dispatchEvent(new CustomEvent('diode:position',{detail:position}));hooks.onPosition?.(position);
    };
    paintCursors();
  }
  function drawDC(tools) {
    const breakdown=state.lesson===9;
    const min=breakdown?-Math.ceil(1.4*device.bv):-3, max=breakdown?0:.9;
    const reference=refParams?P().device(refParams):null;
    const xs=sample(min,max,201,x=>x);
    if(min<0&&max>0) {
      xs.push(0,...sample(0,max,101,x=>x));xs.sort((a,b)=>a-b);
    }
    function curve(d) {
      return xs.map(x=>{
        const p=P().at(d,x,breakdown?d.load:0);
        return {x,i:p.i,abs:p.i===0?null:Math.log10(Math.abs(p.i)),cj:p.cj*1e15,cd:p.cd*1e15,inv:p.vj<=0?1/(p.cj*1e15)**2:null};
      });
    }
    const key=JSON.stringify([xs[0],max,breakdown,...['na','nd','temp','rs','area','tau','load'].map(k=>device[k]),refParams]);
    if(cachedKey!==key) {cached={data:curve(device),ref:reference?curve(reference):null};cachedKey=key;}
    const {data,ref}=cached;
    const series=(k,color)=>ref?[line(data,k,color,'当前'),line(ref,k,purple,'冻结',true)]:[line(data,k,color)];
    let rows;
    if(dcType==='iv') {
      const log=scale==='log';
      rows=[{title:log?'|I|  [A]':'电流 I  [A]',log,zero:!log,lines:series(log?'abs':'i',teal),
        marker:{x:op.vs,y:log?(op.i?Math.log10(Math.abs(op.i)):null):op.i}}];
    } else {
      rows=[{title:'结电容 Cj  [fF]',zero:true,lines:series('cj',blue)},
        {title:'扩散电容 Cd  [fF]',zero:true,lines:series('cd',teal)},
        {title:'1/Cj²  [fF⁻²]',zero:true,lines:series('inv',coral)}];
    }
    const toolbar=select('扫描','dc',[['iv','I–V 特性'],['cap','C–V 与 1/Cj²']],dcType)
      +(dcType==='iv'?select('纵轴','scale',[['linear','线性 I'],['log','对数 |I|']],scale):'')
      +btn('freeze',reference?'移除冻结曲线':'冻结当前曲线',!!reference);
    const tail=(dcType==='iv'?btn('a','A 工作点',activeCursor==='a')+btn('b','B 比较点',activeCursor==='b'):'')
      +range('x',activeCursor==='b'?'B 电压':'A 电压',0)
      +(dcType==='iv'?numbox('current','设定电流 [µA]',Number((op.i*1e6).toPrecision(4)),'any'):'');
    const note=dcType==='iv'?'在曲线上拖动或输入电流并按回车，读取工作点；将 A、B 放在不同正向电流处可提取两点间的表观理想因子。':'Cj、Cd 为结内的小信号电容。反偏区提取 1/Cj² 对结电压的斜率，由此估计 PN 结的有效掺杂。';
    panels(toolbar,tail,note,tools);
    chart(rows,min,max,breakdown?'电源电压 Vs  [V]':'二极管端电压 VD  [V]');
    if(second>max||second<min) second=breakdown?-.8*device.bv:.5;
    currentPoint=op;
    paintCursors=()=>{
      const p=currentPoint, b=P().at(device,second,breakdown?device.load:0);
      const points=[{x:p.vs,color:teal}];
      if(dcType==='iv')points.push({x:second,color:purple});
      cursors(points);syncRange(activeCursor==='b'?second:p.vs);
      let read=reading('A 端电压 VD',si(p.v,'V'))+reading('A 结电压 Vj',si(p.vj,'V'))+reading('A 端电流',si(p.i,'A'));
      if(dcType==='iv') {
        const n=(p.i>0&&b.i>0&&Math.abs(Math.log(b.i/p.i))>1e-9)?(b.v-p.v)/(device.vt*Math.log(b.i/p.i)):null;
        read+=reading('A 微分电阻 rd',si(p.rd,'Ω'))+reading('B 端电压 / 电流',si(b.v,'V')+' / '+si(b.i,'A'))+reading('表观 n（A–B）',num(n));
      } else {
        const va=-.2,vb=-1.2,ca=P().at(device,va),cb=P().at(device,vb);
        const slope=(1/cb.cj**2-1/ca.cj**2)/(cb.vj-ca.vj);
        const doping=-2/(1.602176634e-19*11.7*8.8541878128e-14*device.areaCm**2*slope);
        read+=reading('A 结电容',si(p.cj,'F'))+reading('A 扩散电容',si(p.cd,'F'))+reading('反偏两点斜率',num(slope*1e-30)+' fF⁻²/V')+reading('有效掺杂',num(doping)+' cm⁻³');
      }
      readBox.innerHTML=read;
    };
    paintCursors();
  }
  let cachedPulseKey, pulseResult;
  function drawTime(tools) {
    const key=JSON.stringify(['na','nd','temp','area','tau','rs','forward','reverse','pulse','load'].map(k=>device[k]));
    if(cachedPulseKey!==key) {pulseResult=P().transient(device);cachedPulseKey=key;timeA=null;timeB=null;}
    const t=pulseResult, raw=t.samples, first=raw[0].t, last=raw[raw.length-1].t;
    // Interpolate between samples; at the voltage step, take the right-hand sample.
    const read=x=>{
      let lo=0,hi=raw.length-1;
      while(lo<hi) {const m=Math.ceil((lo+hi)/2);if(raw[m].t<=x)lo=m;else hi=m-1;}
      const a=raw[lo],b=raw[Math.min(lo+1,raw.length-1)],f=b.t===a.t?0:clamp((x-a.t)/(b.t-a.t),0,1);
      return {t:x,vs:a.vs+f*(b.vs-a.vs),vd:a.vd+f*(b.vd-a.vd),i:a.i+f*(b.i-a.i),q:a.q+f*(b.q-a.q)};
    };
    let min,max;
    if(zoom===0) {
      const span=Math.min(last-first,Math.max((t.trr||device.tau)*2,1e-6));
      min=Math.max(first,-span*.15);max=Math.min(last,min+span);
    } else {
      const span=(last-first)/zoom;
      min=first+(last-first-span)*pan;max=min+span;
    }
    const view=[read(min),...raw.filter(p=>p.t>=min && p.t<=max),read(max)];
    const data=view.map(p=>({...p,x:p.t,iMa:p.i*1e3,qPc:p.q*1e12}));
    timeA=clamp(timeA??0,first,last);
    timeB=clamp(timeB??t.tEnd??last,first,last);
    const toolbar=select('时间窗','zoom',[['1','全程'],['0','恢复沿特写'],['4','4×'],['16','16×'],['64','64×']],String(zoom))
      +(zoom>1?range('pan','平移时间窗',Math.round(1000*pan)):'');
    const tail=btn('a','游标 A',activeCursor==='a')+btn('b','游标 B',activeCursor==='b')+range('x','游标时间',0);
    panels(toolbar,tail,'t = 0 时电源切换至反偏。恢复终点取反向电流幅值降至峰值的 25%。Qrr 为该区间内反向电流的面积；A–B 积分仅计入反向分量。放大后可拖动底部刻度平移。',tools);
    chart([{title:'电压  [V]',lines:[line(data,'vs',coral,'Vs',true),line(data,'vd',teal,'VD')]},
      {title:'端口电流  [mA]',zero:true,lines:[line(data,'iMa',blue)]},
      {title:'存储电荷  [pC]',zero:true,lines:[line(data,'qPc',purple)]}],min,max,'时间 t  [ns]');
    paintCursors=()=>{
      const a=read(timeA),b=read(timeB);
      const lower=Math.min(a.t,b.t),upper=Math.max(a.t,b.t);
      let area=0;
      for(let i=1;i<raw.length;i++) {
        const l=raw[i-1],r=raw[i],left=Math.max(lower,l.t),right=Math.min(upper,r.t);
        if(right<=left)continue;
        const interp=x=>l.i+(r.i-l.i)*(x-l.t)/(r.t-l.t);
        const il=interp(left),ir=interp(right);
        const fraction=il*ir<0?Math.min(il,ir)/(Math.min(il,ir)-Math.max(il,ir)):1;
        area+=(right-left)*1e-9*fraction*(Math.max(0,-il)+Math.max(0,-ir))/2;
      }
      cursors([{x:a.t,color:teal},{x:b.t,color:purple}]);syncRange(activeCursor==='a'?a.t:b.t);
      readBox.innerHTML=reading('A 时间 / 电流',num(a.t)+' ns / '+si(a.i,'A'))+reading('B 时间 / 电流',num(b.t)+' ns / '+si(b.i,'A'))+reading('Δt B − A',num(b.t-a.t)+' ns')+reading('A–B 反向电荷',si(area,'C'))+reading('trr（25%）',t.trr===null?'超出窗口':si(t.trr*1e-9,'s'))+reading('Qrr',si(t.qrr,'C'));
    };
    paintCursors();
  }
  return {mount,render};
})();
