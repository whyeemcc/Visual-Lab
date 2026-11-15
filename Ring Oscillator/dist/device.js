/* Shared CMOS device law and sampled-waveform measurements from Inverter Chain. */
(function(){
  const VT=0.32, REFERENCE_VDD=1.2, REFERENCE_C=4;
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
  globalThis.RingDevice={VT,drive,strength,lowerBound,read,crossings,delays};
})();
