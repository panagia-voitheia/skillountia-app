const API_URL='https://script.google.com/macros/s/AKfycbxwd0Y_ZOVS0vjDQh3g67_zYw5MCYV8DkPg-coNoxTVWehFGFVJG5ZHbSqMvAu_QNJ4ug/exec';
const TYPES=['visits','damages','supplies','news','phones'];
const SYNC_VERSION='skillountia_v2_2026_07_02';
const SYNC_INTERVAL_MS=20000;

let data=loadLocal();
let currentMonth=new Date();
let isSyncing=false;
let firstCloudLoadDone=false;

function loadLocal(){try{return JSON.parse(localStorage.getItem('skillountiaData')||'{}')}catch(e){return {}}}
function saveLocalOnly(){localStorage.setItem('skillountiaData',JSON.stringify(data))}
function save(){saveLocalOnly();render();updateBadges()}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function todayText(){return new Date().toLocaleString('el-GR')}
function toast(msg){const t=document.getElementById('toast');if(!t){alert(msg);return}t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',3200)}
function val(id){return (document.getElementById(id)?.value||'').trim()}
function clearIds(...ids){ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''})}

function home(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('home').style.display='block';const nav=document.getElementById('nav');if(nav)nav.style.display='none';render();updateBadges()}
function go(id){document.getElementById('home').style.display='none';document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const screen=document.getElementById(id);if(screen)screen.classList.add('active');const nav=document.getElementById('nav');if(nav)nav.style.display='grid';markSeen(id);render()}
function markSeen(id){const key={visit:'visits',damage:'damages',supplies:'supplies',news:'news'}[id];if(key){localStorage.setItem('seen_'+key,String(latestTimeForType(key)));updateBadges()}}

async function addVisit(){
  await loadCloud(false);
  const item={id:uid(),name:val('v_name'),from:dateOnly(val('v_from')),to:dateOnly(val('v_to')),status:val('v_status'),notes:val('v_notes'),created:todayText()};
  if(!item.name||!item.from){toast('Συμπληρώστε όνομα και ημερομηνία.');return}
  if(!item.to)item.to=item.from;
  if(hasConflict(item)){toast('Οι ημερομηνίες είναι ήδη δεσμευμένες.');return}
  data.visits=data.visits||[];data.visits.push(item);clearIds('v_name','v_notes');save();
  await syncAdd('visits',item);
  toast('Αποθηκεύτηκε επίσκεψη.');
  setTimeout(()=>loadCloud(false),1000);
}

function addItem(type){
  const p={damages:'d',supplies:'s',news:'n',phones:'p'}[type];
  const item={id:uid(),title:val(p+'_title'),text:val(p+'_text'),created:todayText()};
  if(!item.title){toast('Συμπληρώστε τίτλο.');return}
  data[type]=data[type]||[];data[type].push(item);clearIds(p+'_title',p+'_text');save();
  syncAdd(type,item);
  toast('Αποθηκεύτηκε.');
  setTimeout(()=>loadCloud(false),1000);
}

function hasConflict(item){
  const from=dateOnly(item.from),to=dateOnly(item.to)||from;
  if(isCheckStatus(item.status))return false;
  return (data.visits||[]).filter(isRealVisit).some(v=>{
    if(v.id===item.id)return false;
    if(isCheckStatus(v.status))return false;
    const vf=dateOnly(v.from),vt=dateOnly(v.to)||vf;
    return vf&&from<=vt&&to>=vf;
  });
}

function rowToItem(type,row){
  if(!row)return null;
  const title=row['Τίτλος']||row.title||row['Όνομα / Υπηρεσία']||row['Προμήθεια']||row['Ανακοίνωση']||row['Όνομα']||row['Ποιος θα πάει']||'';
  if(type==='visits'){
    const item={id:String(row.id||'').trim(),name:row['Ποιος θα πάει']||row['Όνομα']||row.name||'',from:dateOnly(row['Από']||row.from||''),to:dateOnly(row['Έως']||row.to||''),status:row['Κατάσταση']||row.status||'',notes:row['Παρατηρήσεις']||row['Σχόλιο']||row.notes||'',created:row['Ημερομηνία καταχώρησης']||row['Ημερομηνία']||row.created||row.Created||''};
    if(!item.id)item.id=makeStableId(type,item);
    return item;
  }
  const item={id:String(row.id||'').trim(),title:title,text:row['Περιγραφή']||row['Πληροφορίες']||row['Μήνυμα']||row['Τηλέφωνο / σημείωση']||row['Τηλέφωνο']||row.text||'',created:row['Ημερομηνία καταχώρησης']||row['Ημερομηνία']||row.created||row.Created||''};
  if(!item.id)item.id=makeStableId(type,item);
  return item;
}

function makeStableId(type,obj){try{return type+'_'+btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}catch(e){return type+'_'+uid()}}

function toSheetRow(type,item){
  if(type==='visits')return {id:item.id,'Όνομα':item.name,'Ποιος θα πάει':item.name,'Από':item.from,'Έως':item.to,'Κατάσταση':item.status,'Σχόλιο':item.notes,'Παρατηρήσεις':item.notes,'Ημερομηνία':item.created,'Ημερομηνία καταχώρησης':item.created};
  const labels={damages:['Τίτλος','Περιγραφή'],supplies:['Τίτλος','Πληροφορίες'],news:['Τίτλος','Μήνυμα'],phones:['Όνομα / Υπηρεσία','Τηλέφωνο / σημείωση']}[type];
  return {id:item.id,[labels[0]]:item.title,[labels[1]]:item.text,'Ημερομηνία':item.created,'Ημερομηνία καταχώρησης':item.created}
}

async function readTable(type){
  const url=API_URL+'?action=read&table='+encodeURIComponent(type)+'&t='+Date.now();
  const res=await fetch(url);const json=await res.json();
  if(!json.success)throw new Error(json.message||'Σφάλμα ανάγνωσης');
  return (json.data||[]).map(r=>rowToItem(type,r)).filter(x=>type==='visits'?isRealVisit(x):isRealItem(x))
}

async function loadCloud(showMsg=false){
  if(isSyncing)return;
  isSyncing=true;
  try{
    const results=await Promise.all(TYPES.map(readTable));
    TYPES.forEach((type,i)=>data[type]=dedupeItems(results[i]||[]));
    saveLocalOnly();render();
    if(!firstCloudLoadDone){firstCloudLoadDone=true;markExistingAsSeenOnce()}
    updateBadges();
    if(showMsg)toast('Έγινε ανανέωση από το κοινό αρχείο.');
  }catch(e){console.warn(e);if(showMsg)toast('Δεν έγινε ανάγνωση από το κοινό αρχείο.')}
  finally{isSyncing=false}
}

function dedupeItems(items){const seen=new Set(),out=[];items.forEach(item=>{const key=item.id||JSON.stringify(item);if(seen.has(key))return;seen.add(key);out.push(item)});return out}

async function syncAdd(type,item){try{await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'add',table:type,row:toSheetRow(type,item)})})}catch(e){console.warn(e)}}

async function deleteItem(type,id){
  if(!confirm('Να διαγραφεί αυτή η καταχώρηση;'))return;
  const item=(data[type]||[]).find(x=>x.id===id);
  data[type]=(data[type]||[]).filter(x=>x.id!==id);save();
  try{await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'delete',table:type,id:id,...(item||{})})});toast('Διαγράφηκε.');setTimeout(()=>loadCloud(false),1000)}
  catch(e){console.warn(e);toast('Διαγράφηκε τοπικά. Ελέγξτε αργότερα το κοινό αρχείο.')}
}

function render(){renderLists();renderCalendar()}

function itemHtml(x,type){
  if(type==='visits')return `<div class="item"><b>${esc(x.name)}</b><div>${showDate(x.from)}${x.to?' έως '+showDate(x.to):''}</div><div class="meta">${esc(labelStatus(x.status))}${x.notes?' – '+esc(x.notes):''}</div><button class="deleteBtn" onclick="deleteItem('${type}','${escAttr(x.id)}')">Διαγραφή</button></div>`;
  return `<div class="item"><b>${esc(x.title)}</b><div>${esc(x.text||'')}</div><div class="meta">${esc(showDateTime(x.created))}</div><button class="deleteBtn" onclick="deleteItem('${type}','${escAttr(x.id)}')">Διαγραφή</button></div>`
}

function renderLists(){
  TYPES.forEach(type=>{
    const ids={visits:['visitsList','visitList'],damages:['damagesList'],supplies:['suppliesList'],news:['newsList'],phones:['phonesList']}[type];
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      const items=(data[type]||[]).filter(x=>type==='visits'?isRealVisit(x):isRealItem(x)).slice().sort((a,b)=>sortTime(b)-sortTime(a));
      el.innerHTML=items.map(x=>itemHtml(x,type)).join('')||'<div class="small">Δεν υπάρχει ακόμη καταχώρηση.</div>';
    })
  })
}

function isRealVisit(x){return Boolean(x&&String(x.name||'').trim()&&dateOnly(x.from))}
function isRealItem(x){return Boolean(x&&(String(x.title||'').trim()||String(x.text||'').trim()))}

function dateOnly(x){
  if(!x)return '';
  if(Object.prototype.toString.call(x)==='[object Date]'&&!isNaN(x))return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  const s=String(x).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
  const gr=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(gr)return `${gr[3]}-${gr[2].padStart(2,'0')}-${gr[1].padStart(2,'0')}`;
  const d=new Date(s);
  if(!isNaN(d))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return '';
}

function showDate(x){const d=dateOnly(x);if(!d)return '';const p=d.split('-');return `${p[2]}/${p[1]}/${p[0]}`}
function showDateTime(x){if(!x)return '';const d=dateOnly(x);return d?showDate(d):String(x)}
function sortTime(x){const d=dateOnly(x?.created||x?.from||'');return d?Date.parse(d):0}
function isCheckStatus(status){const s=String(status||'').toLowerCase();return s==='check'||s.includes('πέρασμα')||s.includes('έλεγχος')}
function labelStatus(status){return isCheckStatus(status)?'Πέρασμα / έλεγχος χωρίς διανυκτέρευση':'Κατειλημμένο / διανυκτέρευση'}

function renderCalendar(){
  const title=document.getElementById('monthTitle'),grid=document.getElementById('calendarGrid');
  if(!title||!grid)return;
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
  title.textContent=currentMonth.toLocaleDateString('el-GR',{month:'long',year:'numeric'});
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate();
  let html=['Δ','Τ','Τ','Π','Π','Σ','Κ'].map(d=>`<div class="dow">${d}</div>`).join('');
  const offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++)html+='<div class="day empty"></div>';
  for(let d=1;d<=days;d++){
    const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let cls='',who='';
    (data.visits||[]).filter(isRealVisit).forEach(v=>{const from=dateOnly(v.from),to=dateOnly(v.to)||from;if(from&&from<=date&&to>=date){cls=isCheckStatus(v.status)?'green':'red';who=v.name||''}});
    html+=`<div class="day ${cls}" title="${escAttr(who)}">${d}</div>`;
  }
  grid.innerHTML=html;
}

function moveMonth(n){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+n,1);renderCalendar()}

function latestTimeForType(type){
  return Math.max(0,...(data[type]||[]).filter(x=>type==='visits'?isRealVisit(x):isRealItem(x)).map(x=>Date.parse(dateOnly(x.created||x.from||''))||0));
}
function markExistingAsSeenOnce(){
  if(localStorage.getItem(SYNC_VERSION)==='yes')return;
  TYPES.forEach(type=>localStorage.setItem('seen_'+type,String(latestTimeForType(type))));
  localStorage.setItem(SYNC_VERSION,'yes');
}
function updateBadges(){
  const map={visits:['navVisit','homeVisitBadge'],damages:['navDamage','homeDamageBadge'],supplies:['navSupplies','homeSuppliesBadge'],news:['navNews','homeNewsBadge']};
  Object.keys(map).forEach(type=>{
    const latest=latestTimeForType(type),seen=Number(localStorage.getItem('seen_'+type)||0),has=latest>seen&&latest>0;
    const nav=document.getElementById(map[type][0]),badge=document.getElementById(map[type][1]);
    if(nav)nav.classList.toggle('hasNew',has);
    if(badge)badge.style.display=has?'inline-block':'none';
  })
}

function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function escAttr(s){return esc(s).replace(/`/g,'')}
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}
home();loadCloud(false);setTimeout(()=>loadCloud(false),1500);setInterval(()=>loadCloud(false),SYNC_INTERVAL_MS);
