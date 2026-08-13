const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const WATCHLIST_PATH = path.join(ROOT, "watchlist/index.html");
const DIGEST_PATH = path.join(ROOT, "daily-digest/index.html");
const API_BASE = "https://asia-southeast1-reputifly-leads-2.cloudfunctions.net/api";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function scripts(html) {
  return [...html.matchAll(/<script( type="module")?>([\s\S]*?)<\/script>/g)].map((match) => ({
    module: Boolean(match[1]),
    code: match[2],
  }));
}

function classic(html) {
  const found = scripts(html).filter((script) => !script.module && /var API_BASE=/.test(script.code));
  assert.equal(found.length, 1, "page has exactly one classic application script");
  return found[0].code;
}

function frameGuard(html) {
  const found = scripts(html).filter((script) => !script.module && /__RFLY_TOP_LEVEL__/.test(script.code) && !/var API_BASE=/.test(script.code));
  assert.equal(found.length, 1, "page has exactly one early frame guard");
  return found[0].code;
}

function makeDom(file, url = "http://localhost:4173/") {
  const html = read(file).replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.console.log = () => {};
  dom.window.scrollTo = () => {};
  dom.window.__RFLY_TOP_LEVEL__ = true;
  return dom;
}

function executeClassic(dom, file) {
  dom.window.eval(classic(read(file)));
}

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const META = {
  serverTime: "2026-08-14T01:00:00.000Z",
  requestId: "req_test_1",
  businessDate: "2026-08-14",
};
function success(extra = {}, read = false) {
  return { ...extra, ...(read ? { dataAsOf: META.serverTime } : {}), meta: { ...META } };
}
function session(extra = {}) {
  return success({
    identity: { uid: "member_self", email: "member@example.com" },
    member: { role: "member", displayName: "Employee" },
    leads: [], actors: {}, ...extra,
  }, true);
}

test("both inline programs remain syntactically valid", () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    for (const script of scripts(read(file))) {
      if (script.module) new Function(`return (async () => {\n${script.code}\n});`);
      else new vm.Script(script.code, { filename: file });
    }
  }
});

test("frame guard is fail-closed before resources and prevents framed app boot", () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const html = read(file);
    const styleAt = html.indexOf('<style id="rflyFrameGuard">');
    const guardAt = html.indexOf("<script>", styleAt);
    const resourceAt = html.indexOf("<link ");
    assert.ok(styleAt > 0 && guardAt > styleAt && resourceAt > guardAt, "hidden guard runs before external resources");
    assert.match(html, /html\{visibility:hidden!important\}/);

    const code = frameGuard(html);
    const guardNode = { removed: false, remove() { this.removed = true; } };
    const topWindow = {};
    topWindow.self = topWindow;
    topWindow.top = topWindow;
    vm.runInNewContext(code, { window: topWindow, document: { getElementById: () => guardNode } });
    assert.equal(topWindow.__RFLY_TOP_LEVEL__, true, "top-level page is allowed");
    assert.equal(guardNode.removed, true, "top-level page is unhidden");

    const framedWindow = { self: {}, top: {} };
    const framedGuard = { removed: false, remove() { this.removed = true; } };
    vm.runInNewContext(code, { window: framedWindow, document: { getElementById: () => framedGuard } });
    assert.equal(framedWindow.__RFLY_TOP_LEVEL__, undefined, "framed page is never authorized");
    assert.equal(framedGuard.removed, false, "framed document stays hidden");

    const moduleCode = scripts(html).find((script) => script.module).code;
    assert.ok(moduleCode.indexOf("__RFLY_TOP_LEVEL__") < moduleCode.indexOf("await import("), "auth import is behind frame gate");
    assert.ok(classic(html).indexOf("__RFLY_TOP_LEVEL__") < classic(html).indexOf("var API_BASE="), "API boot is behind frame gate");

    const dom = makeDom(file);
    delete dom.window.__RFLY_TOP_LEVEL__;
    assert.throws(() => executeClassic(dom, file), /Framed execution blocked/);
    assert.equal(dom.window.__api, undefined, "framed page exposes no API client");
    dom.window.close();
  }
});

test("legacy Apps Script and opaque transports are completely absent", () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const html = read(file);
    assert.doesNotMatch(html, /script\.google\.com|googleusercontent\.com\/macros/i);
    assert.doesNotMatch(html, /\bjsonp\b|mode\s*:\s*["']no-cors["']/i);
    assert.doesNotMatch(html, /[?&](?:t|token|idToken)=/i);
    assert.match(html, new RegExp(API_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Authorization\s*=\s*["']Bearer ["']\s*\+\s*token/);
    assert.match(html, /REQUEST_TIMEOUT_MS\s*=\s*35000/);
  }
});

test("auth waits for persisted state, supports Google, and separates cancellation from API access failure", () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const html = read(file);
    assert.match(html, /await auth\.authStateReady\(\)/);
    assert.match(html, /window\.__api\(["']\/v1\/session["']/);
    assert.match(html, /signInWithPopup/);
    assert.match(html, /GoogleAuthProvider/);
    assert.match(html, /auth\/popup-closed-by-user/);
    assert.match(html, /Google sign-in was cancelled\. Nothing changed\./);
    assert.match(html, /auth\/account-exists-with-different-credential/);
    assert.match(html, /Sign in with email and password once/);
    assert.match(html, /does not have access to this app/);
    assert.match(html, /Offline .*server could not be checked|Offline .*Current leads could not be checked/);
    assert.match(html, /auth\/user-token-expired/);
    assert.match(html, /auth\/user-disabled/);
    assert.match(html, /auth\/invalid-user-token/);
    assert.match(html, /credentialSessionError\(err\)/);
    assert.match(html, /sign-in expired or was revoked/);
    assert.equal((html.match(/signOut\(auth\)/g) || []).length, 1, "sign-out exists only behind the explicit account-switch button");
  }
});

test("Firebase credential failures bypass network retry and surface re-auth", async () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const dom = makeDom(file, file === WATCHLIST_PATH
      ? "https://reputifly.org/watchlist/"
      : "https://reputifly.org/daily-digest/");
    try {
      let tokenCalls = 0;
      let fetchCalls = 0;
      let surfaced = "";
      dom.window.__rflyToken = async () => {
        tokenCalls += 1;
        const error = new Error("expired");
        error.code = "auth/user-token-expired";
        throw error;
      };
      dom.window.__credentialExpired = (error) => { surfaced = error.code; };
      dom.window.fetch = async () => { fetchCalls += 1; return response({}); };
      executeClassic(dom, file);
      await assert.rejects(dom.window.__api("/v1/session", { attempts: 3 }), /expired/);
      assert.equal(tokenCalls, 1, "credential failure is not retried as a network outage");
      assert.equal(fetchCalls, 0, "no API request is made with a failed credential");
      assert.equal(surfaced, "auth/user-token-expired");
    } finally {
      dom.window.close();
    }
  }
});

test("backend HTTP 401 unauthorized surfaces re-auth and is never retried", async () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const dom = makeDom(file, file === WATCHLIST_PATH
      ? "https://reputifly.org/watchlist/"
      : "https://reputifly.org/daily-digest/");
    try {
      let tokenCalls = 0;
      let fetchCalls = 0;
      let surfaced = "";
      dom.window.__rflyToken = async () => { tokenCalls += 1; return "rejected-token"; };
      dom.window.__credentialExpired = (error) => { surfaced = error.code; };
      dom.window.fetch = async () => {
        fetchCalls += 1;
        return response({ error: { code: "unauthorized", message: "The sign-in session is invalid or expired." } }, 401);
      };
      executeClassic(dom, file);
      await assert.rejects(dom.window.__api("/v1/session", { attempts: 3 }), (error) => {
        assert.equal(error.status, 401);
        assert.equal(error.code, "unauthorized");
        return true;
      });
      assert.equal(tokenCalls, 1, "401 is not retried with the rejected credential");
      assert.equal(fetchCalls, 1, "401 is not misclassified as offline/transient");
      assert.equal(surfaced, "unauthorized", "the re-auth gate is invoked");
    } finally {
      dom.window.close();
    }
  }
});

test("watchlist production API attaches Bearer auth and parses JSON receipts", async () => {
  const dom = makeDom(WATCHLIST_PATH, "https://reputifly.org/watchlist/");
  try {
    const calls = [];
    dom.window.__rflyToken = async () => "firebase-id-token";
    dom.window.fetch = async (url, options) => {
      calls.push({ url, options });
      return response(success({ leads: [], actors: {} }, true), 200, { "x-request-id": "req-1" });
    };
    executeClassic(dom, WATCHLIST_PATH);
    const result = await dom.window.__api("/v1/leads", { attempts: 1 });
    assert.deepEqual(JSON.parse(JSON.stringify(result)), success({ leads: [], actors: {} }, true));
    assert.equal(calls[0].url, `${API_BASE}/v1/leads`);
    assert.equal(calls[0].options.headers.Authorization, "Bearer firebase-id-token");
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(calls[0].options.credentials, "omit");
  } finally {
    dom.window.close();
  }
});

test("watchlist uses strict lead routes, revisions, and duplicate-safe create keys", () => {
  const html = read(WATCHLIST_PATH);
  assert.match(html, /apiRequest\(["']\/v1\/leads["'],\s*\{/);
  assert.match(html, /method\s*:\s*["']POST["'][\s\S]{0,140}Idempotency-Key/);
  assert.match(html, /\/v1\/leads\/"\+encodeURIComponent\(wanted\.id\)/);
  assert.match(html, /method\s*:\s*["']PUT["']/);
  assert.match(html, /body\.expectedRevision\s*=\s*revision/);
  assert.match(html, /\/archive["'],\s*\{[\s\S]{0,100}expectedRevision/);
  assert.match(html, /missing_receipt/);
  assert.match(html, /Save not confirmed/);
});

test("watchlist waits for a canonical create receipt before showing a lead", async () => {
  const dom = makeDom(WATCHLIST_PATH, "https://reputifly.org/watchlist/");
  try {
    dom.window.__rflyToken = async () => "firebase-id-token";
    let resolveFetch;
    let request;
    dom.window.fetch = (url, options) => {
      request = { url, options };
      return new Promise((resolve) => { resolveFetch = resolve; });
    };
    executeClassic(dom, WATCHLIST_PATH);
    dom.window.rows = [];
    dom.window.loaded = true;
    dom.window.render();
    const wanted = { name: "Receipt Lead", phone: "9123 0000", note: "Wait for server", followUp: "" };
    const pending = dom.window.createRow(wanted, "lead-create:testreceipt", "Saved", false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dom.window.rows.length, 0, "no optimistic row before receipt");
    assert.deepEqual(JSON.parse(request.options.body), wanted);
    assert.equal(request.options.headers["Idempotency-Key"], "lead-create:testreceipt");

    resolveFetch(response(success({
      lead: {
        ...wanted,
        id: "lead_server_receipt",
        status: "active",
        revision: 1,
        createdAt: "2026-08-13T10:00:00.000Z",
        updatedAt: "2026-08-13T10:00:00.000Z",
      },
      replayed: false, actors: {},
    }), 201));
    await pending;
    assert.equal(dom.window.rows.length, 1);
    assert.equal(dom.window.rows[0].id, "lead_server_receipt");
    assert.equal(dom.window.rows[0].revision, 1);
  } finally {
    dom.window.close();
  }
});

test("watchlist update stays canonical while in flight and sends expectedRevision", async () => {
  const dom = makeDom(WATCHLIST_PATH, "https://reputifly.org/watchlist/");
  try {
    dom.window.__rflyToken = async () => "firebase-id-token";
    let resolveFetch;
    let request;
    dom.window.fetch = (url, options) => {
      request = { url, options };
      return new Promise((resolve) => { resolveFetch = resolve; });
    };
    executeClassic(dom, WATCHLIST_PATH);
    const original = {
      id: "lead_revision_test", name: "Before", phone: "9111 1111",
      note: "Original", followUp: "", status: "active", revision: 4,
      createdAt: "2026-08-13T10:00:00.000Z", updatedAt: "2026-08-13T10:00:00.000Z",
    };
    dom.window.rows = [original];
    dom.window.loaded = true;
    dom.window.render();
    const wanted = { ...original, name: "After", note: "Canonical receipt", revision: 4 };
    const pending = dom.window.updateRow(wanted, "Saved");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dom.window.rows[0].name, "Before", "no optimistic mutation while request is pending");
    const body = JSON.parse(request.options.body);
    assert.equal(body.expectedRevision, 4);
    assert.deepEqual(Object.keys(body).sort(), ["expectedRevision", "followUp", "name", "note", "phone"]);

    resolveFetch(response(success({ lead: { ...wanted, revision: 5, updatedAt: "2026-08-13T10:01:00.000Z" }, actors: {} })));
    await pending;
    assert.equal(dom.window.rows[0].name, "After");
    assert.equal(dom.window.rows[0].revision, 5);
  } finally {
    dom.window.close();
  }
});

test("watchlist localhost preview is seeded and cannot issue a live write", () => {
  const dom = makeDom(WATCHLIST_PATH);
  try {
    let fetchCount = 0;
    dom.window.fetch = async () => {
      fetchCount += 1;
      throw new Error("preview must never call fetch");
    };
    executeClassic(dom, WATCHLIST_PATH);
    dom.window.__boot();
    assert.equal(dom.window.PREVIEW, true);
    assert.equal(dom.window.document.getElementById("pvBanner").style.display, "");
    assert.ok(dom.window.document.querySelectorAll(".wcard").length >= 4);

    dom.window.document.getElementById("addBtn").click();
    dom.window.document.getElementById("wName").value = "Preview Person";
    dom.window.document.getElementById("wNote").value = "Local-only contract test";
    dom.window.document.getElementById("sheetSave").click();
    assert.equal(fetchCount, 0);
    assert.match(dom.window.localStorage.getItem("rfly_watchlist_preview_v2"), /Preview Person/);
  } finally {
    dom.window.close();
  }
});

test("digest contract persists a retry key and requires an acceptance receipt", () => {
  const html = read(DIGEST_PATH);
  assert.match(html, /submission:submitSnapshot/);
  assert.match(html, /body:\{idempotencyKey:frozen\.idempotencyKey,payload:frozen\.payload\}/);
  assert.match(html, /data\.accepted!==true/);
  assert.match(html, /typeof data\.digestId!==["']string["']/);
  assert.match(html, /receiptPersisted=receiptSave\(receipt\)[\s\S]{0,300}if\(receiptPersisted\)[\s\S]{0,300}removeItem\(submittedDraftKey\)/);
  assert.match(html, /\/v1\/digests\/"\+encodeURIComponent\(activeReceipt\.digestId\)/);
  assert.match(html, /Telegram pending/);
  assert.match(html, /Telegram failed/);
  assert.match(html, /Telegram delivered/);
});

test("digest localhost preview keeps its draft and makes no request", async () => {
  const dom = makeDom(DIGEST_PATH);
  try {
    let fetchCount = 0;
    dom.window.fetch = async () => {
      fetchCount += 1;
      throw new Error("preview must never call fetch");
    };
    executeClassic(dom, DIGEST_PATH);
    dom.window.__boot();
    dom.window.document.getElementById("leadPills").children[2].click();
    dom.window.document.getElementById("samplePills").children[1].click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 350));
    dom.window.document.getElementById("submitBtn").click();
    assert.equal(fetchCount, 0);
    const key = `rfly_digest_draft_v6:${dom.window.activeBusinessDate}`;
    const draft = JSON.parse(dom.window.localStorage.getItem(key));
    assert.match(draft.idempotencyKey, /^digest:/);
    assert.equal(draft.data.newLeads, 2);
    assert.equal(draft.data.samplesSent, 1);
  } finally {
    dom.window.close();
  }
});

test("digest clears the draft only after accepted=true plus digestId", async () => {
  const dom = makeDom(DIGEST_PATH, "https://reputifly.org/daily-digest/");
  try {
    dom.window.__rflyToken = async () => "firebase-id-token";
    dom.window.fetch = async (url, options) => {
      if (url.endsWith("/v1/digests") && options.method === "POST") {
        return response(success({
          accepted: true, digestId: "digest_receipt_1", businessDate: META.businessDate,
          deliveryStatus: "pending", acceptedAt: META.serverTime, acceptedBy: "member_self",
          replayed: false, actors: { member_self: { label: "Employee" } },
        }), 202);
      }
      return response(success({ digest: {
        id: "digest_receipt_1", businessDate: META.businessDate, payload: {},
        acceptedAt: META.serverTime, acceptedBy: "member_self", deliveryStatus: "sent",
        deliveredAt: "2026-08-14T01:01:00.000Z", telegramMessageId: "99",
      }, actors: { member_self: { label: "Employee" } } }, true));
    };
    executeClassic(dom, DIGEST_PATH);
    dom.window.currentIdentity = { uid: "member_self" };
    dom.window.currentMember = { role: "member" };
    dom.window.activeBusinessDate = META.businessDate;
    dom.window.setStorageKeys(META.businessDate);
    dom.window.updateDayLabels();
    dom.window.document.getElementById("leadPills").children[0].click();
    dom.window.document.getElementById("samplePills").children[0].click();
    dom.window.saveNow();
    const draftKey = `rfly_digest_draft_v6:${META.businessDate}`;
    assert.ok(dom.window.localStorage.getItem(draftKey));
    await dom.window.submitDigest();
    assert.equal(dom.window.localStorage.getItem(draftKey), null);
    const receipt = JSON.parse(dom.window.localStorage.getItem(`rfly_digest_receipt_v2:${META.businessDate}`));
    assert.equal(receipt.digestId, "digest_receipt_1");
    assert.match(dom.window.document.getElementById("deliveryTimeline").textContent, /Digest accepted/);
    dom.window.clearTimeout(dom.window.deliveryPollTimer);
    if (dom.window.dailyStatusLoading) await dom.window.dailyStatusLoading;
  } finally {
    dom.window.close();
  }
});

test("a malformed success never clears a recoverable digest draft", async () => {
  const dom = makeDom(DIGEST_PATH, "https://reputifly.org/daily-digest/");
  try {
    dom.window.__rflyToken = async () => "firebase-id-token";
    dom.window.fetch = async () => response(success({ accepted: true, deliveryStatus: "pending" }), 202);
    executeClassic(dom, DIGEST_PATH);
    dom.window.currentIdentity = { uid: "member_self" };
    dom.window.currentMember = { role: "member" };
    dom.window.activeBusinessDate = META.businessDate;
    dom.window.setStorageKeys(META.businessDate);
    dom.window.updateDayLabels();
    dom.window.document.getElementById("leadPills").children[1].click();
    dom.window.document.getElementById("samplePills").children[1].click();
    await dom.window.submitDigest();
    const draft = JSON.parse(dom.window.localStorage.getItem(`rfly_digest_draft_v6:${META.businessDate}`));
    assert.ok(draft.submission.idempotencyKey);
    assert.equal(dom.window.localStorage.getItem(`rfly_digest_receipt_v2:${META.businessDate}`), null);
    assert.match(dom.window.document.getElementById("syncText").textContent, /not confirmed/i);
  } finally {
    dom.window.close();
  }
});

test("digest cannot submit with either required count missing", async () => {
  const dom = makeDom(DIGEST_PATH, "https://reputifly.org/daily-digest/");
  try {
    let postCount = 0;
    dom.window.__rflyToken = async () => "firebase-id-token";
    dom.window.fetch = async (url, options) => {
      if (options && options.method === "POST") postCount += 1;
      return response(success({
        status: {
          businessDate: META.businessDate, timeZone: "Asia/Singapore",
          subject: { uid: "member_self", label: "Employee" },
          recordedToday: { total: 0, byKind: { leadCreated: 0, leadUpdated: 0, leadArchived: 0, followUpLogged: 0, digestAccepted: 0 } },
          digest: { state: "not_submitted" },
        }, actors: { member_self: { label: "Employee" } },
      }, true));
    };
    executeClassic(dom, DIGEST_PATH);
    dom.window.currentIdentity = { uid: "member_self" };
    dom.window.currentMember = { role: "member" };
    dom.window.activeBusinessDate = META.businessDate;
    dom.window.setStorageKeys(META.businessDate);
    dom.window.updateDayLabels();
    dom.window.document.getElementById("leadPills").children[1].click();
    await dom.window.submitDigest();
    assert.equal(postCount, 0);
    assert.equal(dom.window.submitSnapshot, null);
    assert.match(dom.window.document.getElementById("toastTxt").textContent, /two numbers/i);
  } finally {
    dom.window.close();
  }
});

test("digest payload date is derived from the canonical Singapore business day", () => {
  const dom = makeDom(DIGEST_PATH);
  try {
    executeClassic(dom, DIGEST_PATH);
    dom.window.__boot(session());
    const expected = dom.window.payloadDate(META.businessDate);
    assert.equal(dom.window.payload().date, expected);
    assert.match(dom.window.payload().date, /^[A-Za-z]{3}, \d{1,2} [A-Za-z]{3}$/);
    assert.match(read(DIGEST_PATH), /nextBusinessBoundary&&Date\.now\(\)\+serverClockOffset>=nextBusinessBoundary/);
  } finally {
    dom.window.close();
  }
});

test("accepted digest keeps its frozen draft when receipt storage throws", async () => {
  const dom = makeDom(DIGEST_PATH, "https://reputifly.org/daily-digest/");
  try {
    dom.window.__rflyToken = async () => "firebase-id-token";
    dom.window.fetch = async () => response({
      ...success({}), accepted: true, digestId: "digest_storage_failure",
      businessDate: META.businessDate, deliveryStatus: "pending",
      acceptedAt: META.serverTime, acceptedBy: "member_self", replayed: false, actors: {},
    }, 202);
    executeClassic(dom, DIGEST_PATH);
    dom.window.__boot(session());
    dom.window.document.getElementById("leadPills").children[2].click();
    dom.window.document.getElementById("samplePills").children[3].click();

    const storageProto = dom.window.Storage.prototype;
    const originalSet = storageProto.setItem;
    storageProto.setItem = function setItem(key, value) {
      if (key === `rfly_digest_receipt_v2:${META.businessDate}`) throw new dom.window.DOMException("Quota exceeded", "QuotaExceededError");
      return originalSet.call(this, key, value);
    };

    await dom.window.submitDigest();
    assert.equal(dom.window.localStorage.getItem(`rfly_digest_receipt_v2:${META.businessDate}`), null);
    const draft = JSON.parse(dom.window.localStorage.getItem(`rfly_digest_draft_v6:${META.businessDate}`));
    assert.equal(draft.submission.idempotencyKey, draft.idempotencyKey);
    assert.equal(draft.submission.payload.newLeads, 2);
    assert.equal(draft.submission.payload.samplesSent, 3);
    assert.match(dom.window.document.getElementById("syncText").textContent, /could not save the receipt/i);
    assert.match(dom.window.document.getElementById("deliveryTimeline").textContent, /digest_storage_failure/);
  } finally {
    dom.window.close();
  }
});

test("desktop layout is same-DOM, sticky only at 1100px, and mobile remains single-column", () => {
  const watch = read(WATCHLIST_PATH);
  const digest = read(DIGEST_PATH);
  for (const html of [watch, digest]) {
    assert.match(html, /@media \(min-width:1100px\)/);
    assert.doesNotMatch(html, /@media[^}]*max-width[^}]*display\s*:\s*none[^}]*digest-(?:rail|editor)/i);
    const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""));
    const ids = [...dom.window.document.querySelectorAll("[id]")].map((el) => el.id);
    assert.equal(new Set(ids).size, ids.length, "no cloned desktop/mobile IDs");
    dom.window.close();
  }
  assert.match(digest, /\.digest-workspace[\s\S]{0,220}grid-template-columns/);
  assert.match(digest, /\.digest-rail[\s\S]{0,180}position:sticky/);
  assert.equal((digest.match(/id="submitBtn"/g) || []).length, 1);
  assert.equal((digest.match(/id="sumGrid"/g) || []).length, 1);
  assert.match(watch, /\.wcard\{ display:grid; grid-template-columns/);
  assert.match(watch, /min-height:92px/);
  assert.match(watch, /min-height:44px/);
});

test("server proof requires canonical meta and read dataAsOf equality", () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const html = read(file);
    assert.match(html, /function requireCanonicalSuccess\(envelope,isRead\)/);
    assert.match(html, /isRead&&envelope\.dataAsOf!==meta\.serverTime/);
    assert.match(html, /meta\.businessDate/);
    assert.match(html, /meta\.requestId/);
    assert.match(html, /server verified/);
    assert.match(html, /Support details/);
  }
});

test("watchlist actor labels escape safely and never render raw UIDs", () => {
  const dom = makeDom(WATCHLIST_PATH);
  try {
    executeClassic(dom, WATCHLIST_PATH);
    dom.window.acceptActors({ uid_secret_123: { label: '<img src=x onerror="boom">' } });
    dom.window.rows = [{
      id: "lead_actor", name: "Actor Test", phone: "", note: "Safe",
      followUp: "", revision: 1, status: "active", updatedBy: "uid_secret_123",
      updatedAt: "2026-08-14T01:00:00.000Z",
    }];
    dom.window.loaded = true;
    dom.window.render();
    const card = dom.window.document.querySelector(".wcard");
    assert.match(card.textContent, /<img src=x onerror="boom">/);
    assert.equal(card.querySelector("img"), null, "label is text, not executable markup");
    assert.doesNotMatch(card.textContent, /uid_secret_123/);
    assert.doesNotMatch(dom.window.provenanceFor(dom.window.rows[0]), /uid_secret_123/);
  } finally {
    dom.window.close();
  }
});

test("all follow-up outcomes use one idempotent transactional endpoint and no optimistic accounting", async () => {
  const html = read(WATCHLIST_PATH);
  for (const outcome of ["no_reply", "spoke", "won", "lost"]) {
    assert.match(html, new RegExp(`data-outcome="${outcome}"`));
  }
  assert.match(html, /\/follow-ups/);
  assert.match(html, /Idempotency-Key/);
  assert.match(html, /nextFollowUp/);
  assert.match(html, /resultingRevision/);
  assert.match(html, /terminal follow-up was not archived/);
  assert.match(html, /No outcome is counted|no outcome is counted/i);
  assert.match(html, /\.sheet \[hidden\]\{ display:none !important; \}/);
  assert.doesNotMatch(html, /data-done=/);

  const dom = makeDom(WATCHLIST_PATH, "https://reputifly.org/watchlist/");
  try {
    dom.window.__rflyToken = async () => "firebase-id-token";
    let resolveFetch;
    dom.window.fetch = () => new Promise((resolve) => { resolveFetch = resolve; });
    executeClassic(dom, WATCHLIST_PATH);
    const lead = {
      id: "lead_follow", name: "Follow Test", phone: "", note: "Audit",
      followUp: META.businessDate, revision: 4, status: "active",
      updatedAt: META.serverTime, updatedBy: "member_self",
    };
    dom.window.rows = [lead]; dom.window.loaded = true; dom.window.businessDate = META.businessDate; dom.window.render();
    const item = {
      key: "follow-up:test", leadId: lead.id, outcome: "spoke",
      body: { expectedRevision: 4, outcome: "spoke", nextFollowUp: "2026-08-15" },
    };
    dom.window.pendingFollowUpSave(item);
    const pending = dom.window.logFollowUp(item, false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dom.window.rows[0].revision, 4, "no optimistic lead revision");
    assert.equal(dom.window.document.getElementById("dailyStatusPanel").hidden, true, "no optimistic accountability count");
    resolveFetch(response(success({
      lead: { ...lead, followUp: "2026-08-15", revision: 5, updatedAt: META.serverTime },
      followUp: {
        id: "follow_receipt", leadId: lead.id, outcome: "spoke", nextFollowUp: "2026-08-15",
        occurredAt: META.serverTime, businessDate: META.businessDate,
        actorUid: "member_self", resultingRevision: 5,
      },
      replayed: false, actors: { member_self: { label: "Employee" } },
    }), 201));
    await pending;
    assert.equal(dom.window.rows[0].revision, 5);
    assert.equal(dom.window.localStorage.getItem("rfly_watchlist_pending_followup_v1"), null);
  } finally {
    dom.window.close();
  }
});

test("daily status is neutral, server-only, and owner team scope is one configured employee", () => {
  for (const file of [WATCHLIST_PATH, DIGEST_PATH]) {
    const html = read(file);
    assert.match(html, /id="dailyStatusPanel"/);
    assert.match(html, /Recorded today/);
    assert.match(html, /\/v1\/daily-status/);
    assert.match(html, /\/v1\/team\/daily-status/);
    assert.match(html, /currentMember\.role==="owner"/);
    assert.match(html, /status\.recordedToday/);
    assert.doesNotMatch(html, /score|leaderboard|deadline reminder/i);
  }
});

test("midnight rollover preserves prior day-scoped draft and starts from server businessDate", () => {
  const dom = makeDom(DIGEST_PATH, "https://reputifly.org/daily-digest/");
  try {
    executeClassic(dom, DIGEST_PATH);
    dom.window.currentMember = { role: "member" };
    dom.window.activeBusinessDate = META.businessDate;
    dom.window.setStorageKeys(META.businessDate);
    dom.window.updateDayLabels();
    dom.window.document.getElementById("leadPills").children[2].click();
    dom.window.document.getElementById("samplePills").children[3].click();
    dom.window.saveNow();
    const oldKey = `rfly_digest_draft_v6:${META.businessDate}`;
    assert.ok(dom.window.localStorage.getItem(oldKey));
    dom.window.acceptCanonicalContext(success({}, false));
    dom.window.acceptCanonicalContext({ meta: {
      serverTime: "2026-08-14T16:00:02.000Z", requestId: "req_rollover", businessDate: "2026-08-15",
    }});
    assert.equal(dom.window.activeBusinessDate, "2026-08-15");
    assert.ok(dom.window.localStorage.getItem(oldKey), "previous-day draft preserved");
    assert.equal(dom.window.picked.leads, null);
    assert.equal(dom.window.picked.samples, null);
    assert.match(dom.window.document.getElementById("syncText").textContent, /new Singapore business day/i);
  } finally {
    dom.window.close();
  }
});

test("digest delivery timeline requires public proof fields and pauses bounded polling when hidden", () => {
  const dom = makeDom(DIGEST_PATH, "https://reputifly.org/daily-digest/");
  try {
    executeClassic(dom, DIGEST_PATH);
    dom.window.currentIdentity = { uid: "member_self" };
    dom.window.activeBusinessDate = META.businessDate;
    dom.window.setStorageKeys(META.businessDate);
    dom.window.updateDayLabels();
    const base = {
      businessDate: META.businessDate, accepted: true, digestId: "digest_pending",
      idempotencyKey: "digest:key", deliveryStatus: "sent", acceptedAt: META.serverTime,
      acceptedBy: "member_self", deliveredAt: "", telegramMessageId: "",
    };
    dom.window.showReceipt(base);
    assert.match(dom.window.document.getElementById("deliveryPill").textContent, /pending/i, "sent status alone is not delivered");
    assert.match(dom.window.document.getElementById("timelineBody").textContent, /Accepted is not the same as delivered/);
    dom.window.showReceipt({ ...base, deliveredAt: "2026-08-14T01:01:00.000Z", telegramMessageId: "42" });
    assert.match(dom.window.document.getElementById("deliveryPill").textContent, /delivered/i);
    assert.match(read(DIGEST_PATH), /var waits=\[[^\]]+\]/);
    assert.match(read(DIGEST_PATH), /if\(deliveryPollAttempts>=waits\.length\)return/);
    assert.match(read(DIGEST_PATH), /if\(document\.hidden\)return/);
    assert.doesNotMatch(read(DIGEST_PATH), /lastDeliveryError/);
  } finally {
    dom.window.close();
  }
});

test("cache and offline modes are never labelled Live", () => {
  const dom = makeDom(WATCHLIST_PATH, "https://reputifly.org/watchlist/");
  try {
    executeClassic(dom, WATCHLIST_PATH);
    dom.window.localStorage.setItem("rfly_watchlist_cache_v2", JSON.stringify({
      version: 3, rows: [], actors: {}, businessDate: META.businessDate,
    }));
    dom.window.__boot(null, { offline: true });
    const text = dom.window.document.getElementById("syncText").textContent;
    assert.match(text, /Saved copy/i);
    assert.doesNotMatch(text, /\bLive\b/i);
    assert.match(dom.window.document.getElementById("syncBanner").className, /is-stale/);
  } finally {
    dom.window.close();
  }
});
