# Matt Pocock skills

27 published engineering and productivity skills from [mattpocock/skills](https://github.com/mattpocock/skills), installed locally for TRACE under `.agents/skills/`.

Source commit: `b0618bc436ad893b3c5e84e55fba86586d34a404`.
Installed: 2026-10-08. Upstream files are unchanged, including supporting templates, scripts, and Codex metadata in `agents/openai.yaml`. The upstream MIT license is in `LICENSE.mattpocock`.

The upstream `skills/engineering/` and `skills/productivity/` directories are flattened here so each skill is directly discoverable by its name. Experimental and miscellaneous skills are not included.

## Use

Skills are available on the next turn. Invoke a skill by name, for example `$ask-matt`, `$grill-me`, or `$tdd`.

Before using the engineering workflows for the first time, invoke `$setup-matt-pocock-skills` to choose this project's issue tracker, triage labels, and document locations. This installation does not set those preferences.

## Installed skills

- [ask-matt](ask-matt/SKILL.md)
- [codebase-design](codebase-design/SKILL.md)
- [code-review](code-review/SKILL.md)
- [diagnosing-bugs](diagnosing-bugs/SKILL.md)
- [domain-modeling](domain-modeling/SKILL.md)
- [grilling](grilling/SKILL.md)
- [grill-me](grill-me/SKILL.md)
- [grill-with-docs](grill-with-docs/SKILL.md)
- [handoff](handoff/SKILL.md)
- [implement](implement/SKILL.md)
- [implement-spec](implement-spec/SKILL.md)
- [improve-codebase-architecture](improve-codebase-architecture/SKILL.md)
- [pr](pr/SKILL.md)
- [prototype](prototype/SKILL.md)
- [research](research/SKILL.md)
- [retro](retro/SKILL.md)
- [setup-matt-pocock-skills](setup-matt-pocock-skills/SKILL.md)
- [tdd](tdd/SKILL.md)
- [teach](teach/SKILL.md)
- [to-questionnaire](to-questionnaire/SKILL.md)
- [to-spec](to-spec/SKILL.md)
- [to-tickets](to-tickets/SKILL.md)
- [triage](triage/SKILL.md)
- [wait-what](wait-what/SKILL.md)
- [wayfinder](wayfinder/SKILL.md)
- [wizard](wizard/SKILL.md)
- [writing-for-agents](writing-for-agents/SKILL.md)

## Local workflow

- [issue-workflow](issue-workflow/SKILL.md): Work one selected issue through our existing task structure, executing a full workflow (grilling, planning, implementation, testing) for every subtask, followed by three-axis review and lightweight QA.

Invoke `$issue-workflow` with an issue ID, URL, local ticket, or inline description. Each run completes only that issue; unrelated work becomes follow-up candidates. This locally authored skill composes the installed disciplines; the 27 upstream skills remain unchanged.

## Apple design

- [apple-design](apple-design/SKILL.md): Apple-style app/web interfaces, HIG and Liquid Glass guidance, component and interaction patterns, and web/Figma implementation references. Invoke `$apple-design` for Apple-style UI design or review.

Source: [SudewaJay/apple-design-skill](https://github.com/SudewaJay/apple-design-skill), commit `57bfab7daf8766a9a45cfc405790e749c71eda30`, installed 2026-10-08. The design instructions and six references are preserved; frontmatter was corrected and narrowed to Apple-design requests for valid Codex discovery, and `agents/openai.yaml` was added. The upstream MIT license is included in `apple-design/LICENSE`.
