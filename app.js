// NUMERIQ AI 1.9.1 — análisis histórico por posición y validación reforzada.
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
function persist(){localStorage.setItem(key,JSON.stringify(records));localStorage.setItem(comboKey,JSON.stringify(tracked));renderAll()}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(s){return String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
function dateRank(s){if(!s)return 0;const v=String(s).trim();let m=v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return Date.UTC(+m[1],+m[2]-1,+m[3]);m=v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);if(m)return Date.UTC(+m[3],+m[2]-1,+m[1]);const t=Date.parse(v);return Number.isFinite(t)?t:0}
function dateFromRow(row,headers){const i=headers.findIndex(h=>/(^|\b)(fecha|date|dia del sorteo)(\b|$)/.test(h));return i>=0?String(row[i]||'').trim():''}
function detectDraw(s){s=norm(s).replace(/[._-]/g,' ');if(/mediodia|medio dia|12:00|12\s*(pm|p\.m\.)/.test(s))return 'Mediodía';if(/\bextra\b/.test(s))return 'Extra';if(/clasico/.test(s))return 'Clásico';if(/de las?\s*7|delas?\s*7|las siete|de las siete|7\s*(pm|p\.m\.)|19:00/.test(s))return 'De las 7';if(/de las?\s*3|delas?\s*3|las tres|de las tres|3\s*(pm|p\.m\.)|15:00/.test(s))return 'De las 3';return ''}
function detectChispazoDraw(s){s=norm(s).replace(/[._-]/g,' ');if(/chispazo.{0,18}(9|nueve)|(?:9|nueve).{0,18}(de la noche|pm|p m)|21:00/.test(s))return chispazoDraws[1];if(/chispazo.{0,18}(3|tres)|(?:3|tres).{0,18}(de la tarde|pm|p m)|15:00/.test(s))return chispazoDraws[0];return ''}
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
 const wideCols=headers.map((h,i)=>({h,i,gameId:detectGame(h),draw:detectGame(h)==='chispazo'?detectChispazoDraw(h):detectDraw(h)})).filter(x=>x.gameId&&x.draw);
 // Formato ancho: cada columna representa un juego o una modalidad TRIS.
 for(const row of data){const date=dateIndex>=0?String(row[dateIndex]||'').trim():'';for(const col of wideCols){if(userForcedGame&&userForcedGame!==col.gameId)continue;for(const value of extractResult(row[col.i],col.gameId,col.h))addDetected(found,col.gameId,col.draw,'',value,date)}}
 // Formato vertical: juego, sorteo y resultado en columnas separadas; admite CSV mixto.
 for(const row of data){
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
 for(const [k,items] of grouped){const [gameId,draw,mode]=k.split('|'),g=games.find(x=>x.id===gameId);const entries=items.map(x=>({value:x.value,date:x.date,importedAt:new Date().toISOString()}));records.push({gameId,draw,mode,values:entries.map(x=>x.value),entries,name:g?.name||gameId,gameLabel:gameId==='tris'?`TRIS · ${draw}`:g?.name||gameId,count:entries.length,file:fileName,date:items.map(x=>x.date).filter(Boolean).sort((a,b)=>dateRank(a)-dateRank(b)).at(-1)||new Date().toLocaleDateString('es-MX')})}
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
 try{
  const response=await fetch('/.netlify/functions/tris-results',{headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error(`El servicio respondió ${response.status}.`);
  const payload=await response.json();
  if(!payload.ok||!Array.isArray(payload.results)||!payload.results.length)throw new Error(payload.error||'La fuente oficial no devolvió resultados reconocibles.');
  const valid=payload.results.filter(item=>/^\d{5}$/.test(String(item.value||''))&&item.draw&&item.drawNo);
  if(!valid.length)throw new Error('La fuente no devolvió resultados TRIS con número de sorteo válido.');

  // El número oficial de sorteo identifica un resultado de forma única.
  // Si ya existe con otra modalidad, se retira de esa modalidad y se guarda
  // una sola vez en la modalidad calculada por la función oficial.
  let added=0,duplicates=0,repaired=0;
  const normalized=valid.map(item=>({
   gameId:'tris',draw:item.draw,mode:'',value:String(item.value),date:item.date||'',
   drawNo:String(item.drawNo),sourceId:String(item.drawNo),multiplier:item.multiplier||'',
   importedAt:new Date().toISOString()
  }));
  const officialIds=new Set(normalized.map(e=>e.drawNo));

  for(const record of records.filter(r=>r.gameId==='tris')){
   const oldEntries=Array.isArray(record.entries)?record.entries:(record.values||[]).map(value=>({value,date:record.date||''}));
   const kept=oldEntries.filter(entry=>{
    const id=String(entry.drawNo||entry.sourceId||'');
    if(!id||!officialIds.has(id))return true;
    const official=normalized.find(e=>e.drawNo===id);
    if(official&&record.draw!==official.draw){repaired++;return false;}
    return true;
   });
   record.entries=kept;
   record.values=kept.map(e=>String(e.value));
   record.count=kept.length;
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
    if(String(entries[index].value)!==entry.value||record.draw!==entry.draw)repaired++;
    entries[index]={...entries[index],...entry};
    duplicates++;
   }else{
    entries.push(entry);added++;
   }
   record.entries=entries;
   record.values=entries.map(e=>String(e.value));
   record.count=entries.length;
   record.date=entries.map(e=>e.date).filter(Boolean).sort((a,b)=>dateRank(a)-dateRank(b)).at(-1)||record.date;
  }
  updateTrackedHits();persist();
  const when=payload.updatedAt?new Date(payload.updatedAt).toLocaleString('es-MX'):'ahora';
  status.textContent=`Actualización terminada: ${added} resultados nuevos; ${duplicates} ya estaban guardados; ${repaired} registros mal clasificados o desactualizados reparados. Fuente oficial consultada ${when}.`;
  status.dataset.state='success';
 }catch(err){
  status.textContent=`No se pudo actualizar automáticamente: ${err.message} Puedes intentarlo más tarde; tus datos guardados no se modificaron.`;
  status.dataset.state='error';
 }finally{
  btn.disabled=false;btn.textContent='↻ Actualizar resultados TRIS';
 }
}
function renderLatestResults(){const targets=[];games.forEach(g=>{if(g.id==='tris')trisDraws.forEach(draw=>targets.push({id:g.id,draw,label:`TRIS · ${draw}`}));else if(g.id==='chispazo')chispazoDraws.forEach(draw=>targets.push({id:g.id,draw,label:`CHISPAZO · ${draw}`}));else targets.push({id:g.id,draw:'',label:g.name})});$('#latestResults').innerHTML=targets.map(t=>{const entries=allEntriesFor(t.id,t.draw).slice().sort((a,b)=>dateRank(a.date)-dateRank(b.date)||(Number(a.drawNo)||0)-(Number(b.drawNo)||0));const last=entries.at(-1);return `<article class="latest-card"><h3>${escapeHtml(t.label)}</h3><div class="latest-value">${last?escapeHtml(last.value):'—'}</div><div class="latest-meta">${last?`Último resultado disponible · ${escapeHtml(last.date||'fecha no disponible')}`:'Sin resultados guardados'}</div></article>`}).join('')}
function renderHistory(){const total=records.reduce((a,r)=>a+(r.values?.length||Number(r.count)||0),0);$('#drawCount').textContent=total;$('#history').innerHTML=records.length?records.slice(-12).reverse().map(r=>`<div class="history-row"><b>${escapeHtml(r.gameLabel||r.name||'Sorteo')}</b> · ${r.values?.length||r.count||0} resultados <small>${escapeHtml(r.date||'')} · ${escapeHtml(r.file||'CSV')}</small></div>`).join(''):'Tus resultados importados aparecerán aquí.'}
function renderCombos(){const box=$('#trackedCombos');if(!box)return;if(!tracked.length){box.innerHTML='<p class="muted">Las combinaciones que generes aparecerán aquí para darles seguimiento.</p>';return}box.innerHTML=tracked.slice(-30).reverse().map(c=>{const hit=c.hit||null;return `<article class="track-row"><div><b>${escapeHtml(c.gameLabel)}${c.draw?` · ${escapeHtml(c.draw)}`:''}</b><div class="track-value">${escapeHtml(c.value)}</div><small>${new Date(c.createdAt).toLocaleString('es-MX')}</small></div><div class="track-status">${hit?`<b>${hit.exact?'Coincidencia exacta':'Sin premio exacto'}</b><small>${hit.matches} posiciones coincidentes · ${escapeHtml(hit.date||'')}</small>`:'<small>En seguimiento</small>'}</div></article>`}).join('')}
function renderAll(){renderHistory();renderLatestResults();renderCombos();if(active)updateStatsPanel()}
$('#games').innerHTML=games.map(g=>`<article class="game-card" data-id="${g.id}"><span class="arrow">↗</span><div class="game-icon">${g.icon}</div><h3>${g.name}</h3><p>${g.desc}</p></article>`).join('');document.querySelectorAll('.game-card').forEach(c=>c.addEventListener('click',()=>openGame(c.dataset.id)));
function openGame(id){active=games.find(g=>g.id===id);$('#modalKicker').textContent='MÓDULO DE ANÁLISIS';$('#modalTitle').textContent=active.name;$('#modalDesc').textContent=active.id==='tris'?'Elige cualquiera de los cinco sorteos. Cada historial y estadística se calcula por separado.':active.desc;$('#trisDrawWrap').hidden=active.id!=='tris';$('#chispazoDrawWrap').hidden=active.id!=='chispazo';$('#trisDraw').innerHTML=trisDraws.map(m=>`<option>${m}</option>`).join('');$('#chispazoDraw').innerHTML=chispazoDraws.map(m=>`<option>${m}</option>`).join('');$('#mode').innerHTML=active.modes.map(m=>`<option>${m}</option>`).join('');$('#generated').innerHTML='';$('#modal').hidden=false;showTab('generator');updateStatsPanel()}
function showTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('#generatorPane').hidden=tab!=='generator';$('#statsPane').hidden=tab!=='stats'}
function selectedDraw(){return active?.id==='tris'?$('#trisDraw').value:active?.id==='chispazo'?$('#chispazoDraw').value:''}
function updateStatsPanel(){if(!active)return;const draw=selectedDraw(),vals=allEntriesFor(active.id,draw).map(e=>e.value);const freq={};if(active.id==='tris'||active.id==='zodiaco'){for(let i=0;i<=9;i++)freq[String(i)]=0}else{const max=active.id==='chispazo'?28:56;for(let i=1;i<=max;i++)freq[String(i)]=0}vals.forEach(v=>{if(active.id==='tris'||active.id==='zodiaco'){String(v).replace(/\D/g,'').split('').forEach(d=>freq[d]=(freq[d]||0)+1)}else String(v).split(/[ ·,;\s]+/).forEach(n=>{if(/^\d+$/.test(n)){const k=String(Number(n));if(k in freq)freq[k]++}})});const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]));const hot=sorted.slice(0,5),cold=sorted.slice(-5).reverse();const label=['tris','chispazo'].includes(active.id)?`${active.name} · ${draw}`:active.name;const positionPanel=active.id==='tris'?(()=>{const rows=Array.from({length:5},(_,pos)=>{const counts=Array(10).fill(0);vals.map(v=>String(v).replace(/\D/g,'')).filter(v=>v.length===5).forEach(v=>counts[Number(v[pos])]++);return `<div class="position-row"><b>R${pos+1}</b>${counts.map((n,d)=>`<span title="Dígito ${d}: ${n} veces"><strong>${d}</strong><small>${n}</small></span>`).join('')}</div>`}).join('');return `<div class="position-panel"><h3>Matriz de dígitos por posición</h3><p class="muted">Frecuencia de cada dígito del 0 al 9 en R1–R5</p>${rows}</div>`})():'';$('#statsContent').innerHTML=`<p><strong>${vals.length}</strong> resultados analizados en ${escapeHtml(label)}.</p>${positionPanel}<div class="freq-grid"><div class="freq-card"><h3>🔥 Números calientes</h3><p class="muted">Los cinco dígitos/números más frecuentes del historial importado</p><div class="freq-list">${hot.map(([n,c])=>`<span class="freq-chip hot"><b>${escapeHtml(n)}</b><small>${c} veces</small></span>`).join('')}</div></div><div class="freq-card"><h3>❄️ Números fríos</h3><p class="muted">Los cinco menos frecuentes; incluye valores con cero apariciones</p><div class="freq-list">${cold.map(([n,c])=>`<span class="freq-chip cold"><b>${escapeHtml(n)}</b><small>${c} veces</small></span>`).join('')}</div></div></div><p class="muted">${vals.length?'Las frecuencias se calculan solo con el historial importado.':'Aún no hay resultados importados para este juego/sorteo; se muestran frecuencias en cero.'} Son estadísticas descriptivas, no predicciones ni garantía de premios.</p>`}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{showTab(b.dataset.tab);if(b.dataset.tab==='stats')updateStatsPanel()}));$('#trisDraw').addEventListener('change',updateStatsPanel);$('#chispazoDraw').addEventListener('change',updateStatsPanel);$('#mode').addEventListener('change',updateStatsPanel);$('#closeModal').onclick=()=>$('#modal').hidden=true;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').hidden=true});
function randUnique(max,n){const s=new Set();while(s.size<n)s.add(1+Math.floor(Math.random()*max));return [...s].sort((a,b)=>a-b)}
function weightedPick(weights){const total=weights.reduce((a,b)=>a+b,0);if(!total)return Math.floor(Math.random()*weights.length);let r=Math.random()*total;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return i}return weights.length-1}
function trisPositionWeights(draw,digits){const vals=allEntriesFor('tris',draw).map(e=>String(e.value).replace(/\D/g,'')).filter(v=>v.length===5);return Array.from({length:digits},(_,pos)=>{const counts=Array(10).fill(1);vals.forEach(v=>counts[Number(v[pos])]++);return counts})}
function numberWeights(gameId,draw,max){const vals=allEntriesFor(gameId,draw).map(e=>String(e.value));const counts=Array(max).fill(1);vals.forEach(v=>v.split(/[ ·,;\s]+/).forEach(token=>{const n=Number(token);if(Number.isInteger(n)&&n>=1&&n<=max)counts[n-1]++}));return counts}
function generateOne(){
 const mode=$('#mode').value,draw=selectedDraw();
 if(active.id==='tris'){const d=mode==='3 cifras'?3:mode==='4 cifras'?4:5;if(mode==='Pares')return String(Math.floor(Math.random()*100)).padStart(2,'0');const weights=trisPositionWeights(draw,d);return Array.from({length:d},(_,i)=>String(weightedPick(weights[i]))).join('')}
 if(active.id==='zodiaco')return mode==='Signo zodiacal'?zodiac[Math.floor(Math.random()*12)]:Array.from({length:4},()=>Math.floor(Math.random()*10)).join('');
 if(active.id==='chispazo'){const weights=numberWeights('chispazo',draw,28),chosen=new Set();while(chosen.size<5){const idx=weightedPick(weights);chosen.add(idx+1)}return [...chosen].sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0')).join(' · ')}
 const weights=numberWeights(active.id,'',56),chosen=new Set();while(chosen.size<6){const idx=weightedPick(weights);chosen.add(idx+1)}return [...chosen].sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0')).join(' · ')
}
$('#generateBtn').onclick=()=>{const n=Math.max(1,Math.min(100,Number($('#amount').value)||10)),draw=selectedDraw(),mode=$('#mode').value,out=Array.from({length:n},generateOne),gameLabel=active.name;const now=new Date().toISOString();out.forEach(value=>tracked.push({id:`${now}-${Math.random().toString(36).slice(2,8)}`,gameId:active.id,gameLabel,draw,mode,value,createdAt:now}));localStorage.setItem(comboKey,JSON.stringify(tracked));$('#generated').innerHTML=out.map((v,i)=>`<div class="combo">${String(i+1).padStart(2,'0')} · ${escapeHtml(v)}</div>`).join('')+'<p class="muted" style="grid-column:1/-1">Combinaciones guardadas automáticamente en Centro de Aciertos para seguimiento. No son predicciones.</p>';renderCombos()};
function matchCombo(combo,result){
 if(combo.gameId==='tris'){
  const digits=combo.mode==='3 cifras'?3:combo.mode==='4 cifras'?4:combo.mode==='Pares'?2:5;
  const a=String(combo.value).replace(/\D/g,'').slice(-digits),b=String(result).replace(/\D/g,'').slice(-digits);
  let positional=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]===b[i])positional++;
  return {exact:a.length===digits&&b.length===digits&&a===b,matches:positional,kind:'posiciones coincidentes'};
 }
 const a=String(combo.value).split(/[ ·,;\s]+/).filter(Boolean),b=String(result).split(/[ ·,;\s]+/).filter(Boolean),matches=a.filter(n=>b.includes(n)).length;
 return {exact:a.length===b.length&&matches===a.length,matches,kind:'números coincidentes'}
}
function updateTrackedHits(){
 for(const c of tracked){
  const createdDate=new Date(c.createdAt),createdDay=Number.isNaN(createdDate.getTime())?'9999-12-31':createdDate.toISOString().slice(0,10),entries=allEntriesFor(c.gameId,c.draw||'').filter(e=>e.date&&dateRank(e.date)>0&&new Date(dateRank(e.date)).toISOString().slice(0,10)>createdDay);
  let best=null;for(const e of entries){const m=matchCombo(c,e.value);const candidate={...m,date:e.date,result:e.value,exact:m.exact};if(!best||(candidate.exact&&!best.exact)||(candidate.exact===best.exact&&candidate.matches>best.matches))best=candidate}
  if(best)c.hit=best;else delete c.hit;
 }
 localStorage.setItem(comboKey,JSON.stringify(tracked));
}
$('#syncTrisBtn')?.addEventListener('click',syncOfficialTris);
$('#importGame').addEventListener('change',()=>{$('#importDrawWrap').hidden=!['tris','chispazo'].includes($('#importGame').value);$('#importDrawLabel').textContent=$('#importGame').value==='chispazo'?'Sorteo Chispazo del archivo':'Sorteo TRIS del archivo';$('#importDraw').innerHTML=($('#importGame').value==='chispazo'?chispazoDraws:trisDraws).map(m=>`<option>${m}</option>`).join('')});
$('#csvFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const rows=parseCSV(await f.text());importRows(rows,f.name,$('#importGame').value,$('#importDraw').value)}catch(err){$('#importStatus').textContent=`No se pudo procesar el CSV: ${err.message}`}e.target.value=''});
$('#clearBtn').onclick=()=>{if(confirm('¿Borrar todos los registros históricos importados guardados en este dispositivo? Las combinaciones guardadas no se borrarán.')){records=[];localStorage.setItem(key,'[]');renderAll();$('#importStatus').textContent='Historial importado borrado.'}};
renderAll();window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}};if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
