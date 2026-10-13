#!/usr/bin/env python3
"""Build private human-readable investigation guides and machine-checkable scorecards.

Never copy the report folders to a TRACE upload or an investigator ZIP.
"""
import argparse
import csv
import json
from pathlib import Path
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parent

def readable(utc):
    return (datetime.fromisoformat(utc.replace('Z','+00:00'))+timedelta(hours=3)).strftime('%H:%M:%S') + ' Israel time'

def line(row):
    extra=[]
    for key in ('target_id','confidence','threshold','filter_revision','delivery_state','site_external_lat','site_external_lon'):
        if row.get(key):extra.append(f'{key}={row[key]}')
    return f"- `sniffer.csv`, message `{row['message_id']}`, {readable(row['capture_time_utc'])}: `{row['message_type']}`" + (f" ({', '.join(extra)})" if extra else '')

def build_case(case, root=ROOT):
    cid=case.get('fixture_id',case['id'])
    raw=root/'fixtures'/cid/'raw'
    path=root/'private_ground_truth'/cid
    path.mkdir(parents=True,exist_ok=True)
    with (raw/'sniffer.csv').open(encoding='utf-8',newline='') as f:
        rows=list(csv.DictReader(f))
    with (root/'internal_history'/f'{cid}.jsonl').open(encoding='utf-8') as f:
        complete=[json.loads(s) for s in f if s.strip()]
    def first(kind, target=None, all_data=False, check=None):
        seq=complete if all_data else rows
        return next((r for r in seq if r['message_type']==kind and (target is None or r['target_id']==target) and (check is None or check(r))),None)
    type0=case['faults'][0]['type']
    intro='All cases contain routine scans, target movement, background IFF traffic, health reports, logs and Hebrew diary notes. The system is mostly healthy.'
    logs=['sensor.txt: routine scans and sensor state','tracking_service.txt: processing and configuration','ui_gateway.txt: published tracks and normal gateway health','external_position_adapter.txt: reference source status','notification_service.txt: alert delivery and retries','operator_diary.xlsx: human notes; reported times are approximate']
    notes=[]; claims=[]; limits=[]; anchors=[]; query=[]
    if type0=='filter_override':
        fault=case['faults'][0]; target=case['special_targets'][0]['id']
        hidden=case['export']['exclude_message_types']
        title='Restricted sniffer export' if hidden else 'Missed radar detection'
        failure=f"The track processor changes its confidence threshold from 0.64 to {fault['threshold']:.2f} for a short period. The sensor still reports low-confidence observations for {target}, but no track is confirmed for this target."
        trace=first('DetectionCandidate',target)
        conf=first('FilterConfigApplied',check=lambda r:r.get('filter_revision')==fault['revision'])
        full_candidate=first('DetectionCandidate',target,all_data=True)
        if conf: anchors.append(line(conf))
        if trace: anchors.append(line(trace))
        if hidden:
            notes=['The sniffer export does not contain DetectionCandidate or FilterConfigApplied messages.', 'The original bus history does contain both messages; they were removed by the export filter.', 'The diary mentions an expected target that was not visible. This does not prove a filter failure.']
            claims=['State which message types are missing from the selected export.', 'Report that the available sniffer data alone cannot confirm the filtering cause.', 'Name the missing records that could resolve the uncertainty.']
            limits=['Do not claim that no detection occurred just because DetectionCandidate was not exported.', 'Do not give the hidden filter threshold as a proven fact unless independent uploaded evidence supports it.']
            if full_candidate:
                anchors.append(f"- **Private check only:** unfiltered message `{full_candidate['message_id']}` is a `DetectionCandidate` for {target}, but it is absent from `sniffer.csv`.")
        else:
            notes=[f'{target} appears in repeated sensor candidates, with confidence below the active filter threshold.', f'There is no confirmed TrackUpdate or UiTrackPublished for {target} while the fault is active.', 'The tracking-service log records a policy change shortly before the observation.', 'Ordinary targets continue to produce tracks; not all radar processing stops.']
            claims=['Find the active threshold and the target confidence values.', 'Confirm that the target has detections but no corresponding confirmed track.', 'Relate the missing downstream records to the short configuration interval.', 'Distinguish this from a radar power failure or a UI-only outage.']
            limits=['Do not say the radar never saw the target.', 'Do not infer a hardware malfunction without evidence.']
        query=['Search near the diary reported time.', 'Compare candidate counts and track updates for the target.', 'Inspect the active policy revision.', 'Check whether the sniffer export includes the relevant message types.']
    elif type0=='position_offset':
        title='External position jump'; fault=case['faults'][0]
        failure=f"The external reference position shifts for {fault['end_offset_s']-fault['start_offset_s']} seconds while manual and GPS references remain nearly stable. The simulation treats these as WGS84 site positions."
        before=first('PositionReport',check=lambda r:r['capture_time_utc'][11:19]=='11:02:58')
        during=first('PositionReport',check=lambda r:r['capture_time_utc'][11:19]=='11:03:00')
        after=first('PositionReport',check=lambda r:r['capture_time_utc'][11:19]=='11:04:32')
        for x in (before,during,after):
            if x: anchors.append(line(x))
        notes=['Compare all three position fields on the same record before and after the incident.', 'The external value jumps suddenly and later returns.', 'The independent GPS and manual references stay near their previous positions.', 'External-position service logs report an elevated innovation statistic and profile changes.']
        claims=['Calculate the distance between external, GPS and manual reference positions.', 'Identify the start and end of the jump.', 'Confirm that the data uses a common coordinate frame.', 'Conclude that the fault affected the external position reference, not all position sources.']
        limits=['Do not claim that every tracked target physically moved.', 'A profile change near the incident is evidence, but not proof of the exact internal software defect.']
        query=['Plot latitude and longitude for external, manual and GPS over time.', 'Check position adapter log warnings.', 'Find the interval where the external reference differs substantially.']
    else:
        title='Delayed IFF notification'; fault=case['faults'][0]
        failure=f"The simulator receives an IFF {fault['transponder_code']} reply, matches an alert rule, and queues a notification. The dispatcher transport is unavailable, and the delivery acknowledgement arrives {fault['delivery_offset_s']-fault['request_offset_s']} seconds after the request."
        for kind in ('DispatcherState','IFFReply','AlertRuleMatch','NotificationRequest','NotificationDelivered'):
            x=first(kind,'T-088' if kind != 'DispatcherState' else None)
            if x:anchors.append(line(x))
        notes=['T-088 has an IFF reply with code 7500.', 'A rule match and a notification request exist.', 'The dispatcher reports a degraded transport and later returns online.', f"The notification request and delivered event are {fault['delivery_offset_s']-fault['request_offset_s']} seconds apart.", 'The notification-service TXT log records retry attempts.']
        claims=['Separate IFF receipt, alert-rule match, request and delivery times.', 'Calculate the delay using actual event timestamps.', 'Explain why the delay aligns with degraded alert transport.', 'State that the track data alone does not prove an alert was delivered.']
        limits=['Do not say the IFF reply was missed.', 'Do not conflate message processing time with delivery time.']
        query=['Trace T-088 through IFFReply and AlertRuleMatch.', 'Join NotificationRequest and NotificationDelivered by alert_id.', 'Read the alert dispatcher health events and retry lines.']
    local=case['incident_local']
    evidence='\n'.join(anchors) if anchors else '- No decisive message is present in the selected export.'
    md=f'''# {title} — {cid}\n\n> **PRIVATE ANSWER KEY — DO NOT UPLOAD TO TRACE.** This is for the evaluation team, not for the investigating agent.\n\n## Scenario\n\n{intro}\n\n- **Incident reference:** `{local}` (Israel time, UTC+03:00 for this example)\n- **Case ID:** `{cid}`\n- **Input for TRACE:** `fixtures/{cid}/raw/` plus `fixtures/{cid}/capture_manifest.json` and `public_system_catalog.json`\n\n## What fails (private)\n\n{failure}\n\n## Which files to inspect\n\n''' + '\n'.join('- '+i for i in logs) + '''\n\n## Clues to look for\n\n''' + '\n'.join('- '+n for n in notes) + f'''\n\n## Example evidence locations\n\n{evidence}\n\nMessage IDs are examples from this generated run, not fixed requirements for future random seeds. Recompute evidence locations after regeneration.\n\n## Suggested investigation path (for human reviewers)\n\n''' + '\n'.join(f'{i+1}. {q}' for i,q in enumerate(query)) + '''\n\n## Expected final conclusion\n\n''' + ('**Evidence is not sufficient to prove the root cause from the selected sniffer export.** The simulator knows the filtering cause, but the investigator should describe the missing message types and any limits of available TXT logs instead of pretending to know the hidden configuration.' if type0=='filter_override' and case['export']['exclude_message_types'] else failure) + '''\n\n## Benchmark: pass conditions\n\n'''+'\n'.join(f'- [ ] {c}' for c in claims)+'''\n\n## Benchmark: claims to reject\n\n'''+'\n'.join(f'- [ ] {x}' for x in limits)+'''\n\n## Evidence policy\n\nAny factual conclusion must point to an original raw file row or log line. Absence from a filtered export is **not** proof that an event did not happen. An evaluation result must distinguish what the simulator knows from what the uploaded files prove.\n'''
    (path/'SCENARIO.md').write_text(md,encoding='utf-8')
    gt_file=path/'ground_truth.json'
    gt=json.loads(gt_file.read_text(encoding='utf-8')) if gt_file.exists() else {}
    gt['benchmark']={'required_findings':claims,'forbidden_claims':limits,'example_sniffer_evidence_ids':[a.split('`')[3] for a in anchors if a.startswith('- `sniffer.csv`')], 'requires_explicit_uncertainty': bool(type0=='filter_override' and case['export']['exclude_message_types'])}
    gt_file.write_text(json.dumps(gt,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Wrote private report {cid}')

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',type=Path,default=ROOT)
    p.add_argument('--scenario',type=Path)
    a=p.parse_args()
    files=[a.scenario] if a.scenario else sorted((ROOT/'config'/'scenarios').glob('*.json'))
    for path in files:build_case(json.loads(path.read_text(encoding='utf-8')),a.output)
if __name__=='__main__':main()
