#!/usr/bin/env python3
"""Validate configurable generator fixtures and their private, independently derived truth."""
import csv
import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parent
system=json.loads((ROOT/'config'/'system.json').read_text(encoding='utf-8'))

def ts(t):
    return datetime.fromisoformat(t.replace('Z','+00:00')).timestamp()

def dist_m(lat1,lon1,lat2,lon2):
    # Small-displacement approximation only, for this fictional WGS84 point.
    return math.hypot((lat1-lat2)*111195,(lon1-lon2)*111195*math.cos(math.radians(lat1)))

def verify_case(path):
    config=json.loads(path.read_text(encoding='utf-8'))
    case=config['id']
    fixture_id=config.get('fixture_id',case)
    raw=ROOT/'fixtures'/fixture_id/'raw'
    man=json.loads((raw.parent/'capture_manifest.json').read_text(encoding='utf-8'))
    with (raw/'sniffer.csv').open(newline='',encoding='utf-8') as f:
        rows=list(csv.DictReader(f))
    canonical=[json.loads(line) for line in (ROOT/'internal_history'/f'{fixture_id}.jsonl').read_text(encoding='utf-8').splitlines()]
    sel=man['export_selection']
    targets=sel['target_filter'] if isinstance(sel['target_filter'],list) else []
    expected=[{k:e[k] for k in sel['columns']} for e in canonical
              if e['message_type'] in sel['message_types'] and (not targets or e['target_id'] in targets)]
    # DictWriter serializes each scalar as text; conversion keeps numerical semantics.
    assert rows==[{k:str(v) for k,v in e.items()} for e in expected],('CSV projection mismatch',case)
    assert len(rows)==man['exported_sniffer_rows']
    assert len(canonical)==man['generated_bus_messages_all_types']
    assert len(set(r['message_id'] for r in canonical))==len(canonical)
    assert rows==sorted(rows,key=lambda r:(r['capture_time_utc'],int(r['bus_sequence'])))
    assert dict(Counter(r['message_type'] for r in rows))==man['exported_count_by_type']
    for file, digest in man['file_sha256'].items():
        assert hashlib.sha256((raw/file).read_bytes()).hexdigest()==digest,(case,file)
    assert 'ground_truth' not in '\n'.join(p.name for p in raw.iterdir())
    if (raw/'operator_diary.xlsx').exists():
        with ZipFile(raw/'operator_diary.xlsx') as z:
            assert z.testzip() is None
            assert 'xl/workbook.xml' in z.namelist()
    assert ts(man['window_utc']['start']) == ts(man['window_local']['start'])
    assert ts(man['window_utc']['end']) == ts(man['window_local']['end'])
    scan_period=system['sensor']['scan_period_s']
    t0=ts(man['window_utc']['start'])
    # For every confirmed track update, candidate exists in the exact scan,
    # and satisfies the threshold of the active revision.
    candidates={}
    for r in canonical:
        if r['message_type']=='DetectionCandidate' and r['target_id']:
            key=(r['target_id'],int((ts(r['capture_time_utc'])-t0)//scan_period))
            candidates.setdefault(key,[]).append(r)
    threshold={system['filter']['baseline_revision']:system['filter']['baseline_threshold']}
    for f in config['faults']:
        if f['type']=='filter_override':threshold[f['revision']]=f['threshold']
    for r in canonical:
        if r['message_type']=='TrackUpdate':
            key=(r['target_id'],int((ts(r['capture_time_utc'])-t0)//scan_period))
            assert any(float(c['confidence'])>=threshold[r['filter_revision']] for c in candidates.get(key,[])),(case,r['message_id'])
    for fault in config['faults']:
        if fault['type']=='filter_override':
            start=ts(config['incident_local'])+fault['start_offset_s']
            end=ts(config['incident_local'])+fault['end_offset_s']
            affected=[t for t in config['special_targets'] if t.get('confidence_mean',1)<fault['threshold']]
            for target in affected:
                region=[r for r in canonical if r['target_id']==target['id'] and start<=ts(r['capture_time_utc'])<end]
                assert sum(r['message_type']=='DetectionCandidate' for r in region)>0
                assert not any(r['message_type'] in ('TrackUpdate','UiTrackPublished') for r in region)
        if fault['type']=='position_offset':
            rows_pos=[r for r in canonical if r['message_type']=='PositionReport']
            incident=ts(config['incident_local'])
            inside=[];outside=[]
            for r in rows_pos:
                d=dist_m(float(r['site_manual_lat']),float(r['site_manual_lon']),float(r['site_external_lat']),float(r['site_external_lon']))
                (inside if incident+fault['start_offset_s']<=ts(r['capture_time_utc'])<incident+fault['end_offset_s'] else outside).append(d)
                gps=dist_m(float(r['site_manual_lat']),float(r['site_manual_lon']),float(r['site_gps_lat']),float(r['site_gps_lon']))
                assert gps < 25
            assert min(inside)>1000 and max(outside)<30,(case,'position offset failed')
        if fault['type']=='notification_outage':
            matching=lambda kind:[r for r in canonical if r['message_type']==kind and r['alert_id']==fault['alert_id']]
            req=matching('NotificationRequest'); delivered=matching('NotificationDelivered')
            assert len(req)==len(delivered)==1
            delay=ts(delivered[0]['producer_time_utc'])-ts(req[0]['producer_time_utc'])
            expected_delay=fault['delivery_offset_s']-fault['request_offset_s']
            assert abs(delay-expected_delay)<0.001,(case,delay,expected_delay)
    print(f'PASS {case}: {len(canonical):,} canonical, {len(rows):,} exported; hashes, causal constraints, projection, timezone OK')

def main():
    for cfg in sorted((ROOT/'config'/'scenarios').glob('*.json')):
        verify_case(cfg)

if __name__=='__main__':main()
