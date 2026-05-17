/**
 * pack-builder.js — assembles the v3 revision pack ZIP from the editor's
 * existing in-memory + IDB + Firebase state.
 *
 * Public entry: window.RFLY_buildRevisionPack(input) → Promise<Blob>
 *
 * input = {
 *   token,                // revision token (e.g. "mqmvmpj4w714")
 *   site_url,             // from manifest
 *   client_label,         // from manifest
 *   source_portal,        // "v2-editor" | "v1-acrp"
 *   pages: [
 *     {
 *       slug, title, page_id?, file_path?,
 *       original_url,       // Firebase Storage URL to pre-edit HTML
 *       edited_html: null|string,  // null if no edits, else from IDB
 *       comments: null|{ comments: [...] }   // null if no comments
 *     }
 *   ]
 * }
 *
 * Dependencies (must be loaded BEFORE this script):
 *   - JSZip global
 *   - window.RFLY_normalizeHTML, window.RFLY_sha256
 *   - window.RFLY_domDiff
 *   - window.RFLY_buildInstructionsMd
 */
(function () {
    'use strict';

    async function buildRevisionPack(input) {
        if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
        if (!window.RFLY_normalizeHTML || !window.RFLY_domDiff || !window.RFLY_buildInstructionsMd || !window.RFLY_sha256) {
            throw new Error('pack-builder deps missing: normalize.js / dom-diff.js / instructions-template.js must be loaded first');
        }

        const PACK_VERSION = '3.0';

        // 1. FILTER pages: drop those with neither edits nor comments
        const candidatePages = (input.pages || []).filter((p) => {
            const hasEdits = typeof p.edited_html === 'string' && p.edited_html.trim().length > 0;
            const hasComments = p.comments && p.comments.comments && p.comments.comments.length > 0;
            return hasEdits || hasComments;
        });

        // 2. FETCH originals in parallel (only for kept pages)
        const fetchResults = await Promise.all(
            candidatePages.map(async (p) => {
                try {
                    const r = await fetch(p.original_url);
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return { page: p, originalHtml: await r.text(), error: null };
                } catch (err) {
                    console.warn('original-fetch failed for', p.slug, err);
                    return { page: p, originalHtml: null, error: err.message || String(err) };
                }
            })
        );

        // 3. NORMALIZE + DIFF + BUILD per-page data
        const pageBuildResults = [];
        const allImageSentinels = [];
        const sentinelDedup = new Map();
        const filenameSlugMap = new Map();

        for (const fr of fetchResults) {
            const p = fr.page;

            const originalNormalized = fr.originalHtml ? window.RFLY_normalizeHTML(fr.originalHtml) : '';
            const editedNormalized =
                typeof p.edited_html === 'string' && p.edited_html.trim().length > 0
                    ? window.RFLY_normalizeHTML(p.edited_html)
                    : originalNormalized; // page only has comments → edited == original

            const hasRealEdits = originalNormalized !== editedNormalized && editedNormalized && originalNormalized;
            const hasComments = !!(p.comments && p.comments.comments && p.comments.comments.length > 0);

            const original_sha256 = originalNormalized
                ? await window.RFLY_sha256(originalNormalized)
                : null;
            const edited_sha256 = editedNormalized
                ? await window.RFLY_sha256(editedNormalized)
                : null;

            let editsData = null;
            if (hasRealEdits) {
                const diff = window.RFLY_domDiff(originalNormalized, editedNormalized, { pageSlug: p.slug });
                editsData = {
                    page_slug: p.slug,
                    page_id: p.page_id || null,
                    operations: diff.operations
                };
                diff.image_sentinels.forEach((s) => {
                    const key = s.firebase_url;
                    if (sentinelDedup.has(key)) {
                        const existing = sentinelDedup.get(key);
                        if (existing.used_in_pages.indexOf(p.slug) === -1) {
                            existing.used_in_pages.push(p.slug);
                        }
                    } else {
                        sentinelDedup.set(key, { ...s });
                        allImageSentinels.push(sentinelDedup.get(key));
                    }
                });
            }

            // Comments — strip inlined thumbnails to separate files
            let commentsData = null;
            const commentImages = []; // [{ localPath, base64, mime }]
            if (hasComments) {
                const cloned = JSON.parse(JSON.stringify(p.comments));
                let refCounter = 1;
                let assetCounter = 1;
                cloned.comments.forEach((c) => {
                    (c.items || []).forEach((item) => {
                        // Move thumb to a file (keeps comments.json lean)
                        if (item.image_thumb_b64 && item.image_thumb_b64.indexOf('data:') === 0) {
                            const ext = (item.image_thumb_b64.match(/data:image\/(\w+)/) || [, 'webp'])[1];
                            const localName = `thumb-${item.id || 'x'}.${ext}`;
                            const localPath = `pages/${p.slug}/images/${localName}`;
                            commentImages.push({ localPath, dataUrl: item.image_thumb_b64 });
                            item.image_thumb_local_path = localPath;
                            delete item.image_thumb_b64;
                        }
                        // Tag with a REF-N or ASSET-N naming + register sentinel for the full image
                        if (item.image_url) {
                            const tag =
                                item.itemType === 'asset'
                                    ? `ASSET-${assetCounter++}.webp`
                                    : `REF-${refCounter++}.webp`;
                            const localPath = `pages/${p.slug}/images/${tag}`;
                            item.image_local_path = localPath;
                            // Register Firebase URL for cross-page upload plan
                            const key = item.image_url;
                            const sentinel = `{{IMAGE_URL_${c.id}_${item.id || 'x'}}}`;
                            if (!sentinelDedup.has(key)) {
                                const entry = {
                                    sentinel,
                                    firebase_url: item.image_url,
                                    filename_hint: item.image_filename || tag,
                                    used_in_pages: [p.slug],
                                    context: 'comment-attached reference image (not patched into HTML)'
                                };
                                sentinelDedup.set(key, entry);
                                allImageSentinels.push(entry);
                            } else {
                                const existing = sentinelDedup.get(key);
                                if (existing.used_in_pages.indexOf(p.slug) === -1) {
                                    existing.used_in_pages.push(p.slug);
                                }
                            }
                            item.image_sentinel = sentinelDedup.get(key).sentinel;
                            // Track filename → slug for later asset file copy
                            filenameSlugMap.set(localPath, item.image_url);
                        }
                    });
                });
                commentsData = { page_slug: p.slug, comments: cloned.comments };
            }

            pageBuildResults.push({
                page: p,
                hasRealEdits,
                hasComments,
                originalNormalized,
                editedNormalized,
                original_sha256,
                edited_sha256,
                editsData,
                commentsData,
                commentImages,
                fetchError: fr.error
            });
        }

        // 4. ASSEMBLE the ZIP
        const zip = new JSZip();
        const manifest = {
            pack_version: PACK_VERSION,
            schema: 'reputifly-revision-pack',
            token: input.token,
            site_url: input.site_url || null,
            client_label: input.client_label || null,
            submitted_at: new Date().toISOString(),
            submitted_by: 'client',
            source_portal: input.source_portal || 'unknown',
            pages: [],
            agentic_profile_hint:
                'Use the agentic-JSON profile for this site to access patch_deployment_file, bulk_upload_media, deployment_rendered, rollback_changes'
        };

        for (const r of pageBuildResults) {
            const p = r.page;
            const slug = p.slug;
            const pageEntry = {
                slug,
                title: p.title || slug,
                page_id: p.page_id || null,
                file_path: p.file_path || `${slug}.html`,
                original_url: p.original_url || null,
                original_sha256: r.original_sha256,
                edited_sha256: r.edited_sha256,
                has_edits: !!r.hasRealEdits,
                has_comments: !!r.hasComments,
                edit_count: r.editsData ? r.editsData.operations.length : 0,
                comment_count: r.commentsData ? r.commentsData.comments.length : 0,
                fetch_error: r.fetchError || null
            };
            manifest.pages.push(pageEntry);

            // Per-page folder
            const dir = zip.folder(`pages/${slug}`);
            dir.file('original.html', r.originalNormalized || '');
            dir.file('edited.html', r.editedNormalized || '');
            dir.file('page.json', JSON.stringify(pageEntry, null, 2));
            if (r.editsData) dir.file('edits.json', JSON.stringify(r.editsData, null, 2));
            if (r.commentsData) dir.file('comments.json', JSON.stringify(r.commentsData, null, 2));

            // Comment thumbnails extracted to files
            for (const ci of r.commentImages) {
                const m = ci.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!m) continue;
                const path = ci.localPath.replace(/^pages\/[^/]+\//, '');
                dir.file(path, m[2], { base64: true });
            }
        }

        // 5. CROSS-PAGE FILES
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file(
            'image_upload_plan.json',
            JSON.stringify(
                {
                    uploads: allImageSentinels,
                    agent_workflow: [
                        '1. POST /media/bulk with { urls: [<every firebase_url in uploads>] } in one call.',
                        '2. Build a map: sentinel → returned_wp_url from the response.',
                        '3. For each edit op in edits.json with an image_sentinel (and for asset comments), substitute the sentinel before calling Edit().'
                    ]
                },
                null,
                2
            )
        );
        zip.file('INSTRUCTIONS.md', window.RFLY_buildInstructionsMd(manifest));

        // 6. RETURN as Blob — caller decides what to do (upload, download, both)
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        return { blob, manifest };
    }

    window.RFLY_buildRevisionPack = buildRevisionPack;
})();
