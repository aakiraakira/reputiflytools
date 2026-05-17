/**
 * instructions-template.js — the INSTRUCTIONS.md content the receiving Claude Code
 * agent reads first when opening a revision pack.
 *
 * Exposed as window.RFLY_buildInstructionsMd(context) so both portals can call it.
 * `context` is the manifest object so we can interpolate site_url, etc.
 */
(function () {
    'use strict';

    function buildInstructionsMd(ctx) {
        ctx = ctx || {};
        const site = ctx.site_url || '(unknown site)';
        const token = ctx.token || '(no token)';
        const pageCount = (ctx.pages || []).length;
        const hasEditsCount = (ctx.pages || []).filter((p) => p.has_edits).length;
        const hasCommentsCount = (ctx.pages || []).filter((p) => p.has_comments).length;
        const sourcePortal = ctx.source_portal || 'unknown';

        return `# Revision Pack — Execution Instructions

You are Claude Code receiving a client revision pack for **${site}**.
You should have the agentic JSON profile for this site already in your context — it
gives you authenticated access to the client's WordPress install via the Archimedes
plugin endpoints (\`/deployments/{page_id}/rendered-html\`, \`/deployments/{page_id}/patch-file\`,
\`/media/bulk\`, \`/changelog/rollback\`, etc.). If you don't have it, stop and ask the operator.

## Pack metadata

- Token: \`${token}\`
- Source portal: \`${sourcePortal}\`  (\`v2-editor\` = direct edits + comments; \`v1-acrp\` = comments only)
- Pages in pack: ${pageCount}
- Pages with direct edits: ${hasEditsCount}
- Pages with comments: ${hasCommentsCount}

Read \`manifest.json\` next for the full page index.

## Workflow

### Step 1 — Verify drift
For each page in \`manifest.json.pages[]\`:
- Call \`GET {api_base}/deployments/{page_id}/rendered-html\`
- Normalize the response (DOMParser round-trip; strip GSAP inline styles, csrf meta/script, sort attrs)
- SHA-256 the normalized HTML, compare to \`pages[i].original_sha256\`
- If hashes match: proceed with \`exact\` match strategies
- If hashes differ: note the drift in your final report, attempt anyway,
  but expect more \`exact\` matches to fail. The \`selector+*\` and \`subtree-replace\`
  fallbacks should still succeed.

If \`page_id\` is null (e.g. v1 pack with no live URL), skip drift detection and trust
the pack's \`original.html\` as ground truth.

### Step 2 — Bulk-upload all images (once, up front)
- Read \`image_upload_plan.json.uploads[]\`
- Single round-trip: \`POST {api_base}/media/bulk\` with body \`{ urls: [<every firebase_url>] }\`
- Build map: \`sentinel → wp_url\` from the response.
- Cache this map for Step 3.

### Step 3 — Apply structured edits, per page
For each page where \`has_edits\` is \`true\`:
1. Read \`pages/{slug}/edits.json\`
2. For each operation in \`operations[]\` (already sorted top-to-bottom):
   a. Substitute every \`{{IMAGE_URL_*}}\` sentinel inside \`old_string\` / \`new_string\` /
      \`new_value\` / \`new_outerHTML\` using the map from Step 2.
   b. Try \`match_strategies\` IN ORDER (first success wins):
      - \`exact\`: feed \`old_string\` + \`new_string\` straight into the Edit tool.
        Recovers with the next strategy if Edit reports "string not found" or
        "string not unique".
      - \`selector+innerText\`: \`document.querySelector(selector)\`, verify
        \`expected_innerText_contains\` appears, replace innerText with \`new_innerText\`.
      - \`selector+attr\`: \`document.querySelector(selector)\`, verify current attr matches,
        set attr to \`new_value\`.
      - \`subtree-replace\`: \`document.querySelector(selector).outerHTML = new_outerHTML\`.
   c. If ALL strategies fail, log the op id + selector to a "manual review" list
      and continue. **Do not abort the whole pack.**

### Step 4 — Interpret comments, per page
For each page where \`has_comments\` is \`true\`:
1. Read \`pages/{slug}/comments.json\`
2. For each comment in \`comments[]\`:
   - Locate the target via \`anchor.selector\`, double-check with \`anchor.fallback_innerHTML_slice\`.
   - For \`scope: "page"\` → page-wide directive. Apply across all matching elements on the page.
   - For \`scope: "section"\` → bounded to that section. Don't touch elements outside.
   - For \`scope: "element"\` → targeted to one element only.
   - \`globalText\` is the client's free-text instruction for the section / page.
   - For each \`items[]\` entry:
     - \`itemType: "fix"\` → look at \`pages/{slug}/images/REF-*.webp\` (the path is in
       \`image_local_path\`). The **red annotations on the image are the PRIMARY
       instruction**, the comment text is supplementary context. If they conflict,
       follow the visual.
     - \`itemType: "asset"\` → the image IS the new asset. Upload it (it's already in
       the bulk upload from Step 2) and place it where the comment indicates.

Use your judgment — these are LLM-judgment tasks, not deterministic ops. If a
comment is ambiguous (typical: layout requests), produce your best implementation
and add a note to your final report.

### Step 5 — Patch + rebuild
For each page you modified (edits or comments):
\`POST {api_base}/deployments/{page_id}/patch-file\`
with body:
\`\`\`json
{ "path": "<file_path from page.json>", "content": "<full new HTML>", "rebuild_after": true }
\`\`\`

If you don't have a \`page_id\`, you'll need to call \`GET /pages\` first and string-match
by slug. (Future packs will include page_id directly.)

### Step 6 — Verify
For each modified page:
- Refetch \`/deployments/{page_id}/rendered-html\`
- For each \`edits.json\` op, confirm the expected change is **structurally present**
  at the expected selector. Examples:
  - text-replace: expected innerText is in the live element
  - image-swap: expected src host matches (the WP URL from Step 2)
  - attr-change: attribute has expected new value
- **DO NOT** SHA-compare full HTML — WP serves through PHP filters (wpautop,
  lazy-load injection, srcset) that mutate HTML in non-meaningful ways. Hash
  compare will always fail post-deploy.

### Step 7 — Rollback on critical failure
If verification fails critically (e.g. major op silently no-op'd):
\`POST {api_base}/changelog/rollback\`
to restore pre-edit state, then surface the failure to the operator.

## Fallback (when edits.json doesn't apply cleanly)

If too many ops fail on a page, switch to a self-diff approach:
1. Read \`pages/{slug}/original.html\` and \`pages/{slug}/edited.html\` (both pre-normalized).
2. Diff them yourself with your usual code-reading tools.
3. Apply the patches via Edit on the live page's HTML (which you have via
   \`GET /deployments/{page_id}/file?path=…\`).

The structured edits.json is an **optimisation**. The two HTML files are the
**ground truth**. Trust them if everything else fails.

## Comment images

- \`item.image_url\` is a public Firebase Storage URL — fetchable from anywhere
  without auth.
- \`item.image_local_path\` is the same image bundled inside the pack at
  \`pages/{slug}/images/{REF|ASSET}-N.webp\`.
- For FIX items: open the image and read the red annotations. Those are the
  PRIMARY instruction.
- For ASSET items: the image IS the asset to embed.

## Output requirements

After all pages are processed, produce a final report containing:
1. Per-page summary: \`{ slug, edits_applied, edits_failed, comments_interpreted, comments_flagged_for_review }\`
2. Any drift warnings from Step 1
3. Any verification failures from Step 6
4. Rollback status, if invoked
5. List of items requiring human review (op id + selector + reason)

Hand the report back to the operator. Do not auto-mark the revision as complete
without human sign-off if any items are flagged.
`;
    }

    window.RFLY_buildInstructionsMd = buildInstructionsMd;
})();
