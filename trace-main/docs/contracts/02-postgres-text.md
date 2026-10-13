# CTR-02: PostgreSQL Event Store & Hybrid Search Interface

- **Contract ID:** `CTR-02`
- **Producing Lane:** Lane 2 (Text & Postgres, Issue #3)
- **Consuming Lanes:** Lane 4 (Tools & Evidence, Issue #4), Lane 3 (Agent Harness, Issue #5)
- **Status:** `AGREED`
- **Last Updated:** 2026-10-13

## 1. PostgreSQL Schema: `text_events`

Component TXT logs and operator diary entries are stored in table `text_events`:

```sql
CREATE TABLE IF NOT EXISTS text_events (
    id BIGSERIAL PRIMARY KEY,
    investigation_id VARCHAR(64) NOT NULL,
    source_family VARCHAR(32) NOT NULL, -- 'component_log' | 'operator_diary'
    source_file VARCHAR(128) NOT NULL,
    source_line INT NOT NULL,
    source_system VARCHAR(64), -- e.g. 'external_position_adapter'
    timestamp_utc TIMESTAMPTZ,
    reported_time_utc TIMESTAMPTZ, -- for diary entries with delayed record time
    severity VARCHAR(16), -- 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'
    raw_text TEXT NOT NULL,
    cleaned_text TEXT,
    embedding vector(768), -- pgvector embeddings
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_text_events_investigation ON text_events(investigation_id);
CREATE INDEX idx_text_events_time ON text_events(investigation_id, timestamp_utc);
CREATE INDEX idx_text_events_system ON text_events(investigation_id, source_system);
CREATE INDEX idx_text_events_embedding ON text_events USING hnsw (embedding vector_cosine_ops);
```

## 2. Hybrid Search Interface

Lane 2 exports a Python query function used by Lane 4's `search_text` tool:

```python
def search_text_events(
    investigation_id: str,
    query: str,
    source_system: str | None = None,
    severity: str | None = None,
    time_range: tuple[str, str] | None = None,
    limit: int = 20,
    hybrid_alpha: float = 0.5 # 0.0 = pure vector, 1.0 = pure keyword
) -> list[TextSearchResult]:
    ...
```

Return schema for each match:
```python
class TextSearchResult(BaseModel):
    id: int
    investigation_id: str
    source_file: str
    source_line: int
    source_system: str
    timestamp_utc: str | None
    severity: str | None
    text: str
    score: float
```
