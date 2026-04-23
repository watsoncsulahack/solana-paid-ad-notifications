const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, clusterApiUrl } = solanaWeb3;

const PROGRAM_ID = new PublicKey("AAcS57umqK8gBQagMb9xAXCpwFtTbbLNFVA8K1bCayAY");
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const connectBtn = document.getElementById("connectBtn");
const registerBtn = document.getElementById("registerBtn");
const verifyBtn = document.getElementById("verifyBtn");
const walletEl = document.getElementById("wallet");
const policyEl = document.getElementById("policy");
const logEl = document.getElementById("log");
document.getElementById("programId").textContent = PROGRAM_ID.toBase58();

let provider;
let walletPubkey;

const enc = new TextEncoder();

function log(msg) {
  logEl.textContent = `${new Date().toISOString()} ${msg}\n` + logEl.textContent;
}

function hexErr(e) {
  if (!e) return "unknown error";
  if (typeof e === "string") return e;
  return e.message || JSON.stringify(e);
}

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u8(n) {
  return Uint8Array.of(n & 0xff);
}

function u16LE(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32LE(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function u64LE(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
  return b;
}

async function instructionDiscriminator(name) {
  const input = enc.encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hashBuffer).slice(0, 8);
}

function encodeUpsertPolicyArgs({ enabled, minFeeLamports, maxNotificationsPerPeriod, allowedCategories }) {
  const out = [u8(enabled ? 1 : 0), u64LE(minFeeLamports), u16LE(maxNotificationsPerPeriod), u32LE(allowedCategories.length)];
  for (const c of allowedCategories) {
    const bytes = enc.encode(c);
    out.push(u32LE(bytes.length));
    out.push(bytes);
  }
  return concatBytes(...out);
}

async function getPolicyPda(recipient) {
  const [pda] = await PublicKey.findProgramAddress(
    [enc.encode("policy"), recipient.toBytes()],
    PROGRAM_ID
  );
  return pda;
}

async function connectWallet() {
  if (!window.solana?.isPhantom) {
    alert("Phantom wallet not found. Install Phantom and refresh.");
    return;
  }

  provider = window.solana;
  const res = await provider.connect();
  walletPubkey = new PublicKey(res.publicKey.toString());

  walletEl.innerHTML = `Connected: <code>${walletPubkey.toBase58()}</code>`;
  registerBtn.disabled = false;
  verifyBtn.disabled = false;
  log(`Wallet connected: ${walletPubkey.toBase58()}`);
}

async function registerPolicy() {
  if (!walletPubkey) return;

  const policyPda = await getPolicyPda(walletPubkey);

  const discriminator = await instructionDiscriminator("upsert_policy");
  const args = encodeUpsertPolicyArgs({
    enabled: true,
    minFeeLamports: 1_000_000,
    maxNotificationsPerPeriod: 10,
    allowedCategories: ["jobs", "offers"],
  });

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(discriminator, args),
  });

  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction().add(ix);
  tx.feePayer = walletPubkey;
  tx.recentBlockhash = latest.blockhash;

  const sent = await provider.signAndSendTransaction(tx);
  const signature = typeof sent === "string" ? sent : sent.signature;
  await connection.confirmTransaction({ signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed");

  policyEl.innerHTML = `Policy PDA: <code>${policyPda.toBase58()}</code><br/>Last tx: <code>${signature}</code>`;
  log(`Policy upsert tx: ${signature}`);
}

function readU8(data, offset) {
  return { value: data[offset], offset: offset + 1 };
}

function readBool(data, offset) {
  return { value: data[offset] === 1, offset: offset + 1 };
}

function readU16(data, offset) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true);
  return { value: v, offset: offset + 2 };
}

function readU64(data, offset) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
  return { value: v, offset: offset + 8 };
}

function readPubkey(data, offset) {
  return { value: new PublicKey(data.slice(offset, offset + 32)).toBase58(), offset: offset + 32 };
}

function decodePolicyAccount(data) {
  // [8 discriminator][1 bump][32 recipient][1 enabled][8 min_fee][2 max][vec<string>][8 updated_slot]
  let o = 8;
  const bump = readU8(data, o); o = bump.offset;
  const recipient = readPubkey(data, o); o = recipient.offset;
  const enabled = readBool(data, o); o = enabled.offset;
  const minFee = readU64(data, o); o = minFee.offset;
  const maxPer = readU16(data, o); o = maxPer.offset;

  return {
    bump: bump.value,
    recipient: recipient.value,
    enabled: enabled.value,
    minFeeLamports: minFee.value.toString(),
    maxNotificationsPerPeriod: maxPer.value,
  };
}

async function verifyPolicy() {
  if (!walletPubkey) return;

  const policyPda = await getPolicyPda(walletPubkey);
  const acc = await connection.getAccountInfo(policyPda, "confirmed");

  if (!acc) {
    log("No policy account found yet for this wallet.");
    alert("Not registered yet. Click 'Register Wallet Policy' first.");
    return;
  }

  if (!acc.owner.equals(PROGRAM_ID)) {
    log("Account exists but owner is not expected program.");
    return;
  }

  const decoded = decodePolicyAccount(acc.data);
  policyEl.innerHTML = `
    <div class="ok">Registration verified on-chain ✅</div>
    <div>Policy PDA: <code>${policyPda.toBase58()}</code></div>
    <div>Recipient: <code>${decoded.recipient}</code></div>
    <div>Enabled: <code>${decoded.enabled}</code></div>
    <div>Min fee (lamports): <code>${decoded.minFeeLamports}</code></div>
    <div>Max per period: <code>${decoded.maxNotificationsPerPeriod}</code></div>
  `;

  log(`Verified policy account on-chain: ${policyPda.toBase58()}`);
}

connectBtn.addEventListener("click", connectWallet);
registerBtn.addEventListener("click", () => registerPolicy().catch((e) => log(`ERROR register: ${hexErr(e)}`)));
verifyBtn.addEventListener("click", () => verifyPolicy().catch((e) => log(`ERROR verify: ${hexErr(e)}`)));
