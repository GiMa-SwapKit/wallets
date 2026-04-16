---
"@swapkit/wallet-hardware": minor
---

Ledger UTXO V3 swap-flow signers:

- **BTC + LTC** via the modern `ledger-bitcoin` AppClient (`signPsbt` with `DefaultWalletPolicy`). The new client injects `PSBT_IN_BIP32_DERIVATION` per input using `app.getMasterFingerprint()` + the user's known derivation path (single-address account: same path for every input + change), then merges the partial signatures back into the PSBT and finalises.
- **BCH + DOGE + DASH** via a new legacy adapter that pulls `nonWitnessUtxo` (full prior-tx hex) out of the V3 PSBT, re-encodes via `RawTx.encode`, and feeds the existing `@ledgerhq/hw-app-btc.createPaymentTransaction` path. No prev-tx network fetch needed — the API PSBT carries everything.
- **ZEC** stays on the existing bespoke `signPCZT` path for now.

Bespoke `transfer` and the HD-wallet helpers (`deriveAddressAtIndex`, `transferFromMultipleAddresses`, `getExtendedPublicKey`) are retained for back-compat — the V3 path is additive via the toolbox-synthesised `signAndBroadcastTransaction`.

`directSigningSupport` flipped to `true` for BTC, LTC, BCH, DOGE, DASH on Ledger.

New deps: `ledger-bitcoin@0.3.0`, `@scure/bip32@2.0.1`.
