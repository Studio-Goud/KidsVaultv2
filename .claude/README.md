# Claude Code Game Studios, in Bramblewood

The skills, agents and rules in this folder come from
https://github.com/Donchitos/Claude-Code-Game-Studios (MIT), installed on
20 September 2026.

What was taken: `skills/` (73), `agents/` (49) and `rules/` (11).

What was left out on purpose: `hooks/`, `settings.json` and `statusline.sh`.
Those run shell commands of their own accord on session events, and nothing in
this project needs them; leaving them out keeps the repository's own tooling
the only thing that runs automatically. They can be fetched from the upstream
repository if they are ever wanted.

Most of these skills assume a studio workflow with design documents under
`design/` and a game engine project. Bramblewood has neither, so the ones that
carry their weight here are the review skills - `ux-review`, `design-review`,
`code-review`, `playtest-report`, `smoke-check`, `perf-profile` - used as
checklists rather than as document pipelines.
