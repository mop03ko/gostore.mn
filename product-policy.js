'use strict';
// Display guard for old favorites/carts. The server independently enforces the policy.
window.productPolicyBlocked=value=>{
  if(value&&typeof value==='object'&&['820391759756','890435819512','969448181837','1076875933199','986957554392','964068539697','651837891440','589448620660'].includes(String(value.id??value.Id??'').replace(/^tb-/,'')))return true;
  const pattern=/(?<![\p{L}\p{N}])(?:knif\p{L}*|kniv\p{L}*|pocketknife\p{L}*|penknife\p{L}*|jackknife\p{L}*|switchblade\p{L}*|cleaver\p{L}*|dagger\p{L}*|machete\p{L}*|bayonet\p{L}*|sword\p{L}*|katana\p{L}*|scalpel\p{L}*|blade\p{L}*|box[\s-]*cutter\p{L}*|cutlery|whetstone\p{L}*|хутг\p{L}*|чинжаал\p{L}*|сэлэм\p{L}*|тонгорог\p{L}*|khutg\p{L}*|нож(?:и|ей|ом|ами|ах|а|у|ик\p{L}*|ны|евой|евые)?|клинок|кинжал\p{L}*)(?![\p{L}\p{N}])|刀|匕首/iu;
  const blocked=v=>typeof v==='string'?pattern.test(v.replace(/<[^>]*>/g,'').replace(/[\p{Cf}\u00AD]/gu,'')):Array.isArray(v)?v.some(blocked):v&&typeof v==='object'?Object.entries(v).some(([k,c])=>!/(?:url|image|picture|id|code)$/i.test(k)&&blocked(c)):false;
  if(typeof value==='string')return blocked(value);
  return ['name','original_name','description','category','category_path','attributes','variants','variant','label','offers'].some(k=>blocked(value?.[k]));
};
