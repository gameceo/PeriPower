import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

test('built SDK plugin registers and renders independent mouse/headset keys', async () => {
  const rpc = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  const deck = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await Promise.all([once(rpc, 'listening'), once(deck, 'listening')]);
  const rpcAddress=rpc.address(), deckAddress=deck.address();
  assert.ok(rpcAddress&&typeof rpcAddress==='object'); assert.ok(deckAddress&&typeof deckAddress==='object');
  const settings: Record<string, object> = { mouse: { deviceId:'mouse' }, headset:{ deviceId:'headset' } };
  const devices = [
    {id:'mouse',displayName:'DeathAdder V4 Pro',percentage:56,level:'medium',charging:false,connected:true,stale:false,lastSeen:1},
    {id:'headset',displayName:'PRO X 2',percentage:32,level:'low',charging:false,connected:true,stale:false,lastSeen:1}
  ];
  rpc.on('connection',ws=>ws.on('message',data=>{
    const m=JSON.parse(data.toString());
    ws.send(JSON.stringify({jsonrpc:'2.0',id:m.id,result:m.method==='system.getInfo'?{apiVersion:'1.0'}:m.method==='devices.list'?{devices}:{}}));
    if(m.method==='devices.subscribe')ws.send(JSON.stringify({jsonrpc:'2.0',method:'devices.updated',params:{devices}}));
  }));
  const images = new Map<string,string>(); let registered=false;
  deck.on('connection',ws=>ws.on('message',data=>{
    const m=JSON.parse(data.toString());
    if(m.event==='registerPlugin'){
      registered=true;
      for(const context of ['mouse','headset'])ws.send(JSON.stringify({event:'willAppear',action:'com.gameceo.peripower.battery',context,device:'deck',payload:{controller:'Keypad',coordinates:{column:context==='mouse'?0:1,row:0},settings:settings[context],state:0,isInMultiAction:false}}));
    }
    if(m.event==='getGlobalSettings')ws.send(JSON.stringify({event:'didReceiveGlobalSettings',id:m.id,payload:{settings:{port:rpcAddress.port}}}));
    if(m.event==='getSettings')ws.send(JSON.stringify({event:'didReceiveSettings',action:'com.gameceo.peripower.battery',id:m.id,context:m.context,payload:{settings:settings[m.context]}}));
    if(m.event==='setImage')images.set(m.context,decodeURIComponent(m.payload.image.split(',').slice(1).join(',')));
  }));
  const cwd=fileURLToPath(new URL('../com.gameceo.peripower.sdPlugin/',import.meta.url));
  const child=spawn(process.execPath,['bin/plugin.js','-port',String(deckAddress.port),'-pluginUUID','test-plugin','-registerEvent','registerPlugin','-info',JSON.stringify({application:{version:'7.6.0',language:'en',platform:'windows',platformVersion:'10'},plugin:{uuid:'com.gameceo.peripower',version:'0.1.0.0'},devices:[{id:'deck',name:'Test Deck',type:0,size:{columns:5,rows:3}}]})],{cwd,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let errors='';child.stderr.on('data',b=>{errors+=b;});
  try{
    const deadline=Date.now()+8000;
    while(!images.get('mouse')?.includes('56%')||!images.get('headset')?.includes('32%')){
      if(child.exitCode!==null||Date.now()>deadline)throw new Error(`SDK render failed: ${errors}; images=${JSON.stringify([...images])}`);
      await new Promise(r=>setTimeout(r,20));
    }
    assert.ok(registered);
    assert.ok(!images.get('mouse')!.includes('32%'));
    assert.ok(!images.get('headset')!.includes('56%'));
  } finally {
    child.kill(); await once(child,'exit');
    for(const server of [rpc,deck]){for(const ws of server.clients)ws.terminate();await new Promise<void>(r=>server.close(()=>r()));}
  }
});
