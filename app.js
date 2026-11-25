// NUMERIQ AI 2.0 — nombres de juegos y sorteos separados en el historial.
const trisDraws=['Mediodía','De las 3','De las 7','Clásico','Extra'];
const chispazoDraws=['De las 3 de la tarde','De las 9 de la noche'];
const games=[
 {id:'tris',name:'TRIS',icon:'▦',desc:'Mediodía · De las 3 · De las 7 · Clásico · Extra',modes:['3 cifras','4 cifras','5 cifras','Pares'],digits:5},
 {id:'chispazo',name:'CHISPAZO',icon:'✧',desc:'Dos sorteos independientes: 3 de la tarde y 9 de la noche · 5 números del 1 al 28',modes:['5 números'],digits:0},
 {id:'melate',name:'MELATE',icon:'◉',desc:'Sorteo independiente',modes:['6 números'],digits:0},
 {id:'revancha',name:'REVANCHA',icon:'↗',desc:'Sorteo independiente',modes:['6 números'],digits:0},
 {id:'revanchita',name:'REVANCHITA',icon:'✦',desc:'Sorteo independiente',modes:['6 números'],digits:0},
 {id:'zodiaco',name:'ZODIACO',icon:'☼',desc:'4 cifras y signos zodiacales',modes:['Número de 4 cifras','Signo zodiacal'],digits:4}
];
const zodiac=['Aries','Tauro','Géminis','Cáncer','Leo','Virgo','Libra','Escorpio','Sagitario','Capricornio','Acuario','Piscis'];
const key='numeriq_ai_data_v1', comboKey='numeriq_ai_combos_v1';
let records=[];try{records=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(records))records=[]}catch{}
let tracked=[];try{tracked=JSON.parse(localStorage.getItem(comboKey)||'[]');if(!Array.isArray(tracked))tracked=[]}catch{}
let active=null,deferredPrompt=null;const $=s=>document.querySelector(s);
function persist(){
 const previousRecords=localStorage.getItem(key),previousCombos=localStorage.getItem(comboKey);
 try{
  localStorage.setItem(key,JSON.stringify(records));
  localStorage.setItem(comboKey,JSON.stringify(tracked));
  renderAll();return true;
 }catch(err){
  // Si falla cualquiera de las dos escrituras, intenta restaurar ambas claves.
  try{if(previousRecords===null)localStorage.removeItem(key);else localStorage.setItem(key,previousRecords)}catch(_){}
  try{if(previousCombos===null)localStorage.removeItem(comboKey);else localStorage.setItem(comboKey,previousCombos)}catch(_){}
  const msg='No se pudieron guardar todos los cambios. Los datos anteriores se conservaron cuando el almacenamiento lo permitió; descarga un respaldo y libera espacio.';
  const status=$('#importStatus');if(status)status.textContent=msg;
  console.error('NUMERIQ persist:',err);return false;
 }
}
async function checkStorageHealth(){
 const status=$('#storageHealthStatus');
 if(!navigator.storage||!navigator.storage.estimate){if(status)status.textContent='Este navegador no permite consultar el espacio de almacenamiento.';return}
 try{
  const info=await navigator.storage.estimate(),used=Number(info.usage||0),quota=Number(info.quota||0);
  const pct=quota?Math.min(100,used/quota*100).toFixed(1):'—';
  if(status)status.textContent=`Almacenamiento del sitio: ${(used/1024/1024).toFixed(2)} MB usados de ${quota?(quota/1024/1024).toFixed(2)+' MB':'espacio no informado'} (${pct}%). Es una estimación del navegador.`;
 }catch(err){if(status)status.textContent='No se pudo consultar el almacenamiento: '+err.message}
}
async function requestPersistentStorage(){
 const status=$('#storageHealthStatus');
 if(!navigator.storage||!navigator.storage.persist){if(status)status.textContent='Este navegador no admite solicitar almacenamiento persistente. Mantén tus respaldos descargados.';return}
 try{
  const granted=await navigator.storage.persist();
  if(status)status.textContent=granted?'El navegador concedió almacenamiento persistente para este sitio. Aun así, conserva respaldos externos.':'El navegador no concedió almacenamiento persistente. Descarga respaldos periódicamente para proteger tus datos.';
 }catch(err){if(status)status.textContent='No se pudo solicitar almacenamiento persistente: '+err.message}
 await checkStorageHealth();
}
function exportBackup(){
 const payload={app:'NUMERIQ AI',version:2,createdAt:new Date().toISOString(),records,tracked};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`NUMERIQ_AI_respaldo_${new Date().toISOString().slice(0,10)}.json`;
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 const status=$('#importStatus');if(status)status.textContent='Copia de seguridad descargada. Guárdala fuera del teléfono para proteger tus datos.';
}
async function restoreBackup(file){
 const payload=JSON.parse(await file.text());
 if(!payload||payload.app!=='NUMERIQ AI'||!Array.isArray(payload.records)||!Array.isArray(payload.tracked))throw Error('El archivo no es una copia de seguridad válida de NUMERIQ AI.');
 const groupKey=r=>[r.gameId||'',r.draw||'',r.mode||'',r.file||''].join('|');
 const entryList=r=>Array.isArray(r.entries)?r.entries:(r.values||[]).map(value=>({value,date:r.date||''}));
 const entryKey=e=>[e.drawNo||e.sourceId||'',e.date||'',e.value??e].join('|');
 const mergedRecords=new Map();
 [...records,...payload.records].forEach(r=>{
  if(!r||typeof r!=='object')return;
  const k=groupKey(r),existing=mergedRecords.get(k);
  if(!existing){mergedRecords.set(k,{...r,entries:entryList(r).map(e=>({...e}))});return}
  const entries=new Map(entryList(existing).map(e=>[entryKey(e),e]));
  entryList(r).forEach(e=>{const ek=entryKey(e);if(!entries.has(ek))entries.set(ek,{...e})});
  mergedRecords.set(k,{...existing,...r,entries:[...entries.values()],values:[...entries.values()].map(e=>String(e.value)),count:entries.size});
 });
 const comboKeyFn=c=>[c.gameId||'',c.draw||'',c.mode||'',c.value||'',c.createdAt||'',c.strategy||''].join('|');
 const mergedTracked=new Map(tracked.map(c=>[comboKeyFn(c),c]));
 payload.tracked.forEach(c=>{if(c&&typeof c==='object'&&!mergedTracked.has(comboKeyFn(c)))mergedTracked.set(comboKeyFn(c),c)});
 const oldRecords=records,oldTracked=tracked;
 records=[...mergedRecords.values()];tracked=[...mergedTracked.values()];
 if(!persist()){records=oldRecords;tracked=oldTracked;throw Error('No se pudo guardar el respaldo. Los datos actuales en memoria se conservaron.')}
 const status=$('#importStatus');if(status)status.textContent=`Respaldo integrado: ${payload.records.length} grupos y ${payload.tracked.length} combinaciones revisados. Se combinaron entradas sin duplicar ni reemplazar los resultados actuales.`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(s){return String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}

function zodiacResultParts(value){
 const m=String(value||'').trim().match(/^(\d{4})\s*[|·-]\s*(Aries|Tauro|Géminis|Cáncer|Leo|Virgo|Libra|Escorpio|Sagitario|Capricornio|Acuario|Piscis)$/i);
 if(!m)return null;
 const sign=zodiac.find(z=>norm(z)===norm(m[2]));
 return sign?{number:m[1],sign}:null;
}
function zodiacDigitWeights(){
 const entries=allEntriesFor('zodiaco').map(e=>zodiacResultParts(e.value)).filter(Boolean);
 return Array.from({length:4},(_,pos)=>{
  const counts=Array(10).fill(1);
  entries.forEach(e=>counts[Number(e.number[pos])]++);
  return counts;
 });
}
function zodiacSignWeights(){
 const counts=Array(12).fill(1);
 allEntriesFor('zodiaco').map(e=>zodiacResultParts(e.value)).filter(Boolean).forEach(e=>{
  const i=zodiac.indexOf(e.sign);if(i>=0)counts[i]++;
 });
 return counts;
}
function renderZodiacEntryForm(){
 const button=$('#generateBtn');if(!button)return;
 let panel=$('#zodiacEntryPanel');
 if(!panel){panel=document.createElement('section');panel.id='zodiacEntryPanel';panel.className='position-panel';button.parentNode.insertBefore(panel,button);}
 panel.innerHTML=`<h3>Registrar resultado oficial de ZODIACO</h3><p class="muted">Guarda las cuatro cifras y el signo juntos. Se conservarán los ceros iniciales.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px"><label>Fecha del sorteo<input id="zodiacResultDate" type="date" value="${localDayKey(new Date())}"></label><label>Número de 4 cifras<input id="zodiacResultNumber" type="text" inputmode="numeric" maxlength="4" placeholder="0000"></label><label>Signo<select id="zodiacResultSign">${zodiac.map(z=>`<option>${z}</option>`).join('')}</select></label></div><button type="button" id="saveZodiacResult">Guardar resultado</button><p id="zodiacSaveStatus" class="muted" aria-live="polite"></p>`;
 $('#saveZodiacResult').onclick=saveZodiacResult;
}
function saveZodiacResult(){
 const date=$('#zodiacResultDate')?.value||'',number=$('#zodiacResultNumber')?.value.trim()||'',sign=$('#zodiacResultSign')?.value||'';
 const status=$('#zodiacSaveStatus');
 if(!date||!/^\d{4}$/.test(number)||!zodiac.includes(sign)){if(status)status.textContent='Revisa la fecha, el número (exactamente 4 cifras) y el signo.';return}
 const value=`${number} | ${sign}`;
 const duplicate=allEntriesFor('zodiaco').some(e=>String(e.date||'').slice(0,10)===date&&String(e.value)===value);
 if(duplicate){if(status)status.textContent='Ese mismo resultado ya está registrado para esa fecha.';return}
 const record={gameId:'zodiaco',draw:'',mode:'Número + signo',values:[value],entries:[{value,date,importedAt:new Date().toISOString()}],name:'ZODIACO',gameLabel:'ZODIACO · Registro manual',count:1,file:'Registro manual ZODIACO',date};
 records.push(record);
 if(!persist()){records.pop();if(status)status.textContent='No se pudo guardar. Tus datos anteriores se conservaron.';return}
 if(status)status.textContent=`Resultado guardado: ${value} · ${date}`;
 $('#zodiacResultNumber').value='';
}

function dateRank(s){if(!s)return 0;const v=String(s).trim();let m=v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return Date.UTC(+m[1],+m[2]-1,+m[3]);m=v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);if(m)return Date.UTC(+m[3],+m[2]-1,+m[1]);const t=Date.parse(v);return Number.isFinite(t)?t:0}
function dateFromRow(row,headers){const i=headers.findIndex(h=>/(^|\b)(fecha|date|dia del sorteo)(\b|$)/.test(h));return i>=0?String(row[i]||'').trim():''}
function detectDraw(s){s=norm(s).replace(/[._-]/g,' ');if(/mediodia|medio dia|12:00|12\s*(pm|p\.m\.)/.test(s))return 'Mediodía';if(/\bextra\b/.test(s))return 'Extra';if(/clasico/.test(s))return 'Clásico';if(/de las?\s*7|delas?\s*7|las siete|de las siete|7\s*(pm|p\.m\.)|19:00/.test(s))return 'De las 7';if(/de las?\s*3|delas?\s*3|las tres|de las tres|3\s*(pm|p\.m\.)|15:00/.test(s))return 'De las 3';return ''}
function detectChispazoDraw(s){s=norm(s).replace(/[._-]/g,' ');if(/chispazo.{0,18}(9|nueve)|\bde las?\s*9\b|(?:9|nueve).{0,18}(de la noche|pm|p m)|21:00/.test(s))return chispazoDraws[1];if(/chispazo.{0,18}(3|tres)|\bde las?\s*3\b|(?:3|tres).{0,18}(de la tarde|pm|p m)|15:00/.test(s))return chispazoDraws[0];return ''}
function detectGame(s){s=norm(s);if(/revanchita/.test(s))return 'revanchita';if(/revancha/.test(s))return 'revancha';if(/melate/.test(s))return 'melate';if(/chispazo/.test(s))return 'chispazo';if(/zodiaco/.test(s))return 'zodiaco';if(/\btris\b|mediodia|clasico|\bextra\b|de las?\s*[37]|las siete|las tres/.test(s))return 'tris';return ''}
function parseCSV(text){text=String(text||'').replace(/^\uFEFF/,'');const sample=text.split(/\r?\n/,1)[0]||'';let sep=',',best=-1;for(const d of [',',';','\t']){let n=0,q=false;for(let i=0;i<sample.length;i++){if(sample[i]==='"')q=!q;else if(sample[i]===d&&!q)n++}if(n>best){best=n;sep=d}}const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=!quoted;else if(ch===sep&&!quoted){row.push(cell.trim());cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}else cell+=ch}row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);return rows}
function extractResult(cell,gameId,header=''){
 const s=String(cell??'').trim();if(!s)return [];
 if(gameId==='tris'){const m=s.match(/\b\d{3,5}\b/g);return m||[]}
 if(gameId==='zodiaco'){const m=s.match(/\b\d{4}\b/g);if(m)return m;const z=zodiac.find(v=>norm(s).includes(norm(v)));return z?[z]:[]}
 const nums=(s.match(/\d{1,2}/g)||[]).map(Number);
 const needed=gameId==='chispazo'?5:6,max=gameId==='chispazo'?28:56;
 if(nums.length!==needed||nums.some(n=>n<1||n>max)||new Set(nums).size!==needed)return [];
 return [nums.map(n=>String(n).padStart(2,'0')).join(' · ')];
}
function addDetected(out,gameId,draw,mode,value,date){if(!gameId||!value)return;if((gameId==='tris'||gameId==='chispazo')&&!draw)return;out.push({gameId,draw:(gameId==='tris'||gameId==='chispazo')?draw:'',mode:mode||'',value:String(value),date:date||''})}
function importRows(rows,fileName,overrideGame='auto',overrideDraw=''){
 if(!Array.isArray(rows)||rows.length<2)throw Error('El CSV no contiene filas de datos.');
 const headers=rows[0].map(norm),data=rows.slice(1),found=[],fileGame=detectGame(fileName);
 const userForcedGame=overrideGame&&overrideGame!=='auto'?overrideGame:'';
 const fileDraw=detectDraw(fileName),fileChispazoDraw=detectChispazoDraw(fileName);
 const dateIndex=headers.findIndex(h=>/(^|\b)(fecha|date|dia del sorteo|fecha del sorteo)(\b|$)/.test(h));
 const gameIndex=headers.findIndex(h=>/(^|\b)(juego|nombre del juego|producto|loteria|tipo de juego)(\b|$)/.test(h));
 const drawIndex=headers.findIndex(h=>/(sorteo|modalidad|turno|horario|hora)/.test(h));
 const resultIndexes=headers.map((h,i)=>({h,i})).filter(x=>!/(fecha|date|juego|producto|loteria|sorteo|modalidad|turno|horario|hora|concurso|folio|numero de sorteo|multiplicador)/.test(x.h)&&/(resultado|numeros?|combinacion|ganador|bolas?|numero\s*[1-6]|bola\s*[1-6]|\b[1-6]\b)/.test(x.h));
 const wideCols=headers.map((h,i)=>({h,i,gameId:detectGame(h),draw:detectGame(h)==='chispazo'?detectChispazoDraw(h):detectDraw(h)})).filter(x=>x.gameId&&(!['tris','chispazo'].includes(x.gameId)||x.draw));
 // Formato ancho: cada columna representa un juego o una modalidad TRIS.
 for(const row of data){const date=dateIndex>=0?String(row[dateIndex]||'').trim():'';for(const col of wideCols){if(userForcedGame&&userForcedGame!==col.gameId)continue;for(const value of extractResult(row[col.i],col.gameId,col.h))addDetected(found,col.gameId,col.draw,'',value,date)}}
 // Formato vertical: juego, sorteo y resultado en columnas separadas; admite CSV mixto.
 for(const row of data){
  // Si hay columnas con nombres de juegos/sorteos, el archivo es formato ancho.
  // No volver a procesar esas mismas filas como formato vertical aunque también exista una columna "Juego".
  if(wideCols.length)continue;
  const gameId=userForcedGame||(gameIndex>=0?detectGame(row[gameIndex]):'')||(!wideCols.length?fileGame:'')||detectGame(row.join(' '));
  if(!gameId)continue;
  const draw=gameId==='tris'?(overrideGame==='tris'&&overrideDraw?overrideDraw:((drawIndex>=0?detectDraw(row[drawIndex]):'')||detectDraw(row.join(' '))||fileDraw)):gameId==='chispazo'?((drawIndex>=0?detectChispazoDraw(row[drawIndex]):'')||detectChispazoDraw(row.join(' '))||fileChispazoDraw||((overrideGame==='chispazo'&&overrideDraw)?overrideDraw:'')):'';
  if((gameId==='tris'||gameId==='chispazo')&&!draw)continue;
  const date=dateIndex>=0?String(row[dateIndex]||'').trim():'';
  let vals=[];
  if(resultIndexes.length){
   const cells=resultIndexes.map(c=>String(row[c.i]??'').trim()).filter(Boolean);
   if(gameId==='tris'||gameId==='zodiaco')for(const cell of cells)vals.push(...extractResult(cell,gameId));
   else {const need=gameId==='chispazo'?5:6,max=gameId==='chispazo'?28:56;const nums=cells.flatMap(v=>(v.match(/\d{1,2}/g)||[])).map(Number);if(nums.length===need&&nums.every(n=>n>=1&&n<=max)&&new Set(nums).size===need)vals.push(nums.map(n=>String(n).padStart(2,'0')).join(' · '));else for(const cell of cells)vals.push(...extractResult(cell,gameId));}
  }else{
   const ignored=/(fecha|date|juego|producto|loteria|sorteo|modalidad|turno|horario|hora|concurso|folio|numero de sorteo|multiplicador)/;
   const cells=row.filter((v,i)=>!ignored.test(headers[i]||'')&&String(v??'').trim()!=='');
   if(gameId==='tris'||gameId==='zodiaco')for(const cell of cells)vals.push(...extractResult(cell,gameId));
   else {const need=gameId==='chispazo'?5:6,max=gameId==='chispazo'?28:56;const nums=cells.flatMap(v=>(String(v).match(/\d{1,2}/g)||[])).map(Number);const picked=nums.slice(-need);if(picked.length===need&&picked.every(n=>n>=1&&n<=max)&&new Set(picked).size===need)vals.push(picked.map(n=>String(n).padStart(2,'0')).join(' · '));}
  }
  vals.forEach(value=>addDetected(found,gameId,draw,'',value,date));
 }
 if(!found.length)throw Error('No reconocí resultados. En un CSV mixto incluye columnas de juego, sorteo/modalidad y resultado, o encabezados como TRIS Mediodía, TRIS Extra, etc. Si el archivo contiene solo TRIS, selecciona TRIS y el sorteo. No se modificaron tus datos.');
 // Deduplicar dentro del archivo y contra el historial existente sin borrar datos anteriores.
 const seen=new Set(records.flatMap(r=>allEntriesFor(r.gameId,r.draw||'').map(e=>[r.gameId,r.draw||'',norm(e.date||''),String(e.value)].join('|'))));
 const unique=[];for(const x of found){const k=[x.gameId,x.draw||'',norm(x.date||''),String(x.value)].join('|');if(seen.has(k))continue;seen.add(k);unique.push(x)}
 if(!unique.length)throw Error(`Se reconocieron ${found.length} filas, pero todas ya estaban importadas. No se duplicaron registros.`);
 const grouped=new Map();for(const r of unique){const k=[r.gameId,r.draw,r.mode].join('|');if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r)}
 for(const [k,items] of grouped){const [gameId,draw,mode]=k.split('|'),g=games.find(x=>x.id===gameId);const entries=items.map(x=>({value:x.value,date:x.date,importedAt:new Date().toISOString()}));records.push({gameId,draw,mode,values:entries.map(x=>x.value),entries,name:g?.name||gameId,gameLabel:gameId==='tris'?`TRIS · ${draw}`:gameId==='chispazo'?`CHISPAZO · ${draw}`:g?.name||gameId,count:entries.length,file:fileName,date:items.map(x=>x.date).filter(Boolean).sort((a,b)=>dateRank(a)-dateRank(b)).at(-1)||new Date().toLocaleDateString('es-MX')})}
 updateTrackedHits();persist();$('#importStatus').textContent=`Listo: ${unique.length} resultados nuevos reconocidos (${found.length-unique.length} duplicados omitidos), organizados en ${grouped.size} grupos.`;
}
function allEntriesFor(gameId,draw=''){
 const matching=records.filter(r=>r.gameId===gameId&&(
  !['tris','chispazo'].includes(gameId)||
  (draw==='__legacy__'?!r.draw:r.draw===draw)
 ));
 return matching.flatMap(r=>Array.isArray(r.entries)?r.entries:(r.values||[]).map(value=>({value,date:r.date||''}))).filter(e=>e&&e.value!==undefined);
}
async function syncOfficialTris(){
 const btn=$('#syncTrisBtn'),status=$('#syncStatus');
 if(!btn||btn.disabled)return;
 btn.disabled=true;btn.textContent='Consultando Lotería Nacional…';
 status.textContent='Conectando con la fuente oficial y verificando cada número de sorteo…';
 const beforeRecords=JSON.parse(JSON.stringify(records)),beforeTracked=JSON.parse(JSON.stringify(tracked));
 try{
  const response=await fetch('/.netlify/functions/tris-results',{headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error(`El servicio respondió ${response.status}.`);
  const payload=await response.json();
  if(!payload.ok||!Array.isArray(payload.results)||!payload.results.length)throw new Error(payload.error||'La fuente oficial no devolvió resultados reconocibles.');
  const allowedDraws=Array.isArray(trisDraws)?trisDraws:[];
  const valid=payload.results.filter(item=>/^\d{5}$/.test(String(item.value||''))&&item.draw&&item.drawNo&&allowedDraws.includes(item.draw));
  if(!valid.length)throw new Error('La fuente no devolvió resultados TRIS con nombre de sorteo y número oficial reconocibles.');

  // Un número oficial de sorteo debe corresponder a un único resultado.
  const byId=new Map();
  for(const item of valid){
   const id=String(item.drawNo),value=String(item.value),draw=String(item.draw);
   const prior=byId.get(id);
   if(prior&&(prior.value!==value||prior.draw!==draw))throw new Error(`La fuente devolvió datos contradictorios para el sorteo oficial ${id}. No se modificó el historial.`);
   if(!prior)byId.set(id,{...item,draw,value,drawNo:id});
  }
  const normalized=[...byId.values()].map(item=>({
   gameId:'tris',draw:item.draw,mode:'',value:item.value,date:item.date||'',
   drawNo:item.drawNo,sourceId:item.drawNo,multiplier:item.multiplier||'',
   importedAt:new Date().toISOString()
  }));
  const officialIds=new Set(normalized.map(e=>e.drawNo));
  let added=0,duplicates=0,repaired=0;

  for(const record of records.filter(r=>r.gameId==='tris')){
   const oldEntries=Array.isArray(record.entries)?record.entries:(record.values||[]).map(value=>({value,date:record.date||''}));
   const kept=oldEntries.filter(entry=>{
    const id=String(entry.drawNo||entry.sourceId||'');
    if(!id||!officialIds.has(id))return true;
    const official=byId.get(id);
    if(official&&record.draw!==official.draw){repaired++;return false;}
    return true;
   });
   record.entries=kept;record.values=kept.map(e=>String(e.value));record.count=kept.length;
  }
  records=records.filter(r=>r.gameId!=='tris'||(r.entries||[]).length>0);

  for(const entry of normalized){
   let record=records.find(r=>r.gameId==='tris'&&r.draw===entry.draw&&(r.mode||'')==='');
   if(!record){
    record={gameId:'tris',draw:entry.draw,mode:'',values:[],entries:[],name:'TRIS',gameLabel:`TRIS · ${entry.draw}`,count:0,file:'Actualización oficial Lotería Nacional',date:''};
    records.push(record);
   }
   const entries=Array.isArray(record.entries)?record.entries:[];
   const index=entries.findIndex(e=>String(e.drawNo||e.sourceId||'')===entry.drawNo);
   if(index>=0){
    if(String(entries[index].value)!==entry.value||String(entries[index].date||'')!==String(entry.date||''))repaired++;
    entries[index]={...entries[index],...entry};duplicates++;
   }else{entries.push(entry);added++}
   record.entries=entries;record.values=entries.map(e=>String(e.value));record.count=entries.length;
   record.date=entries.map(e=>e.date).filter(Boolean).sort((a,b)=>dateRank(a)-dateRank(b)).at(-1)||record.date;
  }
  // persist() recalcula y guarda el Centro de Aciertos dentro del mismo guardado protegido.
  if(!persist()){
   records=beforeRecords;tracked=beforeTracked;
   throw new Error('No se pudieron guardar los resultados en este dispositivo. El historial anterior se conservó; libera espacio y vuelve a intentarlo.');
  }
  const when=payload.updatedAt?new Date(payload.updatedAt).toLocaleString('es-MX'):'ahora';
  status.textContent=`Actualización terminada: ${added} resultados nuevos; ${duplicates} ya estaban guardados; ${repaired} registros corregidos. Fuente oficial consultada ${when}.`;
  status.dataset.state='success';
 }catch(err){
  records=beforeRecords;tracked=beforeTracked;
  status.textContent=`No se pudo actualizar automáticamente: ${err.message} Tus datos guardados no se modificaron.`;
  status.dataset.state='error';
 }finally{
  btn.disabled=false;btn.textContent='↻ Actualizar resultados TRIS';
 }
}
function renderLatestResults(){
 const targets=[];
 games.forEach(g=>{
  if(g.id==='tris')trisDraws.forEach(draw=>targets.push({id:g.id,draw,label:`TRIS · ${draw}`}));
  else if(g.id==='chispazo'){
   chispazoDraws.forEach(draw=>targets.push({id:g.id,draw,label:`CHISPAZO · ${draw}`}));
   targets.push({id:g.id,draw:'__legacy__',label:'CHISPAZO · Historial anterior (sin sorteo identificado)'});
  }
  else targets.push({id:g.id,draw:'',label:g.name});
 });
 $('#latestResults').innerHTML=targets.map(t=>{
  const entries=allEntriesFor(t.id,t.draw).slice().sort((a,b)=>dateRank(a.date)-dateRank(b.date)||(Number(a.drawNo)||0)-(Number(b.drawNo)||0));
  const last=entries.at(-1);
  return `<article class="latest-card"><h3>${escapeHtml(t.label)}</h3><div class="latest-value">${last?escapeHtml(last.value):'—'}</div><div class="latest-meta">${last?`${entries.length} resultados · Último: ${escapeHtml(last.date||'fecha no disponible')}`:'Sin resultados guardados'}</div></article>`;
 }).join('');
}
function renderHistory(){const total=records.reduce((a,r)=>a+(r.values?.length||Number(r.count)||0),0);$('#drawCount').textContent=total;$('#history').innerHTML=records.length?records.slice(-12).reverse().map(r=>`<div class="history-row"><b>${escapeHtml(r.gameLabel||r.name||'Sorteo')}</b> · ${r.values?.length||r.count||0} resultados <small>${escapeHtml(r.date||'')} · ${escapeHtml(r.file||'CSV')}</small></div>`).join(''):'Tus resultados importados aparecerán aquí.'}
function renderCombos(){
 const box=$('#trackedCombos');if(!box)return;
 if(!tracked.length){box.innerHTML='<p class="muted">Las combinaciones que generes aparecerán aquí para darles seguimiento.</p>';return}
 updateTrackedHits();
 const exact=tracked.filter(c=>c.hit?.exact).length;
 const partial=tracked.filter(c=>c.hit&&!c.hit.exact).length;
 const pending=tracked.length-exact-partial;
 const grouped={};
 tracked.filter(c=>c.strategy).forEach(c=>{const k=c.strategy;grouped[k]??={total:0,exact:0,partial:0};grouped[k].total++;if(c.hit?.exact)grouped[k].exact++;else if(c.hit)grouped[k].partial++});
 const strategyRows=Object.entries(grouped).map(([name,v])=>`<tr><td>${escapeHtml(name)}</td><td>${v.total}</td><td>${v.exact}</td><td>${v.partial}</td></tr>`).join('');
 const summary=`<section class="position-panel"><h3>Auditoría de combinaciones</h3><p class="muted">Seguimiento de jugadas guardadas y resultados posteriores disponibles en el historial.</p><div class="freq-grid"><div class="freq-card"><b>Jugadas registradas</b><p>${tracked.length}</p></div><div class="freq-card"><b>Coincidencias exactas</b><p>${exact}</p></div><div class="freq-card"><b>Coincidencias parciales</b><p>${partial}</p></div><div class="freq-card"><b>Sin resultado posterior</b><p>${pending}</p></div></div>${strategyRows?`<h4>Rendimiento por estrategia TRIS</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Estrategia</th><th>Jugadas</th><th>Exactas</th><th>Parciales</th></tr></thead><tbody>${strategyRows}</tbody></table></div>`:''}<p class="muted">Las coincidencias parciales son solo métricas de comparación y no se contabilizan como premios. La auditoría depende de que los resultados posteriores estén cargados con fecha correcta.</p></section>`;
 box.innerHTML=summary+tracked.slice(-30).reverse().map(c=>{const hit=c.hit||null;return `<article class="track-row"><div><b>${escapeHtml(c.gameLabel)}${c.draw?` · ${escapeHtml(c.draw)}`:''}${c.strategy?` · ${escapeHtml(c.strategy)}`:''}</b><div class="track-value">${escapeHtml(c.value)}</div><small>${new Date(c.createdAt).toLocaleString('es-MX')}</small></div><div class="track-status">${hit?`<b>${hit.exact?'Coincidencia exacta':'Coincidencia parcial (sin premio)'}</b><small>${hit.matches} ${escapeHtml(hit.kind||'coincidencias')} · ${escapeHtml(hit.date||'')} · Resultado ${escapeHtml(hit.result||'')}</small>`:'<small>En seguimiento</small>'}</div></article>`}).join('');
}
function renderAll(){renderHistory();renderLatestResults();renderCombos();if(active)updateStatsPanel()}
$('#games').innerHTML=games.map(g=>`<article class="game-card" data-id="${g.id}"><span class="arrow">↗</span><div class="game-icon">${g.icon}</div><h3>${g.name}</h3><p>${g.desc}</p></article>`).join('');document.querySelectorAll('.game-card').forEach(c=>c.addEventListener('click',()=>openGame(c.dataset.id)));
function openGame(id){active=games.find(g=>g.id===id);$('#modalKicker').textContent='MÓDULO DE ANÁLISIS';$('#modalTitle').textContent=active.name;$('#modalDesc').textContent=active.id==='tris'?'Elige cualquiera de los cinco sorteos. Cada historial y estadística se calcula por separado.':active.desc;$('#trisDrawWrap').hidden=active.id!=='tris';$('#chispazoDrawWrap').hidden=active.id!=='chispazo';$('#trisDraw').innerHTML=trisDraws.map(m=>`<option>${m}</option>`).join('');$('#chispazoDraw').innerHTML=chispazoDraws.map(m=>`<option>${m}</option>`).join('');$('#mode').innerHTML=active.modes.map(m=>`<option>${m}</option>`).join('');const modeLabel=document.querySelector('label[for="mode"]');$('#mode').hidden=active.id==='zodiaco';if(modeLabel)modeLabel.hidden=active.id==='zodiaco';$('#generated').innerHTML='';$('#modal').hidden=false;showTab('generator');if(active.id==='zodiaco')renderZodiacEntryForm();else{$('#zodiacEntryPanel')?.remove()}updateStatsPanel()}
function showTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('#generatorPane').hidden=tab!=='generator';$('#statsPane').hidden=tab!=='stats'}
function selectedDraw(){return active?.id==='tris'?$('#trisDraw').value:active?.id==='chispazo'?$('#chispazoDraw').value:''}

// Backtesting cronológico: cada resultado se compara con una predicción basada SOLO en resultados anteriores.

function backtestTris(values){
 const rows=values.map(v=>String(v).replace(/\D/g,'')).filter(v=>v.length===5);
 if(rows.length<8)return `<div class="position-panel"><h3>Comparador histórico de estrategias</h3><p class="muted">Se necesitan al menos 8 resultados válidos para comparar estrategias.</p></div>`;
 const names=['E-FALTANTE','A-ATRASADO','C-CALIENTE','F-FRÍO','M-COMÚN','H1-EAC','H2-ACP','H3-ESCALERA','SNIPER ATRASADO','SNIPER POOL'];
 const totals=names.map(name=>({name,tested:0,positionHits:0,exact:0}));
 for(let i=7;i<rows.length;i++){
  const history=rows.slice(Math.max(0,i-50),i),actual=rows[i],matrix=Array.from({length:5},()=>Array(10).fill(0)),last=Array.from({length:5},()=>Array(10).fill(history.length+1));
  history.forEach((v,idx)=>v.split('').forEach((d,p)=>{matrix[p][Number(d)]+=Math.pow(.985,history.length-1-idx);last[p][Number(d)]=history.length-idx}));
  const funcs=[
   (p,d)=>1+last[p][d]*.20,
   (p,d)=>1+Math.min(last[p][d],35)*.28,
   (p,d)=>1+matrix[p][d]*.85,
   (p,d)=>1+1/(1+matrix[p][d])*8,
   (p,d)=>1+matrix[p][d]*.55+Math.min(last[p][d],15)*.05,
   (p,d)=>1+matrix[p][d]*.35+last[p][d]*.10,
   (p,d)=>1+matrix[p][d]*.25+(d===(p+history.length)%10?1.5:0),
   (p,d)=>1+matrix[p][d]*.25+((d+p)%3===0?2:0),
   (p,d)=>1+Math.min(last[p][d],25)*.18+1/(1+matrix[p][d])*4,
   (p,d)=>1+matrix[p][d]*.45+Math.min(last[p][d],20)*.08
  ];
  funcs.forEach((fn,k)=>{let guess='',hits=0;for(let p=0;p<5;p++){let best=0;for(let d=0;d<10;d++)if(fn(p,d)>fn(p,best))best=d;guess+=best}for(let p=0;p<5;p++)if(guess[p]===actual[p])hits++;totals[k].tested++;totals[k].positionHits+=hits;if(guess===actual)totals[k].exact++});
 }
 totals.sort((a,b)=>(b.positionHits/b.tested)-(a.positionHits/a.tested));
 const body=totals.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.name)}</td><td>${(r.positionHits/r.tested).toFixed(2)} / 5</td><td>${r.exact}</td><td>${(r.exact/r.tested*100).toFixed(3)}%</td></tr>`).join('');
 return `<div class="position-panel"><h3>Comparador histórico · 10 estrategias TRIS</h3><p class="muted">Evaluación cronológica: los resultados con fecha se ordenan de más antiguo a más reciente y cada estrategia usa únicamente hasta 50 resultados anteriores al que se está probando. Para comparar de forma reproducible se toma el dígito de mayor peso en cada posición, incluyendo el 0; es una aproximación determinista del motor, no una reproducción de sus sorteos aleatorios. El promedio aleatorio teórico es 0.5 aciertos posicionales de 5 por jugada.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Pos.</th><th>Estrategia</th><th>Aciertos posicionales promedio</th><th>Directas exactas</th><th>Tasa exacta</th></tr></thead><tbody>${body}</tbody></table></div><p class="muted">El orden refleja este histórico, no una ventaja garantizada en próximos sorteos. Las puntuaciones y frecuencias no cambian las probabilidades matemáticas del sorteo.</p></div>`;
}



function trisCrossBacktest(draw){
 const own=allEntriesFor('tris',draw).map((e,i)=>({value:String(e.value).replace(/\D/g,''),date:e.date?String(e.date).slice(0,10):'',order:i})).filter(e=>e.value.length===5);
 own.sort((a,b)=>a.date&&b.date?dateRank(a.date)-dateRank(b.date):a.date?1:b.date?-1:a.order-b.order);
 const other=trisDraws.filter(n=>n!==draw).flatMap(n=>allEntriesFor('tris',n).map((e,i)=>({value:String(e.value).replace(/\D/g,''),date:e.date?String(e.date).slice(0,10):'',order:i}))).filter(e=>e.value.length===5&&e.date);
 const result={individual:{hits:0,tests:0},combined:{hits:0,tests:0},usedCross:0};
 for(let i=7;i<own.length;i++){
  const target=own[i],history=own.slice(Math.max(0,i-50),i);
  const priorOther=target.date?other.filter(e=>e.date&&dateRank(e.date)<dateRank(target.date)): [];
  const matrix=Array.from({length:5},()=>Array(10).fill(1));
  const cross=Array.from({length:5},()=>Array(10).fill(0));
  history.forEach(e=>e.value.split('').forEach((d,p)=>matrix[p][Number(d)]++));
  priorOther.forEach(e=>e.value.split('').forEach((d,p)=>cross[p][Number(d)]++));
  const crossTotal=priorOther.length;
  for(let p=0;p<5;p++){
   let bestOwn=0,bestCombined=0,scoreOwn=-1,scoreCombined=-1;
   for(let d=0;d<10;d++){
    const ownScore=matrix[p][d];
    const combinedScore=ownScore*.8+(crossTotal?cross[p][d]*(history.length/Math.max(1,crossTotal))*.2:0);
    if(ownScore>scoreOwn){scoreOwn=ownScore;bestOwn=d}
    if(combinedScore>scoreCombined){scoreCombined=combinedScore;bestCombined=d}
   }
   if(String(bestOwn)===target.value[p])result.individual.hits++;
   if(String(bestCombined)===target.value[p])result.combined.hits++;
   result.individual.tests++;result.combined.tests++;
  }
  if(crossTotal)result.usedCross++;
 }
 return result;
}

function trisCrossRadar(){
 const names=trisDraws,windows=[7,15,30,50],byDraw={};
 names.forEach(name=>{
  byDraw[name]={};
  allEntriesFor('tris',name).forEach(e=>{
   const v=String(e.value).replace(/\D/g,'');
   if(v.length!==5||!e.date)return;
   const key=String(e.date).slice(0,10);
   (byDraw[name][key]||(byDraw[name][key]=[])).push(v);
  });
 });
 const pairs=[];
 for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
  const a=names[i],b=names[j];
  const dates=Object.keys(byDraw[a]).filter(d=>byDraw[b][d]).sort((x,y)=>dateRank(x)-dateRank(y));
  if(!dates.length)continue;
  const stats={};
  windows.forEach(n=>{
   const sample=dates.slice(-n);let shared=0,positional=0;
   sample.forEach(date=>{
    const av=byDraw[a][date].at(-1),bv=byDraw[b][date].at(-1);
    const aset=new Set(av.split('')),bset=new Set(bv.split(''));
    shared+=Array.from(aset).filter(d=>bset.has(d)).length;
    for(let p=0;p<5;p++)if(av[p]===bv[p])positional++;
   });
   stats[n]={count:sample.length,shared:sample.length?(shared/sample.length).toFixed(2):'—',positional:sample.length?(positional/sample.length).toFixed(2):'—'};
  });
  pairs.push({a,b,stats});
 }
 const bt=trisCrossBacktest(selectedDraw()),rate=x=>x.tests?(100*x.hits/x.tests).toFixed(1)+'%':'—';
 const compare=`<div class="position-panel"><h3>Prueba histórica: motor individual vs. combinado</h3><p class="muted">Sorteo seleccionado: ${escapeHtml(selectedDraw())}. La señal cruzada usa únicamente resultados de otros horarios con fecha estrictamente anterior al resultado evaluado. Se elige el dígito de mayor peso por posición; los empates favorecen el dígito menor.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th>Motor</th><th>Aciertos posicionales</th><th>Evaluaciones</th><th>Tasa</th></tr></thead><tbody><tr><td>Individual</td><td>${bt.individual.hits}</td><td>${bt.individual.tests}</td><td>${rate(bt.individual)}</td></tr><tr><td>Combinado 80/20</td><td>${bt.combined.hits}</td><td>${bt.combined.tests}</td><td>${rate(bt.combined)}</td></tr></tbody></table><p class="muted">Evaluaciones con señal cruzada disponible: ${bt.usedCross}. Esta prueba mide aciertos de dígitos por posición, no premios ni probabilidades garantizadas.</p></div>`;
 if(!pairs.length)return compare+`<div class="position-panel"><h3>Radar de coincidencias entre horarios</h3><p class="muted">Aún no hay resultados fechados del mismo día en dos horarios distintos para comparar. Importa los resultados con fecha para activar este análisis.</p></div>`;
 pairs.sort((x,y)=>Number(y.stats[50].shared)-Number(x.stats[50].shared));
 return compare+`<div class="position-panel"><h3>Radar de coincidencias entre horarios</h3><p class="muted">Compara los resultados de dos horarios en fechas coincidentes. “Dígitos compartidos” cuenta dígitos distintos presentes en ambos resultados; “misma posición” cuenta coincidencias exactas en R1–R5. Se muestran ventanas de 7, 15, 30 y 50 fechas (o las disponibles si hay menos). Es un análisis histórico, no una predicción.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Horarios</th>${windows.map(n=>`<th colspan="3">Últimas ${n}</th>`).join('')}</tr><tr><th></th>${windows.map(()=>'<th>Fechas</th><th>Dígitos<br>compartidos</th><th>Misma<br>posición</th>').join('')}</tr></thead><tbody>${pairs.map(p=>`<tr><td>${escapeHtml(p.a)} ↔ ${escapeHtml(p.b)}</td>${windows.map(n=>`<td>${p.stats[n].count}</td><td>${p.stats[n].shared}</td><td>${p.stats[n].positional}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function updateStatsPanel(){if(!active)return;const draw=selectedDraw(),orderedEntries=allEntriesFor(active.id,draw).map((e,i)=>({...e,_order:i})).sort((a,b)=>{const da=dateRank(a.date),db=dateRank(b.date);return da&&db?da-db:da?1:db?-1:a._order-b._order}),vals=orderedEntries.map(e=>e.value);const freq={};if(active.id==='tris'||active.id==='zodiaco'){for(let i=0;i<=9;i++)freq[String(i)]=0}else{const max=active.id==='chispazo'?28:56;for(let i=1;i<=max;i++)freq[String(i)]=0}vals.forEach(v=>{if(active.id==='tris'||active.id==='zodiaco'){String(v).replace(/\D/g,'').split('').forEach(d=>freq[d]=(freq[d]||0)+1)}else String(v).split(/[ ·,;\s]+/).forEach(n=>{if(/^\d+$/.test(n)){const k=String(Number(n));if(k in freq)freq[k]++}})});const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]));const hot=sorted.slice(0,5),cold=sorted.slice(-5).reverse();const label=['tris','chispazo'].includes(active.id)?`${active.name} · ${draw}`:active.name;const positionPanel=active.id==='tris'?(()=>{const clean=vals.map(v=>String(v).replace(/\D/g,'')).filter(v=>v.length===5);const rows=Array.from({length:5},(_,pos)=>{const counts=Array(10).fill(0),lastSeen=Array(10).fill(null);clean.forEach((v,idx)=>{const d=Number(v[pos]);counts[d]++;lastSeen[d]=clean.length-idx});const max=Math.max(1,...counts);return `<div class="position-row"><b>R${pos+1}</b>${counts.map((n,d)=>`<span title="Dígito ${d}: ${n} veces${lastSeen[d]===null?'; nunca apareció':`; última aparición hace ${lastSeen[d]-1} resultados`}" style="opacity:${0.55+0.45*n/max}"><strong>${d}</strong><small>${n}</small></span>`).join('')}</div>`}).join('');return `<div class="position-panel"><h3>Matriz posicional TRIS</h3><p class="muted">Frecuencia por dígito y posición. Al tocar una celda verás cuántos resultados han pasado desde su última aparición.</p>${rows}<h4>Matriz Fibonacci 5 × 5 (módulo 10)</h4><div class="position-row fibonacci-grid">${[1,1,2,3,5,8,3,1,4,5,9,4,3,7,0,7,7,4,1,5,6,1,7,8,5].map((n,i)=>`<span title="Fila ${Math.floor(i/5)+1}, columna ${i%5+1}"><strong>${n}</strong></span>`).join('')}</div><p class="muted">Referencia matemática construida con la sucesión de Fibonacci reducida módulo 10. Es una visualización exploratoria, no una regla oficial ni una señal predictiva.</p><p class="muted">La matriz describe el historial seleccionado; una ausencia no hace que un dígito sea más probable en el siguiente sorteo.</p></div>${trisCrossRadar()}`})():'';const melatePanel=['melate','revancha','revanchita'].includes(active.id)?(()=>{const draws=vals.map(v=>String(v).split(/[ ·,;\\s]+/).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=56)).filter(a=>a.length===6);const odd=draws.reduce((s,a)=>s+a.filter(n=>n%2).length,0);const even=draws.reduce((s,a)=>s+a.filter(n=>n%2===0).length,0);const low=draws.reduce((s,a)=>s+a.filter(n=>n<=28).length,0);const high=draws.reduce((s,a)=>s+a.filter(n=>n>28).length,0);const sums=draws.map(a=>a.reduce((s,n)=>s+n,0));const avg=sums.length?(sums.reduce((a,b)=>a+b,0)/sums.length).toFixed(1):'—';const seen=new Set(draws.flat());const coverage=seen.size;const overlap=draws.length>1?draws.slice(1).reduce((sum,d,i)=>sum+d.filter(n=>draws[i].includes(n)).length,0)/(draws.length-1):0;return `<div class="position-panel"><h3>Perfil y cobertura · ${escapeHtml(active.name)}</h3><p class="muted">Análisis exclusivo del historial importado de este juego; no mezcla datos con Melate, Revancha ni Revanchita.</p><div class="freq-grid"><div class="freq-card"><b>Impares / pares</b><p>${odd} / ${even}</p></div><div class="freq-card"><b>1–28 / 29–56</b><p>${low} / ${high}</p></div><div class="freq-card"><b>Suma promedio de 6 números</b><p>${avg}</p></div><div class="freq-card"><b>Sorteos válidos analizados</b><p>${draws.length}</p></div><div class="freq-card"><b>Números distintos vistos</b><p>${coverage} / 56</p></div><div class="freq-card"><b>Repeticiones vs. sorteo anterior</b><p>${overlap.toFixed(2)} promedio</p></div></div><p class="muted">La cobertura cuenta cuántos números distintos aparecen en el historial. La repetición es un resumen descriptivo entre sorteos consecutivos, no una recomendación de apuesta.</p></div>`})():'';const zodiacPanel=active.id==='zodiaco'?(()=>{const entries=vals.map(zodiacResultParts).filter(Boolean);const positions=Array.from({length:4},(_,p)=>{const counts=Array(10).fill(0);entries.forEach(e=>counts[Number(e.number[p])]++);return `<div class="position-row"><b>R${p+1}</b>${counts.map((n,d)=>`<span title="Dígito ${d}: ${n} veces"><strong>${d}</strong><small>${n}</small></span>`).join('')}</div>`}).join('');const signCounts=zodiac.map(sign=>({sign,count:entries.filter(e=>e.sign===sign).length})).sort((a,b)=>b.count-a.count);return `<div class="position-panel"><h3>Análisis ZODIACO · Número y signo</h3><p class="muted">Se analizan ${entries.length} resultados completos con cuatro cifras y signo registrado.</p><h4>Frecuencia por posición</h4>${positions}<h4>Frecuencia por signo</h4><div class="freq-list">${signCounts.map(x=>`<span class="freq-chip"><b>${escapeHtml(x.sign)}</b><small>${x.count} veces</small></span>`).join('')}</div></div>`})():'';const backtestPanel=active.id==='tris'?backtestTris(vals):'';$('#statsContent').innerHTML=`<p><strong>${vals.length}</strong> resultados analizados en ${escapeHtml(label)}.</p>${positionPanel}${zodiacPanel}${backtestPanel}${melatePanel}<div class="freq-grid"><div class="freq-card"><h3>🔥 Números calientes</h3><p class="muted">Los cinco dígitos/números más frecuentes del historial importado</p><div class="freq-list">${hot.map(([n,c])=>`<span class="freq-chip hot"><b>${escapeHtml(n)}</b><small>${c} veces</small></span>`).join('')}</div></div><div class="freq-card"><h3>❄️ Números fríos</h3><p class="muted">Los cinco menos frecuentes; incluye valores con cero apariciones</p><div class="freq-list">${cold.map(([n,c])=>`<span class="freq-chip cold"><b>${escapeHtml(n)}</b><small>${c} veces</small></span>`).join('')}</div></div></div><p class="muted">${vals.length?'Las frecuencias se calculan solo con el historial importado.':'Aún no hay resultados importados para este juego/sorteo; se muestran frecuencias en cero.'} Son estadísticas descriptivas, no predicciones ni garantía de premios.</p>`}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{showTab(b.dataset.tab);if(b.dataset.tab==='stats')updateStatsPanel()}));$('#trisDraw').addEventListener('change',updateStatsPanel);$('#chispazoDraw').addEventListener('change',updateStatsPanel);$('#mode').addEventListener('change',updateStatsPanel);$('#closeModal').onclick=()=>$('#modal').hidden=true;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').hidden=true});
function randUnique(max,n){const s=new Set();while(s.size<n)s.add(1+Math.floor(Math.random()*max));return [...s].sort((a,b)=>a-b)}
function weightedPick(weights){const total=weights.reduce((a,b)=>a+b,0);if(!total)return Math.floor(Math.random()*weights.length);let r=Math.random()*total;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return i}return weights.length-1}
function trisPositionWeights(draw,digits){
 const own=allEntriesFor('tris',draw).map(e=>String(e.value).replace(/\D/g,'')).filter(v=>v.length===5);
 const others=trisDraws.filter(name=>name!==draw).flatMap(name=>allEntriesFor('tris',name).map(e=>String(e.value).replace(/\D/g,'')).filter(v=>v.length===5));
 return Array.from({length:digits},(_,pos)=>{
  const ownCounts=Array(10).fill(1),crossCounts=Array(10).fill(0);
  own.forEach(v=>ownCounts[Number(v[pos])]++);
  others.forEach(v=>crossCounts[Number(v[pos])]++);
  const crossTotal=crossCounts.reduce((a,b)=>a+b,0);
  // El sorteo seleccionado domina (80%); los otros horarios aportan una señal secundaria (20%).
  // No se copian resultados completos de otros sorteos: solo se combinan frecuencias por posición.
  return ownCounts.map((weight,digit)=>weight*.8+(crossTotal?crossCounts[digit]*(own.length/Math.max(1,crossTotal))*.2:0));
 });
}
function numberWeights(gameId,draw,max){const vals=allEntriesFor(gameId,draw).map(e=>String(e.value));const counts=Array(max).fill(1);vals.forEach(v=>v.split(/[ ·,;\s]+/).forEach(token=>{const n=Number(token);if(Number.isInteger(n)&&n>=1&&n<=max)counts[n-1]++}));return counts}
function generateOne(){
 const mode=$('#mode').value,draw=selectedDraw();
 if(active.id==='tris'){const d=mode==='3 cifras'?3:mode==='4 cifras'?4:5;if(mode==='Pares')return String(Math.floor(Math.random()*100)).padStart(2,'0');const weights=trisPositionWeights(draw,d);return Array.from({length:d},(_,i)=>String(weightedPick(weights[i]))).join('')}
 if(active.id==='zodiaco'){const digits=zodiacDigitWeights().map(weights=>String(weightedPick(weights))).join('');const sign=zodiac[weightedPick(zodiacSignWeights())];return `${digits} | ${sign}`;}
 if(active.id==='chispazo'){const weights=numberWeights('chispazo',draw,28),chosen=new Set();while(chosen.size<5){const idx=weightedPick(weights);chosen.add(idx+1)}return [...chosen].sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0')).join(' · ')}
 const weights=numberWeights(active.id,'',56),chosen=new Set();while(chosen.size<6){const idx=weightedPick(weights);chosen.add(idx+1)}return [...chosen].sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0')).join(' · ')
}
// Motor experimental de diez estrategias para TRIS: pondera frecuencia, recencia y ausencia por posición.
function trisStrategyRows(draw){
 const entries=allEntriesFor('tris',draw).map(e=>String(e.value).replace(/\D/g,'')).filter(v=>v.length===5);
 const matrix=Array.from({length:5},(_,p)=>Array(10).fill(0));
 entries.forEach((v,idx)=>v.split('').forEach((d,p)=>{matrix[p][Number(d)]+=Math.pow(.985,entries.length-1-idx)}));
 const lastSeen=Array.from({length:5},()=>Array(10).fill(entries.length+1));
 entries.forEach((v,idx)=>v.split('').forEach((d,p)=>lastSeen[p][Number(d)]=entries.length-idx));
 const strategies=[
  ['E-FALTANTE',(p,d)=>1+lastSeen[p][d]*.20],
  ['A-ATRASADO',(p,d)=>1+Math.min(lastSeen[p][d],35)*.28],
  ['C-CALIENTE',(p,d)=>1+matrix[p][d]*.85],
  ['F-FRÍO',(p,d)=>1+1/(1+matrix[p][d]) * 8],
  ['M-COMÚN',(p,d)=>1+matrix[p][d]*.55+Math.min(lastSeen[p][d],15)*.05],
  ['H1-EAC',(p,d)=>1+matrix[p][d]*.35+lastSeen[p][d]*.10],
  ['H2-ACP',(p,d)=>1+matrix[p][d]*.25+(d===Number(String((p+draw.length)%10))?1.5:0)],
  ['H3-ESCALERA',(p,d)=>1+matrix[p][d]*.25+((d+p)%3===0?2:0)],
  ['SNIPER ATRASADO',(p,d)=>1+Math.min(lastSeen[p][d],25)*.18+1/(1+matrix[p][d])*4],
  ['SNIPER POOL',(p,d)=>1+matrix[p][d]*.45+Math.min(lastSeen[p][d],20)*.08]
 ];
 const seen=new Set(),rows=[];
 for(const [name,weightFn] of strategies){
  let value='',rawScore=0;
  for(let p=0;p<5;p++){
   const weights=Array.from({length:10},(_,d)=>weightFn(p,d));
   const digit=String(weightedPick(weights));value+=digit;
   rawScore+=Math.log(weights[Number(digit)]/weights.reduce((a,b)=>a+b,0));
  }
  if(seen.has(value)){for(let tries=0;tries<8&&seen.has(value);tries++){value=Array.from({length:5},(_,p)=>String(weightedPick(Array.from({length:10},(_,d)=>weightFn(p,d))))).join('')}}
  seen.add(value);
  rows.push({name,value,score:Math.max(50,Math.min(99,Math.round(85+rawScore*2)))});
 }
 return rows;
}

// Genera combinaciones de 6 números con cobertura y diversidad entre jugadas.
function generateMelateCoverage(gameId,count){
 const weights=numberWeights(gameId,'',56),chosenRows=[],used=new Set();
 const target=Math.max(1,Math.min(30,count));
 for(let k=0;k<target;k++){
  let best=null,bestScore=-Infinity;
  for(let attempt=0;attempt<80;attempt++){
   const set=new Set();
   while(set.size<6){const adjusted=weights.map((w,i)=>w*(used.has(i+1)?0.62:1));set.add(weightedPick(adjusted)+1)}
   const nums=[...set].sort((a,b)=>a-b);
   const overlap=chosenRows.length?Math.max(...chosenRows.map(row=>row.filter(n=>set.has(n)).length)):0;
   const sum=nums.reduce((a,b)=>a+b,0),odd=nums.filter(n=>n%2).length;
   const balancePenalty=Math.abs(odd-3)*1.8+Math.abs(sum-171)/55;
   const score=nums.reduce((a,n)=>a+Math.log(weights[n-1]),0)-overlap*2.4-balancePenalty;
   if(score>bestScore&&!chosenRows.some(row=>row.every((n,i)=>n===nums[i]))){best=nums;bestScore=score}
  }
  if(!best)break;
  chosenRows.push(best);best.forEach(n=>used.add(n));
 }
 return chosenRows;
}
$('#generateBtn').onclick=()=>{
 const n=Math.max(1,Math.min(100,Number($('#amount').value)||10)),draw=selectedDraw(),mode=$('#mode').value,gameLabel=active.name;let out=Array.from({length:n},generateOne),coveragePanel='';if(['melate','revancha','revanchita'].includes(active.id)&&mode!=='Adicional'){const rows=generateMelateCoverage(active.id,Math.min(n,30));out=rows.map(row=>row.map(v=>String(v).padStart(2,'0')).join(' · '));const unique=new Set(rows.flat());coveragePanel=`<section class="position-panel" style="grid-column:1/-1"><h3>Cobertura inteligente · ${escapeHtml(active.name)}</h3><p class="muted">${rows.length} jugadas · ${unique.size} números distintos cubiertos de 56. El algoritmo favorece diversidad entre jugadas y equilibrio descriptivo.</p><p class="muted">La cobertura no aumenta la probabilidad matemática de una combinación individual ni garantiza premios.</p></section>`;}
 const now=new Date().toISOString();
 out.forEach(value=>tracked.push({id:`${now}-${Math.random().toString(36).slice(2,8)}`,gameId:active.id,gameLabel,draw,mode,value,createdAt:now}));
 let classified='';
 if(active.id==='tris'&&mode==='5 cifras'){
  const rows=trisStrategyRows(draw);
  rows.forEach((r,i)=>tracked.push({id:`${now}-sniper-${i}-${Math.random().toString(36).slice(2,6)}`,gameId:'tris',gameLabel:'TRIS',draw,mode:'5 cifras',value:r.value,createdAt:now,strategy:r.name}));
  classified=`<section class="position-panel" style="grid-column:1/-1"><h3>10 jugadas clasificadas · Motor experimental</h3><p class="muted">Estrategias calculadas con el histórico seleccionado. La puntuación es un índice interno, no una probabilidad de ganar.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>ID</th><th>Estrategia</th><th>R1</th><th>R2</th><th>R3</th><th>R4</th><th>R5</th><th>Índice</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>#${String(i+1).padStart(2,'0')}</td><td>${escapeHtml(r.name)}</td>${r.value.split('').map(d=>`<td style="text-align:center;padding:6px">${d}</td>`).join('')}<td>${r.score}/100</td></tr>`).join('')}</tbody></table></div><p class="muted">También se guardaron en Centro de Aciertos para evaluación posterior.</p></section>`;
 }
 localStorage.setItem(comboKey,JSON.stringify(tracked));
 $('#generated').innerHTML=coveragePanel+classified+out.map((v,i)=>`<div class="combo">${String(i+1).padStart(2,'0')} · ${escapeHtml(v)}</div>`).join('')+'<p class="muted" style="grid-column:1/-1">Combinaciones guardadas automáticamente en Centro de Aciertos para seguimiento. No son predicciones.</p>';
 renderCombos();
};
function matchCombo(combo,result){
 if(combo.gameId==='zodiaco'){
  const a=zodiacResultParts(combo.value),b=zodiacResultParts(result);
  if(!a||!b)return {exact:false,matches:0,kind:'número y signo'};
  let positional=0;for(let i=0;i<4;i++)if(a.number[i]===b.number[i])positional++;
  const signMatch=a.sign===b.sign?1:0;
  return {exact:positional===4&&signMatch===1,matches:positional+signMatch,kind:'dígitos en misma posición + signo'};
 }
 if(combo.gameId==='tris'){
  const digits=combo.mode==='3 cifras'?3:combo.mode==='4 cifras'?4:combo.mode==='Pares'?2:5;
  const a=String(combo.value).replace(/\D/g,'').slice(-digits),b=String(result).replace(/\D/g,'').slice(-digits);
  let positional=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]===b[i])positional++;
  return {exact:a.length===digits&&b.length===digits&&a===b,matches:positional,kind:'posiciones coincidentes'};
 }
 const a=String(combo.value).split(/[ ·,;\s]+/).filter(Boolean),b=String(result).split(/[ ·,;\s]+/).filter(Boolean);
 const au=[...new Set(a)],bu=[...new Set(b)],matches=au.filter(n=>bu.includes(n)).length;
 // En juegos de combinación, el orden no importa, pero los números duplicados nunca deben inflar los aciertos.
 const exact=a.length===b.length&&au.length===a.length&&bu.length===b.length&&matches===a.length;
 return {exact,matches,kind:'números coincidentes'}
}
const NUMERIQ_TIME_ZONE='America/Cancun';
function zonedDateParts(date){
 const parts=new Intl.DateTimeFormat('en-CA',{
  timeZone:NUMERIQ_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(date);
 return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
function localDayKey(date){
 const p=zonedDateParts(date);
 return `${p.year}-${p.month}-${p.day}`;
}
function entryDayKey(value){
 const v=String(value||'').trim();
 let m=v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
 if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
 m=v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
 if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
 return '';
}
function scheduledDrawMinute(gameId,draw){
 if(gameId==='tris'){
  const n=norm(draw);
  if(n.includes('mediodia'))return 13*60;
  if(n.includes('de las 3'))return 15*60;
  if(n==='extra')return 17*60;
  if(n.includes('de las 7'))return 19*60;
  if(n.includes('clasico'))return 21*60;
 }
 if(gameId==='zodiaco')return 21*60;
 return null;
}
function resultIsAfterCombo(combo,entry){
 const created=new Date(combo.createdAt);
 if(Number.isNaN(created.getTime()))return false;
 const createdDay=localDayKey(created),resultDay=entryDayKey(entry.date);
 if(!resultDay)return false;
 if(resultDay>createdDay)return true;
 if(resultDay<createdDay)return false;
 // En el mismo día solo se evalúa un resultado TRIS si su horario oficial
 // es posterior a la hora local en que se generó la jugada.
 const drawMinute=scheduledDrawMinute(combo.gameId,combo.draw||'');
 if(drawMinute===null)return false;
 const localParts=zonedDateParts(created);
 const createdMinute=Number(localParts.hour)*60+Number(localParts.minute);
 return drawMinute>createdMinute;
}
function updateTrackedHits(){
 for(const c of tracked){
  // Se evalúa el primer sorteo posterior por fecha y, en TRIS, también por horario.
  const entries=allEntriesFor(c.gameId,c.draw||'')
   .filter(e=>e.date&&dateRank(e.date)>0&&resultIsAfterCombo(c,e))
   .sort((a,b)=>{
    const dayA=entryDayKey(a.date),dayB=entryDayKey(b.date);
    if(dayA!==dayB)return dayA.localeCompare(dayB);
    const timeA=scheduledDrawMinute(c.gameId,c.draw||'')??0;
    const timeB=scheduledDrawMinute(c.gameId,c.draw||'')??0;
    return timeA-timeB||dateRank(a.date)-dateRank(b.date);
   });
  const next=entries[0];
  if(next){const m=matchCombo(c,next.value);c.hit={...m,date:next.date,result:next.value,exact:m.exact,checkedAt:new Date().toISOString()};}
  else delete c.hit;
 }
}
$('#syncTrisBtn')?.addEventListener('click',syncOfficialTris);
$('#importGame').addEventListener('change',()=>{$('#importDrawWrap').hidden=!['tris','chispazo'].includes($('#importGame').value);$('#importDrawLabel').textContent=$('#importGame').value==='chispazo'?'Sorteo Chispazo del archivo':'Sorteo TRIS del archivo';$('#importDraw').innerHTML=($('#importGame').value==='chispazo'?chispazoDraws:trisDraws).map(m=>`<option>${m}</option>`).join('')});
$('#csvFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const rows=parseCSV(await f.text());importRows(rows,f.name,$('#importGame').value,$('#importDraw').value)}catch(err){$('#importStatus').textContent=`No se pudo procesar el CSV: ${err.message}`}e.target.value=''});
$('#clearBtn').onclick=()=>{if(confirm('¿Borrar todos los registros históricos importados guardados en este dispositivo? Las combinaciones guardadas no se borrarán.')){records=[];localStorage.setItem(key,'[]');renderAll();$('#importStatus').textContent='Historial importado borrado.'}};
const backupBox=document.createElement('section');backupBox.className='position-panel';backupBox.style.margin='18px auto';backupBox.style.maxWidth='1100px';backupBox.innerHTML='<h3>Respaldo y protección de datos</h3><p class="muted">Descarga una copia de tus historiales y combinaciones antes de actualizar NUMERIQ AI. Restaurar combina los datos del respaldo con los actuales; no borra lo que ya tienes.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" id="backupExportBtn">Descargar respaldo</button><button type="button" id="backupImportBtn">Restaurar respaldo</button><button type="button" id="storageProtectBtn">Proteger almacenamiento</button><button type="button" id="storageCheckBtn">Revisar espacio</button><input type="file" id="backupFile" accept=".json,application/json" hidden></div><p id="storageHealthStatus" class="muted" aria-live="polite">El almacenamiento del navegador puede tener límites; conserva una copia externa.</p>';
document.body.appendChild(backupBox);
$('#backupExportBtn').addEventListener('click',exportBackup);
$('#backupImportBtn').addEventListener('click',()=>$('#backupFile').click());
$('#storageProtectBtn').addEventListener('click',requestPersistentStorage);
$('#storageCheckBtn').addEventListener('click',checkStorageHealth);
checkStorageHealth();
$('#backupFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{await restoreBackup(f)}catch(err){$('#importStatus').textContent='No se pudo restaurar el respaldo: '+err.message}e.target.value=''});
renderAll();window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}};if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
