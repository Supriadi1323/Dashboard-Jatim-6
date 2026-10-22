let DATA=null, rrChart=null, dpdChart=null, sortKey='branch', sortAsc=true;
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:0});
const pct=n=>n==null?'—':(Number(n)*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%';
const safe=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
async function loadData(){
  try { const res=await fetch('data.json',{cache:'no-store'}); if(!res.ok) throw Error('No local data'); DATA=await res.json(); }
  catch(e){ const res=await fetch('data.example.json'); DATA=await res.json(); toast('Mode demo aktif — tambahkan data.json untuk data internal.'); }
  $('cutoffDate').textContent='Cutoff · '+(DATA.meta.cutoff_date||'—');
  const areas=[...new Set(DATA.branches.map(b=>b.area).filter(Boolean))].sort();
  $('areaFilter').innerHTML='<option value="all">Semua area</option>'+areas.map(a=>`<option value="${safe(a)}">${safe(a)}</option>`).join('');
  updateBranchOptions(); render();
}
function updateBranchOptions(){
  const area=$('areaFilter').value, current=$('branchFilter').value;
  const list=DATA.branches.filter(b=>area==='all'||b.area===area).map(b=>b.branch).sort();
  $('branchFilter').innerHTML='<option value="all">Semua branch</option>'+list.map(b=>`<option value="${safe(b)}">${safe(b)}</option>`).join('');
  if(list.includes(current)) $('branchFilter').value=current;
}
function filtered(){
  const area=$('areaFilter').value, branch=$('branchFilter').value, q=$('searchInput').value.trim().toLowerCase();
  return DATA.branches.filter(b=>(area==='all'||b.area===area)&&(branch==='all'||b.branch===branch)&&(!q||b.branch.toLowerCase().includes(q)));
}
function sum(arr,key){return arr.reduce((a,b)=>a+(Number(b[key])||0),0)}
function weightedRR(arr,noaKey,rrKey){let den=sum(arr,noaKey);return den?arr.reduce((a,b)=>a+(Number(b[noaKey])||0)*(Number(b[rrKey])||0),0)/den:0}
function statusClass(s){s=(s||'').toLowerCase();if(s.includes('aspiration'))return'aspiration';if(s.includes('emerging'))return'emerging';if(s.includes('turnaround')||s.includes('need'))return'turnaround';if(s.includes('under'))return'under';return''}
function render(){
 const rows=filtered();
 $('kpiBranches').textContent=fmt(rows.length);
 $('kpiRR').textContent=pct(weightedRR(rows,'noa_current','rr_current'));
 $('kpiNOA').textContent=fmt(sum(rows,'noa_current'));
 $('kpiDPD').textContent=fmt(sum(rows,'noa_1_30'));
 $('kpi90').textContent=fmt(sum(rows,'noa_90_plus'));
 $('rowCount').textContent=rows.length+' branch';
 const sorted=[...rows].sort((a,b)=>{let x=a[sortKey]??'',y=b[sortKey]??'';if(typeof x==='string')return (sortAsc?1:-1)*String(x).localeCompare(String(y));return (sortAsc?1:-1)*((Number(x)||0)-(Number(y)||0));});
 $('branchRows').innerHTML=sorted.length?sorted.map(b=>`<tr>
 <td>${safe(b.branch)}</td><td>${safe(b.area||'—')}</td><td><span class="status ${statusClass(b.status)}">${safe(b.status||'Belum dikategorikan')}</span></td>
 <td><span class="movement ${(b.movement||'').toLowerCase()}">${safe(b.movement||'—')}</span></td>
 <td class="num">${fmt(b.noa_current)}</td><td class="num">${pct(b.rr_current)}</td><td class="num">${fmt(b.noa_1_30)}</td><td class="num">${fmt(b.noa_31_60)}</td><td class="num">${fmt(b.noa_61_90)}</td><td class="num">${fmt(b.noa_90_plus)}</td></tr>`).join(''):'<tr><td colspan="10" class="empty">Tidak ada branch yang sesuai filter.</td></tr>';
 $('tableSummary').textContent=`Menampilkan ${rows.length} dari ${DATA.branches.length} branch`;
 renderCharts(rows);
}
function renderCharts(rows){
 const area=$('areaFilter').value, branch=$('branchFilter').value;
 // Daily trend is shown for the whole regional portfolio; branch filter changes table/KPIs only.
 const trend=DATA.trend||[], labels=trend.map(x=>x.date.slice(5));
 if(rrChart)rrChart.destroy();
 rrChart=new Chart($('rrChart'),{type:'line',data:{labels,datasets:[{label:'RR Current',data:trend.map(x=>(Number(x.rr_current)||0)*100),borderColor:'#655bdb',backgroundColor:'#655bdb18',fill:true,tension:.35,pointRadius:2,pointHoverRadius:5,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y.toFixed(1)+'%'}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:'#8a95a8',font:{size:10}}},y:{min:0,max:100,grid:{color:'#eef1f6'},ticks:{callback:v=>v+'%',color:'#8a95a8',font:{size:10}}}}}});
 if(dpdChart)dpdChart.destroy();
 const totals=[sum(rows,'noa_1_30'),sum(rows,'noa_31_60'),sum(rows,'noa_61_90'),sum(rows,'noa_90_plus')];
 dpdChart=new Chart($('dpdChart'),{type:'bar',data:{labels:['1–30','31–60','61–90','90+'],datasets:[{data:totals,backgroundColor:['#efb35d','#e98c63','#dc6a77','#b83b55'],borderRadius:7,maxBarThickness:42}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.y)+' NOA'}}},scales:{x:{grid:{display:false},ticks:{color:'#667188',font:{size:11}}},y:{beginAtZero:true,grid:{color:'#eef1f6'},ticks:{color:'#8a95a8',callback:v=>fmt(v),font:{size:10}}}}}});
}
document.querySelectorAll('th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;if(sortKey===k)sortAsc=!sortAsc;else{sortKey=k;sortAsc=true}render()}));
$('areaFilter').addEventListener('change',()=>{updateBranchOptions();render()});
$('branchFilter').addEventListener('change',render);$('searchInput').addEventListener('input',render);
$('resetBtn').addEventListener('click',()=>{$('areaFilter').value='all';$('searchInput').value='';updateBranchOptions();$('branchFilter').value='all';render()});
$('refreshBtn').addEventListener('click',()=>{loadData().then(()=>toast('Dashboard diperbarui.'))});
$('exportBtn').addEventListener('click',()=>{const rows=filtered();const cols=['branch','area','status','movement','noa_current','rr_current','noa_1_30','noa_31_60','noa_61_90','noa_90_plus','ntb_noa','etb_noa'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>{let v=r[c]??'';return '"'+String(v).replace(/"/g,'""')+'"'}).join(','))].join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jatim6-branch-performance.csv';a.click();URL.revokeObjectURL(a.href)});
loadData();
