<?php
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../server/qpay.php';
function expect($v,$message){if(!$v)throw new RuntimeException($message);}
$row=['payment_id'=>'one','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'12000.00'];
expect(paid_amount(['rows'=>[$row,$row]])===12000,'Duplicate payment IDs must not double count.');
expect(paid_amount(['rows'=>[array_replace($row,['payment_status'=>'NEW'])]])===0,'Unpaid must not count.');
expect(paid_amount(['rows'=>[array_replace($row,['payment_currency'=>'USD'])]])===0,'Wrong currency must not count.');
expect(paid_amount(['paid_amount'=>999999,'rows'=>[]])===0,'Aggregate alone is not proof.');
expect(paid_amount(['rows'=>[array_replace($row,['payment_amount'=>'-100'])]])===0,'Negative amounts rejected.');
expect(product_link('https://item.taobao.com/item.htm?id=1'),'Supplier URL accepted.');
expect(!product_link('https://taobao.com.attacker.test/'),'Spoofed domain rejected.');
expect(!product_link('https://user:pass@taobao.com/'),'Credentials in URLs rejected.');
echo "PASS: payment amount/currency/status/deduplication and supplier URL validation.\n";
