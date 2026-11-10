import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import { BatteryClient } from '../src/client.js';
const device={id:'mouse',displayName:'DeathAdder V4 Pro',percentage:61,level:'medium',charging:false,connected:true,stale:false,lastSeen:1};
async function until(fn:()=>boolean,timeout=4000){const end=Date.now()+timeout;while(!fn()){if(Date.now()>end)throw new Error('Condition timed out');await new Promise(r=>setTimeout(r,10));}}
test('auth, notification-before-reply, refresh coalescing, malformed data and reconnect',async()=>{
  const server=new WebSocketServer({host:'127.0.0.1',port:0});await once(server,'listening');
  const address=server.address();assert.ok(address&&typeof address==='object');
  let connects=0,auths=0,refreshes=0,subscribes=0;
  server.on('connection',ws=>{connects++;ws.on('message',raw=>{
    const m=JSON.parse(raw.toString());let result:unknown={};
    if(m.method==='system.authorize'){assert.equal(m.params.token,'test-token');auths++;result={authorized:true};}
    if(m.method==='system.getInfo')result={apiVersion:'1.0'};
    if(m.method==='devices.subscribe'){subscribes++;ws.send(JSON.stringify({jsonrpc:'2.0',method:'devices.updated',params:{devices:[device]}}));result={subscriptionId:'s-1'};}
    if(m.method==='devices.list')result={devices:[device]};
    if(m.method==='refresh.now'){refreshes++;assert.equal(m.params.wait,false);result={queued:true};}
    ws.send(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));
  });});
  const client=new BatteryClient(`ws://127.0.0.1:${address.port}/`,'test-token');
  try{
    client.start();await until(()=>client.online);assert.equal(client.devices[0].percentage,61);assert.equal(auths,1);
    await Promise.all([client.refresh(),client.refresh(),client.refresh()]);assert.equal(refreshes,1);
    for(const ws of server.clients){ws.send('{bad');ws.send(JSON.stringify({jsonrpc:'2.0',method:'devices.updated',params:{devices:[{...device,percentage:999}]}}));}
    await new Promise(r=>setTimeout(r,30));assert.equal(client.devices[0].percentage,61);
    for(const ws of server.clients)ws.close();await until(()=>!client.online);await until(()=>client.online&&connects===2);
    assert.equal(auths,2);assert.equal(subscribes,2);
  }finally{client.stop();for(const ws of server.clients)ws.terminate();await new Promise<void>(r=>server.close(()=>r()));}
});
