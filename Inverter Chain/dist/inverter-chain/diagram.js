class ChainDiagram {
  constructor(el,choose){this.el=el;this.choose=choose;this.mos=false;}
  render(p,result,selected){
    this.p=p;this.r=result;this.selected=selected;
    const n=p.stages, mos=this.mos,pitch=mos?177:136,height=mos?230:148,width=n*pitch+82;
    const y=mos?112:65, green='var(--green)',line='var(--muted)';
    const path=(d,stroke=line,extra='')=>'<path d="'+d+'" fill="none" stroke="'+stroke+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>';
    const label=(x,y,str,size=10,color=line,extra='')=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" text-anchor="middle" fill="'+color+'" '+extra+'>'+str+'</text>';
    let body=path('M18 '+y+' H42')+label(22,y-13,'VIN',10,green);
    for(let i=0;i<n;i++){
      const x=42+i*pitch,junction=x+pitch-13, chosen=i===selected;
      const top=mos?12:14,boxW=mos?124:86,outX=x+(mos?100:77);
      body+='<g role="button" tabindex="0" aria-label="探测 INV '+(i+1)+'" data-stage="'+i+'" aria-pressed="'+chosen+'">';
      body+='<rect class="hit" x="'+(x-3)+'" y="'+top+'" width="'+boxW+'" height="'+(mos?194:88)+'" rx="7" fill="'+(chosen?'var(--pale)':'var(--paper)')+'" stroke="'+(chosen?'var(--green)':'var(--line)')+'" stroke-width="'+(chosen?1.3:1)+'"/>';
      if(!mos){
        body+=label(x+38,33,'INV '+(i+1),11,green)+path('M'+(x-3)+' '+y+'H'+(x+19));
        body+=path('M'+(x+19)+' 44 L'+(x+19)+' 86 L'+(x+56)+' 65 Z',green);
        body+='<circle cx="'+(x+61)+'" cy="65" r="4.5" fill="var(--paper)" stroke="var(--green)" stroke-width="1.6"/>';
        body+=path('M'+(x+66)+' '+y+'H'+(x+boxW-3))+label(x+7,94,'IN',8)+label(x+70,94,'OUT',8);
      }else{
        const gx=x+37,channel=x+54,rail=x+72;
        body+=label(x+57,28,'INV '+(i+1),10,green)+label(rail,44,'VDD',9,green);
        body+=path('M'+(rail-9)+' 49h18 M'+rail+' 49v13 H'+channel+'v25 H'+rail+'v50 H'+channel+'v25 H'+rail+'v13');
        body+=path('M'+(rail-9)+' 175h18 m-15 4h12 m-9 4h6');
        body+=path('M'+(x-3)+' '+y+'H'+gx+' M'+gx+' 75V150 M'+gx+' 75h5 M'+gx+' 150h12 M'+(channel-5)+' 65v19 M'+(channel-5)+' 141v18');
        body+='<circle cx="'+(gx+8)+'" cy="75" r="3" fill="var(--paper)" stroke="var(--muted)" stroke-width="1.5"/>';
        body+=path('M'+rail+' '+y+'H'+(x+boxW-3))+label(x+9,y-7,'IN',8)+label(x+107,y-7,'OUT',8)+label(x+91,80,'PMOS',9,green,'data-pmos="'+i+'"')+label(x+91,153,'NMOS',9,green,'data-nmos="'+i+'"')+label(x+56,198,'GND',9);
        body+='<circle cx="'+gx+'" cy="'+y+'" r="2.5" fill="var(--muted)"/><circle cx="'+rail+'" cy="'+y+'" r="2.5" fill="var(--muted)"/>';
      }
      body+='</g>'+path('M'+(x+boxW-3)+' '+y+'H'+(i<n-1?x+pitch-3:junction+20));
      body+='<circle cx="'+junction+'" cy="'+y+'" r="3" fill="var(--green)"/>'+label(junction,y-11,'N'+(i+1),9,green);
      if(i<n-1 && p.loaded){
        body+=path('M'+junction+' '+y+'v23 m-7 0h14 m-14 5h14 m-7 0v12 m-7 0h14 m-11 4h8 m-6 4h4');
        body+=label(junction,y+62,p.load+' fF',9);
      }
      if(!mos)body+=label(x+39,123,'',10,green,'data-vout="'+i+'"');
    }
    this.el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" style="min-width:'+Math.max(255,width*.78)+'px;height:'+height+'px" aria-label="反相器链，N 为各级输出节点">'+body+'</svg>';
    this.el.querySelectorAll('[data-stage]').forEach(g=>{
      const select=()=>this.choose(+g.dataset.stage);g.onclick=select;
      g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();this.el.querySelector('[data-stage="'+g.dataset.stage+'"]').focus();}};
    });
  }
  update(v){
    const p=this.p, j=this.selected;
    this.el.querySelectorAll('[data-vout]').forEach(el=>{el.textContent=v[+el.dataset.vout+1].toFixed(2)+' V';});
    for(let i=0;i<p.stages&&this.mos;i++){
      this.el.querySelector('[data-pmos="'+i+'"]').setAttribute('fill',p.vdd-v[i]>InverterPhysics.VT?'var(--green)':'var(--sub)');
      this.el.querySelector('[data-nmos="'+i+'"]').setAttribute('fill',v[i]>InverterPhysics.VT?'var(--green)':'var(--sub)');
    }
    const ip=InverterPhysics.drive(p.vdd-v[j]-InverterPhysics.VT,p.vdd-v[j+1],this.r.bp);
    const it=InverterPhysics.drive(v[j]-InverterPhysics.VT,v[j+1],this.r.bn);
    document.querySelector('#readings').innerHTML='IN <strong>'+v[j].toFixed(3)+' V</strong> OUT <strong>'+v[j+1].toFixed(3)+' V</strong> Iₚ <strong>'+(1000*ip).toFixed(1)+' µA</strong> Iₙ <strong>'+(1000*it).toFixed(1)+' µA</strong>';
    document.querySelector('#inspect-cap').textContent='CΣ '+this.r.caps[j]+' fF';
  }
}
