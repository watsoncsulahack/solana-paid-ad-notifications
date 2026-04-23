const { Connection, PublicKey, SystemProgram, Transaction, clusterApiUrl, LAMPORTS_PER_SOL } = solanaWeb3;

const api = "";
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const enc = new TextEncoder();

const els = {
  role: document.getElementById("role"),
  connectBtn: document.getElementById("connectBtn"),
  connectRouterBtn: document.getElementById("connectRouterBtn"),
  loginBtn: document.getElementById("loginBtn"),
  session: document.getElementById("session"),
  recipientCard: document.getElementById("recipientCard"),
  advertiserCard: document.getElementById("advertiserCard"),
  recipientPrefs: document.getElementById("recipientPrefs"),
  optInBtn: document.getElementById("optInBtn"),
  refreshNotifsBtn: document.getElementById("refreshNotifsBtn"),
  notifications: document.getElementById("notifications"),
  recipientWallet: document.getElementById("recipientWallet"),
  adContent: document.getElementById("adContent"),
  adAmount: document.getElementById("adAmount"),
  createAdBtn: document.getElementById("createAdBtn"),
  payAdBtn: document.getElementById("payAdBtn"),
  adState: document.getElementById("adState"),
  log: document.getElementById("log"),
};

let provider = null;
let wallet = null;
let token = null;
let currentAdRequest = null;
let walletMode = null; // phantom | router
const walletBridge = new BroadcastChannel("openclaw-wallet-bridge");

function randomId() {
  return Math.random().toString(36).slice(2);
}

function currentWalletBase58() {
  return wallet ? wallet.toBase58() : null;
}

function requestRouter(type, payload = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const id = randomId();
    const t = setTimeout(() => reject(new Error("Wallet router timeout")), timeoutMs);

    function onMessage(ev) {
      const msg = ev.data || {};
      if (msg.id !== id) return;
      walletBridge.removeEventListener("message", onMessage);
      clearTimeout(t);
      if (msg.error) return reject(new Error(msg.error));
      resolve(msg.result);
    }

    walletBridge.addEventListener("message", onMessage);
    walletBridge.postMessage({ id, type, payload });
  });
}

function log(msg) {
  els.log.textContent = `${new Date().toISOString()} ${msg}\n` + els.log.textContent;
}

async function req(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${api}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function showRolePanels(role) {
  els.recipientCard.classList.toggle("hide", role !== "recipient");
  els.advertiserCard.classList.toggle("hide", role !== "advertiser");
}

function getPhantomProvider() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

function openInPhantomInAppBrowser() {
  const url = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
}

async function connectWallet() {
  provider = getPhantomProvider();
  if (!provider) {
    const openInPhantom = confirm(
      "Phantom provider not detected in this browser. On mobile, open this page inside Phantom's in-app browser for wallet injection. Open in Phantom now?"
    );
    if (openInPhantom) openInPhantomInAppBrowser();
    return;
  }

  const r = await provider.connect();
  wallet = new PublicKey(r.publicKey.toString());
  walletMode = "phantom";
  els.session.innerHTML = `Connected via Phantom: <code>${wallet.toBase58()}</code>`;
  els.loginBtn.disabled = false;
  els.payAdBtn.disabled = true;
  log(`Connected wallet ${wallet.toBase58()}`);
}

async function connectWalletRouter() {
  await requestRouter("PING", {});
  const pubkey = await requestRouter("GET_PUBLIC_KEY", {});
  wallet = new PublicKey(pubkey);
  walletMode = "router";
  els.session.innerHTML = `Connected via Wallet Router: <code>${wallet.toBase58()}</code>`;
  els.loginBtn.disabled = false;
  els.payAdBtn.disabled = true;
  log(`Connected router wallet ${wallet.toBase58()}`);
}

async function signIn() {
  if (!wallet) return;
  const role = els.role.value;

  const challenge = await req("/api/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ walletAddress: wallet.toBase58(), role }),
  });

  let sigB58;
  if (walletMode === "phantom") {
    const signed = await provider.signMessage(enc.encode(challenge.message), "utf8");
    sigB58 = solanaWeb3.bs58.encode(signed.signature);
  } else if (walletMode === "router") {
    sigB58 = await requestRouter("SIGN_MESSAGE", { message: challenge.message });
  } else {
    throw new Error("No wallet connection mode");
  }

  const verified = await req("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: wallet.toBase58(),
      role,
      nonce: challenge.nonce,
      signature: sigB58,
    }),
  });

  token = verified.token;
  showRolePanels(role);
  els.session.innerHTML = `Signed in as <b>${role}</b> via <b>${walletMode}</b>: <code>${wallet.toBase58()}</code>`;
  log(`Signed in as ${role}`);
}

async function saveRecipientPrefs() {
  let prefs = {};
  try {
    prefs = JSON.parse(els.recipientPrefs.value || "{}");
  } catch {
    alert("Preferences must be valid JSON");
    return;
  }

  const out = await req("/api/recipient/opt-in", {
    method: "POST",
    body: JSON.stringify({ preferences: prefs }),
  });

  log(`Recipient opted in: ${out.user.walletAddress}`);
  alert("Recipient opt-in saved.");
}

async function refreshNotifications() {
  const out = await req("/api/recipient/notifications");
  els.notifications.innerHTML = "";

  if (!out.notifications.length) {
    els.notifications.textContent = "No notifications yet.";
    return;
  }

  for (const n of out.notifications) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>Paid Ad</b><br/>
      ${n.content}<br/>
      tx: <code>${n.txSignature}</code><br/>
      <button data-id="${n.id}" data-a="open">Open</button>
      <button data-id="${n.id}" data-a="dismiss">Dismiss</button>
    `;
    els.notifications.appendChild(div);

    if (!n.openedAt && !n.dismissedAt) {
      alert(`Paid ad received: ${n.content}`);
    }
  }

  els.notifications.querySelectorAll("button").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const a = btn.getAttribute("data-a");
      await req(`/api/recipient/notifications/${id}/${a}`, { method: "POST" });
      await refreshNotifications();
    };
  });
}

async function createAdRequest() {
  const recipientWallet = els.recipientWallet.value.trim();
  const content = els.adContent.value.trim();
  const amountSol = Number(els.adAmount.value || 0);
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const out = await req("/api/ads", {
    method: "POST",
    body: JSON.stringify({ recipientWallet, content, amountLamports }),
  });

  currentAdRequest = out.adRequest;
  els.payAdBtn.disabled = false;
  els.adState.innerHTML = `Ad request created: <code>${currentAdRequest.id}</code>`;
  log(`Created ad request ${currentAdRequest.id}`);
}

async function sendPaymentTxFromCurrentWallet(recipientWallet, lamports) {
  if (walletMode === "phantom") {
    const recipient = new PublicKey(recipientWallet);
    const ix = SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: recipient,
      lamports,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction().add(ix);
    tx.feePayer = wallet;
    tx.recentBlockhash = latest.blockhash;

    const sent = await provider.signAndSendTransaction(tx);
    return typeof sent === "string" ? sent : sent.signature;
  }

  if (walletMode === "router") {
    return await requestRouter("SEND_TRANSFER", {
      recipientWallet,
      lamports,
    });
  }

  throw new Error("No wallet connected");
}

async function payAndLinkTx() {
  if (!currentAdRequest) return;

  const signature = await sendPaymentTxFromCurrentWallet(
    currentAdRequest.recipientWallet,
    currentAdRequest.amountLamports
  );

  await req(`/api/ads/${currentAdRequest.id}/submit-tx`, {
    method: "POST",
    body: JSON.stringify({ txSignature: signature }),
  });

  log(`Payment tx submitted: ${signature}`);
  els.adState.innerHTML = `Payment tx: <code>${signature}</code><br/>Checking chain confirmation...`;

  for (let i = 0; i < 20; i++) {
    const check = await req(`/api/ads/${currentAdRequest.id}/check-payment`, { method: "POST" });
    if (check.status === "confirmed") {
      els.adState.innerHTML = `Confirmed ✅ tx: <code>${signature}</code>`;
      log(`Ad request confirmed and notification queued.`);
      return;
    }
    if (check.status === "mismatch") {
      els.adState.innerHTML = `Tx mismatch ❌. Check source/destination/amount.`;
      return;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  els.adState.innerHTML = `Still pending confirmation. Try Check Notifications on recipient side.`;
}

els.connectBtn.onclick = () => connectWallet().catch((e) => log(`ERROR connect phantom: ${e.message}`));
els.connectRouterBtn.onclick = () => connectWalletRouter().catch((e) => log(`ERROR connect router: ${e.message}`));
els.loginBtn.onclick = () => signIn().catch((e) => log(`ERROR signin: ${e.message}`));
els.role.onchange = () => showRolePanels(els.role.value);
els.optInBtn.onclick = () => saveRecipientPrefs().catch((e) => log(`ERROR opt-in: ${e.message}`));
els.refreshNotifsBtn.onclick = () => refreshNotifications().catch((e) => log(`ERROR notifications: ${e.message}`));
els.createAdBtn.onclick = () => createAdRequest().catch((e) => log(`ERROR create ad: ${e.message}`));
els.payAdBtn.onclick = () => payAndLinkTx().catch((e) => log(`ERROR pay/link: ${e.message}`));

showRolePanels(els.role.value);
