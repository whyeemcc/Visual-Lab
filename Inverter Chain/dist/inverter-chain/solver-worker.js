importScripts('physics.js');
self.onmessage=({data})=>{
  try {
    const result=InverterPhysics.simulate(data);
    self.postMessage(result,[result.time.buffer,...result.volts.map(v=>v.buffer)]);
  } catch(e) { self.postMessage({error:e.message}); }
};
