---
"@swapkit/wallet-extensions": patch
---

BitGet: drop dead `signTransaction` stub on Cosmos and stop spreading the Solana provider so toolbox synthesis of `signAndBroadcastTransaction` can use the real signer methods (V3 swap flow).
