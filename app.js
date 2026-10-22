let DATA=null, rrChart=null, dpdChart=null, sortKey='branch', sortAsc=true;
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:0});
const pct=n=>n==null?'—':(Number(n)*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%';
const safe=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const dateOnly=v=>String(v||'').slice(0,10);
function findSheet(raw, name){
  if(raw?.sheets?.[name]?.rows) return raw.sheets[name].rows;
  if(raw?.[name]?.rows) return raw[name].rows;
  return null;
}
function rowsToObjects(rows){
  if(!Array.isArray(rows)||!rows.length)return [];
  const headers=rows[0].map(h=>String(h??'').trim());
  return rows.slice(1).filter(r=>Array.isArray(r)).map(r=>{
    const o={};headers.forEach((h,i)=>{if(h)o[h]=r[i]??null});return o;
  });
}
function buildDashboardData(raw){
  // Support both the workbook-conversion JSON and an already normalized dashboard JSON.
  if(Array.isArray(raw?.branches)&&raw?.meta)return raw;
  const sourceRows=findSheet(raw,'Source Daily');
  if(!sourceRows)throw Error('Sheet "Source Daily" tidak ditemukan di data.json');
  const source=rowsToObjects(sourceRows);
  if(!source.length)throw Error('Sheet "Source Daily" kosong');

  const weeklyRows=findSheet(raw,'Weekly Dashboard');
  const weekly=weeklyRows&&weeklyRows.length>2?weeklyRows.slice(3):[];
  const statusByBranch={};
  weekly.forEach(r=>{
    // Workbook columns: 12=Area, 14=Branch label, 15=Status, 16=Movement (zero-based).
    const branch=String(r?.[14]??'').trim();
    if(!branch)return;
    statusByBranch[branch]={area: String(r?.[12]??'').replace(/^\[[^\]]+\]\s*/,'').trim(),status:r?.[15]??'',movement:r?.[16]??''};
  });

  const regionRows=source.filter(r=>String(r.region_name??'').toLowerCase().includes('jawa timur 6'));
  const pool=regionRows.length?regionRows:source;
  const latestByBranch=new Map();
  pool.forEach(r=>{
    const branch=String(r.branch_name??'').trim();
    if(!branch)return;
    const d=dateOnly(r.cutoff_date);
    const prev=latestByBranch.get(branch);
    if(!prev||d>dateOnly(prev.cutoff_date))latestByBranch.set(branch,r);
  });
  const branches=[...latestByBranch.values()].map(r=>{
    const branch=String(r.branch_name??'').trim();
    const extra=statusByBranch[branch]||{};
    const noa=num(r.noa_current);
    const paid=num(r.noa_current_paid_min_1x);
    return {
      branch,
      area:String(r.area_name??extra.area??'').trim(),
      status:extra.status||'Belum dikategorikan',
      movement:extra.movement||'—',
      noa_current:noa,
      rr_current:noa?paid/noa:0,
      noa_1_30:num(r.noa_1_30),
      noa_31_60:num(r.noa_31_60),
      noa_61_90:num(r.noa_61_90),
      noa_90_plus:num(r.noa_90_plus),
      ntb_noa:num(r.ntb_disbursement_noa),
      etb_noa:num(r.etb_disbursement_noa),
      cutoff_date:dateOnly(r.cutoff_date)
    };
  }).sort((a,b)=>a.branch.localeCompare(b.branch));

  // Daily regional trend: aggregate all branches per cutoff date, weighted by NOA.
  const byDate=new Map();
  pool.forEach(r=>{
    const date=dateOnly(r.cutoff_date);
    if(!date)return;
    if(!byDate.has(date))byDate.set(date,{date,noa:0,paid:0});
    const item=byDate.get(date);
    item.noa+=num(r.noa_current);
    item.paid+=num(r.noa_current_paid_min_1x);
  });
  const trend=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>({
    date:x.date,rr_current:x.noa?x.paid/x.noa:0
  }));
  const cutoff=pool.reduce((m,r)=>dateOnly(r.cutoff_date)>m?dateOnly(r.cutoff_date):m,'');
  return {meta:{cutoff_date:cutoff},branches,trend};
}
async function loadData(){
  try{
    const res=await fetch('./data.json',{cache:'no-store'});
    if(!res.ok)throw Error('HTTP '+res.status);
    const raw=await res.json();
    DATA=buildDashboardData(raw);
  }catch(e){
    console.error('Gagal memuat data.json:',e);
    try{
      const res=await fetch('./data.example.json',{cache:'no-store'});
      if(!res.ok)throw Error('File demo tidak tersedia');
      DATA=buildDashboardData(await res.json());
      toast('Mode demo aktif — data.json gagal dibaca.');
    }catch(f){
      toast('Gagal membaca data.json. Periksa struktur file.');
      const el=$('branchRows');if(el)el.innerHTML='<tr><td colspan="10" class="empty">Data gagal dimuat. Pastikan data.json valid dan berada di folder utama repository.</td></tr>';
      console.error(f);return;
    }
  }
  $('cutoffDate').textContent='Cutoff · '+(DATA.meta?.cutoff_date||'—');
  const areas=[...new Set(DATA.branches.map(b=>b.area).filter(Boolean))].sort();
  $('areaFilter').innerHTML='<option value="all">Semua area</option>'+areas.map(a=>`<option value="${safe(a)}">${safe(a)}</option>`).join('');
  updateBranchOptions();render();
}
function updateBranchOptions(){
  const area=$('areaFilter').value,current=$('branchFilter').value;
  const list=DATA.branches.filter(b=>area==='all'||b.area===area).map(b=>b.branch).sort();
  $('branchFilter').innerHTML='<option value="all">Semua branch</option>'+list.map(b=>`<option value="${safe(b)}">${safe(b)}</option>`).join('');
  if(list.includes(current))$('branchFilter').value=current;
}
function filtered(){
  const area=$('areaFilter').value,branch=$('branchFilter').value,q=$('searchInput').value.trim().toLowerCase();
  return DATA.branches.filter(b=>(area==='all'||b.area===area)&&(branch==='all'||b.branch===branch)&&(!q||String(b.branch).toLowerCase().includes(q)));
}
function sum(arr,key){return arr.reduce((a,b)=>a+num(b[key]),0)}
function weightedRR(arr,noaKey,rrKey){const den=sum(arr,noaKey);return den?arr.reduce((a,b)=>a+num(b[noaKey])*num(b[rrKey]),0)/den:0}
function statusClass(s){s=(s||'').toLowerCase();if(s.includes('aspiration'))return'aspiration';if(s.includes('emerging'))return'emerging';if(s.includes('turnaround')||s.includes('need'))return'turnaround';if(s.includes('under'))return'under';return''}
function render(){
 if(!DATA)return;
 const rows=filtered();
 $('kpiBranches').textContent=fmt(rows.length);
 $('kpiRR').textContent=pct(weightedRR(rows,'noa_current','rr_current'));
 $('kpiNOA').textContent=fmt(sum(rows,'noa_current'));
 $('kpiDPD').textContent=fmt(sum(rows,'noa_1_30'));
 $('kpi90').textContent=fmt(sum(rows,'noa_90_plus'));
 $('rowCount').textContent=rows.length+' branch';
 const sorted=[...rows].sort((a,b)=>{
   const x=a[sortKey]??'',y=b[sortKey]??'';
   if(typeof x==='string'||typeof y==='string')return (sortAsc?1:-1)*String(x).localeCompare(String(y));
   return (sortAsc?1:-1)*(num(x)-num(y));
 });
 $('branchRows').innerHTML=sorted.length?sorted.map(b=>`<tr>
 <td>${safe(b.branch)}</td><td>${safe(b.area||'—')}</td><td><span class="status ${statusClass(b.status)}">${safe(b.status||'Belum dikategorikan')}</span></td>
 <td><span class="movement ${safe(String(b.movement||'').toLowerCase())}">${safe(b.movement||'—')}</span></td>
 <td class="num">${fmt(b.noa_current)}</td><td class="num">${pct(b.rr_current)}</td><td class="num">${fmt(b.noa_1_30)}</td><td class="num">${fmt(b.noa_31_60)}</td><td class="num">${fmt(b.noa_61_90)}</td><td class="num">${fmt(b.noa_90_plus)}</td></tr>`).join(''):'<tr><td colspan="10" class="empty">Tidak ada branch yang sesuai filter.</td></tr>';
 $('tableSummary').textContent=`Menampilkan ${rows.length} dari ${DATA.branches.length} branch`;
 renderCharts(rows);
}
function renderCharts(rows){
 const trend=DATA.trend||[],labels=trend.map(x=>String(x.date||'').slice(5));
 if(rrChart)rrChart.destroy();
 rrChart=new Chart($('rrChart'),{type:'line',data:{labels,datasets:[{label:'RR Current',data:trend.map(x=>num(x.rr_current)*100),borderColor:'#655bdb',backgroundColor:'#655bdb18',fill:true,tension:.35,pointRadius:2,pointHoverRadius:5,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y.toFixed(1)+'%'}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:'#8a95a8',font:{size:10}}},y:{min:0,max:100,grid:{color:'#eef1f6'},ticks:{callback:v=>v+'%',color:'#8a95a8',font:{size:10}}}}}});
 if(dpdChart)dpdChart.destroy();
 const totals=[sum(rows,'noa_1_30'),sum(rows,'noa_31_60'),sum(rows,'noa_61_90'),sum(rows,'noa_90_plus')];
 dpdChart=new Chart($('dpdChart'),{type:'bar',data:{labels:['1–30','31–60','61–90','90+'],datasets:[{label:'NOA',data:totals,backgroundColor:['#efb35d','#e98c63','#dc6a77','#b83b55'],borderRadius:7,maxBarThickness:42}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.y)+' NOA'}}},scales:{x:{grid:{display:false},ticks:{color:'#667188',font:{size:11}}},y:{beginAtZero:true,grid:{color:'#eef1f6'},ticks:{color:'#8a95a8',callback:v=>fmt(v),font:{size:10}}}}}});
}
document.querySelectorAll('th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;if(sortKey===k)sortAsc=!sortAsc;else{sortKey=k;sortAsc=true}render()}));
$('areaFilter').addEventListener('change',()=>{updateBranchOptions();render()});
$('branchFilter').addEventListener('change',render);$('searchInput').addEventListener('input',render);
$('resetBtn').addEventListener('click',()=>{$('areaFilter').value='all';$('searchInput').value='';updateBranchOptions();$('branchFilter').value='all';render()});
$('refreshBtn').addEventListener('click',()=>{loadData().then(()=>toast('Dashboard diperbarui.'))});
$('exportBtn').addEventListener('click',()=>{
 const rows=filtered(),cols=['branch','area','status','movement','noa_current','rr_current','noa_1_30','noa_31_60','noa_61_90','noa_90_plus','ntb_noa','etb_noa'];
 const csv=[cols.join(','),...rows.map(r=>cols.map(c=>{const v=r[c]??'';return '"'+String(v).replace(/"/g,'""')+'"'}).join(','))].join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='jatim6-branch-performance.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
loadData();
