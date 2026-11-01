/* خيارات إضافية للأسئلة والمواضيع والترتيب (مراجعة الخطوة 3) */
const TYPE_AR={lesson:'عنوان درس',part:'عنوان جزء',section:'عنوان مجموعة أمثلة',practice:'شريط تمارين',instruction:'تعليمات (سطر أحمر)',text:'فقرة نص حرة',goals:'أهداف',points:'نقاط',keyconcept:'مفهوم أساسي',spacer:'مسافة فارغة',pagebreak:'فاصل صفحة'};
function itemSummary(it){return it.title||it.text||it.heading||it.label||(it.items||[]).join(' / ')||it.examples||'';}
async function editItem(idx){
  const it=S.plan.items[idx];if(!it||it.type==='question'&&false)return;
  if(it.type==='question'){const v=await K.ask('نص السؤال (يُستخدم عند اختيار «نص السؤال داخل مربع»)',it.text||'',true);if(v!=null){it.text=v;renderReview();}return;}
  if(it.type==='solved'){
    const a=await K.ask('عنوان المثال',it.label||'');if(a==null)return;it.label=a;
    const b=await K.ask('نص المسألة',it.text||'',true);if(b!=null)it.text=b;
    const c=await K.ask('الحل (كل خطوة في سطر)',it.solution||'',true);if(c!=null)it.solution=c;renderReview();return;}
  if(it.type==='spacer'){const v=await K.ask('ارتفاع المسافة (twips)',String(it.size||300));if(v!=null){it.size=Math.max(0,parseInt(v)||0);renderReview();}return;}
  if(it.type==='goals'||it.type==='points'||it.type==='keyconcept'){
    if(it.type!=='goals'){const t=await K.ask('العنوان',it.title||'');if(t==null)return;it.title=t;}
    if(it.type==='keyconcept'){const v=await K.ask('الصفوف: كل صف في سطر بالشكل  المصطلح | الشرح',(it.rows||[]).map(r=>[].concat(r).join(' | ')).join('\n'),true);if(v!=null)it.rows=v.split('\n').filter(l=>l.trim()).map(l=>l.split('|').map(s=>s.trim()));}
    else{const v=await K.ask('البنود: كل بند في سطر',(it.items||[]).join('\n'),true);if(v!=null)it.items=v.split('\n').map(s=>s.trim()).filter(Boolean);}
    renderReview();return;}
  if(it.type==='practice'||it.type==='section'){
    const e=await K.ask('الأمثلة (مثل Examples 1 through 4)',it.examples||'');if(e==null)return;it.examples=e;
    const t=await K.ask('المواضيع: كل موضوع في سطر',(it.topics||[]).join('\n'),true);if(t!=null)it.topics=t.split('\n').map(s=>s.trim()).filter(Boolean);renderReview();return;}
  const k=it.title!=null?'title':'text';const v=await K.ask('تعديل النص',it[k]||'',true);if(v!=null){it[k]=v;renderReview();}
}
async function addItem(){
  const t=$('addType').value,pos=parseInt($('addPos').value),a=S.plan.items;if(!S.plan)return;
  const it={type:t};
  if(t==='pagebreak'){}else if(t==='spacer')it.size=300;
  else if(t==='goals'||t==='points'){const v=await K.ask('البنود: كل بند في سطر','',true);if(!v)return;it.items=v.split('\n').map(s=>s.trim()).filter(Boolean);if(t==='points')it.title='';}
  else if(t==='keyconcept'){const ti=await K.ask('العنوان','Key Concept');if(ti==null)return;it.title=ti;const v=await K.ask('الصفوف: المصطلح | الشرح (كل صف في سطر)','',true);if(!v)return;it.rows=v.split('\n').filter(l=>l.trim()).map(l=>l.split('|').map(s=>s.trim()));}
  else if(t==='practice'||t==='section'){const e=await K.ask('الأمثلة (مثل Example 5)','');if(e==null)return;it.examples=e;const v=await K.ask('المواضيع: كل موضوع في سطر','',true);it.topics=(v||'').split('\n').map(s=>s.trim()).filter(Boolean);}
  else{const v=await K.ask(TYPE_AR[t]+' — اكتب النص','',true);if(!v)return;if(t==='text'||t==='instruction')it.text=v;else it.title=v;}
  a.splice(pos>=1?Math.min(pos,a.length+1)-1:a.length,0,it);renderReview();K.toast('تمت الإضافة');
}
function bulkQ(){
  const a=S.plan.items.filter(i=>i.type==='question'),c=$('bkCols').value,an=$('bkAns').value,ln=$('bkLines').value,bd=$('bkBadge').value;
  a.forEach(q=>{if(c)q.cols=+c;if(an)q.answer=an;if(ln!=='')q.lines=+ln;if(bd)q.badge=bd;});renderReview();K.toast('تم التطبيق على '+a.length+' سؤال');}
function reorder(fn){const a=S.plan.items;fn(a);renderReview();}
const NUMV=q=>{const m=String(q.num||'').match(/\d+/);return m?+m[0]:1e9;};
function wireExtras(){
  const on=(id,f)=>{$(id).onclick=()=>{if(!S.plan)return K.toast('لا توجد عناصر بعد');f();};};
  $('addType').innerHTML=Object.keys(TYPE_AR).map(k=>`<option value="${k}">${TYPE_AR[k]}</option>`).join('');
  $('bkAns').innerHTML='<option value="">الإجابة: بدون تغيير</option>'+ANSWERS.map(a=>`<option value="${a}">${ANS_AR[a]||a}</option>`).join('');
  on('addBtn',addItem);on('bkBtn',bulkQ);
  on('revAll',()=>reorder(a=>a.reverse()));
  on('qFirst',()=>reorder(a=>{const s=a.filter(x=>x.type!=='question'&&x.type!=='solved'),q=a.filter(x=>x.type==='question'),e=a.filter(x=>x.type==='solved');a.splice(0,a.length,...s,...q,...e);}));
  on('exFirst',()=>reorder(a=>{const e=a.filter(x=>x.type==='solved'),r=a.filter(x=>x.type!=='solved');a.splice(0,a.length,...e,...r);}));
  on('exLast',()=>reorder(a=>{const e=a.filter(x=>x.type==='solved'),r=a.filter(x=>x.type!=='solved');a.splice(0,a.length,...r,...e);}));
  on('byPage',()=>reorder(a=>{const k=a.map((x,i)=>({x,i,p:+x.pdfPage||0})),f=k.filter(z=>z.p);let last=0;k.forEach(z=>{if(z.p)last=z.p;else z.p=last;});k.sort((u,v)=>u.p-v.p||u.i-v.i);a.splice(0,a.length,...k.map(z=>z.x));}));
  on('byNumDesc',()=>reorder(a=>{let i=0;while(i<a.length){if(a[i].type!=='question'){i++;continue;}let j=i;while(j<a.length&&a[j].type==='question')j++;const seg=a.slice(i,j).sort((x,y)=>NUMV(y)-NUMV(x));a.splice(i,j-i,...seg);i=j;}}));
  on('allByNum',()=>reorder(a=>{const q=a.filter(x=>x.type==='question').sort((x,y)=>NUMV(x)-NUMV(y));let k=0;for(let i=0;i<a.length;i++)if(a[i].type==='question')a[i]=q[k++];}));
  on('dedupe',()=>reorder(a=>{const seen=new Set();for(let i=0;i<a.length;i++){const x=a[i];if(x.type!=='question')continue;const key=x.num+'|'+x.pdfPage;if(seen.has(key))a.splice(i--,1);else seen.add(key);}}));
}
