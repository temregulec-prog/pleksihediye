export function productSlug(p){return p.name.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+p.id}
export function seoDescription(p){return `${p.name} ile sevdiklerinize kişiye özel bir hediye hazırlayın. Yazı, renk ve görsel seçenekleriyle Pleksi Hediye'de keşfedin.`.slice(0,160)}
export function normalizePhone(value){if(typeof value!=='string')return null;let n=value.replace(/[\s()+-]/g,'');if(n.startsWith('0090'))n=n.slice(2);if(n.length===11&&n[0]==='0')n='90'+n.slice(1);if(n.length===10)n='90'+n;return /^905\d{9}$/.test(n)?n:null}
export function dealerAmount(price,percent){return Math.round((price*(100-percent)/100+Number.EPSILON)*100)/100}
export function groupOrders(orders){const groups=new Map();for(const o of orders){const key=o.batch_id||'legacy-'+o.id;if(!groups.has(key))groups.set(key,{id:key,day:o.batch_day||o.created.slice(0,10),customer:o.customer,orders:[],total:0});const b=groups.get(key);b.orders.push(o);b.total=Math.round((b.total+o.total)*100)/100}return [...groups.values()].map(g=>({...g,status:new Set(g.orders.map(o=>o.status)).size===1?g.orders[0].status:'Karma durum'}))}
export function validateProductOptions(options=[]){
 if(!Array.isArray(options)||options.length>8)throw Error('En fazla 8 ürün seçeneği tanımlayın.');
 const names=new Set();
 for(const o of options){const key=typeof o?.name==='string'?o.name.trim().toLocaleLowerCase('tr'):'';if(!key||o.name.length>40||['__proto__','constructor','prototype'].includes(key)||names.has(key)||!Array.isArray(o.values)||!o.values.length||o.values.length>30||o.values.some(v=>typeof v!=='string'||!v.trim()||v.length>80)||new Set(o.values.map(v=>v.trim().toLocaleLowerCase('tr'))).size!==o.values.length)throw Error('Seçenek başlıkları benzersiz olmalı; her seçenek için 1–30 farklı değer yazın.');names.add(key)}
 return options.map(o=>({name:o.name.trim(),values:o.values.map(v=>v.trim())}));
}
export function validateOptionSelections(product,input={}){
 const options=product.options||[];
 if(!options.length)return {};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!options.some(o=>o.name===k)))throw Error(product.name+' için seçenekler geçersiz.');
 return Object.fromEntries(options.map(o=>{if(!o.values.includes(input[o.name]))throw Error(product.name+' için '+o.name+' seçin.');return[o.name,input[o.name]]}));
}
export function orderOptionText(item){const entries=Object.entries(item.optionSelections||{});return entries.length?entries.map(([name,value])=>name+': '+value).join(' · '):item.color||''}
