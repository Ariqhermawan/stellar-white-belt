# Rise In Submission - White Belt

## Target

Level 1 / White Belt: Stellar testnet wallet dApp.

## What to Review

- Connect/disconnect Freighter on Testnet.
- Read native XLM balance from Horizon.
- Fund a new Testnet account with Friendbot.
- Build, sign in Freighter, and submit a native XLM payment.
- Show transaction status, hash, and Stellar Expert link.

## On-chain Proof

| Field | Value |
| --- | --- |
| Transaction | `a92891289db8ce3dbbafc9f9decdce77b2980cdf1cced40e53f11eafb8fcfa10` |
| Explorer | https://stellar.expert/explorer/testnet/tx/a92891289db8ce3dbbafc9f9decdce77b2980cdf1cced40e53f11eafb8fcfa10 |
| From | `GB4LEOLLHSZZUWUFRDF2JIIC736CFR6ZL4FXA4TKKLLMMAER2N67M5IZ` |
| To | `GCPXQLV7ZR6ANNJMO5T7FLPHYAXXXAMC7U3UYXOOBNXV73D2RJ4APSR2` |
| Amount | 100 XLM |

## Run Locally

```bash
npm install
npm run dev
npm run build
```

## Notes

This is Testnet-only. The app never handles private keys; Freighter signs the XDR and the frontend submits the signed transaction to Horizon.
