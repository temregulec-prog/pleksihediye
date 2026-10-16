<?php
declare(strict_types=1);
// CLI-only helper for isolated test databases; never included in the hosting ZIP.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$name=getenv('PLEKSI_TEST_DATABASE');if(!is_string($name)||!preg_match('/^pleksi_test_[a-z0-9_]+$/D',$name))throw new RuntimeException('Explicit isolated test database required.');
$host=getenv('PHP_TEST_DB_HOST')?:'localhost';$port=(int)(getenv('PHP_TEST_DB_PORT')?:3306);$db=new PDO("mysql:host=$host;port=$port;charset=utf8mb4",getenv('PHP_TEST_DB_USER')?:'root',getenv('PHP_TEST_DB_PASS')?:'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$action=$argv[1]??'';
if($action==='create'){$db->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");exit;}
if($action==='drop'){$db->exec("DROP DATABASE IF EXISTS `$name`");exit;}
$db->exec("USE `$name`");if($action==='hold-image-lock'){$lock='ph_images_'.substr(hash('sha256',$name),0,24);$stmt=$db->prepare('SELECT GET_LOCK(?,0)');$stmt->execute([$lock]);if((int)$stmt->fetchColumn()!==1)throw new RuntimeException('Test lock unavailable');echo "LOCKED\n";flush();fgets(STDIN);exit;}
$data=json_decode(file_get_contents('php://stdin'),true,512,JSON_THROW_ON_ERROR);$s=$db->prepare($data['sql']);$s->execute($data['params']??[]);echo json_encode($s->fetchAll(PDO::FETCH_ASSOC),JSON_THROW_ON_ERROR);
