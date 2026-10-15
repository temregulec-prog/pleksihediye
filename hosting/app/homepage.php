<?php
declare(strict_types=1);
if(!defined('PLEKSI_APP')){http_response_code(404);exit;}
function homepage_schema(): array {static $schema;return $schema??=dec(file_get_contents(__DIR__.'/homepage-schema.json'));}
function homepage_defaults(): array {$out=[];$s=homepage_schema();foreach($s['groups'] as $group)foreach($group['fields'] as $f)$out[$f['key']]=$f['default'];foreach($s['images'] as $f)$out[$f['key']]=null;foreach($s['switches'] as $f)$out[$f['key']]=$f['default'];return $out;}
function homepage_content(): array {$defaults=homepage_defaults();$stored=setting('homepage');return $stored?array_replace($defaults,array_intersect_key(dec($stored),$defaults)):$defaults;}
function homepage_route(string $route,string $method,array $b): void {
 if($route!=='/admin/homepage')return;admin();if($method==='GET')out(homepage_content());if($method!=='PUT')fail('Desteklenmeyen yöntem.',405);
 global $user;$schema=homepage_schema();$old=homepage_content();if(array_diff_key($b,homepage_defaults()))fail('Bilinmeyen ana sayfa alanı.');
 foreach($schema['groups'] as $group)foreach($group['fields'] as $f)if(!isset($b[$f['key']])||!is_string($b[$f['key']])||mb_strlen($b[$f['key']])>$f['max'])fail($f['label'].' alanını kontrol edin.');
 foreach($schema['switches'] as $f)if(!is_bool($b[$f['key']]??null))fail('Bölüm görünürlüğünü kontrol edin.');
 foreach($schema['images'] as $f){$key=$f['key'];if(!array_key_exists($key,$b))fail('Görsel alanını kontrol edin.');$id=$b[$key];if($id!==null&&(!is_string($id)||!preg_match('/^[a-f0-9]{40}$/D',$id)||($id!==$old[$key]&&!one('SELECT id FROM ph_uploads WHERE id=? AND user_id=?',[$id,$user['id']]))))fail('Ana sayfa görseli geçersiz.');}
 set_setting('homepage',enc($b));out(homepage_content());
}
