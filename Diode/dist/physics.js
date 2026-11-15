/* One-dimensional abrupt silicon PN junction. Geometry in cm internally.
 * References: C. Hu, Modern Semiconductor Devices, ch. 4, especially §§4.5–4.11.
 * https://www.chu.berkeley.edu/wp-content/uploads/2020/01/Chenming-Hu_ch4-1.pdf
 * Breakdown knees are illustrative empirical parameters, not process calibration.
 */
(function () {
  'use strict';
  const q = 1.602176634e-19, k = 8.617333262e-5, eps = 11.7 * 8.8541878128e-14;
  const defaults = Object.freeze({
    na: 1e16, nd: 3e16, temp: 300, area: 100, tau: 100, rs: 50, bias: 0,
    forward: 0.8, reverse: 2, pulse: 300, load: 200
  });
  const egAt = t => 1.17 - 4.73e-4 * t * t / (t + 636);
  const exp = x => Math.exp(Math.min(85, x));
  // Bisection is used only for bracketed monotonic characteristics, including
  // the implicit charge step through the soft breakdown knee.
  function bisect(lo, hi, residual) {
    for (let n = 0; n < 52; n++) {
      const m = (lo + hi) / 2;
      if (m === lo || m === hi) break;
      if (residual(m) > 0) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  }
  function device(params = {}) {
    const d = {...defaults, ...params};
    const {temp, na, nd} = d;
    d.vt = k * temp;
    d.eg = egAt(temp);
    d.ni = 1e10 * (temp / 300) ** 1.5 * Math.exp(egAt(300) / (2*k*300) - d.eg / (2*d.vt));
    d.vbi = d.vt * Math.log(na * nd / d.ni ** 2);
    d.areaCm = d.area * 1e-8;
    d.tauSec = d.tau * 1e-9;
    d.neff = na * nd / (na + nd);
    // Low-field mobility with a doping roll-off and temperature dependence.
    const dn = (55 + 1350 / (1 + (na / 9e16) ** 0.7)) * (300/temp) ** 2.2 * d.vt;
    const dp = (50 + 420 / (1 + (nd / 2.2e17) ** 0.7)) * (300/temp) ** 2.2 * d.vt;
    d.ln = Math.sqrt(dn * d.tauSec) * 1e4;
    d.lp = Math.sqrt(dp * d.tauSec) * 1e4;
    d.isN = q * d.areaCm * (d.ni ** 2 / na) * dn / (d.ln * 1e-4);
    d.isP = q * d.areaCm * (d.ni ** 2 / nd) * dp / (d.lp * 1e-4);
    d.is = d.isN + d.isP;
    const w0 = Math.sqrt(2 * eps * d.vbi / (q * d.neff));
    d.c0 = eps * d.areaCm / w0;
    d.i02 = q * d.areaCm * d.ni * w0 / (2 * d.tauSec);
    // At the reference reverse current density (1 A/cm²), the knee is bv.
    // The softer tunneling and avalanche branches overlap rather than switch.
    d.avKnee = (4.8 + 55 * (d.neff / 1e16) ** -0.73) * (1 + 0.0007 * (temp - 300));
    d.tunKnee = (2.4 + 4 * (2e17 / d.neff) ** 1.25) * (1 - 0.0007 * (temp - 300));
    d.avSlope = 0.04 + 0.014 * d.avKnee;
    d.tunSlope = 0.08 + 0.021 * d.tunKnee;
    d.bv = bisect(0, Math.min(d.tunKnee, d.avKnee) + 1, v => breakdown(d,v).i - d.areaCm);
    d.tunnelFraction = breakdown(d,d.bv).tunnel / d.areaCm;
    return d;
  }
  function breakdown(d, vr) {
    if (vr <= 0) return {i:0, g:0, tunnel:0};
    const av = exp((vr - d.avKnee) / d.avSlope);
    const tu = exp((vr - d.tunKnee) / d.tunSlope);
    const tunnel = d.areaCm * (tu - Math.exp(-d.tunKnee / d.tunSlope));
    const avalanche = d.areaCm * (av - Math.exp(-d.avKnee / d.avSlope));
    return {i:avalanche + tunnel, g:d.areaCm * (av / d.avSlope + tu / d.tunSlope), tunnel};
  }
  function conduction(d, u) {
    const U = u / d.vt;
    const idiff = d.is * Math.expm1(Math.min(85,U));
    const irec = d.i02 * Math.expm1(Math.min(85,U/2));
    const br = breakdown(d,-u);
    const gdiff = d.is * exp(U) / d.vt;
    const g = gdiff + d.i02 * exp(U/2) / (2*d.vt) + br.g;
    return {idiff,irec,ibreak:-br.i,itunnel:-br.tunnel,i:idiff + irec - br.i,g,gdiff};
  }
  function junctionVoltage(d, vs, r) {
    if (!r || !vs) return vs;
    return bisect(Math.min(vs,0), Math.max(vs,0), u => u + r * conduction(d,u).i - vs);
  }
  // Integrating dQ/dV gives the depletion charge referenced to zero bias.
  // Use the usual tangent continuation of C above 0.9 Vbi, where an abrupt
  // depletion capacitance would otherwise diverge. Electrostatic W still
  // tends to zero at flat band, and profiles there are marked invalid.
  function depletion(d,u) {
    const cutoff = 0.9 * d.vbi;
    if (u <= cutoff) {
      const s = Math.sqrt(1 - u/d.vbi);
      return {c:d.c0/s, charge:2*d.c0*u/(1+s)};
    }
    const cc = d.c0 / Math.sqrt(0.1), dv = u-cutoff, slope = cc / (0.2*d.vbi);
    return {c:cc + slope*dv, charge:2*d.c0*cutoff/(1 + Math.sqrt(0.1)) + dv*(cc + 0.5*slope*dv)};
  }
  function at(d, vs = d.bias, extraR = 0) {
    const vj = junctionVoltage(d,vs,d.rs + extraR);
    const c = conduction(d,vj);
    const barrier = Math.max(0,d.vbi - vj);
    const wCm = Math.sqrt(2*eps*barrier/(q*d.neff));
    const w = wCm * 1e4, xp = w*d.nd/(d.na+d.nd), xn = w*d.na/(d.na+d.nd);
    const expBias = Math.expm1(Math.min(85,vj/d.vt));
    const highInjection = d.ni ** 2 * expBias > 0.1 * Math.min(d.na,d.nd) ** 2;
    return {...c, vs, v:vj + d.rs*c.i, vj, barrier, w, xp, xn, emax:q*d.neff*wCm/eps,
      rd:d.rs + 1/c.g, cj:depletion(d,vj).c, cd:d.tauSec*c.gdiff,
      highInjection,flatBand:vj >= d.vbi,capContinued:vj > 0.9*d.vbi};
  }
  function atCurrent(d, i) {
    if (!i) return at(d,0);
    const vj = bisect(i < 0 ? -2*d.bv-5 : 0, i > 0 ? Math.max(3,85*d.vt) : 0, u => conduction(d,u).i - i);
    return at(d,vj + d.rs*i);
  }
  function profile(d,op,x) {
    let rho=0, field=0, phi=0, jn=0, jp=0, minority=null;
    const j = op.i / d.areaCm;
    const amp = Math.expm1(Math.min(85,op.vj/d.vt));
    const jnEdge = d.isN * amp / d.areaCm, jpEdge = d.isP * amp / d.areaCm;
    if (x <= -op.xp) {
      const l = (-op.xp - x) / d.ln;
      minority = d.ni ** 2 / d.na * (-Math.expm1(-l) + exp(op.vj/d.vt-l));
      jn = jnEdge * Math.exp(-l);
      jp = j - jn;
    } else if (x >= op.xn) {
      phi=op.barrier;
      const l = (x-op.xn) / d.lp;
      minority = d.ni ** 2 / d.nd * (-Math.expm1(-l) + exp(op.vj/d.vt-l));
      jp = jpEdge * Math.exp(-l);
      jn = j - jp;
    } else {
      // Uniform generation/recombination inside the space-charge region is
      // approximated by linear interpolation of its boundary carrier currents.
      const fraction = (x+op.xp) / op.w;
      jn = jnEdge + fraction*(j-jpEdge-jnEdge);
      jp = j - jn;
      if (x < 0) {
        rho = -q*d.na;
        const dx = (x+op.xp) * 1e-4;
        field = rho*dx/eps;
        phi = -field*dx/2;
      } else {
        rho = q*d.nd;
        const dx = (op.xn-x) * 1e-4;
        field = -rho*dx/eps;
        phi = op.barrier + field*dx/2;
      }
    }
    // Energy zero is the conduction band in the neutral P region.
    return {phi,ec:-phi,ev:-phi-d.eg,field,rho,minority,jn,jp};
  }

  // Lumped charge-control model. Iport = Iconduction + d(Qdep + τ Idiff)/dt.
  // Backward Euler solves the nonlinear diode charge and series circuit in
  // one monotone scalar equation, so circuit voltage and current satisfy KVL.
  function transient(d) {
    const r = Math.max(1e-6,d.rs + d.load);
    const hi = junctionVoltage(d,d.forward,r);
    const lo = junctionVoltage(d,-Math.abs(d.reverse),r);
    const charge = (u,c) => depletion(d,u).charge + d.tauSec*c.idiff;
    const samples=[];
    let u=0, stored=0, last=-d.pulse;
    function record(t,vs,c,i) {
      samples.push({t,vs,vd:u + d.rs*i,vj:u,i,q:Math.max(0,d.tauSec*c.idiff)});
    }
    function advance(t,vs,equilibrium) {
      const dt=(t-last)*1e-9;
      const previous=stored;
      const residual = v => {
        const c = conduction(d,v);
        return v-vs + r*(c.i + (charge(v,c)-previous)/dt);
      };
      u = bisect(Math.min(u,equilibrium),Math.max(u,equilibrium),residual);
      const c=conduction(d,u);
      stored=charge(u,c);
      record(t,vs,c,(vs-u)/r);
      last=t;
    }
    // Nonuniform sampling resolves contact RC (often sub-ns) and long storage.
    function sweep(start, duration, vs, equilibrium, count, shortest) {
      const span = Math.log1p(duration/shortest);
      for (let n=1; n<=count; n++) {
        const time=n===count ? start+duration : start+shortest*Math.expm1(span*n/count);
        if (time > last) advance(time,vs,equilibrium);
      }
    }
    const rcNs = Math.max(1e-7, r*d.c0*1e9);
    record(-d.pulse,0,conduction(d,0),0);
    sweep(-d.pulse,d.pulse,d.forward,hi,200,Math.min(rcNs,d.tau,d.pulse)*0.5);
    const c0=conduction(d,u);
    // The ideal source steps at exactly t=0. Repeated time points represent
    // the left and right limits without assigning finite charge to the jump.
    record(0,-Math.abs(d.reverse),c0,(-Math.abs(d.reverse)-u)/r);
    const first=samples.length-1, peak=Math.max(0,-samples[first].i);
    const recoveryDuration=Math.max(6*d.tau,50*rcNs);
    sweep(0,recoveryDuration,-Math.abs(d.reverse),lo,420,Math.min(rcNs,d.tau)*0.25);
    let tEnd=null,qrr=0;
    const threshold=peak/4;
    for (let n=first+1; n<samples.length && peak>0; n++) {
      const a=samples[n-1], b=samples[n];
      const ia=-a.i, ib=-b.i;
      if (ib <= threshold && ia > ib) {
        tEnd=a.t+(b.t-a.t)*(ia-threshold)/(ia-ib);
        qrr+=(tEnd-a.t)*1e-9*(ia+threshold)/2;
        break;
      }
      qrr+=(b.t-a.t)*1e-9*(ia+ib)/2;
    }
    return {samples,trr:tEnd,qrr:tEnd===null ? null : qrr,tZero:0,tEnd,peak};
  }
  const api = {defaults,device,at,atCurrent,profile,transient};
  if (typeof module === 'object' && module.exports) module.exports=api;
  if (typeof window === 'object') window.DiodePhysics=api;
})();
