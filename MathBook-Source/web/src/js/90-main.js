/* التشغيل: ربط الإضافات + زر الرجوع */
wireExtras();
(function(){
  var last=0;
  K.native.on('back',function(){
    var m=document.querySelector('.modal.open');
    if(m){m.classList.remove('open');return;}
    if(curStep>1){showStep(curStep-1);return;}
    var now=Date.now();
    if(now-last<2000){K.native.call('exitApp',{}).catch(function(){});return;}
    last=now;K.toast('اضغط رجوع مرة أخرى للخروج (بياناتك محفوظة)');
  });
  K.native.on('resume',function(){saveNow();});
})();
