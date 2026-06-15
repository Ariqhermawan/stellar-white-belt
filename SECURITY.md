# Security notes & known limitations

This is a **Stellar testnet** demo wallet. It moves only testnet XLM, which has
no real value. The notes below are deliberate scoping choices, documented so they
are not mistaken for oversights.

## Testnet posture

- **No real value.** Everything runs on the Stellar test network.
- **The app never holds keys.** Connecting, signing, and sending are performed by
  the user in Freighter. The app only builds transactions and reads balances.
- **Network guard.** The app checks that Freighter is on Testnet at connect time
  and re-checks immediately before sending a payment.

## Dependency advisories

`npm audit` reports advisories in transitive dependencies of `@stellar/stellar-sdk`
(notably `axios`). These code paths are not reachable in this read-only testnet
flow: the Horizon URL is hardcoded over HTTPS and key material is handled only by
the Freighter extension. They are inherent to the current Stellar SDK ecosystem;
pin or upgrade once upstream ships a fixed release.

## Reporting

This is a learning project. For issues, open a GitHub issue on the repository.
