const { Connection, PublicKey, Transaction, SystemProgram, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } = solanaWeb3;
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const enc = new TextEncoder();

const ROUTER_LOCAL_KEY = "paidAds.router.localSecretKey";

const els = {
  connectPhantomBtn: document.getElementById("connectPhantomBtn"),
  connectRouterBtn: document.getElementById("connectRouterBtn"),
  createRouterWalletBtn: document.getElementById("createRouterWalletBtn"),
  exportRouterWalletBtn: document.getElementById("exportRouterWalletBtn"),
  registerBtn: document.getElementById("registerBtn"),
  walletState: document.getElementById("walletState"),
  recipientWallet: document.getElementById("recipientWallet"),
  amountSol: document.getElementById("amountSol"),
  payBtn: document.getElementById("payBtn"),
  payState: document.getElementById("payState"),
  registrations: document.getElementById("registrations"),
  log: document.getElementById("log"),
};

let walletMode = null; // phantom | router-remote | router-local
let phantom = null;
let routerPubkey = null;
let routerLocalKeypair = null;
const walletBridge = new BroadcastChannel("openclaw-wallet-bridge");

function log(msg) {
  els.log.textContent = `${new Date().toISOString()} ${msg}\n` + els.log.textContent;
}

function saveRouterLocalKeypair(kp) {
  localStorage.setItem(ROUTER_LOCAL_KEY, JSON.stringify(Array.from(kp.secretKey)));
}

function loadRouterLocalKeypair() {
  try {
    const raw = localStorage.getItem(ROUTER_LOCAL_KEY);
    if (!raw) return null;
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    return null;
  }
}

function loadRegistrations() {
  const data = JSON.parse(localStorage.getItem("paidAds.registrations") || "[]");
  els.registrations.innerHTML = data.length
    ? data.map((r) => `<div><code>${r.wallet}</code> at ${new Date(r.ts).toLocaleString()}</div>`).join("")
    : "No registrations yet.";
}

function saveRegistration(wallet, signature) {
  const data = JSON.parse(localStorage.getItem("paidAds.registrations") || "[]");
  data.unshift({ wallet, signature, ts: Date.now() });
  localStorage.setItem("paidAds.registrations", JSON.stringify(data.slice(0, 20)));
  loadRegistrations();
}

function currentWallet() {
  if (walletMode === "phantom" && phantom?.publicKey) return phantom.publicKey.toString();
  if ((walletMode === "router-remote" || walletMode === "router-local") && routerPubkey) return routerPubkey;
  return null;
}

function randomId() {
  return Math.random().toString(36).slice(2);
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

async function connectPhantom() {
  if (!window.solana?.isPhantom) {
    alert("Phantom extension not found on this browser.");
    return;
  }
  phantom = window.solana;
  const r = await phantom.connect();
  walletMode = "phantom";
  els.registerBtn.disabled = false;
  els.payBtn.disabled = false;
  els.walletState.innerHTML = `Connected via Phantom: <code>${r.publicKey.toString()}</code>`;
  log(`Phantom connected: ${r.publicKey.toString()}`);
}

function connectRouterLocalFallback() {
  routerLocalKeypair = loadRouterLocalKeypair();
  if (!routerLocalKeypair) {
    throw new Error("No local router wallet found. Click Create Router Wallet (In-App).");
  }
  routerPubkey = routerLocalKeypair.publicKey.toBase58();
  walletMode = "router-local";
  els.registerBtn.disabled = false;
  els.payBtn.disabled = false;
  els.walletState.innerHTML = `Connected via In-App Router Wallet: <code>${routerPubkey}</code>`;
  log(`Local router wallet connected: ${routerPubkey}`);
}

async function connectRouter() {
  try {
    await requestRouter("PING", {});
    routerPubkey = await requestRouter("GET_PUBLIC_KEY", {});
    walletMode = "router-remote";
    els.registerBtn.disabled = false;
    els.payBtn.disabled = false;
    els.walletState.innerHTML = `Connected via Wallet Router App: <code>${routerPubkey}</code>`;
    log(`Router app wallet connected: ${routerPubkey}`);
  } catch {
    connectRouterLocalFallback();
  }
}

function createInAppRouterWallet() {
  routerLocalKeypair = Keypair.generate();
  saveRouterLocalKeypair(routerLocalKeypair);
  routerPubkey = routerLocalKeypair.publicKey.toBase58();
  walletMode = "router-local";
  els.registerBtn.disabled = false;
  els.payBtn.disabled = false;
  els.walletState.innerHTML = `Created + connected In-App Router Wallet: <code>${routerPubkey}</code>`;
  log(`Created local router wallet: ${routerPubkey}`);
}

function exportInAppRouterWallet() {
  const kp = loadRouterLocalKeypair();
  if (!kp) {
    alert("No in-app router wallet saved yet.");
    return;
  }
  const raw = JSON.stringify(Array.from(kp.secretKey));
  navigator.clipboard
    .writeText(raw)
    .then(() => alert("Secret key copied. Keep it private."))
    .catch(() => alert(raw));
}

async function signMessageForWallet(message) {
  if (walletMode === "phantom") {
    const signed = await phantom.signMessage(enc.encode(message), "utf8");
    return solanaWeb3.bs58.encode(signed.signature);
  }
  if (walletMode === "router-remote") {
    return await requestRouter("SIGN_MESSAGE", { message });
  }
  if (walletMode === "router-local") {
    if (!routerLocalKeypair) throw new Error("Local router keypair missing");
    const sig = nacl.sign.detached(enc.encode(message), routerLocalKeypair.secretKey.slice(0, 64));
    return solanaWeb3.bs58.encode(sig);
  }
  throw new Error("Wallet not connected");
}

async function sendPayment(recipientWallet, lamports) {
  if (walletMode === "phantom") {
    const latest = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(currentWallet()),
        toPubkey: new PublicKey(recipientWallet),
        lamports,
      })
    );
    tx.feePayer = new PublicKey(currentWallet());
    tx.recentBlockhash = latest.blockhash;
    const sent = await phantom.signAndSendTransaction(tx);
    return typeof sent === "string" ? sent : sent.signature;
  }

  if (walletMode === "router-remote") {
    return await requestRouter("SEND_TRANSFER", { recipientWallet, lamports });
  }

  if (walletMode === "router-local") {
    if (!routerLocalKeypair) throw new Error("Local router keypair missing");
    const latest = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: routerLocalKeypair.publicKey,
        toPubkey: new PublicKey(recipientWallet),
        lamports,
      })
    );
    tx.feePayer = routerLocalKeypair.publicKey;
    tx.recentBlockhash = latest.blockhash;
    tx.sign(routerLocalKeypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  }

  throw new Error("Wallet not connected");
}

async function registerWallet() {
  const wallet = currentWallet();
  if (!wallet) throw new Error("Connect wallet first");

  const nonce = randomId();
  const message = `PaidAds Registration\nwallet=${wallet}\nnonce=${nonce}\nissuedAt=${Date.now()}`;
  const sigB58 = await signMessageForWallet(message);

  const ok = nacl.sign.detached.verify(
    enc.encode(message),
    solanaWeb3.bs58.decode(sigB58),
    new PublicKey(wallet).toBytes()
  );

  if (!ok) throw new Error("Signature verification failed");

  saveRegistration(wallet, sigB58);
  log(`Registered wallet ${wallet} with signature proof`);
  alert("Wallet registered (web2.5 local demo proof).\nNext: run payment test.");
}

async function payRecipient() {
  const recipient = els.recipientWallet.value.trim();
  const lamports = Math.floor(Number(els.amountSol.value || 0) * LAMPORTS_PER_SOL);
  new PublicKey(recipient);
  if (!lamports || lamports <= 0) throw new Error("Amount must be > 0");

  const sig = await sendPayment(recipient, lamports);
  els.payState.innerHTML = `Payment sent: <code>${sig}</code><br/><a href="https://explorer.solana.com/tx/${sig}?cluster=devnet" target="_blank">View tx</a>`;
  log(`Payment tx: ${sig}`);
}

els.connectPhantomBtn.onclick = () => connectPhantom().catch((e) => log(`ERROR phantom: ${e.message}`));
els.connectRouterBtn.onclick = () => connectRouter().catch((e) => log(`ERROR router: ${e.message}`));
els.createRouterWalletBtn.onclick = () => {
  try {
    createInAppRouterWallet();
  } catch (e) {
    log(`ERROR create router wallet: ${e.message}`);
  }
};
els.exportRouterWalletBtn.onclick = () => exportInAppRouterWallet();
els.registerBtn.onclick = () => registerWallet().catch((e) => log(`ERROR register: ${e.message}`));
els.payBtn.onclick = () => payRecipient().catch((e) => log(`ERROR payment: ${e.message}`));

// auto-load local wallet if present for convenience
routerLocalKeypair = loadRouterLocalKeypair();
if (routerLocalKeypair) {
  routerPubkey = routerLocalKeypair.publicKey.toBase58();
  log(`Local router wallet available: ${routerPubkey}`);
}

loadRegistrations();
