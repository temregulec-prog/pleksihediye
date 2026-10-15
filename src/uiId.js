// These keys identify UI items only; authentication tokens are created by the server.
let sequence=0;
export function uiId(){
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
 return 'ui-'+Date.now().toString(36)+'-'+(++sequence).toString(36);
}
