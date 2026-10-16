import{apiUrl}from'./runtime.js';

// Only reads may be retried; never replay an order, registration or upload.
export async function requestApi(path,options={}){
 const{timeoutMs=20000,...requestOptions}=options;
 const method=(options.method||'GET').toUpperCase();
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetch(apiUrl(path),{...requestOptions,cache:'no-store',credentials:'same-origin',signal:options.signal||controller.signal,headers:{Accept:'application/json',...(method!=='GET'?{'Content-Type':'application/json'}:{}),...options.headers},body:options.body?JSON.stringify(options.body):undefined});
   let data,parseError=false;try{data=await response.json()}catch{parseError=true}
   const temporary=[303,408,425,502,503,504].includes(response.status)||(parseError&&response.ok);
   if(method==='GET'&&attempt===0&&temporary&&!options.signal?.aborted){await new Promise(resolve=>setTimeout(resolve,250));continue}
   if(parseError){
    if(response.status===409&&path==='/auth/register')throw Error('Bu telefon numarasıyla zaten bir üyelik veya başvuru var. Başvurunuz onay bekliyor olabilir.');
    if(response.status===401)throw Error('Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.');
    if(response.status===429)throw Error('Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.');
    throw Error(response.ok?'Sunucudan geçerli yanıt alınamadı. Lütfen tekrar deneyin.':'Sunucu isteği tamamlayamadı (HTTP '+response.status+'). Lütfen tekrar deneyin.');
   }
   if(!response.ok)throw Error(data?.error||'İşlem tamamlanamadı.');
   return data;
  }catch(e){
   const network=e instanceof TypeError||e.name==='AbortError';
   if(network&&method==='GET'&&attempt===0&&!options.signal?.aborted)continue;
   if(network)throw Error(e.name==='AbortError'?'Sunucu yanıtı gecikti. Lütfen tekrar deneyin.':'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
   throw e;
  }finally{clearTimeout(timer)}
 }
}
