importScripts('device.js','ring.js');
self.onmessage=({data})=>{
  const r=RingModel.solve(data);
  self.postMessage(r,[r.time.buffer,r.en.buffer,r.idd.buffer,...r.volts.map(v=>v.buffer)]);
};
