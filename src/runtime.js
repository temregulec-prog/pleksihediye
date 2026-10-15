// PHP hosting injects its base path. The existing Node development server keeps /api.
export const appBase=typeof window!=='undefined'?(window.PLEKSI_CONFIG?.basePath||''):'';
export function apiUrl(path){return window.PLEKSI_CONFIG?.backend==='php'?appBase+'/api.php?route='+encodeURIComponent(path):'/api'+path}
export function siteUrl(path){return location.origin+appBase+path}
