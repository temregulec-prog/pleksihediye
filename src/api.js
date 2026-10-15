import{apiUrl}from'./runtime.js';

// Retry reads only: a lost response must never create a duplicate order or upload.
export async function requestApi(path,options={}){
 const method=(options.method||'GET').toUpperCase();
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let response,data;
  try{
   response=await fetch(apiUrl(path),{...options,signal:options.signal||controller.signal,headers:{'Content-Type':'application/json',...options.headers},body:options.body?JSON.stringify(options.body):undefined});
   try{data=await response.json()}catch{throw Error('Sunucudan geçerli yanıt alınamadı. Lütfen tekrar deneyin.')}
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
