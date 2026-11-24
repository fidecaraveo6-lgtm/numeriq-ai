// NUMERIQ AI 1.6 — mantiene los módulos y modos existentes; mejora importación y seguimiento.
const trisDraws=['Mediodía','De las 3','De las 7','Clásico','Extra'];
const games=[
 {id:'tris',name:'TRIS',icon:'▦',desc:'Mediodía · De las 3 · De las 7 · Clásico · Extra',modes:['3 cifras','4 cifras','5 cifras','Pares'],digits:5},
 {id:'chispazo',name:'CHISPAZO',icon:'✧',desc:'Sorteo independiente · 5 números',modes:['5 números'],digits:0},
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
function detectDraw(s){s=norm(s).replace(/[._-]/g,' ');if(/mediodia|medio dia/.test(s))return 'Mediodía';if(/\bextra\b/.test(s))return 'Extra';if(/clasico/.test(s))return 'Clásico';if(/de las?\s*7|delas?\s*7|las siete|de las siete|7\s*(pm|p\.m\.)|19:00/.test(s))return 'De las 7';if(/de las?\s*3|delas?\s*3|las tres|de las tres|3\s*(pm|p\.m\.)|15:00/.test(s))return 'De las 3';return ''}
function detectGame(s){s=norm(s);if(/revanchita/.test(s))return 'revanchita';if(/revancha/.test(s))return 'revancha';if(/melate/.test(s))return 'melate';if(/chispazo/.test(s))return 'chispazo';if(/zodiaco/.test(s))return 'zodiaco';if(/\btris\b|mediodia|clasico|\bextra\b|de las?\s*[37]|las siete|las tres/.test(s))return 'tris';return ''}
function parseCSV(text){text=String(text||'').replace(/^\uFEFF/,'');const sample=text.split(/\r?\n/,1)[0]||'';let sep=',',best=-1;for(const d of [',',';','\t']){let n=0,q=false;for(let i=0;i<sample.length;i++){if(sample[i]==='"')q=!q;else if(sample[i]===d&&!q)n++}if(n>best){best=n;sep=d}}const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=!quoted;else if(ch===sep&&!quoted){row.push(cell.trim());cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}else cell+=ch}row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);return rows}
function extractResult(cell,gameId,header=''){const s=String(cell??'').trim();if(!s)return [];if(gameId==='tris'){const m=s.match(/\b\d{3,5}\b/g);return m||[]}if(gameId==='zodiaco'){const m=s.match(/\b\d{4}\b/g);if(m)return m;const z=zodiac.find(v=>norm(s).includes(norm(v)));return z?[z]:[]}const nums=(s.match(/\d{1,2}/g)||[]).map(Number).filter(n=>n>0);const needed=gameId==='chispazo'?5:6;if(nums.length>=needed)return [nums.slice(0,needed).map(n=>String(n).padStart(2,'0')).join(' · ')];return []}
function addDetected(out,gameId,draw,mode,value,date){if(!gameId||!value)return;if(gameId==='tris'&&!draw)return;out.push({gameId,draw:gameId==='tris'?draw:'',mode:mode||'',value:String(value),date:date||''})}
function importRows(rows,fileName,overrideGame='auto',overrideDraw=''){
 if(rows.length<2)throw Error('El CSV no contiene filas de datos.');
 const headers=rows[0].map(norm),data=rows.slice(1),found=[];
 const fileGame=detectGame(fileName),forcedGame=overrideGame&&overrideGame!=='auto'?overrideGame:fileGame;
 // Formato mixto oficial: JUEGO, SORTEO, CONCURSO, R1...R7, SIGNO, FECHA.
 const gameIndex0=headers.findIndex(h=>h==='juego'||h==='nombre del juego'||h==='producto');
 const drawIndex0=headers.findIndex(h=>h==='sorteo'||h==='modalidad'||h==='turno');
 const rIndexes=[1,2,3,4,5,6,7].map(n=>headers.indexOf('r'+n));
 const hasRColumns=rIndexes.slice(0,5).every(i=>i>=0);
 if(gameIndex0>=0&&drawIndex0>=0&&hasRColumns){
  const signIndex=headers.indexOf('signo');
  for(const row of data){
   const label=String(row[gameIndex0]||'')+' '+String(row[drawIndex0]||'');
   const gameId=detectGame(String(row[gameIndex0]||'')+' '+String(row[drawIndex0]||''));
   if(!gameId)continue;
   const date=dateFromRow(row,headers);
   const vals=rIndexes.map(i=>i>=0?String(row[i]??'').trim():'').filter(v=>v!=='');
   if(gameId==='tris'){
    const digits=vals.slice(0,5).map(v=>v.replace(/\\D/g,'')).join('');
    if(/^\\d{5}$/.test(digits))addDetected(found,'tris',detectDraw(label),'',digits,date);
   }else if(gameId==='chispazo'){
    const nums=vals.slice(0,5).map(v=>Number(v)).filter(n=>Number.isInteger(n)&&n>=1&&n<=28);
    if(nums.length===5)addDetected(found,'chispazo','','',nums.map(n=>String(n).padStart(2,'0')).join(' · '),date);
   }else if(gameId==='melate'||gameId==='revancha'||gameId==='revanchita'){
    const nums=vals.slice(0,6).map(v=>Number(v)).filter(n=>Number.isInteger(n)&&n>=1);
    if(nums.length===6)addDetected(found,gameId,'','',nums.map(n=>String(n).padStart(2,'0')).join(' · '),date);
   }else if(gameId==='zodiaco'){
    const digits=vals.slice(0,4).map(v=>v.replace(/\\D/g,'')).join('');
    if(/^\\d{4}$/.test(digits))addDetected(found,'zodiaco','',signIndex>=0?String(row[signIndex]||''):'',digits,date);
   }
  }
 }
 const gameCols=headers.map((h,i)=>({h,i,gameId:detectGame(h),draw:detectDraw(h)})).filter(x=>x.gameId);
 const wideCols=gameCols.filter(x=>x.gameId!=='tris'||x.draw);
 if(!forcedGame&&wideCols.length){
  for(const row of data){const date=dateFromRow(row,headers);for(const col of wideCols){const vals=extractResult(row[col.i],col.gameId,col.h);vals.forEach(v=>addDetected(found,col.gameId,col.draw,'',v,date))}}
 }
 // CSV individual o formato vertical: juego explícito en selector/nombre de archivo o en una columna.
 if(!found.length){
  const gameIndex=headers.findIndex(h=>/(^|\b)(juego|nombre del juego|producto|loteria)(\b|$)/.test(h));
  const drawIndex=headers.findIndex(h=>/(sorteo|modalidad|turno)/.test(h));
  const resultIndexes=headers.map((h,i)=>({h,i})).filter(x=>!/(fecha|date|juego|producto|loteria|sorteo|modalidad|turno|concurso|folio|numero de sorteo)/.test(x.h)&&/(resultado|numeros?|combinacion|ganador|bolas?|numero\s*[1-6]|bola\s*[1-6])/.test(x.h));
  for(const row of data){
   const combined=row.join(' ');const gameId=forcedGame||(gameIndex>=0?detectGame(row[gameIndex]):'')||detectGame(combined);if(!gameId)continue;
   const draw=(gameId==='tris'?(overrideDraw||((drawIndex>=0?detectDraw(row[drawIndex]):'')||detectDraw(combined))):'');if(gameId==='tris'&&!draw)continue;
   const date=dateFromRow(row,headers);let vals=[];
   if(resultIndexes.length){
    const cells=resultIndexes.map(c=>String(row[c.i]??'').trim()).filter(Boolean);
    // Los CSV oficiales suelen traer una columna por bola; se agrupan en una combinación por fila.
    const need=gameId==='tris'?1:(gameId==='chispazo'?5:gameId==='zodiaco'?1:6);
    if(gameId!=='tris'&&gameId!=='zodiaco'&&cells.length>=need){const nums=cells.flatMap(v=>(v.match(/\d{1,2}/g)||[])).map(Number).filter(n=>n>0);if(nums.length>=need)vals.push(nums.slice(0,need).map(n=>String(n).padStart(2,'0')).join(' · '));}
    else for(const c of resultIndexes)vals.push(...extractResult(row[c.i],gameId,c.h));
   }else{
    const ignored=/(fecha|date|juego|producto|loteria|sorteo|modalidad|turno|concurso|folio|numero de sorteo)/;
    const cells=row.filter((v,i)=>!ignored.test(headers[i]||'')&&String(v??'').trim()!=='');
    if(gameId!=='tris'&&gameId!=='zodiaco'){const need=gameId==='chispazo'?5:6;const nums=cells.flatMap(v=>(String(v).match(/\d{1,2}/g)||[])).map(Number).filter(n=>n>0);if(nums.length>=need)vals.push(nums.slice(-need).map(n=>String(n).padStart(2,'0')).join(' · '));}
    else cells.forEach(v=>vals.push(...extractResult(v,gameId,'')));
   }
   vals.forEach(v=>addDetected(found,gameId,draw,'',v,date));
  }
 }
 if(!found.length)throw Error('No reconocí resultados. Selecciona el juego en “Tipo de archivo”; si es TRIS, indica también el sorteo. Revisa que el CSV tenga una columna de resultado o una columna por número. No se modificaron tus datos.');
 const grouped=new Map(),seen=new Set();
 for(const r of found){const unique=[r.gameId,r.draw,r.mode,r.date,r.value].join('|');if(seen.has(unique))continue;seen.add(unique);const k=[r.gameId,r.draw,r.mode].join('|');if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r)}
 let importedCount=0,duplicateCount=0;
 for(const [k,items] of grouped){
  const [gameId,draw,mode]=k.split('|'),g=games.find(x=>x.id===gameId);
  const existing=new Set(records.filter(r=>r.gameId===gameId&&(gameId!=='tris'||r.draw===draw)&&(r.mode||'')===mode).flatMap(r=>Array.isArray(r.entries)?r.entries:(r.values||[]).map(value=>({value,date:r.date||''}))).map(e=>[String(e.value),String(e.date||'')].join('|')));
  const fresh=items.filter(x=>{const key=[String(x.value),String(x.date||'')].join('|');if(existing.has(key)){duplicateCount++;return false}existing.add(key);return true});
  if(!fresh.length)continue;
  const entries=fresh.map(x=>({value:x.value,date:x.date,importedAt:new Date().toISOString()}));importedCount+=entries.length;
  records.push({gameId,draw,mode,values:entries.map(x=>x.value),entries,name:g?.name||gameId,gameLabel:gameId==='tris'?`TRIS · ${draw}`:g?.name||gameId,count:entries.length,file:fileName,date:fresh.map(x=>x.date).filter(Boolean).at(-1)||new Date().toLocaleDateString('es-MX')});
 }
 updateTrackedHits();persist();renderAll();$('#importStatus').textContent=`Listo: ${importedCount} resultados nuevos en ${grouped.size} grupos. ${duplicateCount?`${duplicateCount} duplicados omitidos.`:''}`;
}
function allEntriesFor(gameId,draw=''){return records.filter(r=>r.gameId===gameId&&(gameId!=='tris'||r.draw===draw)).flatMap(r=>Array.isArray(r.entries)?r.entries:(r.values||[]).map(value=>({value,date:r.date||''}))).filter(e=>e&&e.value!==undefined)}
async function syncOfficialTris(){const btn=$('#syncTrisBtn'),status=$('#syncStatus');if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent='Consultando Lotería Nacional…';status.textContent='Conectando con la fuente oficial y revisando los últimos sorteos…';try{const response=await fetch('/.netlify/functions/tris-results',{headers:{Accept:'application/json'},cache:'no-store'});if(!response.ok)throw new Error(`El servicio respondió ${response.status}.`);const payload=await response.json();if(!payload.ok||!Array.isArray(payload.results)||!payload.results.length)throw new Error(payload.error||'La fuente oficial no devolvió resultados reconocibles.');let added=0,duplicates=0;const groups=new Map();for(const item of payload.results){if(!/^\d{5}$/.test(String(item.value||''))||!item.draw||!item.drawNo)continue;const exists=allEntriesFor('tris',item.draw).some(e=>(e.sourceId&&e.sourceId===String(item.drawNo))||(String(e.drawNo||'')===String(item.drawNo))||(!e.drawNo&&String(e.date||'')===String(item.date||'')&&String(e.value)===String(item.value)));if(exists){duplicates++;continue}if(!groups.has(item.draw))groups.set(item.draw,[]);groups.get(item.draw).push({value:String(item.value),date:item.date||'',drawNo:String(item.drawNo),sourceId:String(item.drawNo),multiplier:item.multiplier||'',importedAt:new Date().toISOString()});added++}for(const [draw,entries] of groups){records.push({gameId:'tris',draw,mode:'',values:entries.map(e=>e.value),entries,name:'TRIS',gameLabel:`TRIS · ${draw}`,count:entries.length,file:'Actualización oficial Lotería Nacional',date:entries.map(e=>e.date).filter(Boolean).sort((a,b)=>dateRank(a)-dateRank(b)).at(-1)||new Date().toLocaleDateString('es-MX')})}if(added){updateTrackedHits();persist()}else renderAll();const when=payload.updatedAt?new Date(payload.updatedAt).toLocaleString('es-MX'):'ahora';status.textContent=`Actualización terminada: ${added} resultados nuevos agregados; ${duplicates} ya estaban guardados. Fuente oficial consultada ${when}.`;status.dataset.state='success'}catch(err){status.textContent=`No se pudo actualizar automáticamente: ${err.message} Puedes intentarlo más tarde; tus datos guardados no se modificaron.`;status.dataset.state='error'}finally{btn.disabled=false;btn.textContent='↻ Actualizar resultados TRIS'}}
function renderLatestResults(){const targets=[];games.forEach(g=>{if(g.id==='tris')trisDraws.forEach(draw=>targets.push({id:g.id,draw,label:`TRIS · ${draw}`}));else targets.push({id:g.id,draw:'',label:g.name})});$('#latestResults').innerHTML=targets.map(t=>{const entries=allEntriesFor(t.id,t.draw).slice().sort((a,b)=>dateRank(a.date)-dateRank(b.date));const last=entries.at(-1);return `<article class="latest-card"><h3>${escapeHtml(t.label)}</h3><div class="latest-value">${last?escapeHtml(last.value):'—'}</div><div class="latest-meta">${last?`Último resultado disponible · ${escapeHtml(last.date||'fecha no disponible')}`:'Sin resultados guardados'}</div></article>`}).join('')}
function renderHistory(){const total=records.reduce((a,r)=>a+(r.values?.length||Number(r.count)||0),0);$('#drawCount').textContent=total;$('#history').innerHTML=records.length?records.slice(-12).reverse().map(r=>`<div class="history-row"><b>${escapeHtml(r.gameLabel||r.name||'Sorteo')}</b> · ${r.values?.length||r.count||0} resultados <small>${escapeHtml(r.date||'')} · ${escapeHtml(r.file||'CSV')}</small></div>`).join(''):'Tus resultados importados aparecerán aquí.'}
function renderCombos(){const box=$('#trackedCombos');if(!box)return;if(!tracked.length){box.innerHTML='<p class="muted">Las combinaciones que generes aparecerán aquí para darles seguimiento.</p>';return}box.innerHTML=tracked.slice(-30).reverse().map(c=>{const hit=c.hit||null;return `<article class="track-row"><div><b>${escapeHtml(c.gameLabel)}${c.draw?` · ${escapeHtml(c.draw)}`:''}</b><div class="track-value">${escapeHtml(c.value)}</div><small>${new Date(c.createdAt).toLocaleString('es-MX')}</small></div><div class="track-status">${hit?`<b>${hit.exact?'Coincidencia exacta':'Revisión'}</b><small>${hit.matches} coincidencias · ${escapeHtml(hit.date||'')}</small>`:'<small>En seguimiento</small>'}</div></article>`}).join('')}
function renderAll(){renderHistory();renderLatestResults();renderCombos();if(active)updateStatsPanel()}
$('#games').innerHTML=games.map(g=>`<article class="game-card" data-id="${g.id}"><span class="arrow">↗</span><div class="game-icon">${g.icon}</div><h3>${g.name}</h3><p>${g.desc}</p></article>`).join('');document.querySelectorAll('.game-card').forEach(c=>c.addEventListener('click',()=>openGame(c.dataset.id)));
function openGame(id){active=games.find(g=>g.id===id);$('#modalKicker').textContent='MÓDULO DE ANÁLISIS';$('#modalTitle').textContent=active.name;$('#modalDesc').textContent=active.id==='tris'?'Elige cualquiera de los cinco sorteos. Cada historial y estadística se calcula por separado.':active.desc;$('#trisDrawWrap').hidden=active.id!=='tris';$('#trisDraw').innerHTML=trisDraws.map(m=>`<option>${m}</option>`).join('');$('#mode').innerHTML=active.modes.map(m=>`<option>${m}</option>`).join('');$('#generated').innerHTML='';$('#modal').hidden=false;showTab('generator');updateStatsPanel()}
function showTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('#generatorPane').hidden=tab!=='generator';$('#statsPane').hidden=tab!=='stats'}
function updateStatsPanel(){if(!active)return;const draw=$('#trisDraw').value||'Mediodía',vals=allEntriesFor(active.id,draw).map(e=>e.value);const freq={};if(active.id==='tris'||active.id==='zodiaco'){for(let i=0;i<=9;i++)freq[String(i)]=0}else{const max=active.id==='chispazo'?28:56;for(let i=1;i<=max;i++)freq[String(i)]=0}vals.forEach(v=>{if(active.id==='tris'||active.id==='zodiaco'){String(v).replace(/\D/g,'').split('').forEach(d=>freq[d]=(freq[d]||0)+1)}else String(v).split(/[ ·,;\s]+/).forEach(n=>{if(/^\d+$/.test(n)){const k=String(Number(n));if(k in freq)freq[k]++}})});const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]));const hot=sorted.slice(0,5),cold=sorted.slice(-5).reverse();const label=active.id==='tris'?`TRIS · ${draw}`:active.name;$('#statsContent').innerHTML=`<p><strong>${vals.length}</strong> resultados analizados en ${escapeHtml(label)}.</p><div class="freq-grid"><div class="freq-card"><h3>🔥 Números calientes</h3><p class="muted">Los cinco dígitos/números más frecuentes del historial importado</p><div class="freq-list">${hot.map(([n,c])=>`<span class="freq-chip hot"><b>${escapeHtml(n)}</b><small>${c} veces</small></span>`).join('')}</div></div><div class="freq-card"><h3>❄️ Números fríos</h3><p class="muted">Los cinco menos frecuentes; incluye valores con cero apariciones</p><div class="freq-list">${cold.map(([n,c])=>`<span class="freq-chip cold"><b>${escapeHtml(n)}</b><small>${c} veces</small></span>`).join('')}</div></div></div><p class="muted">${vals.length?'Las frecuencias se calculan solo con el historial importado.':'Aún no hay resultados importados para este juego/sorteo; se muestran frecuencias en cero.'} Son estadísticas descriptivas, no predicciones ni garantía de premios.</p>`}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{showTab(b.dataset.tab);if(b.dataset.tab==='stats')updateStatsPanel()}));$('#trisDraw').addEventListener('change',updateStatsPanel);$('#mode').addEventListener('change',updateStatsPanel);$('#closeModal').onclick=()=>$('#modal').hidden=true;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').hidden=true});
function randUnique(max,n){const s=new Set();while(s.size<n)s.add(1+Math.floor(Math.random()*max));return [...s].sort((a,b)=>a-b)}
function generateOne(){const mode=$('#mode').value;if(active.id==='tris'){const d=mode==='3 cifras'?3:mode==='4 cifras'?4:5;return mode==='Pares'?String(Math.floor(Math.random()*100)).padStart(2,'0'):Array.from({length:d},()=>Math.floor(Math.random()*10)).join('')}if(active.id==='zodiaco')return mode==='Signo zodiacal'?zodiac[Math.floor(Math.random()*12)]:Array.from({length:4},()=>Math.floor(Math.random()*10)).join('');if(active.id==='chispazo')return randUnique(28,5).map(n=>String(n).padStart(2,'0')).join(' · ');return randUnique(56,6).map(n=>String(n).padStart(2,'0')).join(' · ')}
$('#generateBtn').onclick=()=>{const n=Math.max(1,Math.min(100,Number($('#amount').value)||10)),draw=active.id==='tris'?$('#trisDraw').value:'',mode=$('#mode').value,out=Array.from({length:n},generateOne),gameLabel=active.name;const now=new Date().toISOString();out.forEach(value=>tracked.push({id:`${now}-${Math.random().toString(36).slice(2,8)}`,gameId:active.id,gameLabel,draw,mode,value,createdAt:now}));localStorage.setItem(comboKey,JSON.stringify(tracked));$('#generated').innerHTML=out.map((v,i)=>`<div class="combo">${String(i+1).padStart(2,'0')} · ${escapeHtml(v)}</div>`).join('')+'<p class="muted" style="grid-column:1/-1">Combinaciones guardadas automáticamente en Centro de Aciertos para seguimiento. No son predicciones.</p>';renderCombos()};
function matchCombo(combo,result){if(combo.gameId==='tris'){const a=String(combo.value),b=String(result);let positional=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]===b[i])positional++;return {exact:a===b,matches:positional,kind:'dígitos en la misma posición'}}const a=String(combo.value).split(/[ ·,;\s]+/).filter(Boolean),b=String(result).split(/[ ·,;\s]+/).filter(Boolean),matches=a.filter(n=>b.includes(n)).length;return {exact:a.length===b.length&&matches===a.length,matches,kind:'números coincidentes'}}
function updateTrackedHits(){for(const c of tracked){const entries=allEntriesFor(c.gameId,c.draw||'').filter(e=>e.date&&dateRank(e.date)>dateRank(c.createdAt));let best=null;for(const e of entries){const m=matchCombo(c,e.value);if(!best||(m.exact&&!best.exact)||(m.exact===best.exact&&m.matches>best.matches))best={...m,date:e.date,result:e.value}}if(best)c.hit=best;else delete c.hit}localStorage.setItem(comboKey,JSON.stringify(tracked))}
$('#syncTrisBtn')?.addEventListener('click',syncOfficialTris);
$('#importGame').addEventListener('change',()=>{$('#importDrawWrap').hidden=$('#importGame').value!=='tris'});
$('#csvFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const rows=parseCSV(await f.text());importRows(rows,f.name,$('#importGame').value,$('#importDraw').value)}catch(err){$('#importStatus').textContent=`No se pudo procesar el CSV: ${err.message}`}e.target.value=''});
$('#clearBtn').onclick=()=>{if(confirm('¿Borrar todos los registros históricos importados guardados en este dispositivo? Las combinaciones guardadas no se borrarán.')){records=[];localStorage.setItem(key,'[]');renderAll();$('#importStatus').textContent='Historial importado borrado.'}};
renderAll();window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}};if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
