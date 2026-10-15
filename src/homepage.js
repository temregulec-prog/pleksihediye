import schema from'../content/homepage-schema.json';
export{schema as homepageSchema};
export const homepageDefaults=Object.fromEntries([...schema.groups.flatMap(g=>g.fields.map(f=>[f.key,f.default])),...schema.images.map(f=>[f.key,null]),...schema.switches.map(f=>[f.key,f.default])]);
export function homepageContent(){return {...homepageDefaults,...window.PLEKSI_CONFIG?.homepage}}
export function publishHomepage(content){window.PLEKSI_CONFIG={...window.PLEKSI_CONFIG,homepage:content};window.dispatchEvent(new Event('pleksi-homepage'))}
