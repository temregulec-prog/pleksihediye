import{test,before,after}from'node:test';import assert from'node:assert/strict';import{spawn,spawnSync}from'node:child_process';import{mkdtempSync,rmSync,cpSync,existsSync,mkdirSync,writeFileSync,symlinkSync,readFileSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{productSlug,seoDescription,normalizePhone,dealerAmount}from'../shared.js';import{parseXml,isPublicAddress}from'../lib/xml.js';
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

test('logo settings publish only the administrator selected image and preserve original bytes',async()=>{
 let r=await request('/admin/settings',{cookie:adminCookie,method:'PUT',body:{logoId:imageId}});assert.equal(r.status,400,'Cannot expose a dealer private upload as logo');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64');const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'logo.png');const upload=await fetch(base+'/api.php?route=uploads',{method:'POST',headers:{Cookie:adminCookie},body:form});assert.equal(upload.status,201);const id=(await upload.json()).id;
 assert.equal((await fetch(base+'/api.php?route=uploads/'+id)).status,403);
 r=await request('/admin/settings',{cookie:adminCookie,method:'PUT',body:{logoId:id}});assert.equal(r.status,200);
 r=await request('/admin/settings',{cookie:adminCookie});assert.equal(r.body.logoId,id);
 const image=await fetch(base+'/api.php?route=uploads/'+id);assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 const html=await(await fetch(base+'/')).text();assert.ok(html.includes('"logoId":"'+id+'"'));
 r=await request('/admin/settings',{cookie:adminCookie,method:'PUT',body:{logoId:null}});assert.equal(r.status,200);assert.equal((await fetch(base+'/api.php?route=uploads/'+id)).status,403);
});

test('homepage content is admin-only, persists, validates, and safely publishes selected cover images',async()=>{
 let r=await request('/admin/homepage',{cookie:adminCookie});assert.equal(r.status,200);const original=r.body;assert.equal(original.heroLine1,'Küçük detaylar,');
 assert.equal((await request('/admin/homepage')).status,401);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64');const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'cover.png');const upload=await fetch(base+'/api.php?route=uploads',{method:'POST',headers:{Cookie:adminCookie},body:form});const id=(await upload.json()).id;
 const changed={...original,heroLine1:'Yeni ana başlık <script>test</script>',heroDescription:'Yeni açıklama\nİkinci satır',showDealer:false,heroImageId:id};
 r=await request('/admin/homepage',{cookie:adminCookie,method:'PUT',body:{...changed,heroImageId:imageId}});assert.equal(r.status,400,'Cannot publish dealer private artwork');
 r=await request('/admin/homepage',{cookie:adminCookie,method:'PUT',body:{...changed,heroLine1:'x'.repeat(1000)}});assert.equal(r.status,400);
 r=await request('/admin/homepage',{cookie:adminCookie,method:'PUT',body:changed});assert.equal(r.status,200);assert.deepEqual(r.body,changed);
 const html=await(await fetch(base+'/')).text();const config=JSON.parse(html.match(/window.PLEKSI_CONFIG=(.*?);<\/script>/s)[1]);assert.equal(config.homepage.heroLine1,changed.heroLine1);assert.ok(!html.includes('<script>test</script>'));
 assert.equal((await fetch(base+'/api.php?route=uploads/'+id)).status,200);
 await request('/admin/homepage',{cookie:adminCookie,method:'PUT',body:original});assert.equal((await fetch(base+'/api.php?route=uploads/'+id)).status,403);
});

test('single and selected product deletion is permanent, atomic, and preserves historical order editing',async()=>{
 const before=(await request('/orders',{cookie:adminCookie})).body;const order=before.find(o=>o.status==='İncelemede');assert.ok(order);const id=order.items[0].id;
 let r=await request('/admin/products/'+id,{method:'DELETE'});assert.equal(r.status,401);
 r=await request('/admin/products/'+id,{cookie:adminCookie,method:'DELETE'});assert.equal(r.status,200);assert.equal(r.body.deleted,1);
 assert.ok(!(await request('/products')).body.some(p=>p.id===id));
 const kept=(await request('/orders',{cookie:adminCookie})).body.find(o=>o.id===order.id);assert.deepEqual(kept.items,order.items);assert.equal(kept.total,order.total);
 r=await request('/orders/'+order.id,{cookie:adminCookie,method:'PATCH',body:{version:kept.version,items:kept.items.map((i,n)=>n===0?{...i,personalization:'Katalog silindikten sonra değişti'}:i),deliveryMethod:kept.customer.deliveryMethod}});assert.equal(r.status,200);assert.equal(r.body.items[0].price,kept.items[0].price);
 r=await request('/orders',{cookie:adminCookie,method:'POST',body:{items:[{id,quantity:1}],deliveryMethod:'pickup'}});assert.equal(r.status,400,'Deleted product cannot be newly ordered');
 const ids=(await request('/admin/products',{cookie:adminCookie})).body.slice(0,2).map(p=>p.id);assert.equal(ids.length,2);
 r=await request('/admin/products/bulk',{cookie:adminCookie,method:'DELETE',body:{ids:[ids[0],999999999]}});assert.ok(r.status>=400);assert.ok((await request('/admin/products',{cookie:adminCookie})).body.some(p=>p.id===ids[0]));
 r=await request('/admin/products/bulk',{cookie:adminCookie,method:'DELETE',body:{ids}});assert.equal(r.status,200);assert.equal(r.body.deleted,2);assert.ok(!(await request('/admin/products',{cookie:adminCookie})).body.some(p=>ids.includes(p.id)));
});

test('XML automatic matching handles supplier field names and saved source mappings can be edited',async()=>{
 const xml='<Catalog><Product><SKU>DG-123</SKU><Title>Özel Pleksi</Title><RetailPrice>1.250,50</RetailPrice><Details><![CDATA[Özel tasarım]]></Details><Images><Image>https://example.com/a.png</Image></Images></Product></Catalog>';
 let r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml,autoDetect:true,commissionPercent:20}});assert.equal(r.status,200);assert.equal(r.body.products[0].price,1250.5);assert.equal(r.body.products[0].name,'Özel Pleksi');assert.equal(r.body.mapping.itemPath,'Catalog.Product');assert.equal(r.body.mapping.image,'Images.Image');
 r=await request('/admin/xml/sources',{cookie:adminCookie,method:'POST',body:{name:'Örnek kaynak',url:'https://example.com/catalog.xml',commissionPercent:20}});assert.equal(r.status,201);const id=r.body.id;
 r=await request('/admin/xml/sources/'+id,{cookie:adminCookie,method:'PUT',body:{name:'Düzenlenen kaynak',url:'https://example.com/new.xml',commissionPercent:15,mapping:{itemPath:'Catalog.Product',id:'SKU',name:'Title',price:'RetailPrice'}}});assert.equal(r.status,200);const source=(await request('/admin/xml/sources',{cookie:adminCookie})).body.find(s=>s.id===id);assert.equal(source.mapping.name,'Title');assert.equal(source.commission,15);
});

test('HTTP supplier sources are accepted and browser-copied Turkish XML previews correctly',async()=>{
 let r=await request('/admin/xml/sources',{cookie:adminCookie,method:'POST',body:{name:'HTTP tedarikçi',url:'http://supplier.example/feed.xml',commissionPercent:20}});assert.equal(r.status,201);const id=r.body.id;
 r=await request('/admin/xml/sources');assert.equal(r.status,401);
 r=await request('/admin/xml/sources',{cookie:adminCookie});assert.equal(r.body.find(s=>s.id===id).url,'http://supplier.example/feed.xml');
 const xml='This XML file does not appear to have any style information associated with it. The document tree is shown below.\n<urunler><urun><id>HTTP-001</id><urun_adi>İsim & Pleksi</urun_adi><aciklama><![CDATA[A & B]]></aciklama><fiyat>19.90</fiyat><gorsel>http://supplier.example/a.png</gorsel></urun></urunler>';
 r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml,autoDetect:true,commissionPercent:20}});assert.equal(r.status,200);assert.equal(r.body.products[0].name,'İsim & Pleksi');assert.equal(r.body.products[0].price,19.9);assert.equal(r.body.mapping.name,'urun_adi');
});

test('failed XML image reports its product and retains preview for a successful image-free retry',async()=>{
 const xml='<products><product><id>retry-image-1</id><name>Görseli alınamayan test ürünü</name><price>300</price><image>http://127.0.0.1/private.png</image></product></products>';
 let r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml}});const token=r.body.token;
 r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token}});assert.equal(r.status,200);assert.equal(r.body.ok,false);assert.equal(r.body.stage,'images');assert.match(r.body.error,/retry-image-1.*Görsel alınamadı/);assert.equal(r.body.retryable,true);assert.equal(r.body.imported,0);
 assert.ok(!(await request('/admin/products',{cookie:adminCookie})).body.some(p=>p.externalId==='retry-image-1'));
 r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token,importImages:false}});assert.equal(r.body.ok,true);assert.equal(r.body.imported,1);assert.equal(r.body.imagesSkipped,true);
 r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token,importImages:false}});assert.equal(r.status,400,'Successful preview cannot be replayed');
});

test('XML image skipping is explicit and reports warnings without hiding product data',async()=>{
 const xml='<products><product><id>skip-image-1</id><name>Görsel uyarılı test ürünü</name><price>300</price><image>http://127.0.0.1/private.png</image></product><product><id>skip-image-2</id><name>İkinci test ürünü</name><price>450</price></product></products>';
 let r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml}});r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token:r.body.token,skipFailedImages:true}});assert.equal(r.body.ok,true);assert.equal(r.body.imported,2);assert.equal(r.body.warnings.length,1);assert.match(r.body.warnings[0],/skip-image-1/);
 const products=(await request('/admin/products',{cookie:adminCookie})).body.filter(p=>p.externalId?.startsWith('skip-image-'));assert.equal(products.length,2);assert.ok(products.every(p=>p.active===false));
});

test('all 97 Turkish XML product records can be imported without image networking',async()=>{
 const xml='<urunler>'+Array.from({length:97},(_,n)=>'<urun><id>batch-'+n+'</id><urun_adi>Toplu ürün '+n+'</urun_adi><fiyat>19.90</fiyat><gorsel>https://supplier.example/image.png</gorsel></urun>').join('')+'</urunler>';
 let r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml,autoDetect:true}});assert.equal(r.body.products.length,97);r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token:r.body.token,importImages:false}});assert.equal(r.body.ok,true);assert.equal(r.body.imported,97);
 const products=(await request('/admin/products',{cookie:adminCookie})).body.filter(p=>p.externalId?.startsWith('batch-'));assert.equal(products.length,97);assert.ok(products.every(p=>p.images.length===0&&p.price===19.9&&p.active===false));
});

test('categories support admin creation, automatic XML discovery and safe deletion',async()=>{
 let r=await request('/admin/categories',{method:'POST',body:{name:'Yetkisiz'}});assert.equal(r.status,401);
 r=await request('/admin/categories',{cookie:adminCookie,method:'POST',body:{name:'Yeni Özel Kategori'}});assert.equal(r.status,200);
 assert.ok((await request('/categories')).body.includes('Yeni Özel Kategori'));
 r=await request('/admin/categories',{cookie:adminCookie,method:'POST',body:{name:'Yeni Özel Kategori'}});assert.equal(r.status,409);
 const xml='<products><product><id>category-xml-test</id><name>Kategori test ürünü</name><price>200</price><category>XML Kategorisi</category></product></products>';
 r=await request('/admin/xml/preview',{cookie:adminCookie,method:'POST',body:{xml}});r=await request('/admin/xml/import',{cookie:adminCookie,method:'POST',body:{token:r.body.token,importImages:false}});assert.equal(r.body.ok,true);
 assert.ok((await request('/admin/categories',{cookie:adminCookie})).body.includes('XML Kategorisi'));
 assert.ok(!(await request('/categories')).body.includes('XML Kategorisi'),'Unpublished supplier products do not expose categories');
 let p=(await request('/admin/products',{cookie:adminCookie})).body.find(p=>p.externalId==='category-xml-test');
 r=await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{...p,active:true}]}});assert.equal(r.status,200);
 assert.ok((await request('/categories')).body.includes('XML Kategorisi'));
 r=await request('/admin/categories',{cookie:adminCookie,method:'DELETE',body:{name:'XML Kategorisi'}});assert.equal(r.status,200);
 p=(await request('/admin/products',{cookie:adminCookie})).body.find(x=>x.id===p.id);assert.equal(p.category,'Genel');assert.equal(p.price,200);assert.equal(p.active,true);
 assert.ok(!(await request('/categories')).body.includes('XML Kategorisi'));
 r=await request('/admin/categories',{cookie:adminCookie,method:'DELETE',body:{name:'Yeni Özel Kategori'}});assert.equal(r.status,200);assert.ok(!(await request('/categories')).body.includes('Yeni Özel Kategori'));
 r=await request('/admin/categories',{cookie:adminCookie,method:'DELETE',body:{name:'Genel'}});assert.equal(r.status,400);
});

test('spreadsheet import is admin-only, idempotent, hidden from home and preserves publication on retry',async()=>{
 const form=new FormData();form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'excel.png');const upload=await fetch(base+'/api.php?route=/uploads',{method:'POST',headers:{Cookie:adminCookie},body:form});assert.equal(upload.status,201);const adminImage=(await upload.json()).id;
 const product={name:'Excel aktarım test ürünü',description:'',category:'Excel Kategori',price:19.9,commissionPercent:20,requireText:true,requireImage:true,images:[adminImage],showOnHome:false,importIdentity:'https://supplier.example/product/123'};
 let r=await request('/admin/products/spreadsheet',{cookie:dealerCookie,method:'POST',body:{products:[product]}});assert.equal(r.status,403);
 r=await request('/admin/products/spreadsheet',{cookie:adminCookie,method:'POST',body:{products:[product]}});assert.equal(r.status,200);assert.equal(r.body.imported,1);
 let ps=(await request('/admin/products',{cookie:adminCookie})).body;let p=ps.find(p=>p.name===product.name);assert.ok(p);assert.equal(p.active,false);assert.equal(p.showOnHome,false);assert.equal(p.price,19.9);assert.equal(p.dealerPrice,15.92);
 r=await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{id:p.id,active:true}]}});assert.equal(r.status,200);
 r=await request('/admin/products/spreadsheet',{cookie:adminCookie,method:'POST',body:{products:[{...product,price:29.9}]}});assert.equal(r.status,200);
 ps=(await request('/admin/products',{cookie:adminCookie})).body;assert.equal(ps.filter(x=>x.name===product.name).length,1);p=ps.find(x=>x.id===p.id);assert.equal(p.active,true);assert.equal(p.price,29.9);assert.equal(p.showOnHome,false);
 const before=ps.length;r=await request('/admin/products/spreadsheet',{cookie:adminCookie,method:'POST',body:{products:[{...product,importIdentity:'new-valid'},{...product,importIdentity:'invalid',price:-1}]}});assert.equal(r.status,400);assert.equal((await request('/admin/products',{cookie:adminCookie})).body.length,before,'Invalid group must not partially insert');
 r=await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{id:p.id,showOnHome:true}]}});assert.equal(r.status,200);assert.equal((await request('/products')).body.find(x=>x.id===p.id).showOnHome,true);
});

test('hosted images are checked locally and spreadsheet import needs no ZIP or upload',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64');
 const root=join(dir,'site');mkdirSync(join(root,'gorseller','uzun-acacak'),{recursive:true});writeFileSync(join(root,'gorseller','uzun-acacak','urun_00001.png'),png);writeFileSync(join(dir,'outside.png'),png);symlinkSync(join(dir,'outside.png'),join(root,'gorseller','outside.png'));
 let r=await request('/admin/products/local-images',{cookie:adminCookie,method:'POST',body:{paths:['/gorseller/uzun-acacak/urun_00001.png','/gorseller/missing.jpg','/../outside.png','/gorseller/outside.png','https://example.com/a.jpg','/app/config.php']}});assert.equal(r.status,200);assert.equal(r.body.results[0].ok,true);assert.ok(r.body.results.slice(1).every(x=>!x.ok));
 r=await request('/admin/products/local-images',{cookie:dealerCookie,method:'POST',body:{paths:['/gorseller/uzun-acacak/urun_00001.png']}});assert.equal(r.status,403);
 const p={name:'Hosttaki görselli ürün',description:'',category:'Host Kategori',price:19.9,commissionPercent:20,requireText:false,requireImage:false,images:[],localImagePath:'/gorseller/uzun-acacak/urun_00001.png',showOnHome:false,importIdentity:'host-test-1'};
 for(let i=0;i<2;i++){r=await request('/admin/products/spreadsheet',{cookie:adminCookie,method:'POST',body:{products:[p]}});assert.equal(r.status,200);assert.equal(r.body.imported,1)}
 const products=(await request('/admin/products',{cookie:adminCookie})).body.filter(x=>x.name===p.name);assert.equal(products.length,1);assert.equal(products[0].images.length,1);assert.equal(products[0].showOnHome,false);
 const image=await fetch(base+'/api.php?route=/uploads/'+products[0].images[0],{headers:{Cookie:adminCookie}});assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 r=await request('/admin/products/spreadsheet',{cookie:adminCookie,method:'POST',body:{products:[{...p,importIdentity:'host-missing',localImagePath:'/gorseller/missing.jpg'}]}});assert.equal(r.status,400);assert.equal((await request('/admin/products',{cookie:adminCookie})).body.filter(x=>x.name===p.name).length,1);
});

test('product-specific options are validated, saved in orders and required only when configured',async()=>{
 const baseProduct={name:'Seçeneksiz standart ürün',description:'',category:'Seçenek Testi',price:300,commissionPercent:20,images:[],requireText:false,requireImage:false,active:true};
 let r=await request('/admin/products',{cookie:adminCookie,method:'POST',body:baseProduct});assert.equal(r.status,201);const plain=r.body;
 r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:plain.id,quantity:1}]}});assert.equal(r.status,201,'Optional text and artwork must not block checkout');
 const options=[{name:'Renk',values:['Gold','Gümüş']},{name:'Boyut',values:['Küçük','Büyük']}];
 r=await request('/admin/products',{cookie:adminCookie,method:'POST',body:{...baseProduct,name:'Araç süsü seçenekli',options}});assert.equal(r.status,201);const p=r.body;assert.deepEqual(p.options,options);
 for(const optionSelections of [{},{Renk:'Gold'},{Renk:'Pudra pembe',Boyut:'Küçük'},{Renk:'Gold',Boyut:'Küçük',Ekstra:'Yok'}]){r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:p.id,quantity:1,optionSelections}]}});assert.equal(r.status,400)}
 r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:p.id,quantity:1,optionSelections:{Renk:'Gold',Boyut:'Küçük'}}]}});assert.equal(r.status,201);const id=r.body.id;
 let order=(await request('/orders',{cookie:dealerCookie})).body.find(o=>o.id===id);assert.deepEqual(order.items[0].optionSelections,{Renk:'Gold',Boyut:'Küçük'});assert.deepEqual(order.items[0].optionDefinitions,options);
 r=await request('/orders/'+id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:[{...order.items[0],optionSelections:{Renk:'Geçersiz',Boyut:'Büyük'}}]}});assert.equal(r.status,400);
 r=await request('/orders/'+id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:[{...order.items[0],optionSelections:{Renk:'Gümüş',Boyut:'Büyük'}}]}});assert.equal(r.status,200);assert.equal(r.body.items[0].optionSelections.Renk,'Gümüş');assert.equal(r.body.items[0].price,240);
 r=await request('/admin/products/'+p.id,{cookie:adminCookie,method:'DELETE'});assert.equal(r.status,200);
 order=(await request('/orders',{cookie:dealerCookie})).body.find(o=>o.id===id);r=await request('/orders/'+id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:[{...order.items[0],personalization:'Silinen ürün düzenleme'}]}});assert.equal(r.status,200);assert.equal(r.body.items[0].optionSelections.Renk,'Gümüş');
 r=await request('/admin/products',{cookie:adminCookie,method:'POST',body:{...baseProduct,requireText:true,requireImage:true}});assert.equal(r.status,201);const required=r.body;
 for(const item of [{id:required.id,quantity:1},{id:required.id,quantity:1,personalization:'İsim'}]){r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[item]}});assert.equal(r.status,400)}
 r=await request('/orders',{cookie:dealerCookie,method:'POST',body:{items:[{id:required.id,quantity:1,personalization:'İsim',artwork:imageId}]}});assert.equal(r.status,201);
 order=(await request('/orders',{cookie:dealerCookie})).body.find(o=>o.id===r.body.id);r=await request('/orders/'+order.id,{cookie:dealerCookie,method:'PATCH',body:{version:order.version,items:[{...order.items[0],artwork:null}]}});assert.equal(r.status,400,'Required image cannot be removed during editing');
 for(const invalid of [[{name:'Renk',values:[]}],[{name:'Renk',values:['Gold','Gold']}],[{name:'Renk',values:['Gold']},{name:'Renk',values:['Gümüş']}]]){r=await request('/admin/products',{cookie:adminCookie,method:'POST',body:{...baseProduct,options:invalid}});assert.equal(r.status,400)}
});


test('HTTP page includes a private, correctly priced storefront without extra API calls',async()=>{
 const configPath=join(dir,'site/app/config.php'),original=readFileSync(configPath,'utf8');
 try{
  writeFileSync(configPath,original.replace(/'secure_cookie' => false/,"'secure_cookie' => true").replace(base,base.replace('http:','https:')));
  const snapshot=async cookie=>{const r=await fetch(base+'/',{headers:cookie?{Cookie:cookie}:{}});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private.*no-store/);assert.match(r.headers.get('vary'),/Cookie/);const html=await r.text();const match=html.match(/window\.PLEKSI_CONFIG=(.*?);<\/script>/);assert.ok(match);return JSON.parse(match[1]).storefront};
  const anonymous=await snapshot();assert.equal(anonymous.user,null);assert.ok(anonymous.products.length>0);assert.ok(anonymous.products.every(p=>p.active!==false&&p.dealerPrice===undefined&&p.commissionPercent===undefined));assert.ok(anonymous.categories.length>0);assert.equal(anonymous.deliveryOptions[0].id,'pickup');
  const dealer=await snapshot(adminCookie);assert.equal(dealer.user.role,'admin');assert.ok(dealer.products.every(p=>typeof p.dealerPrice==='number'));assert.equal(dealer.user.password,undefined);
  const login=await fetch(base+'/api.php?route=/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'05321110001',password:'Test-password-925'})});assert.equal(login.status,200);assert.doesNotMatch(login.headers.get('set-cookie'),/;\s*secure/i);const cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await request('/me',{cookie})).body.role,'admin');
 }finally{writeFileSync(configPath,original)}
});

test('4000-product catalog returns bounded pages, server filters, global selection IDs and correct counts',async t=>{
 const products=Array.from({length:4000},(_,n)=>({name:'PERF4000-'+String(n).padStart(4,'0'),description:'Örnek ürün açıklaması. '.repeat(35),category:'Performans Testi',price:300,commissionPercent:20,requireText:false,requireImage:false,images:[imageId],active:n%2===0,showOnHome:false}));
 dbCommand('query',{sql:'INSERT INTO ph_products(data) VALUES '+products.map(()=>'(?)').join(','),params:products.map(JSON.stringify)});dbCommand('query',{sql:"DELETE FROM ph_settings WHERE `key`='product_images_index_v1'"});
 const started=performance.now();let r=await request('/admin/products?page=1&limit=50&q=PERF4000-',{cookie:adminCookie});const elapsed=performance.now()-started;assert.equal(r.status,200);assert.equal(r.body.total,4000);assert.equal(r.body.items.length,50);assert.equal(r.body.pages,80);assert.equal(r.body.items[0].name,'PERF4000-0000');const payload=Buffer.byteLength(JSON.stringify(r.body));assert.ok(payload<100000);t.diagnostic('4000 products: page 1 '+elapsed.toFixed(1)+' ms, 50 records, '+payload+' bytes (local test server, not live hosting)');
 r=await request('/admin/products?page=2&limit=50&q=PERF4000-',{cookie:adminCookie});assert.equal(r.body.items[0].name,'PERF4000-0050');
 r=await request('/admin/products?page=1&status=passive&category='+encodeURIComponent('Performans Testi'),{cookie:adminCookie});assert.equal(r.body.total,2000);assert.ok(r.body.items.every(p=>p.active===false));
 r=await request('/admin/products?ids=1&status=passive&category='+encodeURIComponent('Performans Testi'),{cookie:adminCookie});assert.equal(r.body.ids.length,2000);assert.ok(r.body.ids.every(Number.isInteger));
 r=await request('/admin/products?page=999&q=PERF4000-',{cookie:adminCookie});assert.equal(r.body.page,80);assert.equal(r.body.items.length,50);
 r=await request('/admin/products?page=1&limit=10000&q=PERF4000-',{cookie:adminCookie});assert.equal(r.body.items.length,100);
 r=await request('/admin/products?stats=1',{cookie:adminCookie});assert.ok(Number(r.body.total)>=4000);assert.ok(Number(r.body.passive)>=2000);
 r=await request('/admin/categories?counts=1',{cookie:adminCookie});assert.equal(r.body.find(c=>c.name==='Performans Testi').total,4000);
 r=await request('/admin/products?page=1&q='+encodeURIComponent("%' OR 1=1 --"),{cookie:adminCookie});assert.equal(r.body.total,0);
 r=await request('/admin/products?page=1',{cookie:dealerCookie});assert.equal(r.status,403);
 const indexed=dbCommand('query',{sql:'SELECT COUNT(*) AS n FROM ph_product_images WHERE image_id=?',params:[imageId]});assert.ok(Number(indexed[0].n)>=4000,'Upgrade backfills existing product image references');const image=await fetch(base+'/api.php?route=/uploads/'+imageId);assert.equal(image.status,200,'Indexed product image is publicly readable');const id=(await request('/admin/products?page=1&q=PERF4000-',{cookie:adminCookie})).body.items[0].id;await request('/admin/products/bulk',{cookie:adminCookie,method:'PATCH',body:{products:[{id,images:[]}]}});assert.equal(dbCommand('query',{sql:'SELECT COUNT(*) AS n FROM ph_product_images WHERE product_id=?',params:[id]})[0].n,0);
 dbCommand('query',{sql:"DELETE FROM ph_products WHERE JSON_UNQUOTE(JSON_EXTRACT(data,'$.name')) LIKE 'PERF4000-%'"});
});
