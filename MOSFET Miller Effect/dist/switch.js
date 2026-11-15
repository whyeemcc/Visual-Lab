/* Ideal inductive load over one switching edge. Source and body are grounded;
 * diode from drain to the positive rail. Units: V, A, Ω, ns, nC. Public C in pF.
 * See Texas Instruments, SLUA618A, "Fundamentals of MOSFET and IGBT Gate Driver Circuits".
 */
(function (root) {
  'use strict';
  const defaults = Object.freeze({
    edge: 'on', capMode: 'nonlinear', vbus: 48, vdrive: 10, load: 5, rg: 12,
    cgs: 1100, cgd: 160, cds: 180, vth: 2.5, k: 3
  });
  const floor = 0.15, knee = 4;

  function capacitance(u, c0, nonlinear) {
    if (!nonlinear || u >= 0) return c0;
    return c0 * (floor + (1 - floor) / Math.sqrt(1 - u / knee));
  }

  // Gate-side charge. Differentiating gives the requested Cgd(Vg - Vd).
  function charge(u, c0, nonlinear) {
    if (!nonlinear || u >= 0) return c0 * u;
    return c0 * u * (floor + 2 * (1 - floor) / (1 + Math.sqrt(1 - u / knee)));
  }

  function channel(p, vg, vd) {
    const overdrive = Math.max(0, vg - p.vth);
    const v = Math.min(overdrive, vd);
    return p.k * v * (overdrive - v / 2);
  }

  function between(a, b, fraction) {
    const point = {};
    for (const key of Object.keys(a)) point[key] = a[key] + (b[key] - a[key]) * fraction;
    return point;
  }

  function simulate(params = {}) {
    const p = {...defaults, ...params};
    const on = p.edge === 'on', drive = on ? p.vdrive : 0;
    const nonlinear = p.capMode === 'nonlinear';
    const cgs = p.cgs / 1000, cds = p.cds / 1000;
    const c0 = p.capMode === 'off' ? 0 : p.cgd / 1000;
    const ov = p.vdrive - p.vth;
    if (!(ov > 0 && p.k * ov * ov / 2 > p.load && channel(p, p.vdrive, p.vbus) > p.load)) {
      throw new RangeError('驱动电压不足以使 MOSFET 完成负载换流');
    }
    const von = 2 * p.load / (p.k * (ov + Math.sqrt(ov * ov - 2 * p.load / p.k)));
    let vg = on ? 0 : p.vdrive, vd = on ? p.vbus : von;
    let q = charge(vg - vd, c0, nonlinear);
    const initialGateCharge = cgs * vg + q;
    const samples = [];
    function record(t, igd, diode) {
      samples.push({
        t, vg, vd, id: channel(p, vg, vd), ig: (drive - vg) / p.rg, igd, diode,
        qg: cgs * vg + q - initialGateCharge, qbranch: q,
        cgd: capacitance(vg - vd, c0, nonlinear) * 1000
      });
    }
    const initC = capacitance(vg - vd, c0, nonlinear);
    // At the initial switch-on state the upper diode conducts. At switch-off
    // the drain is initially free and the Cgs/Cgd/Cds matrix determines dv/dt.
    const initIG = (drive - vg) / p.rg;
    const initIGD = on ? initIG * initC / (cgs + initC)
      : initIG * initC * cds / (cgs * cds + initC * (cgs + cds));
    record(0, initIGD, on ? p.load + initIGD : 0);

    // Backward Euler in capacitor charges. For a trial Vd the gate equation
    // a*u + Qgd(u) = rhs has a closed-form solution even for nonlinear Cgd.
    // This leaves a scalar, strictly increasing residual at the drain.
    function advance(h) {
      const prevD = vd, prevQ = q;
      const a = cgs + h / p.rg;
      const gateRhs = cgs * vg + q + h / p.rg * drive;
      function residual(candidate) {
        const rhs = gateRhs - a * candidate;
        let u;
        if (nonlinear && rhs < 0 && c0 > 0) {
          const full = a + c0, depleted = a + c0 * floor;
          const y = rhs / knee / (full + Math.sqrt(full * full - depleted * rhs / knee));
          u = knee * y * (2 - y);
        } else {
          u = rhs / (a + c0);
        }
        vg = u + candidate;
        q = charge(u, c0, nonlinear);
        return cds * (candidate - prevD) - (q - prevQ) + h * (channel(p, vg, candidate) - p.load);
      }

      // Complementarity at each diode. At the positive rail a negative
      // residual means the freewheel diode carries the surplus load current.
      let lo = 0, hi = p.vbus;
      let v = prevD, r = residual(v);
      for (let j = 0; j < 45; j++) {
        if (Math.abs(r) < 5e-12 || (v === hi && hi === p.vbus && r < 0) ||
            (v === lo && lo === 0 && r > 0)) break;
        if (r > 0) hi = v;
        else lo = v;
        const cg = capacitance(vg - v, c0, nonlinear);
        const dgv = cg / (a + cg);
        const u = Math.max(0, vg - p.vth);
        const slope = cds + cg * (1 - dgv)
          + h * p.k * (Math.max(0, u - v) + Math.min(v, u) * dgv);
        const trial = v - r / slope;
        if (trial >= hi && hi === p.vbus) v = hi;
        else if (trial <= lo && lo === 0) v = lo;
        else v = trial > lo && trial < hi ? trial : (lo + hi) / 2;
        r = residual(v);
      }
      vd = v;
      return {igd: (q - prevQ) / h, diode: vd === p.vbus ? Math.max(0, -r / h) : 0};
    }

    const swing = p.vbus - von;
    const vPlateauEstimate = p.vth + Math.sqrt(2 * p.load / p.k);
    const gateTime = p.rg * (cgs + c0);
    const driveCurrent = Math.abs(drive - vPlateauEstimate) / p.rg;
    const drainTime = cds * swing / p.load + Math.abs(
      charge(vPlateauEstimate - p.vbus, c0, nonlinear)
      - charge(vPlateauEstimate - von, c0, nonlinear)) / driveCurrent;
    // With negligible feedback the channel current itself must ramp above
    // the load before Cds can discharge. Its rate is gm * Ig / Cgs. Include
    // this time scale so reducing Cgd to zero does not imply an instantaneous edge.
    const gm = Math.sqrt(2 * p.k * p.load);
    const channelTime = Math.sqrt(2 * cds * swing * cgs / (gm * driveCurrent));
    const fine = Math.min(gateTime / 110, Math.max(drainTime, channelTime) / 150);
    const maxTime = 14 * gateTime + 8 * drainTime;
    const vstart = von + (on ? 0.9 : 0.1) * swing;
    const vend = von + (on ? 0.1 : 0.9) * swing;
    let t = 0, first = null, last = null;
    while (t < maxTime) {
      // Keep dense samples through drain slew. Relax the step only in the
      // clamped initial phase and after the measurement interval.
      const atInitial = on ? vd === p.vbus : vg > vPlateauEstimate + 0.5;
      const dt = Math.min(maxTime - t, last ? Math.max(fine, gateTime / 75) :
        atInitial ? Math.min(gateTime / 130, fine * 5) : fine);
      const flow = advance(dt);
      t += dt;
      record(t, flow.igd, flow.diode);
      const a = samples[samples.length - 2], b = samples[samples.length - 1];
      const crossed = level => on ? a.vd >= level && b.vd < level : a.vd <= level && b.vd > level;
      if (!first && crossed(vstart)) first = between(a, b, (vstart - a.vd) / (b.vd - a.vd));
      if (!last && crossed(vend)) last = between(a, b, (vend - a.vd) / (b.vd - a.vd));
      const finalDrain = on ? von : p.vbus;
      if (last && Math.abs(vg - drive) < 0.006 * p.vdrive && Math.abs(vd - finalDrain) < 0.001 * swing) break;
    }
    const result = {samples, von, start: null, end: null, duration: null,
      qgd: null, plateau: null, slew: null, energy: null};
    if (!first || !last) return result;
    let gateArea = 0, channelEnergy = 0;
    let prev = first;
    function integrate(next) {
      const h = next.t - prev.t;
      gateArea += (prev.vg + next.vg) * h / 2;
      channelEnergy += (prev.vd * prev.id + next.vd * next.id) * h / 2;
      prev = next;
    }
    for (const item of samples) {
      if (item.t > first.t && item.t < last.t) integrate(item);
    }
    integrate(last);
    const duration = last.t - first.t;
    return {...result, start: first.t, end: last.t, duration,
      qgd: Math.abs(last.qbranch - first.qbranch),
      plateau: gateArea / duration, slew: (last.vd - first.vd) / duration, energy: channelEnergy / 1000};
  }

  const api = {defaults, simulate};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MillerSwitch = api;
})(typeof window === 'object' ? window : null);
