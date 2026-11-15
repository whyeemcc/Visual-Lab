/* The plot and time scale share a physical window expressed in picoseconds. */
class VoltageScope {
  constructor(canvas,onTime,onStop){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onTime=onTime;this.onStop=onStop;
    this.background=document.createElement('canvas');this.colors=['#87dbac','#eabf7b','#aca3e4','#83c9e0','#f29b99','#cad992','#9cbbc7','#faa9cd','#b0d8ca','#deb48b','#b4caff'];
    this.result=null;this.stacked=true;this.dirty=true;
    new ResizeObserver(()=>{this.dirty=true;this.draw();}).observe(canvas.parentElement);
    canvas.addEventListener('pointerdown',e=>{
      if(!this.result)return;
      const rect=canvas.getBoundingClientRect();this.onStop();canvas.setPointerCapture(e.pointerId);
      this.drag={pan:e.clientY-rect.top>=this.axisY || e.shiftKey,x:e.clientX,initial:this.start};
      if(!this.drag.pan)this.seekFromX(e.clientX);
    });
    canvas.addEventListener('pointermove',e=>{
      if(!this.drag)return;
      if(this.drag.pan)this.pan(this.drag.initial-(e.clientX-this.drag.x)/this.plotW*this.span);
      else this.seekFromX(e.clientX);
    });
    canvas.addEventListener('lostpointercapture',()=>this.drag=null);
    canvas.addEventListener('keydown',e=>{
      if(!this.result||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();this.onStop();const sign=e.key==='ArrowLeft'?-1:1;
      if(e.key==='Home'||e.key==='End')this.seek(e.key==='Home'?0:this.result.end,true);
      else if(e.shiftKey)this.pan(this.start+sign*this.span*.1);
      else this.seek(this.time+sign*this.span/500,true);
    });
  }
  setData(result,params){
    this.result=result;this.p=params;this.start=0;this.span=result.end;
    this.visible=result.volts.map((_,i)=>this.visible?.[i]??true);
    if(!this.visible.some(Boolean))this.visible[0]=true;
    this.time=Math.min(this.time??result.end*.18,result.end);this.dirty=true;this.legend();this.seek(this.time);
  }
  legend(){
    const el=document.querySelector('#legend');el.replaceChildren();
    this.visible.forEach((shown,i)=>{
      const b=document.createElement('button');b.innerHTML='<i style="background:'+this.colors[i]+'"></i>'+(i?'OUT'+i:'VIN');
      b.setAttribute('aria-pressed',String(shown));b.title=(i?'第 '+i+' 级输出':'第 1 级输入')+' · 切换显示';
      b.onclick=()=>{if(shown&&this.visible.filter(Boolean).length===1)return;this.visible[i]=!shown;this.dirty=true;this.legend();this.draw();};
      el.append(b);
    });
  }
  seekFromX(x){
    const rect=this.canvas.getBoundingClientRect();
    this.seek(this.start+Math.min(1,Math.max(0,(x-rect.left-this.left)/this.plotW))*this.span);
  }
  seek(t,follow=false){
    if(!this.result)return;
    this.time=Math.min(this.result.end,Math.max(0,t));
    if(follow&&(this.time<this.start||this.time>this.start+this.span)){
      this.start=Math.min(this.result.end-this.span,Math.max(0,this.time-this.span*.5));this.dirty=true;
    }
    this.draw();this.onTime(this.time,InverterPhysics.read(this.result,this.time));
  }
  pan(start){this.start=Math.max(0,Math.min(this.result.end-this.span,start));this.dirty=true;this.draw();}
  zoom(factor){
    if(!this.result)return;
    const focal=this.time>=this.start && this.time<=this.start+this.span?this.time:this.start+this.span/2;
    const fraction=(focal-this.start)/this.span;
    this.span=Math.max(this.result.end/128,Math.min(this.result.end,this.span*factor));
    this.pan(focal-fraction*this.span);
  }
  draw(){
    if(!this.result)return;
    const visible=this.visible.map((yes,i)=>yes?i:-1).filter(i=>i>=0);
    const h=this.stacked?Math.max(160,visible.length*49+40):208;
    const w=Math.round(this.canvas.getBoundingClientRect().width);
    if(w<90)return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){
      this.canvas.style.height=h+'px';this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.dirty=true;
    }
    this.left=43;this.plotW=w-this.left-16;this.axisY=h-31;
    const top=12,ph=this.axisY-top-4,row=ph/(this.stacked?visible.length:1);
    const y=(j,v)=>top+(this.stacked?j*row:0)+5+(1-v/this.p.vdd)*(row-12);
    const x=t=>this.left+(t-this.start)/this.span*this.plotW;
    if(this.dirty){
      this.background.width=this.canvas.width;this.background.height=this.canvas.height;
      const ctx=this.background.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.font='9px Menlo, Consolas, monospace';ctx.lineWidth=1;
      const ideal=this.span/Math.max(2,Math.floor(this.plotW/87));
      const mag=10**Math.floor(Math.log10(ideal));
      const step=([1,2,2.5,5,10].find(z=>z*mag>=ideal)||10)*mag;
      const useNs=this.span>=1000;
      for(let t=Math.ceil(this.start/step-1e-10)*step;t<=this.start+this.span+1e-7;t+=step){
        const xx=x(t);ctx.strokeStyle='#32483c';ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,this.axisY+4);ctx.stroke();
        ctx.fillStyle='#a1b6a8';ctx.textAlign='center';ctx.fillText(String(+(t/(useNs?1000:1)).toFixed(5)),xx,this.axisY+16);
      }
      ctx.textAlign='left';ctx.fillStyle='#9db7a6';ctx.fillText(useNs?'t / ns':'t / ps',2,this.axisY+16);
      visible.forEach((i,j)=>{
        if(this.stacked||j===0){
          for(const v of [0,this.p.vdd*.5,this.p.vdd]){
            ctx.strokeStyle=v===this.p.vdd*.5?'#354a3f':'#293d32';ctx.setLineDash(v===this.p.vdd*.5?[2,4]:[]);
            ctx.beginPath();ctx.moveTo(this.left,y(j,v));ctx.lineTo(w-16,y(j,v));ctx.stroke();
          }
          ctx.setLineDash([]);ctx.fillStyle='#98b09f';ctx.font='8px Menlo, Consolas, monospace';
          ctx.fillText(this.p.vdd+'V',3,y(j,this.p.vdd)+2);ctx.fillText('0V',3,y(j,0)+2);
        }
        if(this.stacked){ctx.fillStyle=this.colors[i];ctx.font='9px Menlo, Consolas, monospace';ctx.fillText(i?'OUT'+i:'VIN',3,y(j,this.p.vdd/2)+3);}
        const t=this.result.time,v=this.result.volts[i];
        const from=Math.max(0,InverterPhysics.lowerBound(t,this.start)-1),to=InverterPhysics.lowerBound(t,this.start+this.span);
        ctx.save();ctx.beginPath();ctx.rect(this.left,top,this.plotW,this.axisY-top);ctx.clip();
        ctx.strokeStyle=this.colors[i];ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(x(t[from]),y(j,v[from]));
        // Preserve narrow excursions even when many samples fall within one pixel.
        let left=from;
        while(left<=to){
          const pixel=Math.floor(x(t[left]));let right=left,imin=left,imax=left;
          while(right<to&&Math.floor(x(t[right+1]))===pixel){right++;if(v[right]<v[imin])imin=right;if(v[right]>v[imax])imax=right;}
          for(const k of [left,Math.min(imin,imax),Math.max(imin,imax),right])ctx.lineTo(x(t[k]),y(j,v[k]));
          left=right+1;
        }
        ctx.stroke();ctx.restore();
      });
      ctx.strokeStyle='#688373';ctx.beginPath();ctx.moveTo(this.left,this.axisY+1);ctx.lineTo(w-16,this.axisY+1);ctx.stroke();
      this.dirty=false;
    }
    const ctx=this.ctx;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.drawImage(this.background,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const xx=x(this.time);
    if(xx>=this.left-.01 && xx<=w-15){
      ctx.strokeStyle='#d1efda';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(xx,7);ctx.lineTo(xx,this.axisY+1);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#d1efda';ctx.beginPath();ctx.moveTo(xx-4,4);ctx.lineTo(xx+4,4);ctx.lineTo(xx,10);ctx.fill();
      const values=InverterPhysics.read(this.result,this.time);
      visible.forEach((i,j)=>{ctx.fillStyle=this.colors[i];ctx.beginPath();ctx.arc(xx,y(j,values[i]),2.6,0,Math.PI*2);ctx.fill();});
    }
    document.querySelector('#zoomlevel').textContent=(this.result.end/this.span).toFixed(0)+'×';
    document.querySelector('#zoom-out').disabled=this.span>=this.result.end;
    document.querySelector('#zoom-in').disabled=this.span<=this.result.end/128;
  }
}
