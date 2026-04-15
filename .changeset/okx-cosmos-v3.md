---
"@swapkit/wallet-extensions": patch
---

OKX: pass the Keplr-compatible offline signer into `getCosmosToolbox` so the toolbox can synthesize `signAndBroadcastTransaction`, unblocking the V3 SwapKit swap flow for OKX Cosmos.
