const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../docs/diagrams');
const actors = {
 customer:['Хэрэглэгч','Вэб / банкны апп'], web:['GOStore вэб','Сагс · checkout · бүртгэл'], api:['GOStore сервер','PHP API · SQLite'], qpay:['QPay','Merchant V2'], supplier:['OT / Taobao','Каталог · худалдан авалт'], erenhot:['Эрээн агуулах','Хүлээн авах · багцлах'], ub:['УБ агуулах','Ангилах · хүлээлгэн өгөх']
};
const charts = [
 {file:'01-order-payment', title:'Захиалга ба төлбөр', subtitle:'GOStore.mn  /  Үндсэн сагсны захиалгын амжилттай урсгал', ids:['customer','web','api','qpay','supplier'], phases:[
  {title:'01  Бараа сонгох, захиалга үүсгэх', color:'#1764c0', fill:'#f0f6ff', messages:[
   ['customer','web','Бараа, хувилбар, тоо болон авах хэлбэр сонгох'],
   ['web','api','Үнэ тооцуулах / захиалах хүсэлт'],
   ['api','supplier','Үнэ, SKU, үлдэгдлийг дахин шалгах'],
   ['supplier','api','Барааны баталгаажуулсан мэдээлэл',true],
   ['api','api','Нийт дүнг тооцож, GS захиалгыг quoted төлөвөөр хадгалах'],
   ['api','web','Захиалгын дугаар, төлөх дүн',true]
  ]},
  {title:'02  QPay нэхэмжлэл үүсгэх', color:'#7354b5', fill:'#f7f3ff', messages:[
   ['web','api','Нэхэмжлэл авах (invoice)'],
   ['api','qpay','Нэхэмжлэл үүсгэх /v2/invoice'],
   ['qpay','api','invoice_id, QR, банкны холбоосууд',true],
   ['api','web','Нэхэмжлэл хадгалж, QR буцаах',true],
   ['web','customer','Төлөх дүн, QR болон банкны сонголт',true]
  ]},
  {title:'03  Төлбөрийг шалгаж баталгаажуулах', color:'#087e75', fill:'#eefaf7', messages:[
   ['customer','qpay','Банкны апп-аар төлөх (нэгтгэн үзүүлэв)'],
   ['qpay','api','Төлбөрийн callback мэдэгдэл',true],
   ['api','qpay','Серверээс шалгах /v2/payment/check'],
   ['qpay','api','Төлсөн гүйлгээ, MNT дүн',true],
   ['api','api','Дүн хүрсэн үед paid = true, status = confirmed'],
   ['web','api','Төлөв шинэчлэх (payment-check)'],
   ['api','web','Баталгаажсан захиалгын төлөв',true],
   ['web','customer','Төлбөр баталгаажсан мэдээлэл',true]
  ]}
 ], notes:[
  'Эхний төлбөр = бараа + Хятад доторх хүргэлт + үйлчилгээ. Каргоны эцсийн тооцоо УБ-д гарна.',
  'Callback нь мэдэгдэл: сервер QPay-ээс гүйлгээ, төлөв, валют, нийт төлсөн дүнг шалгаж байж батална.',
  'Үнэ өөрчлөгдвөл 409 хариугаар шинэ дүнг харуулна. Хугацаа дууссан төлөгдөөгүй захиалгыг цуцална.',
  'Банкны апп ба QPay-ийн дотоод харилцааг нэгтгэв. Энэ нь кодын схем; бодит гүйлгээний туршилтын тайлан биш.'
 ]},
 {file:'02-fulfillment', title:'Худалдан авалтаас хүлээлгэн өгөх хүртэл', subtitle:'GOStore.mn  /  Төлбөр баталгаажсан захиалгын үргэлжлэл', ids:['customer','api','supplier','erenhot','ub','qpay'], phases:[
  {title:'01  Taobao худалдан авалт, Эрээн хүлээн авалт',color:'#1764c0',fill:'#f0f6ff',messages:[
   ['api','supplier','Админы үйлдлээр order/render, дараа нь order/create'],
   ['supplier','api','Захиалгын дугаар; order/tracker-аар тээврийн мэдээлэл',true],
   ['supplier','erenhot','Барааг Эрээн хаягт хүргэх (биет хөдөлгөөн)',false,'goods'],
   ['erenhot','api','GS захиалгыг тулгаж, зурагтай хүлээн авах'],
   ['erenhot','api','Жин, хэмжээ, тоо бүртгэж GB багц үүсгэх'],
   ['erenhot','api','Багц бэлэн болгох; бодитоор гарсныг тусад нь батлах']
  ]},
  {title:'02  Эрээн → Замын-Үүд → Улаанбаатар',color:'#7354b5',fill:'#f7f3ff',messages:[
   ['erenhot','ub','Багцыг Замын-Үүдээр дамжуулан тээвэрлэх',false,'goods'],
   ['ub','api','GB QR нээж, GS бараа бүрийг тулган зурагтай хүлээн авах'],
   ['ub','api','Агуулахаас авах / хүргүүлэхээр ангилах'],
   ['ub','api','Бодит хэмжилт, хадгалсан тарифаар эцсийн тооцоо батлах'],
   ['api','customer','Миний захиалгууд: явц, зураг, төлөх үлдэгдэл',true]
  ]},
  {title:'03  Үлдэгдэл төлбөр байгаа үед',color:'#b76b16',fill:'#fff8ed',messages:[
   ['customer','api','Үлдэгдэл төлөх (freight-invoice)'],
   ['api','qpay','Зөвхөн үлдэгдэлд тусдаа /v2/invoice'],
   ['qpay','api','Нэхэмжлэлийн QR, банкны холбоосууд',true],
   ['api','customer','Үлдэгдэл төлбөрийн QR харуулах',true],
   ['customer','qpay','Банкны апп-аар үлдэгдэл төлөх'],
   ['qpay','api','freight-callback мэдэгдэл',true],
   ['api','qpay','Үлдэгдлийн гүйлгээг /v2/payment/check-ээр шалгах'],
   ['qpay','api','Баталгаажсан төлсөн дүн',true]
  ]},
  {title:'04  Төлбөр, зөрчил бүрэн шийдэгдсэний дараа',color:'#087e75',fill:'#eefaf7',messages:[
   ['api','customer','Авахад бэлэн / хүргэлтэд гарсан үед 8 оронтой код харуулах',true],
   ['customer','ub','Нэг удаагийн авах кодоо өгөх'],
   ['ub','api','Код болон хүлээлгэн өгөх нөхцөлийг шалгуулах'],
   ['api','ub','Баталгаажуулж, захиалгыг completed болгох',true],
   ['ub','customer','Барааг хүлээлгэн өгөх / хүргэлтээр өгөх',false,'goods']
  ]}
 ], notes:[
  'Taobao автоматаар захиалах нь сонголттой, анхдагчаар унтраалттай. 1688 барааг гараар худалдаж авна.',
  'Биет тээврийг API хүсэлтээс ялгаж ногоон сумаар үзүүлэв. Хүргэлтийн ажилтныг УБ талд нэгтгэв.',
  'Үлдэгдэл 0 бол III үе шатыг алгасана. Анхны нэхэмжлэлийг өөрчлөхгүй; үлдэгдэлд шинэ нэхэмжлэл гаргана.',
  'Код зөвхөн эцсийн тооцоо батлагдсан, өр/буцаалтын зөрүүгүй, нээлттэй зөрчилгүй үед хэрэглэгчид харагдана.',
  'Менежер кодыг урьдчилан харахгүй. QR уншуулах нь багцыг нээх бөгөөд хүлээн авалтыг тусад нь батална.'
 ]}
];
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
function wrap(text,max){const lines=[];let line='';for(const word of text.split(' ')){if(line&&line.length+word.length+1>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
fs.mkdirSync(out,{recursive:true});
for(const chart of charts){
 const width=chart.ids.length*300+100, xs=chart.ids.map((_,i)=>200+i*300), top=245;
 let y=top;let num=0;const rows=[];const phases=[];
 for(const phase of chart.phases){const start=y;y+=68;for(const m of phase.messages){const a=chart.ids.indexOf(m[0]),b=chart.ids.indexOf(m[1]);if(a<0||b<0)throw Error('Unknown actor');const isSelf=a===b;const available=isSelf?265:Math.abs(xs[a]-xs[b])-28;const lines=wrap(`${++num}. ${m[2]}`,Math.floor(available/9.6));const height=Math.max(76,lines.length*23+30);rows.push({m,a,b,lines,y:y+height-18,color:phase.color});y+=height;}phases.push({...phase,start,height:y-start+8});y+=27;}
 const bottom=y, height=bottom+140+chart.notes.length*27;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(chart.title)}</title><desc id="desc">GOStore-ийн кодод тулгуурласан дарааллын диаграм. Дээрээс доош уншина.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><style>text{font-family:Arial,'Segoe UI',sans-serif;fill:#172b46}.message{font-size:18px;paint-order:stroke;stroke:white;stroke-width:5px;stroke-linejoin:round}.muted{fill:#586b83}</style><rect width="100%" height="100%" fill="white"/><text x="50" y="54" font-size="18" font-weight="700" fill="#1764c0">GOSTORE / АЖИЛЛАГААНЫ СХЕМ</text><text x="50" y="100" font-size="34" font-weight="700">${esc(chart.title)}</text><text x="50" y="133" font-size="18" class="muted">${esc(chart.subtitle)}</text>`;
 for(const p of phases)svg+=`<rect x="42" y="${p.start}" width="${width-84}" height="${p.height}" rx="8" fill="${p.fill}" fill-opacity="0.5" stroke="${p.color}" stroke-width="1.6"/><rect x="43" y="${p.start+1}" width="${width-86}" height="40" rx="7" fill="${p.fill}"/><text x="62" y="${p.start+27}" font-size="19" font-weight="700">${esc(p.title)}</text>`;
 chart.ids.forEach((id,i)=>{svg+=`<line x1="${xs[i]}" y1="224" x2="${xs[i]}" y2="${bottom}" stroke="#8190a4" stroke-width="1.5" stroke-dasharray="7 7"/><rect x="${xs[i]-130}" y="164" width="260" height="62" rx="12" fill="${id==='api'?'#1764c0':'#eef3fa'}" stroke="#d2deed"/><text x="${xs[i]}" y="190" text-anchor="middle" font-size="21" font-weight="700" style="fill:${id==='api'?'white':'#172b46'}">${esc(actors[id][0])}</text><text x="${xs[i]}" y="213" text-anchor="middle" font-size="15" style="fill:${id==='api'?'#e0edff':'#586b83'}">${esc(actors[id][1])}</text>`;});
 for(const r of rows){const [from,to,label,dashed,kind]=r.m;const a=xs[r.a],b=xs[r.b],self=a===b,c=kind==='goods'?'#188451':r.color;svg+=`<rect x="${b-4}" y="${r.y-13}" width="8" height="27" fill="${c}" stroke="white"/>`;const d=self?`M${a+4} ${r.y-18}h38v18h-38`:`M${a+(a<b?4:-4)} ${r.y}H${b+(a<b?-5:5)}`;svg+=`<path d="${d}" fill="none" stroke="${c}" stroke-width="${kind==='goods'?3:1.8}" ${dashed?'stroke-dasharray="7 5"':''} marker-end="url(#arrow)"/>`;const tx=self?a+55:(a+b)/2;const start=r.y-12-(r.lines.length-1)*23;svg+=`<text class="message" x="${tx}" y="${start}" text-anchor="${self?'start':'middle'}">${r.lines.map((l,j)=>`<tspan x="${tx}" dy="${j?23:0}">${esc(l)}</tspan>`).join('')}</text>`;}
 svg+=`<line x1="52" y1="${bottom+32}" x2="112" y2="${bottom+32}" stroke="#1764c0" stroke-width="2" marker-end="url(#arrow)"/><text x="125" y="${bottom+38}" font-size="16">Хүсэлт / үйлдэл</text><line x1="330" y1="${bottom+32}" x2="390" y2="${bottom+32}" stroke="#1764c0" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#arrow)"/><text x="403" y="${bottom+38}" font-size="16">Хариу / мэдэгдэл</text><line x1="630" y1="${bottom+32}" x2="690" y2="${bottom+32}" stroke="#188451" stroke-width="3" marker-end="url(#arrow)"/><text x="703" y="${bottom+38}" font-size="16">Биет барааны хөдөлгөөн</text>`;
 chart.notes.forEach((note,i)=>svg+=`<text x="52" y="${bottom+82+i*27}" font-size="16" class="muted">${esc(note)}</text>`);svg+=`<text x="52" y="${height-22}" font-size="14" class="muted">Кодын төлөв: 2026-10-19 · Үндсэн амжилттай урсгал · GOStore.mn</text></svg>`;
 fs.writeFileSync(path.join(out,chart.file+'.svg'),svg);
 let mmd='sequenceDiagram\n';chart.ids.forEach(id=>mmd+=`    participant ${id} as ${actors[id][0]}\n`);num=0;
 for(const phase of chart.phases){mmd+=`    rect ${phase.fill==='#f0f6ff'?'rgb(240,246,255)':phase.fill==='#f7f3ff'?'rgb(247,243,255)':phase.fill==='#fff8ed'?'rgb(255,248,237)':'rgb(238,250,247)'}\n    Note over ${chart.ids[0]},${chart.ids.at(-1)}: ${phase.title}\n`;for(const m of phase.messages)mmd+=`    ${m[0]}${m[3]?'-->>':'->>'}${m[1]}: ${++num}. ${m[2]}\n`;mmd+='    end\n';}
 fs.writeFileSync(path.join(out,chart.file+'.mmd'),mmd);
 console.log(`${chart.file}: ${num} messages, ${width} x ${height}`);
}
