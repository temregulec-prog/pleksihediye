import{realpathSync,statSync,readFileSync}from'node:fs';
import{resolve,sep}from'node:path';
export function localProductImage(path){
 if(typeof path!=='string')throw Error('Görsel yolu geçersiz.');
 path=decodeURIComponent(path);
 if(!path.startsWith('/')||path.startsWith('//')||path.includes('\0')||path.includes('\\')||/(?:^|\/)\.[^/]*(?:\/|$)|[?#]/.test(path)||! /\.(jpe?g|png|webp)$/i.test(path))throw Error('Site içindeki doğrudan JPG, PNG veya WebP dosya yolunu kullanın.');
 let file;try{const root=realpathSync(process.env.PLEKSI_PUBLIC_ROOT||resolve('dist'));file=realpathSync(root+path);if(!file.startsWith(root+sep)||!statSync(file).isFile())throw Error();}catch{throw Error('Görsel dosyası sunucuda bulunamadı: '+path)}
 if(statSync(file).size>5*1024*1024)throw Error('Görsel 5 MB sınırını aşıyor: '+path);
 const bytes=readFileSync(file);let mime;if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';
 if(!mime)throw Error('Geçerli bir ürün görseli değil: '+path);
 return{bytes,mime};
}
