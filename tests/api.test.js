import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window={PLEKSI_CONFIG:{backend:'php',basePath:'/yeni'}};
const {requestApi}=await import('../src/api.js');

test('read recovers from one network failure and uses installation subfolder',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(url,'/yeni/api.php?route=%2Fproducts');if(++calls===1)throw new TypeError('NetworkError');return Response.json([{id:1}])});
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
 await assert.rejects(requestApi('/me'),/geçerli yanıt alınamadı/);
});
