<?php
declare(strict_types=1);
$dir=(string)getenv('GOSTORE_DATA_DIR');if(!str_contains(str_replace('\\','/',$dir),'/tmp/warehouse-test-'))throw new RuntimeException('Isolated test data required');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/phone-auth.php';
$now=gmdate('c');db()->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute(['pin-fixture','pin-fixture@phone.gostore.invalid','PIN test','99112233','',password_hash('not-a-login-password',PASSWORD_BCRYPT),$now,$now]);
db()->prepare('INSERT INTO customer_phone_auth VALUES (?,?,?,?)')->execute(['99112233','pin-fixture',password_hash(pin_auth_digest('0123'),PASSWORD_BCRYPT,['cost'=>12]),$now]);