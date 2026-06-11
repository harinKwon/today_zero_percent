(window as any).switchView = (v: string) => {
  document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
  document.getElementById(v)?.classList.add('active');
  if (v === 'view-calendar') renderCalendar();
};

// 요일 선택을 위한 함수 (HTML 태그에 직접 연결됨)
(window as any).toggleDay = (btn: HTMLElement) => {
  btn.classList.toggle('selected');
};

let jobProfile = JSON.parse(localStorage.getItem('shiftProfile') || '{"location":"","wage":0,"hours":6,"days":[]}');
let exceptions: Record<string, any> = JSON.parse(localStorage.getItem('shiftExceptions') || '{}'); 
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

(window as any).saveJobProfile = () => {
  const days: number[] = [];
  document.querySelectorAll('.day-btn.selected').forEach(b => days.push(parseInt(b.getAttribute('data-day')!)));
  jobProfile = {
    location: (document.getElementById('reg-location') as HTMLInputElement).value,
    wage: parseInt((document.getElementById('reg-wage') as HTMLInputElement).value) || 0,
    hours: parseInt((document.getElementById('reg-hours') as HTMLInputElement).value) || 6,
    days: days
  };
  localStorage.setItem('shiftProfile', JSON.stringify(jobProfile));
  (window as any).switchView('view-calendar');
};

(window as any).resetApp = () => { if(confirm("초기화하시겠습니까?")) { localStorage.clear(); location.reload(); } };

document.getElementById('prev-month')?.addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar(); });
document.getElementById('next-month')?.addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); });
document.getElementById('opt-juhyu')?.addEventListener('change', renderCalendar);
document.getElementById('opt-tax')?.addEventListener('change', renderCalendar);

function renderCalendar() {
  const calBody = document.getElementById('calendar-body')!;
  calBody.innerHTML = '';
  document.getElementById('cal-month-title')!.innerText = `${currentYear}년 ${currentMonth + 1}월`;
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for(let i=0; i<firstDay; i++) calBody.appendChild(document.createElement('div'));
  
  let finalHP = 100, baseSalary = 0, weeklyHours: Record<number, number> = {};

  for(let date=1; date<=daysInMonth; date++) {
    const dStr = `${currentYear}-${String(currentMonth+1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const weekIdx = Math.floor((date + firstDay - 1) / 7);
    const dayOfWeek = new Date(currentYear, currentMonth, date).getDay();
    const data = exceptions[dStr] || { removedBase: false, added: [] };
    
    let shifts = [];
    if(jobProfile.days.includes(dayOfWeek) && !data.removedBase) shifts.push({isBase:true, loc:jobProfile.location, wage:jobProfile.wage, hours:jobProfile.hours});
    if(data.added) shifts.push(...data.added);

    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.innerHTML = `<div class="date-num">${date}</div><div class="dots-container" style="display:flex; flex-wrap:wrap; gap:2px; justify-content:center; margin-top:2px;"></div>`;
    shifts.forEach(s => cell.querySelector('.dots-container')!.innerHTML += `<div class="${s.isBase ? 'shift-dot' : 'shift-added'}"></div>`);
    if(jobProfile.days.includes(dayOfWeek) && data.removedBase) cell.querySelector('.dots-container')!.innerHTML += `<div class="shift-removed"></div>`;
    
    cell.onclick = () => openModal(dStr, jobProfile.days.includes(dayOfWeek), data);
    calBody.appendChild(cell);

    finalHP = Math.min(100, finalHP + 3);
    shifts.forEach(s => {
      finalHP -= (s.hours * 1.5 * ((dayOfWeek==0||dayOfWeek==6)?1.2:1));
      baseSalary += (s.hours * s.wage);
      weeklyHours[weekIdx] = (weeklyHours[weekIdx] || 0) + s.hours;
    });
  }
  
  const isJ = (document.getElementById('opt-juhyu') as HTMLInputElement).checked;
  const isT = (document.getElementById('opt-tax') as HTMLInputElement).checked;
  let jPay = isJ ? Object.values(weeklyHours).reduce((acc:any, h:any) => acc + (h >= 15 ? Math.round((h/40)*8*jobProfile.wage) : 0), 0) : 0;
  let total = baseSalary + jPay - (isT ? Math.round((baseSalary + jPay) * 0.033) : 0);
  
  document.getElementById('month-hp')!.innerText = `${Math.max(0, Math.round(finalHP))}%`;
  document.getElementById('month-salary')!.innerText = `${total.toLocaleString()}원`;
  document.getElementById('salary-breakdown')!.innerText = `기본급: ${baseSalary.toLocaleString()}원 ${jPay > 0 ? `| 주휴: +${jPay.toLocaleString()}원` : ''}`;

  const adviceEl = document.getElementById('month-advice');
  if (adviceEl) {
    if (finalHP >= 80) adviceEl.innerText = "👍 아주 쾌적합니다!";
    else if (finalHP >= 30) adviceEl.innerText = "🤔 조금 피곤할 수 있습니다.";
    else adviceEl.innerText = "🚨 경고! 퇴사를 고민하세요!";
  }
}

(window as any).openModal = (dStr: string, isBase: boolean, data: any) => {
  const list = document.getElementById('modal-shift-list')!;
  list.innerHTML = '<h3>근무 상세</h3>';
  if(isBase && !data.removedBase) list.innerHTML += `<div style="padding:5px;">🏠 ${jobProfile.location} (${jobProfile.hours}시간)</div>`;
  data.added?.forEach((s:any, i:number) => {
    list.innerHTML += `<div style="display:flex; justify-content:space-between; padding:5px;">
      <span>🕒 ${s.location} (${s.hours}시간)</span>
      <button onclick="deleteShift(${i})">삭제</button>
    </div>`;
  });
  document.getElementById('modal-date-title')!.innerText = dStr;
  document.getElementById('modal-overlay')!.style.display = 'block';
  document.getElementById('modal-action-btn')!.onclick = () => { data.removedBase = true; performSave(dStr, data); };
  document.getElementById('modal-reset-btn')!.onclick = () => { delete exceptions[dStr]; performSave(dStr, data); };
};

(window as any).deleteShift = (i: number) => {
  let dStr = document.getElementById('modal-date-title')!.innerText;
  let data = exceptions[dStr];
  data.added.splice(i, 1);
  performSave(dStr, data);
};

(window as any).showAddForm = () => {
  document.getElementById('modal-btn-group')!.style.display = 'none';
  document.getElementById('modal-add-form')!.style.display = 'block';
};

(window as any).saveAddedShift = () => {
  const dStr = document.getElementById('modal-date-title')!.innerText;
  let data = exceptions[dStr] || { removedBase: false, added: [] };
  data.added.push({ 
    location: (document.getElementById('modal-location') as HTMLInputElement).value, 
    wage: parseInt((document.getElementById('modal-wage') as HTMLInputElement).value), 
    hours: parseInt((document.getElementById('modal-hours') as HTMLInputElement).value) 
  });
  performSave(dStr, data);
};

function performSave(dStr: string, data: any) {
  exceptions[dStr] = data;
  localStorage.setItem('shiftExceptions', JSON.stringify(exceptions));
  (window as any).closeModal();
  renderCalendar();
}

(window as any).closeModal = () => { document.getElementById('modal-overlay')!.style.display = 'none'; };
(window as any).switchView('view-home');