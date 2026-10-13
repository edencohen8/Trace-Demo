#!/usr/bin/env python3
"""TRACE Simulator Lab. Local-only browser interface, standard-library HTTP server.

Start: python ui.py; open http://127.0.0.1:8765
Generates raw case data with a seeded simulator and exports only public evidence.
"""
import argparse
import csv
import io
import json
import shutil
import subprocess
import sys
import threading
import zipfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parent
CONFIG=ROOT/'config'
RUNS=ROOT/'runs'
CATALOG=ROOT/'public_system_catalog.json'
SELECTION={
 'missed_detection':{'title':'Missed detection','summary':'A sensor sees a target, but the tracking pipeline does not confirm it.'},
 'position_jump':{'title':'Position jump','summary':'An external position reference moves while GPS and manual values remain stable.'},
 'iff_alert_delay':{'title':'Delayed IFF alert','summary':'An IFF reply leads to a queued alert, but the delivery path is delayed.'},
 'limited_export':{'title':'Incomplete evidence','summary':'The same detection event is present in the simulated bus, but key message types are not in the selected export.'}
}

state={'latest':None,'summary':None,'error':None}
generation_lock=threading.Lock()

def load_config():
    system=json.loads((CONFIG/'system.json').read_text(encoding='utf-8'))
    scenarios=[]
    for file in sorted((CONFIG/'scenarios').glob('*.json')):
        case=json.loads(file.read_text(encoding='utf-8'))
        descr=SELECTION.get(case['id'],{'title':case['id'].replace('_',' ').title(),'summary':'Editable system scenario'})
        scenarios.append({**descr,'id':case['id'],'case':case})
    return {'system':system,'scenarios':scenarios}

def normalized_input(payload):
    scenario=str(payload.get('scenario',''))
    file=CONFIG/'scenarios'/f'{scenario}.json'
    # Exact scenario ID whitelist; this is a local demo, not an arbitrary file launcher.
    if scenario not in SELECTION or not file.exists():raise ValueError('Select a known scenario.')
    case=json.loads(file.read_text(encoding='utf-8'))
    system=json.loads((CONFIG/'system.json').read_text(encoding='utf-8'))
    incident=str(payload.get('incident','')).strip()
    if incident:
        event=datetime.fromisoformat(incident)
        if event.tzinfo is None:
            event=event.replace(tzinfo=datetime.fromisoformat(case['incident_local']).tzinfo)
    else:event=datetime.fromisoformat(case['incident_local'])
    if event.year<2020 or event.year>2040:raise ValueError('Incident year must be 2020–2040.')
    duration=int(payload.get('duration',system['clock']['duration_minutes']))
    if not 10<=duration<=240:raise ValueError('Length must be from 10 to 240 minutes.')
    source_start=datetime.fromisoformat(system['clock']['start_local'])
    source_incident=datetime.fromisoformat(case['incident_local'])
    proportion=(source_incident-source_start).total_seconds()/(system['clock']['duration_minutes']*60)
    start=event-timedelta(seconds=duration*60*proportion)
    system['clock']['start_local']=start.isoformat(timespec='seconds')
    system['clock']['duration_minutes']=duration
    case['incident_local']=event.isoformat(timespec='seconds')
    seed=int(payload.get('seed_offset',case.get('seed_offset',0)))
    if not 0<=seed<=10**8:raise ValueError('Seed offset must be from 0 to 100,000,000.')
    case['seed_offset']=seed
    edited=payload.get('fault_values',{})
    if not isinstance(edited,dict):raise ValueError('Fault settings must be an object.')
    # Allow numeric changes only to fields already present in the selected preset.
    for k,v in edited.items():
        if k not in case['faults'][0] or type(case['faults'][0][k]) not in (int,float):
            raise ValueError(f'Unsupported fault setting: {k}')
        n=float(v)
        if not -100000<=n<=100000:raise ValueError(f'Fault setting out of range: {k}')
        case['faults'][0][k]=int(n) if type(case['faults'][0][k]) is int else n
    if 'target_confidence' in payload and case.get('special_targets') and 'confidence_mean' in case['special_targets'][0]:
        n=float(payload['target_confidence'])
        if not .01<=n<=.99:raise ValueError('Target confidence must be between 0.01 and 0.99.')
        case['special_targets'][0]['confidence_mean']=n
    if 'exclude_types' in payload:
        exclusions=payload['exclude_types']
        if not isinstance(exclusions,list) or len(exclusions)>50 or any(not isinstance(s,str) or not s.isidentifier() for s in exclusions):
            raise ValueError('Message exclusions must be a list of valid message names.')
        case['export']['exclude_message_types']=sorted(set(exclusions))
    return system,case

def generate(payload):
    if not generation_lock.acquire(blocking=False):raise ValueError('A generation is already running.')
    try:
        system,case=normalized_input(payload)
        work=RUNS/'latest'
        if work.exists():shutil.rmtree(work)
        work.mkdir(parents=True)
        cfg=work/'scenario_input.json'; syscfg=work/'system_input.json'
        cfg.write_text(json.dumps(case,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        syscfg.write_text(json.dumps(system,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        cmd=[sys.executable,str(ROOT/'generate.py'),'--system',str(syscfg),'--scenario',str(cfg),'--output',str(work)]
        r=subprocess.run(cmd,capture_output=True,text=True,timeout=160)
        if r.returncode:raise ValueError('Generation failed: '+r.stderr[-550:])
        # Optional XLSX rendering. CSV remains a valid fallback if this library is absent.
        excel_error=None
        try:
            r=subprocess.run([sys.executable,str(ROOT/'export_diaries.py'),'--output',str(work)],capture_output=True,text=True,timeout=65)
            if r.returncode:excel_error='Excel export was not available; diary CSV is included instead.'
        except Exception:excel_error='Excel export was not available; diary CSV is included instead.'
        subprocess.run([sys.executable,str(ROOT/'build_reports.py'),'--scenario',str(cfg),'--output',str(work)],check=True,capture_output=True,text=True,timeout=40)
        cid=case['fixture_id']
        raw=work/'fixtures'/cid/'raw'
        mpath=raw.parent/'capture_manifest.json'
        manifest=json.loads(mpath.read_text(encoding='utf-8'))
        public=work/'trace_upload.zip'
        with zipfile.ZipFile(public,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            z.writestr('README.txt','TRACE synthetic evidence. Upload the raw files, capture_manifest.json, and public_system_catalog.json.\nThe ZIP does not include private ground truth or unfiltered simulator history.\nSniffer timestamps use UTC; local times are given in the manifest.\n')
            z.write(CATALOG,arcname='public_system_catalog.json')
            preferred_xlsx=(raw/'operator_diary.xlsx').exists()
            # The simulator stores both diary formats for inspection; publish just one.
            for file in sorted(raw.iterdir()):
                if preferred_xlsx and file.name=='operator_diary.csv':continue
                z.write(file,arcname=f'fixtures/{cid}/raw/{file.name}')
            if preferred_xlsx:
                manifest['file_sha256'].pop('operator_diary.csv',None)
                manifest['logged_time_metadata'].pop('operator_diary.csv',None)
            z.writestr(f'fixtures/{cid}/capture_manifest.json',json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
        summary=summarize(work,cid,case,manifest)
        if excel_error:summary['warning']=excel_error
        state.update(latest=public,summary=summary,error=None)
        return summary
    finally:generation_lock.release()

def summarize(work,cid,case,manifest):
    raw=work/'fixtures'/cid/'raw'
    incident=datetime.fromisoformat(case['incident_local'])
    incident_utc=incident.astimezone(timezone.utc)
    with (raw/'sniffer.csv').open(encoding='utf-8',newline='') as f:
        rows=csv.DictReader(f)
        count=Counter();bars={};incident_rows=[];first_rows=[]
        for r in rows:
            count[r['message_type']]+=1
            ts=datetime.fromisoformat(r['capture_time_utc'].replace('Z','+00:00'))
            block=(ts-minute_start(ts)).total_seconds()//300  # 5-minute bucket
            key=int((ts-datetime.fromisoformat(manifest['window_utc']['start'].replace('Z','+00:00'))).total_seconds()//300)
            bar=bars.setdefault(key,{'bucket':key,'detections':0,'tracks':0,'other':0})
            if r['message_type']=='DetectionCandidate':bar['detections']+=1
            elif r['message_type']=='TrackUpdate':bar['tracks']+=1
            else:bar['other']+=1
            if len(first_rows)<4:first_rows.append({k:r.get(k,'') for k in ('capture_time_utc','message_type','target_id','confidence','filter_revision','delivery_state')})
            delta=(ts-incident_utc).total_seconds()
            scenario=case['id']
            related=(
                scenario=='position_jump' and r['message_type']=='PositionReport' and (-8<=delta<=8 or 90<=delta<=96)
                or scenario in ('missed_detection','limited_export') and (
                    r['message_type']=='FilterConfigApplied' and (-32<=delta<=-28 or 128<=delta<=132)
                    or r['target_id']=='T-017' and 8<=delta<=42
                    or scenario=='limited_export' and r['message_type']=='PositionReport' and abs(delta)<=4)
                or scenario=='iff_alert_delay' and (
                    r['message_type'] in ('DispatcherState','AlertRuleMatch','NotificationRequest','NotificationDelivered') and -5<=delta<=105
                    or r['message_type']=='IFFReply' and r['target_id']=='T-088' and -1<=delta<=2))
            if related and len(incident_rows)<18:
                incident_rows.append({k:r.get(k,'') for k in ('capture_time_utc','message_type','target_id','confidence','threshold','filter_revision','delivery_state','site_gps_lat','site_gps_lon','site_manual_lat','site_manual_lon','site_external_lat','site_external_lon','transponder_mode3a','alert_id')})
    logs=[]
    for name in ('sensor.txt','tracking_service.txt','external_position_adapter.txt','notification_service.txt'):
        lines=(raw/name).read_text(encoding='utf-8').splitlines()
        inc_hm=incident.strftime('%H:%M');utc_hm=incident_utc.strftime('%H:%M')
        matched=[v for v in lines if inc_hm in v or utc_hm in v]
        logs.append({'name':name,'total':len(lines),'sample':(matched[:2] or lines[:2])})
    diary=[]
    with (raw/'operator_diary.csv').open(encoding='utf-8-sig',newline='') as f:
        for r in csv.DictReader(f):diary.append({'time':r['reported_local_time'],'note':r['note_he']})
    return {'case':cid,'title':SELECTION[case['id']]['title'],'incident_local':case['incident_local'],
            'window_local':manifest['window_local'],'window_utc':manifest['window_utc'],
            'sniffer_count':manifest['exported_sniffer_rows'],'message_types':len(count),
            'log_count':sum(x['total'] for x in logs),'diary_count':len(diary),
            'excluded_types':manifest['export_selection']['excluded_message_types'],
            'per_type':dict(count),'bars':[bars[k] for k in sorted(bars)],
            'sniffer_preview':incident_rows or first_rows,'logs':logs,'diary':diary,'zip_size':(work/'trace_upload.zip').stat().st_size}

def minute_start(t):return t.replace(minute=0,second=0,microsecond=0)

class Handler(BaseHTTPRequestHandler):
    server_version='TRACE-Lab/0.3'
    def log_message(self,format,*args):pass
    def answer(self,obj,code=200):
        raw=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/api/config':return self.answer(load_config())
        if path=='/api/latest':return self.answer(state['summary'] or {})
        if path=='/api/download':
            latest=state.get('latest')
            if not latest or not latest.is_file():return self.answer({'error':'Generate a case first.'},404)
            body=latest.read_bytes()
            self.send_response(200);self.send_header('Content-Type','application/zip')
            self.send_header('Content-Disposition','attachment; filename="TRACE_case_upload.zip"')
            self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        if path not in ('/','/index.html'):return self.answer({'error':'Not found'},404)
        raw=(ROOT/'web'/'index.html').read_bytes()
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_POST(self):
        if urlparse(self.path).path!='/api/generate':return self.answer({'error':'Not found'},404)
        origin=self.headers.get('Origin','')
        if origin and not (origin.startswith('http://127.0.0.1:') or origin.startswith('http://localhost:')):
            return self.answer({'error':'Local requests only'},403)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=32000:raise ValueError('Invalid request size')
            payload=json.loads(self.rfile.read(length).decode('utf-8'))
            return self.answer(generate(payload))
        except Exception as exc:return self.answer({'error':str(exc)},400)

def main():
    a=argparse.ArgumentParser();a.add_argument('--port',type=int,default=8765);args=a.parse_args()
    RUNS.mkdir(exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'TRACE Simulator Lab: http://127.0.0.1:{args.port}',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=='__main__':main()
