<?php
declare(strict_types=1);define('PLEKSI_APP',true);
require __DIR__.'/../hosting/app/core.php';require __DIR__.'/../hosting/app/accounts.php';require __DIR__.'/../hosting/app/xml.php';
function check(bool $condition,string $label): void {if(!$condition)throw new RuntimeException($label);}
check(phone('+90 (532) 111-00-02')==='905321110002','phone normalization');check(phone('123')===null,'phone validation');
check(slug(['id'=>12,'name'=>'Kişiye Özel Çiçekli İsimlik & Şıklık'])==='kisiye-ozel-cicekli-isimlik-siklik-12','Turkish slug');
foreach(['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','2001:db8::1','192.0.2.1'] as $ip)check(!public_ip($ip),'private IP denied');check(public_ip('8.8.8.8'),'public address');
$p='Uzun-ve-güvenli-şifre-'.str_repeat('a',100);$h=pass_hash($p);check(pass_check($p,$h),'PHP password verification');check(!pass_check(substr($p,0,-1).'b',$h),'password is not truncated at bcrypt boundary');
$xml='<products><product><id>ABC</id><name>İsim &amp; Çiçek</name><price>1.300,50</price><description><![CDATA[Size özel & güzel]]></description><image>https://example.com/a.png</image><image>https://example.com/b.png</image></product></products>';
$rows=parse_xml($xml,xml_mapping(),20);check($rows[0]['price']===1300.5,'comma decimal');check($rows[0]['name']==='İsim & Çiçek','XML entities');check(count($rows[0]['remoteImages'])===2,'multiple XML images');
$bad=['<!DOCTYPE foo [<!ENTITY a SYSTEM "file:///etc/passwd">]><products/>','<products><product><id>1</id><name>Ürün</name><price>abc</price></product></products>','<products>'];foreach($bad as $input){$rejected=false;try{parse_xml($input,xml_mapping(),20);}catch(ApiError $e){$rejected=true;}check($rejected,'invalid/XXE XML rejected');}
echo "PASS: PHP normalization, passwords, SEO, SSRF classification, XML and XXE checks\n";
