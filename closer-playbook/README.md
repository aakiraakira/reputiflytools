# Closer playbook

Live: https://reputifly.org/closer-playbook/

## Approved release: 20260909-1

The September 9 release applies the reviewed sales-copy and routing changes,
including the final owner corrections. The local redline is historical review
material, not a dependency of this page.

- The sample is the first draft. Deposit starts polish, changes and revisions.
- Answer outstanding questions, then close. A clear yes does not need a second yes.
- Keep the original opener, building message and canonical price close.
- Included SEO is a one-time setup. Technical detail has its own answer.
- Standard e-commerce is a S$500 add-on to the S$590 website. A catalogue with
  contact buttons can come first. Check unusual requirements before confirming.
- Use `client-proposal` in Agent Operations for a requested quotation. Base it
  on the sample and include agreed additional page requirements.
- One follow-up ladder per stage. Explicit dates and stop requests take priority.
- Keep the normal Payment dates. One unpaid promised-day reminder can replace
  the first nudge, never add a duplicate or restart after every new promise.
- No fresh hosting concession after invoicing. Keep the gated pre-invoice offer.
- Standard email renewal is included in hosting. Own-hosting support boundaries
  and free existing-text/photo edits have separate answers.

## Search and links

`search.js` searches all node instructions and messages, including nodes not in
the sidebar. Common synonyms and one-character typos are supported. It is a
local text index, not an AI system. Enter opens the first result; Escape clears.

Script IDs such as `s21` are stable. Do not renumber them when removing scripts.
`#faq/s21` opens the SEO reply; `#price/do` opens the instruction panel. Existing
node links and legacy label-tag links remain supported.

Staff instructions can use `[[Google Meet booking|meet/s2]]`. The renderer makes
this a link opening the exact copy card in a new tab. Do not place that markup
in `scripts[].t`, which is the plain text copied to the client.

A script with `route` points to the existing canonical reply instead of copying
an empty message. New actual replies use the regular Copy button.

## Only pending sales asset

The Google + AI case-study PDF is supplied separately by the owner. Until then,
`price.attachments[0].url` is null and the attachment pitch is gated. Staff use
the ordinary value answer instead.

When the final approved PDF arrives: add its stable URL, remove the pending
instruction in `price.scripts` and this pending task, test the link, publish,
then mark it settled in shared business memory. Do not leave a recurring task
to produce a PDF that is already supplied.

## Validate and ship

Run `npm ci --prefix tests/frontend --ignore-scripts`, then
`npm test --prefix tests/frontend`. This includes rendering every playbook node,
links, search, copy actions and the final approved wording.

Bump `PB_BUILD`, `version.txt` and the CSS/JS query stamps together. Follow the
repository root `CLAUDE.md`: branch, PR, required `verify-source-and-build`,
merge, wait for GitHub Pages, verify live source/version. Never push to protected
main directly. Stage only intended files. Shared business memory is a separate
private repository and must be synced separately after verified publication.

Future chat-export-assisted reply suggestions are not implemented here. Any
future assistant must use this approved source, show the relevant answer/link,
suggest context-specific wording, and leave sending under staff control.
