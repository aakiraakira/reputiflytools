# /revise/ — Reputifly Revision Pack v3

Client-facing revision tools that produce **v3 revision packs** consumable by Claude Code agents
(via the agentic-JSON profile on each client's Archimedes WordPress plugin).

## URLs

- **Generator (staff)**: `https://reputifly.org/revise/generator.html` — staff-auth gated, generates per-client revision links
- **Editor (client)**: `https://reputifly.org/revise/editor.html?token={TOKEN}` — direct edits + comments
- **Test harness**: `https://reputifly.org/revise/pack-tests.html` — 40 unit tests for the pack pipeline

## v1 ACRP portal (comment-only)

Lives at `../foundry/revision-portal.html`. Refactored to emit the same v3 pack format.
References `./lib/*.js` via `../revise/lib/`.

## Pack schema

See `lib/pack-builder.js` + `lib/instructions-template.js` for the JSON shape that ships
inside each pack ZIP. The receiving Claude Code agent reads `INSTRUCTIONS.md` first
inside the ZIP and follows the 7-step workflow.

## Replaces

The legacy `/revision/` folder at the repo root is deprecated (notice banner injected).
