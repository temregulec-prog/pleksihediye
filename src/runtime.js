// PHP hosting injects its base path. The existing Node development server keeps /api.
export const appBase=typeof window!=='undefined'?(window.PLEKSI_CONFIG?.basePath||''):'';
export function apiUrl(path){return window.PLEKSI_CONFIG?.backend==='php'?appBase+'/api.php?route='+encodeURIComponent(path.replace(/^\//,'')):'/api'+path}
export function siteUrl(path){return location.origin+appBase+path}
// Clipboard API is unavailable on ordinary HTTP pages; keep a user-initiated fallback.
export async function copyText(text){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return}catch{}}
 const previous=document.activeElement,area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(area);
 try{area.select();area.setSelectionRange(0,area.value.length);if(!document.execCommand('copy'))throw Error('Metni kutudan seçerek kopyalayın.')}finally{area.remove();previous?.focus()}
}
