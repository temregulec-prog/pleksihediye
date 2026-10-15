import{test,before,after}from'node:test';import assert from'node:assert/strict';import{spawn,spawnSync}from'node:child_process';import{mkdtempSync,rmSync,cpSync,existsSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{productSlug,seoDescription,normalizePhone,dealerAmount}from'../shared.js';import{parseXml,isPublicAddress}from'../lib/xml.js';
const dir=mkdtempSync(join(tmpdir(),'pleksi-php-test-'));const PHP=process.env.PHP_BIN||'php';const dbName='pleksi_test_'+process.pid+'_'+Date.now();const testEnv={...process.env,PLEKSI_TEST_DATABASE:dbName};let proc;const base='http://127.0.0.1:3021';
function dbCommand(action,payload){const r=spawnSync(PHP,['tests/php-db.php',action],{env:testEnv,input:payload?JSON.stringify(payload):undefined,encoding:'utf8'});if(r.status!==0)throw Error('PHP test database operation failed: '+r.stderr);return r.stdout?JSON.parse(r.stdout):null}
let adminCookie,dealerCookie,otherCookie,dealerId,orderId,imageId;
async function request(path,{cookie,method='GET',body}={}){const r=await fetch(base+'/api.php?route='+encodeURIComponent(path),{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const registration=(phone,firstName='Test',lastName='Bayi')=>({phone,firstName,lastName,city:'İstanbul',district:'Kadıköy',neighborhood:'Caferağa',password:'Test-password-925'});
before(async()=>{if(!existsSync('hosting/app/frontend.html'))throw Error('Run npm run build:hosting first.');dbCommand('create');cpSync('hosting',join(dir,'site'),{recursive:true,filter:p=>!p.endsWith('/config.php')&&!p.endsWith('/install.lock')});proc=spawn(PHP,['-S','127.0.0.1:3021','-t',join(dir,'site'),'scripts/php-router.php'],{env:{...testEnv,PLEKSI_DOCROOT:join(dir,'site')},stdio:'ignore'});let ready;for(let i=0;i<100;i++){try{ready=await fetch(base+'/install.php');if(ready.ok)break}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready?.ok)throw Error('PHP server did not start.');const cookie=ready.headers.get('set-cookie')?.split(';')[0],html=await ready.text(),token=html.match(/name="token" value="([^"]+)"/)?.[1];assert.ok(token,'Installer CSRF token');const form=new URLSearchParams({token,db_host:process.env.PHP_TEST_DB_HOST||'localhost',db_port:process.env.PHP_TEST_DB_PORT||'3306',db_name:dbName,db_user:process.env.PHP_TEST_DB_USER||'root',db_pass:process.env.PHP_TEST_DB_PASS||'',site_url:base,phone:'05321110001',first_name:'Test',last_name:'Yönetici',city:'İstanbul',district:'Kadıköy',neighborhood:'Caferağa',password:'Test-password-925',password_confirm:'Test-password-925',seed:'1'});const installed=await fetch(base+'/install.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie},body:form});assert.ok((await installed.text()).includes('Mağazanız hazır.'),'Browser installer creates MySQL schema and administrator');});
after(()=>{proc?.kill();dbCommand('drop');rmSync(dir,{recursive:true,force:true})});
test('phone registration requires approval; phone formats are unique; WhatsApp uses first admin phone',async()=>{
let r=await request('/auth/login',{method:'POST',body:{phone:'+90 532 111 00 01',password:'Test-password-925'}});assert.equal(r.status,200);adminCookie=r.cookie;assert.equal(r.body.email,undefined);
r=await request('/auth/register',{method:'POST',body:registration('05321110002')});assert.equal(r.status,201);dealerId=r.body.id;
r=await request('/auth/register',{method:'POST',body:registration('+90 532 111 00 02')});assert.equal(r.status,409);
r=await request('/auth/login',{method:'POST',body:{phone:'05321110002',password:'Test-password-925'}});assert.equal(r.status,403);assert.match(r.body.error,/onayı/);
r=await request('/auth/forgot',{method:'POST',body:{phone:'05321110002'}});assert.equal(r.status,404);
r=await request('/admin/dealers/'+dealerId,{cookie:adminCookie,method:'PATCH',body:{status:'approved'}});assert.equal(r.status,200);
r=await request('/auth/login',{method:'POST',body:{phone:'05321110002',password:'Test-password-925'}});assert.equal(r.status,200);dealerCookie=r.cookie;
r=await request('/auth/forgot',{method:'POST',body:{phone:'05321110002'}});assert.equal(r.status,200);assert.ok(r.body.url.startsWith('https://wa.me/905321110001?text='));assert.ok(decodeURIComponent(r.body.url).includes('şifremi unuttum'));
r=await request('/admin/products',{cookie:dealerCookie});assert.equal(r.status,403);
r=await request('/admin/dealers',{cookie:adminCookie});assert.equal(r.body[0].phone,'905321110002');assert.equal(r.body[0].email,undefined);
});
test('temporary password revokes sessions, expires, and blocks all business operations until change',async()=>{
let r=await request('/admin/dealers/'+dealerId+'/reset-password',{cookie:adminCookie,method:'POST'});assert.equal(r.status,200);const temporary=r.body.temporaryPassword;assert.ok(temporary.length>=16);
r=await request('/orders',{cookie:dealerCookie});assert.equal(r.status,401);
r=await request('/auth/login',{method:'POST',body:{phone:'05321110002',password:'Test-password-925'}});assert.equal(r.status,401);
r=await request('/auth/login',{method:'POST',body:{phone:'05321110002',password:temporary}});assert.equal(r.status,200);dealerCookie=r.cookie;assert.equal(r.body.mustChangePassword,true);
r=await request('/products',{cookie:dealerCookie});assert.equal(r.status,403);
r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:1,quantity:1}]}});assert.equal(r.status,403);
r=await request('/auth/change-password',{cookie:dealerCookie,method:'POST',body:{currentPassword:temporary,newPassword:temporary}});assert.equal(r.status,400);
r=await request('/auth/change-password',{cookie:dealerCookie,method:'POST',body:{currentPassword:temporary,newPassword:'New-Password-6727'}});assert.equal(r.status,200);const previous=dealerCookie;dealerCookie=r.cookie;
r=await request('/me',{cookie:previous});assert.equal(r.body,null);r=await request('/me',{cookie:dealerCookie});assert.equal(r.body.mustChangePassword,false);
r=await request('/auth/register',{method:'POST',body:registration('05321110003','Başka','Bayi')});const id=r.body.id;await request('/admin/dealers/'+id,{cookie:adminCookie,method:'PATCH',body:{status:'approved'}});r=await request('/auth/login',{method:'POST',body:{phone:'05321110003',password:'Test-password-925'}});otherCookie=r.cookie;
});
test('percent commission, personalization rules, private images and automatic address/delivery snapshots',async()=>{
let r=await request('/products');assert.equal(r.body[0].dealerPrice,undefined);assert.equal(r.body[0].commissionPercent,undefined);
r=await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{id:1,price:300,commissionPercent:20,requireText:true,requireImage:true}]}});assert.equal(r.status,200);
r=await request('/products',{cookie:dealerCookie});assert.equal(r.body[0].dealerPrice,240);assert.equal(r.body[0].commissionPercent,20);
await request('/admin/settings',{cookie:adminCookie,method:'PUT',body:{deliveryFees:{pickup:10,cargo:80,address:125.5}}});
r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:1,quantity:2}]}});assert.equal(r.status,400);assert.match(r.body.error,/yazı/);
r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:1,quantity:2,personalization:'Elif'}]}});assert.equal(r.status,400);assert.match(r.body.error,/görsel/);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64');let form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'test.png');let upload=await fetch(base+'/api.php?route=/uploads',{method:'POST',headers:{Cookie:dealerCookie},body:form});assert.equal(upload.status,201);imageId=(await upload.json()).id;assert.equal((await fetch(base+'/api.php?route=/uploads/'+imageId)).status,403);
r=await request('/orders',{cookie:otherCookie,method:'POST',body:{items:[{id:1,quantity:1,personalization:'Test',artwork:imageId}]}});assert.equal(r.status,400);
r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{customer:{name:'Tampered',address:'Forged'},deliveryFee:0,items:[{id:1,quantity:2,price:1,commissionPercent:100,personalization:'Elif',color:'Lavanta',artwork:imageId}]}});assert.equal(r.status,201);assert.equal(r.body.total,490);orderId=r.body.id;
r=await request('/orders',{cookie:dealerCookie});assert.equal(r.body[0].customer.name,'Test Bayi');assert.equal(r.body[0].customer.address,'Caferağa / Kadıköy / İstanbul');assert.equal(r.body[0].customer.deliveryMethod,'pickup');assert.equal(r.body[0].items[0].commissionPercent,20);
r=await request('/orders',{cookie:otherCookie});assert.equal(r.body.length,0);
r=await request('/dealer/summary',{cookie:dealerCookie});assert.equal(r.body.pendingProfit,120);
r=await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{id:1,price:400},{id:2,commissionPercent:101}]}});assert.equal(r.status,400);r=await request('/products');assert.equal(r.body[0].price,300);
await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{id:1,price:500,commissionPercent:30}]}});await request('/admin/settings',{cookie:adminCookie,method:'PUT',body:{deliveryFees:{pickup:30,cargo:99,address:200}}});
await request('/admin/orders/'+orderId,{cookie:adminCookie,method:'PATCH',body:{status:'Tamamlandı'}});r=await request('/dealer/summary',{cookie:dealerCookie});assert.equal(r.body.realizedProfit,120);r=await request('/orders',{cookie:dealerCookie});assert.equal(r.body[0].total,490);assert.equal(r.body[0].customer.deliveryFee,10);
await request('/admin/orders/'+orderId,{cookie:adminCookie,method:'PATCH',body:{status:'İptal edildi'}});r=await request('/dealer/summary',{cookie:dealerCookie});assert.equal(r.body.realizedProfit,0);
r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{deliveryMethod:'bogus',items:[{id:2,quantity:1}]}});assert.equal(r.status,400);
r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{deliveryMethod:'cargo',items:[{id:2,quantity:1}]}});assert.equal(r.status,201);assert.equal(r.body.delivery.fee,99);
form=new FormData();form.append('image',new Blob(['<svg></svg>'],{type:'image/png'}),'fake.png');upload=await fetch(base+'/api.php?route=/uploads',{method:'POST',headers:{Cookie:dealerCookie},body:form});assert.equal(upload.status,400);
form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'product.png');upload=await fetch(base+'/api.php?route=/uploads',{method:'POST',headers:{Cookie:adminCookie},body:form});const photo=(await upload.json()).id;
const product={name:'Özel Ürün ŞİĞ Çözümleri',description:'Bir ürün açıklaması',category:'Anahtarlık',price:100,commissionPercent:20,requireText:false,requireImage:false,images:[photo],active:true};
r=await request('/admin/products',{cookie:adminCookie,method:'POST',body:{...product,images:[photo,photo,photo,photo]}});assert.equal(r.status,400);r=await request('/admin/products',{cookie:adminCookie,method:'POST',body:product});assert.equal(r.status,201);assert.equal((await fetch(base+'/api.php?route=/uploads/'+photo)).status,200);
let page=await fetch(base+'/urun/'+productSlug(r.body));assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('application/ld+json'));assert.ok(html.includes('canonical'));assert.ok(html.includes(seoDescription(r.body).replace(/'/g,'&#039;')));assert.ok(html.includes('og:image'));
const csrf=await fetch(base+'/api.php?route=/logout',{method:'POST',headers:{Origin:'https://evil.example',Cookie:dealerCookie}});assert.equal(csrf.status,403);
});
test('XML preview/import is explicit, idempotent, atomic and initially unpublished',async()=>{
const xml='<products><product><id>sku-001</id><name>XML Pleksi Ürün</name><price>300,00</price></product></products>';
let r=await request('/admin/xml/preview',{cookie:dealerCookie,method:'POST',body:{xml}});assert.equal(r.status,403);
r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml,commissionPercent:20}});assert.equal(r.status,200);assert.equal(r.body.products[0].price,300);const token=r.body.token;
r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token}});assert.equal(r.status,200);assert.equal(r.body.imported,1);
r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token}});assert.equal(r.status,400);
r=await request('/admin/products',{cookie:adminCookie});let imported=r.body.filter(p=>p.externalId==='sku-001');assert.equal(imported.length,1);assert.equal(imported[0].active,false);assert.equal(imported[0].dealerPrice,240);
r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml:xml.replace('300,00','400,00'),commissionPercent:20}});await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token:r.body.token}});r=await request('/admin/products',{cookie:adminCookie});imported=r.body.filter(p=>p.externalId==='sku-001');assert.equal(imported.length,1);assert.equal(imported[0].price,400);
r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml:'<!DOCTYPE foo [<!ENTITY a "x">]><products/>'}});assert.equal(r.status,400);
});
test('Turkish SEO, phone normalization, rounding and XML validation/SSRF address classification',()=>{assert.equal(productSlug({id:12,name:'Kişiye Özel Çiçekli İsimlik & Şıklık'}),'kisiye-ozel-cicekli-isimlik-siklik-12');assert.equal(normalizePhone('+90 (532) 111-00-02'),'905321110002');assert.equal(normalizePhone('not-phone'),null);assert.equal(dealerAmount(300,20),240);assert.equal(dealerAmount(99.99,15),84.99);assert.equal(isPublicAddress('127.0.0.1'),false);assert.equal(isPublicAddress('169.254.169.254'),false);assert.equal(isPublicAddress('::ffff:127.0.0.1'),false);assert.equal(isPublicAddress('10.0.0.1'),false);assert.equal(isPublicAddress('8.8.8.8'),true);assert.throws(()=>parseXml('<products><product><id>1</id><name>Ürün</name><price>abc</price></product></products>'));});
test('daily batches, optimistic editing, status permissions, bulk actions and recoverable deletion',async()=>{
let a=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:2,quantity:1,personalization:'Birinci'}]}}),b=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:2,quantity:2,personalization:'İkinci'}]}});assert.equal(a.status,201);assert.equal(a.body.batchId,b.body.batchId);
let other=await request('/orders',{cookie:otherCookie,method:'POST',body:{items:[{id:2,quantity:1}]}});assert.notEqual(other.body.batchId,a.body.batchId);
let list=await request('/orders',{cookie:dealerCookie}),order=list.body.find(o=>o.id===a.body.id);assert.equal(order.status,'İncelemede');assert.match(order.batch_day,/^\d{4}-\d{2}-\d{2}$/);
let r=await request('/orders/'+order.id,{cookie:otherCookie,method:'PATCH',body:{version:order.version,items:order.items}});assert.equal(r.status,404);
r=await request('/orders/'+order.id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:order.items.map(i=>({...i,quantity:3,personalization:'Yeni isim',color:'Krem',price:1})),customer:{name:'Değiştirilemez'}}});assert.equal(r.status,200);assert.equal(r.body.items[0].personalization,'Yeni isim');assert.equal(r.body.items[0].price,order.items[0].price);assert.equal(r.body.customer.name,'Test Bayi');assert.equal(r.body.version,order.version+1);
r=await request('/orders/'+order.id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:order.items}});assert.equal(r.status,409);
await request('/admin/orders/'+order.id,{cookie:adminCookie,method:'PATCH',body:{status:'Hazırlanıyor'}});
list=await request('/orders',{cookie:dealerCookie});order=list.body.find(o=>o.id===a.body.id);r=await request('/orders/'+order.id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:order.items}});assert.equal(r.status,403);
r=await request('/orders/'+order.id,{cookie:adminCookie,method:'PATCH',body:{version:order.version,items:order.items.map(i=>({...i,personalization:'Yönetici düzeltmesi'})),customer:order.customer}});assert.equal(r.status,200);
r=await request('/admin/orders/bulk',{cookie:adminCookie,method:'POST',body:{ids:[a.body.id,b.body.id],action:'status',status:'Tamamlandı'}});assert.equal(r.status,200);assert.equal(r.body.updated,2);
r=await request('/admin/batches/'+a.body.batchId,{cookie:adminCookie,method:'POST',body:{action:'status',status:'Hazırlanıyor'}});assert.equal(r.status,200);list=await request('/orders',{cookie:dealerCookie});assert.ok(list.body.every(o=>o.status==='Hazırlanıyor'));
r=await request('/admin/orders/bulk',{cookie:dealerCookie,method:'POST',body:{ids:[a.body.id],action:'delete'}});assert.equal(r.status,403);
r=await request('/admin/orders/bulk',{cookie:adminCookie,method:'POST',body:{ids:[a.body.id],action:'delete'}});assert.equal(r.status,200);list=await request('/orders',{cookie:dealerCookie});assert.ok(!list.body.some(o=>o.id===a.body.id));r=await request('/orders?deleted=1',{cookie:dealerCookie});assert.equal(r.status,403);
r=await request('/admin/batches/'+a.body.batchId,{cookie:adminCookie,method:'POST',body:{action:'delete'}});assert.equal(r.status,200);list=await request('/orders',{cookie:dealerCookie});assert.equal(list.body.length,0);
let archived=await request('/orders?deleted=1',{cookie:adminCookie});const ids=archived.body.filter(o=>o.user_id===dealerId).map(o=>o.id);assert.ok(ids.includes(a.body.id));r=await request('/admin/orders/bulk',{cookie:adminCookie,method:'POST',body:{ids,action:'restore'}});assert.equal(r.status,200);list=await request('/orders',{cookie:dealerCookie});assert.ok(list.body.some(o=>o.id===a.body.id));
});
test('persisted notifications include new memberships and orders; read actions and access controls',async()=>{
let r=await request('/admin/notifications',{cookie:otherCookie});assert.equal(r.status,403);
r=await request('/admin/notifications',{cookie:adminCookie});assert.ok(r.body.unread>0);assert.ok(r.body.items.some(n=>n.type==='member'&&n.member_id===dealerId));assert.ok(r.body.items.some(n=>n.type==='order'));const item=r.body.items[0];await request('/admin/notifications/'+item.id+'/read',{cookie:adminCookie,method:'POST'});let next=await request('/admin/notifications',{cookie:adminCookie});assert.equal(next.body.unread,r.body.unread-1);assert.ok(next.body.items.find(n=>n.id===item.id).read_at);
await request('/admin/notifications/read-all',{cookie:adminCookie,method:'POST'});next=await request('/admin/notifications',{cookie:adminCookie});assert.equal(next.body.unread,0);
});
test('temporary-password expiry and membership deactivation invalidate access',async()=>{
let r=await request('/admin/dealers',{cookie:adminCookie});const member=r.body.find(u=>u.phone==='905321110003');r=await request('/admin/dealers/'+member.id+'/reset-password',{cookie:adminCookie,method:'POST'});assert.equal(r.status,200);const temp=r.body.temporaryPassword;dbCommand('query',{sql:'UPDATE ph_users SET password_expires=? WHERE id=?',params:[Date.now()-1000,member.id]});r=await request('/auth/login',{method:'POST',body:{phone:member.phone,password:temp}});assert.equal(r.status,403);assert.match(r.body.error,/süresi/);r=await request('/orders',{cookie:otherCookie});assert.equal(r.status,401);
});

test('PHP accepts relative API routes and keeps legacy routes compatible',async()=>{
 for(const route of ['products','/products','orders','/orders','orders?deleted=1','/orders?deleted=1']){
 const r=await request(route,{cookie:adminCookie});assert.equal(r.status,200,route);assert.ok(Array.isArray(r.body),route);
 }
});

test('administrator personal orders exclude workshop orders while management retains all',async()=>{
 const products=await request('/products',{cookie:adminCookie});const product=products.body.find(p=>!p.requireImage);assert.ok(product);
 const payload={items:[{id:product.id,quantity:1,personalization:'Kişisel sipariş',color:'Krem'}],deliveryMethod:'pickup'};
 let r=await request('/orders',{cookie:adminCookie,method:'POST',body:payload});assert.equal(r.status,201);const ownId=r.body.id;
 r=await request('/orders?mine=1',{cookie:adminCookie});assert.equal(r.status,200);assert.ok(r.body.some(o=>o.id===ownId));assert.ok(r.body.every(o=>o.user_id===r.body.find(o=>o.id===ownId).user_id));
 const ownIds=r.body.map(o=>o.id);
 r=await request('/orders',{cookie:adminCookie});assert.equal(r.status,200);assert.ok(r.body.some(o=>!ownIds.includes(o.id)),'Management still sees other dealers');
 r=await request('/orders?mine=1&user_id='+dealerId,{cookie:adminCookie});assert.deepEqual(r.body.map(o=>o.id),ownIds,'User ID cannot change personal scope');
});
