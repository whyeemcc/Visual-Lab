/* Voltages in V, time in ps, capacitances in fF and currents in mA. */
(function (scope) {
  'use strict';
  const VT = 0.32;
  const REFERENCE_VDD = 1.2;
  const REFERENCE_C = 4;
  const base = {stages:3, vdd:1.2, tn:28, tp:38, loaded:true, load:5, low:0, high:1.2,
    period:1.2, duty:50, rise:45, fall:45, start:0.2, cycles:3, mode:'pulse',
    points:'0, 0\n0.20, 0\n0.25, 1.2\n0.80, 1.2\n0.85, 0\n1.80, 0'};
  const presets = {
    basic:{...base}, load:{...base, stages:5, load:16, period:2.4, tn:24, tp:32},
    narrow:{...base, stages:5, period:1, duty:9, rise:15, fall:15, load:12, tn:32, tp:46}
  };
  function drive(over, drain, beta) {
    if (over <= 0 || drain <= 0) return 0;
    if (drain >= over) return 0.5 * beta * over * over;
    return beta * drain * (over - 0.5 * drain);
  }
  function strength(delay) {
    const u = REFERENCE_VDD - VT, half = REFERENCE_VDD / 2;
    const integral = 2 * VT / (u*u) + Math.log((2*u-half)/half) / u;
    return REFERENCE_C * integral / delay;
  }
  function cap(p, i) { return 2 + (i < p.stages-1 ? 2 + (p.loaded ? p.load : 0) : 0); }
  function parsePoints(p) {
    const lines = p.points.trim().split(/\n/);
    if (lines.length < 2 || lines.length > 200) throw Error('请输入 2 至 200 个时间点，每行一组时间和电压。');
    const pairs = lines.map((line, i) => {
      const tokens = line.includes(',') || line.includes('，') ? line.split(/[,，]/).map(s=>s.trim()) : line.trim().split(/\s+/);
      const cols = tokens.map(Number);
      if (cols.length !== 2 || tokens.includes('') || !cols.every(Number.isFinite) || cols[0]<0 || cols[0]>50 || cols[1]<0 || cols[1]>p.vdd)
        throw Error('第 '+(i+1)+' 行需要 0–50 ns 的时间和 0–VDD 的电压。');
      return [cols[0]*1000, cols[1]];
    });
    if (pairs[0][0] !== 0 || pairs.some((v,i)=>i && v[0] <= pairs[i-1][0]))
      throw Error('首个时间点必须为 0，后续时间须严格递增。');
    return pairs;
  }
  function stimulus(p) {
    if(p.mode==='pwl') return parsePoints(p);
    if (p.high <= p.low || p.high > p.vdd || p.low < 0) throw Error('脉冲电平须满足 0 ≤ 低电平 < 高电平 ≤ VDD。');
    const period = p.period*1000, width=period*p.duty/100;
    if(p.rise>width || p.fall>period-width) throw Error('边沿时间超出脉冲宽度。请缩短边沿，或调整周期与占空比。');
    const pts=[[0,p.low]];
    function add(t,v) {
      const last=pts[pts.length-1];
      if(Math.abs(t-last[0])<1e-9) last[1]=v;
      else pts.push([t,v]);
    }
    for(let c=0;c<p.cycles;c++){
      const t=p.start*1000+c*period;
      add(t,p.low); add(t+p.rise,p.high); add(t+width,p.high); add(t+width+p.fall,p.low);
    }
    add(p.start*1000+p.cycles*period,p.low);
    return pts;
  }
  function dc(vin,p,bn,bp){
    let lo=0, hi=p.vdd;
    if(vin<=VT) return hi;
    if(vin>=p.vdd-VT) return lo;
    for(let k=0;k<55;k++) {
      const mid=(lo+hi)/2, net=drive(p.vdd-vin-VT,p.vdd-mid,bp)-drive(vin-VT,mid,bn);
      if(Math.abs(net)<1e-15) return mid;
      if(net>0) lo=mid; else hi=mid;
    }
    return (lo+hi)/2;
  }
  function simulate(p, refinement=1) {
    const knots=stimulus(p), n=p.stages, bn=strength(p.tn), bp=strength(p.tp);
    const caps=Array.from({length:n},(_,i)=>cap(p,i)), end=knots[knots.length-1][0];
    // Resolve the fastest possible small-signal output pole. Every source corner
    // is an integration boundary, including PWL vertices and very short pulses.
    const hmax=Math.min(4, 0.32*Math.min(...caps)/((bn+bp)*(p.vdd-VT)), end/1500) / refinement;
    const counts=knots.slice(1).map(([t],i)=>Math.max(1,Math.ceil((t-knots[i][0])/hmax)));
    const size=counts.reduce((s,k)=>s+k,1);
    const time=new Float64Array(size), volts=Array.from({length:n+1},()=>new Float32Array(size));
    const state=new Float64Array(n), temp=new Float64Array(n);
    const [a,b,c,d]=Array.from({length:4},()=>new Float64Array(n));
    function derivative(input,x,res) {
      for(let i=0;i<n;i++){
        const out=x[i];
        res[i]=(drive(p.vdd-input-VT,p.vdd-out,bp)-drive(input-VT,out,bn))/caps[i];
        input=out;
      }
    }
    let input=knots[0][1], ix=0;
    volts[0][0]=input;
    for(let i=0;i<n;i++){state[i]=input=dc(input,p,bn,bp); volts[i+1][0]=input;}
    for(let k=0;k<counts.length;k++){
      const [t0,v0]=knots[k], [t1,v1]=knots[k+1], steps=counts[k], h=(t1-t0)/steps, dv=(v1-v0)/steps;
      for(let j=0;j<steps;j++){
        const v=v0+j*dv;
        derivative(v,state,a);
        for(let i=0;i<n;i++) temp[i]=state[i]+0.5*h*a[i];
        derivative(v+dv/2,temp,b);
        for(let i=0;i<n;i++) temp[i]=state[i]+0.5*h*b[i];
        derivative(v+dv/2,temp,c);
        for(let i=0;i<n;i++) temp[i]=state[i]+h*c[i];
        derivative(v+dv,temp,d);
        ix++; time[ix]=t0+(j+1)*h; volts[0][ix]=v+dv;
        for(let i=0;i<n;i++){
          state[i]+=h*(a[i]+2*b[i]+2*c[i]+d[i])/6;
          volts[i+1][ix]=state[i];
        }
      }
    }
    return {time,volts,end,bn,bp,caps};
  }
  function lowerBound(array,t) {
    let a=0,b=array.length;
    while(a<b){const m=(a+b)>>>1;if(array[m]<t)a=m+1;else b=m;}
    return Math.min(a,array.length-1);
  }
  function read(r,t) {
    const b=lowerBound(r.time,t), a=Math.max(0,b-1);
    const f=b===a?0:Math.max(0,Math.min(1,(t-r.time[a])/(r.time[b]-r.time[a])));
    return r.volts.map(v=>v[a]+(v[b]-v[a])*f);
  }
  function crossings(times,v,level) {
    const edges=[];
    // Use the trace's storage precision so an exact threshold plateau stays neutral.
    const threshold = v instanceof Float32Array ? Math.fround(level) : level;
    let lastSide=Math.sign(v[0]-threshold), direction=0, onset=times[0];
    let entry=times[0];
    for(let i=1;i<v.length;i++){
      const slope=Math.sign(v[i]-v[i-1]);
      if(slope && slope!==direction){direction=slope;onset=times[i-1];}
      const side=Math.sign(v[i]-threshold);
      if(v[i-1]!==threshold && side!==Math.sign(v[i-1]-threshold)){
        entry=times[i-1]+(threshold-v[i-1])*(times[i]-times[i-1])/(v[i]-v[i-1]);
      }
      if(side){
        if(lastSide && side!==lastSide)edges.push({up:side>0,t:entry,onset});
        lastSide=side;
      }
    }
    return edges;
  }
  function delays(input,output) {
    const events=input.map((edge,i)=>{
      // An asymmetric inverter may cross before a slowly moving input reaches 50%.
      const stop=input[i+1]?.t ?? Infinity;
      const response=output.find(o=>o.t>=edge.onset && o.t<stop && o.up!==edge.up);
      return {up:edge.up,input:edge.t,output:response?.t??null,delay:response?response.t-edge.t:null};
    });
    function mean(inputUp){
      const matched=events.filter(e=>e.up===inputUp && e.delay!==null);
      return matched.length?matched.reduce((sum,e)=>sum+e.delay,0)/matched.length:null;
    }
    return {rise:mean(false),fall:mean(true),events};
  }
  scope.InverterPhysics={VT,base,presets,drive,strength,cap,stimulus,simulate,read,lowerBound,crossings,delays};
})(globalThis);
