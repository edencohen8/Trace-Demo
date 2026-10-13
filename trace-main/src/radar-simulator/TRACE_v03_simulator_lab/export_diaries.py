#!/usr/bin/env python3
"""Optional Excel exporter for TRACE diary files. Requires artifact_tool.
Run after generate.py: python export_diaries.py
"""
import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from artifact_tool import Workbook, SpreadsheetFile

import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=Path(__file__).parent)
args=parser.parse_args()
BASE=args.output/'fixtures'
for csvpath in sorted(BASE.glob('*/raw/operator_diary.csv')):
    with csvpath.open(encoding='utf-8-sig',newline='') as f:
        records=list(csv.DictReader(f))
    wb=Workbook.create()
    ws=wb.worksheets.add('Operator diary')
    names=['entry_id','reported_local_time','logged_local_time','reported_precision','observer','note_he']
    data=[names]
    for record in records:
        data.append([record['entry_id'],
                     datetime.fromisoformat(record['reported_local_time']).replace(tzinfo=None),
                     datetime.fromisoformat(record['logged_local_time']).replace(tzinfo=None),
                     record['reported_precision'],record['observer'],record['note_he']])
    ws.get_range_by_indexes(0,0,len(data),len(names)).values=data
    ws.get_range('A1:F1').format={'fill':'#164E63','font':{'bold':True,'color':'#FFFFFF'},'row_height':30,'vertical_alignment':'center'}
    for col,width in {'A':14,'B':24,'C':24,'D':23,'E':23,'F':80}.items():
        ws.get_range(f'{col}:{col}').format.column_width=width
    ws.get_range(f'B2:C{len(data)}').set_number_format('yyyy-mm-dd hh:mm:ss')
    ws.get_range(f'D2:F{len(data)}').format.wrap_text=True
    ws.get_range(f'A2:F{len(data)}').format.row_height=46
    ws.freeze_panes.freeze_rows(1)
    out=csvpath.with_suffix('.xlsx')
    SpreadsheetFile.export_xlsx(wb).save(str(out))
    result=wb.inspect({'kind':'table','range':f"'Operator diary'!A1:F2",'include':'values','table_max_rows':2,'table_max_cols':6})
    manifest_path=csvpath.parent.parent/'capture_manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['logged_time_metadata']['operator_diary.xlsx']='Excel local +03 wall-clock values (timezone recorded in manifest)'
    manifest['file_sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(csvpath.parent.iterdir()) if p.is_file()}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(out, result.ndjson[:220])
