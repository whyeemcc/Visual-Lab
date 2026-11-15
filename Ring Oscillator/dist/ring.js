/* V, ps, fF and mA. No external input clock: driver i sees node (i-1) mod N. */
(function(){
  const {VT,drive,strength,crossings,delays}=RingDevice;
  const defaults={stages:5,vdd:1.2,tn:24,tp:30,load:4,loaded:true,enabled:true,on:1,width:8,leak:0,duration:12};
  const presets={base:defaults,slowP:{...defaults,tp:68},off:{...defaults,enabled:false}};
  const edgeTime=20; // ps, full-swing linear enable edge
  function enable(t,p){
    if(!p.enabled)return 0;
    const elapsed=t-1000*p.on;
    return p.vdd*Math.max(0,Math.min(1,elapsed/edgeTime,(1000*p.width+edgeTime-elapsed)/edgeTime));
  }
  function solve(p,refine=1){
    const n=p.stages,bn=strength(p.tn),bp=strength(p.tp),cap=4+(p.loaded?p.load:0);
    const stackCap=1, caps=Array(n).fill(cap);
    caps[0]+=1; // Extra PMOS drain at NAND output, in fF.
    const end=p.duration*1000;
    const hLimit=Math.min(2,0.45*stackCap/(2*bn*(p.vdd-VT)),cap*.28/((bn+2*bp)*(p.vdd-VT)),end/2000)/refine;
    const steps=Math.ceil(end/hLimit),h=end/steps;
    const time=new Float64Array(steps+1),volts=Array.from({length:n},()=>new Float32Array(steps+1));
    const en=new Float32Array(steps+1),idd=new Float64Array(steps+1);
    const v=new Float64Array(n+1),tmp=new Float64Array(n+1);
    const [a,b,c,d]=Array.from({length:4},()=>new Float64Array(n+1));
    for(let i=0;i<n;i++)volts[i][0]=v[i]=(i%2===0?p.vdd:0);
    // The upper NMOS gate is EN; the lower feedback NMOS grounds the internal
    // node in the disabled DC state. Allow bidirectional upper-channel current.
    function derivative(state,out,t){
      const enV=enable(t,p),fb=state[n-1],q=state[0],mid=state[n];
      const pullUp=drive(p.vdd-fb-VT,p.vdd-q,bp)+drive(p.vdd-enV-VT,p.vdd-q,bp);
      const upper=Math.sign(q-mid)*drive(enV-Math.min(q,mid)-VT,Math.abs(q-mid),bn);
      out[0]=(pullUp-upper)/caps[0];
      out[n]=(upper-drive(fb-VT,mid,bn))/stackCap;
      let supply=pullUp+n*p.leak*1e-6; // nA to mA, background current per stage
      for(let i=1;i<n;i++){
        const input=state[i-1],node=state[i];
        const ip=drive(p.vdd-input-VT,p.vdd-node,bp);
        supply+=ip;
        out[i]=(ip-drive(input-VT,node,bn))/caps[i];
      }
      return supply;
    }
    idd[0]=derivative(v,a,0);
    for(let j=1;j<=steps;j++){
      const t=time[j-1];
      for(let i=0;i<=n;i++)tmp[i]=v[i]+h*a[i]/2;
      derivative(tmp,b,t+h/2);
      for(let i=0;i<=n;i++)tmp[i]=v[i]+h*b[i]/2;
      derivative(tmp,c,t+h/2);
      for(let i=0;i<=n;i++)tmp[i]=v[i]+h*c[i];
      derivative(tmp,d,t+h);
      for(let i=0;i<=n;i++)v[i]+=h*(a[i]+2*b[i]+2*c[i]+d[i])/6;
      for(let i=0;i<n;i++)volts[i][j]=v[i];
      time[j]=j*h;en[j]=enable(time[j],p);idd[j]=derivative(v,a,time[j]);
    }
    return {time,volts,end,cap,caps,bn,bp,en,idd};
  }
  // Trapezoidal charge integral, interpolated at both physical window edges.
  function charge(r,start,stop){
    let q=0;
    for(let j=Math.max(1,RingDevice.lowerBound(r.time,start));j<r.time.length && r.time[j-1]<stop;j++){
      const t=r.time[j-1],h=r.time[j]-t,a=Math.max(t,start)-t,b=Math.min(r.time[j],stop)-t;
      const slope=(r.idd[j]-r.idd[j-1])/h;
      q+=(b-a)*(r.idd[j-1]+(a+b)*slope/2);
    }
    return q;
  }
  function analyze(r,p,probe){
    const n=p.stages;
    const edges=r.volts.map(v=>crossings(r.time,v,p.vdd/2));
    const cycles=[], e=edges[probe], v=r.volts[probe];
    // Reject tiny start-up crossings. Keep full cycles with a valid low and high swing.
    for(let i=2;i<e.length;i++){
      if(!e[i].up)continue;
      const t0=e[i-2].t,tf=e[i-1].t,t1=e[i].t;
      if(!p.enabled || t0<p.on*1000+edgeTime || t1>(p.on+p.width)*1000)continue;
      let low=p.vdd,high=0;
      for(let j=RingDevice.lowerBound(r.time,t0);j<=RingDevice.lowerBound(r.time,t1);j++){
        low=Math.min(low,v[j]);high=Math.max(high,v[j]);
      }
      if(high>=.8*p.vdd && low<=.2*p.vdd)cycles.push({t0,t1,high:tf-t0,period:t1-t0});
    }
    const recent=cycles.slice(-3), k=recent.length;
    const period=k?recent.reduce((sum,c)=>sum+c.period,0)/k:null;
    const duty=k?recent.reduce((sum,c)=>sum+c.high,0)/(k*period):null;
    // Select pairs by their output crossing to include wrapping events at a window boundary.
    const stages=Array.from({length:n},(_,i)=>{
      if(!k)return {rise:null,fall:null};
      const {events}=delays(edges[(i+n-1)%n],edges[i]);
      const window=events.filter(e=>e.output>=recent[0].t0 && e.output<recent[k-1].t1 && e.output!==null);
      function avg(up){const values=window.filter(e=>e.up===up);return values.length?values.reduce((s,e)=>s+e.delay,0)/values.length:null;}
      return {rise:avg(false),fall:avg(true)};
    });
    const quietEnd=p.enabled?p.on*1000:r.end;
    const iddq=charge(r,quietEnd/2,quietEnd)/(quietEnd/2);
    const activeTime=recent.reduce((sum,c)=>sum+c.period,0);
    const idda=k?recent.reduce((sum,c)=>sum+charge(r,c.t0,c.t1),0)/activeTime:null;
    const ieff=k?idda-iddq:null;
    const ceff=k?ieff*period/p.vdd:null; // mA · ps / V = fF for the entire ring
    return {period,duty,stages,k,idda,iddq,ieff,ceff,quietEnd,
      windows:recent.map(c=>[c.t0,c.t1])};

  }
  globalThis.RingModel={defaults,presets,solve,analyze};
})();
