import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  connect,
  restore,
  currentNetwork,
  getBalance,
  fundWithFriendbot,
  sendPayment,
  describeError,
  explorerAccount,
  explorerTx,
  type Balance,
} from "./lib/stellar";

type Status =
  | { kind: "idle" }
  | { kind: "pending"; msg: string }
  | { kind: "success"; msg: string; hash: string }
  | { kind: "error"; msg: string };

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;
const isValidAddress = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim());

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const refreshBalance = useCallback(async (addr: string) => {
    setBalanceLoading(true);
    try {
      setBalance(await getBalance(addr));
    } catch (err) {
      console.error(err);
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadAccount = useCallback(
    async (addr: string) => {
      setAddress(addr);
      try {
        setNetwork(await currentNetwork());
      } catch {
        setNetwork(null);
      }
      await refreshBalance(addr);
    },
    [refreshBalance],
  );

  // Silent session restore on first load (no prompt). The `active` flag guards
  // against React StrictMode's double-invoke and set-state-after-unmount.
  useEffect(() => {
    let active = true;
    restore()
      .then((addr) => {
        if (active && addr) void loadAccount(addr);
      })
      .catch((err) => console.error("Session restore failed:", err));
    return () => {
      active = false;
    };
  }, [loadAccount]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await loadAccount(await connect());
    } catch (err) {
      setConnectError(describeError(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setNetwork(null);
    setBalance(null);
    setTo("");
    setAmount("");
    setStatus({ kind: "idle" });
    setConnectError(null);
  };

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Clipboard write failed:", err);
    }
  };

  const handleFund = async () => {
    if (!address || status.kind === "pending") return;
    setStatus({ kind: "pending", msg: "Requesting testnet XLM from Friendbot…" });
    try {
      await fundWithFriendbot(address);
      await refreshBalance(address);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", msg: describeError(err) });
    }
  };

  const amountNum = Number(amount);
  const onTestnet = network === "TESTNET";
  const addressOk = isValidAddress(to);
  const amountOk =
    amount.trim() !== "" && Number.isFinite(amountNum) && amountNum >= 0.0000001;
  const canSend =
    !!address && onTestnet && addressOk && amountOk && status.kind !== "pending";

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!address || !canSend) return;
    setStatus({ kind: "pending", msg: "Building and signing transaction…" });
    try {
      // Re-check the wallet network right before signing: it can change after connect.
      const net = await currentNetwork();
      setNetwork(net);
      if (net !== "TESTNET") {
        setStatus({ kind: "error", msg: "Switch Freighter to Testnet before sending." });
        return;
      }
      const { hash } = await sendPayment(address, to.trim(), amount.trim());
      setStatus({ kind: "success", msg: "Payment sent on testnet.", hash });
      setTo("");
      setAmount("");
      await refreshBalance(address);
    } catch (err) {
      setStatus({ kind: "error", msg: describeError(err) });
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/star.svg" alt="" width={22} height={22} />
          <span>Stellar Wallet</span>
        </div>
        <span className="chip">Testnet</span>
      </header>

      <main className="main">
        {!address ? (
          <section className="hero card">
            <h1>Your Stellar testnet wallet</h1>
            <p className="muted">
              Connect Freighter to view your XLM balance and send a payment on the
              Stellar test network.
            </p>
            <button
              className="btn primary"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect Freighter"}
            </button>
            {connectError && <p className="alert error">{connectError}</p>}
            <p className="hint muted">
              No wallet?{" "}
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Install Freighter
              </a>{" "}
              and switch it to Testnet.
            </p>
          </section>
        ) : (
          <div className="grid">
            <section className="card account">
              <div className="row between">
                <h2>Account</h2>
                <button className="btn ghost sm" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </div>
              <div className="addr">
                <code title={address}>{shorten(address)}</code>
                <button
                  className="btn ghost sm"
                  onClick={handleCopy}
                  aria-label={`Copy full address ${address}`}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="row gap">
                <span className={`net ${onTestnet ? "ok" : "warn"}`}>
                  {network ? `Network: ${network}` : "Network: unknown"}
                </span>
                <a
                  className="link"
                  href={explorerAccount(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Stellar Expert {"↗"}
                </a>
              </div>
              {!onTestnet && (
                <p className="alert warn">
                  Switch Freighter to <strong>Testnet</strong> to use this app.
                </p>
              )}
            </section>

            <section className="card balance">
              <div className="row between">
                <h2>Balance</h2>
                <button
                  className="btn ghost sm"
                  onClick={() => refreshBalance(address)}
                  disabled={balanceLoading}
                  aria-label={balanceLoading ? "Refreshing balance" : "Refresh balance"}
                >
                  {balanceLoading ? "…" : "Refresh"}
                </button>
              </div>
              {balance === null ? (
                <p className="muted">
                  {balanceLoading ? "Loading…" : "Unavailable"}
                </p>
              ) : balance.funded ? (
                <p className="amount">
                  {Number(balance.xlm).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  <span className="unit">XLM</span>
                </p>
              ) : (
                <div className="unfunded">
                  <p className="muted">
                    This account isn&apos;t funded on testnet yet.
                  </p>
                  <button
                    className="btn primary sm"
                    onClick={handleFund}
                    disabled={status.kind === "pending"}
                  >
                    Fund with Friendbot
                  </button>
                </div>
              )}
            </section>

            <section className="card send">
              <h2>Send XLM</h2>
              <form onSubmit={handleSend}>
                <label>
                  Recipient address
                  <input
                    type="text"
                    placeholder="G…"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {to && !addressOk && (
                    <span className="field-error">
                      Enter a valid Stellar public key (starts with G, 56 chars).
                    </span>
                  )}
                </label>
                <label>
                  Amount (XLM)
                  <input
                    type="number"
                    min="0"
                    step="0.0000001"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <button className="btn primary" type="submit" disabled={!canSend}>
                  {status.kind === "pending" ? "Sending…" : "Send payment"}
                </button>
              </form>

              {status.kind === "pending" && (
                <p className="alert info">{status.msg}</p>
              )}
              {status.kind === "error" && (
                <p className="alert error">{status.msg}</p>
              )}
              {status.kind === "success" && (
                <div className="alert success">
                  <p>{status.msg}</p>
                  <p className="hash">
                    <code title={status.hash}>{shorten(status.hash)}</code>
                  </p>
                  <a
                    className="link"
                    href={explorerTx(status.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View transaction on Stellar Expert {"↗"}
                  </a>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="footer muted">
        <span>Stellar Testnet · funds have no real value</span>
        <a
          href="https://developers.stellar.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Stellar Docs {"↗"}
        </a>
      </footer>
    </div>
  );
}
