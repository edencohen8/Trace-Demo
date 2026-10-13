#!/usr/bin/env python3
"""TRACE v0.2 seeded simulator. Cases are declarative JSON, not case-name branches.

Python >=3.10, stdlib only. Output canonical internal bus + raw CSV/TXT/diary CSV.
Run export_diaries.py separately for .xlsx. Only fixtures/ goes to TRACE.
"""
import argparse
import csv
import hashlib
import json
import math
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COLUMNS = [
 'capture_time_utc','producer_time_utc','bus_sequence','message_id','message_type','producer',
 'target_id','track_id','sensor_id','confidence','range_km','bearing_deg','x_km','y_km',
 'track_state','filter_revision','threshold','site_gps_lat','site_gps_lon',
 'site_manual_lat','site_manual_lon','site_external_lat','site_external_lon',
 'position_quality','transponder_mode3a','alert_id','delivery_state','details'
]
LOG_FILES = ('sensor.txt','tracking_service.txt','ui_gateway.txt','external_position_adapter.txt','notification_service.txt')
SUPPORTED_FAULTS = {'filter_override','position_offset','notification_outage'}

def to_utc(t):
    return t.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def local(t):
    return t.isoformat(timespec='seconds')

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def validate_config(system, case):
    if system.get('schema_version')!='0.2' or case.get('schema_version')!='0.2':
        raise ValueError('config schema_version must be 0.2')
    if not case.get('id') or '/' in case['id'] or '\\' in case['id'] or case['id'] in ('.','..'):
        raise ValueError('case id must be an ordinary directory name')
    start = datetime.fromisoformat(system['clock']['start_local'])
    incident = datetime.fromisoformat(case['incident_local'])
    if start.tzinfo is None or incident.tzinfo is None:
        raise ValueError('Both timestamps must specify an explicit UTC offset')
    duration=int(system['clock']['duration_minutes'])*60
    incident_s=(incident-start).total_seconds()
    if duration < 600 or not (0 <= incident_s < duration):
        raise ValueError('incident must be within a simulation >=10 minutes')
    for fault in case['faults']:
        kind=fault['type']
        if kind not in SUPPORTED_FAULTS:
            raise ValueError(f'Unsupported fault type: {kind}')
        if kind in {'filter_override','position_offset'} and not (fault['start_offset_s'] < fault['end_offset_s']):
            raise ValueError('fault start must precede its end')
        if kind=='filter_override' and not (0 <= fault['threshold'] <= 1):
            raise ValueError('confidence threshold must lie in [0,1]')
        if kind=='notification_outage':
            if not (fault['start_offset_s'] < fault['restore_offset_s'] < fault['delivery_offset_s']):
                raise ValueError('outage/recovery/delivery ordering invalid')
    for target in case.get('special_targets',[]):
        if target['entry_offset_s'] >= target['exit_offset_s']:
            raise ValueError('target entry must precede exit')
    excluded=set(case['export'].get('omit_columns',[]))
    if excluded.intersection({'capture_time_utc','message_type','message_id'}):
        raise ValueError('Cannot exclude core sniffer columns')
    if not excluded.issubset(set(COLUMNS)):
        raise ValueError('Unknown excluded CSV columns')
    return start, incident_s, duration

def run_case(system, case, output):
    base, incident, duration = validate_config(system,case)
    case_id = case['id']
    fixture_id = case.get('fixture_id',case_id)
    if '/' in fixture_id or '\\' in fixture_id or fixture_id in ('.','..'):
        raise ValueError('fixture_id must be a simple directory name')
    seed=int(system['default_seed'])+int(case.get('seed_offset',0))
    rng=random.Random(seed)
    sensor=system['sensor']; background=system['background']; position=system['position']
    filter_cfg=system['filter']; capture=system['capture']
    period=int(sensor['scan_period_s']); logs={key:[] for key in LOG_FILES}
    events=[]; seq=0
    clockms=system['producer_clock_offset_ms']
    raw=output/'fixtures'/fixture_id/'raw'
    raw.mkdir(parents=True,exist_ok=True)
    internal=output/'internal_history'; internal.mkdir(parents=True,exist_ok=True)
    truth=output/'private_ground_truth'/fixture_id; truth.mkdir(parents=True,exist_ok=True)

    def emit(s,kind,producer,**kwargs):
        nonlocal seq
        if s<0 or s>=duration: return
        seq+=1
        actual=base+timedelta(seconds=s)
        recv=actual+timedelta(milliseconds=rng.randint(capture['min_recorder_jitter_ms'],capture['max_recorder_jitter_ms']))
        producer_dt=actual+timedelta(milliseconds=clockms.get(producer,0))
        msg={key:'' for key in COLUMNS}
        msg.update(capture_time_utc=to_utc(recv),producer_time_utc=to_utc(producer_dt),
                   bus_sequence=seq,message_id=f'MSG-{seq:08d}',message_type=kind,producer=producer)
        msg.update({k:v for k,v in kwargs.items() if k in COLUMNS})
        events.append(msg)

    def log(file,s,level,text):
        if s<0 or s>=duration: return
        t=base+timedelta(seconds=s)
        if file=='sensor.txt':
            dt=(t+timedelta(milliseconds=clockms['radar-psr-01'])).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            entry=f'{dt} {base.strftime("%z")} [{level}] SENSOR-R01 | {text}'
        elif file=='tracking_service.txt':
            dt=to_utc(t+timedelta(milliseconds=clockms['track-core']))
            entry=f'{dt} {level:<5} track-core: {text}'
        elif file=='ui_gateway.txt':
            entry=f'{t.strftime("%d/%m/%Y %H:%M:%S")} {level} ui-gateway [local {base.strftime("%z")}] {text}'
        elif file=='external_position_adapter.txt':
            entry=f'[{t.isoformat(timespec="milliseconds")}] {level} position-bridge {text}'
        elif file=='notification_service.txt':
            entry=json.dumps({'timestamp':to_utc(t+timedelta(milliseconds=clockms['alert-router'])),
                'level':level,'service':'alert-router','message':text},ensure_ascii=False)
        else:
            raise ValueError('unknown log producer')
        logs[file].append((t,entry))

    for file,text in (
        ('sensor.txt',f'radar head online scan_period_s={period}.0 self_test=PASS'),
        ('tracking_service.txt',f'pipeline ready mode=scan_association confirmation={sensor["confirmation_hits"]}_consecutive'),
        ('ui_gateway.txt','upstream stream connected initial_subscriptions=3'),
        ('external_position_adapter.txt',f'source GPS/ext reference aligned; profile={filter_cfg["baseline_revision"]}'),
        ('notification_service.txt','worker ready delivery_channel=operator-console')):
        log(file,0,'INFO',text)
    emit(0,'SensorHealth','radar-psr-01',sensor_id=sensor['id'],details=f'ONLINE;scan_period_s={period}')
    emit(0,'FilterConfigApplied','track-core',filter_revision=filter_cfg['baseline_revision'],
         threshold=filter_cfg['baseline_threshold'],details=f'scope={filter_cfg["scope"]}')

    for sec in background['benign_ui_warning_offsets_s']:
        log('ui_gateway.txt',sec,'WARN',f'metrics exporter scrape slow lag_ms={rng.randint(130,350)}')
    for sec in background['benign_sensor_warning_offsets_s']:
        log('sensor.txt',sec,'WARN',f'noncritical thermal compensation cycle period_ms={rng.randint(75,160)}')

    # Fault injectors schedule independently observable events and log records.
    # The case configuration selects when each injector is active; no case-name checks.
    for fault in case['faults']:
        kind=fault['type']
        start=incident+fault['start_offset_s']
        if kind=='filter_override':
            end=incident+fault['end_offset_s']
            emit(start,'FilterConfigApplied','track-core',filter_revision=fault['revision'],threshold=fault['threshold'],
                 details=f'scope={filter_cfg["scope"]};requested_by=config-manager')
            log('tracking_service.txt',start-1,'INFO',f'config push accepted from config-manager deployment_batch={fault.get("deployment_batch","unknown")}')
            log('tracking_service.txt',start,'INFO',f'policy registry refreshed scope={filter_cfg["scope"]} active_revision={fault["revision"]}')
            emit(end,'FilterConfigApplied','track-core',filter_revision=filter_cfg['baseline_revision'],
                 threshold=filter_cfg['baseline_threshold'],details=f'scope={filter_cfg["scope"]};requested_by=config-manager')
            log('tracking_service.txt',end,'INFO',f'policy registry refreshed scope={filter_cfg["scope"]} active_revision={filter_cfg["baseline_revision"]}')
        elif kind=='position_offset':
            log('external_position_adapter.txt',start-7,'INFO',f'profile revision {fault["revision_on"]} loaded checksum=9c82 cache_generation=7')
            log('external_position_adapter.txt',incident+fault['end_offset_s'],'INFO',f'profile revision {fault["revision_off"]} loaded checksum=21fa cache_generation=8')
            for shift in fault.get('warning_offsets_s',[]):
                s=incident+shift
                log('external_position_adapter.txt',s,'WARN',f'position innovation statistic elevated sample_batch={int(s/2)} source=external')
        elif kind=='notification_outage':
            recovery=incident+fault['restore_offset_s']
            target=fault['alert_target_id']; alert=fault['alert_id']; code=fault['transponder_code']
            emit(start,'DispatcherState','alert-router',delivery_state='DEGRADED',details='transport connection retrying')
            log('notification_service.txt',start,'WARN','operator-console transport reconnecting')
            emit(recovery,'DispatcherState','alert-router',delivery_state='ONLINE',details='transport reestablished')
            log('notification_service.txt',recovery,'INFO','operator-console transport session active')
            emit(incident+fault['rule_offset_s'],'AlertRuleMatch','alert-router',target_id=target,alert_id=alert,
                 transponder_mode3a=code,details='rule=IFF_PRIORITY_CODE')
            emit(incident+fault['request_offset_s'],'NotificationRequest','alert-router',target_id=target,
                 alert_id=alert,delivery_state='QUEUED',details='destination=operator-console')
            emit(incident+fault['delivery_offset_s'],'NotificationDelivered','alert-router',target_id=target,
                 alert_id=alert,delivery_state='DELIVERED',details='destination=operator-console')
            log('notification_service.txt',incident+fault['request_offset_s'],'INFO',f'request accepted alert={alert} destination=operator-console')
            for off in fault.get('retry_offsets_s',[]):
                log('notification_service.txt',incident+off,'WARN',f'delivery retry deferred alert={alert} reason=transport_unavailable')
            log('notification_service.txt',incident+fault['delivery_offset_s'],'INFO',f'delivery ack received alert={alert}')
            log('tracking_service.txt',incident+fault['rule_offset_s'],'INFO',f'IFF classification update target={target} new_code={code}')

    def filter_at(s):
        state=filter_cfg['baseline_revision'], filter_cfg['baseline_threshold']
        for f in case['faults']:
            if f['type']=='filter_override' and incident+f['start_offset_s']<=s<incident+f['end_offset_s']:
                state=(f['revision'],f['threshold'])
        return state

    def position_offset_at(s):
        dlat=dlon=0
        for f in case['faults']:
            if f['type']=='position_offset' and incident+f['start_offset_s']<=s<incident+f['end_offset_s']:
                dlat+=f['delta_lat']; dlon+=f['delta_lon']
        return dlat,dlon

    def notification_backlog_at(s):
        return sum(1 for f in case['faults'] if f['type']=='notification_outage' and
                   incident+f['request_offset_s']<=s<incident+f['delivery_offset_s'])

    all_targets={t['id']:dict(t) for t in background['targets']}
    for spec in case.get('special_targets',[]):
        obj=dict(spec)
        obj['entry_s']=incident+obj.pop('entry_offset_s')
        obj['exit_s']=incident+obj.pop('exit_offset_s')
        all_targets[obj['id']]=obj
    state={}
    counts=Counter()
    arrivals=background['arrival']
    for s in range(duration):
        if s%period==0:
            scan=s//period
            emit(s+.01,'RadarScan','radar-psr-01',sensor_id=sensor['id'],details=f'scan={scan};period_s={period}')
            live=list(all_targets.values())
            if s>=arrivals['first_after_s']:
                # bounded enumeration of recently arrived persistent background traffic
                last=(s-arrivals['first_after_s'])//arrivals['every_s']
                earliest=max(0,last-(arrivals['lifetime_s']+4*arrivals['lifetime_variation_s'])//arrivals['every_s']-2)
                for k in range(earliest,last+1):
                    arrived=arrivals['first_after_s']+k*arrivals['every_s']
                    exit_s=arrived+arrivals['lifetime_s']+(k%4)*arrivals['lifetime_variation_s']
                    if arrived<=s<=exit_s:
                        live.append({'id':f'T-{2000+k:04d}','x':-35+(k*13)%70,'y':-28+(k*19)%56,
                          'vx':(-1 if k%4==0 else 1)*(22+(k*9)%32),
                          'vy':(-1 if k%3==1 else 1)*(16+(k*7)%24),'entry_s':arrived,'exit_s':exit_s})
            observed=set()
            revision, threshold=filter_at(s)
            for target in live:
                entry=target.get('entry_s',target.get('entry',0))
                end=target.get('exit_s',target.get('exit',10000000))
                if not entry<=s<=end: continue
                tid=target['id']; elapsed=s-entry
                x=target['x']+target['vx']*elapsed/1000+0.30*math.sin(elapsed/240)
                y=target['y']+target['vy']*elapsed/1000+0.18*math.cos(elapsed/340)
                if math.hypot(x,y)>sensor['max_range_km']: continue
                observed.add(tid)
                st=state.setdefault(tid,{'hits':0,'misses':0,'confirmed':False})
                confidence=max(.03,min(.99,rng.gauss(target.get('confidence_mean',sensor['routine_confidence_mean']),
                                           target.get('confidence_stddev',sensor['routine_confidence_stddev']))))
                if not target.get('immune_to_random_dips',False) and rng.random()<sensor['occasional_low_confidence_probability']:
                    confidence=max(.32,confidence-sensor['occasional_confidence_loss'])
                xm=x+rng.gauss(0,sensor['measurement_stddev_km'])
                ym=y+rng.gauss(0,sensor['measurement_stddev_km'])
                emit(s+.10,'DetectionCandidate','radar-psr-01',target_id=tid,sensor_id=sensor['id'],
                     confidence=round(confidence,3),range_km=round(math.hypot(xm,ym),3),
                     bearing_deg=round(math.degrees(math.atan2(xm,ym))%360,2),
                     details=f'scan={scan};return_class=PSR')
                counts['candidate']+=1
                if confidence>=threshold:
                    st['hits']+=1; st['misses']=0
                    if st['hits']>=sensor['confirmation_hits']:
                        st['confirmed']=True
                    if st['confirmed']:
                        track='TRK-'+tid.removeprefix('T-')
                        emit(s+.23,'TrackUpdate','track-core',target_id=tid,track_id=track,
                            x_km=round(xm,3),y_km=round(ym,3),track_state='CONFIRMED',filter_revision=revision)
                        emit(s+.40,'UiTrackPublished','ui-gateway',target_id=tid,track_id=track,
                            track_state='VISIBLE',details='subscriber=display-primary')
                        counts['track']+=1
                else:
                    counts['gated']+=1; st['hits']=0;st['misses']+=1
                    if st['confirmed'] and st['misses']>=sensor['termination_misses']:
                        track='TRK-'+tid.removeprefix('T-')
                        emit(s+.25,'TrackTerminated','track-core',target_id=tid,track_id=track,
                             track_state='TERMINATED',details='reason=association_timeout')
                        emit(s+.41,'UiTrackRemoved','ui-gateway',target_id=tid,track_id=track,
                             details='reason=track_terminated')
                        st['confirmed']=False
                if target.get('iff_code') and (incident+target.get('iff_emit_start_offset_s',0) <=s<incident+target.get('iff_emit_end_offset_s',0)):
                    emit(s+.14,'IFFReply','iff-receiver',target_id=tid,
                         transponder_mode3a=target['iff_code'],details=f'scan={scan};validated=1')
            if rng.random()<sensor['clutter_probability_per_scan']:
                emit(s+.13,'DetectionCandidate','radar-psr-01',sensor_id=sensor['id'],
                     confidence=round(rng.uniform(*sensor['clutter_confidence_range']),3),
                     range_km=round(rng.uniform(5,95),3),bearing_deg=round(rng.uniform(0,360),2),
                     details=f'scan={scan};return_class=PSR;unassociated=1')
                counts['candidate']+=1;counts['gated']+=1
            for tid,st in state.items():
                if tid not in observed and st['confirmed']:
                    st['misses']+=1
                    if st['misses']>=sensor['termination_misses']:
                        track='TRK-'+tid.removeprefix('T-')
                        emit(s+.25,'TrackTerminated','track-core',target_id=tid,track_id=track,
                             track_state='TERMINATED',details='reason=out_of_coverage_or_timeout')
                        emit(s+.41,'UiTrackRemoved','ui-gateway',target_id=tid,track_id=track,details='reason=track_terminated')
                        st['confirmed']=False;st['hits']=0
            if s%background['health_interval_s']==0:
                emit(s+.03,'SensorHealth','radar-psr-01',sensor_id=sensor['id'],
                    details=f'ONLINE;sync=LOCKED;temperature_c={rng.randint(36,43)}')
                log('sensor.txt',s+1,'INFO',f'scan={scan} receiver=ACTIVE sync=LOCKED queue_depth={rng.randint(0,3)}')
        if s%background['routine_iff_interval_s']==0:
            available=sorted(t for t in observed if not all_targets.get(t,{}).get('iff_code'))
            if available:
                tid=available[(s//background['routine_iff_interval_s'])%len(available)]
                code=background['routine_iff_codes'][(s//background['routine_iff_interval_s'])%len(background['routine_iff_codes'])]
                emit(s+.28,'IFFReply','iff-receiver',target_id=tid,transponder_mode3a=code,details='validated=1;routine')
        if s%position['interval_s']==0:
            lat=position['base_lat'];lon=position['base_lon']
            delta_lat,delta_lon=position_offset_at(s)
            emit(s+.36,'PositionReport','position-bridge',
                 site_gps_lat=round(lat+rng.gauss(0,position['gps_noise_lat_stddev']),7),
                 site_gps_lon=round(lon+rng.gauss(0,position['gps_noise_lon_stddev']),7),
                 site_manual_lat=lat,site_manual_lon=lon,
                 site_external_lat=round(lat+delta_lat+rng.gauss(0,position['external_noise_lat_stddev']),7),
                 site_external_lon=round(lon+delta_lon+rng.gauss(0,position['external_noise_lon_stddev']),7),
                 position_quality='VALID',details='frame=WGS84;site=SIM-01')
        if s%background['log_interval_s']==0:
            log('tracking_service.txt',s+1,'INFO',f'minute_tick active_tracks={sum(v["confirmed"] for v in state.values())} assoc_lag_ms={rng.randint(14,46)}')
            log('ui_gateway.txt',s+2,'INFO',f'upstream healthy ws_subscribers={rng.randint(2,5)} broadcast_lag_ms={rng.randint(20,120)}')
            log('external_position_adapter.txt',s+1,'INFO',f'source polls_ok={rng.randint(29,30)}/30 fix=3D external_quality=VALID')
            log('notification_service.txt',s+2,'INFO',f'heartbeat worker_alive=true backlog={notification_backlog_at(s)}')
            if s and s%(2*background['log_interval_s'])==0:
                log('tracking_service.txt',s+3,'DEBUG',f'window_samples={counts["candidate"]} tracks_published={counts["track"]} candidates_gated={counts["gated"]}')
                counts.clear()

    # Diary is generated as a partially informed *human* report, not internal truth.
    diary=[]
    diary_cfg=system['diary']
    for idx, item in enumerate(diary_cfg['ordinary_entries'],1):
        report=incident+item['reported_offset_s']; written=incident+item['recorded_offset_s']
        if 0<=report<duration and 0<=written<duration:
            diary.append({'entry_id':f'D-{idx:03d}',
              'reported_local_time':local(base+timedelta(seconds=report)),
              'logged_local_time':local(base+timedelta(seconds=written)),
              'reported_precision':item['precision'],'observer':diary_cfg['observer_regular'],'note_he':item['note']})
    note=case['diary_incident_note'].replace('{incident_time}',(base+timedelta(seconds=incident)).strftime('%H:%M'))
    written=min(incident+diary_cfg['incident_record_delay_s'],duration-1)
    diary.append({'entry_id':'D-099','reported_local_time':local(base+timedelta(seconds=incident)),
          'logged_local_time':local(base+timedelta(seconds=written)),
          'reported_precision':'בערך ±2 דקות','observer':diary_cfg['observer_incident'],'note_he':note})
    diary.sort(key=lambda x:x['logged_local_time'])

    # Re-sequence in capture order, after inserting scheduled future fault messages.
    events.sort(key=lambda x:x['capture_time_utc'])
    for index,obj in enumerate(events,1):
        obj['bus_sequence']=index
        obj['message_id']=f'MSG-{index:08d}'
    exclusions=set(case['export'].get('exclude_message_types',[]))
    target_select=set(case['export'].get('target_ids',[]))
    selected_types=sorted(set(x['message_type'] for x in events)-exclusions)
    selected_columns=[c for c in COLUMNS if c not in case['export'].get('omit_columns',[])]
    selected=[e for e in events if e['message_type'] in selected_types and
              (not target_select or e['target_id'] in target_select)]
    with (raw/'sniffer.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=selected_columns,extrasaction='ignore');writer.writeheader();writer.writerows(selected)
    for file,lines in logs.items():
        (raw/file).write_text(''.join(x+'\n' for _,x in sorted(lines,key=lambda x:x[0])),encoding='utf-8')
    # Prevent stale Excel output after a config edit; export_diaries.py recreates it.
    (raw/'operator_diary.xlsx').unlink(missing_ok=True)
    with (raw/'operator_diary.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['entry_id','reported_local_time','logged_local_time','reported_precision','observer','note_he'])
        writer.writeheader();writer.writerows(diary)
    with (internal/f'{fixture_id}.jsonl').open('w',encoding='utf-8') as f:
        for e in events: f.write(json.dumps(e,ensure_ascii=False,separators=(',',':'))+'\n')

    start_utc=to_utc(base);end_utc=to_utc(base+timedelta(seconds=duration))
    manifest={
      'version':'0.2','investigation_id':fixture_id,'synthetic':True,
      'source_clock':f'Local offset in source TXT/diary: {base.strftime("%z")}',
      'sniffer_capture_timezone':'UTC','window_local':{'start':local(base),'end':local(base+timedelta(seconds=duration))},
      'window_utc':{'start':start_utc,'end':end_utc},
      'logged_time_metadata':{
        'sensor.txt':'producer local time with explicit offset',
        'tracking_service.txt':'UTC','ui_gateway.txt':'local time, second precision with offset label',
        'external_position_adapter.txt':'local ISO with explicit offset',
        'notification_service.txt':'UTC JSON lines',
        'operator_diary.csv':'reported/written local time with explicit offset'},
      'capture_point':capture['capture_point'],
      'export_selection':{'message_types':selected_types,
                          'excluded_message_types':sorted(exclusions),'target_filter':sorted(target_select) or 'ALL',
                          'columns':selected_columns,'time_filter_utc':[start_utc,end_utc]},
      'known_recorder_drops':0,'capture_completeness':'complete_for_selected_types_and_targets_only',
      'generated_bus_messages_all_types':len(events),
      'exported_sniffer_rows':len(selected),
      'exported_count_by_type':dict(Counter(x['message_type'] for x in selected)),
      'log_line_counts':{f:len(lines) for f,lines in logs.items()},'diary_row_count':len(diary),
      'file_sha256':{p.name:sha(p) for p in sorted(raw.iterdir()) if p.is_file()},
      'coordinate_reference':'WGS84 site lat/lon; track x/y in local km, not interchangeable',
      'rates_are_fictional':'User-editable in config/system.json, not ASTERIX wire format'}
    path=raw.parent/'capture_manifest.json'
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    truth_json={
      'case':case_id,'investigation_id':fixture_id,'hidden_from_TRACE':True,'incident_time_local':local(base+timedelta(seconds=incident)),
      'faults':case['faults'],'special_targets':case.get('special_targets',[]),
      'expected_investigation':case['private_expected'],
      'expected_evidence':{'source_message_ids':{},'full_bus_length':len(events)},
      'seed':seed,'duration_minutes':duration//60}
    (truth/'ground_truth.json').write_text(json.dumps(truth_json,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return len(events),len(selected),len(diary)

def main():
    parser=argparse.ArgumentParser(description='Generate synthetic TRACE raw investigations from scenario JSON')
    parser.add_argument('--system',type=Path,default=ROOT/'config'/'system.json')
    group=parser.add_mutually_exclusive_group()
    group.add_argument('--scenario',type=Path,help='single custom scenario JSON path')
    group.add_argument('--all',action='store_true',help='generate all config/scenarios/*.json (default)')
    parser.add_argument('--output',type=Path,default=ROOT)
    args=parser.parse_args()
    system=read_json(args.system)
    files=[args.scenario] if args.scenario else sorted((ROOT/'config'/'scenarios').glob('*.json'))
    if not files: parser.error('No scenario files found')
    for path in files:
        case=read_json(path)
        generated,selected,diary=run_case(system,case,args.output)
        print(f'{case["id"]}: {generated:,} internal bus messages / {selected:,} exported CSV rows / {diary} diary entries')

if __name__=='__main__': main()
