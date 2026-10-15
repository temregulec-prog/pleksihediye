import React,{useState,useEffect}from'react';
import{apiUrl}from'./runtime';
export function brandLogoUrl(){const id=window.PLEKSI_CONFIG?.logoId;return id?apiUrl('/uploads/'+id):null}
export function updateBrandLogo(logoId){window.PLEKSI_CONFIG={...window.PLEKSI_CONFIG,logoId};window.dispatchEvent(new Event('pleksi-branding'))}
export default function BrandLogo(){const[url,setUrl]=useState(brandLogoUrl);useEffect(()=>{const update=()=>setUrl(brandLogoUrl());window.addEventListener('pleksi-branding',update);return()=>window.removeEventListener('pleksi-branding',update)},[]);return <span className="brand-mark">{url?<img src={url} alt="Pleksi Hediye" width="1797" height="517"/>:<span className="brand-fallback">pleksi<span>hediye</span></span>}</span>}
