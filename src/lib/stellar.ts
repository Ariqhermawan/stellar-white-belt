// All Stellar + Freighter logic for the dApp lives here.
// The private key never leaves Freighter: we build an unsigned transaction,
// Freighter signs it, and we submit the signed envelope to Horizon.

import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new Horizon.Server(HORIZON_URL);

export function explorerTx(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function explorerAccount(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}

/** Is the Freighter extension installed / available in this browser? */
export async function hasFreighter(): Promise<boolean> {
  const res = await isConnected();
  return !res.error && res.isConnected;
}

/** Prompt the user to authorize this dApp. Returns their public key. */
export async function connect(): Promise<string> {
  if (!(await hasFreighter())) {
    throw new Error(
      "Freighter wallet not detected. Install it from freighter.app and refresh.",
    );
  }
  const res = await requestAccess();
  if (res.error) throw new Error(res.error.message || "Connection was rejected.");
  if (!res.address) throw new Error("Freighter returned no address.");
  return res.address;
}

/** Silent session restore: returns the address if already authorized, else null. */
export async function restore(): Promise<string | null> {
  if (!(await hasFreighter())) return null;
  const res = await getAddress();
  if (res.error || !res.address) return null;
  return res.address;
}

/** The network the wallet is currently set to, e.g. "TESTNET". */
export async function currentNetwork(): Promise<string> {
  const res = await getNetwork();
  if (res.error) throw new Error(res.error.message || "Could not read network.");
  return res.network;
}

export type Balance = { xlm: string; funded: boolean };

/** Native XLM balance. `funded: false` means the account does not exist yet. */
export async function getBalance(address: string): Promise<Balance> {
  try {
    const account = await server.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return { xlm: native ? native.balance : "0", funded: true };
  } catch (err: unknown) {
    if (isNotFound(err)) return { xlm: "0", funded: false };
    throw err;
  }
}

/** Fund a brand-new testnet account via Friendbot (~10,000 XLM). Testnet only. */
export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Friendbot request failed (HTTP ${res.status}).`);
}

export type SendResult = { hash: string; explorerUrl: string };

/** Build, sign (via Freighter), and submit a native XLM payment on testnet. */
export async function sendPayment(
  from: string,
  to: string,
  amount: string,
): Promise<SendResult> {
  const source = await server.loadAccount(from);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(180)
    .build();

  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: from,
  });
  if (signed.error) {
    throw new Error(signed.error.message || "Signing was rejected.");
  }
  if (!signed.signedTxXdr) {
    throw new Error("Freighter returned no signed transaction.");
  }

  const signedTx = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    NETWORK_PASSPHRASE,
  );
  const res = await server.submitTransaction(signedTx);
  if (!res.successful) {
    throw new Error("The transaction was not applied to the ledger.");
  }
  return { hash: res.hash, explorerUrl: explorerTx(res.hash) };
}

/** Turn an unknown error (Freighter / Horizon / network) into a readable message. */
export function describeError(err: unknown): string {
  const e = err as {
    message?: string;
    response?: {
      data?: {
        extras?: {
          result_codes?: { transaction?: string; operations?: string[] };
        };
      };
    };
  };

  const codes = e?.response?.data?.extras?.result_codes;
  if (codes) {
    const ops = codes.operations ?? [];
    if (ops.includes("op_no_destination")) {
      return "Destination account does not exist on testnet yet. New accounts must be funded first (e.g. via Friendbot).";
    }
    if (
      ops.includes("op_underfunded") ||
      codes.transaction === "tx_insufficient_balance"
    ) {
      return "Insufficient balance: your account must keep a minimum XLM reserve.";
    }
    const parts = [codes.transaction, ops.join(", ")].filter(Boolean);
    if (parts.length) return `Transaction failed: ${parts.join(" / ")}`;
  }

  return e?.message || "Something went wrong. Please try again.";
}

function isNotFound(err: unknown): boolean {
  const e = err as { response?: { status?: number } };
  return e?.response?.status === 404;
}
