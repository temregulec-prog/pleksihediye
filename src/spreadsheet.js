import {ZipReader,BlobReader,TextWriter,BlobWriter,configure} from '@zip.js/zip.js';
configure({useWebWorkers:false});
const normalize=p=>p.replace(/\\/g,'/').replace(/^\.\//,'').normalize('NFC');
const basename=p=>normalize(p).split('/').pop().toLocaleLowerCase('tr');
function xml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Geçersiz Excel belgesi.');const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw Error('Excel içeriği okunamadı.');return d}
const nodes=(d,tag)=>Array.from(d.getElementsByTagNameNS('*',tag));
export async function readSpreadsheet(file){
 if(file.size>20*1024*1024)throw Error('Excel dosyası en fazla 20 MB olabilir.');
 const reader=new ZipReader(new BlobReader(file));
 try {
  const entries=await reader.getEntries();
  async function text(path){const e=entries.find(e=>e.filename===path);if(!e||e.uncompressedSize>20*1024*1024)throw Error('Excel dosyası eksik veya çok büyük.');return e.getData(new TextWriter())}
  const workbook=xml(await text('xl/workbook.xml')),sheet=nodes(workbook,'sheet')[0];
  const rels=xml(await text('xl/_rels/workbook.xml.rels'));
  const rel=nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));
  if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('Excel sayfası bulunamadı.');
  const path=new URL(rel.getAttribute('Target'),'https://xlsx.local/xl/workbook.xml').pathname.slice(1);
  const shared=entries.some(e=>e.filename==='xl/sharedStrings.xml')?nodes(xml(await text('xl/sharedStrings.xml')),'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
  const raw=nodes(xml(await text(path)),'row').map(row=>{const out={};for(const cell of nodes(row,'c')){const col=cell.getAttribute('r')?.replace(/[0-9]/g,'');const v=nodes(cell,'v')[0]?.textContent||'';out[col]=(cell.getAttribute('t')==='s'?shared[Number(v)]:cell.getAttribute('t')==='inlineStr'?nodes(cell,'t').map(t=>t.textContent).join(''):v)||''}return out});
  const header=raw.shift();if(!header||header.A!=='Ürün Adı'||header.B!=='Görsel Yolu'||header.C!=='Kategori'||!header.D.startsWith('Perakende Fiyatı'))throw Error('Beklenen sütunlar: Ürün Adı, Görsel Yolu, Kategori, Perakende Fiyatı (TL), Kaynak Ürün URL.');
  const rows=raw.filter(r=>Object.values(r).some(v=>v.trim())).map((r,i)=>{
   const name=r.A?.trim(),category=r.C?.trim(),imagePath=normalize(r.B?.trim()||''),price=Number(r.D?.trim().replace(',','.')),sourceUrl=r.E?.trim()||'';
   if(!name||name.length<2||name.length>150||!category||category.length>100||!imagePath||!Number.isFinite(price)||price<1||price>1000000||Math.abs(price*100-Math.round(price*100))>0.0001)throw Error((i+2)+'. satırda ürün adı, kategori, fiyat veya görsel yolu geçersiz.');
   if(sourceUrl&&!/^https?:\/\//i.test(sourceUrl))throw Error((i+2)+'. satırda kaynak ürün bağlantısı geçersiz.');
   return {name,category,price,imagePath,sourceUrl,importIdentity:sourceUrl||category+'|'+imagePath};
  });
  if(!rows.length||rows.length>10000)throw Error('Excel dosyası 1–10.000 ürün içermeli.');
  if(new Set(rows.map(r=>r.importIdentity)).size!==rows.length)throw Error('Excel içinde tekrarlanan kaynak ürün bağlantısı veya görsel yolu var.');
  return rows;
 } finally {await reader.close()}
}
export async function openImageArchive(file,rows,prefix=''){
 const reader=new ZipReader(new BlobReader(file));
 try {
  const entries=(await reader.getEntries()).filter(e=>!e.directory&&!e.filename.startsWith('__MACOSX/')&&/\.(jpg|jpeg|png|webp)$/i.test(e.filename));
  const matches=rows.map(row=>{
   const wanted=prefix.trim()?normalize(prefix.trim()).replace(/\/$/,'')+'/'+normalize(row.imagePath).split('/').pop():normalize(row.imagePath);
   const exact=entries.filter(e=>normalize(e.filename)===wanted||normalize(e.filename).endsWith('/'+wanted));
   const candidates=exact.length?exact:entries.filter(e=>basename(e.filename)===basename(wanted));
   const entry=candidates.length===1?candidates[0]:null;
   return {...row,entry,error:candidates.length>1?'Aynı adlı birden fazla görsel var; görsel klasörünü belirtin.':!entry?'Görsel bulunamadı.':entry.uncompressedSize>5*1024*1024?'Görsel 5 MB sınırını aşıyor.':null};
  });
  return {reader,matches};
 } catch(e){await reader.close();throw e}
}
export async function readArchiveImage(entry){const type=/\.png$/i.test(entry.filename)?'image/png':/\.webp$/i.test(entry.filename)?'image/webp':'image/jpeg';return entry.getData(new BlobWriter(type))}

export function localSpreadsheetImages(rows,folder='',basePath=''){
 const root=new URL((basePath||'')+'/',location.origin);
 const directory=folder.trim()?new URL(folder.trim().replace(/\/?$/,'/'),root):null;
 if(directory&&(directory.origin!==location.origin||directory.search||directory.hash))throw Error('Bu sitedeki görsel klasörünü kullanın. Örnek: /gorseller/uzun-acacak');
 return rows.map(row=>{
  const url=directory?new URL(encodeURIComponent(normalize(row.imagePath).split('/').pop()),directory):new URL(normalize(row.imagePath).split('/').map(encodeURIComponent).join('/'),root);
  return {...row,localImagePath:url.pathname,error:null};
 });
}
