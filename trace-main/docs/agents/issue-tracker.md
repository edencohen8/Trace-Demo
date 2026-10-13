# Issue tracker: GitLab

Issues and specs for this repo live as GitLab issues on the ELTA GitLab server. Use the [`glab`](https://gitlab.com/gitlab-org/cli) CLI for all operations.

## Remote & Repo

- **Host**: `https://gitlab.gcp.elta.co.il`
- **Project**: `gcp_projects/hackathon/hack-team-1/hack-team-1-repo`

## Conventions

- **Create an issue / spec**: `glab issue create --title "..." --description "..." --label "..."`
- **Read an issue & comments**: `glab issue view <iid> --comments`
- **List issues**: `glab issue list` or `glab issue list -O json` with appropriate `--label` filters.
- **Comment / progress note**: `glab issue note <iid> --message "..."`
- **Link blocking issues**: In a note or description, use GitLab quick action `/blocked_by #<blocker>` or `/blocks #<target>`.
- **Claim ticket**: `glab issue update <iid> --assignee @me`
- **Close ticket**: Post summary note `glab issue note <iid> -m "..."`, then `glab issue close <iid>`

## Real-time Team Communication Protocol

When any developer's agent alters a spec, establishes or modifies an interface contract, hits a blocker, or changes direction:

### 1. Inter-Lane Contract Decisions & Updates
When working on Lane X and making a decision affecting Lane Y (e.g. Parquet schemas, Postgres tables, tool signatures, event models, or locators):
1. **Commit / update the centralized contract specification** under `docs/contracts/<contract-name>.md` and update [`docs/contracts/README.md`](../contracts/README.md).
2. **Immediately post a structured update note on every affected lane's GitLab issue**:
   ```bash
   glab issue note <affected_iid> -m "📢 [CONTRACT UPDATE from Lane <X> (#<source_iid>)] <Contract Title>

   • Contract Spec: docs/contracts/<file>.md
   • Status: [PROPOSED | AGREED | MODIFIED | BREAKING]
   • Affected Lanes: Lane Y (#<iid_y>), Lane Z (#<iid_z>)
   • Decision / Changes:
     <Concise summary of schemas, field names, parameter signatures, or units>
   • Action Required for Lane Y:
     <Specific guidance for the consuming agent>
   "
   ```
3. Post a reference note on Lane X's own issue for auditability.

### 2. General Blockers or Spec Changes
- Post immediately on the relevant ticket:
  `glab issue note <iid> -m "⚠️ [SPEC CHANGE / BLOCKER] ..."`
- If blocked by another lane's ticket:
  `glab issue note <iid> -m "/blocked_by #<other_iid>"`

### 3. Pre-Build Contract Sync Gate ("Look Before You Build")
Before an agent plans or implements core components on ANY ticket/subtask:
1. It **MUST** fetch latest comments: `glab issue view <iid> --comments`
2. It **MUST** inspect `docs/contracts/README.md` and relevant specs to verify that its implementation assumptions match the active contracts from upstream lanes. Never build against unverified or stale interface assumptions.
