/**
 * normalize.js — single source of truth for "HTML equality" in the revision-pack flow.
 *
 * Both the original HTML (fetched from Firebase Storage) and the edited HTML
 * (from getCleanHTML in the editor) pass through this function before being
 * diffed. Without this normalisation step every diff would be polluted with
 * phantom changes from:
 *   - GSAP / scroll-driven inline styles (opacity, transform, visibility, ...)
 *   - DOMParser-side attribute reordering
 *   - WP-side meta/script tags that drift between fetches (csrf, generator, ...)
 *   - The editor's own injected `<style id="reputifly-editor-css">` block
 *
 * Exposed on window so plain <script src="lib/normalize.js"></script> works
 * from both editor.html and revision-portal.html without any module plumbing.
 */
(function () {
    'use strict';

    function normalizeHTML(rawHTML) {
        if (typeof rawHTML !== 'string' || !rawHTML.trim()) return '';

        // 1. Parse → DOMParser canonicalises tag casing, entities, and self-closing forms
        let doc;
        try {
            doc = new DOMParser().parseFromString(rawHTML, 'text/html');
        } catch (e) {
            return rawHTML; // give up gracefully
        }

        // 2. Strip GSAP / animation noise (mirrors getCleanHTML at editor.html:2592-2597)
        doc.querySelectorAll('*[style]').forEach((el) => {
            const s = el.getAttribute('style');
            if (!s) return;
            if (/opacity|transform|translate|rotate|scale|visibility/i.test(s)) {
                el.style.removeProperty('opacity');
                el.style.removeProperty('transform');
                el.style.removeProperty('translate');
                el.style.removeProperty('rotate');
                el.style.removeProperty('scale');
                el.style.removeProperty('visibility');
                if (!el.getAttribute('style')) el.removeAttribute('style');
            }
        });

        // 3. Drop the editor's own injected <style id="reputifly-editor-css">
        const editorCss = doc.getElementById('reputifly-editor-css');
        if (editorCss) editorCss.remove();

        // 3b. Strip editor-internal dataset markers from <img> swaps — these never ship
        //     to production. data-export-src / data-filename / data-isBig live on swapped
        //     images to feed the legacy ZIP-export flow; the v3 pack uses sentinels instead.
        //     Also strip srcset (WP re-injects it, and our swaps don't update it correctly).
        doc.querySelectorAll('img[data-export-src], img[data-filename], img[data-is-big]').forEach((img) => {
            img.removeAttribute('data-export-src');
            img.removeAttribute('data-filename');
            img.removeAttribute('data-is-big');
            img.removeAttribute('data-isBig');
            img.removeAttribute('srcset');
        });

        // 4. Drop volatile WP-injected nodes — these drift between fetches and cause
        //    phantom drift-detection failures without being meaningful client edits.
        const VOLATILE_SELECTORS = [
            'script[id*="csrf"]',
            'script[id$="-token"]',
            'script[id*="rsd-link"]',
            'meta[name="generator"]',
            'meta[name="csrf-token"]',
            'meta[http-equiv="last-modified"]',
            'meta[name="wp-cache-busting"]'
        ];
        VOLATILE_SELECTORS.forEach((sel) => {
            try {
                doc.querySelectorAll(sel).forEach((el) => el.remove());
            } catch (e) {
                /* invalid selector — skip */
            }
        });

        // 5. Sort attributes alphabetically per element so reorder noise doesn't appear as a diff.
        //    Skip <html>/<head> because <head> child order is meaningful (some scripts depend on
        //    being before/after others); only re-sort attributes within elements.
        doc.querySelectorAll('*').forEach((el) => {
            const attrs = Array.from(el.attributes)
                .map((a) => [a.name, a.value])
                .sort((a, b) => a[0].localeCompare(b[0]));
            attrs.forEach(([n]) => el.removeAttribute(n));
            attrs.forEach(([n, v]) => el.setAttribute(n, v));
        });

        return doc.documentElement.outerHTML;
    }

    /** SHA-256 hex digest of a string. Uses native SubtleCrypto (browser-only). */
    async function sha256(s) {
        const buf = new TextEncoder().encode(s);
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hashBuf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    window.RFLY_normalizeHTML = normalizeHTML;
    window.RFLY_sha256 = sha256;
})();
