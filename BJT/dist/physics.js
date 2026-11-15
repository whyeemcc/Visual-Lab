// One-dimensional silicon homojunction. Lengths exposed in µm, densities in cm⁻³,
// port currents positive into the device. Voltages and currents are signed.
(function(root){
  'use strict';
  const q=1.602176634e-19,eps=11.7*8.8541878128e-14;
  const defaults={type:'NPN',width:.65,tau:8,ne:1e19,nb:1e17,nc:2e16,temp:300,area:100,
    vbe:.68,vce:2,ib:4,vcc:5,rc:2200,re:100,rs:1000,rl:10000,amp:10,drive:100,
    reverse:20,pulse:300,cmu:1,vbias:.85};
  const exp=x=>Math.exp(Math.min(x,48));
  function zero(lo,hi,fn){
    for(let k=0;k<38;k++){const m=(lo+hi)/2;if(fn(m)>0)hi=m;else lo=m;}
    return (hi+lo)/2;
  }
  function device(params){
    const d={...defaults,...params};
    d.s=d.type==='PNP'?-1:1;d.vt=8.617333262e-5*d.temp;
    const gap=t=>1.17-4.73e-4*t*t/(t+636);
    d.eg=gap(d.temp); d.ni=1e10*(d.temp/300)**1.5*Math.exp(gap(300)/(2*8.617333262e-5*300)-d.eg/(2*d.vt));
    d.areaCm=d.area*1e-8;
    d.db=(d.s>0?23:9)*(d.temp/300)**-1.2;
    d.length=Math.sqrt(d.db*d.tau*1e-9);
    d.vbiE=d.vt*Math.log(d.ne*d.nb/d.ni**2);d.vbiC=d.vt*Math.log(d.nc*d.nb/d.ni**2);
    const otherD=d.s>0?7:17;
    const scale=q*d.areaCm*d.ni**2;
    d.js=scale*d.db/(d.nb*d.length);
    d.backE=scale*Math.sqrt(otherD/2e-9)/d.ne;
    d.backC=scale*Math.sqrt(otherD/20e-9)/d.nc;
    return d;
  }
  function junction(d,n,vbi,v){
    const drop=Math.max(0,vbi-v);
    const width=1e4*Math.sqrt(2*eps*drop/q*(1/d.nb+1/n));
    return {b:width*n/(d.nb+n),outer:width*d.nb/(d.nb+n),width};
  }
  function at(d,vbe,vce){
    const s=d.s,be=s*vbe,bc=s*(vbe-vce);
    const e=junction(d,d.ne,d.vbiE,be),c=junction(d,d.nc,d.vbiC,bc);
    const wb=d.width-e.b-c.b,w=Math.max(.015,wb);
    const z=w*1e-4/d.length;
    // Finite-base diffusion with both minority-carrier boundary concentrations.
    // The cosh loss term includes recombination; the common transport coefficient
    // gives alpha_F I_ES = alpha_R I_CS at each neutral width.
    const is=d.js/Math.sinh(z),loss=is*2*Math.sinh(z/2)**2;
    const ef=exp(be/d.vt)-1,er=exp(bc/d.vt)-1;
    const iF=is*ef,iR=is*er,baseRec=loss*(ef+er),backInj=d.backE*ef+d.backC*er;
    const sr=q*d.areaCm*d.ni*1e-5/(2*80e-9);
    const scrE=sr*(exp(be/(2*d.vt))-1),scrC=sr*(exp(bc/(2*d.vt))-1);
    const ib=baseRec+backInj+scrE+scrC;
    const ic=iF-iR-(loss+d.backC)*er-scrC;
    const alphaT=1/Math.cosh(z),gamma=(is+loss)/(is+loss+d.backE);
    const mode=(Math.abs(be)+Math.abs(bc)<1e-12)?'equilibrium':be>0?(bc>1e-12?'saturation':'active'):(bc>1e-12?'reverse':'cutoff');
    const tf=(w*1e-4)**2/(2*d.db),tr=8e-9;
    const charge=tf*Math.max(0,iF)+tr*Math.max(0,iR);
    return {vbe,vbc:vbe-vce,vce,ic:s*ic,ib:s*ib,ie:-s*(ib+ic),mode,
      regime:{equilibrium:'热平衡',cutoff:'截止',saturation:'饱和',active:'正向放大',reverse:'反向放大'}[mode],
      gamma,alphaT,alphaF:gamma*alphaT,betaF:is/(loss+d.backE),baseRec:s*baseRec,backInj:s*backInj,scrRec:s*(scrE+scrC),
      w,xbE:e.b,xbC:c.b,xe:e.outer,xc:c.outer,flat:be>=d.vbiE||bc>=d.vbiC,
      highInjection:d.ni**2*Math.max(ef,er)>0.1*d.nb**2,punchThrough:wb<=.015,charge,tf,tr,is};
  }
  function byBase(d,ib,vce){
    const be=zero(-2,Math.max(1.2,d.s*vce+1.2),u=>d.s*(at(d,d.s*u,vce).ib-ib));
    return at(d,d.s*be,vce);
  }
  // Solve both base-drive KVL and collector-load KCL. The ideal AC coupling
  // capacitor holds the DC collector voltage as the load reference.
  function loaded(d,base,driveMode='voltage',ref=null){
    const s=d.s,rc=d.rc,rl=ref===null?Infinity:d.rl;
    const r=1/(1/rc+1/rl),rail=(d.vcc/rc+(ref===null?0:s*ref/rl))*r;
    function givenBE(u){
      const sbe=s*u;
      const ce=zero(-.8,Math.max(rail,1)+.2,ce=>{
        const p=at(d,sbe,s*ce);
        return ce+s*(r*p.ic-d.re*p.ie)-rail;
      });
      const p=at(d,sbe,s*ce); p.ve=-p.ie*d.re;p.vc=p.vce+p.ve;p.vb=p.vbe+p.ve;
      return p;
    }
    const input=u=>{const p=givenBE(u);return driveMode==='current'?s*(p.ib-base):s*(p.vb+p.ib*d.rs-base)};
    return givenBE(zero(-1,1.15,input));
  }
  function small(d,p){
    const h=1e-5;
    const bp=at(d,p.vbe+h,p.vce),bm=at(d,p.vbe-h,p.vce);
    const cp=at(d,p.vbe,p.vce+h),cm=at(d,p.vbe,p.vce-h);
    const gm=(bp.ic-bm.ic)/(2*h),go=(cp.ic-cm.ic)/(2*h),gpi=(bp.ib-bm.ib)/(2*h);
    const cdep=w=>eps*d.areaCm/(Math.max(w,.015)*1e-4);
    return {gm,go,gpi,rpi:1/Math.max(1e-20,gpi),ro:1/Math.max(1e-20,go),
      cpi:cdep(p.xe+p.xbE)+p.tf*p.is*exp(d.s*p.vbe/d.vt)/d.vt,
      cmu:d.cmu*(cdep(p.xc+p.xbC)+p.tr*p.is*exp(d.s*p.vbc/d.vt)/d.vt)};
  }
  function profile(d,p,x){
    const be=d.s*p.vbe,bc=d.s*p.vbc;
    const riseE=d.vbiE-be,riseC=d.vbiC-bc;
    const potential=(dx,left,right,drop)=>{
      if(dx<=-left)return 0;if(dx>=right)return drop;
      if(dx<0)return drop*(dx+left)**2/Math.max(1e-24,left*(left+right));
      return drop*(1-(right-dx)**2/Math.max(1e-24,right*(left+right)));
    };
    const ec=d.s*(potential(x,p.xe,p.xbE,riseE)-potential(x-d.width,p.xbC,p.xc,riseC));
    const z=p.w*1e-4/d.length,t=Math.max(0,Math.min(1,(x-p.xbE)/p.w));
    const minority=d.ni**2/d.nb*(1+(exp(be/d.vt)-1)*Math.sinh(z*(1-t))/Math.sinh(z)+(exp(bc/d.vt)-1)*Math.sinh(z*t)/Math.sinh(z));
    return {ec,ev:ec-d.eg,minority:x>=p.xbE&&x<=d.width-p.xbC?Math.max(0,minority):null};
  }
  function amplifier(d){
    const base=d.s*d.vbias,p=loaded(d,base),samples=[];
    const delta=1e-4;
    const gain=(loaded(d,base+delta,'voltage',p.vc).vc-loaded(d,base-delta,'voltage',p.vc).vc)/(2*delta);
    // Interpolate a densely sampled memoryless transfer over the actual swing.
    const amplitude=d.amp*1e-3;
    const transfer=Array.from({length:49},(_,i)=>loaded(d,base+amplitude*(i/24-1),'voltage',p.vc).vc);
    for(let k=0;k<=180;k++){
      const t=2000*k/180,phase=Math.sin(2*Math.PI*t/1000),u=24*(1+phase),j=Math.min(47,Math.floor(u));
      samples.push({t,vin:base+amplitude*phase,vout:transfer[j]+(transfer[j+1]-transfer[j])*(u-j),linear:p.vc+gain*amplitude*phase});
    }
    return {op:p,samples,gain};
  }
  function switching(d){
    const s=d.s;
    // Tabulate the charge manifold along the resistive collector load.
    // Charge balance: dQ/dt = IBdrive - IBsteady(Q). Intervals have linear
    // interpolants. Exact exponential stepping across each interval avoids
    // timestep-dependent storage delay, even at large overdrive.
    function point(u){
      const v=zero(-.4,d.vcc+.05,v=>v+d.rc*s*at(d,s*u,s*v).ic-d.vcc);
      return at(d,s*u,s*v);
    }
    const f=d.drive*1e-6,r=-d.reverse*1e-6;
    const top=zero(.15,1.14,u=>s*point(u).ib-1.02*f);
    const points=Array.from({length:401},(_,i)=>point(top*i/400));
    const on=point(zero(0,top,u=>s*point(u).ib-f));
    const samples=[];
    let t=0,charge=0;
    function stage(drive,end,step){
      let idx=0;
      while(idx<points.length-2&&points[idx+1].charge<=charge)idx++;
      let next=t;
      for(let guard=0;guard<6000&&t<=end+1e-10;guard++){
        const l=points[idx],h=points[idx+1],dq=Math.max(h.charge-l.charge,1e-36);
        const fraction=Math.max(0,Math.min(1,(charge-l.charge)/dq)),mix=k=>l[k]+(h[k]-l[k])*fraction;
        samples.push({t,ib:charge<=0&&drive<0?0:s*drive,ic:mix('ic'),vce:mix('vce'),vbe:mix('vbe'),q:charge});
        if(t>=end)break;
        if(next<=t+1e-10)next=Math.min(end,t+step);
        const dt=(next-t)*1e-9,i0=drive-s*mix('ib'),g=s*(h.ib-l.ib)/dq;
        const change=g>0?i0*(-Math.expm1(-g*dt))/g:i0*dt;
        const up=i0>=0,bound=up?h.charge:l.charge,remaining=bound-charge;
        if((up?change>=remaining:change<=remaining)&&(up?idx<points.length-2:idx>0)){
          const ratio=g*remaining/i0;
          t+=Math.max(0,ratio<1&&g>0?-Math.log1p(-ratio)/g:remaining/i0)*1e9;
          charge=bound;idx+=up?1:-1;
        }else{charge=Math.max(0,charge+change);t=next;}
      }
    }
    stage(f,d.pulse,d.pulse/120);
    const pulseEnd=samples.at(-1),peak=s*pulseEnd.ic;
    const switchPoint=at(d,pulseEnd.vbe,pulseEnd.vce);
    switchPoint.charge=pulseEnd.q;
    const end=Math.max(10,Math.min(20000,12*(pulseEnd.q/Math.max(1e-8,-r+f*.04))*1e9+8*d.tau));
    stage(r,d.pulse+end,end/240);
    function crossing(level,after){
      for(let k=1;k<samples.length;k++){
        const a=samples[k-1],b=samples[k];
        if(after?a.t<d.pulse:b.t>d.pulse)continue;
        const v=s*a.ic,w=s*b.ic;
        if(after?v>level&&w<=level:v<level&&w>=level)return a.t+(b.t-a.t)*(level-v)/(w-v);
      }
      return null;
    }
    const t10=crossing(.1*peak,false),t90=crossing(.9*peak,false),t90off=crossing(.9*peak,true),t10off=crossing(.1*peak,true);
    return {samples,on,switchPoint,delay:t10,rise:t90==null||t10==null?null:t90-t10,
      storage:t90off==null?null:t90off-d.pulse,fall:t10off==null||t90off==null?null:t10off-t90off};
  }
  // Nodal equations in vπ=vb-ve and vx=vc-ve. Eliminate ve via emitter KCL.
  // Complex arithmetic is confined to AC analysis.
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[1]*b[0]+a[0]*b[1]];
  const scale=(a,s)=>[a[0]*s,a[1]*s],mag=a=>Math.hypot(...a);
  function frequency(d,p){
    const {gm,go,gpi,cpi,cmu}=small(d,p),samples=[];
    const gl=1/d.rc+1/d.rl;
    for(let i=0;i<=300;i++){
      const f=10**(i/25),w=2*Math.PI*f,yp=[gpi,w*cpi],ym=[0,w*cmu];
      const A=add([1+d.re*gm,0],add(scale(yp,d.re+d.rs),scale(ym,d.rs)));
      const B=sub([d.re*go,0],scale(ym,d.rs));
      const C=sub(add([gm*(1+gl*d.re),0],scale(yp,gl*d.re)),ym);
      const D=add([gl+go*(1+gl*d.re),0],ym);
      const numerator=sub(mul(scale(add(yp,[gm,0]),d.re),D),scale(C,1+d.re*go));
      const av=mag(numerator)/mag(sub(mul(A,D),mul(B,C)));
      const h21=mag(sub([gm,0],ym))/mag(add(yp,ym));
      samples.push({f,h21,av});
    }
    function cross(key,target){
      for(let i=1;i<samples.length;i++){
        const a=samples[i-1],b=samples[i];
        if(a[key]>=target&&b[key]<=target)return a.f*(b.f/a.f)**(Math.log(target/a[key])/Math.log(b[key]/a[key]));
      }
      return null;
    }
    return {samples,ft:cross('h21',1),bw:cross('av',samples[0].av/Math.sqrt(2)),gain:-samples[0].av};
  }
  const api={defaults,device,at,byBase,loaded,small,profile,amplifier,switching,frequency};
  if(typeof module!=='undefined')module.exports=api;
  if(root)root.BJTPhysics=api;
})(typeof window!=='undefined'?window:null);
