const { Keypair, PublicKey, Connection, Transaction, SystemProgram, clusterApiUrl } = solanaWeb3;
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const enc = new TextEncoder();

const els = {
  genBtn: document.getElementById("genBtn"),
  loadBtn: document.getElementById("loadBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  wallet: document.getElementById("wallet"),
  msg: document.getElementById("msg"),
  signBtn: document.getElementById("signBtn"),
  signed: document.getElementById("signed"),
  log: document.getElementById("log"),
};

const KEY = "paidAds.wallet.secretKey";
const bridge = new BroadcastChannel("openclaw-wallet-bridge");
let kp = null;

function log(msg) {
  els.log.textContent = `${new Date().toISOString()} ${msg}\n` + els.log.textContent;
}

function setWalletState() {
  els.wallet.innerHTML = kp
    ? `Active wallet: <code>${kp.publicKey.toBase58()}</code>`
    : "No wallet loaded";
}

function saveKeypair(keypair) {
  localStorage.setItem(KEY, JSON.stringify(Array.from(keypair.secretKey)));
}

function loadKeypair() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const arr = JSON.parse(raw);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function signMessage(message) {
  if (!kp) throw new Error("No wallet loaded");
  const sig = nacl.sign.detached(enc.encode(message), kp.secretKey.slice(0, 64));
  return solanaWeb3.bs58.encode(sig);
}

async function sendTransfer(recipientWallet, lamports) {
  if (!kp) throw new Error("No wallet loaded");
  const recipient = new PublicKey(recipientWallet);
  const latest = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: recipient,
      lamports: Number(lamports),
    })
  );

  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = latest.blockhash;
  tx.sign(kp);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({
    signature: sig,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }, "confirmed");

  return sig;
}

bridge.addEventListener("message", async (ev) => {
  const msg = ev.data || {};
  if (!msg.id || !msg.type) return;

  try {
    if (msg.type === "PING") {
      bridge.postMessage({ id: msg.id, result: "pong" });
      return;
    }

    if (msg.type === "GET_PUBLIC_KEY") {
      if (!kp) throw new Error("Wallet app has no loaded keypair");
      bridge.postMessage({ id: msg.id, result: kp.publicKey.toBase58() });
      return;
    }

    if (msg.type === "SIGN_MESSAGE") {
      const signature = signMessage(String(msg.payload?.message || ""));
      bridge.postMessage({ id: msg.id, result: signature });
      return;
    }

    if (msg.type === "SEND_TRANSFER") {
      const sig = await sendTransfer(msg.payload?.recipientWallet, msg.payload?.lamports);
      bridge.postMessage({ id: msg.id, result: sig });
      return;
    }

    bridge.postMessage({ id: msg.id, error: `Unknown type ${msg.type}` });
  } catch (e) {
    bridge.postMessage({ id: msg.id, error: e.message || String(e) });
  }
});

els.genBtn.onclick = () => {
  kp = Keypair.generate();
  saveKeypair(kp);
  setWalletState();
  log(`Generated wallet ${kp.publicKey.toBase58()}`);
};

els.loadBtn.onclick = () => {
  kp = loadKeypair();
  setWalletState();
  log(kp ? `Loaded wallet ${kp.publicKey.toBase58()}` : "No saved wallet found");
};

els.exportBtn.onclick = () => {
  if (!kp) return alert("Load wallet first");
  const raw = JSON.stringify(Array.from(kp.secretKey));
  navigator.clipboard.writeText(raw).then(() => alert("Secret key copied. Keep it private."));
};

els.importBtn.onclick = () => {
  const raw = prompt("Paste secret key array JSON:");
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    kp = Keypair.fromSecretKey(Uint8Array.from(arr));
    saveKeypair(kp);
    setWalletState();
    log(`Imported wallet ${kp.publicKey.toBase58()}`);
  } catch {
    alert("Invalid key format");
  }
};

els.signBtn.onclick = () => {
  try {
    const sig = signMessage(els.msg.value || "");
    els.signed.innerHTML = `Signature: <code>${sig}</code>`;
    log("Signed message.");
  } catch (e) {
    log(`Sign error: ${e.message}`);
  }
};

kp = loadKeypair();
setWalletState();
