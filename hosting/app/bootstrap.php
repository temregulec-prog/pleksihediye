<?php
declare(strict_types=1);
if(!defined('PLEKSI_APP')){http_response_code(404);exit;}
require_once __DIR__.'/core.php';
header('X-Content-Type-Options: nosniff');header('Referrer-Policy: strict-origin-when-cross-origin');
if(!is_file(__DIR__.'/config.php')){if(defined('PLEKSI_API'))out(['error'=>'Önce kurulum ekranını tamamlayın.'],503);$installBase=rtrim(str_replace('\\','/',dirname($_SERVER['SCRIPT_NAME']??'/index.php')),'/.');header('Location: '.$installBase.'/install.php');exit;}
$config=require __DIR__.'/config.php';
$db=new PDO('mysql:host='.$config['db_host'].';port='.$config['db_port'].';dbname='.$config['db_name'].';charset=utf8mb4',$config['db_user'],$config['db_pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET time_zone='+00:00'");
$user=current_user();
