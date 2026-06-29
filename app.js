const API_URL='https://script.google.com/macros/s/AKfycbxwd0Y_ZOVS0vjDQh3g67_zYw5MCYV8DkPg-coNoxTVWehFGFVJG5ZHbSqMvAu_QNJ4ug/exec';
const TYPES=['visits','damages','supplies','news','phones'];
let data=loadLocal();let currentMonth=new Date();

function loadLocal(){try{return JSON.parse(localStorage.getItem('skillountiaData')||'{}')}catch(e){return {}}}
function save(){localStorage.setItem('skillountiaData',JSON.stringify(data));render();updateBadges()}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function todayText(){return new Date().toLocaleString('el-GR')}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2800)}
function val(id){return (document.getElementById(id)?.value||'').trim()}
function clearIds(...ids){ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''})}
function home(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('home').style.display='block';document.getElementById('nav').style.display='none';render();updateBadges()}
function go(id){document.getElementById('home').style.display='none';document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');document.getElementById('nav').style.display='grid';markSeen(id);render()}
function markSeen(id){const key={visit:'visits',damage:'damages',supplies:'supplies',news:'news'}[id];if(key){localStorage.setItem('seen_'+key,String(Date.now()));updateBadges()}}

function addVisit(){
  const item={id:uid(),name:val('v_name'),from:val('v_from'),to:val('v_to'),status:val('v_status'),notes:val('v_notes'),created:todayText()};
  if(!item.name||!item.from){toast('Συμπληρώστε όνομα και ημερομηνία.');return}
  data.visits=data.visits||[];data.visits.push(item);clearIds('v_name','v_notes');save();sync('visits',item);toast('Αποθηκεύτηκε επίσκεψη.')
}
function addItem(type){
  const p={damages:'d',supplies:'s',news:'n',phones:'p'}[type];
  const item={id:uid(),title:val(p+'_title'),text:val(p+'_text'),created:todayText()};
  if(!item.title){toast('Συμπληρώστε τίτλο.');return}
  data[type]=data[type]||[];data[type].push(item);clearIds(p+'_title',p+'_text');save();sync(type,item);toast('Αποθηκεύτηκε.')
}

function rowToItem(type,row){
  if(!row)return null;
  const title=row['Τίτλος']||row.title||row['Όνομα']||row['Όνομα / Υπηρεσία']||row['Ποιος θα πάει']||row['Ποιος θα πάει;']||'';
  if(type==='visits')return {id:row.id||uid(),name:row['Ποιος θα πάει']||row['Όνομα']||row.name||title,from:row['Από']||row.from||'',to:row['Έως']||row.to||'',status:row['Κατάσταση']||row.status||'',notes:row['Παρατηρήσεις']||row.notes||'',created:row['Ημερομηνία καταχώρησης']||row.created||row.Created||''};
  return {id:row.id||uid(),title:title,text:row['Περιγραφή']||row['Πληροφορίες']||row['Μήνυμα']||row['Τηλέφωνο / σημείωση']||row.text||'',created:row['Ημερομηνία καταχώρησης']||row.created||row.Created||''}
}
function toSheetRow(type,item){
  if(type==='visits')return {'Ποιος θα πάει':item.name,'Από':item.from,'Έως':item.to,'Κατάσταση':item.status,'Παρατηρήσεις':item.notes,'Ημερομηνία καταχώρησης':item.created};
  const labels={damages:['Τίτλος','Περιγραφή'],supplies:['Τίτλος','Πληροφορίες'],news:['Τίτλος','Μήνυμα'],phones:['Όνομα / Υπηρεσία','Τηλέφωνο / σημείωση']}[type];
  return {[labels[0]]:item.title,[labels[1]]:item.text,'Ημερομηνία καταχώρησης':item.created}
}
async function readTable(type){
  const url=API_URL+'?action=read&table='+encodeURIComponent(type)+'&t='+Date.now();
  const res=await fetch(url); const json=await res.json();
  if(!json.success)throw new Error(json.message||'Σφάλμα ανάγνωσης');
  return (json.data||[]).map(r=>rowToItem(type,r)).filter(Boolean)
}
async function loadCloud(showMsg=false){
  try{const results=await Promise.all(TYPES.map(readTable));TYPES.forEach((t,i)=>data[t]=results[i]);save();if(showMsg)toast('Έγινε ανανέωση από το κοινό αρχείο.')}
  catch(e){console.warn(e);if(showMsg)toast('Δεν έγινε ανάγνωση από το κοινό αρχείο.')}
}
async function sync(type,item){
  const row=toSheetRow(type,item);
  try{await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({table:type,row:row})})}
  catch(e){console.warn(e)}
}

function render(){renderLists();renderCalendar()}
function itemHtml(x,type){if(type==='visits')return `<div class="item"><b>${esc(x.name)}</b><div>${esc(x.from)}${x.to?' έως '+esc(x.to):''}</div><div class="meta">${esc(x.status||'')}${x.notes?' – '+esc(x.notes):''}</div></div>`;return `<div class="item"><b>${esc(x.title)}</b><div>${esc(x.text||'')}</div><div class="meta">${esc(x.created||'')}</div></div>`}
function renderLists(){TYPES.forEach(type=>{const ids={visits:['visitsList','visitList'],damages:['damagesList'],supplies:['suppliesList'],news:['newsList'],phones:['phonesList']}[type];ids.forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=((data[type]||[]).slice().reverse().map(x=>itemHtml(x,type)).join(''))||'<div class="small">Δεν υπάρχει ακόμη καταχώρηση.</div>'})})}
function renderCalendar(){const title=document.getElementById('monthTitle'),grid=document.getElementById('calendarGrid');if(!title||!grid)return;const y=currentMonth.getFullYear(),m=currentMonth.getMonth();title.textContent=currentMonth.toLocaleDateString('el-GR',{month:'long',year:'numeric'});const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate();let html=['Δ','Τ','Τ','Π','Π','Σ','Κ'].map(d=>`<div class="dow">${d}</div>`).join('');let offset=(first.getDay()+6)%7;for(let i=0;i<offset;i++)html+='<div></div>';for(let d=1;d<=days;d++){const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;let cls='';(data.visits||[]).forEach(v=>{if(v.from<=date&&(!v.to||v.to>=date))cls=(v.status==='check'||v.status==='Πέρασμα / έλεγχος χωρίς διανυκτέρευση')?'green':'red'});html+=`<div class="day ${cls}">${d}</div>`}grid.innerHTML=html}
function moveMonth(n){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+n,1);renderCalendar()}
function updateBadges(){const map={visits:['navVisit','homeVisitBadge'],damages:['navDamage','homeDamageBadge'],supplies:['navSupplies','homeSuppliesBadge'],news:['navNews','homeNewsBadge']};Object.keys(map).forEach(type=>{const latest=Math.max(0,...(data[type]||[]).map(x=>Date.parse(x.created)||0));const seen=Number(localStorage.getItem('seen_'+type)||0);const has=latest>seen&&latest>0;const nav=document.getElementById(map[type][0]);const badge=document.getElementById(map[type][1]);if(nav)nav.classList.toggle('hasNew',has);if(badge)badge.style.display=has?'inline-block':'none'})}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}
home();loadCloud(false);
