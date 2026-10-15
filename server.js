import express from 'express';
import {setupOrders} from './lib/orders.js';
import {setupAccounts} from './lib/accounts.js';
import {setupXml} from './lib/xml.js';
import {productSlug,seoDescription,dealerAmount} from './shared.js';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import multer from 'multer';
import { resolve } from 'node:path';
const app=express(); mkdirSync('.data',{recursive:true});
const db=new DatabaseSync(process.env.DATABASE_PATH || '.data/store.sqlite');
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', company TEXT, tax TEXT, dealer_status TEXT DEFAULT 'none');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),customer TEXT NOT NULL,items TEXT NOT NULL,total INTEGER NOT NULL,status TEXT DEFAULT 'Ödeme bekleniyor',created TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const seedProducts=[
{id:1,name:'Kişiye Özel Pleksi İsimlik',category:'İsimlik & Kapı Süsü',price:349,dealerPrice:239,color:'rose',tag:'Çok sevilen',kind:'name',description:'Yaşam alanınıza size özel bir dokunuş. 25 cm genişlik, 3 mm pleksi ve ahşap taban.'},
{id:2,name:'Çiçekli Harf Anahtarlık',category:'Anahtarlık',price:89,dealerPrice:55,color:'lilac',tag:'Yeni',kind:'key',description:'Altın renkli halka ve zarif çiçek detayları. İstediğiniz harf ile hazırlanır.'},
{id:3,name:'Anı Biriktiren Fotoğraf Standı',category:'Fotoğraf & Çerçeve',price:279,dealerPrice:189,color:'cream',tag:'',kind:'photo',description:'En sevdiğiniz anılar için şeffaf pleksi çerçeve. 15 × 20 cm, ahşap taban.'},
{id:4,name:'İyi ki Varsın Hediye Kutusu',category:'Hediye Setleri',price:649,dealerPrice:449,color:'peach',tag:'Favori hediye',kind:'gift',description:'Özel not kartı, kişiselleştirilmiş isimlik ve anahtarlık içeren özenli hediye kutusu.'},
{id:5,name:'Söz & Nişan Hatıra Magneti',category:'Özel Günler',price:49,dealerPrice:29,color:'cream',tag:'',kind:'magnet',description:'Özel günlerinizin zarif hatırası. İsim ve tarih bilgisiyle kişiselleştirilir.'},
{id:6,name:'Minimal Masa İsimliği',category:'İsimlik & Kapı Süsü',price:399,dealerPrice:279,color:'lilac',tag:'Yeni',kind:'name',description:'Çalışma masanıza özel, gold detaylı minimal masa isimliği.'},
{id:7,name:'Kalpten Bir Anahtarlık',category:'Anahtarlık',price:99,dealerPrice:65,color:'rose',tag:'',kind:'key',description:'Sevdiklerinizi her an yanınızda taşıyın. İsim baskılı kalp anahtarlık.'},
{id:8,name:'Birlikte Güzeliz Fotoğraf Standı',category:'Fotoğraf & Çerçeve',price:299,dealerPrice:199,color:'peach',tag:'',kind:'photo',description:'Birlikte biriktirdiğiniz anılara kişisel bir çerçeve.'}
];
db.exec(`CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), mime TEXT, data BLOB);`);
if(!db.prepare('SELECT COUNT(*) AS n FROM products').get().n){const insert=db.prepare('INSERT INTO products(id,data) VALUES(?,?)');for(const p of seedProducts)insert.run(p.id,JSON.stringify({...p,images:[],active:true}));}
const catalog=()=>db.prepare('SELECT data FROM products ORDER BY id').all().map(r=>{const p=JSON.parse(r.data);const commissionPercent=p.commissionPercent??Math.round((1-p.dealerPrice/p.price)*10000)/100;return {...p,commissionPercent,dealerPrice:dealerAmount(p.price,commissionPercent),requireText:!!p.requireText,requireImage:!!p.requireImage}});
const isDealer=u=>u?.dealer_status==='approved';
app.disable('x-powered-by');
app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Geçersiz istek kaynağı.'})}catch{return res.sendStatus(403)}}next()}); app.use(express.json({limit:'6mb'}));
const auth=(req,res,next)=>req.user?next():res.status(401).json({error:'Lütfen giriş yapın.'});
const admin=(req,res,next)=>req.user?.role==='admin'?next():res.status(403).json({error:'Yönetici yetkisi gerekiyor.'});
const attempts=new Map();
app.use('/api/auth',(req,res,next)=>{const key=req.socket.remoteAddress,now=Date.now();let a=attempts.get(key);if(!a||now-a.time>900000){a={time:now,count:0};attempts.set(key,a)}if(++a.count>40)return res.status(429).json({error:'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.'});next()});
const {deliveryOptions}=setupAccounts(app,db);
setupXml(app,db,admin,catalog);
app.get('/api/products',(req,res)=>res.json(catalog().filter(p=>p.active!==false).map(({dealerPrice,commissionPercent,...p})=>({...p,...(isDealer(req.user)?{dealerPrice,commissionPercent}:{})}))));
setupOrders(app,db,{auth,admin,catalog,isDealer,deliveryOptions});
const imageUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}});
app.post('/api/uploads',auth,(req,res,next)=>imageUpload.single('image')(req,res,err=>err?res.status(400).json({error:'Tek bir JPG, PNG veya WebP görseli yükleyin (en fazla 5 MB).'}):next()),(req,res)=>{
 const b=req.file?.buffer;let mime=null;
 if(b?.length>12){if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(b[0]===255&&b[1]===216&&b[2]===255)mime='image/jpeg';else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')mime='image/webp';}
 if(!mime)return res.status(400).json({error:'Geçerli bir JPG, PNG veya WebP görseli seçin.'});
 const id=randomBytes(20).toString('hex');db.prepare('INSERT INTO uploads VALUES(?,?,?,?)').run(id,req.user.id,mime,b);res.status(201).json({id,url:'/api/uploads/'+id});
});
app.get('/api/uploads/:id',(req,res)=>{const u=db.prepare('SELECT * FROM uploads WHERE id=?').get(req.params.id);if(!u)return res.sendStatus(404);const publicImage=catalog().some(p=>p.active!==false&&p.images?.includes(u.id));const orderImage=req.user&&db.prepare('SELECT items FROM orders WHERE user_id=? AND deleted_at IS NULL').all(req.user.id).some(o=>JSON.parse(o.items).some(i=>i.artwork===u.id));if(!publicImage&&!orderImage&&req.user?.id!==u.user_id&&req.user?.role!=='admin')return res.sendStatus(403);res.setHeader('Content-Type',u.mime);res.setHeader('Cache-Control',publicImage?'public, max-age=3600':'private, no-store');res.send(Buffer.from(u.data))});
app.get('/api/admin/products',admin,(req,res)=>res.json(catalog()));
function validateProduct(p,userId){if(typeof p.name!=='string'||p.name.trim().length<2||p.name.length>150||typeof p.description!=='string'||p.description.length>3000||typeof p.category!=='string'||p.category.length>100||!Number.isFinite(p.price)||p.price<1||p.price>1000000||Math.abs(p.price*100-Math.round(p.price*100))>0.0001||!Number.isFinite(p.commissionPercent)||p.commissionPercent<0||p.commissionPercent>100||typeof p.requireText!=='boolean'||typeof p.requireImage!=='boolean'||!Array.isArray(p.images)||p.images.length>3||new Set(p.images).size!==p.images.length)return false;return p.images.every(id=>typeof id==='string'&&db.prepare('SELECT id FROM uploads WHERE id=? AND user_id=?').get(id,userId));}
app.post('/api/admin/products',admin,(req,res)=>{const p=req.body;if(!validateProduct(p,req.user.id))return res.status(400).json({error:'Ürün adını, fiyatları ve en fazla 3 görseli kontrol edin. Komisyon oranı %0–100 arasında olmalıdır.'});const id=Number(db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM products').get().id);const product={id,name:p.name.trim(),description:p.description,category:p.category,price:p.price,commissionPercent:p.commissionPercent,requireText:p.requireText,requireImage:p.requireImage,images:p.images,active:p.active!==false,kind:'name',color:'rose',tag:'Yeni'};db.prepare('INSERT INTO products VALUES(?,?)').run(id,JSON.stringify(product));res.status(201).json(product)});
app.patch('/api/admin/products/bulk',admin,(req,res)=>{const updates=req.body.products;if(!Array.isArray(updates)||!updates.length||updates.length>1000)return res.status(400).json({error:'Düzenlenecek ürünleri seçin.'});const existing=catalog(),merged=[];for(const p of updates){const old=existing.find(x=>x.id===p.id);if(!old)return res.status(400).json({error:'Ürün bulunamadı.'});const next={...old,...Object.fromEntries(Object.entries(p).filter(([k])=>['name','description','category','price','commissionPercent','requireText','requireImage','active','images'].includes(k)))};if(!validateProduct({...next,images:[]},req.user.id)||!Array.isArray(next.images)||next.images.length>3||new Set(next.images).size!==next.images.length||next.images.some(id=>!old.images.includes(id)&&!db.prepare('SELECT id FROM uploads WHERE id=? AND user_id=?').get(id,req.user.id)))return res.status(400).json({error:'Geçersiz ürün bilgisi. Fiyatları ve görselleri kontrol edin.'});merged.push(next)}db.exec('BEGIN');try{for(const p of merged)db.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(p),p.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}res.json({updated:merged.length})});
app.use('/api',(_,res)=>res.status(404).json({error:'İşlem bulunamadı.'}));
if(process.env.NODE_ENV==='production'){
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 app.get('/urun/:slug',(req,res)=>{const id=Number(req.params.slug.split('-').at(-1));const p=catalog().find(p=>p.id===id&&p.active!==false);if(!p)return res.status(404).send('Ürün bulunamadı.');if(req.params.slug!==productSlug(p))return res.redirect(301,'/urun/'+productSlug(p));const origin=(process.env.PUBLIC_SITE_URL||'').replace(/\/$/,'');let html=readFileSync('dist/index.html','utf8');const description=seoDescription(p);const url=origin+'/urun/'+productSlug(p);const image=p.images?.[0]?origin+'/api/uploads/'+p.images[0]:null;const ld={'@context':'https://schema.org','@type':'Product',name:p.name,description, ...(image?{image:[image]}:{}),offers:{'@type':'Offer',priceCurrency:'TRY',price:p.price,url}};html=html.replace(/<title>.*?<\/title>/,`<title>${esc(p.name)} · Pleksi Hediye</title>`).replace(/<meta name="description" content="[^"]*"\s*\/>/,`<meta name="description" content="${esc(description.slice(0,160))}"/>`).replace('</head>',`<meta property="og:title" content="${esc(p.name)}"/><meta property="og:description" content="${esc(description)} · ${p.price} TL"/><meta property="og:type" content="product"/><meta property="og:url" content="${esc(url)}"/>${image?`<meta property="og:image" content="${esc(image)}"/>`:''}${origin?`<link rel="canonical" href="${esc(url)}"/>`:''}<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,'\\u003c')}</script></head>`).replace('<div id="root"></div>',`<div id="root"><main><h1>${esc(p.name)}</h1><p>${esc(description)}</p><p>${p.price} TL</p></main></div>`);res.type('html').send(html)});
 app.get('/robots.txt',(_,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n${process.env.PUBLIC_SITE_URL?'Sitemap: '+process.env.PUBLIC_SITE_URL.replace(/\/$/,'')+'/sitemap.xml':''}`));
 app.get('/sitemap.xml',(_,res)=>{if(!process.env.PUBLIC_SITE_URL)return res.status(503).type('text/plain').send('PUBLIC_SITE_URL must be configured.');const origin=process.env.PUBLIC_SITE_URL.replace(/\/$/,'');res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/',...catalog().filter(p=>p.active!==false).map(p=>'/urun/'+productSlug(p))].map(path=>'<url><loc>'+esc(origin+path)+'</loc></url>').join('')+'</urlset>')});
 app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.status(req.path==='/'?200:404).sendFile(resolve('dist/index.html')))
}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares)}
app.use((err,req,res,next)=>{console.error(err.message);res.status(500).json({error:'İşlem tamamlanamadı. Lütfen tekrar deneyin.'})});
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Pleksi Hediye server ready'));
