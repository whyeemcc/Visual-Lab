document.querySelectorAll('canvas[data-preset]').forEach(canvas=>{
  const key=canvas.dataset.preset, p=InverterPhysics.presets[key], r=InverterPhysics.simulate(p);
  function paint(){
    const {width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;
    const ratio=Math.min(2,devicePixelRatio||1);
    canvas.width=w*ratio;canvas.height=h*ratio;
    const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
    const css=getComputedStyle(canvas);
    const tMax=(p.start+p.period*2.24)*1000;
    [0,key==='basic'?3:1].forEach((node,j)=>{
      ctx.beginPath();ctx.strokeStyle=css.getPropertyValue(j?'--accent':'--ghost');ctx.lineWidth=j?1.9:1.45;ctx.setLineDash(j?[]:[4,3]);
      for(let x=0;x<=w;x+=0.5){
        const t=x/w*tMax,i=InverterPhysics.lowerBound(r.time,t);
        const y=h*(j?.83:.68)-(r.volts[node][i]/p.vdd)*h*.38;
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    });
  }
  new ResizeObserver(paint).observe(canvas);paint();
});
