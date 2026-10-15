// Homepage display copies only; logos and customer artwork keep their original bytes.
export async function optimizeHomepageImage(file, maxEdge = 1600) {
 const url = URL.createObjectURL(file);
 try {
  const img = new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Görsel okunamadı.'));img.src=url});
  const scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const context=canvas.getContext('2d');
  if(!context)throw Error('Görsel işlenemedi.');
  context.drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
  if(!blob)throw Error('Görsel sıkıştırılamadı.');
  // Browsers without WebP encoding may return PNG. Keep the actual MIME type.
  if(scale===1&&blob.size>=file.size)return file;
  return new File([blob],blob.type==='image/webp'?'homepage.webp':'homepage.png',{type:blob.type});
 } finally {URL.revokeObjectURL(url)}
}
