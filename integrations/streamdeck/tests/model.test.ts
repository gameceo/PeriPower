import { test } from 'node:test';
import assert from 'node:assert/strict';
import { display, svg, parseDevices, type Device } from '../src/model.js';
const device: Device = { id:'mouse',displayName:'Mouse',percentage:0,level:'empty',charging:false,connected:true,stale:false,lastSeen:1 };
test('zero is a real reading; unknown and discrete levels remain distinct',()=>{
  assert.equal(display(device,'percentage',true).value,'0%');
  assert.equal(display({...device,percentage:null,level:'medium'},'percentage',true).value,'中');
  assert.equal(display({...device,percentage:null,level:'unknown'},'percentage',true).value,'未知');
});
test('channel charging, cached data and backend disconnect are independent',()=>{
  assert.equal(display({...device,leftPercent:54,leftCharging:true},'leftPercent',true).value,'54% · 充电');
  assert.equal(display({...device,stale:true},'percentage',true).value,'0% · 缓存');
  assert.equal(display(device,'percentage',false).value,'服务断开');
});
test('malformed values and duplicate physical IDs are rejected',()=>{
  assert.throws(()=>parseDevices({devices:[{...device,percentage:101}]}));
  assert.throws(()=>parseDevices({devices:[device,device]}));
  assert.deepEqual(parseDevices({devices:[device]}),[device]);
});
test('device text is escaped before embedding in SVG',()=>{
  const image=svg(display({...device,displayName:'<script>&'},'percentage',true));
  assert.ok(!image.includes('<script>'));assert.ok(image.includes('&lt;script&gt;&amp;'));
});
