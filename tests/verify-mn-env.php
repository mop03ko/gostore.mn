<?php
declare(strict_types=1);
require __DIR__.'/../server/verify-mn.php';
foreach(['','old-key-still-configured','another-key'] as $key){putenv('VERIFY_MN_API_KEY='.$key);if(verify_mn_environment()!=='')throw new RuntimeException('Legacy environment must remain disabled');}
echo "PASS legacy verify.mn environment cannot re-enable the retired service.\n";
