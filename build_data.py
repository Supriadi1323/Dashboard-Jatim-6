#!/usr/bin/env python3
"""Export branch-level Jatim 6 metrics from the supplied workbook to local data.json.
Usage: python build_data.py "Jawa Timur 6.xlsx"
"""
import sys, json, math
from pathlib import Path
import pandas as pd

def num(v):
    if pd.isna(v): return None
    try:
        x=float(v)
        return round(x, 4) if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None

def total(df, col):
    return num(df[col].fillna(0).sum()) or 0

def rate(df, paid_col, noa_col):
    den=df[noa_col].fillna(0).sum()
    return num(df[paid_col].fillna(0).sum()/den) if den else 0

def main():
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python build_data.py "path/to/workbook.xlsx"')
    path=Path(sys.argv[1])
    if not path.exists(): raise SystemExit(f'File tidak ditemukan: {path}')
    src=pd.read_excel(path, sheet_name='Source Daily')
    src['cutoff_date']=pd.to_datetime(src['cutoff_date'], errors='coerce')
    src=src[src['region_name'].astype(str).str.strip().eq('Jawa Timur 6')].copy()
    if src.empty: raise SystemExit('Tidak ditemukan baris region_name = Jawa Timur 6.')
    latest=src['cutoff_date'].max()
    latest_df=src[src['cutoff_date'].eq(latest)].copy()
    weekly=pd.read_excel(path, sheet_name='Weekly Dashboard', header=None)
    status={}
    for _,r in weekly.iterrows():
        branch=r.iloc[14] if len(r)>14 else None
        st=r.iloc[15] if len(r)>15 else None
        movement=r.iloc[16] if len(r)>16 else None
        if isinstance(branch,str) and branch.strip() in set(latest_df['branch_name'].astype(str)):
            status[branch.strip()]={'status':str(st) if pd.notna(st) else 'Belum dikategorikan',
                                    'movement':str(movement) if pd.notna(movement) else '-'}
    cols={'noa_current':'noa_current','rr_current':'rr_current_by_noa',
          'noa_1_30':'noa_1_30','rr_1_30':'rr_1_30_by_noa',
          'noa_31_60':'noa_31_60','rr_31_60':'rr_31_60_by_noa',
          'noa_61_90':'noa_61_90','rr_61_90':'rr_61_90_by_noa',
          'noa_90_plus':'noa_90_plus','rr_90_plus':'rr_90_plus_by_noa',
          'noa_total':'noa','noa_paid':'noa_paid_min_1x',
          'ntb_noa':'ntb_disbursement_noa','etb_noa':'etb_disbursement_noa',
          'active_agents':'active_agent_count','homevisit_assigned':'homevisit_assigned_count',
          'homevisit_submitted':'homevisit_submitted_count','homevisit_met':'homevisit_met_count',
          'homevisit_paid':'homevisit_paid_count'}
    branches=[]
    for _,r in latest_df.iterrows():
        b=str(r['branch_name']); item={'branch':b,'area':str(r['area_name'])}
        item.update(status.get(b,{'status':'Belum dikategorikan','movement':'-'}))
        for k,c in cols.items(): item[k]=num(r.get(c))
        branches.append(item)
    trend=[]
    start=latest-pd.Timedelta(days=29)
    for d,g in src[src['cutoff_date']>=start].groupby('cutoff_date'):
        trend.append({'date':d.strftime('%Y-%m-%d'),
          'noa_current':total(g,'noa_current'),'rr_current':rate(g,'noa_current_paid_min_1x','noa_current'),
          'noa_1_30':total(g,'noa_1_30'),'rr_1_30':rate(g,'noa_1_30_paid_min_1x','noa_1_30'),
          'noa_31_60':total(g,'noa_31_60'),'rr_31_60':rate(g,'noa_31_60_paid_min_1x','noa_31_60'),
          'noa_61_90':total(g,'noa_61_90'),'rr_61_90':rate(g,'noa_61_90_paid_min_1x','noa_61_90'),
          'noa_90_plus':total(g,'noa_90_plus'),'rr_90_plus':rate(g,'noa_90_plus_paid_min_1x','noa_90_plus')})
    out={'meta':{'title':'Jawa Timur 6 • Performance Dashboard','source':path.name,
                 'cutoff_date':latest.strftime('%Y-%m-%d'),
                 'note':'Data operasional internal. Jangan unggah ke repository publik.'},
         'branches':sorted(branches,key=lambda x:x['branch']),'trend':trend}
    Path('data.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Berhasil: data.json dibuat, {len(branches)} branch, cutoff {latest:%Y-%m-%d}.')
    print('PERINGATAN: data.json berisi metrik internal. Jangan commit ke repository publik.')
if __name__=='__main__': main()
