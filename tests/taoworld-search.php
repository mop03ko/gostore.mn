<?php
declare(strict_types=1);
// Search intent: pasted Taobao/Tmall links, share texts and item numbers open the product; brand
// misspellings/transliterations and spacing/case are normalised; Mongolian words pass through.
require __DIR__.'/taoworld-catalog.php';
require_once $fixture.'/server/search-query.php';
$_SERVER['REMOTE_ADDR']='192.0.2.160';
$intent=fn(string $q,?callable $resolve=null)=>search_query_intent($q,$resolve??fn()=>null);
foreach(['https://item.taobao.com/item.htm?spm=a1z10&id=701556726681&ns=1','https://detail.tmall.com/item.htm?abbucket=3&id=701556726681','https://m.intl.taobao.com/detail/detail.html?id=701556726681',
    'https://world.taobao.com/item/701556726681.htm','https://a.m.taobao.com/i701556726681.htm','701556726681','tb-701556726681',' 701556726681 ','Энийг аваач https://item.taobao.com/item.htm?id=701556726681'] as $q)
    check(array_intersect_key($intent($q),['type'=>1,'id'=>1])===['type'=>'product','id'=>'tb-701556726681'],'Product intent for '.$q);
check($intent('【淘宝】https://m.tb.cn/h.TEST123?tk=x 「收纳盒 大号」',fn($u)=>str_starts_with($u,'https://m.tb.cn/h.TEST123')?'701556726681':null)===['type'=>'product','id'=>'tb-701556726681','title'=>'收纳盒 大号'],'Short link resolves to the item and keeps its title');
check($intent('https://item.taobao.com/item.htm?id=701556726681')['title']===''&&$intent('Uniclo цамц https://item.taobao.com/item.htm?id=701556726681')['title']==='uniqlo цамц','Text around a link becomes a normalised title');
check($intent('【淘宝】https://m.tb.cn/h.TEST123 「收纳盒 大号」')===['type'=>'search','q'=>'收纳盒 大号'],'Unresolved share text searches its title');
check($intent('https://example.com/page')===['type'=>'empty'],'A bare unrelated link is not searched');
check($intent('  UNICLO   Цамц ')===['type'=>'search','q'=>'uniqlo цамц'],'Brand typo, spacing and case');
check($intent('найк гутал')['q']==='nike гутал'&&$intent('сяоми watch')['q']==='xiaomi watch'&&$intent('the north face')['q']==='the north face','Transliterated brands');
check($intent('зарах ширээ')['q']==='зарах ширээ'&&$intent('малгай')['q']==='малгай','Aliases only replace whole words; Mongolian words pass through');
check($intent('12345')===['type'=>'search','q'=>'12345'],'Short numbers are ordinary searches');
check(search_resolve_short_link('https://m.tb.cn/h.TEST123')===null,'Short links are not fetched when supplier network is disabled');

// Catalog search: a product seen in a recent search opens directly; page 2 is empty.
supplier_search(['q'=>'link fixture warmup','page'=>1,'limit'=>12],true);
$r=supplier_search(['q'=>'https://item.taobao.com/item.htm?id=700000000000','page'=>1,'limit'=>12],true);
check($r['redirect']==='/v/tb-700000000000'&&count($r['products'])===1&&$r['products'][0]['id']==='tb-700000000000'&&!$r['more'],'Known product link returns the product and a redirect');
check(supplier_search(['q'=>'700000000000','page'=>2,'limit'=>12],true)['products']===[],'Later pages of a product link are empty');
// TaoWorld needs a search-issued mi_id: an unseen product without a title explains what to do.
$u=supplier_search(['q'=>'https://item.taobao.com/item.htm?id=711111111111','page'=>1,'limit'=>12],true);
check($u['products']===[]&&!isset($u['redirect'])&&str_contains($u['notice'],'нэр эсвэл зургаар'),'Unseen product without a title gives guidance');
// An unseen product with a share title is searched by name and opens when it is among the results.
unlink(tw_catalog_dir().'/item-700000000005.json');
$f=supplier_search(['q'=>'【淘宝】https://item.taobao.com/item.htm?id=700000000005 「Storage box」','page'=>1,'limit'=>12],true);
check(($f['redirect']??'')==='/v/tb-700000000005'&&count($f['products'])>1,'Unseen product found by its title opens directly');
$n=supplier_search(['q'=>'https://item.taobao.com/item.htm?id=799999999999 「Storage box」','page'=>1,'limit'=>12],true);
check(!isset($n['redirect'])&&count($n['products'])>0&&str_contains($n['notice'],'Ижил нэртэй'),'Otherwise products with the same name are shown');
// Normalised text reaches TaoWorld once for equivalent spellings.
$before=count($calls);supplier_search(['q'=>'  UNICLO  T-Shirt','page'=>1,'limit'=>12],true);supplier_search(['q'=>'uniqlo t-shirt','page'=>1,'limit'=>12],true);
$search=array_values(array_filter(array_slice($calls,$before),fn($c)=>$c[0]==='/traffic/item/search'));
check(count($search)===1&&$search[0][1]['keyword']==='uniqlo t-shirt','Equivalent searches share one normalised provider call');
echo "PASS search: Taobao/Tmall links, share texts and item numbers open products, brand aliases, normalised cache keys, Mongolian passthrough, unknown items.\n";
