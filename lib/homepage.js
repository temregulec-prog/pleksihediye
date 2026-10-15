import{readFileSync}from'node:fs';
const schema=JSON.parse(readFileSync(new URL('../content/homepage-schema.json',import.meta.url),'utf8'));
const fields=schema.groups.flatMap(g=>g.fields);
const defaults=Object.fromEntries([...fields.map(f=>[f.key,f.default]),...schema.images.map(f=>[f.key,null]),...schema.switches.map(f=>[f.key,f.default])]);
export function homepageContent(db){const stored=db.prepare("SELECT value FROM settings WHERE key='homepage'").get()?.value;return {...defaults,...(stored?JSON.parse(stored):{})}}
export function setupHomepage(app,db,admin){
 app.get('/api/admin/homepage',admin,(_,res)=>res.json(homepageContent(db)));
 app.put('/api/admin/homepage',admin,(req,res)=>{const b=req.body,old=homepageContent(db);
  if(Object.keys(b).some(k=>!Object.hasOwn(defaults,k))||fields.some(f=>typeof b[f.key]!=='string'||[...b[f.key]].length>f.max)||schema.switches.some(f=>typeof b[f.key]!=='boolean'))return res.status(400).json({error:'Ana sayfa alanlarını ve metin uzunluklarını kontrol edin.'});
  for(const {key}of schema.images){const id=b[key];if(id!==null&&(typeof id!=='string'||!/^[a-f0-9]{40}$/.test(id)||(id!==old[key]&&!db.prepare('SELECT id FROM uploads WHERE id=? AND user_id=?').get(id,req.user.id))))return res.status(400).json({error:'Ana sayfa görseli geçersiz.'})}
  db.prepare("INSERT INTO settings VALUES('homepage',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(b));res.json(homepageContent(db));
 });
}
