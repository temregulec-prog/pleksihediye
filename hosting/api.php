<?php
declare(strict_types=1);
if(!defined('PLEKSI_APP'))define('PLEKSI_APP',true);define('PLEKSI_API',true);
try{
 require __DIR__.'/app/bootstrap.php';
 $raw=(string)($_GET['route']??'');$route='/'.ltrim(parse_url($raw,PHP_URL_PATH)?:'','/');parse_str((string)(parse_url($raw,PHP_URL_QUERY)??''),$extra);$_GET=array_replace($extra,$_GET);
 $method=$_SERVER['REQUEST_METHOD']??'GET';if(!in_array($method,['GET','POST','PATCH','PUT','DELETE'],true))fail('Desteklenmeyen yöntem.',405);
 if($method!=='GET'){
  $origin=$_SERVER['HTTP_ORIGIN']??'';if($origin!==''){$o=parse_url($origin);$actual=($_SERVER['HTTP_HOST']??'');$originHost=($o['host']??'').(isset($o['port'])?':'.$o['port']:'');if(!in_array($o['scheme']??'',['http','https'],true)||strcasecmp($originHost,$actual)!==0)fail('Geçersiz istek kaynağı.',403);}
  if($route!=='/uploads'&&!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))fail('JSON istek gövdesi gerekir.',415);
 }
 if((int)($_SERVER['CONTENT_LENGTH']??0)>8*1024*1024)fail('İstek boyutu sınırı aşıldı.',413);
 $b=[];if($route!=='/uploads'&&$method!=='GET'){$input=file_get_contents('php://input');if(strlen($input)>6*1024*1024)fail('İstek boyutu sınırı aşıldı.',413);$b=$input!==''?dec($input):[];if(!is_array($b))fail('JSON nesnesi gönderin.');}
 if(str_starts_with($route,'/auth/')){$key=hash_hmac('sha256',($_SERVER['REMOTE_ADDR']??'unknown'),$config['app_key']);$now=now_ms();sql('INSERT INTO ph_rates(id,window_start,hits) VALUES(?,?,1) ON DUPLICATE KEY UPDATE hits=IF(window_start<?,1,hits+1),window_start=IF(window_start<?,?,window_start)',[$key,$now,$now-900000,$now-900000,$now]);if((int)one('SELECT hits FROM ph_rates WHERE id=?',[$key])['hits']>40)fail('Çok fazla deneme. 15 dakika sonra tekrar deneyin.',429);}
 if($user&&$user['must_change_password']&&!in_array($route,['/me','/logout','/auth/login','/auth/change-password','/auth/forgot'],true))out(['error'=>'Devam etmeden önce yeni şifrenizi belirleyin.','mustChangePassword'=>true],403);
 if(str_starts_with($route,'/admin/'))admin();
 require __DIR__.'/app/accounts.php';require __DIR__.'/app/products.php';require __DIR__.'/app/orders.php';require __DIR__.'/app/xml.php';
 accounts_route($route,$method,$b);products_route($route,$method,$b);orders_route($route,$method,$b);xml_route($route,$method,$b);
 fail('İşlem bulunamadı.',404);
}catch(ApiError $e){out(['error'=>$e->getMessage()],$e->status);}catch(JsonException $e){out(['error'=>'Geçersiz JSON verisi.'],400);}catch(Throwable $e){error_log('Pleksi API: '.$e::class.' [sunucu işlemi başarısız]');out(['error'=>'İşlem tamamlanamadı. Veritabanı ve PHP hata günlüğünü kontrol edin.'],500);}
