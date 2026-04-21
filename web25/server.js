const express = require("express");
const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");
const bs58mod = require("bs58");
const bs58 = bs58mod.default || bs58mod;
const { nanoid } = require("nanoid");
const {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");

const PORT = process.env.PORT || 8787;
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
const connection = new Connection(RPC_URL, "confirmed");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const challenges = new Map();
const sessions = new Map();

function ensureDb() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        {
          users: [],
          adRequests: [],
          paymentLinks: [],
          notifications: [],
        },
        null,
        2
      )
    );
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getAuth(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  return sessions.get(token) || null;
}

function requireAuth(req, res, next) {
  const session = getAuth(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  req.session = session;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).json({ error: `Requires role ${role}` });
    }
    next();
  };
}

function toLamports(sol) {
  return Math.round(Number(sol) * LAMPORTS_PER_SOL);
}

function userByWallet(db, wallet) {
  return db.users.find((u) => u.walletAddress === wallet);
}

function safeWallet(wallet) {
  try {
    return new PublicKey(wallet).toBase58();
  } catch {
    return null;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rpcUrl: RPC_URL, ts: Date.now() });
});

app.post("/api/auth/challenge", (req, res) => {
  const walletAddress = safeWallet(req.body?.walletAddress);
  const role = req.body?.role;

  if (!walletAddress) return res.status(400).json({ error: "Invalid wallet" });
  if (!["recipient", "advertiser"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const nonce = nanoid(20);
  const issuedAt = Date.now();
  const message = `OpenClaw Paid Ads Login\nwallet=${walletAddress}\nrole=${role}\nnonce=${nonce}\nissuedAt=${issuedAt}`;

  challenges.set(`${walletAddress}:${role}:${nonce}`, {
    walletAddress,
    role,
    nonce,
    message,
    issuedAt,
    expiresAt: issuedAt + 5 * 60 * 1000,
  });

  res.json({ walletAddress, role, nonce, message, expiresAt: issuedAt + 5 * 60 * 1000 });
});

app.post("/api/auth/verify", (req, res) => {
  const walletAddress = safeWallet(req.body?.walletAddress);
  const role = req.body?.role;
  const nonce = req.body?.nonce;
  const signatureBase58 = req.body?.signature;

  if (!walletAddress || !role || !nonce || !signatureBase58) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const key = `${walletAddress}:${role}:${nonce}`;
  const challenge = challenges.get(key);
  if (!challenge) return res.status(400).json({ error: "Challenge not found" });
  if (Date.now() > challenge.expiresAt) return res.status(400).json({ error: "Challenge expired" });

  try {
    const msg = new TextEncoder().encode(challenge.message);
    const sig = bs58.decode(signatureBase58);
    const pubkey = new PublicKey(walletAddress).toBytes();
    const ok = nacl.sign.detached.verify(msg, sig, pubkey);
    if (!ok) return res.status(401).json({ error: "Invalid signature" });
  } catch (e) {
    return res.status(400).json({ error: `Verification failed: ${e.message}` });
  }

  const token = nanoid(40);
  sessions.set(token, {
    token,
    walletAddress,
    role,
    createdAt: Date.now(),
  });

  const db = readDb();
  let user = userByWallet(db, walletAddress);
  if (!user) {
    user = {
      id: nanoid(12),
      walletAddress,
      role,
      optedIn: false,
      preferences: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.users.push(user);
  } else {
    user.role = role;
    user.updatedAt = Date.now();
  }
  writeDb(db);

  challenges.delete(key);
  res.json({ token, walletAddress, role });
});

app.post("/api/recipient/opt-in", requireAuth, requireRole("recipient"), (req, res) => {
  const preferences = req.body?.preferences || {};
  const db = readDb();
  const user = userByWallet(db, req.session.walletAddress);
  user.optedIn = true;
  user.preferences = preferences;
  user.updatedAt = Date.now();
  writeDb(db);
  res.json({ ok: true, user });
});

app.get("/api/recipient/me", requireAuth, requireRole("recipient"), (req, res) => {
  const db = readDb();
  const user = userByWallet(db, req.session.walletAddress);
  res.json({ user });
});

app.post("/api/ads", requireAuth, requireRole("advertiser"), (req, res) => {
  const recipientWallet = safeWallet(req.body?.recipientWallet);
  const amountLamports = Number(req.body?.amountLamports || 0);
  const content = String(req.body?.content || "").trim();

  if (!recipientWallet) return res.status(400).json({ error: "Invalid recipient wallet" });
  if (!Number.isFinite(amountLamports) || amountLamports <= 0) {
    return res.status(400).json({ error: "Invalid amountLamports" });
  }
  if (!content) return res.status(400).json({ error: "Content required" });

  const db = readDb();
  const reqId = nanoid(12);
  const adRequest = {
    id: reqId,
    advertiserWallet: req.session.walletAddress,
    recipientWallet,
    amountLamports,
    content,
    status: "pending",
    txSignature: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  db.adRequests.push(adRequest);
  writeDb(db);
  res.json({ adRequest });
});

app.post("/api/ads/:id/submit-tx", requireAuth, requireRole("advertiser"), (req, res) => {
  const adId = req.params.id;
  const txSignature = String(req.body?.txSignature || "").trim();
  if (!txSignature) return res.status(400).json({ error: "txSignature required" });

  const db = readDb();
  const ad = db.adRequests.find((r) => r.id === adId);
  if (!ad) return res.status(404).json({ error: "Ad request not found" });
  if (ad.advertiserWallet !== req.session.walletAddress) {
    return res.status(403).json({ error: "Not your ad request" });
  }

  ad.txSignature = txSignature;
  ad.status = "submitted";
  ad.updatedAt = Date.now();

  db.paymentLinks.push({
    id: nanoid(12),
    adRequestId: ad.id,
    txSignature,
    confirmationStatus: "submitted",
    detectedAt: null,
    amountLamports: ad.amountLamports,
  });

  writeDb(db);
  res.json({ ok: true, adRequest: ad });
});

function txMatchesAd(parsedTx, ad) {
  if (!parsedTx || parsedTx.meta?.err) return false;
  const ix = parsedTx.transaction.message.instructions || [];

  let paid = 0;
  for (const i of ix) {
    if (i.program !== "system" || !i.parsed) continue;
    if (i.parsed.type !== "transfer") continue;
    const info = i.parsed.info || {};
    if (info.source === ad.advertiserWallet && info.destination === ad.recipientWallet) {
      paid += Number(info.lamports || 0);
    }
  }

  return paid >= ad.amountLamports;
}

app.post("/api/ads/:id/check-payment", requireAuth, (req, res) => {
  const adId = req.params.id;
  const db = readDb();
  const ad = db.adRequests.find((r) => r.id === adId);
  if (!ad) return res.status(404).json({ error: "Ad request not found" });

  if (![ad.advertiserWallet, ad.recipientWallet].includes(req.session.walletAddress)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  if (!ad.txSignature) return res.status(400).json({ error: "No tx signature submitted" });

  connection
    .getParsedTransaction(ad.txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })
    .then((tx) => {
      if (!tx) return res.json({ status: "pending", adRequest: ad });

      const match = txMatchesAd(tx, ad);
      if (!match) {
        ad.status = "mismatch";
        ad.updatedAt = Date.now();
        writeDb(db);
        return res.json({ status: "mismatch", adRequest: ad });
      }

      if (ad.status !== "confirmed" && ad.status !== "notified") {
        ad.status = "confirmed";
        ad.updatedAt = Date.now();

        const notif = {
          id: nanoid(12),
          recipientWallet: ad.recipientWallet,
          adRequestId: ad.id,
          content: ad.content,
          txSignature: ad.txSignature,
          shownAt: Date.now(),
          openedAt: null,
          dismissedAt: null,
        };
        db.notifications.push(notif);

        const pay = db.paymentLinks.find((p) => p.adRequestId === ad.id);
        if (pay) {
          pay.confirmationStatus = "confirmed";
          pay.detectedAt = Date.now();
        }

        writeDb(db);
      }

      res.json({ status: "confirmed", adRequest: ad });
    })
    .catch((e) => res.status(500).json({ error: e.message }));
});

app.get("/api/recipient/notifications", requireAuth, requireRole("recipient"), (req, res) => {
  const db = readDb();
  const notifications = db.notifications
    .filter((n) => n.recipientWallet === req.session.walletAddress)
    .sort((a, b) => b.shownAt - a.shownAt);

  res.json({ notifications });
});

app.post("/api/recipient/notifications/:id/:action", requireAuth, requireRole("recipient"), (req, res) => {
  const { id, action } = req.params;
  if (!["open", "dismiss"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const db = readDb();
  const n = db.notifications.find((x) => x.id === id && x.recipientWallet === req.session.walletAddress);
  if (!n) return res.status(404).json({ error: "Notification not found" });

  if (action === "open") n.openedAt = Date.now();
  if (action === "dismiss") n.dismissedAt = Date.now();

  const ad = db.adRequests.find((r) => r.id === n.adRequestId);
  if (ad && action === "dismiss") ad.status = "dismissed";
  if (ad && action === "open") ad.status = "notified";

  writeDb(db);
  res.json({ ok: true, notification: n });
});

app.get("/api/ads/:id", requireAuth, (req, res) => {
  const ad = readDb().adRequests.find((r) => r.id === req.params.id);
  if (!ad) return res.status(404).json({ error: "Not found" });
  res.json({ adRequest: ad });
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`web2.5 server running on http://localhost:${PORT}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`1 SOL = ${LAMPORTS_PER_SOL} lamports`);
});
