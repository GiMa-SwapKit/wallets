---
"@swapkit/sdk": patch
"@swapkit/wallet-extensions": patch
"@swapkit/wallet-hardware": patch
"@swapkit/wallet-mobile": patch
"@swapkit/wallets": patch
---

Fix Ledger EVM approval signing by reusing the Ledger transport during signing and parsing legacy EIP-155 signature values correctly. Also refresh SwapKit package dependencies used by the wallet packages.
