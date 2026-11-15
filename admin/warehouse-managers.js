'use strict';
function warehouseManagerList(location,account){
  const rows=account.managers||[],owner=data.admin?.role==='owner';
  return `<section class="warehouse-managers" aria-label="Агуулахын менежерүүд"><div class="warehouse-managers-heading"><h3>Менежерүүд <span class="tag">${rows.length}</span></h3>${owner?`<button type="button" class="quiet" data-manager-add="${esc(location)}">＋ Менежер нэмэх</button>`:''}</div><p class="muted">Тусдаа нэвтрэх эрхтэй. Энэ агуулахын захиалга, багцыг удирдана.</p>${rows.length?`<ul>${rows.map(a=>`<li><div><strong>${esc(a.name||'Агуулахын менежер')}</strong><span>${esc(a.email)}</span><small class="tag ${a.enabled?'green':'gray'}">${a.enabled?'Идэвхтэй':'Эрх хаасан'}${a.id==='primary'?' · Үндсэн':''}</small></div>${owner?`<button type="button" class="quiet" data-manager-edit="${esc(a.id)}" data-manager-location="${esc(location)}" aria-label="${esc(a.email)} эрх засах">Засах</button>`:''}</li>`).join('')}</ul>`:'<p class="empty">Менежер бүртгээгүй байна.</p>'}</section>`;
}
function warehouseManagerOpen(location,id){
  if(data.admin?.role!=='owner')return;
  const profile=data.warehouse_profiles[location];if(!profile)return;
  const manager=id?(data.warehouse_accounts[location]?.managers||[]).find(a=>a.id===id):null;
  if(id&&!manager)return;
  const a=manager||{id:'new',name:'',email:'',enabled:true,configured:false};
  $('#editor-title').textContent=manager?'Менежерийн эрх засах':'Менежер нэмэх';
  $('#editor-body').innerHTML=`<form id="warehouse-manager-form" data-warehouse-account="${esc(location)}"><input type="hidden" name="manager_id" value="${esc(a.id)}"><p class="note"><strong>${esc(profile.name)}</strong><br>Энэ агуулахын эрхээр нэвтэрнэ. Админын эрх олгохгүй.</p><label>Менежерийн нэр<input name="name" maxlength="100" autocomplete="off" value="${esc(a.name)}" required></label><label>Нэвтрэх имэйл<input name="email" type="email" maxlength="200" autocomplete="off" value="${esc(a.email)}" required></label><label>${manager?'Шинэ нууц үг · солих бол':'Анхны нууц үг'}<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" ${manager?'':'required'}><small>${manager?'Хоосон үлдээвэл нууц үг өөрчлөгдөхгүй.':'12–72 байт урттай нууц үг оруулна уу.'}</small></label><label class="check"><input type="checkbox" name="enabled" ${a.enabled?'checked':''}>Нэвтрэх эрх идэвхтэй</label><p class="muted">Хадгалахад зөвхөн энэ менежерийн нэвтрэлт, push эрх шинэчлэгдэнэ. Бусад менежер ажилласаар байна.</p><p class="error" role="alert"></p><button class="primary" type="submit">${manager?'Эрх хадгалах':'Менежер нэмэх'}</button></form>`;
  $('#editor').showModal();$('#warehouse-manager-form [name=name]').focus();
}
document.addEventListener('click',event=>{
  const add=event.target.closest('[data-manager-add]'),edit=event.target.closest('[data-manager-edit]');
  if(add)warehouseManagerOpen(add.dataset.managerAdd);
  if(edit)warehouseManagerOpen(edit.dataset.managerLocation,edit.dataset.managerEdit);
});
