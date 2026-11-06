<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
$dir=__DIR__.'/../tmp/verify-mn-env-test-'.bin2hex(random_bytes(5));mkdir($dir,0700,true);
copy(__DIR__.'/../server/verify-mn.php',$dir.'/verify-mn.php');require $dir.'/verify-mn.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
putenv('VERIFY_MN_API_KEY');check(verify_mn_environment()==='','No configuration');
file_put_contents($dir.'/verify-mn.env',"VERIFY_MN_API_KEY=test-env-key-123456\n");
check(verify_mn_environment()==='test-env-key-123456'&&getenv('VERIFY_MN_API_KEY')==='test-env-key-123456','Imports named dotenv variable');
putenv('VERIFY_MN_API_KEY=explicit-process-key');check(verify_mn_environment()==='explicit-process-key','Process environment wins');
putenv('VERIFY_MN_API_KEY=');check(verify_mn_environment()==='','Explicit empty disables fallback');
foreach(["VERIFY_MN_API_KEY=valid-key-123456\nOTHER=unexpected",'VERIFY_MN_API_KEY=key with spaces',str_repeat('x',1025)] as $invalid){putenv('VERIFY_MN_API_KEY');file_put_contents($dir.'/verify-mn.env',$invalid);check(verify_mn_environment()==='','Reject malformed environment file');}
echo "PASS verify.mn dotenv import, process precedence, disabled configuration, strict parsing.\n";