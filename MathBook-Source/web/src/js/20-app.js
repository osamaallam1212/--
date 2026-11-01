pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([document.getElementById('pdfWorkerSrc').textContent],{type:'text/javascript'}));
const $=id=>document.getElementById(id);
const CONC=Math.max(1,Math.min(K.isMobile?2:4,Math.floor((navigator.hardwareConcurrency||4)/2)));
async function pmap(a,fn,c){const r=new Array(a.length);let i=0;await Promise.all(Array.from({length:Math.min(c,a.length)},async()=>{while(i<a.length){const k=i++;r[k]=await fn(a[k],k);}}));return r;}
const MAXPX=K.isMobile?14e6:36e6,AN_SC=K.isMobile?4:6;
const structuredCloneSafe=o=>{const c=v=>Array.isArray(v)?v.map(c):v&&typeof v==='object'&&!(v instanceof Blob)?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,c(x)])):v;return c(o);};
const S={pdf:null,name:'',md:'',plan:null,pageCache:{},items:{},RENDER_SCALE:6};

/* ───────── helpers ───────── */
function log(box,msg,cls=''){const d=document.createElement('div');d.className=cls;d.textContent=msg;$(box).appendChild(d);$(box).scrollTop=1e9;}
function prog(id,p){const e=$(id);e.style.display='block';e.firstElementChild.style.width=(p*100)+'%';}
let curStep=1;function showStep(n){curStep=n;if(typeof saveSoon==="function")saveSoon();[1,2,3].forEach(i=>{$('s'+i).style.display=i==n?'block':'none';});document.querySelectorAll('.step').forEach(b=>b.classList.toggle('active',b.dataset.s==n));}
document.querySelectorAll('.step').forEach(b=>b.onclick=()=>showStep(+b.dataset.s));
const esc=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const LRU=[];
async function renderPage(n,sc){ /* sc given = temporary analysis render (not cached); default = light 2x preview, LRU-cached */
  if(!sc&&S.pageCache[n])return S.pageCache[n];
  const page=await S.pdf.getPage(n),base=page.getViewport({scale:1}),vp=page.getViewport({scale:sc||2});
  const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx,viewport:vp}).promise;
  const o={n,canvas:c,wPt:base.width,hPt:base.height};
  if(!sc){S.pageCache[n]=o;LRU.push(n);while(LRU.length>6)delete S.pageCache[LRU.shift()];}
  return o;}
async function renderRegion(n,bb){ /* renders ONLY the crop, directly from the PDF vectors, at the chosen DPI (up to 1000) */
  const page=await S.pdf.getPage(n),base=page.getViewport({scale:1});
  let s=Math.min(1000,Math.max(72,+$('dpi').value||600))/72;
  const pw=Math.max(1,bb[2]*base.width),ph=Math.max(1,bb[3]*base.height);
  s=Math.min(s,Math.sqrt(MAXPX/(pw*ph)),16000/Math.max(pw,ph));
  const vp=page.getViewport({scale:s,offsetX:-bb[0]*base.width*s,offsetY:-bb[1]*base.height*s});
  const c=document.createElement('canvas');c.width=Math.max(4,Math.ceil(pw*s));c.height=Math.max(4,Math.ceil(ph*s));
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx,viewport:vp}).promise;return {c,s};}

/* ───────── Stage 1 ───────── */
const uz=$('uz');K.onReadProgress=(a,b)=>{$('uzSub').textContent='جاري قراءة الملف… '+Math.round(a/b*100)+'%';};
['dragenter','dragover'].forEach(e=>uz.addEventListener(e,ev=>{ev.preventDefault();uz.classList.add('drag')}));
['dragleave','drop'].forEach(e=>uz.addEventListener(e,()=>uz.classList.remove('drag')));
async function loadPdf(f){
  K.awake(true);try{
  S.name=f.name.replace(/\.pdf$/i,'');S.pageCache={};S.items={};for(const k in FIGC)delete FIGC[k];
  S.pdfFile=f;DB.set('pdf',f).catch(()=>{});S.pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;
  $('uzTitle').textContent='✅ '+f.name;$('uzSub').textContent=S.pdf.numPages+' صفحة';
  $('pTo').value=Math.min(S.pdf.numPages,10);$('pTo').max=$('pFrom').max=S.pdf.numPages;
  const m=S.name.match(/Module_?(\d+)_?(.*)/i);
  if(m){$('mTitle').value='Integrated I Module '+m[1];$('mSub').value=m[2].replace(/_/g,' ');}
  $('genMd').disabled=false;log('log1','Loaded: '+f.name+' ('+S.pdf.numPages+' pages)','ok');saveSoon();
  }catch(e){log('log1','تعذر فتح الملف: '+e.message,'err');}finally{K.awake(false);}}
uz.onclick=async()=>{try{const r=await K.pick('pdf');if(r&&r[0])await loadPdf(new File([r[0].blob],r[0].name,{type:'application/pdf'}));}catch(e){log('log1','تعذر اختيار الملف: '+e.message,'err');}};
uz.addEventListener('drop',async ev=>{ev.preventDefault();const f=ev.dataTransfer&&ev.dataTransfer.files[0];if(f&&/\.pdf$/i.test(f.name))await loadPdf(f);});

async function pageLines(n){
  const page=await S.pdf.getPage(n);const vp=page.getViewport({scale:1});
  const tc=await page.getTextContent();const rows=[];
  for(const it of tc.items){if(!it.str.trim())continue;
    const [px,py]=vp.convertToViewportPoint(it.transform[4],it.transform[5]),x=px/vp.width,y=py/vp.height;
    let r=rows.find(r=>Math.abs(r.y-y)<0.006);
    if(!r){r={y,parts:[]};rows.push(r);}r.parts.push({x,s:it.str});}
  rows.sort((a,b)=>a.y-b.y);
  return rows.map(r=>{r.parts.sort((a,b)=>a.x-b.x);
    return `[x=${r.parts[0].x.toFixed(3)} y=${r.y.toFixed(3)}] `+r.parts.map(p=>p.s).join(' ').replace(/\s+/g,' ');});
}

function buildPrompt(pagesTxt){
  const from=+$('pFrom').value,to=+$('pTo').value,off=+$('pOff').value;
  const TXT=$('qMode').value==='text';
  return `# FINAL TASK — return the JSON plan (do NOT write another prompt)
Book file: ${S.name}.pdf — PDF pages ${from} to ${to} (book page = PDF page ${off>=0?'+':''}${off})
Module: ${$('mTitle').value} — ${$('mSub').value} — ${$('mGrade').value}
${$('extra').value.trim()?`\n## USER'S SPECIAL INSTRUCTIONS (HIGHEST PRIORITY — follow literally, including the order)\n${$('extra').value.trim()}\n`:''}

You are attached the book PDF and below is the text of every page with coordinates.
Your reply is read directly by a computer program. Therefore:
- Reply with ONE \`\`\`json code block and NOTHING else.
- Do NOT write instructions, a prompt, a plan description, or questions to me. Do the work now.
- Do NOT stop early: include EVERY practice/exercise question in pages ${from}–${to}, in book order.

## JSON shape
{"module":{"title":"...","subtitle":"...","grade":"..."},"items":[ ...items in document order... ]}

### Item types
- {"type":"lesson","title":"Lesson 4-1   Graphing Linear Functions"}
- {"type":"goals","items":["Graph linear functions by making tables of values."]}
- {"type":"keyconcept","title":"Key Concept • Intercepts","rows":[["x-intercept","Let y = 0 and solve for x."]]}   (short teacher summaries)
- {"type":"practice","examples":"Examples 1 through 4","topics":["Graph by Make a Table","Graph y = a"]}   (once per lesson, before its exercises)
- {"type":"section","examples":"Example 5","topics":["Graph by Using Intercepts"]}   (when the book starts a new Example group / "Mixed Exercises")
- {"type":"instruction","text":"Graph each equation by making a table."}   (the red direction line shared by the next questions)
- {"type":"question","num":"7","pdfPage":12,"bookPage":215,"cols":2,"answer":"table-graph","lines":0${TXT?',"text":"..."':''}}
- {"type":"pagebreak"}
- {"type":"solved","label":"Example 3","pdfPage":11,"bookPage":214,"bbox":[x,y,w,h],"solBbox":[x,y,w,h],"text":"...","solution":"...","figures":[...]}   (every worked example / solved question — see "Solved examples")

## ORDER (VERY IMPORTANT)
- The program prints the items in EXACTLY the order of the "items" array. It does not sort anything.
- If the user gave a required order (see USER'S SPECIAL INSTRUCTIONS: an exam structure, a list of examples then exercises, page numbers...), follow it literally, item by item. Never reorder by page number or by exercise number on your own, and never "improve" the order.
- Put every "solved" example at the exact position it must appear (for instance all examples first, in the user's sequence, then the exercises).
- Use {"type":"part","title":"..."} headings to separate big parts (e.g. "الجزء الأول: الأمثلة", "الجزء الثاني: الأسئلة").
- Do not skip and do not duplicate any item the user asked for.

## STYLE OPTIONS — choose freely so the file fits the book; everything is optional
Optional "module.options" (the user can override any of them inside the program):
{"direction":"book|rtl|ltr|para","labelLang":"ar|en","solvedPlacement":"ai|end-plan|end-book|start-plan","stepStyle":"rows|plain|boxes|flow|dots|compact|cols2","numbering":"numbers|letters|ar|none","splitParts":"yes|no","highlightLast":"yes|no","palette":"teal|blue|green|orange|purple|navy|red|grey","eqAlign":"start|center","figSide":"end|start","badge":"box|solid|outline|plain|none","lineStyle":"single|dotted|dashed","lineGap":"narrow|normal|wide","pageBorder":"yes|no","cover":"yes|no","labels":{"problem":"المسألة","solution":"الحل","page":"صفحة","example":"مثال","solvedTitle":"...","practice":"..."}}
Per-item options (add only what suits THAT item):
- question: "badge" (box|solid|outline|plain|none), "answer" also accepts "dots" (dotted lines), "space" (blank space), "box" (empty framed box), "graph2" (two coordinate planes); "lineStyle", "lineGap".
- solved: "stepStyle", "numbering", "color" (palette name), "layout":"stacked|side", "header":"bar|tag|line", "highlight":true|false, "splitParts":true|false, "showProblem":true|false, "showSolution":true|false, "note":"short remark shown under the solution".
- goals / points: "style" (classic|banner|checklist|cards|numbered|arrow|columns|minimal|ribbon|boxed), "color", "size" (font size in pt, 10–16), "heading". "points" = same as goals but for any list of points (rules, notes, steps): {"type":"points","title":"...","style":"boxed","items":["..."]}.
- keyconcept: "style" (table|list|cards|boxed), "color", "size".
- lesson: "style" (underline|banner|box|simple), "color". part: "style" (banner|underline|center), "color".
- section / practice: "style" (bar|line|pill), "color", "title" (extra text on the bar).
- instruction: "style" (plain|box), "color".
- text: {"type":"text","style":"plain|box|note|tip|warning","text":"...","color":"blue","size":12,"align":"center"} for any free paragraph.
- {"type":"spacer","size":300} adds vertical space (twips).
Use different styles where they help the student (variety between lessons/examples is welcome), but stay consistent inside one group of similar items.

## TEXT RULES FOR ARABIC / MIXED BOOKS
- Write every text in normal logical order exactly as printed. Never reverse Arabic, never add direction marks.
- Solved example "solution": ONE step per line (use \\n). Do NOT number the steps yourself (the program numbers them). One equation per line. When the example has sub-parts, start the first line of each sub-part with its label: "a. ..." / "b. ..." (letter + dot) — the program splits them automatically.
- Sub-parts of a problem text (a. b. c.) each on their own line.

### Goals styles (the box at the start of each lesson) — CHOOSE A STYLE FOR EVERY LESSON
Add "style", "color" and optionally "heading" to every goals item, e.g. {"type":"goals","style":"cards","color":"blue","heading":"Today's Goals","items":["..."]}.
style (pick the one that fits the lesson, and VARY it between lessons — do not use the same style for every lesson):
- "classic": red label on the left, numbered goals on the right (default, 1–4 goals)
- "banner": full-width coloured title bar with striped numbered rows (3–5 goals)
- "checklist": check-box list under an underlined title (procedural / "I can…" goals)
- "cards": goals as coloured cards, 3 per row, big numbers (4–6 short goals)
- "numbered": big number blocks beside each goal (2–5 goals of medium length)
- "arrow": arrow bullets under a title (short, light lessons)
- "columns": two columns of numbered goals (6+ short goals)
- "minimal": simple dot bullets (very short lesson / review)
- "ribbon": star title with a framed box (key / final lessons)
color: one of red, blue, green, orange, teal, navy, purple — match the topic or alternate between lessons.

### Figures (pictures the question needs) — VERY IMPORTANT
The program has ALREADY detected every picture (graph, diagram, photo, table drawing, number line, map…) on every page and gave each one a fixed ID. They are listed under "Detected pictures" for each page below: ID, position (x,y = top-left, w,h = size, 0–1 from the top-left of the page) and the text printed on/around it (its caption or labels).
Look at the attached PDF pages to see which picture belongs to which question, then:
- If a question refers to a picture / graph / diagram / table / "Figure 4" / "الشكل 4" / "shown" / "below" / "at the right" / "use the graph"… add "figures":["P12-F2"] using the ID(s) from the list. Use ONLY IDs that exist in the list. Never invent an ID.
- The picture may be on a DIFFERENT page than the question (next page, previous page, side column): search ALL listed pages; match it by its caption ("Figure 4", "الشكل 4", a title) and by what the question says.
- If one picture is split into several detected pieces, list all of their IDs.
- Several questions may share one picture: repeat the same ID in each of them.
- A question with NO picture gets no "figures" field (do not attach decorations, icons or pictures of other questions).
- ONLY if the needed picture is truly missing from the list, use the fallback object {"pdfPage":12,"name":"Figure 2","bbox":[x,y,w,h]} (bbox normalized 0–1 from the top-left, the picture only, without the question text).
- The picture is placed to the RIGHT of the question in Word. Never describe pictures in text.

#### HOW TO DECIDE THAT A QUESTION NEEDS A PICTURE — read every question word by word
Do NOT look only for the words "figure" or "picture". Before writing the JSON, go through the questions ONE BY ONE: read the whole question (its sub-parts a/b/c, its multiple-choice options and any sentence after it) AND look at the page image around it. A question needs "figures" when ANY of the following is true:
1. Its words point to something visual. Examples (not a complete list — think about the meaning, not only these words): figure, picture, photo, image, illustration, diagram, drawing, sketch, model, net, map, graph, plot, chart, table, number line, coordinate plane, grid, spinner, histogram, box plot, dot plot, line plot, Venn diagram, scale drawing, "shown", "shown below / above", "pictured", "at the right / left", "on the right / left", "below", "above", "in the figure", "in the diagram", "in the table", "the table shows", "the graph shows", "use the table / graph", "complete the table", "the data", "the shaded region", "the diagram at the right".
   Arabic words: شكل، الشكل، صورة، رسم، الرسم البياني، مخطط، جدول، الجدول، خط الأعداد، خريطة، المقابل، الموضح، الموضحة، المبين، المرسوم، أدناه، أعلاه، في الشكل، بالشكل، "كما في الشكل", "يوضح الجدول".
2. It talks about something that is NOT fully written in the question itself: labels such as "△ABC", "line ℓ", "points A and B", "angle 1" with no coordinates/values given, "this pattern", "the following", "the data" — then the picture that defines it is printed beside/under the question: find it in the list and attach it.
3. Its numbers or data exist only inside a table, graph or drawing printed next to it.
4. Even if the question text has NONE of these words, but the page image shows a picture, table, graph or drawing printed right next to, under or inside that question's area, attach it.
A "table" printed with data counts as a picture and must be attached too (it is not a blank answer table — a blank table the student must fill is the "answer" field).
Do NOT attach decorations, icons, lesson headers or pictures that belong to another question. When in doubt, look at the page image and decide from what you actually see.
- The same ID rules apply to "refFigures" and to the "figures" of solved examples.

### Questions that depend on a solved example or another question
If a question says e.g. "Refer to Example 2", "In Example 3, if the speed changes…", "Use your answer to Exercise 14", "Look back at Exercise 5":
- If the referenced item is a WORKED (solved) example, or a question that is NOT included as an exercise in this plan, add:
  "refLabel":"Example 2 (page 214)", "refText":"FULL text of that example's question exactly as printed (not its solution)", and "refFigures":["P11-F1"] (picture IDs) if it has a picture.
- If the referenced question IS already included in this plan as a normal exercise, do NOT add refText (the student already has it).

### CROP PRECISION — "bbox" is REQUIRED for every question and solved example
The program renders ONLY your rectangle from the PDF at very high resolution (up to 1000 dpi), so the rectangle decides what the student sees. Use the line coordinates above (y = baseline of each text line; text height is about 0.012–0.015).
- bbox = [x, y, w, h], normalized 0–1 from the top-left, written with 3 decimals.
- TOP edge = (y of the question's first line) − 0.014. BOTTOM edge = (y of the question's last line or the bottom of its own picture/table) + 0.008. LEFT = just right of the printed question number (the number is NOT included). RIGHT = the right end of its own column.
- It must contain the WHOLE question: every line, every sub-part (a. b. c.), every option, and a picture that is part of it (graph, caption box, equation box, axes labels).
- It must NOT contain even a sliver of anything else: no cut line of text from the question above, no top part of the picture/table of the question below, no page header/footer, no neighbouring column. Never cut through a line of text or through a picture. If two questions are close, put the edge in the white gap between them.
- The program snaps your edges to the nearest clean gap, so be precise rather than generous.
- For pictures use the detected IDs (their boxes are exact); only for the fallback object give a bbox with a 0.005 margin that contains the entire picture with its axes, labels and caption.

### Question fields — choose them from the QUESTION ITSELF
- "num": the exercise number exactly as printed (digits only).
- "pdfPage": the PDF page where that number is printed. The program finds the number on the page and crops the question automatically, so the page MUST be correct. (Optional "bbox":[x,y,w,h] normalized 0–1 from top-left is only a fallback.)
- "cols": how many questions sit side by side in one row:
  - 3 → very short items (a single equation/expression/pair of points) whose answer is lines or a small graph.
  - 2 → short items needing a table+graph, a number line, a small data table, or 3–5 lines of work.
  - 1 → word problems, items with parts a/b/c, items with big graphs/pictures/tables, proofs, explanations.
- "answer": the answer space placed under the question. One value or an array (rendered top→bottom):
  - "lines"            → ruled lines for written work (solve, simplify, find slope, write equation, explain).
  - "graph"            → empty coordinate plane (graph the equation / inequality / line, use intercepts).
  - "table-graph"      → x|y table beside a coordinate plane ("graph by making a table").
  - "graph-lines"      → coordinate plane then lines (graph AND show work / find intercepts then graph).
  - "numberline"       → number line (graph a solution set of a one-variable inequality).
  - "numberline-lines" → lines for solving, then a number line ("solve each inequality and graph the solution").
  - "table-fill"       → horizontal x/y row table to complete.
  - "none"             → nothing (multiple choice, true/false, matching, answer written on the picture).
  Multi-part word problem example: "answer":["lines","graph"] (a: find…, b: graph…).
- "lines": number of ruled lines (0–10) appropriate to the work required (3 for short solve, 5–6 for word problems).

${TXT?`- "text": the FULL text of the question EXACTLY as printed in the book (look at the attached PDF pages and the extracted text). This text is placed as-is inside a text box in Word, so:
  - Copy it character by character: do NOT correct, paraphrase, translate, shorten, reorder, summarize or "improve" anything — not even apparent typos.
  - Keep the original language(s) as they are; Arabic and English may be mixed in the same question.
  - Mixed Arabic / English / numbers: type everything in normal logical (typing) order exactly as printed. Do NOT reverse Arabic, do NOT add direction marks or extra spaces, keep each English term / number / equation as one unbroken piece with the same spacing as the book. After writing, re-read every text against the PDF digit by digit and symbol by symbol.
  - Keep sub-parts (a. b. c. / 1) 2)) and multiple-choice options; put each on its own line using \\n inside the JSON string.
  - Do not include the question number itself or the book page number — only the question body.
  - Texts written INSIDE a figure (labels on a picture) stay in the figure; type only the question's own words.
  - Math: write it exactly as printed, using Unicode symbols where needed (≤ ≥ − × ÷ ² √ π). Never use LaTeX.
  - If part of the question is a picture/graph/table that cannot be typed, write only the printed words and add nothing about the picture.
  - The JSON string must be valid: escape double quotes as \\" and new lines as \\n.
`:''}
### Solved examples (worked examples / solved questions)
Include EVERY worked example and every solved question that appears in pages ${from}–${to} as {"type":"solved",...} items (the program prints each solved example EXACTLY where you put it in the list — so place it in the order the user wants; it never sorts them unless the user asks inside the program).
- "label": exactly as printed ("Example 1", "Example 2", "Exercise 7 (solved)").
- "pdfPage","bookPage": where it starts.
- "bbox": rectangle of the example's QUESTION part (statement + its picture); "solBbox": rectangle of its SOLUTION/steps (if the solution continues on the next page, add "solPdfPage").
- "text": the example's question exactly as printed; "solution": the full solution exactly as printed, step by step, each step on its own line (\\n). Copy numbers and symbols exactly — no mistakes, no added or skipped steps.
- "figures": pictures needed by the example (same rules as above).

### Rules
- Do NOT put solutions, "Check" boxes, page headers/footers and decorations inside normal questions.
- Questions of one row should have the same "cols" and similar "answer".
- Never invent questions or numbers; never skip a number that exists in the pages.

## Extracted pages (each line: [x=left y=baseline] text, coordinates 0–1 from top-left)
${pagesTxt}

REMINDER: reply with the \`\`\`json block only — this is the final step, not a prompt.`;
}
$('genMd').onclick=async()=>{K.awake(true);try{await genMdRun();}finally{K.awake(false);}};
async function genMdRun(){
  const from=+$('pFrom').value,to=+$('pTo').value;if(from>to)return log('log1','Invalid range','err');
  $('genMd').disabled=true;$('thumbs').innerHTML='';let out='';
  const nums=[];for(let n=from;n<=to;n++)nums.push(n);let doneN=0;
  const parts=await pmap(nums,async n=>{
    const lines=await pageLines(n),fc=await figCands(n);
    const txt=`\n### PDF page ${n} (book page ${n+ +$('pOff').value})\n`+lines.join('\n')+'\n'+`Detected pictures on PDF page ${n}: `+(fc.length?'\n'+fc.map(c=>`- ${c.id}  [x=${c.bbox[0].toFixed(3)} y=${c.bbox[1].toFixed(3)} w=${c.bbox[2].toFixed(3)} h=${c.bbox[3].toFixed(3)}]  text: "${c.caption}"`).join('\n'):'none')+'\n';
    const pg=await renderPage(n),sm=document.createElement('canvas'),k=Math.min(1,220/pg.canvas.height);sm.width=Math.round(pg.canvas.width*k);sm.height=Math.round(pg.canvas.height*k);sm.getContext('2d').drawImage(pg.canvas,0,0,sm.width,sm.height);
    const im=new Image();im.src=sm.toDataURL('image/jpeg',.8);im.title='PDF '+n;
    doneN++;prog('prog1',doneN/nums.length);log('log1',`Page ${n}: ${lines.length} lines, ${fc.length} pictures`);
    return {txt,im};},CONC);
  parts.forEach(p=>{out+=p.txt;$('thumbs').appendChild(p.im);});
  S.md=buildPrompt(out);saveSoon();
  ['copyMd','dlMd'].forEach(i=>$(i).disabled=false);$('genMd').disabled=false;
  log('log1','Instruction file ready — send it to the AI, then go to step 2.','ok');
}
$('copyMd').onclick=async()=>{const ok=await K.copy(S.md);log('log1',ok?'تم النسخ':'تعذر النسخ — استخدم تنزيل .md',ok?'ok':'err');K.toast(ok?'تم النسخ ✔':'تعذر النسخ');};
$('dlMd').onclick=async()=>{try{if(await K.save(S.name+'_AI_prompt.md',new Blob([S.md],{type:'text/markdown'}))){K.toast('تم الحفظ ✔');showStep(2);}}catch(e){log('log1','تعذر الحفظ: '+e.message,'err');}};

/* ───────── Stage 2 ───────── */
$('sampleBtn').onclick=()=>{$('aiIn').value='```json\n'+JSON.stringify({module:{title:'Integrated I Module 5',subtitle:'Creating Linear Equations',grade:'Grade 9 Advanced'},items:[
 {type:'lesson',title:'Lesson 5-1   Writing Equations in Slope-Intercept Form'},
 {type:'goals',items:['Write linear equations in slope-intercept form.']},
 {type:'keyconcept',title:'Key Concept • Slope-Intercept Form',rows:[['y = mx + b','m is the slope and b is the y-intercept.']]},
 {type:'practice',examples:'Examples 1 through 3',topics:['Write an Equation Given Slope and a Point']},
 {type:'instruction',text:'Write an equation of the line that passes through the given point and has the given slope.'},
 {type:'question',num:'1',pdfPage:$('pFrom').value*1||1,bookPage:1,bbox:[0.08,0.2,0.4,0.06],cols:2,answer:'numberline-lines',lines:3},
 {type:'question',num:'2',pdfPage:$('pFrom').value*1||1,bookPage:1,bbox:[0.5,0.2,0.4,0.06],cols:2,answer:'numberline-lines',lines:3}
]},null,1)+'\n```';};

function extractJson(t){
  const m=t.match(/```(?:json)?\s*([\s\S]*?)```/);let s=m?m[1]:t;
  const a=s.indexOf('{'),b=s.lastIndexOf('}');s=s.slice(a,b+1);
  return JSON.parse(s.replace(/,\s*([}\]])/g,'$1'));
}
/* ── automatic question locating (by the printed number) ── */
const ANCH=/^(\d{1,3})\.(?:\s|$)/;
const STOPW=/^(Example|Examples|Mixed Exercises|Lesson|Practice|Higher-Order|Apply|Review|Check|Go Online|Name|Copyright)/i;
async function pageItems(n){
  if(S.items[n])return S.items[n];
  const page=await S.pdf.getPage(n),vp=page.getViewport({scale:1}),tc=await page.getTextContent();
  return S.items[n]=tc.items.filter(i=>i.str.trim()).map(i=>{
    const h=Math.abs(i.height||i.transform[3]||10)/vp.height,[px,py]=vp.convertToViewportPoint(i.transform[4],i.transform[5]),x=px/vp.width,b=py/vp.height;
    return {s:i.str.trim(),x,right:x+(i.width||0)/vp.width,top:b-h,bottom:b+h*0.3};});
}
async function autoBox(q){
  const num=String(q.num).replace(/\D/g,'');if(!num)return null;
  const p0=+q.pdfPage||1,pages=[p0,p0+1,p0-1,p0+2,p0-2].filter(p=>p>=1&&p<=S.pdf.numPages);
  for(const p of pages){
    const its=await pageItems(p),A=its.filter(i=>ANCH.test(i.s)&&i.x<0.9);
    let cand=A.filter(i=>i.s.match(ANCH)[1]===num);if(!cand.length)continue;
    let a=cand[0];
    if(cand.length>1&&q.bbox){const by=+q.bbox[1],bx=+q.bbox[0];cand.sort((u,v)=>Math.hypot(u.x-bx,u.top-by)-Math.hypot(v.x-bx,v.top-by));a=cand[0];}
    const colR=A.filter(o=>o.x>a.x+0.08&&o.top>a.top-0.03&&o.top<a.top+0.4);
    const right=colR.length?Math.min(...colR.map(o=>o.x))-0.005:0.965;
    const below=A.filter(o=>o!==a&&o.top>a.top+0.012&&o.x<right).map(o=>o.top);
    const stops=its.filter(o=>STOPW.test(o.s)&&o.top>a.top+0.012&&o.x<right).map(o=>o.top);
    let bottom=Math.min(a.top+0.42,0.955,...below.map(t=>t-0.006),...stops.map(t=>t-0.006));
    const left=(a.s===num+'.')?a.right+0.003:a.x-0.004,top=a.top-0.005;
    return {page:p,box:[Math.max(0,left),Math.max(0,top),Math.max(0.03,right-left),Math.max(0.02,bottom-top)]};
  }
  return null;
}
function trimCanvas(c){ /* remove white margins so the crop hugs the question */
  const ctx=c.getContext('2d'),{width:w,height:h}=c,d=ctx.getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(d[k]<245||d[k+1]<245||d[k+2]<245){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  if(x1<0)return c;const pd=10;x0=Math.max(0,x0-pd);y0=Math.max(0,y0-pd);x1=Math.min(w,x1+pd);y1=Math.min(h,y1+pd);
  const o=document.createElement('canvas');o.width=x1-x0;o.height=y1-y0;const oc=o.getContext('2d');oc.fillStyle='#fff';oc.fillRect(0,0,o.width,o.height);
  oc.drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);return o;
}
/* snap a box so it never cuts through a text line or a picture: mostly-inside items are included, mostly-outside ones are excluded */
async function snapBox(p,b){let [x,y,w,h]=b;
  const its=await pageItems(p),fc=(await figCands(p)).map(c=>({top:c.bbox[1],bottom:c.bbox[1]+c.bbox[3],x:c.bbox[0],right:c.bbox[0]+c.bbox[2]}));
  const all=its.map(i=>({top:i.top,bottom:i.bottom,x:i.x,right:i.right})).concat(fc);
  for(let k=0;k<5;k++){let t=y,bt=y+h,ch=false;
    for(const o of all){if(o.right<x+0.01||o.x>x+w-0.01)continue;const hh=o.bottom-o.top;if(hh<=0.002)continue;
      if(o.top<t-0.0004&&o.bottom>t+0.0004){t=((o.bottom-t)/hh>=0.5)?o.top-0.003:o.bottom+0.002;ch=true;}
      if(o.top<bt-0.0004&&o.bottom>bt+0.0004){bt=((bt-o.top)/hh>=0.5)?o.bottom+0.003:o.top-0.002;ch=true;}}
    y=Math.max(0,t);h=Math.max(0.02,Math.min(1,bt)-y);if(!ch)break;}
  return [x,y,w,h];}
/* remove thin fragments of neighbouring content that touch the top/bottom edge of a crop */
function dropSlivers(c,s){const w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,st=Math.max(1,Math.round(s/1.5)),ink=new Uint8Array(h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x+=st){const k=(y*w+x)*4;if(d[k]<225||d[k+1]<225||d[k+2]<225){ink[y]=1;break;}}
  const g=Math.round(3*s),B=[];let a=-1,l=-1;for(let y=0;y<h;y++)if(ink[y]){if(a<0)a=y;else if(y-l>g){B.push([a,l]);a=y;}l=y;}if(a>=0)B.push([a,l]);
  if(B.length<2)return c;const lim=13*s;let i0=0,i1=B.length-1;
  if(B[0][0]<=2&&B[0][1]-B[0][0]<lim)i0=1;if(B[i1][1]>=h-3&&B[i1][1]-B[i1][0]<lim&&i1>i0)i1--;
  if(i0===0&&i1===B.length-1)return c;
  const y0=Math.max(0,B[i0][0]-8),y1=Math.min(h,B[i1][1]+9),o=document.createElement('canvas');o.width=w;o.height=y1-y0;
  const x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,o.height);x.drawImage(c,0,y0,w,o.height,0,0,w,o.height);return o;}
async function cropQ(q,pg){
  let [x,y,w,h]=(q.bbox||[0.05,0.1,0.9,0.1]).map(Number);if(x>1||y>1||w>1||h>1){x/=pg.wPt;y/=pg.hPt;w/=pg.wPt;h/=pg.hPt;}
  x=Math.max(0,x);y=Math.max(0,y);w=Math.min(1-x,w);h=Math.min(1-y,h);
  if(!q.manual){try{[x,y,w,h]=await snapBox(pg.n,[x,y,w,h]);}catch(e){}}
  q.bbox=[x,y,w,h];const r=await renderRegion(pg.n,q.bbox);let c=trimCanvas(r.c);if(!q.manual)c=dropSlivers(c,r.s);
  q.png=c.toDataURL('image/png');q.pxW=c.width;q.pxH=c.height;q.ptW=c.width/r.s;q.ptH=c.height/r.s;}
async function cropBox(pg,bbox){
  let [x,y,w,h]=(bbox||[0,0,1,1]).map(Number);if(x>1||y>1||w>1||h>1){x/=pg.wPt;y/=pg.hPt;w/=pg.wPt;h/=pg.hPt;}
  x=Math.max(0,x);y=Math.max(0,y);w=Math.max(0.01,Math.min(1-x,w));h=Math.max(0.01,Math.min(1-y,h));
  const r=await renderRegion(pg.n,[x,y,w,h]),c=trimCanvas(r.c);
  return {bbox:[x,y,w,h],png:c.toDataURL('image/png'),pxW:c.width,pxH:c.height,ptW:c.width/r.s};}
function normFigs(a,defPage){return (Array.isArray(a)?a:a?[a]:[]).map(f=>typeof f==='string'?{id:f}:Array.isArray(f)?{bbox:f}:f).filter(f=>f&&(f.bbox||f.id)).map(f=>{if(f.id&&!f.pdfPage){const m=String(f.id).match(/P\s*(\d+)/i);if(m)f.pdfPage=+m[1];}return f;}).map(f=>({...f,pdfPage:+f.pdfPage||+f.page||defPage}));}
/* ── automatic figure finder: ink outside the text = pictures ── */
function groupCells(g,gw,gh,r){
  const D=new Uint8Array(gw*gh);
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++)if(g[j*gw+i])for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<gw&&b<gh)D[b*gw+a]=1;}
  const seen=new Uint8Array(gw*gh),out=[];
  for(let s0=0;s0<gw*gh;s0++){if(!D[s0]||seen[s0])continue;const st=[s0];seen[s0]=1;let x0=gw,y0=gh,x1=-1,y1=-1;
    while(st.length){const p=st.pop(),i=p%gw,j=(p/gw)|0;
      if(g[p]){if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j;}
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=gw||b>=gh)continue;const q=b*gw+a;if(D[q]&&!seen[q]){seen[q]=1;st.push(q);}}}
    if(x1>=0)out.push([x0,y0,x1-x0+1,y1-y0+1]);}
  return out;}
function inkComps(C,its,reg){
  const cs=Math.max(2,Math.round(5*C.width/3672)),W=C.width,H=C.height,x0=Math.max(0,Math.floor(reg[0]*W)),y0=Math.max(0,Math.floor(reg[1]*H)),x1=Math.min(W,Math.ceil((reg[0]+reg[2])*W)),y1=Math.min(H,Math.ceil((reg[1]+reg[3])*H));
  const gw=Math.ceil((x1-x0)/cs),gh=Math.ceil((y1-y0)/cs);if(gw<2||gh<2)return [];
  const d=C.getContext('2d').getImageData(x0,y0,x1-x0,y1-y0),dd=d.data,w=d.width,g=new Uint8Array(gw*gh);
  for(let y=0;y<d.height;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(dd[k]<215||dd[k+1]<215||dd[k+2]<215)g[((y/cs)|0)*gw+((x/cs)|0)]=1;}
  for(const t of its){const a=Math.floor((t.x*W-x0)/cs)-1,b=Math.ceil((t.right*W-x0)/cs)+1,c=Math.floor((t.top*H-y0)/cs)-1,e=Math.ceil((t.bottom*H-y0)/cs)+1;
    for(let j=Math.max(0,c);j<Math.min(gh,e);j++)for(let i=Math.max(0,a);i<Math.min(gw,b);i++)g[j*gw+i]=0;}
  return groupCells(g,gw,gh,2).map(b=>[(x0+b[0]*cs)/W,(y0+b[1]*cs)/H,(b[2]*cs)/W,(b[3]*cs)/H]);}
const okComp=b=>(b[2]*b[3]>0.006&&Math.min(b[2],b[3])>0.03)||(Math.max(b[2],b[3])>0.2&&Math.min(b[2],b[3])>0.007);
const rdist=(b,x,y)=>Math.hypot(Math.max(b[0]-x,0,x-b[0]-b[2]),Math.max(b[1]-y,0,y-b[1]-b[3]));
const inter=(a,b)=>{const ix=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));return ix*iy/Math.max(1e-6,Math.min(a[2]*a[3],b[2]*b[3]));};
function growFig(b,its){let [x,y,w,h]=b;
  for(let k=0;k<3;k++)for(const t of its){const m=0.01;
    if(t.right-t.x<0.1&&t.s.length<=14&&t.right>x-m&&t.x<x+w+m&&t.bottom>y-m&&t.top<y+h+m){const nx=Math.min(x,t.x),ny=Math.min(y,t.top),nr=Math.max(x+w,t.right),nb=Math.max(y+h,t.bottom);x=nx;y=ny;w=nr-nx;h=nb-ny;}}
  const p=0.006;x=Math.max(0,x-p);y=Math.max(0,y-p);return [x,y,Math.min(1-x,w+2*p),Math.min(1-y,h+2*p)];}
async function compsOn(p,reg){const x=Math.max(0,reg[0]),y=Math.max(0,reg[1]),r=[x,y,Math.min(1-x,reg[2]),Math.min(1-y,reg[3])],its=await pageItems(p),pg=await renderPage(p,AN_SC);
  return inkComps(pg.canvas,its,r).filter(okComp).map(b=>growFig(b,its));}
/* v6: every picture on a page is detected by the program and given a fixed ID (P<page>-F<k>) */
const FIGC={};
function mergeBoxes(L){let ch=true;while(ch){ch=false;for(let i=0;i<L.length&&!ch;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j],m=0.008;
  if(a[0]-m<b[0]+b[2]&&b[0]-m<a[0]+a[2]&&a[1]-m<b[1]+b[3]&&b[1]-m<a[1]+a[3]){const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]);L[i]=[x,y,Math.max(a[0]+a[2],b[0]+b[2])-x,Math.max(a[1]+a[3],b[1]+b[3])-y];L.splice(j,1);ch=true;break;}}}return L;}
async function figCands(p){
  if(FIGC[p])return FIGC[p];
  const its=await pageItems(p);
  let L=(await compsOn(p,[0,0,1,1])).filter(b=>{const [x,y,w,h]=b;
    if(w>0.9&&h>0.5)return false;               /* page frame / full-page background */
    if(w*h>0.45)return false;                   /* coloured box behind a whole block */
    if(Math.min(w,h)<0.025)return false;        /* rules, bars, underlines */
    if(y+h<0.065||y>0.94)return false;          /* header / footer decorations */
    if(w*h<0.004)return false;                  /* icons, bullets */
    return true;});
  L=mergeBoxes(L).sort((a,b)=>Math.abs(a[1]-b[1])>0.02?a[1]-b[1]:a[0]-b[0]);
  return FIGC[p]=L.map((b,k)=>{
    const near=its.filter(t=>t.x>=b[0]-0.03&&t.right<=b[0]+b[2]+0.03&&t.bottom>b[1]-0.035&&t.top<b[1]+b[3]+0.035);
    const cap=near.map(t=>t.s).join(' ').replace(/\s+/g,' ').slice(0,90);
    return {id:`P${p}-F${k+1}`,page:p,bbox:b,caption:cap};});
}
async function figById(id){const m=String(id||'').toUpperCase().match(/P\s*(\d+)\s*-\s*F\s*(\d+)/);if(!m)return null;
  const p=+m[1];if(p<1||p>S.pdf.numPages)return null;const c=(await figCands(p))[+m[2]-1];return c?{p,b:c.bbox}:null;}
async function resolveFig(f,ctx){
  if(f.id){const r=await figById(f.id);if(r)return r;}
  const hint=(f.bbox||[]).map(Number),hv=hint.length===4&&hint.every(v=>v<=1),pn=+f.pdfPage||(ctx&&ctx.page)||1;
  const nm=String(f.name||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(nm.length>=3){let best=null;
    for(const p of [pn,pn+1,pn-1,pn+2,pn-2,pn+3,pn-3]){if(p<1||p>S.pdf.numPages)continue;
      for(const t of await pageItems(p)){const s0=t.s.toLowerCase();if(!(s0.length>=3&&(s0.includes(nm)||(s0.length>=6&&nm.includes(s0)))))continue;
        for(const b of await compsOn(p,[0,t.top-0.35,1,0.7])){const d=rdist(b,t.x,t.top);if(d<0.12&&(!best||d<best.d))best={p,b,d};}}}
    if(best)return {p:best.p,b:best.b};}
  if(hv){let best=null;for(const b of await compsOn(pn,[hint[0]-0.08,hint[1]-0.08,hint[2]+0.16,hint[3]+0.16])){const o=inter(hint,b);if(o>0.35&&(!best||o>best.o))best={b,o};}
    if(best)return {p:pn,b:best.b};}
  if(ctx&&ctx.box&&ctx.page){const cs=await compsOn(ctx.page,[ctx.box[0]-0.01,ctx.box[1]-0.01,ctx.box[2]+0.02,ctx.box[3]+0.02]);
    if(cs.length)return {p:ctx.page,b:cs.sort((a,b)=>b[2]*b[3]-a[2]*a[3])[0]};}
  return hv?{p:pn,b:hint}:null;}
async function cropFigs(list,ctx){
  for(const f of list){try{const r=await resolveFig(f,ctx);if(r){f.pdfPage=r.p;f.bbox=r.b;}if(!f.bbox){f.png=null;continue;}Object.assign(f,await cropBox(await renderPage(f.pdfPage),f.bbox));}catch(e){f.png=null;}}
  for(let i=list.length-1;i>=0;i--)if(!list[i].png)list.splice(i,1);
  for(let i=list.length-1;i>0;i--)for(let j=0;j<i;j++)if(list[i].pdfPage===list[j].pdfPage&&list[i].bbox&&list[j].bbox&&inter(list[i].bbox,list[j].bbox)>0.8){list.splice(i,1);break;}}
function bands(c,gap=70){const ctx=c.getContext('2d'),w=c.width,h=c.height,d=ctx.getImageData(0,0,w,h).data,ink=[];
  for(let y=0;y<h;y++){let f=0;for(let x=0;x<w;x+=2){const k=(y*w+x)*4;if(d[k]<225||d[k+1]<225||d[k+2]<225){f=1;break;}}ink.push(f);}
  const out=[];let s0=-1,last=-1;
  for(let y=0;y<h;y++){if(ink[y]){if(s0<0)s0=y;else if(y-last>gap){out.push([s0,last]);s0=y;}last=y;}}
  if(s0>=0)out.push([s0,last]);
  return out.map(([a,b])=>{const o=document.createElement('canvas');o.width=w;o.height=b-a+1;const oc=o.getContext('2d');oc.fillStyle='#fff';oc.fillRect(0,0,w,o.height);oc.drawImage(c,0,a,w,o.height,0,0,w,o.height);return o;});}
async function splitQ(q){ /* question text without its figures (they go to the right side in Word) */
  const [x,y,w,h]=q.bbox,r=await renderRegion(q.pdfPage,q.bbox),c=r.c,ctx=c.getContext('2d');ctx.fillStyle='#fff';
  const F=(q.figures||[]).filter(f=>f.png&&f.bbox&&f.pdfPage===q.pdfPage&&inter(q.bbox,f.bbox)>0.6&&(f.bbox[2]*f.bbox[3])/(w*h)<0.8),p=0.004;
  F.forEach(f=>ctx.fillRect((f.bbox[0]-x-p)/w*c.width,(f.bbox[1]-y-p)/h*c.height,(f.bbox[2]+2*p)/w*c.width,(f.bbox[3]+2*p)/h*c.height));
  const c2=q.manual?c:dropSlivers(c,r.s),parts=F.length?bands(c2,Math.round(11.7*r.s)):[c2];
  q.pieces=parts.map(k=>{const t=trimCanvas(k);return {png:t.toDataURL('image/png'),pxW:t.width,pxH:t.height,ptW:t.width/r.s};});
  if(!q.pieces.length)q.pieces=[{png:q.png,pxW:q.pxW,pxH:q.pxH,ptW:q.ptW}];}
function overlap(a,b){const ix=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));return ix*iy/Math.max(1e-6,b[2]*b[3]);}
const ANSWERS=['lines','dots','space','box','graph','graph2','table-graph','graph-lines','numberline','numberline-lines','table-fill','none'];
function normQ(q){ /* accept old "layout" values too */
  const L=q.layout;
  if(!q.answer){q.answer=L==='with-graph-grid'?'graph':L==='table-fill'?'table-fill':'lines';}
  if(typeof q.answer==='string'&&q.answer.includes(','))q.answer=q.answer.split(',').map(s=>s.trim());
  const arr=[].concat(q.answer).filter(a=>ANSWERS.includes(a));q.answer=arr.length?(arr.length==1?arr[0]:arr):'lines';
  if(!q.cols)q.cols=L==='two-columns'?2:L==='full-width'?1:2;
  q.cols=Math.min(3,Math.max(1,+q.cols||1));
  if(q.lines==null)q.lines=[].concat(q.answer).some(a=>/lines/.test(a))?3:0;
}
$('parseBtn').onclick=async()=>{K.awake(true);try{await parseRun();}finally{K.awake(false);}};
async function parseRun(){
  if(!S.pdf)return log('log2','Upload the PDF in step 1 first','err');
  try{S.plan=extractJson($('aiIn').value);}catch(e){return log('log2','JSON error: '+e.message+' — the AI reply must contain the ```json block.','err');}
  if(Array.isArray(S.plan))S.plan={items:S.plan};
  if(!S.plan.items)return log('log2','No "items" found. The AI probably wrote a prompt instead of the JSON — send it the reply again saying: "Return the final JSON now".','err');
  if(S.plan.module){$('mTitle').value=S.plan.module.title||$('mTitle').value;$('mSub').value=S.plan.module.subtitle||$('mSub').value;$('mGrade').value=S.plan.module.grade||$('mGrade').value;}
  const qs=S.plan.items.filter(i=>i.type==='question');let auto=0,miss=[];
  for(const [k,q] of qs.entries()){
    try{normQ(q);q.pdfPage=+q.pdfPage||+q.page||+$('pFrom').value;
      const ab=await autoBox(q);
      if(ab){q.pdfPage=ab.page;q.bbox=ab.box;q.auto=true;auto++;}else{q.auto=false;miss.push(q.num);}
      q.bookPage=q.bookPage??(q.pdfPage+ +$('pOff').value);
      await cropQ(q,await renderPage(q.pdfPage));
      q.figures=normFigs(q.figures,q.pdfPage);await cropFigs(q.figures,{page:q.pdfPage,box:q.bbox});
      q.refFigures=normFigs(q.refFigures,q.pdfPage);await cropFigs(q.refFigures,null);await splitQ(q);}catch(e){log('log2',`Q${q.num}: ${e.message}`,'err');}
    if(k%5==0)log('log2',`Cropped ${k+1}/${qs.length}`);
  }
  const sv=S.plan.items.filter(i=>i.type==='solved');
  for(const e of sv){try{e.pdfPage=+e.pdfPage||+$('pFrom').value;e.bookPage=e.bookPage??(e.pdfPage+ +$('pOff').value);
    e.qImg=e.bbox?await cropBox(await renderPage(e.pdfPage),e.bbox):null;
    e.sImg=e.solBbox?await cropBox(await renderPage(+e.solPdfPage||e.pdfPage),e.solBbox):null;
    e.figures=normFigs(e.figures,e.pdfPage);await cropFigs(e.figures,{page:e.pdfPage,box:e.bbox});}catch(er){log('log2',`${e.label}: ${er.message}`,'err');}}
  const figN=qs.reduce((a,q)=>a+q.figures.length,0);
  log('log2',`${S.plan.items.length} items, ${qs.length} questions — ${auto} located automatically, ${figN} figures, ${sv.length} solved examples`,'ok');
  if(miss.length)log('log2',`Not found by number (check these in review, red tag): ${miss.join(', ')}`,'warn');
  renderReview();showStep(3);
}
/* ───────── Stage 3 review ───────── */

function moveIt(i,d){const a=S.plan.items,j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderReview();}
function moveTo(i,pos){const a=S.plan.items,[x]=a.splice(i,1);a.splice(pos<0?a.length:pos,0,x);renderReview();}
function ctl(){return `<div class="ctl"><button data-mv="-1" title="تقديم (لأعلى)">▲</button><button data-mv="1" title="تأخير (لأسفل)">▼</button><button data-top="1" title="إلى بداية الملف">⤒</button><button data-bot="1" title="إلى نهاية الملف">⤓</button><button data-pos="1" title="نقل إلى موضع رقم…">#</button><button data-dup="1" title="تكرار">⧉</button><button data-edt="1" title="تعديل النص / الحقول">✎</button><button data-del="1" title="حذف">🗑</button></div>`;}
function selHtml(p,opts,cur){return `<select data-p="${p}" style="padding:3px 6px;font-size:.72rem">${opts.map(o=>`<option value="${o[0]}"${(cur||'')===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select>`;}
const ANS_AR={lines:'أسطر',dots:'نقاط',space:'مساحة فارغة',box:'مربع',graph:'رسم بياني',graph2:'رسمان بيانيان','table-graph':'جدول+رسم','graph-lines':'رسم+أسطر',numberline:'خط أعداد','numberline-lines':'أسطر+خط أعداد','table-fill':'جدول فارغ',none:'بدون'};
const PAL_OPTS=[['','لون: الافتراضي'],['teal','فيروزي'],['blue','أزرق'],['green','أخضر'],['orange','برتقالي'],['purple','بنفسجي'],['navy','كحلي'],['red','أحمر'],['grey','رمادي']];
const ITEM_SEL={
  solved:it=>selHtml('stepStyle',[['','الخطوات: الافتراضي'],['rows','جدول مرقّم'],['plain','نقاط مرقمة'],['boxes','مربعات'],['flow','مربعات وأسهم'],['dots','نقاط ●'],['compact','مضغوط'],['cols2','عمودان']],it.stepStyle)+selHtml('color',PAL_OPTS,it.color)+selHtml('layout',[['','تخطيط: مرتب'],['stacked','مسألة فوق الحل'],['side','مسألة بجانب الحل']],it.layout)+selHtml('header',[['','عنوان: شريط'],['bar','شريط'],['tag','بطاقة صغيرة'],['line','خط']],it.header),
  goals:it=>selHtml('style',[['','النمط: كلاسيك']].concat(GSTYLES.map(s=>[s,s])),it.style)+selHtml('color',[['','اللون'],['red','أحمر'],['blue','أزرق'],['green','أخضر'],['orange','برتقالي'],['teal','فيروزي'],['navy','كحلي'],['purple','بنفسجي']],it.color),
  points:it=>ITEM_SEL.goals(it),
  keyconcept:it=>selHtml('style',[['','جدول'],['table','جدول'],['list','قائمة'],['cards','بطاقات'],['boxed','إطار']],it.style)+selHtml('color',PAL_OPTS,it.color),
  lesson:it=>selHtml('style',[['','عنوان: خط سفلي'],['underline','خط سفلي'],['banner','شريط'],['box','إطار'],['simple','بسيط']],it.style),
  part:it=>selHtml('style',[['','شريط'],['banner','شريط'],['underline','خط سفلي'],['center','وسط']],it.style),
  section:it=>selHtml('style',[['','شريط'],['bar','شريط'],['line','خط'],['pill','إطار']],it.style),
  practice:it=>selHtml('style',[['','شريط'],['bar','شريط'],['line','خط'],['pill','إطار']],it.style),
  question:it=>selHtml('answer',[['','الإجابة: '+(Array.isArray(it.answer)?it.answer.join('+'):it.answer||'lines')]].concat(ANSWERS.map(a=>[a,ANS_AR[a]||a])),'')+selHtml('cols',[['1','عمود واحد'],['2','عمودان'],['3','3 أعمدة']],String(it.cols||2))+selHtml('lines',Array.from({length:13},(_,k)=>[String(k),'أسطر: '+k]),String(it.lines??0))+selHtml('badge',[['','رقم السؤال: الافتراضي'],['box','مربع'],['solid','ملوّن'],['outline','إطار'],['plain','عادي'],['none','بدون']],it.badge)};
function renderReview(){saveSoon();
  const R_=$('review');R_.innerHTML='';let grid=null;
  const act=(ev,idx)=>{const ds=ev.target.dataset||{};
    if(ds.mv){ev.stopPropagation();moveIt(idx,+ds.mv);return true;}
    if(ds.top){ev.stopPropagation();moveTo(idx,0);return true;}
    if(ds.bot){ev.stopPropagation();moveTo(idx,-1);return true;}
    if(ds.del){ev.stopPropagation();K.confirm('حذف هذا العنصر؟').then(ok=>{if(ok){S.plan.items.splice(idx,1);renderReview();}});return true;}
    if(ds.pos){ev.stopPropagation();K.ask('انقل إلى الموضع رقم (1 – '+S.plan.items.length+')',String(idx+1)).then(v=>{const n=parseInt(v);if(n>=1)moveTo(idx,Math.min(n,S.plan.items.length)-1);});return true;}
    if(ds.dup){ev.stopPropagation();S.plan.items.splice(idx+1,0,structuredCloneSafe(S.plan.items[idx]));renderReview();return true;}
    if(ds.edt){ev.stopPropagation();editItem(idx);return true;}
    if(ev.target.tagName==='SELECT'){ev.stopPropagation();return true;}
    return false;};
  const bindSel=(box,it)=>box.querySelectorAll('select[data-p]').forEach(s=>{s.onchange=()=>{const v=s.value,k=s.dataset.p;if(k==='cols'||k==='lines')it[k]=+v;else if(k==='answer'&&v==='')return;else if(v==='')delete it[k];else it[k]=v;saveSoon();};});
  S.plan.items.forEach((it,idx)=>{
    if(it.type==='question'){
      if(!grid){grid=document.createElement('div');grid.className='grid';R_.appendChild(grid);}
      const d=document.createElement('div');d.className='qc';
      d.innerHTML=`${(it.pieces||[it]).map(p=>`<img src="${p.png||''}">`).join('')}${(it.figures||[]).map((f,k)=>`<img data-f="${k}" title="${f.gallery?'صورة من المعرض — اضغط لحذفها':'figure — click to re-crop'}" style="border:2px dashed ${f.gallery?'#58cc02':'#e36c0a'};max-height:90px;width:auto;margin-top:4px" src="${f.png||''}">`).join('')}${it.refText?`<div style="font-size:11px;color:#e36c0a">🔗 ${esc(it.refLabel||'ref')}</div>`:''}<div class="meta"><span>Q <b>${esc(it.num)}</b> · p.${esc(it.bookPage??'')}</span><span class="tag" style="${it.auto===false?'background:rgba(255,75,75,.2);color:#ff4b4b':''}">${it.cols}col · ${esc([].concat(it.answer).join('+'))}</span></div><button class="btn btn-ghost" data-add="1" style="padding:5px 10px;font-size:.75rem;margin-top:6px;width:100%">🖼️ إضافة صورة من المعرض</button><div style="margin-top:6px">${ITEM_SEL.question(it)}</div>${ctl()}`;
      bindSel(d,it);
      d.onclick=ev=>{if(act(ev,idx))return;const t=ev.target,ds=t.dataset||{};
        if(ds.add){ev.stopPropagation();pickGallery(idx);return;}
        if(ds.f!=null){const fg=(it.figures||[])[+ds.f];
          if(fg&&fg.gallery){K.confirm('حذف الصورة المضافة من المعرض؟').then(ok=>{if(ok){it.figures.splice(+ds.f,1);splitQ(it).then(renderReview);}});return;}
          openEditor(idx,+ds.f);}else openEditor(idx);};grid.appendChild(d);
    }else{grid=null;const o=document.createElement('div');o.className='other';
      const txt=it.type==='solved'?`✅ <b>${esc(it.label)}</b> · p.${esc(it.bookPage)} ${it.qImg?`<img style="max-height:60px" src="${it.qImg.png}">`:''}${it.sImg?`<img style="max-height:60px" src="${it.sImg.png}">`:''}<div style="opacity:.75">${esc(String(it.text||'').slice(0,110))}</div>`
        :`<b>${esc(it.type.toUpperCase())}</b>: ${esc(it.title||it.text||it.heading||(it.items||[]).join(' / ')||it.examples||'')}`;
      o.innerHTML=`${txt}<div class="sels">${ITEM_SEL[it.type]?ITEM_SEL[it.type](it):''}</div>${ctl()}`;
      bindSel(o,it);
      o.onclick=ev=>{if(act(ev,idx))return;
        editItem(idx);};
      R_.appendChild(o);}
  });
}
$('sortQ').onclick=()=>{const a=S.plan.items;let i=0;while(i<a.length){if(a[i].type!=='question'){i++;continue;}let j=i;while(j<a.length&&a[j].type==='question')j++;
  const seg=a.slice(i,j).map((q,k)=>({q,k})).sort((x,y)=>((parseInt(x.q.num)||0)-(parseInt(y.q.num)||0))||x.k-y.k).map(z=>z.q);a.splice(i,j-i,...seg);i=j;}renderReview();};
$('sortS').onclick=()=>{const a=S.plan.items,idx=a.map((x,k)=>x.type==='solved'?k:-1).filter(k=>k>=0),s=idx.map(k=>a[k]).map((e,k)=>({e,k})).sort((x,y)=>((+x.e.pdfPage||0)-(+y.e.pdfPage||0))||x.k-y.k).map(z=>z.e);idx.forEach((k,n)=>a[k]=s[n]);renderReview();};

let ED={idx:-1,box:null,drag:null,fig:null};
async function openEditor(idx,fig){
  const q=S.plan.items[idx];ED.idx=idx;ED.fig=fig??null;const F=fig!=null?q.figures[fig]:null;ED.box=[...(F?F.bbox:q.bbox)];
  $('eNum').value=q.num;$('ePdf').value=F?F.pdfPage:q.pdfPage;$('eLayout').value=[].concat(q.answer)[0];$('eCols').value=q.cols;$('eLines').value=q.lines??0;
  $('eDel').textContent=F?'🗑 حذف الصورة':'🗑 حذف السؤال';
  await drawEditor(F?F.pdfPage:q.pdfPage);$('modal').classList.add('open');
}
async function drawEditor(n){
  const pg=await renderPage(n),c=$('eCanvas');c.width=pg.canvas.width;c.height=pg.canvas.height;
  c.getContext('2d').drawImage(pg.canvas,0,0);requestAnimationFrame(drawSel);
}
function drawSel(){const c=$('eCanvas'),r=c.getBoundingClientRect(),[x,y,w,h]=ED.box,s=$('sel');
  s.style.left=x*r.width+'px';s.style.top=y*r.height+'px';s.style.width=w*r.width+'px';s.style.height=h*r.height+'px';}
$('ePdf').onchange=()=>drawEditor(+$('ePdf').value);
const cw=$('cwrap');
cw.addEventListener('pointerdown',e=>{try{cw.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();const r=$('eCanvas').getBoundingClientRect();ED.drag={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};});
cw.addEventListener('pointermove',e=>{if(!ED.drag)return;const r=$('eCanvas').getBoundingClientRect();
  const x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
  ED.box=[Math.min(x,ED.drag.x),Math.min(y,ED.drag.y),Math.abs(x-ED.drag.x),Math.abs(y-ED.drag.y)];drawSel();});
['pointerup','pointercancel'].forEach(n=>cw.addEventListener(n,()=>ED.drag=null));
$('eSave').onclick=async()=>{const q=S.plan.items[ED.idx];
  if(ED.fig!=null){const f=q.figures[ED.fig];f.pdfPage=+$('ePdf').value;if(ED.box[2]>0.005&&ED.box[3]>0.005)f.bbox=ED.box;Object.assign(f,await cropBox(await renderPage(f.pdfPage),f.bbox));await splitQ(q);$('modal').classList.remove('open');renderReview();return;}
  q.num=$('eNum').value;q.pdfPage=+$('ePdf').value;q.answer=$('eLayout').value;q.cols=+$('eCols').value;q.lines=+$('eLines').value;
  if(ED.box[2]>0.005&&ED.box[3]>0.005)q.bbox=ED.box;
  q.auto=true;q.manual=true;q.bookPage=q.pdfPage+ +$('pOff').value;await cropQ(q,await renderPage(q.pdfPage));await splitQ(q);$('modal').classList.remove('open');renderReview();};
$('eDel').onclick=async()=>{const q=S.plan.items[ED.idx];if(ED.fig!=null){q.figures.splice(ED.fig,1);try{await splitQ(q);}catch(e){}}else S.plan.items.splice(ED.idx,1);$('modal').classList.remove('open');renderReview();};
$('eClose').onclick=()=>$('modal').classList.remove('open');
/* ── add a picture from the gallery to a question: it is shrunk and placed beside the question like a normal figure ── */
function pickGallery(idx,closeModal){
  K.pick('image').then(async r=>{const f=r&&r[0];if(!f)return;
    try{await addGalleryFig(idx,f.blob);if(closeModal)$('modal').classList.remove('open');renderReview();}
    catch(e){alert('تعذر إضافة الصورة: '+e.message);}}).catch(e=>alert('تعذر اختيار الصورة: '+e.message));}
async function addGalleryFig(idx,file){
  const q=S.plan.items[idx],url=URL.createObjectURL(file);
  const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('الملف ليس صورة صالحة'));im.src=url;});
  const sc=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
  URL.revokeObjectURL(url);
  (q.figures=q.figures||[]).push({gallery:true,pdfPage:q.pdfPage,png:c.toDataURL('image/png'),pxW:w,pxH:h,ptW:w/2});
  await splitQ(q);}
$('eGal').onclick=()=>{if(ED.idx>=0)pickGallery(ED.idx,true);};

/* ───────── DOCX builder (Module-4 style) ───────── */
const STYLE={ /* extendable style registry */
  font:'Cambria',qFont:'Book Antiqua',
  red:'C00000',blue:'0070C0',navy:'1F3864',teal:'1F6F8B',orange:'E36C0A',grey:'7F7F7F',
  goalsFill:'C00000',goalsBorder:'BFBFBF',kcHead:'DEEAF1',kcTerm:'F2F8FB',kcBorder:'9DC3D3',badgeFill:'FFF2CC',badgeBorder:'1F4E79',
  pageW:12240,pageH:15840,margin:{t:1152,r:720,b:1440,l:720},contentW:10800
};
const B=(c,sz=6)=>`<w:top w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/><w:left w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/><w:bottom w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/><w:right w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/><w:insideH w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/><w:insideV w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/>`;
const NOB=`<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/>`;



const SP=(h=160)=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/></w:pPr></w:p>`;
const SPK=(h=160)=>`<w:p><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/></w:pPr></w:p>`;   /* spacer that keeps the paragraph before it glued to the next one */
function TC(w,content,o={}){return `<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="${w}"/>${o.span?`<w:gridSpan w:val="${o.span}"/>`:''}${o.fill?`<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>`:''}<w:tcMar><w:top w:w="${o.m??60}" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="${o.m??60}" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>${o.v?`<w:vAlign w:val="${o.v}"/>`:''}</w:tcPr>${cellEnd(content)}</w:tc>`;}
function cellEnd(c){c=c||'';return /<\/w:p>\s*$|<w:p\/>\s*$/.test(c)?c:c+'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';}


let MEDIA=[];let MAXH_IN=8.2;
function addImage(dataUrl){const id='rIdImg'+(MEDIA.length+1);MEDIA.push({id,name:`image${MEDIA.length+1}.png`,data:dataUrl.split(',')[1]});return id;}
let DOCPR=100;
function IMG(rid,wIn,hIn){if(!(wIn>0))wIn=1;if(!(hIn>0))hIn=wIn*0.5;if(hIn>MAXH_IN){wIn*=MAXH_IN/hIn;hIn=MAXH_IN;}const cx=Math.max(1,Math.round(wIn*914400)),cy=Math.max(1,Math.round(hIn*914400)),n=DOCPR++;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Q${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="q${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;}

let GRID_RID=null;
function gridImage(){ /* coordinate plane PNG */
  const N=20,px=24,s=N*px+2,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,s,s);
  for(let i=0;i<=N;i++){x.strokeStyle=i===N/2?'#000':'#9a9a9a';x.lineWidth=i===N/2?2.5:1;
    x.beginPath();x.moveTo(1+i*px,0);x.lineTo(1+i*px,s);x.stroke();x.beginPath();x.moveTo(0,1+i*px);x.lineTo(s,1+i*px);x.stroke();}
  x.fillStyle='#000';x.font='italic bold 18px Cambria';x.fillText('x',s-16,s/2-6);x.fillText('y',s/2+6,16);x.fillText('O',s/2-18,s/2+18);
  return c.toDataURL('image/png');
}
let LH=400;   /* height (twips) of one ruled line — fillPages() stretches it on pages that end with empty space */
let QUIET=false;
function TABLEFILL(w){const cw=Math.floor(w/6);
  return TBL(Array(6).fill(cw),[ ['x',...Array(5).fill('')],['y',...Array(5).fill('')] ].map(r=>r.map((t,i)=>TC(cw,P(t?R(t,{b:true,i:true,sz:24}):'',{jc:'center',after:0}),{fill:i===0?STYLE.kcHead:null,m:90})).join('')),B('7F7F7F',8),{center:false,vis:false});}



let NL_RID=null;
function numberLineImage(){
  const W=1200,H=130,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.strokeStyle='#000';x.fillStyle='#000';x.lineWidth=3;
  const y=55,L=40,Rr=W-40;x.beginPath();x.moveTo(L,y);x.lineTo(Rr,y);x.stroke();
  [[L,1],[Rr,-1]].forEach(([px,d])=>{x.beginPath();x.moveTo(px,y);x.lineTo(px+18*d,y-11);x.lineTo(px+18*d,y+11);x.closePath();x.fill();});
  x.font='26px Cambria';x.textAlign='center';const n=20,st=(Rr-L-80)/n;
  for(let i=0;i<=n;i++){const px=L+40+i*st;x.lineWidth=2;x.beginPath();x.moveTo(px,y-12);x.lineTo(px,y+12);x.stroke();
    if(i%2==0)x.fillText(String(i-10).replace('-','−'),px,y+46);}
  return c.toDataURL('image/png');
}
function XYTABLE(w,rows=5){const cw=Math.floor(w/2);
  const head=['x','y'].map(t=>TC(cw,P(R(t,{b:true,i:true,color:'FFFFFF',sz:22}),{jc:'center',after:0}),{fill:'31849B',m:40})).join('');
  const body=Array.from({length:rows},()=>[0,1].map(()=>TC(cw,P('',{after:0,line:300}),{m:20})).join(''));
  return TBL([cw,cw],[head,...body],B('31849B',8),{center:false,vis:false});}
function GRID(sz){if(!GRID_RID)GRID_RID=addImage(gridImage());return P(IMG(GRID_RID,sz/1440,sz/1440),{jc:'center',after:40});}

/* ───────── Text-box question (Arabic / English / mixed) ───────── */


let TB_ID=500;
function textBoxPt(text,wDxa){const lines=String(text).replace(/\r\n?/g,'\n').split('\n');
  const wPt=wDxa/20,cpl=Math.max(8,Math.floor((wPt-14)/6.3));
  return Math.ceil(lines.reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/cpl)),0)*16.5+14);}
function TEXTBOX(text,wDxa){
  const lines=String(text).replace(/\r\n?/g,'\n').split('\n');
  const hPt=textBoxPt(text,wDxa),cx=Math.round(wDxa*635),cy=Math.round(hPt*12700),id=DOCPR++;
  const paras=lines.map(l=>txtPara(l)).join('');
  return `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="TextBox ${id}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${STYLE.badgeBorder}"/></a:solidFill></a:ln></wps:spPr><wps:txbx><w:txbxContent>${paras}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="72000" tIns="36000" rIns="72000" bIns="36000" anchor="t" anchorCtr="0"><a:spAutoFit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice></mc:AlternateContent></w:r>`;}
function KEEP(x){ /* every paragraph of the block keeps with the next one + rows never split */
  return x.replace(/<w:p\/>/g,'<w:p><w:pPr><w:keepNext/><w:keepLines/></w:pPr></w:p>').replace(/<w:pPr>(?!<w:keepNext\/>)/g,'<w:pPr><w:keepNext/><w:keepLines/>');}
const FIG_MAXH=4800;   /* tallest picture (twips) placed beside a question — bigger ones are scaled down */
function figSize(f,maxW,maxH=Infinity){let w=Math.min(maxW,f.ptW*20*1.05),h=w*f.pxH/f.pxW;if(h>maxH){w*=maxH/h;h=maxH;}return {w,h};}


function figBlock(figs,maxW){return figs.map(f=>figImg(f,maxW)).join('');}



const ROWB=`<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="7F7F7F"/><w:right w:val="nil"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="7F7F7F"/><w:insideV w:val="dashed" w:sz="4" w:space="0" w:color="A6A6A6"/>`;
function questionRow(list,W){const n=list.length,cw=Math.floor(W/n);
  const cells=Array.from({length:n},(_,k)=>TC(cw,list[k]?questionCell(list[k],cw)+'<w:p/>':'<w:p/>',{m:60}));
  return TBL(Array(n).fill(cw),[cells.join('')],ROWB)+SP(120);}





/* ───────── v10 core: document settings, labels, bidi-safe text ───────── */
const DOC={rtl:false,pdir:'ltr',lang:'en',L:{},arFont:'Arial',sz:22,qsz:24,eq:'start',figSide:'end',badge:'box',pal:'teal',stepStyle:'rows',solvedPl:'ai',border:true,cover:true,hl:true,numStyle:'numbers',parts:true,lineStyle:'single',lineK:1};
const LAB={
 en:{problem:'PROBLEM',solution:'SOLUTION',page:'Page',example:'Example',solvedTitle:'Solved Examples',solvedSub:'Example / Page No. in the book',practice:'Practice',practiceSub:'Question No. / Page No. in the book',goals:"Today's Goals",keyTitle:'Key Concepts, Rules & Theorems',ref:'Referenced example',missing:'[missing crop]',footPage:'Page ',note:'Note'},
 ar:{problem:'المسألة',solution:'الحل',page:'صفحة',example:'مثال',solvedTitle:'الأمثلة المحلولة',solvedSub:'المثال / رقم الصفحة في الكتاب',practice:'تدريب',practiceSub:'رقم السؤال / رقم الصفحة في الكتاب',goals:'أهداف الدرس',keyTitle:'المفاهيم والقواعد والنظريات',ref:'مثال مرجعي',missing:'[الصورة غير متوفرة]',footPage:'صفحة ',note:'ملاحظة'}
};
const LB=k=>DOC.L[k]!=null?DOC.L[k]:(LAB[DOC.lang]||LAB.en)[k];
const YN=v=>v===true||v==='yes'||v==='true';
function OPT(id,key,def){const e=$(id);if(e&&e.value&&e.value!=='ai')return e.value;
  const o=S.plan&&S.plan.module&&S.plan.module.options;return o&&o[key]!=null?o[key]:def;}
function setupDoc(){
  const its=(S.plan&&S.plan.items)||[];let ar=0,la=0;
  const scan=s=>{s=String(s==null?'':s);ar+=(s.match(/[\u0600-\u06FF]/g)||[]).length;la+=(s.match(/[A-Za-z]{2,}/g)||[]).join('').length;};
  [$('mTitle').value,$('mSub').value,$('mGrade').value].forEach(scan);
  its.forEach(i=>{[i.title,i.text,i.solution,i.refText,i.label,i.examples].forEach(scan);(i.items||[]).forEach(scan);(i.topics||[]).forEach(scan);(i.rows||[]).forEach(r=>[].concat(r).forEach(scan));});
  const dm=OPT('dirOpt','direction','book'),bookRtl=ar>0&&ar>la*0.5;
  DOC.rtl=dm==='rtl'||(dm==='book'&&bookRtl);
  DOC.pdir=dm==='para'?'auto':(DOC.rtl?'rtl':'ltr');
  if(dm==='ltr'){DOC.rtl=false;DOC.pdir='ltr';}
  let ll=OPT('labelLang','labelLang','auto');if(ll!=='ar'&&ll!=='en')ll=DOC.rtl?'ar':'en';DOC.lang=ll;
  DOC.L=(S.plan&&S.plan.module&&S.plan.module.labels)||{};
  DOC.arFont=$('arFont').value||'Arial';DOC.sz=+$('fontSz').value||22;DOC.qsz=DOC.sz+2;
  DOC.eq=OPT('eqAlign','eqAlign','start');DOC.figSide=OPT('figSide','figSide','end');DOC.badge=OPT('badgeStyle','badge','box');
  DOC.pal=OPT('palette','palette','teal');DOC.stepStyle=OPT('stepStyle','stepStyle','rows');DOC.solvedPl=OPT('solvedPl','solvedPlacement','ai');
  DOC.border=YN(OPT('pgBorder','pageBorder','yes'));DOC.cover=YN(OPT('cover','cover','yes'));DOC.hl=YN(OPT('hlLast','highlightLast','yes'));
  DOC.numStyle=OPT('numStyle','numbering','numbers');DOC.parts=YN(OPT('partSplit','splitParts','yes'));
  DOC.minus=OPT('minusFix','minusFix','yes')==='yes';DOC.lineStyle=OPT('lineStyle','lineStyle','single');DOC.lineK={narrow:.8,normal:1,wide:1.3}[OPT('lineGap','lineGap','normal')]||1;
  log('log3',`Direction: ${DOC.rtl?'RTL (Arabic)':DOC.pdir==='auto'?'per paragraph':'LTR'} · labels: ${DOC.lang} · solved examples: ${DOC.solvedPl}`,'ok');
}
const AR_RE=/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const ARC='\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF';
const AR_SEG=new RegExp('(['+ARC+']+(?:[ \\t\\u00A0.,:;!?،؛؟…«»\\-–]*['+ARC+']+)*[.,:;!?،؛؟…]*)');
const BIDI_CTL=/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
function rPr(o,ar){const f=o.font||STYLE.font,cs=ar?(o.csFont||DOC.arFont):f,sz=o.sz||DOC.sz;
  return `<w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${cs}"/>${o.b?'<w:b/><w:bCs/>':''}${o.i?'<w:i/><w:iCs/>':''}${o.color?`<w:color w:val="${o.color}"/>`:''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${ar?'<w:rtl/>':''}<w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr>`;}
function R(t,o={}){return String(t).split(AR_SEG).filter(s=>s!=='').map(p=>`<w:r>${rPr(o,AR_RE.test(p))}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`).join('');}
function mathRuns(t,o={}){return String(t).split(/(\b[a-z]\b)/g).filter(Boolean).map(p=>/^[a-z]$/.test(p)?R(p,{...o,i:true}):R(p,o)).join('');}
function P(runs,o={}){const bd=o.bidi!=null?o.bidi:DOC.rtl;
  return `<w:p><w:pPr>${o.keep?'<w:keepNext/>':''}${o.pbdr?`<w:pBdr><w:bottom w:val="single" w:sz="${o.pbdr[1]||12}" w:space="2" w:color="${o.pbdr[0]}"/></w:pBdr>`:''}${bd?'<w:bidi/>':''}<w:spacing w:before="${o.before??0}" w:after="${o.after??60}"${o.line?` w:line="${o.line}" w:lineRule="exact"`:''}/>${o.jc?`<w:jc w:val="${o.jc}"/>`:''}</w:pPr>${runs}</w:p>`;}
function TBL(cols,rows,borders,o={}){const W=cols.reduce((a,b)=>a+b,0);
  return `<w:tbl><w:tblPr>${DOC.rtl&&o.vis!==false?'<w:bidiVisual/>':''}<w:tblW w:type="dxa" w:w="${W}"/>${o.center!==false?'<w:jc w:val="center"/>':''}<w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map(c=>`<w:gridCol w:w="${c}"/>`).join('')}</w:tblGrid>${rows.map(r=>`<w:tr><w:trPr>${o.split?'':'<w:cantSplit/>'}${o.h?`<w:trHeight w:val="${o.h}" w:hRule="atLeast"/>`:''}</w:trPr>${r}</w:tr>`).join('')}</w:tbl>`;}
/* mixed Arabic / English / equation text: every LTR piece (English, numbers, equations) is kept as ONE left-to-right block inside Arabic text */
const CORE='A-Za-z0-9\\u00C0-\\u024F\\u0370-\\u03FF\\u2070-\\u209F\\u2190-\\u21FF\\u2200-\\u22FF\\u25B3\\u2220\\u00B0\\u00B1\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE\\u2102\\u2115\\u211A\\u211D\\u2124';
const PUNC='=+\\-\\u2013\\u2014*^<>/:;.,\'\\u2019"()\\[\\]{}|%!?_~\\u00D7\\u00F7\\u00B7';
const LT_RE=new RegExp('(?:[(\\[{\\-=+<>*^/|~_][ \\u00A0]?)*['+CORE+'](?:[ \\u00A0]?['+CORE+PUNC+'])*','g');
function trimChunk(s){let a=0,b=s.length;
  for(let k=0;k<6;k++){
    while(b>a&&/[\s\u00A0(\[{.,:;?\-+=<>*^\/|~_"\u2013\u2014]/.test(s[b-1]))b--;
    const c=s[b-1],op={')':'(',']':'[','}':'{'}[c];
    if(op&&!s.slice(a,b-1).includes(op))b--;else break;}
  while(a<b&&/[(\[{]/.test(s[a])){const cl={'(':')','[':']','{':'}'}[s[a]];if(s.slice(a+1,b).includes(cl))break;a++;}
  return [a,b];}
function txtRun(t,ar,o={}){return `<w:r>${rPr({font:STYLE.qFont,...o,sz:o.sz||DOC.qsz},ar)}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;}
function txtPara(line,o={}){
  line=String(line).normalize('NFC').replace(BIDI_CTL,'');
  const d=o.dir||DOC.pdir,strong=line.match(/[A-Za-z\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/);
  const rtl=d==='rtl'?true:d==='ltr'?false:!!(strong&&AR_RE.test(strong[0]));
  const st={b:o.b,i:o.i,color:o.color,sz:o.sz||DOC.qsz,font:o.font},out=[],W=rtl?'\u200E':'',W2=rtl?'\u200E':'';
  const LTR=(s,so)=>{if(!s)return;if(rtl&&DOC.minus)s=s.replace(/\u2212/g,'-');const q={...st,...(so||{})};
    if(o.mathI){const ps=s.split(/(\b[a-z]\b)/g).filter(Boolean);ps.forEach((p,k)=>out.push(txtRun((k===0?W:'')+p+(k===ps.length-1?W2:''),false,{...q,i:/^[a-z]$/.test(p)?true:q.i})));}
    else out.push(txtRun(W+s+W2,false,q));};
  const TXT=s=>{if(!s)return;s.split(AR_SEG).filter(Boolean).forEach(p=>{const ar=AR_RE.test(p);out.push(txtRun(ar&&!rtl?'\u200F'+p+'\u200F':p,ar,st));});};
  let rest=line;
  if(o.pre){out.push(txtRun(W+o.pre+W2,false,{...st,...(o.preO||{})}));out.push(txtRun(' ',false,st));}
  else if(rtl&&o.label!==false){const lm=rest.match(/^\s*(\(?[A-Za-z\d]{1,3}[.)])\s+(?=\S)/);
    if(lm){out.push(txtRun(W+lm[1]+W2,false,st));out.push(txtRun(' ',false,st));rest=rest.slice(lm[0].length);}}
  let last=0,m;LT_RE.lastIndex=0;
  while((m=LT_RE.exec(rest))){const [a,b]=trimChunk(m[0]);
    if(b<=a){LT_RE.lastIndex=m.index+Math.max(1,m[0].length);continue;}
    TXT(rest.slice(last,m.index+a));LTR(m[0].slice(a,b));last=m.index+b;LT_RE.lastIndex=Math.max(last,m.index+1);}
  TXT(rest.slice(last));
  const hasAr=AR_RE.test(rest),al=o.jc||((o.eq&&DOC.eq==='center'&&!hasAr)?'center':null);
  return `<w:p><w:pPr>${o.keep?'<w:keepNext/><w:keepLines/>':''}${rtl?'<w:bidi/>':''}<w:spacing w:before="${o.before??0}" w:after="${o.after??40}" w:line="${o.line||264}" w:lineRule="auto"/>${al?`<w:jc w:val="${al}"/>`:''}</w:pPr>${out.join('')}</w:p>`;}
function TXL(t,o={}){return String(t==null?'':t).replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim()).map((l,i)=>txtPara(l,i?{...o,pre:undefined,preO:undefined}:o)).join('');}
const TX=(t,o={})=>TXL(t,{eq:true,...o});

/* ───────── v10 blocks: badge, answers, question cell, references ───────── */
function badge(q){const st=q.badge||DOC.badge,num=String(q.num),pg=String(q.bookPage??'');
  if(st==='none')return '';
  if(st==='plain')return P(R(num+'.',{b:true,color:STYLE.red,sz:28}),{jc:'center',after:0,bidi:false})+P(R(pg,{b:true,color:STYLE.blue,sz:20}),{jc:'center',after:0,bidi:false});
  if(st==='solid')return TBL([777],[TC(777,P(R(num,{b:true,color:'FFFFFF',sz:26}),{jc:'center',after:0,bidi:false})+P(R(pg,{b:true,color:'FFE9A8',sz:20}),{jc:'center',after:0,bidi:false}),{fill:STYLE.red,m:40})],B(STYLE.red,8),{center:false,vis:false})+SP(20);
  if(st==='outline')return TBL([777],[TC(777,P(R(num,{b:true,color:STYLE.navy,sz:26}),{jc:'center',after:0,bidi:false})+P(R(pg,{b:true,color:STYLE.grey,sz:20}),{jc:'center',after:0,bidi:false}),{m:40})],B(STYLE.navy,12),{center:false,vis:false})+SP(20);
  return TBL([777],[TC(777,P(R(num,{b:true,color:STYLE.red,sz:26}),{jc:'center',after:0,pbdr:['262626',12],bidi:false})+P(R(pg,{b:true,color:STYLE.blue,sz:22}),{jc:'center',after:0,bidi:false}),{fill:STYLE.badgeFill,m:20})],B(STYLE.badgeBorder,12).replace(/<w:insideH[^>]*\/><w:insideV[^>]*\/>/,''),{center:false,vis:false})+SP(20);}
const LNST={solid:'single',single:'single',dotted:'dotted',dashed:'dashed'};
const LINES=(n,q)=>{const st=LNST[(q&&q.lineStyle)||DOC.lineStyle]||'single',k=(q&&q.lineGap?({narrow:.8,normal:1,wide:1.3}[q.lineGap]):DOC.lineK)||1,h=Math.round(LH*k);
  return Array.from({length:n},()=>`<w:p><w:pPr><w:pBdr><w:bottom w:val="${st}" w:sz="4" w:space="1" w:color="A6A6A6"/><w:between w:val="${st}" w:sz="4" w:space="1" w:color="A6A6A6"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/></w:pPr></w:p>`).join('');};
const SPACE=n=>Array.from({length:n},()=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${LH}" w:lineRule="exact"/></w:pPr></w:p>`).join('');
function answerBlock(a,q,w){
  const n=q.lines||3,g=Math.min(w-200,q.cols==1?3200:q.cols==2?2500:2300);
  switch(a){
    case 'none':return '';
    case 'lines':return LINES(n,q);
    case 'dots':return LINES(n,{...q,lineStyle:'dotted'});
    case 'space':return SPACE(n);
    case 'box':return TBL([w-100],[TC(w-100,P('',{after:0}),{m:20})],B('7F7F7F',6),{center:false,vis:false,h:Math.round(Math.max(1,n)*LH)})+SP(40);
    case 'graph':return GRID(g);
    case 'graph2':{const hw=Math.floor((w-60)/2),gs=Math.min(hw-120,q.cols==1?2900:2300);if(!GRID_RID)GRID_RID=addImage(gridImage());
      return TBL([hw,hw],[TC(hw,GRID(gs),{m:20})+TC(hw,GRID(gs),{m:20})],NOB,{center:false,vis:false});}
    case 'graph-lines':return GRID(g)+LINES(n,q);
    case 'table-graph':{const tw=Math.min(1300,Math.floor(w*0.32)),gw=w-tw-60,gs=Math.min(gw-100,q.cols==1?3200:2600);
      return TBL([tw,gw],[TC(tw,XYTABLE(tw-40),{m:20,v:'center'})+TC(gw,P(IMG(GRID_RID||(GRID_RID=addImage(gridImage())),gs/1440,gs/1440),{jc:'center',after:0,bidi:false}),{m:20,v:'center'})],NOB,{center:false,vis:false});}
    case 'numberline':case 'numberline-lines':{if(!NL_RID)NL_RID=addImage(numberLineImage());const lw=Math.min(w-150,6000);
      const nl=P(IMG(NL_RID,lw/1440,lw/1440*130/1200),{jc:'center',before:60,after:60,bidi:false});
      return a==='numberline'?nl:LINES(n,q)+nl;}
    case 'table-fill':return TABLEFILL(w-200);
  }
  return LINES(n,q);}
function figImg(f,maxW,maxH){const z=figSize(f,maxW,maxH);return P(IMG(addImage(f.png),z.w/1440,z.h/1440),{jc:'center',after:40,bidi:false});}
function questionCell(q,cellW){
  const st=q.badge||DOC.badge,noB=st==='none',badgeW=noB?0:900,bodyW=cellW-badgeW,inner=bodyW-120;
  const useTxt=$('qMode').value==='text'&&typeof q.text==='string'&&q.text.trim()!=='';
  if(!QUIET&&$('qMode').value==='text'&&!useTxt)log('log3',`Q${q.num}: no "text" from the AI — using the cropped image instead`,'warn');
  const figs=(q.figures||[]).filter(f=>f.png),hasF=figs.length>0,figW=hasF?Math.round(inner*0.4):0,txtW=hasF?inner-figW-100:inner;
  const pcs=q.pieces||[{png:q.png,pxW:q.pxW,pxH:q.pxH,ptW:q.ptW}];
  let left='',leftH=0;
  if(useTxt){const tw=Math.max(1200,txtW-60);left=P(TEXTBOX(q.text,tw),{after:40,bidi:false});leftH=textBoxPt(q.text,tw)*20+40+60;}
  else if(pcs[0]&&pcs[0].png){left=pcs.map(p=>{const wi=Math.min(txtW-60,p.ptW*21)/1440,hi=wi*p.pxH/p.pxW;leftH+=hi*1440+40+60;return P(IMG(addImage(p.png),wi,hi),{after:40,bidi:false});}).join('');}
  else left=P(R(LB('missing'),{color:STYLE.red}));
  let body=refBlock(q,inner);
  if(hasF){
    const figH=figs.reduce((a,f)=>a+figSize(f,figW-40,FIG_MAXH).h+40+60,0),n=Math.max(0,Math.min(14,Math.floor((figH-leftH-100)/(LH+30))));
    if(n>0)left+=LINES(n,q);
    const a=TC(txtW+40,left,{m:20}),b=TC(figW+60,figs.map(f=>figImg(f,figW-40,FIG_MAXH)).join(''),{m:20,v:'center'});
    body+=DOC.figSide==='start'?TBL([figW+60,txtW+40],[b+a],NOB,{center:false}):TBL([txtW+40,figW+60],[a+b],NOB,{center:false});
  }else body+=left;
  [].concat(q.answer||'lines').forEach(a=>{body+=answerBlock(a,q,bodyW-80);});
  return KEEP(noB?TBL([bodyW],[TC(bodyW,body,{m:40})],NOB,{center:false}):TBL([badgeW,bodyW],[TC(badgeW,badge(q),{m:40})+TC(bodyW,body,{m:40})],NOB,{center:false}));}
function refBlock(q,w){if(!q.refText&&!(q.refFigures||[]).length)return '';
  let c=P(R('📎 '+(q.refLabel||LB('ref')),{b:true,color:STYLE.orange,sz:20}),{after:30});
  if(q.refText)c+=TXL(q.refText);
  c+=figBlock((q.refFigures||[]).filter(f=>f.png),w-300);
  return TBL([w],[TC(w,c,{fill:'FFF8EE',m:60})],B('E36C0A',6),{center:false})+SP(60);}

/* ───────── v10 solved examples: free order, many step styles, bidi-safe steps ───────── */
const PALS={teal:['0F4C5C','E09F3E','2D6A4F'],blue:['1F4E79','E36C0A','2E7D32'],green:['2E5E3E','E0A030','1B5E20'],orange:['9C4A0B','1F6F8B','2D6A4F'],purple:['4A2C7A','E09F3E','2D6A4F'],navy:['1F3864','C00000','2D6A4F'],red:['8E1B1B','1F6F8B','2D6A4F'],grey:['404040','E09F3E','2D6A4F']};
const lighten=(h,p)=>{const n=parseInt(h,16),c=[n>>16&255,n>>8&255,n&255].map(v=>Math.round(v+(255-v)*p));return c.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();};
function palOf(name){const [d,a,s]=PALS[name]||PALS.teal;return {dark:d,accent:a,sol:s,soft:lighten(d,.9),solSoft:lighten(s,.9),ans:'FFF3D6',bord:lighten(d,.72),sbord:lighten(s,.72)};}
const SV=palOf('teal');
function numLabel(k,st){if(st==='letters')return String.fromCharCode(97+k%26);if(st==='ar')return ['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'][k%10];return String(k+1);}
/* split the solution into sub-parts (a. / b. / c.) and steps */
function parseSteps(sol,split){
  let L=(Array.isArray(sol)?sol:String(sol==null?'':sol).replace(/\r\n?/g,'\n').split('\n')).map(s=>String(s)).filter(l=>l.trim());
  if(L.length&&L.every(l=>/^\s*\d{1,2}[.)]\s+\S/.test(l)))L=L.map(l=>l.replace(/^\s*\d{1,2}[.)]\s+/,''));   /* the program numbers the steps itself */
  const out=[];let hasPart=false;
  L.forEach(l=>{const m=split&&l.match(/^\s*\(?([A-Za-z]|[\u0623\u0628\u062C\u062F])[.)]\s*(.*)$/);
    if(m){out.push({hdr:m[1]+'.'});hasPart=true;if(m[2].trim())out.push({t:m[2]});}else out.push({t:l});});
  const groups=[];let cur=null;
  out.forEach(s=>{if(s.hdr){cur={hdr:s.hdr,items:[]};groups.push(cur);}else{if(!cur){cur={hdr:null,items:[]};groups.push(cur);}cur.items.push(s.t);}});
  return {groups,hasPart};}
function stepsXml(groups,style,inW,pal,o){
  const ns=o.numStyle,hl=o.hl,none=ns==='none'||style==='compact',tOpt=(last)=>({eq:true,after:0,b:hl&&last?true:undefined});
  const one=g=>g.hdr&&g.items.length===1;
  const hdrP=h=>P(R(h,{b:true,color:pal.sol,sz:DOC.sz+2}),{after:30,before:40,keep:true,pbdr:[pal.sbord,6],bidi:false,jc:DOC.rtl?'right':null});
  let x='';
  if(style==='rows'){
    const rows=[];
    groups.forEach(g=>{if(g.hdr&&!one(g))rows.push(TC(inW,P(R(g.hdr,{b:true,color:pal.sol,sz:DOC.sz}),{after:0,bidi:false,jc:DOC.rtl?'right':null}),{span:none?1:2,fill:lighten(pal.sol,.8),m:40}));
      g.items.forEach((t,k)=>{const last=hl&&k===g.items.length-1&&g.items.length>1;
        if(ns==='none')rows.push(TC(inW,txtPara(t,{...tOpt(last),eq:true}),{fill:last?pal.ans:'FFFFFF',v:'center',m:50}));
        else rows.push(TC(520,P(R(one(g)?g.hdr:numLabel(k,ns),{b:true,color:'FFFFFF',sz:20}),{jc:'center',after:0,bidi:false}),{fill:last?pal.sol:pal.accent,v:'center',m:50})+TC(inW-520,txtPara(t,tOpt(last)),{fill:last?pal.ans:'FFFFFF',v:'center',m:50}));});});
    return TBL(ns==='none'?[inW]:[520,inW-520],ns==='none'?rows:rows.map(r=>r),B(pal.sbord,4),{center:false});}
  if(style==='boxes'||style==='flow'){
    groups.forEach(g=>{if(g.hdr&&!one(g))x+=hdrP(g.hdr);
      g.items.forEach((t,k)=>{const last=hl&&k===g.items.length-1&&g.items.length>1,pre=ns==='none'?{}:{pre:(one(g)?g.hdr:numLabel(k,ns)+')'),preO:{b:true,color:pal.accent}};
        x+=TBL([inW],[TC(inW,txtPara(t,{...tOpt(last),...pre}),{fill:last?pal.ans:'FFFFFF',m:60})],B(last?pal.sol:pal.sbord,last?10:6),{center:false});
        if(style==='flow'&&k<g.items.length-1)x+=P(R('▼',{color:pal.accent,sz:16}),{jc:'center',after:0,bidi:false});else x+=SP(40);});});
    return x;}
  if(style==='cols2'){
    const flat=[];groups.forEach(g=>{if(g.hdr)flat.push({h:g.hdr});g.items.forEach((t,k)=>flat.push({t,k,last:hl&&k===g.items.length-1&&g.items.length>1}));});
    const half=Math.ceil(flat.length/2),hw=Math.floor(inW/2),cell=a=>a.map(s=>s.h?hdrP(s.h):txtPara(s.t,{...tOpt(s.last),...(ns==='none'?{}:{pre:numLabel(s.k,ns)+')',preO:{b:true,color:pal.accent}})})).join('');
    return TBL([hw,hw],[TC(hw,cell(flat.slice(0,half)),{m:40})+TC(hw,cell(flat.slice(half)),{m:40})],NOB,{center:false});}
  /* plain · dots · compact */
  groups.forEach(g=>{if(g.hdr&&!one(g))x+=hdrP(g.hdr);
    g.items.forEach((t,k)=>{const last=hl&&k===g.items.length-1&&g.items.length>1;
      const pre=style==='dots'?{pre:'●',preO:{color:pal.accent,sz:16}}:(none?{}:{pre:(one(g)?g.hdr:numLabel(k,ns)+')'),preO:{b:true,color:pal.accent}});
      x+=txtPara(t,{...tOpt(last),...pre,after:style==='compact'?20:70});});});
  return x;}
function solvedBlock(e,W){
  const pal=palOf(e.color||DOC.pal),useTxt=$('qMode').value==='text',inW=W-200,side=(e.layout||'stacked')==='side';
  const label=e.label||LB('example'),pg=LB('page')+' '+(e.bookPage??''),hs=e.header||'bar';
  let head;
  if(hs==='line')head=P(R(label+'    ',{b:true,color:pal.dark,sz:28})+R(pg,{b:true,color:pal.accent,sz:20}),{pbdr:[pal.dark,14],keep:true,after:60});
  else if(hs==='tag')head=TBL([4200],[TC(4200,P(R(label+'    ',{b:true,color:'FFFFFF',sz:26})+R(pg,{b:true,color:'F4D9A6',sz:20}),{after:0,keep:true}),{fill:pal.dark,m:70})],NOB,{center:false,vis:true})+SPK(30);
  else head=TBL([W],[TC(W,P(R(label+'     ',{b:true,color:'FFFFFF',sz:28})+R(pg,{b:true,color:'F4D9A6',sz:20}),{after:0,keep:true}),{fill:pal.dark,m:80})],NOB,{center:false});
  const colW=side?Math.floor(W/2)-120:inW;
  const figs=(e.figures||[]).filter(f=>f.png&&!(e.qImg&&!useTxt&&f.pdfPage===e.pdfPage&&e.bbox&&overlap(e.bbox,f.bbox)>0.6)),hasF=figs.length>0,fw=hasF?Math.round(colW*0.38):0,lw=hasF?colW-fw:colW;
  const q1=useTxt&&e.text?TX(e.text):e.qImg?figImg(e.qImg,lw-200):e.text?TX(e.text):'';
  const figX=hasF?(DOC.figSide==='start'?TBL([fw,lw],[TC(fw,figs.map(f=>figImg(f,fw-120)).join(''),{m:20,v:'center'})+TC(lw,q1,{m:20})],NOB,{center:false}):TBL([lw,fw],[TC(lw,q1,{m:20})+TC(fw,figs.map(f=>figImg(f,fw-120)).join(''),{m:20,v:'center'})],NOB,{center:false})):q1;
  const probIn=P(R(LB('problem'),{b:true,color:pal.dark,sz:18}),{after:30,keep:true})+figX;
  const useSol=e.solution&&!(!useTxt&&e.sImg);let solIn='';
  if(e.showSolution!==false){
    solIn=P(R(LB('solution'),{b:true,color:pal.sol,sz:18}),{after:30,keep:true});
    if(useSol){const ps=parseSteps(e.solution,e.splitParts!=null?YN(e.splitParts):DOC.parts),st=e.stepStyle||DOC.stepStyle;
      solIn+=stepsXml(ps.groups,st,colW,pal,{numStyle:e.numbering||DOC.numStyle,hl:e.highlight!=null?YN(e.highlight):DOC.hl});}
    else if(e.sImg)solIn+=figImg(e.sImg,colW-200);
    if(e.note)solIn+=SP(40)+TBL([colW],[TC(colW,P(R(LB('note')+': ',{b:true,color:pal.dark,sz:DOC.sz-2}),{after:20,keep:true})+TX(e.note,{sz:DOC.sz}),{fill:pal.ans,m:60})],B('E0C070',6),{center:false});}
  const PB=B(pal.bord,6),SB=B(pal.sbord,6);
  if(side&&e.showProblem!==false&&e.showSolution!==false){const hw=Math.floor(W/2);
    return KEEP(head+SP(40))+TBL([hw,hw],[TC(hw,probIn,{fill:pal.soft,m:90})+TC(hw,solIn,{fill:pal.solSoft,m:90})],B(pal.bord,6),{center:false})+SP(220);}
  let out=KEEP(head+SP(40)+(e.showProblem!==false?TBL([W],[TC(W,probIn,{fill:pal.soft,m:90})],PB,{center:false})+SP(40):''));
  if(solIn)out+=TBL([W],[TC(W,solIn,{fill:pal.solSoft,m:90})],SB,{center:false,split:(e.solution||'').split('\n').length>8});
  return out+SP(220);}

/* ───────── v10 layout blocks: sections, goals, key concepts, text, order ───────── */
function sectionBar(it,W=STYLE.contentW){
  const col=GCOL[it.color]||STYLE.blue,st=it.style||'bar',parts=[it.title,it.examples].filter(Boolean);
  const runs=(parts.length?R(parts.join('   ')+'   ',{b:true,color:col,sz:22}):'')+(it.topics||[]).map(t=>R(t,{b:true,color:STYLE.orange,sz:22})).join(R('  |  ',{b:true,color:STYLE.grey,sz:22}));
  if(st==='line')return P(runs,{pbdr:[col,8],keep:true,after:60})+SPK(40);
  if(st==='pill')return TBL([W],[TC(W,P(runs,{after:0,keep:true}),{fill:lighten(col,.88),m:60})],B(col,6),{center:false})+SPK(60);
  return TBL([W],[TC(W,P(runs,{after:0,keep:true}),{fill:it.color?lighten(col,.85):'DEEAF1',m:50})],NOB)+SPK(60);}
const GCOL={red:'C00000',blue:'0070C0',green:'2E7D32',orange:'E36C0A',teal:'1F6F8B',navy:'1F3864',purple:'6A3D9A',grey:'595959'};
const GSTYLES=['classic','banner','checklist','cards','numbered','arrow','columns','minimal','ribbon','boxed'];
function goalsBlock(it,W){
  const g=(it.items||[]).map(String),hd=it.heading!=null?it.heading:(it.title!=null?it.title:LB('goals')),col=GCOL[it.color]||STYLE.goalsFill,st=GSTYLES.includes(it.style)?it.style:'classic',GB=B(STYLE.goalsBorder),sz=it.size?it.size*2:DOC.sz;
  const G=(k,o={})=>TXL(g[k],{sz,mathI:true,after:30,...o}),GN=(k,o={})=>TXL(g[k],{sz,mathI:true,after:30,pre:`${k+1}-`,preO:{b:true,color:col},...o});
  const H=hd?P(R(hd,{b:true,color:col,sz:28}),{keep:true,after:60}):'';
  switch(st){
  case 'banner':return TBL([W],[hd?TC(W,P(R(hd,{b:true,color:'FFFFFF',sz:26}),{jc:'center',after:0}),{fill:col,m:80}):'',...g.map((_,k)=>TC(W,GN(k,{after:0}),{fill:k%2?'FFFFFF':'F7F7F7',m:60}))].filter(Boolean),GB,{center:false})+SP();
  case 'checklist':return (hd?P(R(hd,{b:true,color:col,sz:28}),{pbdr:[col,12],keep:true,after:80}):'')+g.map((_,k)=>G(k,{pre:'☐',preO:{b:true,color:col,sz:26},keep:true,after:50})).join('')+SP();
  case 'cards':{const n=Math.min(3,Math.max(1,g.length)),cw=Math.floor(W/n),rows=[];
    for(let i=0;i<g.length;i+=n){const sl=g.slice(i,i+n);rows.push(sl.map((_,j)=>TC(cw,P(R(String(i+j+1),{b:true,color:col,sz:40}),{after:0,jc:'center',bidi:false})+G(i+j,{after:0,jc:'center'}),{fill:j%2?'EAF3F5':'FFF2CC',m:90})).join('')+(sl.length<n?TC(cw*(n-sl.length),P('',{after:0}),{span:n-sl.length}):''));}
    return H+TBL(Array(n).fill(cw),rows,B(col,8),{center:false})+SP();}
  case 'numbered':return H+TBL([900,W-900],g.map((_,k)=>TC(900,P(R(String(k+1),{b:true,color:'FFFFFF',sz:32}),{jc:'center',after:0,bidi:false}),{fill:col,v:'center',m:70})+TC(W-900,G(k,{after:0}),{v:'center',fill:k%2?'FFFFFF':'F7F7F7',m:70})),GB,{center:false})+SP();
  case 'arrow':return H+g.map((_,k)=>G(k,{pre:'➤',preO:{b:true,color:col},keep:true,after:50})).join('')+SP();
  case 'columns':{const hw=Math.floor(W/2),rows=[];for(let i=0;i<g.length;i+=2)rows.push(TC(hw,GN(i,{after:0}),{m:70})+TC(hw,g[i+1]!=null?GN(i+1,{after:0}):P('',{after:0}),{m:70}));return H+TBL([hw,hw],rows,B(col,6),{center:false})+SP();}
  case 'minimal':return H+g.map((_,k)=>G(k,{pre:'●',preO:{color:col,sz:18},keep:true,after:40})).join('')+SP();
  case 'ribbon':return TBL([W],[TC(W,P(R('★  '+hd+'  ★',{b:true,color:col,sz:26}),{jc:'center',after:0}),{fill:'FFF2CC',m:70}),TC(W,g.map((_,k)=>GN(k)).join(''),{m:80})],B(col,12),{center:false})+SP();
  case 'boxed':return H+g.map((_,k)=>TBL([W],[TC(W,GN(k,{after:0}),{fill:'FFFFFF',m:70})],B(col,8),{center:false})+SP(40)).join('')+SP();
  default:return TBL([2232,W-2232],[TC(2232,P(R(hd||LB('goals'),{b:true,color:'FFFFFF',sz:24}),{jc:'center',after:0}),{fill:col,v:'center',m:80})+TC(W-2232,g.map((_,k)=>GN(k)).join(''),{m:80})],GB,{center:false})+SP();}}
function kcBlock(it,W){
  const col=GCOL[it.color]||STYLE.teal,head=lighten(col,.85),term=lighten(col,.94),bd=lighten(col,.55),rows=(it.rows||[]).map(r=>[].concat(r).map(String)),st=it.style||'table',sz=it.size?it.size*2:DOC.sz;
  const T=(t,o={})=>TXL(t,{sz,mathI:true,after:0,...o}),ttl=it.title?TXL(it.title,{b:true,color:col,sz:24,after:0,keep:true}):'';
  if(st==='list')return (it.title?P(R(it.title,{b:true,color:col,sz:26}),{pbdr:[col,10],keep:true,after:80}):'')+rows.map(r=>r.length>1?TXL(r[0],{sz,b:true,color:STYLE.navy,mathI:true,after:10,keep:true})+TXL(r.slice(1).join('\n'),{sz,mathI:true,after:70}):TXL(r[0],{sz,mathI:true,after:70})).join('')+SP();
  if(st==='cards'){const hw=Math.floor(W/2),cells=rows.map((r,k)=>TC(hw,(r.length>1?T(r[0],{b:true,color:col,after:20}):'')+T(r.slice(r.length>1?1:0).join('\n'),{}),{fill:k%2?'F7F7F7':head,m:80})),trs=[];
    for(let i=0;i<cells.length;i+=2)trs.push(cells[i]+(cells[i+1]||TC(hw,P('',{after:0}),{})));
    return (ttl?P(R(it.title,{b:true,color:col,sz:26}),{keep:true,after:60}):'')+TBL([hw,hw],trs,B(bd,6),{center:false})+SP();}
  if(st==='boxed')return TBL([W],[TC(W,(ttl?ttl+SP(40):'')+rows.map(r=>(r.length>1?T(r[0],{b:true,color:STYLE.navy,after:10,keep:true}):'')+T(r.slice(r.length>1?1:0).join('\n'),{after:60})).join(''),{fill:term,m:90})],B(col,10),{center:false})+SP();
  const tw=Math.min(2520,Math.floor(W*0.26));
  return TBL([tw,W-tw],[ttl?TC(W,ttl,{span:2,fill:head,m:50}):'',...rows.map(r=>r.length>1?TC(tw,T(r[0],{b:true,color:STYLE.navy}),{fill:term,v:'center'})+TC(W-tw,T(r.slice(1).join('\n')),{}):TC(W,T(r[0]),{span:2}))].filter(Boolean),B(bd),{center:false})+SP();}
function lessonBlock(it,W){const col=GCOL[it.color]||STYLE.blue,st=it.style||'underline',t=it.title||'';
  if(st==='banner')return TBL([W],[TC(W,P(R(t,{b:true,color:'FFFFFF',sz:36}),{after:0,keep:true}),{fill:GCOL[it.color]||STYLE.navy,m:110})],NOB,{center:false})+SPK(120);
  if(st==='box')return TBL([W],[TC(W,P(R(t,{b:true,color:GCOL[it.color]||STYLE.navy,sz:36}),{after:0,jc:'center',keep:true}),{fill:lighten(col,.9),m:100})],B(col,14),{center:false})+SPK(120);
  if(st==='simple')return P(R(t,{b:true,color:GCOL[it.color]||STYLE.navy,sz:38}),{before:120,after:140,keep:true});
  return P(R(t,{b:true,color:STYLE.navy,sz:40}),{pbdr:[col,18],before:120,after:160,keep:true});}
function partBlock(it,W){const col=GCOL[it.color]||STYLE.navy,st=it.style||'banner',t=it.title||it.text||'';
  if(st==='underline')return P(R(t,{b:true,color:col,sz:36}),{pbdr:[col,18],before:160,after:140,keep:true});
  if(st==='center')return P(R(t,{b:true,color:col,sz:40}),{jc:'center',before:200,after:160,keep:true});
  return TBL([W],[TC(W,P(R(t,{b:true,color:'FFFFFF',sz:32}),{jc:'center',after:0,keep:true}),{fill:col,m:100})],NOB,{center:false})+SPK(100);}
function textBlock(it,W){const st=it.style||'plain',sz=it.size?it.size*2:DOC.sz+2,cm={note:'0070C0',tip:'2E7D32',warning:'E36C0A'},col=GCOL[it.color]||cm[st]||STYLE.navy;
  const body=TXL(it.text||it.title||'',{sz,after:50,jc:it.align==='center'?'center':null,color:it.textColor,b:it.bold});
  if(st==='plain')return body+SP(60);
  return TBL([W],[TC(W,body,{fill:lighten(col,.9),m:90})],B(col,st==='box'?8:10),{center:false})+SP(80);}
/* ordering: the AI order is respected exactly; the user can pick another placement for the solved examples */
function orderedItems(){
  const all=S.plan.items,solved=all.filter(i=>i.type==='solved'),rest=all.filter(i=>i.type!=='solved'),pl=DOC.solvedPl,head={type:'solvedHead'};
  if(pl==='end-plan')return [...rest,head,...solved];
  if(pl==='end-book')return [...rest,head,...solved.map((e,k)=>({e,k})).sort((a,b)=>((+a.e.pdfPage||0)-(+b.e.pdfPage||0))||a.k-b.k).map(z=>z.e)];
  if(pl==='start-plan')return [head,...solved,{type:'pagebreak'},...rest];
  return all;}
function buildChunks(lhOf){
  const its=orderedItems(),W=STYLE.contentW,ch=[];let x='';
  const flush=()=>{ch.push({xml:x});x='';},PGB=`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  if(DOC.cover){
    x+=P(R($('mTitle').value,{b:true,color:STYLE.navy,sz:56}),{jc:'center',after:0,before:1600});
    x+=P(R($('mSub').value,{b:true,color:STYLE.red,sz:48}),{jc:'center',after:0});
    x+=P(R($('mGrade').value,{b:true,color:STYLE.blue,sz:36}),{jc:'center',after:0});
    x+=PGB;flush();}
  for(let i=0;i<its.length;i++){const it=its[i];x='';LH=lhOf(ch.length);
    switch(it.type){
      case 'lesson':x+=lessonBlock(it,W);break;
      case 'part':x+=partBlock(it,W);break;
      case 'text':x+=textBlock(it,W);break;
      case 'spacer':x+=SP(+it.size||300);break;
      case 'goals':x+=goalsBlock(it,W);
        if(it.keyHeading!==false&&it.keyHeading!=='')x+=P(R(typeof it.keyHeading==='string'?it.keyHeading:LB('keyTitle'),{b:true,color:STYLE.teal,sz:28}),{keep:true,after:80});break;
      case 'points':x+=goalsBlock({...it,heading:it.heading!=null?it.heading:(it.title||'')},W);break;
      case 'keyconcept':x+=kcBlock(it,W);break;
      case 'practice':x+=P(R(LB('practice'),{b:true,color:STYLE.orange,sz:44})+R('        '+LB('practiceSub'),{b:true,color:STYLE.grey,sz:20,font:'Book Antiqua'}),{pbdr:[STYLE.orange,12],keep:true});
        if(it.examples||it.topics||it.title)x+=sectionBar(it,W);break;
      case 'section':x+=sectionBar(it,W);break;
      case 'instruction':{const col=GCOL[it.color]||STYLE.red;
        x+=it.style==='box'?TBL([W],[TC(W,TXL(it.text,{b:true,color:col,sz:24,after:0,keep:true}),{fill:lighten(col,.92),m:70})],B(col,8),{center:false})+SPK(60):TXL(it.text,{b:true,color:col,sz:24,before:60,keep:true});break;}
      case 'solvedHead':x+=(i>0?PGB:'')+P(R(LB('solvedTitle'),{b:true,color:palOf(DOC.pal).dark,sz:44})+R('        '+LB('solvedSub'),{b:true,color:STYLE.grey,sz:20,font:'Book Antiqua'}),{pbdr:[palOf(DOC.pal).accent,18],keep:true,after:160});break;
      case 'solved':x+=solvedBlock(it,W);break;
      case 'pagebreak':x+=PGB;break;
      case 'question':{normQ(it);const row=[it];
        const ec=z=>(z.figures||[]).some(f=>f.png)?1:z.cols;while(row.length<ec(it)&&its[i+1]&&its[i+1].type==='question'){normQ(its[i+1]);if(ec(its[i+1])===1)break;row.push(its[++i]);}
        x+=row.length===1?questionCell(it,W)+P('',{pbdr:['7F7F7F',6],after:120}):questionRow(row,W);
        break;}
    }
    flush();prog('prog3',.2+.6*(i/its.length));}
  return ch;}

/* ───────── page fill: estimate the layout, then stretch the ruled lines on pages that end with empty space ───────── */
let _dp=null;
function parseXml(x){if(!_dp)_dp=new DOMParser();
  return _dp.parseFromString(`<r ${NS} xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">${x}</r>`,'application/xml').documentElement;}
const A_=(e,n)=>e?e.getAttribute(n):null;
const KIDS=(e,t)=>e?Array.from(e.children).filter(c=>c.tagName===t):[];
const KID=(e,t)=>KIDS(e,t)[0]||null;
function estPara(p,w){
  const pPr=KID(p,'w:pPr'),sp=KID(pPr,'w:spacing');
  const bef=+(A_(sp,'w:before')||0),aft=A_(sp,'w:after')!=null?+A_(sp,'w:after'):60,ln=+(A_(sp,'w:line')||264),exact=A_(sp,'w:lineRule')==='exact';
  let bdr=0,isLine=false;const pb=KID(pPr,'w:pBdr');
  if(pb){const b=KID(pb,'w:bottom');if(b)bdr=(+(A_(b,'w:space')||0))*20+(+(A_(b,'w:sz')||4))*2.5;isLine=!!KID(pb,'w:between');}
  let chars=0,sz=0;
  for(const r of KIDS(p,'w:r')){const t=KID(r,'w:t');if(t){chars+=t.textContent.length;sz=Math.max(sz,+A_(KID(KID(r,'w:rPr'),'w:sz'),'w:val')||22);}}
  sz=sz||22;
  const imgH=Math.max(0,...Array.from(p.getElementsByTagName('wp:extent')).map(e=>+A_(e,'cy')/635));
  const lineH=exact?ln:sz*11.7*ln/240,nl=chars?Math.max(1,Math.ceil(chars*sz*5/Math.max(300,w))):1;
  const textH=(chars||!imgH)?nl*lineH:0,content=Math.max(imgH?imgH+60:0,textH);
  return {h:bef+aft+content+bdr,L:isLine?1:0,keep:!!KID(pPr,'w:keepNext'),pb:Array.from(p.getElementsByTagName('w:br')).some(b=>A_(b,'w:type')==='page')};}
function estTable(t){
  const rows=[];
  for(const tr of KIDS(t,'w:tr')){let rh=0,rl=0;
    for(const tc of KIDS(tr,'w:tc')){const pr=KID(tc,'w:tcPr'),mar=KID(pr,'w:tcMar');
      const tcw=+A_(KID(pr,'w:tcW'),'w:w')||3000,mt=+A_(KID(mar,'w:top'),'w:w')||0,mb=+A_(KID(mar,'w:bottom'),'w:w')||0,ml=+A_(KID(mar,'w:left'),'w:w')||0,mr=+A_(KID(mar,'w:right'),'w:w')||0;
      let ch=0,cl=0;
      for(const c of Array.from(tc.children)){
        if(c.tagName==='w:p'){const e=estPara(c,tcw-ml-mr);ch+=e.h;cl+=e.L;}
        else if(c.tagName==='w:tbl'){const e=estTable(c);ch+=e.h;cl+=e.L;}}
      if(ch+mt+mb>rh){rh=ch+mt+mb;rl=cl;}}   /* the tallest cell decides the row height (and which lines can stretch it) */
    const th=KID(KID(tr,'w:trPr'),'w:trHeight');if(th)rh=Math.max(rh,+A_(th,'w:val')||0);rows.push({h:rh+10,L:rl});}
  const ps=t.getElementsByTagName('w:p'),lp=ps[ps.length-1];
  return {rows,h:rows.reduce((a,r)=>a+r.h,0),L:rows.reduce((a,r)=>a+r.L,0),keep:!!(lp&&KID(KID(lp,'w:pPr'),'w:keepNext'))};}
function fillPlan(ch){
  const PH=STYLE.pageH-STYLE.margin.t-STYLE.margin.b,SAFE=450,MAXD=260,els=[];
  ch.forEach((c,ci)=>{for(const el of Array.from(parseXml(c.xml).children)){
    if(el.tagName==='w:tbl'){const t=estTable(el);t.rows.forEach((r,k)=>els.push({h:r.h,L:r.L,keep:k===t.rows.length-1?t.keep:false,pb:false,ci}));}
    else if(el.tagName==='w:p'){const e=estPara(el,STYLE.contentW);els.push({h:e.h,L:e.L,keep:e.keep,pb:e.pb,ci});}}});
  let cur={els:[],left:0,end:'end'};const pages=[cur];let y=0,i=0;
  while(i<els.length){const e=els[i];
    if(e.pb){cur.els.push(e);cur.left=PH-y;cur.end='break';cur={els:[],left:0,end:'end'};pages.push(cur);y=300;i++;continue;}
    let j=i,H=e.h;while(els[j].keep&&j+1<els.length&&!els[j+1].pb){j++;H+=els[j].h;}   /* keep-with-next groups move together */
    if(y+H>PH&&y>300){cur.left=PH-y;cur.end='overflow';cur={els:[],left:0,end:'end'};pages.push(cur);y=0;}
    for(let k=i;k<=j;k++)cur.els.push(els[k]);
    y+=H;i=j+1;}
  cur.left=PH-y;
  const plan=new Map();let n=0,gain=0;
  for(const pg of pages){if(pg.end!=='overflow')continue;      /* only pages that were cut because the next block did not fit */
    const usable=pg.left-SAFE;if(usable<250)continue;
    const L=pg.els.reduce((a,e)=>a+e.L,0);if(!L)continue;
    const d=Math.min(MAXD,Math.floor(usable/L/10)*10);if(d<20)continue;
    pg.els.forEach(e=>{if(e.L)plan.set(e.ci,400+d);});n++;gain+=d*L;}
  return {plan,n,pages:pages.length,gain};
}
function buildBody(){
  setupDoc();QUIET=false;LH=400;let ch=buildChunks(()=>400),info=null;
  try{info=fillPlan(ch);}catch(e){console.warn('page-fill estimate failed',e);}
  if(info&&info.plan.size){MEDIA=[];GRID_RID=null;NL_RID=null;DOCPR=100;TB_ID=500;QUIET=true;
    ch=buildChunks(ci=>info.plan.get(ci)||400);QUIET=false;
    log('log3',`Page fill: ${info.n} page(s) had empty space at the bottom — ruled lines stretched to fill it`,'ok');}
  LH=400;return ch.map(c=>c.xml).join('');
}
const NS=`xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
['qMode','qMode3'].forEach(id=>$(id).onchange=e=>{$('qMode').value=$('qMode3').value=e.target.value;});
$('buildBtn').onclick=async()=>{K.awake(true);try{await buildRun();}finally{K.awake(false);}};
async function buildRun(){
  if(!S.plan)return;TB_ID=500;DOCPR=100;$('buildBtn').disabled=true;MEDIA=[];GRID_RID=null;NL_RID=null;$('dl').style.display='none';
  try{
    prog('prog3',.1);const body=buildBody(),m=STYLE.margin;
    const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS} xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="${STYLE.pageW}" w:h="${STYLE.pageH}"/><w:pgMar w:top="${m.t}" w:right="${m.r}" w:bottom="${m.b}" w:left="${m.l}" w:header="720" w:footer="720" w:gutter="0"/>${DOC.border?'<w:pgBorders w:offsetFrom="page"><w:top w:val="single" w:sz="18" w:space="24" w:color="auto"/><w:left w:val="single" w:sz="18" w:space="24" w:color="auto"/><w:bottom w:val="single" w:sz="18" w:space="24" w:color="auto"/><w:right w:val="single" w:sz="18" w:space="24" w:color="auto"/></w:pgBorders>':''}${DOC.rtl?'<w:bidi/>':''}</w:sectPr></w:body></w:document>`;
    const hdr=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${DOC.rtl?P(R($('mTitle').value+' – '+$('mSub').value+'   |   ',{b:true,color:STYLE.navy,sz:20})+R($('mGrade').value,{b:true,color:STYLE.blue,sz:20}),{pbdr:[STYLE.blue,8],after:0}):P(R($('mTitle').value+' – '+$('mSub').value,{b:true,color:STYLE.navy,sz:20})+R('\t'+$('mGrade').value,{b:true,color:STYLE.blue,sz:20}),{pbdr:[STYLE.blue,8],after:0}).replace('</w:pBdr>','</w:pBdr><w:tabs><w:tab w:val="right" w:pos="10800"/></w:tabs>')}</w:hdr>`;
    const ftr=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr>${DOC.rtl?'<w:bidi/>':''}<w:jc w:val="center"/></w:pPr>${R(LB('footPage'),{color:STYLE.grey,sz:20})}<w:r><w:rPr><w:b/><w:color w:val="${STYLE.red}"/><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:cs="${DOC.arFont}" w:eastAsia="Cambria"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
    const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${MEDIA.map(mm=>`<Relationship Id="${mm.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mm.name}"/>`).join('')}</Relationships>`;
    const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
    const z=new JSZip();
    z.file('[Content_Types].xml',ct);
    z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    z.file('word/document.xml',doc);z.file('word/styles.xml',styles);z.file('word/header1.xml',hdr);z.file('word/footer1.xml',ftr);
    z.file('word/_rels/document.xml.rels',rels);
    MEDIA.forEach(mm=>z.file('word/media/'+mm.name,mm.data,{base64:true}));
    const blob=await z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},md=>prog('prog3',.8+.2*md.percent/100));
    const fn=($('mTitle').value+'_'+$('mSub').value).replace(/[^\w\-]+/g,'_')+'.docx';
    S.docx={name:fn,blob};DB.set('docx',S.docx).catch(()=>{});showDocx();
    log('log3',`Done: ${MEDIA.length} images, ${(blob.size/1024/1024).toFixed(2)} MB`,'ok');
  }catch(e){console.error(e);log('log3','Error: '+e.message,'err');}
  $('buildBtn').disabled=false;
}
/* ───────── session persistence: survives leaving the page / the browser reloading the tab ───────── */
const DB={open(){return new Promise((res,rej)=>{const r=indexedDB.open('mbw10',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});},
  async set(k,v){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);});},
  async get(k){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction('k').objectStore('k').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}};
const SAVE_IDS=['pFrom','pTo','pOff','mTitle','mSub','mGrade','qMode','dpi','extra','dirOpt','labelLang','solvedPl','stepStyle','numStyle','partSplit','hlLast','palette','eqAlign','figSide','badgeStyle','arFont','fontSz','lineStyle','lineGap','pgBorder','cover','minusFix'];
const d2b=u=>{const [h,b]=u.split(','),m=h.match(/:(.*?);/)[1],bin=atob(b),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:m});};
const b2d=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b);});
async function walk(o,fn){if(Array.isArray(o)){const r=[];for(const v of o)r.push(await walk(v,fn));return r;}
  if(o&&typeof o==='object'&&!(o instanceof Blob)){const r={};for(const k in o)r[k]=await walk(o[k],fn);return r;}return fn(o);}
let _sv=0,_saving=false;
function saveSoon(){clearTimeout(_sv);_sv=setTimeout(saveNow,1500);}
async function saveNow(){if(_saving)return saveSoon();_saving=true;
  try{const st={name:S.name,md:S.md,ai:$('aiIn').value,step:curStep,inp:Object.fromEntries(SAVE_IDS.map(i=>[i,$(i).value])),figc:JSON.parse(JSON.stringify(FIGC)),
      plan:S.plan?await walk(S.plan,v=>typeof v==='string'&&v.startsWith('data:image/')?d2b(v):v):null};
    await DB.set('sess',st);}catch(e){console.warn('save failed',e);}_saving=false;}
$('aiIn').addEventListener('input',saveSoon);SAVE_IDS.forEach(i=>$(i).addEventListener('change',saveSoon));
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});setInterval(()=>{if(S.plan||S.md||S.pdf)saveNow();},20000);window.addEventListener('pagehide',saveNow);
$('clr').onclick=async()=>{if(await K.confirm('مسح الجلسة المحفوظة وبدء جلسة جديدة؟')){await DB.set('sess',null);await DB.set('pdf',null);await DB.set('docx',null);location.reload();}};
(async()=>{try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
  const st=await DB.get('sess');if(!st)return;const f=await DB.get('pdf');log('log1','♻️ استرجاع الجلسة السابقة…','warn');
  if(f){S.pdfFile=f;try{S.pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;}catch(e){log('log1','تعذر استرجاع ملف الـ PDF — اخترْه مرة أخرى','err');S.pdf=null;}if(S.pdf){S.name=st.name||f.name.replace(/\.pdf$/i,'');
    $('uzTitle').textContent='✅ '+(f.name||S.name+'.pdf');$('uzSub').textContent=S.pdf.numPages+' صفحة';$('pTo').max=$('pFrom').max=S.pdf.numPages;$('genMd').disabled=false;}}
  for(const i of SAVE_IDS)if(st.inp&&st.inp[i]!=null)$(i).value=st.inp[i];
  S.md=st.md||'';if(S.md)['copyMd','dlMd'].forEach(i=>$(i).disabled=false);$('aiIn').value=st.ai||'';Object.assign(FIGC,st.figc||{});
  if(st.plan){S.plan=await walk(st.plan,v=>v instanceof Blob?b2d(v):v);renderReview();}
  try{const dx=await DB.get('docx');if(dx&&dx.blob){S.docx=dx;showDocx();}}catch(e){}
  showStep(st.step||1);log('log1','✅ تم استرجاع الجلسة كاملة بدون إعادة أي معالجة','ok');
}catch(e){console.warn('restore failed',e);}})();

function showDocx(){const d=S.docx;if(!d)return;$('dl').innerHTML='';const b=document.createElement('button');b.className='btn btn-green';b.textContent='⬇️ حفظ '+d.name+' ('+(d.blob.size/1048576).toFixed(1)+' MB)';
  b.onclick=async()=>{try{if(await K.save(d.name,d.blob))K.toast('تم الحفظ ✔');}catch(e){alert('تعذر الحفظ: '+e.message);}};$('dl').appendChild(b);$('dl').style.display='block';}
