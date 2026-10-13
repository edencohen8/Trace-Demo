from pathlib import Path
import json
r=Path(__file__).resolve().parent
for p in sorted((r/'fixtures').glob('case_*')):
 m=json.loads((p/'capture_manifest.json').read_text(encoding='utf-8'))
 t=m['window_local']
 txt=f'''# TRACE evidence package — {p.name}\n\nThis folder contains simulated raw data from a mostly working sensor system. It does not contain an answer key.\n\n## Files\n\n- `raw/sniffer.csv` — selected messages from the simulated bus (timestamps are UTC).\n- `raw/*.txt` — component logs (each system has its own log style).\n- `raw/operator_diary.xlsx` — operator notes, with approximate local times.\n- `capture_manifest.json` — a description of the exported fields, message types and clocks.\n\n## Time window\n\n- Local start: `{t['start']}`\n- Local end: `{t['end']}`\n- Exported sniffer records: `{m['exported_sniffer_rows']:,}`\n\nThe sniffer may be filtered. Read the manifest before you claim that a message did not occur. Do not upload private answer keys or simulator histories to TRACE.\n'''
 (p/'README.md').write_text(txt,encoding='utf-8')
