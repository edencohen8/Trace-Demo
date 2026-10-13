import { readConfig, providerStatus, safeError } from '../src/server/config.ts';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import { runChat } from '../src/server/chat.ts';

const config = await readConfig();
console.log(providerStatus(config));
try {
  const result = await runChat({ caseId: 'case_001', text: 'Open the attached sensor record. State the reported sensor status in one sentence with its source citation. Use English.', evidence: ['[sensor.txt:L1]'] },
    { caseId: 'case_001', messages: [], lessons: [] }, new EvidenceStore(), config, AbortSignal.timeout(90_000),
    (event) => { if (event.tool) console.log(`${event.type}: ${event.tool}`); });
  console.log(result.text);
  console.log(`Live AI check passed: ${result.model}; ${result.validation}`);
} catch (error) { console.error(safeError(error, config)); process.exitCode = 1; }
