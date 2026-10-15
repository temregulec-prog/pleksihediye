<?php
declare(strict_types=1);
if(!defined('PLEKSI_APP')){http_response_code(404);exit;}
function validate_product(array $p,array $old=[]): void {global $user;
 if(!valid_text($p['name']??null,2,150)||!valid_text($p['description']??null,0,3000)||!valid_text($p['category']??null,1,100)||!money_value($p['price']??null,1)||!money_value($p['commissionPercent']??null,0,100)||!is_bool($p['requireText']??null)||!is_bool($p['requireImage']??null)||!is_array($p['images']??null)||count($p['images'])>3||count(array_unique($p['images']))!==count($p['images']))fail('Ürün adı, fiyat, %0–100 komisyon ve en fazla üç görseli kontrol edin.');
 foreach($p['images'] as $id)if(!is_string($id)||(!in_array($id,$old['images']??[],true)&&!one('SELECT id FROM ph_uploads WHERE id=? AND user_id=?',[$id,$user['id']])))fail('Ürün görseli geçersiz.');
 if(isset($p['active'])&&!is_bool($p['active']))fail('Ürün yayın durumu geçersiz.');
}
function products_route(string $route,string $method,array $b): void {global $user;
 if($route==='/products'&&$method==='GET'){$ps=array_values(array_filter(catalog(),fn($p)=>$p['active']??true));if(!is_dealer($user))foreach($ps as &$p){unset($p['dealerPrice'],$p['commissionPercent']);}out($ps);}
 if($route==='/admin/products'&&$method==='GET')out(catalog());
 if($route==='/admin/products'&&$method==='POST'){validate_product($b);$p=array_intersect_key($b,array_flip(['name','description','category','price','commissionPercent','requireText','requireImage','images','active']));$p+=['active'=>true,'kind'=>'name','color'=>'rose','tag'=>'Yeni'];out(save_product($p),201);}
 if($route==='/admin/products/bulk'&&$method==='PATCH'){if(!is_array($b['products']??null)||!count($b['products'])||count($b['products'])>1000)fail('Düzenlenecek ürünleri seçin.');$updates=$b['products'];$count=atomic(function()use($updates){$seen=[];foreach($updates as $patch){$id=$patch['id']??0;if(!is_int($id)||isset($seen[$id]))fail('Ürün seçimi geçersiz.');$seen[$id]=true;$row=one('SELECT id,data FROM ph_products WHERE id=? FOR UPDATE',[$id]);if(!$row)fail('Ürün bulunamadı.');$old=dec($row['data']);$old['id']=$id;$next=array_replace($old,array_intersect_key($patch,array_flip(['name','description','category','price','commissionPercent','requireText','requireImage','images','active'])));validate_product($next,$old);save_product($next);}return count($updates);});out(['updated'=>$count]);}
 if($route==='/uploads'&&$method==='POST'){$u=auth();$f=$_FILES['image']??null;if(!$f||is_array($f['name'])||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name'])||$f['size']>5*1024*1024)fail('Tek bir JPG, PNG veya WebP görseli yükleyin (en fazla 5 MB).');$id=upload_save(file_get_contents($f['tmp_name']),(int)$u['id']);out(['id'=>$id,'url'=>($GLOBALS['config']['base_path']?:'').'/api.php?route=/uploads/'.$id],201);}
 if(preg_match('~^/uploads/([a-f0-9]{40})$~',$route,$m)&&$method==='GET')send_image($m[1]);
}
