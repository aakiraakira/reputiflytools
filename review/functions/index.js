const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

// ── Auth Middleware ──
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    // Fetch role from Firestore
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    req.userRole = userDoc.exists ? userDoc.data().role : null;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// ── Public: TNC Signature Submission (server-side for security) ──
app.post("/tnc-sign", async (req, res) => {
  try {
    const { orderId, email, companyName, profileUrl, quantity, representativeName, signingName, forensics } = req.body;
    if (!email || !companyName || !signingName || !orderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify order exists
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: "Order not found" });
    const order = orderDoc.data();
    if (order.tncSigned) return res.json({ success: true, alreadySigned: true });

    // Build signature record with full forensic metadata
    const sigData = {
      orderId,
      email,
      companyName,
      profileUrl,
      quantity: parseInt(quantity) || 0,
      representativeName,
      signingName,
      agreedToTnc: true,
      tncVersion: "T&C-2025-11-01",
      signedAt: admin.firestore.FieldValue.serverTimestamp(),
      signedAtIso: new Date().toISOString(),
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip || req.headers["x-forwarded-for"] || "",
      // Client-side forensic metadata
      screenResolution: forensics?.screenResolution || "",
      language: forensics?.language || "",
      platform: forensics?.platform || "",
      touchDevice: forensics?.touchDevice || false,
      consentTimestamp: forensics?.consentTimestamp || "",
      scrolledToBottom: forensics?.scrolledToBottom || false,
      timezone: forensics?.timezone || "",
    };

    // Create tamper-proof SHA-256 hash of the signature
    const hashInput = `${email}|${signingName}|${companyName}|${quantity}|${sigData.signedAtIso}|${sigData.ip}|${sigData.userAgent}`;
    sigData.signatureHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    // Store full T&C text version for immutability
    sigData.tncTextSnapshot = "Replacement cap: 30%. Appeal assistance: courtesy only. Page deletion: not responsible. Refunds: by approval. Progress proof: 1 screenshot = 1 review. Compliance: authorized representative. Electronic signature: Electronic Transactions Act (Singapore).";

    const sig = await db.collection("signatures").add(sigData);

    // Update order
    await db.collection("orders").doc(orderId).update({
      tncSigned: true,
      tncSignatureId: sig.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email via Reputifly API
    try {
      await fetch("https://asia-southeast1-b2b-software.cloudfunctions.net/reputifly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _to: "runikojane@gmail.com",
          _subject: `TNC Signed: ${companyName} (${quantity} reviews)`,
          _sender_name: "Review Dashboard",
          _auto_reply: true,
          _auto_reply_subject: "Your Agreement Has Been Recorded",
          _auto_reply_content: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto"><h2 style="color:#111">Agreement Confirmed</h2><p>Hi ${representativeName},</p><p>Your electronic signature for <strong>${companyName}</strong> (${quantity} reviews) has been recorded.</p><p><strong>Signed as:</strong> ${signingName}<br><strong>Date:</strong> ${new Date().toLocaleDateString("en-SG", { dateStyle: "full" })}</p><p>You can track your order progress at any time using the link provided.</p></div>`,
          "Signer Name": signingName,
          Company: companyName,
          Email: email,
          Quantity: quantity,
          email: email,
        }),
      });
    } catch (emailErr) {
      console.warn("TNC email notification failed:", emailErr.message);
    }

    res.json({ success: true, signatureId: sig.id });
  } catch (err) {
    console.error("TNC sign error:", err);
    res.status(500).json({ error: "Failed to save signature" });
  }
});

// ── Public: Get order for TNC/tracking (limited fields) ──
app.get("/order-public/:orderId", async (req, res) => {
  try {
    const doc = await db.collection("orders").doc(req.params.orderId).get();
    if (!doc.exists) return res.status(404).json({ error: "Order not found" });
    const o = doc.data();
    res.json({
      success: true,
      order: {
        companyName: o.companyName,
        quantity: o.quantity,
        dailyTarget: o.dailyTarget,
        completedCount: o.completedCount,
        startingCount: o.startingCount,
        status: o.status,
        tncSigned: o.tncSigned,
        reviewLink: o.reviewLink,
        clientTrackingToken: o.clientTrackingToken,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// ── Protected Routes ──
app.use(authenticate);

// -- Create Employee (Admin only) --
app.post("/create-employee", requireAdmin, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Create Firestore user doc with employee role
    await db.collection("users").doc(userRecord.uid).set({
      email,
      name,
      role: "employee",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, uid: userRecord.uid, email, name });
  } catch (err) {
    console.error("Create employee error:", err);
    if (err.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Email already in use" });
    }
    res.status(500).json({ error: err.message || "Failed to create employee" });
  }
});

// -- Reset Employee Password (Admin) --
app.post("/reset-password", requireAdmin, async (req, res) => {
  try {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) return res.status(400).json({ error: "uid and newPassword required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    await admin.auth().updateUser(uid, { password: newPassword });
    res.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -- Revoke Employee Access --
app.post("/revoke-employee", requireAdmin, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: "Employee UID required" });
    // Disable Firebase Auth account
    await admin.auth().updateUser(uid, { disabled: true });
    // Update Firestore role
    await db.collection("users").doc(uid).update({ role: "revoked", revokedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (err) {
    console.error("Revoke employee error:", err);
    res.status(500).json({ error: err.message || "Failed to revoke employee" });
  }
});

// -- Orders --
app.get("/orders", async (req, res) => {
  try {
    let query = db.collection("orders").orderBy("createdAt", "desc");
    if (req.userRole === "employee") {
      query = query.where("assignedEmployees", "array-contains", req.user.uid);
    } else if (req.userRole === "client") {
      query = query.where("clientId", "==", req.user.uid);
    }
    const snap = await query.get();
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Get orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.post("/orders", requireAdmin, async (req, res) => {
  try {
    const { clientId, companyName, profileUrl, placeId, reviewLink, quantity, dailyTarget, reviews, assignedEmployees } = req.body;
    const order = await db.collection("orders").add({
      clientId: clientId || null,
      companyName,
      profileUrl: profileUrl || "",
      placeId: placeId || "",
      reviewLink: reviewLink || "",
      quantity: parseInt(quantity) || 0,
      dailyTarget: parseInt(dailyTarget) || 5,
      completedCount: 0,
      status: "active",
      assignedEmployees: assignedEmployees || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Batch-add reviews as subcollection
    if (reviews && reviews.length > 0) {
      const batch = db.batch();
      reviews.forEach((r, i) => {
        const ref = db.collection("orders").doc(order.id).collection("reviews").doc();
        batch.set(ref, {
          text: r.text,
          index: i,
          status: "pending",
          assignedTo: null,
          postedAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// -- Proof Upload (Employee) --
app.post("/orders/:orderId/proofs", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reviewId, imageBase64, note } = req.body;

    // Validate employee is assigned
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: "Order not found" });
    const order = orderDoc.data();
    if (req.userRole === "employee" && !(order.assignedEmployees || []).includes(req.user.uid)) {
      return res.status(403).json({ error: "Not assigned to this order" });
    }

    // Upload screenshot to Storage
    const bucket = storage.bucket();
    const fileName = `proofs/${orderId}/${Date.now()}_${req.user.uid}.webp`;
    const file = bucket.file(fileName);
    const buffer = Buffer.from(imageBase64, "base64");
    const dlToken = crypto.randomUUID();
    await file.save(buffer, { contentType: "image/webp", metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: dlToken } } });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${dlToken}`;

    // Save proof record
    const proof = await db.collection("orders").doc(orderId).collection("proofs").add({
      reviewId: reviewId || null,
      employeeId: req.user.uid,
      imageUrl: url,
      storagePath: fileName,
      note: note || "",
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update review status if linked
    if (reviewId) {
      await db.collection("orders").doc(orderId).collection("reviews").doc(reviewId).update({
        status: "done",
        completedBy: req.user.uid,
        proofId: proof.id,
        postedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Increment completed count
    await db.collection("orders").doc(orderId).update({
      completedCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, proofId: proof.id, imageUrl: url });
  } catch (err) {
    console.error("Proof upload error:", err);
    res.status(500).json({ error: "Failed to upload proof" });
  }
});

// -- Assign Reviews to Employee --
app.post("/orders/:orderId/assign", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { employeeUid, reviewIds, count } = req.body;
    if (!employeeUid) return res.status(400).json({ error: "Employee UID required" });

    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: "Order not found" });

    // If reviewIds provided, assign those specific reviews
    if (reviewIds && reviewIds.length > 0) {
      const batch = db.batch();
      for (const rid of reviewIds) {
        batch.update(db.collection("orders").doc(orderId).collection("reviews").doc(rid), {
          assignedTo: employeeUid,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // Update order assignedEmployees array
    await db.collection("orders").doc(orderId).update({
      assignedEmployees: admin.firestore.FieldValue.arrayUnion(employeeUid),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, assigned: reviewIds?.length || count || 0 });
  } catch (err) {
    console.error("Assign reviews error:", err);
    res.status(500).json({ error: "Failed to assign reviews" });
  }
});

// -- Push Reviews to Firestore (from client IndexedDB) --
app.post("/orders/:orderId/reviews", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reviews } = req.body;
    if (!reviews || !Array.isArray(reviews)) return res.status(400).json({ error: "Reviews array required" });

    const batch = db.batch();
    reviews.forEach((r, i) => {
      const ref = db.collection("orders").doc(orderId).collection("reviews").doc();
      batch.set(ref, {
        text: r.text || r,
        index: i,
        status: "pending",
        assignedTo: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    res.json({ success: true, count: reviews.length });
  } catch (err) {
    console.error("Push reviews error:", err);
    res.status(500).json({ error: "Failed to push reviews" });
  }
});

// -- Get Reviews for an Order (employee sees assigned ones) --
app.get("/orders/:orderId/reviews", async (req, res) => {
  try {
    const { orderId } = req.params;
    let query = db.collection("orders").doc(orderId).collection("reviews").orderBy("index");
    // Employees only see their assigned reviews
    if (req.userRole === "employee") {
      query = db.collection("orders").doc(orderId).collection("reviews")
        .where("assignedTo", "==", req.user.uid)
        .orderBy("index");
    }
    const snap = await query.get();
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, reviews });
  } catch (err) {
    console.error("Get reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// -- AI Review Generation --
app.post("/generate-reviews", authenticate, async (req, res) => {
  try {
    const { companyName, context, quantity, model, aiNotes } = req.body;
    const GEMINI_KEY = process.env.GEMINI_KEY;
    if (!GEMINI_KEY) return res.status(500).json({ error: "Gemini API key not configured" });

    const geminiModel = model === "quality" ? "gemini-3.1-flash-lite" : "gemini-2.5-flash-lite";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_KEY}`;

    const prompt = buildReviewPrompt(companyName, context, quantity || 50, aiNotes);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Gemini error ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const reviews = cleanAiResponse(aiText);

    res.json({ success: true, reviews, model: geminiModel });
  } catch (err) {
    console.error("AI generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -- Export Proofs as ZIP --
app.get("/orders/:orderId/export-proofs", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const JSZip = require("jszip");
    const zip = new JSZip();

    const proofsSnap = await db.collection("orders").doc(orderId).collection("proofs").orderBy("uploadedAt").get();
    if (proofsSnap.empty) return res.status(404).json({ error: "No proofs found" });

    const bucket = storage.bucket();
    for (const doc of proofsSnap.docs) {
      const proof = doc.data();
      if (proof.storagePath) {
        const [fileBuffer] = await bucket.file(proof.storagePath).download();
        const name = proof.storagePath.split("/").pop();
        zip.file(name, fileBuffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="proofs_${orderId}.zip"`,
    });
    res.send(zipBuffer);
  } catch (err) {
    console.error("Export proofs error:", err);
    res.status(500).json({ error: "Failed to export proofs" });
  }
});

// -- Cleanup old proofs (scheduled) --
// Runs daily, deletes proof images for completed/exported orders older than 30 days
exports.cleanupOldProofs = onSchedule("every 24 hours", async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const oldOrders = await db.collection("orders")
    .where("status", "==", "completed")
    .where("updatedAt", "<", cutoff)
    .get();

  const bucket = storage.bucket();
  for (const orderDoc of oldOrders.docs) {
    const proofsSnap = await orderDoc.ref.collection("proofs").get();
    for (const proofDoc of proofsSnap.docs) {
      const proof = proofDoc.data();
      if (proof.storagePath) {
        try { await bucket.file(proof.storagePath).delete(); } catch (e) { /* already deleted */ }
      }
    }
  }
});

// ── Helpers ──
function buildReviewPrompt(companyName, context, quantity, aiNotes) {
  const extraInstructions = aiNotes?.trim() ? `\nADDITIONAL INSTRUCTIONS (CRITICAL): ${aiNotes.trim()}\n` : "";
  const nameInstruction = companyName
    ? `Mention "${companyName}" in only 5-7 reviews. For the rest, use general terms like "this place," "the team," "the staff."`
    : `Do NOT mention any specific company name.`;

  return `You are an expert copywriter creating authentic Google reviews.
TASK: Generate ${quantity} realistic positive Google reviews based on the context below.
CONTEXT: ${context || "General positive business experience"}
${extraInstructions}RULES:
1. Output ONLY reviews separated by double newlines. No numbering, no titles, no separators.
2. Mix lengths: 80% detailed narratives (3-6 sentences), 20% short punchy reviews (1-2 sentences).
3. Vary structure: problem-solver, skeptic-turned-believer, direct recommendation, feeling-focused, long-term customer.
4. Use natural varied language. Different perspectives, tones, sentence structures.
5. ${nameInstruction}
6. A few reviews should mention a minor hesitation before giving praise for authenticity.
7. Do NOT invent specific names, numbers, or details not in the context. Use vague language instead.`;
}

function cleanAiResponse(aiText) {
  const parts = aiText.trim().split(/\n\s*\n/);
  const firstIdx = parts.findIndex((p) => p.length > 25 && !/^\s*(here are|sure|absolutely)/i.test(p));
  const cleaned = firstIdx !== -1 ? parts.slice(firstIdx) : parts;
  return cleaned.map((text) => text.replace(/[*_]/g, "").trim()).filter((t) => t.length > 10);
}

// ── Export Express App as Cloud Function ──
// -- Delete Order (Admin) --
app.delete("/orders/:orderId", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    // Delete subcollections first
    const reviewsSnap = await db.collection("orders").doc(orderId).collection("reviews").get();
    const proofsSnap = await db.collection("orders").doc(orderId).collection("proofs").get();
    const batch = db.batch();
    reviewsSnap.docs.forEach(d => batch.delete(d.ref));
    proofsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection("orders").doc(orderId));
    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// -- Daily Report (Employee submits end-of-day progress) --
app.post("/daily-report", authenticate, async (req, res) => {
  try {
    const { entries, date } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "Entries array required" });
    }
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const userName = userDoc.exists ? userDoc.data().name : req.user.email;

    const reportId = `${date || new Date().toISOString().split('T')[0]}_${req.user.uid}`;
    await db.collection("dailyReports").doc(reportId).set({
      date: date || new Date().toISOString().split('T')[0],
      employeeId: req.user.uid,
      employeeName: userName,
      entries,
      status: "pending_approval",
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalReviews: entries.reduce((sum, e) => sum + (e.reviewsClaimed || 0), 0),
      totalScreenshots: entries.reduce((sum, e) => sum + (e.screenshotsCount || 0), 0),
    }, { merge: true });

    res.json({ success: true, reportId });
  } catch (err) {
    console.error("Daily report error:", err);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

// -- Get Daily Reports (Admin) --
app.get("/daily-reports", requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("dailyReports")
      .orderBy("submittedAt", "desc")
      .limit(50)
      .get();
    const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, reports });
  } catch (err) {
    console.error("Get daily reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// -- Approve Daily Report (Admin) --
app.post("/daily-report/:reportId/approve", requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { editedEntries } = req.body; // Admin may have edited counts

    const reportRef = db.collection("dailyReports").doc(reportId);
    const reportDoc = await reportRef.get();
    if (!reportDoc.exists) return res.status(404).json({ error: "Report not found" });

    const report = reportDoc.data();
    const entriesToUse = editedEntries || report.entries;

    // Update each order's completedCount
    const batch = db.batch();
    for (const entry of entriesToUse) {
      if (entry.orderId && entry.reviewsClaimed > 0) {
        const orderRef = db.collection("orders").doc(entry.orderId);
        batch.update(orderRef, {
          completedCount: admin.firestore.FieldValue.increment(entry.reviewsClaimed),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Mark report as approved
    batch.update(reportRef, {
      status: "approved",
      entries: entriesToUse,
      approvedBy: req.user.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalReviews: entriesToUse.reduce((sum, e) => sum + (e.reviewsClaimed || 0), 0),
    });

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error("Approve report error:", err);
    res.status(500).json({ error: "Failed to approve report" });
  }
});

// -- Upload Proof Image (returns URL) --
app.post("/upload-proof", authenticate, async (req, res) => {
  try {
    const { orderId, imageBase64, date } = req.body;
    if (!orderId || !imageBase64) return res.status(400).json({ error: "orderId and imageBase64 required" });

    const bucket = storage.bucket();
    const dateStr = date || new Date().toISOString().split('T')[0];
    const fileName = `proofs/${orderId}/${dateStr}_${Date.now()}_${req.user.uid}.webp`;
    const file = bucket.file(fileName);
    const buffer = Buffer.from(imageBase64, "base64");
    const downloadToken = crypto.randomUUID();
    await file.save(buffer, {
      contentType: "image/webp",
      metadata: {
        cacheControl: "public, max-age=31536000",
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;

    res.json({ success: true, imageUrl: url, storagePath: fileName });
  } catch (err) {
    console.error("Upload proof error:", err);
    res.status(500).json({ error: "Failed to upload proof" });
  }
});

exports.api = onRequest({ region: "us-central1", memory: "512MiB", timeoutSeconds: 300, invoker: "public" }, app);
