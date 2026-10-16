import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window={PLEKSI_CONFIG:{backend:'php',basePath:'/yeni'}};
const {requestApi}=await import('../src/api.js');

test('read recovers from one network failure and uses installation subfolder',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async (url,options)=>{assert.equal(options.cache,'no-store');assert.equal(options.headers['Content-Type'],undefined);assert.equal(options.headers.Accept,'application/json');assert.equal(url,'/yeni/api.php?route=products');if(++calls===1)throw new TypeError('NetworkError');return Response.json([{id:1}])});
 assert.deepEqual(await requestApi('/products'),[{id:1}]);assert.equal(calls,2);
});
test('failed writes are never replayed',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new TypeError('NetworkError')});
 await assert.rejects(requestApi('/orders',{method:'POST',body:{items:[]}}),/Sunucuya ulaşılamadı/);assert.equal(calls,1);
});
test('persistent read failure is bounded',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new TypeError('NetworkError')});
 await assert.rejects(requestApi('/me'),/Sunucuya ulaşılamadı/);assert.equal(calls,2);
});
test('server errors are preserved and not retried',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'Lütfen giriş yapın.'},{status:401})});
 await assert.rejects(requestApi('/orders'),/Lütfen giriş yapın/);assert.equal(calls,1);
});
test('non JSON hosting response gives a readable error',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>Hosting error</html>',{status:503}));
 await assert.rejects(requestApi('/me'),/HTTP 503/);
});

test('empty hosting 409 response preserves duplicate registration meaning',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(' ',{status:409})});
 await assert.rejects(requestApi('/auth/register',{method:'POST',body:{}}),/zaten bir üyelik veya başvuru var/);assert.equal(calls,1);
});

test('XML operations can use a longer timeout without forwarding internal timeout options',async t=>{
 const original=setTimeout;t.mock.method(globalThis,'setTimeout',(fn,delay)=>{assert.equal(delay,90000);return original(fn,delay)});
 t.mock.method(globalThis,'fetch',async(_url,options)=>{assert.equal(options.timeoutMs,undefined);return Response.json({products:[]})});
 assert.deepEqual(await requestApi('/admin/xml/preview',{method:'POST',timeoutMs:90000,body:{xml:'<products/>'}}),{products:[]});
});

test('transient hosting redirect is retried once for reads',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>++calls===1?new Response('',{status:303}):Response.json([{id:9}]));
 assert.deepEqual(await requestApi('/products'),[{id:9}]);assert.equal(calls,2);
});
test('HTML challenge with success status recovers without treating it as an empty catalog',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>++calls===1?new Response('<html>Wait</html>'):Response.json([{id:8}]));
 assert.deepEqual(await requestApi('/products'),[{id:8}]);assert.equal(calls,2);
});
test('hosting HTML failure remains explicit after the bounded retry',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('<html>Wait</html>')});
 await assert.rejects(requestApi('/products'),/geçerli yanıt/);assert.equal(calls,2);
});
test('even temporary HTTP failures never replay writes',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:503})});
 await assert.rejects(requestApi('/orders',{method:'POST',body:{items:[]}}),/HTTP 503/);assert.equal(calls,1);
});
