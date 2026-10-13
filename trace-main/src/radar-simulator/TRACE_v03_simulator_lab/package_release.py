#!/usr/bin/env python3
"""Build non-overlapping investigator and simulator/evaluator ZIPs."""
import json
import hashlib
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT=Path(__file__).resolve().parent
DEST=ROOT.parent

def public():
    path=DEST/'TRACE_v03_investigator_data.zip'
    with ZipFile(path,'w',compression=ZIP_DEFLATED,compresslevel=6) as z:
        z.writestr('README.txt','TRACE investigator test data. Each case has raw sniffer, component logs and a diary.\nRead capture_manifest.json for clocks and export selection.\nNo private answer keys or unfiltered bus histories are included.\n')
        z.write(ROOT/'public_system_catalog.json','public_system_catalog.json')
        for folder in sorted((ROOT/'fixtures').glob('case_*')):
            raw=folder/'raw'
            original=json.loads((folder/'capture_manifest.json').read_text(encoding='utf-8'))
            preferred=(raw/'operator_diary.xlsx').is_file()
            for file in sorted(raw.iterdir()):
                if preferred and file.name=='operator_diary.csv':continue
                z.write(file,str(file.relative_to(ROOT)))
            if preferred:
                original['file_sha256'].pop('operator_diary.csv',None)
                original['logged_time_metadata'].pop('operator_diary.csv',None)
            z.writestr(str((folder/'capture_manifest.json').relative_to(ROOT)),json.dumps(original,ensure_ascii=False,indent=2)+'\n')
            guide=folder/'README.md'
            if guide.exists():z.write(guide,str(guide.relative_to(ROOT)))
    return path

def private():
    path=DEST/'TRACE_v03_simulator_lab.zip'
    with ZipFile(path,'w',compression=ZIP_DEFLATED,compresslevel=6) as z:
        filelist=['README.md','generate.py','export_diaries.py','build_reports.py','package_release.py',
                  'write_public_guides.py','validate.py','ui.py','web/index.html','public_system_catalog.json']
        for entry in filelist:z.write(ROOT/entry,entry)
        for name in ('config','internal_history','private_ground_truth'):
            for p in sorted((ROOT/name).rglob('*')):
                if p.is_file():z.write(p,str(p.relative_to(ROOT)))
    return path

def main():
    a=public();b=private()
    with ZipFile(a) as z:
        names=z.namelist()
        assert not any('private_ground_truth' in x or 'internal_history' in x or 'config/scenarios' in x for x in names)
        for x in names:
            if x.endswith('capture_manifest.json'):
                m=json.loads(z.read(x))
                prefix=x.removesuffix('capture_manifest.json')+'raw/'
                for fname,digest in m['file_sha256'].items():
                    assert hashlib.sha256(z.read(prefix+fname)).hexdigest()==digest,(x,fname)
    with ZipFile(b) as z:
        assert not any(x.startswith('fixtures/') for x in z.namelist())
        assert any(x.endswith('/SCENARIO.md') for x in z.namelist())
        assert 'web/index.html' in z.namelist()
    print('INVESTIGATOR:',a,a.stat().st_size,'bytes')
    print('SIMULATOR:',b,b.stat().st_size,'bytes')
    print('Checked: no raw fixture duplication between ZIPs; all public manifest hashes match.')

if __name__=='__main__':main()
