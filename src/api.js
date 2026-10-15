import{apiUrl}from'./runtime.js';

// Retry reads only: a lost response must never create a duplicate order or upload.
export async function requestApi(path,options={}){
 const method=(options.method||'GET').toUpperCase();
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let response,data;
  try{
   response=await fetch(apiUrl(path),{...options,cache:'no-store',credentials:'same-origin',signal:options.signal||controller.signal,headers:{Accept:'application/json',...(method!=='GET'?{'Content-Type':'application/json'}:{}),...options.headers},body:options.body?JSON.stringify(options.body):undefined});
   try{data=await response.json()}catch{
    if(!response.ok){
     if(response.status===409&&path==='/auth/register')throw Error('Bu telefon numarasıyla zaten bir üyelik veya başvuru var. Başvurunuz onay bekliyor olabilir.');
     if(response.status===401)throw Error('Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.');
     if(response.status===429)throw Error('Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.');
     throw Error('Sunucu isteği tamamlayamadı (HTTP '+response.status+'). Lütfen tekrar deneyin.');
    }
    throw Error('Sunucudan geçerli yanıt alınamadı. Lütfen tekrar deneyin.');
   }
  }catch(e){
   const network=e instanceof TypeError||e.name==='AbortError';
   if(network&&method==='GET'&&attempt===0&&!options.signal?.aborted){continue}
   if(network)throw Error(e.name==='AbortError'?'Sunucu yanıtı gecikti. Lütfen tekrar deneyin.':'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
   throw e;
  }finally{clearTimeout(timer)}
  if(!response.ok)throw Error(data.error||'İşlem tamamlanamadı.');
  return data;
 }
}
