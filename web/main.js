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

function log(msg) {
  logEl.textContent = `${new Date().toISOString()} ${msg}\n` + logEl.textContent;
}

function u64LE(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

function u16LE(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32LE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

async function instructionDiscriminator(name) {
  const input = new TextEncoder().encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", input);
  return Buffer.from(hashBuffer).subarray(0, 8);
}

function encodeUpsertPolicyArgs({ enabled, minFeeLamports, maxNotificationsPerPeriod, allowedCategories }) {
  const out = [];
  out.push(Buffer.from([enabled ? 1 : 0]));
  out.push(u64LE(minFeeLamports));
  out.push(u16LE(maxNotificationsPerPeriod));
  out.push(u32LE(allowedCategories.length));
  for (const c of allowedCategories) {
    const bytes = Buffer.from(c, "utf8");
    out.push(u32LE(bytes.length));
    out.push(bytes);
  }
  return Buffer.concat(out);
}

async function getPolicyPda(recipient) {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from("policy"), recipient.toBuffer()],
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
    minFeeLamports: 1000000, // 0.001 SOL
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
    data: Buffer.concat([discriminator, args]),
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: walletPubkey, blockhash, lastValidBlockHeight }).add(ix);

  const sig = await provider.signAndSendTransaction(tx);
  await connection.confirmTransaction({ signature: sig.signature, blockhash, lastValidBlockHeight }, "confirmed");

  policyEl.innerHTML = `Policy PDA: <code>${policyPda.toBase58()}</code><br/>Last tx: <code>${sig.signature}</code>`;
  log(`Policy upsert tx: ${sig.signature}`);
}

function readBool(buf, offset) {
  return { value: buf[offset] === 1, offset: offset + 1 };
}

function readU8(buf, offset) {
  return { value: buf[offset], offset: offset + 1 };
}

function readU16(buf, offset) {
  return { value: buf.readUInt16LE(offset), offset: offset + 2 };
}

function readU64(buf, offset) {
  return { value: buf.readBigUInt64LE(offset), offset: offset + 8 };
}

function readPubkey(buf, offset) {
  return { value: new PublicKey(buf.subarray(offset, offset + 32)).toBase58(), offset: offset + 32 };
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

  const decoded = decodePolicyAccount(Buffer.from(acc.data));
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
registerBtn.addEventListener("click", () => registerPolicy().catch((e) => log(`ERROR register: ${e.message || e}`)));
verifyBtn.addEventListener("click", () => verifyPolicy().catch((e) => log(`ERROR verify: ${e.message || e}`)));
