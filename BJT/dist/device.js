window.BJTDevice=(()=>{
  'use strict';
  let host,state,page,scene='section',highlight='both',motion=true,acMode='h21',cursor=null,spaceMap;
  const ink='#24493e',teal='#216d5a',orange='#b55b3b',nfill='#bbdfcc',pfill='#edc7ac';
  const path=(d,color=ink,w=2,extra='')=>'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>';
  const label=(x,y,word,size=12,color=ink,anchor='middle')=>'<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" fill="'+color+'" font-size="'+size+'">'+word+'</text>';
  const rect=(x,y,w,h,c,extra='')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'" '+extra+'/>';
  const wire=(x,y,X,Y)=>path('M'+x+' '+y+'L'+X+' '+Y);
  const arrow=(x,y,X,Y,color=teal)=>path('M'+x+' '+y+'L'+X+' '+Y,color,2.5,'marker-end="url(#bjt-arrow-'+(color===orange?'p':'n')+')"');
  const node=(x,y)=>'<circle cx="'+x+'" cy="'+y+'" r="3" fill="'+ink+'"/>';
  const defs='<defs><pattern id="bjt-depl" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-1 1l8 8M5 -1l4 4" stroke="#735431" opacity=".31"/></pattern>'+[[teal,'n'],[orange,'p']].map(([c,k])=>'<marker id="bjt-arrow-'+k+'" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto"><path d="M0 0L5 2.5 0 5 1 2.5Z" fill="'+c+'"/></marker>').join('')+'</defs>';
  const svg=(w,h,body,name)=>'<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+name+'" style="display:block;width:100%;max-width:800px;height:auto;margin:auto">'+defs+body+'</svg>';
  function symbol(x,y){
    const s=state.device.s;
    return '<g transform="translate('+x+' '+y+')">'+path('M-40 0H-11M-11 -19V19',ink,2.8)+path('M-10 -9L16 -27V-39M-10 9L16 27V39')+
      (s>0?arrow(0,16,12,24):arrow(11,24,0,16))+'</g>';
  }
  function section(){
    const {device:d,op:p}=state,n=d.s>0;
    const w=host.clientWidth<500?400:680,margin=17,span=w-margin*2;
    const lo=-Math.max(.35,d.width*.72,p.xe*1.25),hi=d.width+Math.max(.45,d.width,p.xc*1.35);
    const X=x=>margin+(x-lo)/(hi-lo)*span,xe=X(0),xc=X(d.width),mid=(xe+xc)/2;
    spaceMap={lo,hi,X};
    const name=n?['n⁺','p','n']:['p⁺','n','p⁻'];
    const fill=n?[nfill,pfill,nfill]:[pfill,nfill,pfill];
    let g=label(26,22,'E',15,ink,'start')+label(mid,22,'B',15)+label(w-24,22,'C',15,ink,'end');
    g+=path('M30 27v30m'+(mid-30)+' -30v30M'+(w-28)+' 27v30');
    for(const [a,b,j] of [[margin,xe,0],[xe,xc,1],[xc,w-margin,2]]){
      g+=rect(a,56,b-a,65,fill[j])+label((a+b)/2,77,name[j],16);
    }
    for(const [j,start,end] of [['EB',-p.xe,p.xbE],['BC',d.width-p.xbC,d.width+p.xc]]){
      g+=rect(X(start),56,X(end)-X(start),65,'url(#bjt-depl)');
      const x=j==='EB'?xe:xc;
      g+=path('M'+x+' 54V123',highlight===j?'#995036':'#607f6f',highlight===j?3:1.4,'stroke-dasharray="4 3"');
      if(highlight===j)g+=label(x,48,j+' 结',12,orange);
    }
    // Arrows show injected minority carriers from each forward-biased junction.
    function transport(start,end,carrier,y){
      const right=motion||carrier==='空穴',a=right?start:end,b=right?end:start;
      return arrow(a,y,b,y,carrier==='电子'?teal:orange);
    }
    const majority=n?'电子':'空穴',other=n?'空穴':'电子';
    if(d.s*p.vbe>.02){
      g+=transport(xe-span*.09,xe+(xc-xe)*.65,majority,95);
      g+=transport(xe+(xc-xe)*.12,xe-span*.06,other,111);
      if(d.s*p.vbc<=0)g+=transport(xe+(xc-xe)*.68,xc+span*.08,majority,95);
    }
    if(d.s*p.vbc>.02)g+=transport(xc+span*.10,xc-(xc-xe)*.32,majority,103);
    const left=X(p.xbE),right=X(d.width-p.xbC);
    g+=path('M'+left+' 129v8m0 -4H'+Math.max(left,right)+'m0 -4v8');
    g+=label(mid,153,'中性基区 '+Number(p.w.toPrecision(3))+' µm',13);
    g+='<g data-marker visibility="hidden">'+path('M0 48V126','#6b5198',1.8,'stroke-dasharray="3 2"')+'</g>';
    const y=197;
    g+=symbol(w*.22,y)+label(w*.22-45,y+4,'B',12)+label(w*.22+27,y-32,'C',12)+label(w*.22+27,y+37,'E',12);
    g+=label(w*.44,183,'发射结　'+biasName(d.s*p.vbe),13,ink,'start')+label(w*.44,205,'集电结　'+biasName(d.s*p.vbc),13,ink,'start')+label(w*.44,227,'斜纹为耗尽区',12,'#63786b','start');
    return svg(w,247,g,'器件截面、载流子与晶体管符号')+'<p class="dev-hint">'+(motion?'箭头表示载流子运动':'箭头表示各分量的常规电流')+'。绿色对应电子，橙色对应空穴。发射极符号箭头始终表示常规电流方向。</p>';
  }
  function biasName(u){return Math.abs(u)<1e-7?'零偏':u>0?'正偏':'反偏';}
  const ground=(x,y)=>path('M'+(x-10)+' '+y+'h20m-16 4h12m-8 4h4');
  function resistor(x,y,vertical,name){
    const body='<g transform="translate('+x+' '+y+')'+(vertical?' rotate(90)':'')+'">'+path('M0 0h7l3 -5 5 10 5 -10 5 10 5 -10 3 5h7')+'</g>';
    return body+label(vertical?x+13:x+20,vertical?y+24:y-10,name,12,ink,vertical?'start':'middle');
  }
  function schematic(){
    const {lesson:l,device:d,driveMode}=state;
    const hf=l===9&&acMode==='h21',cur=l===8||(l===6&&driveMode==='current')||hf;
    const w=430,x=225,y=134,cx=x+16,src=49,baseY=y,rail=d.s>0?'+VCC':'−VCC';
    let g=symbol(x,y)+label(x-27,y-7,'B',12)+label(cx+11,y-26,'C',12)+label(cx+12,y+38,'E',12);
    g+=wire(src,baseY,80,baseY);
    if(!cur&&(l===7||l===9))g+=resistor(80,baseY,false,'Rₛ')+wire(120,baseY,x-40,baseY);
    else g+=wire(80,baseY,x-40,baseY);
    g+=wire(src,baseY,src,153)+'<circle cx="'+src+'" cy="171" r="17" stroke="'+ink+'" stroke-width="2" fill="white"/>'+wire(src,188,src,223)+ground(src,223);
    g+=cur?(d.s>0?arrow(src,180,src,163):arrow(src,163,src,180)):(label(src,169,'+',12)+label(src,182,'−',12));
    g+=label(src+25,175,hf?'iᵦ':l===8?'iB(t)':cur?'IB':l===6?'VBE':'VB + vᵢ',12,ink,'start');
    if(hf){
      g+=wire(cx,95,cx,67)+wire(cx,67,333,67)+wire(333,67,333,180)+ground(333,180)+label(330,52,'集电极交流短路',13);
    }else{
      g+=wire(cx,95,cx,77)+resistor(cx,37,true,'RC')+wire(cx,37,cx,26)+node(cx,25)+label(cx,19,rail);
      g+=node(cx,88)+wire(cx,88,302,88)+label(291,77,'vC',13);
      if(l===7||l===9){
        g+=wire(302,88,323,88)+path('M323 80v16m5 -16v16')+wire(328,88,364,88)+wire(364,88,364,126)+resistor(364,126,true,'RL')+wire(364,166,364,187)+ground(364,187);
      }
    }
    g+=(!hf&&(l===7||l===9))?resistor(cx,173,true,'RE')+wire(cx,213,cx,223):wire(cx,173,cx,223);
    g+=ground(cx,223);
    const title=hf?'交流短路电流增益测试':l===7||l===9?'共射放大器':l===8?'脉冲基极驱动':'集电极电阻负载';
    return svg(430,244,g,title)+'<p class="dev-hint">'+title+'。'+(hf?'保留直流偏置，图中只画交流测试通路。':l===8?'发射极接地。脉冲先注入基极电流，再反向抽取存储电荷。':l===7||l===9?'输出电容按理想交流耦合处理，RL 仅加载交流信号。':'发射极接地，负载线由电源和 RC 决定。')+'</p>';
  }
  function mark(){
    const m=host?.querySelector('[data-marker]');
    if(!m||!spaceMap)return;
    const show=Number.isFinite(cursor)&&cursor>=spaceMap.lo&&cursor<=spaceMap.hi&&state.lesson<=2;
    m.setAttribute('visibility',show?'visible':'hidden');
    if(show)m.setAttribute('transform','translate('+spaceMap.X(cursor)+' 0)');
  }
  function paint(){
    const options=(list,key)=>list.map(([value,name,active])=>'<button data-choice="'+key+'" data-value="'+value+'" aria-pressed="'+active+'">'+name+'</button>').join('');
    let tools=state.lesson>=6?options([['circuit','测试电路',scene==='circuit'],['section','器件截面',scene==='section']],'scene'):'';
    if(scene==='section')tools+=options([['EB','查看发射结',highlight==='EB'],['BC','查看集电结',highlight==='BC']],'junction')+options([['motion',motion?'显示电流方向':'显示粒子运动',!motion]],'motion');
    host.innerHTML='<div class="dev-tools">'+tools+'</div>'+(scene==='section'?section():schematic());mark();
  }
  function render(el,next){
    if(host!==el){
      host=el;host.addEventListener('click',e=>{
        const b=e.target.closest('[data-choice]');if(!b)return;
        if(b.dataset.choice==='scene')scene=b.dataset.value;
        if(b.dataset.choice==='junction')highlight=highlight===b.dataset.value?'both':b.dataset.value;
        if(b.dataset.choice==='motion')motion=!motion;
        paint();
      });
      if(window.ResizeObserver){let prev=0;new ResizeObserver(()=>{const w=el.clientWidth;if(w!==prev&&state){prev=w;paint();}}).observe(el);}
    }
    state=next;
    if(page!==state.lesson){page=state.lesson;scene=page>=6?'circuit':'section';cursor=null;acMode='h21';}
    paint();
  }
  document.addEventListener('bjt:position',e=>{cursor=e.detail;mark()});
  document.addEventListener('bjt:ac-mode',e=>{if(e.detail!==acMode){acMode=e.detail;if(page===9)paint();}});
  return {render};
})();
