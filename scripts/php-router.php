<?php
// Local PHP CLI-server router. Shared hosting uses hosting/.htaccess instead.
$root=realpath(getenv('PLEKSI_DOCROOT')?:__DIR__.'/../hosting');$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$base=getenv('PLEKSI_TEST_BASE')?:'';
if($base&&str_starts_with($path,$base))$path=substr($path,strlen($base));
$resolved=realpath($root.'/'.$path);
if(str_starts_with($path,'/app/')||$path==='/app'||str_contains($path,'..')){http_response_code(404);return true;}
if($resolved&&str_starts_with($resolved,$root.'/')&&is_file($resolved)){
 if(pathinfo($resolved,PATHINFO_EXTENSION)==='php'){$_SERVER['SCRIPT_NAME']=$base.$path;require $resolved;return true;}
 if($base){$type=match(pathinfo($resolved,PATHINFO_EXTENSION)){'css'=>'text/css','js'=>'application/javascript','svg'=>'image/svg+xml',default=>'application/octet-stream'};header('Content-Type: '.$type);readfile($resolved);return true;}
 return false;
}
$_SERVER['SCRIPT_NAME']=$base.'/index.php';require $root.'/index.php';
