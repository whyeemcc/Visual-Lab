// Small-signal SI model. UI inputs are in pF, kΩ, mS and ns.
(function(root){
  'use strict';
  const chargeDefaults={gain:-10,stepV:.8,tr:40,cgs:4,cgd:1};
  const acDefaults={gm:3,rd:4.7,ro:40,rs:22,cds:7,cgs:4,cgd:1};
  function ramp(p){
    const cin=p.cgs+p.cgd*(1-p.gain),deltaQ=p.stepV*cin;
    const points=[];
    for(let i=0;i<=200;i++){
      const x=p.tr*(i/150-.12),v=p.stepV*Math.min(1,Math.max(0,x/p.tr)),vd=p.gain*v;
      points.push({x,vg:v,vd,vgd:v-vd,qg:cin*v,qgd:p.cgd*(v-vd),qgs:p.cgs*v});
    }
    return {points,cin,deltaQ,igd:p.cgd*(1-p.gain)*p.stepV/p.tr,ig:deltaQ/p.tr};
  }
  function ac(p){
    const gm=p.gm*1e-3,rs=p.rs*1e3,g=1/(p.rd*1e3)+1/(p.ro*1e3);
    const gs=p.cgs*1e-12,ds=p.cds*1e-12,gd=p.cgd*1e-12;
    const gain=-gm/g;
    const cin=gs+gd*(1-gain),fm=1/(2*Math.PI*rs*cin);
    function denominator(f,c){
      const w=2*Math.PI*f,co=ds+c,ci=gs+c;
      const re=g-w*w*rs*(ci*co-c*c),im=w*(co+rs*(g*ci+gm*c));
      return {w,co,re,im};
    }
    function response(f,c){
      const {w,co,re,im}=denominator(f,c);
      const mag=Math.hypot(gm,w*c)/Math.hypot(re,im);
      const realDG=(-gm*g+w*w*c*co)/(g*g+(w*co)**2);
      return {mag,cin:(gs+c*(1-realDG))*1e12};
    }
    function corner(c){
      const target=-gain/Math.sqrt(2);
      let lo=-2,hi=15;
      for(let i=0;i<60;i++){const m=(lo+hi)/2;if(response(10**m,c).mag>target)lo=m;else hi=m;}
      return 10**((lo+hi)/2);
    }
    const bw=corner(gd),noFeedbackBW=corner(0);
    const low=Math.floor(Math.log10(Math.min(bw,fm,noFeedbackBW)))-1;
    const high=Math.ceil(Math.log10(Math.max(bw,fm,noFeedbackBW,g/(2*Math.PI*(ds+gd)))))+1;
    const points=[];
    for(let k=0;k<=400;k++){
      const x=10**(low+(high-low)*k/400),h=response(x,gd);
      points.push({x,gain:20*Math.log10(h.mag),noFeedback:20*Math.log10(response(x,0).mag),
        approx:20*Math.log10(-gain/Math.hypot(1,x/fm)),cin:h.cin,staticCap:cin*1e12});
    }
    // Phasors for a 10 mV peak test source, using the same nodal solution
    // as the frequency sweep. Values are increments about the bias point.
    function cycle(f){
      const {w,co,re,im}=denominator(f,gd),scale=.01/(re*re+im*im);
      function phasor(a,b){return {r:scale*(a*re+b*im),i:scale*(b*re-a*im)};}
      const gate=phasor(g,w*co),drain=phasor(-gm,w*gd);
      const wave=[];
      for(let i=0;i<=160;i++){
        const angle=2*Math.PI*i/160,cs=Math.cos(angle),sn=Math.sin(angle);
        const vg=gate.r*cs-gate.i*sn,vd=drain.r*cs-drain.i*sn;
        const slope=v=>-w*(v.r*sn+v.i*cs);
        const igs=p.cgs*slope(gate)*1e-6,igd=p.cgd*(slope(gate)-slope(drain))*1e-6;
        const t=1e9*i/(160*f);
        wave.push({t,x:t,vg,vd,igs,igd,qgs:p.cgs*vg,qgd:p.cgd*(vg-vd)});
      }
      return wave;
    }
    return {gain,cin:cin*1e12,bw,fm,noFeedbackBW,points,cycle};
  }
  const api={ramp,ac,chargeDefaults,acDefaults};
  if(root)root.MillerModel=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:null);
