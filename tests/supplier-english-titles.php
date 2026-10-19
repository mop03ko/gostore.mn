<?php
declare(strict_types=1);
// Synthetic bilingual caches only. Never contacts OT or uses a real API key.
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
$dataDir=dirname(__DIR__).'/tmp/gostore-title-test-'.bin2hex(random_bytes(8));
mkdir($dataDir.'/supplier-cache',0700,true);
class ApiError extends RuntimeException {}
function fail(string $message,int $code=400): never {throw new ApiError($message,$code);}
function config(): array {global $dataDir;return ['data_dir'=>$dataDir,'otcommerce'=>['api_key'=>'synthetic-test-key']];}
function shipping_settings(): array {return ['catalog_language'=>'mn','cny_rate'=>550,'supplier_enabled'=>true,'api_daily_limit'=>40];}
function shipping_public(): array {return shipping_settings();}
$networkAttempts=0;
function limit_attempts(...$args): void {global $networkAttempts;$networkAttempts++;throw new ApiError('Network is forbidden in this test',429);}
function db(): never {global $networkAttempts;$networkAttempts++;throw new ApiError('Network budget is forbidden in this test',429);}
require_once __DIR__.'/../server/supplier.php';
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function seed(string $path,array $query,array $data): array {
    $cache=['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false];
    file_put_contents(config()['data_dir'].'/supplier-cache/'.supplier_cache_key($path,$query).'.json',json_encode($cache,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    return $cache;
}
try {
    $item=['Id'=>'123456789','ProviderType'=>'Taobao','Title'=>'Монгол барааны нэр','OriginalTitle'=>'中文原名','Description'=>'Монгол тайлбар','IsSellAllowed'=>true,
        'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY'],'MasterQuantity'=>20,
        'Attributes'=>[['Pid'=>'color','Vid'=>'blue','PropertyName'=>'Өнгө','Value'=>'Цэнхэр']],
        'ConfiguredItems'=>[['Id'=>'blue','Quantity'=>20,'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY'],'Configurators'=>[['Pid'=>'color','Vid'=>'blue']]]]];
    $english=array_replace($item,['Title'=>'Canvas Backpack','Description'=>'English description','Price'=>['OriginalPrice'=>999,'OriginalCurrencyCode'=>'USD'],'Attributes'=>[['Pid'=>'color','Vid'=>'blue','PropertyName'=>'Color','Value'=>'Blue']]]);
    $path='/v1/taobao/product/123456789';
    $base=seed($path,['language'=>'mn'],['Item'=>$item,'RootPath'=>['Content'=>[['Name'=>'Монгол ангилал']]]]);
    seed($path,['language'=>'en'],['Item'=>$english,'RootPath'=>['Content'=>[['Name'=>'English category']]]]);
    $actual=supplier_request($path,['language'=>'mn'],true);$expected=$base;$expected['data']['Item']['Title']='Canvas Backpack';
    check($actual===$expected,'Only the raw product Title may change');
    $original=supplier_normalize($item,true,'taobao');$detail=supplier_detail('tb-123456789')['product'];
    check($detail['name']==='Canvas Backpack','Detail name is English');
    foreach(['description','attributes','variants','cny','mnt','original_name','stock','url'] as $key)check($detail[$key]===$original[$key],$key.' must stay unchanged');
    check($detail['category_path']===['Монгол ангилал'],'Category labels stay Mongolian');
    $card=supplier_card_price(['id'=>'tb-123456789','name'=>'Хуучин нэр','cny'=>null],time()+3600);
    check($card['name']==='Canvas Backpack','Old snapshot cards pick up cached English names');
    $cachedBefore=$networkAttempts;supplier_request($path,['language'=>'mn'],true);
    check($networkAttempts===$cachedBefore,'Repeated browsing reuses translated names');
    check(supplier_title_read('abb-123456789')===null,'Provider namespaces must stay separate');
    check(supplier_title_read('../123456789')===null,'Invalid IDs cannot select cache paths');
    check(supplier_title_text('English Монгол')===null&&supplier_title_text('中文')===null,'Provider language fallback is not cached as English');

    $second=array_replace($item,['Id'=>'987654321']);$third=array_replace($item,['Id'=>'222222222']);
    $query=['language'=>'mn','item_title'=>'bag','page'=>1,'limit'=>12,'sort'=>'default'];
    $searchPath='/v1/taobao/search';$search=seed($searchPath,$query,['Items'=>['Items'=>['Content'=>[$second,$third],'TotalCount'=>2]]]);
    seed($searchPath,array_replace($query,['language'=>'en']),['Items'=>['Items'=>['Content'=>[array_replace($english,['Id'=>'999999999','Title'=>'Unrelated item']),array_replace($english,['Id'=>'987654321','Title'=>'Travel Backpack'])]]]]);
    $translated=supplier_request($searchPath,$query,true);$search['data']['Items']['Items']['Content'][0]['Title']='Travel Backpack';
    check($translated===$search,'Search titles join by ID, never by result order');
    check(supplier_title_read('tb-999999999')===null,'Unrelated English results are ignored');

    $native='/service-json/BatchGetItemFullInfo';$nativeQuery=['language'=>'mn','itemId'=>'987654321','blockList'=>'Vendor,MostPopularVendorItems16'];
    $nativeBase=seed($native,$nativeQuery,['Item'=>$second,'Vendor'=>['Title'=>'Vendor untouched'],'VendorItems'=>['Content'=>[$item]],'RecommendedItems'=>['Content'=>[$item]]]);
    $nativeResult=supplier_request($native,$nativeQuery);$nativeBase['data']['Item']['Title']='Travel Backpack';
    $nativeBase['data']['VendorItems']['Content'][0]['Title']='Canvas Backpack';$nativeBase['data']['RecommendedItems']['Content'][0]['Title']='Canvas Backpack';
    check($nativeResult===$nativeBase,'Brand and related names reuse title cache without another API request');

    $missingPath='/v1/taobao/product/222222222';$missing=seed($missingPath,['language'=>'mn'],['Item'=>$third]);
    $before=$networkAttempts;
    check(supplier_request($missingPath,['language'=>'mn'])===$missing,'Checkout preserves the original name when translation is uncached');
    check($networkAttempts===$before,'Checkout never requests an uncached English title');
    check(supplier_request($missingPath,['language'=>'mn'],true)===$missing,'Translation quota/failure preserves original browsing data');
    check($networkAttempts===$before+1,'Browsing attempts at most one translation request');
    $legacy=array_replace($item,['Id'=>'abb-123456789','ProviderType'=>'Alibaba1688']);
    $legacyPath='/v1/alibaba1688/product/123456789';$legacyBase=seed($legacyPath,['language'=>'mn'],['Item'=>$legacy]);
    seed($legacyPath,['language'=>'en'],['Item'=>array_replace($legacy,['Title'=>'Factory Backpack'])]);
    $legacyBase['data']['Item']['Title']='Factory Backpack';
    check(supplier_request($legacyPath,['language'=>'mn'],true)===$legacyBase,'1688 titles translate in their own provider namespace');
    check(supplier_title_read('tb-123456789')==='Canvas Backpack'&&supplier_title_read('abb-123456789')==='Factory Backpack','Identical numeric IDs never cross providers');
    check(supplier_title_id(['Id'=>'123456789','ProviderType'=>'Alibaba1688'],'Taobao')===null,'A mismatched provider cannot override a name');
    $expiredFile=supplier_title_file('tb-333333333');
    file_put_contents($expiredFile,json_encode(['title'=>'Expired translation','expires'=>time()-1]));
    check(supplier_title_read('tb-333333333')===null,'Expired title is not reused');
    file_put_contents($expiredFile,'{broken');check(supplier_title_read('tb-333333333')===null,'Corrupt title cache falls back safely');
    echo "PASS: English-only names; unchanged descriptions, SKUs, categories and prices; ID joins; snapshot reuse; quota fallback; no checkout translation requests.\n";
} finally {
    // Delete only this test's randomly created temporary directory.
    foreach(['supplier-cache','supplier-titles'] as $folder){foreach(glob($dataDir.'/'.$folder.'/*')?:[] as $file)unlink($file);if(is_dir($dataDir.'/'.$folder))rmdir($dataDir.'/'.$folder);}
    rmdir($dataDir);
}
