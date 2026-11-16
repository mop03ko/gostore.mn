'use strict';
(() => {
  let active=null;
  /** Resolves {challenge, phone} only after our backend independently observes VERIFIED, else false.
   *  purpose: verify (default), register, reset or link (the latter three let the session set a PIN). */
  window.verifyPhone=function verifyPhone(phone,purpose='verify'){
    if(active)return Promise.resolve(false);
    let finish;
    const promise=new Promise(resolve=>{finish=resolve;});
    active=promise;
    const dialog=document.createElement('dialog');
    dialog.className='phone-verification-dialog';
    dialog.setAttribute('aria-labelledby','phone-verification-title');
    dialog.innerHTML='<h2 id="phone-verification-title">Утас баталгаажуулах</h2><p data-instruction aria-live="polite">Түр хүлээнэ үү…</p><p data-phone></p><div data-sms hidden><p>Илгээх дугаар: <strong>144773</strong></p><p>SMS текст: <strong data-text></strong></p><a class="button blue" data-sms-link>SMS нээх</a><p>Энэ дугаартай SIM-ээс SMS-ээ өөрөө илгээнэ үү. Операторын SMS төлбөр үйлчилж болно.</p><p>Баталгаажуулахын тулд утасны дугаар verify.mn үйлчилгээнд дамжина.</p></div><p data-status role="status"></p><p data-time></p><button type="button" class="button outline" data-cancel>Болих</button>';
    document.body.append(dialog);dialog.showModal();
    const otpForm=document.createElement('form');otpForm.hidden=true;otpForm.innerHTML='<label class="field">6 оронтой SMS код<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="button blue" type="submit">Код баталгаажуулах</button><p>Код 5 минут хүчинтэй. Кодоо бусдад бүү дамжуулаарай.</p>';dialog.querySelector('[data-status]').before(otpForm);
    let done=false,timer,clock,deadline=Date.now()+300000,challenge,verifiedPhone='';
    const status=dialog.querySelector('[data-status]');
    const end=value=>{if(done)return;done=true;clearTimeout(timer);clearInterval(clock);dialog.close();dialog.remove();active=null;window.removeEventListener('pagehide',cancel);finish(value);};
    const cancel=()=>end(false);
    dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
    dialog.addEventListener('close',cancel);
    dialog.querySelector('[data-cancel]').addEventListener('click',cancel);
    window.addEventListener('pagehide',cancel);
    clock=setInterval(()=>{
      if(Date.now()>=deadline){window.toast?.('Баталгаажуулах хугацаа дууслаа. Дахин оролдоно уу.');end(false);return;}
      dialog.querySelector('[data-time]').textContent=challenge?'Үлдсэн хугацаа: '+Math.ceil((deadline-Date.now())/1000)+' сек':'';
    },250);
    const poll=async()=>{
      if(done)return;
      try{
        const r=await shopApi('phone-verification-status',{challenge});
        if(done)return;
        if(Date.now()>=deadline||r.sessionStatus==='EXPIRED'){end(false);return;}
        if(r.sessionStatus==='VERIFIED'){end({challenge,phone:verifiedPhone});return;}
        if(r.sessionStatus!=='PENDING'){end(false);return;}
        status.textContent='Таны SMS-ийг хүлээж байна…';
      }catch{if(done)return;status.textContent='Холболтыг дахин шалгаж байна…';}
      if(!done)timer=setTimeout(poll,3000);
    };
    otpForm.addEventListener('submit',async e=>{
      e.preventDefault();if(done)return;
      const button=otpForm.querySelector('button'),code=otpForm.elements.code.value;button.disabled=true;
      try{
        const r=await shopApi('phone-verification-status',{challenge,code});if(done)return;
        if(r.sessionStatus==='VERIFIED'&&Date.now()<deadline){end({challenge,phone:verifiedPhone});return;}
        if(r.sessionStatus==='EXPIRED'){window.toast?.('Кодын хугацаа дууссан. Дахин код авна уу.');end(false);return;}
        status.textContent='Кодыг шалгаж чадсангүй. Дахин оролдоно уу.';
      }catch(e){if(!done)status.textContent=e.message||'Кодыг шалгаж чадсангүй.';}
      finally{if(!done)button.disabled=false;}
    });
    (async()=>{
      try{
        const config=await shopApi('phone-verification-config'); // Obtain this session's CSRF token.
        if(!config.enabled)throw Error('Утас баталгаажуулах үйлчилгээ түр боломжгүй.');
        if(done)return;
        const r=await shopApi('phone-verification-start',{phone,purpose,...(config.sms_otp_enabled?{delivery:'otp'}:{})});
        if(done)return;
        if(typeof r.challenge!=='string'||!Number.isFinite(r.remainingSeconds)||r.remainingSeconds<=0||(r.delivery!=='otp'&&!/^sms:144773\?body=/.test(r.smsUri)))throw Error('Баталгаажуулалт эхэлсэнгүй.');
        challenge=r.challenge;verifiedPhone=r.phone;deadline=Date.now()+Math.min(300,r.remainingSeconds)*1000;
        dialog.querySelector('[data-instruction]').textContent=r.displayInstruction;
        dialog.querySelector('[data-phone]').textContent='Утас: '+r.phone;
        if(r.delivery==='otp'){
          otpForm.hidden=false;otpForm.elements.code.focus();
          status.textContent=r.deliveryUncertain?'Илгээлтийн хариу хүлээгдэж байна. Код ирвэл оруулна уу.':'Таны утсанд ирэх кодыг оруулна уу. Утасны дугаарыг SendSMS.mn-д дамжуулна.';
          return;
        }
        dialog.querySelector('[data-text]').textContent=r.text;
        dialog.querySelector('[data-sms-link]').href=r.smsUri;
        dialog.querySelector('[data-sms]').hidden=false;
        status.textContent='SMS нээгээд илгээх товчийг дарна уу.';
        timer=setTimeout(poll,3000);
      }catch(e){if(!done){window.toast?.(e.message||'Баталгаажуулалт эхэлсэнгүй.');end(false);}}
    })();
    return promise;
  };
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-verify-phone]');if(!button)return;
    const input=button.closest('form')?.querySelector('[name="phone"]');if(!input)return;
    const phone=input.value;button.disabled=true;
    try{const ok=await window.verifyPhone(phone);if(button.isConnected&&input.value===phone)button.textContent=ok?'Утас баталгаажлаа':'Утас баталгаажуулах';}
    finally{button.disabled=false;}
  });
  document.addEventListener('input',e=>{
    if(e.target.name==='phone'){const button=e.target.closest('form')?.querySelector('[data-verify-phone]');if(button)button.textContent='Утас баталгаажуулах';}
  });
})();
