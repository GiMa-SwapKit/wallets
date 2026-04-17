---
"@swapkit/wallet-hardware": minor
"@swapkit/wallets": minor
"@swapkit/sdk": patch
---

Add account-aware UTXO HD discovery methods for hardware wallets. Ledger, Trezor, and KeepKey now expose `getExtendedPublicKeyInfo`, account-aware `deriveAddressAtIndex`, and batched `deriveAddresses`, while dependencies are bumped to the SDK versions that provide shared UTXO HD helpers.
