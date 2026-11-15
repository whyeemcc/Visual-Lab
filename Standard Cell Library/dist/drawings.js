const Drawings=(()=>{
  const wire='#48675e',muted='#627970',pColor='#956132',nColor='#257a68';
  const line=(x,y,x2,y2,c=wire,w=1.8)=>'<line x1="'+x+'" y1="'+y+'" x2="'+x2+'" y2="'+y2+'" stroke="'+c+'" stroke-width="'+w+'"/>';
  const rect=(x,y,w,h,fill,stroke='none',r=0)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'" stroke="'+stroke+'"/>';
  const dot=(x,y,r=3,color=wire)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+color+'"/>';
  const txt=(x,y,s,anchor='middle',c=wire,sz=12)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-size="'+sz+'" fill="'+c+'">'+s+'</text>';
  const svg=(w,h,s,label)=>'<svg class="diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" aria-label="'+label+'" role="img">'+s+'</svg>';
  function mos(x,y,type,g,signals={}){
    const c=signals[g]===undefined?wire:(signals[g]===(type==='p'?0:1)?'#178062':'#a6b0a9');
    return line(x,y-23,x,y-15,c)+line(x,y-15,x-8,y-15,c)+line(x-8,y-15,x-8,y+15,c,2.7)+line(x-8,y+15,x,y+15,c)+line(x,y+15,x,y+23,c)+line(x-13,y-11,x-13,y+11,c)+line(x-30,y,x-(type==='p'?19:13),y,c)+(type==='p'?'<circle cx="'+(x-16)+'" cy="'+y+'" r="3" fill="white" stroke="'+c+'"/>':'')+txt(x-32,y+4,g,'end',c,11);
  }
  function network(tree,type,signals){
    if(typeof tree==='string')return {w:82,h:46,paint:(x,y)=>mos(x,y+23,type,tree,signals)};
    const kids=tree.nodes.map(n=>network(n,type,signals));
    if(tree.series===(type==='n')){
      return {w:Math.max(...kids.map(k=>k.w)),h:kids.reduce((s,k)=>s+k.h,0),paint(x,y){let out='';for(const k of kids){out+=k.paint(x,y);y+=k.h;}return out;}};
    }
    const w=kids.reduce((s,k)=>s+k.w,0),h=Math.max(...kids.map(k=>k.h))+16;
    return {w,h,paint(x,y){let out=line(x,y,x,y+5)+line(x,y+h-5,x,y+h),left=x-w/2;
      for(const k of kids){const cx=left+k.w/2,top=y+(h-k.h)/2;out+=line(x,y+5,cx,y+5)+line(cx,y+5,cx,top)+k.paint(cx,top)+line(cx,top+k.h,cx,y+h-5)+line(cx,y+h-5,x,y+h-5);left+=k.w;}return out;}};
  }
  function circuit(block,signals){
    if(block.tree){
      const p=network(block.tree.down,'p',signals),n=network(block.tree.down,'n',signals),w=Math.max(220,p.w+85,n.w+85),x=w/2,top=34,y=top+p.h+12,bottom=y+12+n.h;
      let b=txt(x,16,'VDD')+line(x-12,24,x+12,24)+line(x,24,x,top)+p.paint(x,top)+line(x,top+p.h,x,y+12)+dot(x,y)+line(x,y,w-34,y)+txt(w-29,y+4,block.tree.net,'start','#126b52')+n.paint(x,y+12)+line(x,bottom,x,bottom+10)+line(x-10,bottom+10,x+10,bottom+10)+line(x-6,bottom+14,x+6,bottom+14)+txt(x,bottom+31,'VSS');
      return svg(w,bottom+40,b,block.name);
    }
    let b='';block.devices.forEach(([type,g,a,z],i)=>{const x=85+i*140;b+=mos(x,68,type,g,signals)+line(x,45,x,32)+line(x,91,x,104)+txt(x,24,a)+txt(x,119,z)+txt(x,145,type==='p'?'PMOS':'NMOS','middle',muted,10);});
    return svg(block.devices.length*140,160,b,block.name);
  }
  const layers={fin:'#65b996',gate:'#bc8fe8',contact:'#efba74',metal:'#82c7d4'};
  const group=(key,body)=>'<g data-layer="'+key+'">'+body+'</g>';
  function layout(block,clock){
    const ps=block.devices.filter(x=>x[0]==='p'),ns=block.devices.filter(x=>x[0]==='n');
    const cols=Math.max(ps.length,ns.length),w=66+cols*113;
    let fin='',gate='',ct='',metal=rect(4,10,w-8,13,layers.metal)+rect(4,189,w-8,13,layers.metal);
    let labels=txt(12,20,'VDD','start','#132e35',10)+txt(12,199,'VSS','start','#132e35',10);
    for(const [row,devs] of [ps,ns].entries()){
      const y=row?145:68;
      labels+=txt(11,y+3,row?'NFET':'PFET','start','#b3cbbd',10);
      devs.forEach(([,g,a,z],i)=>{
        const x=104+i*113;
        fin+=rect(x-40,y-11,80,22,'#254b40');
        for(let k=0;k<(clock?3:2);k++)fin+=line(x-40,y-4+k*5,x+40,y-4+k*5,layers.fin,2);
        gate+=rect(x-4,y-22,8,44,layers.gate);
        for(const [dx,net] of [[-25,a],[25,z]]){
          if(net==='VDD'||net==='VSS')metal+=line(x+dx,y,x+dx,net==='VDD'?23:189,layers.metal,2);
          ct+=rect(x+dx-3,y-6,6,12,layers.contact);
          labels+=txt(x+dx,y+25,net,'middle','#def0e6',10);
        }
        ct+=rect(x-2.5,y-19,5,5,layers.contact);labels+=txt(x,y-26,g,'middle','#e8c7ff',11);
      });
    }
    return svg(w,212,rect(0,0,w,212,'#18332b')+group('fin',fin)+group('gate',gate)+group('metal',metal)+group('contact',ct)+labels,'FinFET 器件布局 '+block.name);
  }
  function physical(id,plan){
    const dark=plan,ink=dark?'#d4e7db':wire,rail=dark?layers.metal:wire;
    const w=330,h=166;
    let b=dark?rect(0,0,w,h,'#18332b'):'';
    const t=(x,y,s)=>txt(x,y,s,'middle',ink,12);
    b+=group('metal',line(27,24,302,24,rail,4)+line(27,143,302,143,rail,4))+t(49,16,'VDD')+t(49,161,'VSS');
    if(id==='TAP'){
      b+=rect(80,44,168,30,dark?'#375e4b':'#e6f0e8')+rect(80,96,168,30,dark?'#4d495a':'#ebe7f1')+t(183,64,'N+ / N-well')+t(185,117,'P+ / P-well');
      b+=group('metal',line(102,24,102,58,rail,3)+line(102,111,102,143,rail,3))+group('contact',rect(95,52,14,12,layers.contact)+rect(95,104,14,12,layers.contact));
    }else if(id==='DECAP'){
      if(plan){
        let f='',g='',c='',m='';
        for(let i=0;i<4;i++){const x=83+i*48;f+=line(x-16,95,x+16,95,layers.fin,3)+line(x-16,100,x+16,100,layers.fin,3);g+=rect(x-3,67,6,45,layers.gate);
          m+=line(x,24,x,70,rail,2);c+=dot(x,70,3,layers.contact);for(const dx of [-12,12]){m+=line(x+dx,98,x+dx,143,rail,2);c+=dot(x+dx,98,3,layers.contact);}}
        b+=group('fin',f)+group('gate',g)+group('metal',m)+group('contact',c);
      }else b+=line(165,24,165,72)+line(140,72,190,72)+line(140,85,190,85)+line(165,85,165,143)+t(225,84,'Cdecap');
    }else if(id==='ENDCAP'){
      b+=line(244,34,244,134,ink,2)+t(271,88,'行端');
      if(plan){let f='';for(const y of [58,65,105,112])f+=line(70,y,213,y,layers.fin,3);b+=group('fin',f)+group('gate',rect(181,43,7,81,layers.gate)+rect(200,43,7,81,layers.gate));}
      else b+=t(135,81,'物理边界')+t(135,100,'无逻辑端口');
    }else{
      if(plan)b+=rect(69,45,192,30,'#375e4b')+rect(69,96,192,30,'#4d495a')+t(165,64,'N-well 延续')+t(165,115,'P-well 延续');
      else b+=t(165,76,'电源轨贯通')+t(165,99,'无逻辑支路');
    }
    return svg(w,h,b,id+(plan?' 布局示意':' 电气等效'));
  }
  return {circuit,layout,physical,layers};
})();
