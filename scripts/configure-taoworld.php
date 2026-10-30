<?php
declare(strict_types=1);
// CLI-only importer. Credential values never appear in stdout or command arguments.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$source=$argv[1]??dirname(__DIR__).'/open taobao keys.txt';
$text=@file_get_contents($source);if($text===false){fwrite(STDERR,"Credential file unavailable.\n");exit(1);}
$values=[];
foreach(['app_key'=>'key','app_secret'=>'secret'] as $name=>$label){
    if(!preg_match('/^\s*app[ _-]*'.$label.'\s*[:=]\s*([A-Za-z0-9]+)\s*$/mi',$text,$m)){fwrite(STDERR,"Credential file format invalid.\n");exit(1);}
    $values[$name]=$m[1];
}
if(strlen($values['app_key'])<4||strlen($values['app_key'])>64||strlen($values['app_secret'])<16||strlen($values['app_secret'])>128){fwrite(STDERR,"Credential format invalid.\n");exit(1);}
$values['callback_url']='https://gostore.mn/api/taoworld/callback.php';
$target=dirname(__DIR__).'/server/taoworld.local.php';
if(is_file($target)){fwrite(STDERR,"Configuration already exists; review before replacing.\n");exit(1);}
$h=fopen($target,'x');if(!$h){fwrite(STDERR,"Cannot create private configuration.\n");exit(1);}
chmod($target,0600);$body="<?php\nreturn ".var_export($values,true).";\n";
if(fwrite($h,$body)!==strlen($body)){fclose($h);fwrite(STDERR,"Configuration write failed.\n");exit(1);}fclose($h);
echo "TaoWorld credentials installed in ignored server configuration.\n";
