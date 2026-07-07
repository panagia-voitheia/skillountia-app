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
    const visits=visitsForDate(date);
    let cls='';
    if(visits.some(v=>!isCheckStatus(v.status))) cls='red';
    else if(visits.some(v=>isCheckStatus(v.status))) cls='green';

    html+=`<div class="day ${cls}" onclick="showDayDetails('${date}')">${d}</div>`;
  }
  grid.innerHTML=html;
}

function visitsForDate(date){
  return (data.visits||[]).filter(isRealVisit).filter(v=>{
    const from=dateOnly(v.from);
    const to=dateOnly(v.to)||from;
    return from&&from<=date&&to>=date;
  });
}

function showDayDetails(date){
  const visits=visitsForDate(date);
  if(!visits.length){
    toast('Η ημέρα είναι ελεύθερη.');
    return;
  }

  const msg=visits.map(v=>{
    return `${v.name} — ${labelStatus(v.status)}${v.notes?' — '+v.notes:''}`;
  }).join('\n');

  alert(`Ημερομηνία: ${showDate(date)}\n\n${msg}`);
}
