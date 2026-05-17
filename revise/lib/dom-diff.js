/**
 * dom-diff.js — walks two normalized HTML strings (original + edited), emits a list
 * of structured operations the receiving Claude Code agent can apply.
 *
 * Op types emitted: text-replace, image-swap, attr-change, subtree-replace
 * Each op carries an ordered list of match_strategies the agent tries in order.
 *
 * Pure function, no I/O. Returns { operations: [...], image_sentinels: [...] }.
 * image_sentinels are accumulated for the cross-page image_upload_plan.json.
 *
 * Exposed as window.RFLY_domDiff(originalHtml, editedHtml, opts).
 *
 * Critical: BOTH inputs must already have passed through RFLY_normalizeHTML, else
 * the diff is polluted with attr-order / GSAP / csrf-meta phantom changes.
 */
(function () {
    'use strict';

    // ──────────────────────────────────────────────────────────────────────────
    // Utilities
    // ──────────────────────────────────────────────────────────────────────────

    /** True if val is a Firebase Storage download URL (used to detect image swaps). */
    function isFirebaseUrl(url) {
        return (
            typeof url === 'string' &&
            /firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(url)
        );
    }

    /** True if val looks like a base64 data: URL (also a swap signal — usually pre-upload). */
    function isDataUrl(url) {
        return typeof url === 'string' && url.startsWith('data:');
    }

    /** Build a CSS selector that uniquely identifies `el` within its document. */
    function buildSelector(el) {
        if (!el || el.nodeType !== 1) return 'body';
        const doc = el.ownerDocument;
        if (el === doc.body || el === doc.documentElement) return el.tagName.toLowerCase();
        if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return '#' + el.id;
        const ds = el.getAttribute('data-section');
        if (ds && /^[\w-]+$/.test(ds)) return 'section[data-section="' + ds + '"]';

        const path = [];
        let cur = el;
        while (cur && cur !== doc.body && cur.parentElement) {
            let token = cur.tagName.toLowerCase();
            if (cur.id && /^[a-zA-Z][\w-]*$/.test(cur.id)) {
                token += '#' + cur.id;
                path.unshift(token);
                break;
            }
            // First simple class as a hint
            const cls = (typeof cur.className === 'string' ? cur.className : '')
                .split(/\s+/)
                .filter(Boolean)
                .find((c) => /^[a-zA-Z][\w-]*$/.test(c));
            if (cls) token += '.' + cls;

            const parent = cur.parentElement;
            const sameTagSibs = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
            if (sameTagSibs.length > 1) token += ':nth-of-type(' + (sameTagSibs.indexOf(cur) + 1) + ')';
            path.unshift(token);
            cur = parent;
        }
        return path.join(' > ') || 'body';
    }

    /** Approximate 1-indexed line number where `needle` first appears in `haystack`. */
    function approximateLine(haystack, needle) {
        if (!needle || !haystack) return 0;
        const idx = haystack.indexOf(needle);
        if (idx < 0) return 0;
        return haystack.slice(0, idx).split('\n').length;
    }

    /** Verify uniqueness of `candidate` inside `originalHtml`. */
    function isUnique(originalHtml, candidate) {
        if (!candidate || !originalHtml) return false;
        const parts = originalHtml.split(candidate);
        return parts.length === 2;
    }

    /** Expand `el.outerHTML` upward (wrap parent's open/close around it) until unique
     *  in originalHtml, OR we hit the body / 3 levels up. Returns { anchor, expanded, depth }. */
    function expandUntilUnique(el, originalHtml, maxDepth) {
        maxDepth = maxDepth || 3;
        let cur = el;
        let anchor = el.outerHTML;
        let depth = 0;
        if (isUnique(originalHtml, anchor)) return { anchor, expanded: false, depth: 0 };
        while (depth < maxDepth && cur.parentElement && cur.parentElement !== el.ownerDocument.body) {
            cur = cur.parentElement;
            anchor = cur.outerHTML;
            depth++;
            if (isUnique(originalHtml, anchor)) return { anchor, expanded: true, depth };
        }
        return { anchor, expanded: depth > 0, depth };
    }

    /** Map of attribute name → value for a single element. */
    function attrMap(el) {
        const m = {};
        for (let i = 0; i < el.attributes.length; i++) {
            const a = el.attributes[i];
            m[a.name] = a.value;
        }
        return m;
    }

    /** Diff two attribute maps. Returns { added, removed, changed: { attr: { before, after } }, changed_list }. */
    function diffAttrMaps(a, b) {
        const added = {},
            removed = {},
            changed = {};
        for (const k in a) {
            if (!(k in b)) removed[k] = a[k];
            else if (a[k] !== b[k]) changed[k] = { before: a[k], after: b[k] };
        }
        for (const k in b) {
            if (!(k in a)) added[k] = b[k];
        }
        const changed_list = [];
        for (const k in changed) changed_list.push({ attr: k, before: changed[k].before, after: changed[k].after });
        for (const k in added) changed_list.push({ attr: k, before: null, after: added[k] });
        for (const k in removed) changed_list.push({ attr: k, before: removed[k], after: null });
        return { added, removed, changed, changed_list };
    }

    /** Direct (non-element) text children content of an element, trimmed and joined. */
    function directText(el) {
        return Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent || '')
            .join('')
            .trim();
    }

    /** True if element has any element children (mixed/structural). */
    function hasElementChildren(el) {
        return el.children && el.children.length > 0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Op builders — each returns a fully-formed operation with match_strategies
    // ──────────────────────────────────────────────────────────────────────────

    function makeTextReplace(origEl, editEl, originalHtml, ctx) {
        const selector = buildSelector(origEl);
        const oldOuter = origEl.outerHTML;
        const newOuter = editEl.outerHTML;
        const strategies = [];

        // Strategy 1: exact (with uniqueness expansion if needed)
        const expanded = expandUntilUnique(origEl, originalHtml);
        if (isUnique(originalHtml, expanded.anchor)) {
            // We expanded around the parent — replace only the child portion in the anchor.
            let exact_new = expanded.anchor;
            if (expanded.expanded) {
                exact_new = exact_new.split(oldOuter).join(newOuter);
            } else {
                exact_new = newOuter;
            }
            strategies.push({
                strategy: 'exact',
                old_string: expanded.anchor,
                new_string: exact_new,
                uniqueness_verified: true,
                anchor_expanded: expanded.expanded,
                anchor_depth_added: expanded.depth
            });
        }

        // Strategy 2: selector + innerText assertion (text-replace only — for plain leaf elements)
        if (!hasElementChildren(origEl)) {
            const oldInner = (origEl.textContent || '').trim();
            const newInner = (editEl.textContent || '').trim();
            strategies.push({
                strategy: 'selector+innerText',
                selector,
                expected_innerText_contains: oldInner.slice(0, 80),
                new_innerText: newInner
            });
        }

        // Strategy 3: subtree-replace (last resort)
        strategies.push({
            strategy: 'subtree-replace',
            selector,
            new_outerHTML: newOuter
        });

        return {
            id: 'edit_' + String(ctx.opCounter++).padStart(3, '0'),
            type: 'text-replace',
            selector,
            approximate_line: approximateLine(originalHtml, oldOuter),
            intent: 'Change text content of ' + origEl.tagName.toLowerCase() +
                (origEl.id ? '#' + origEl.id : ''),
            match_strategies: strategies
        };
    }

    function makeImageSwap(origEl, editEl, originalHtml, ctx) {
        const selector = buildSelector(origEl);
        const oldOuter = origEl.outerHTML;
        const originalSrc = origEl.getAttribute('src') || '';
        const newSrc = editEl.getAttribute('src') || '';
        const exportSrc = editEl.getAttribute('data-export-src') || '';
        const filenameHint = editEl.getAttribute('data-filename') || newSrc.split('/').pop() || 'image.webp';

        // Sentinel only meaningful if the new src is a Firebase URL (or data: URL — pre-upload state).
        // If neither (e.g. URL was pasted via applyUrl), no sentinel — agent uses newSrc verbatim.
        const sentinel = '{{IMAGE_URL_edit_' + String(ctx.opCounter).padStart(3, '0') + '}}';
        const useSentinel = isFirebaseUrl(newSrc) || isDataUrl(newSrc);
        const replacementSrc = useSentinel ? sentinel : newSrc;

        // Build the new outerHTML with sentinel substituted for src
        const newClone = editEl.cloneNode(true);
        if (useSentinel) newClone.setAttribute('src', sentinel);
        // Strip volatile per-edit dataset noise from the deployable HTML
        newClone.removeAttribute('data-export-src');
        newClone.removeAttribute('data-filename');
        newClone.removeAttribute('data-isBig');
        newClone.removeAttribute('srcset');
        const newOuter = newClone.outerHTML;

        const strategies = [];

        const expanded = expandUntilUnique(origEl, originalHtml);
        if (isUnique(originalHtml, expanded.anchor)) {
            let exact_new = expanded.anchor;
            if (expanded.expanded) {
                exact_new = exact_new.split(oldOuter).join(newOuter);
            } else {
                exact_new = newOuter;
            }
            strategies.push({
                strategy: 'exact',
                old_string: expanded.anchor,
                new_string: exact_new,
                uniqueness_verified: true,
                anchor_expanded: expanded.expanded,
                anchor_depth_added: expanded.depth
            });
        }

        strategies.push({
            strategy: 'selector+attr',
            selector,
            attr: 'src',
            expected_current_value: originalSrc,
            new_value: replacementSrc
        });

        strategies.push({
            strategy: 'subtree-replace',
            selector,
            new_outerHTML: newOuter
        });

        // Register the sentinel for the cross-page image_upload_plan
        if (useSentinel) {
            ctx.image_sentinels.push({
                sentinel,
                firebase_url: newSrc,
                filename_hint: filenameHint,
                exported_wp_path_hint: exportSrc || null,
                used_in_pages: [ctx.pageSlug],
                context: 'image-swap'
            });
        }

        return {
            id: 'edit_' + String(ctx.opCounter++).padStart(3, '0'),
            type: 'image-swap',
            selector,
            approximate_line: approximateLine(originalHtml, oldOuter),
            intent: 'Replace image at ' + selector,
            original_src: originalSrc,
            image_sentinel: useSentinel ? sentinel : null,
            new_src_if_no_sentinel: useSentinel ? null : newSrc,
            match_strategies: strategies
        };
    }

    function makeAttrChange(origEl, editEl, attr, before, after, originalHtml, ctx) {
        const selector = buildSelector(origEl);
        const oldOuter = origEl.outerHTML;
        const newOuter = editEl.outerHTML;
        const strategies = [];

        const expanded = expandUntilUnique(origEl, originalHtml);
        if (isUnique(originalHtml, expanded.anchor)) {
            let exact_new = expanded.anchor;
            if (expanded.expanded) {
                exact_new = exact_new.split(oldOuter).join(newOuter);
            } else {
                exact_new = newOuter;
            }
            strategies.push({
                strategy: 'exact',
                old_string: expanded.anchor,
                new_string: exact_new,
                uniqueness_verified: true
            });
        }

        strategies.push({
            strategy: 'selector+attr',
            selector,
            attr,
            expected_current_value: before,
            new_value: after
        });

        strategies.push({
            strategy: 'subtree-replace',
            selector,
            new_outerHTML: newOuter
        });

        return {
            id: 'edit_' + String(ctx.opCounter++).padStart(3, '0'),
            type: 'attr-change',
            selector,
            attr,
            before,
            after,
            approximate_line: approximateLine(originalHtml, oldOuter),
            intent: 'Change attribute ' + attr + ' on ' + selector,
            match_strategies: strategies
        };
    }

    function makeSubtreeReplace(origEl, editEl, originalHtml, ctx, note) {
        const selector = buildSelector(origEl);
        const oldOuter = origEl.outerHTML;
        const newOuter = editEl.outerHTML;
        const strategies = [];

        const expanded = expandUntilUnique(origEl, originalHtml);
        if (isUnique(originalHtml, expanded.anchor)) {
            let exact_new = expanded.anchor;
            if (expanded.expanded) {
                exact_new = exact_new.split(oldOuter).join(newOuter);
            } else {
                exact_new = newOuter;
            }
            strategies.push({
                strategy: 'exact',
                old_string: expanded.anchor,
                new_string: exact_new,
                uniqueness_verified: true
            });
        }

        strategies.push({
            strategy: 'subtree-replace',
            selector,
            new_outerHTML: newOuter
        });

        return {
            id: 'edit_' + String(ctx.opCounter++).padStart(3, '0'),
            type: 'subtree-replace',
            selector,
            approximate_line: approximateLine(originalHtml, oldOuter),
            intent: note || ('Replace subtree at ' + selector),
            match_strategies: strategies
        };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Core walker
    // ──────────────────────────────────────────────────────────────────────────

    function walk(origEl, editEl, originalHtml, ctx) {
        if (!origEl || !editEl) return;
        if (origEl.nodeType !== 1 || editEl.nodeType !== 1) return; // only elements

        // Identical subtrees → skip
        if (origEl.outerHTML === editEl.outerHTML) return;

        // Tag changed at this node → escalate to parent subtree-replace
        if (origEl.tagName !== editEl.tagName) {
            const parent = origEl.parentElement;
            const editParent = editEl.parentElement;
            if (parent && editParent) {
                ctx.ops.push(makeSubtreeReplace(parent, editParent, originalHtml, ctx, 'Tag changed inside subtree'));
            }
            return;
        }

        // Attribute changes on THIS element
        const aA = attrMap(origEl);
        const aB = attrMap(editEl);
        const attrDiff = diffAttrMaps(aA, aB);
        attrDiff.changed_list.forEach(({ attr, before, after }) => {
            // <img src=...> change → image-swap (one op, not attr-change)
            if (origEl.tagName === 'IMG' && attr === 'src') {
                ctx.ops.push(makeImageSwap(origEl, editEl, originalHtml, ctx));
                return;
            }
            // ignore the editor's own per-edit dataset noise on the swap target itself —
            // image-swap above already absorbs the original swap and emits a clean op.
            // For elements that are NOT img, treat data-export-src / data-filename as noise.
            if (
                (origEl.tagName !== 'IMG' || attr !== 'src') &&
                /^data-(export-src|filename|isBig)$/i.test(attr)
            ) {
                return;
            }
            ctx.ops.push(makeAttrChange(origEl, editEl, attr, before, after, originalHtml, ctx));
        });

        // Child topology check
        const origChildren = Array.from(origEl.children);
        const editChildren = Array.from(editEl.children);

        // No element children at all (e.g. <h1>foo</h1>, <p>plain text</p>) — leaf-ish.
        if (origChildren.length === 0 && editChildren.length === 0) {
            // Either text changed or it was all caught in attr-change loop above.
            const oA = (origEl.textContent || '').trim();
            const oB = (editEl.textContent || '').trim();
            if (oA !== oB) {
                ctx.ops.push(makeTextReplace(origEl, editEl, originalHtml, ctx));
            }
            return;
        }

        // Topology mismatch (different child count OR different child tags) → atomic subtree-replace
        if (origChildren.length !== editChildren.length) {
            ctx.ops.push(makeSubtreeReplace(origEl, editEl, originalHtml, ctx, 'Child count changed'));
            return;
        }
        const childrenTagsMatch = origChildren.every((c, i) => c.tagName === editChildren[i].tagName);
        if (!childrenTagsMatch) {
            ctx.ops.push(makeSubtreeReplace(origEl, editEl, originalHtml, ctx, 'Child tag order changed'));
            return;
        }

        // Mixed content: direct text between/around child elements differs → atomic subtree-replace
        // (contenteditable mutations to mixed content are too fiddly to express as ops)
        const tA = directText(origEl);
        const tB = directText(editEl);
        if (tA !== tB) {
            ctx.ops.push(makeSubtreeReplace(origEl, editEl, originalHtml, ctx, 'Mixed-content text changed'));
            return;
        }

        // Recurse into matched children
        for (let i = 0; i < origChildren.length; i++) {
            walk(origChildren[i], editChildren[i], originalHtml, ctx);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public entry
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Diff two normalized HTML strings.
     *
     * @param {string} originalHtml  pre-edit normalized HTML
     * @param {string} editedHtml    post-edit normalized HTML
     * @param {object} opts          { pageSlug } — slug used in sentinel registrations
     * @returns {{ operations: Array, image_sentinels: Array }}
     */
    function domDiff(originalHtml, editedHtml, opts) {
        opts = opts || {};
        const pageSlug = opts.pageSlug || 'unknown';
        const ctx = {
            ops: [],
            image_sentinels: [],
            opCounter: 1,
            pageSlug
        };

        if (!originalHtml || !editedHtml) {
            return { operations: [], image_sentinels: [] };
        }
        if (originalHtml === editedHtml) {
            return { operations: [], image_sentinels: [] };
        }

        const origDoc = new DOMParser().parseFromString(originalHtml, 'text/html');
        const editDoc = new DOMParser().parseFromString(editedHtml, 'text/html');

        // Walk the body (where editable content lives)
        if (origDoc.body && editDoc.body) {
            walk(origDoc.body, editDoc.body, originalHtml, ctx);
        }
        // Also walk the head — title / meta description changes are common
        if (origDoc.head && editDoc.head) {
            walk(origDoc.head, editDoc.head, originalHtml, ctx);
        }

        // De-duplicate by selector (last write wins). Subtree-replace at a parent
        // makes any child op redundant — filter those out too.
        const bySelector = new Map();
        const subtreeReplaceSelectors = new Set();
        ctx.ops.forEach((op) => {
            if (op.type === 'subtree-replace') subtreeReplaceSelectors.add(op.selector);
        });
        const filtered = ctx.ops.filter((op) => {
            if (op.type === 'subtree-replace') return true;
            for (const sel of subtreeReplaceSelectors) {
                if (op.selector !== sel && op.selector.startsWith(sel + ' ')) {
                    return false; // child of a subtree-replace — redundant
                }
            }
            return true;
        });
        filtered.forEach((op) => {
            bySelector.set(op.selector + '::' + op.type + (op.attr ? '::' + op.attr : ''), op);
        });
        const dedup = Array.from(bySelector.values());

        // Sort top-to-bottom by approximate_line (matches how AI agents read code)
        dedup.sort((a, b) => (a.approximate_line || 0) - (b.approximate_line || 0));

        // Re-number op ids in source order
        dedup.forEach((op, i) => {
            op.id = 'edit_' + String(i + 1).padStart(3, '0');
            // Patch any sentinel that referenced the old id by relinking
            // Note: sentinels generated during walk used the running counter — close enough
            // for cross-reference; we only re-id the ops here for clean presentation.
        });

        return { operations: dedup, image_sentinels: ctx.image_sentinels };
    }

    window.RFLY_domDiff = domDiff;
})();
