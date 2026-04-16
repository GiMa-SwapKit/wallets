---
"@swapkit/wallet-extensions": minor
"@swapkit/wallet-hardware": minor
"@swapkit/wallet-mobile": minor
"@swapkit/wallets": minor
---

Per-wallet `directSigningSupport` mappings for the V3 swap flow

- Bump `@swapkit/wallet-core` to `^4.2.0` and delete the duplicated local `core.ts` files in `wallets`, `wallet-extensions`, and `wallet-hardware` — every wallet module now imports `createWallet` / `getWalletSupportedChains` from `@swapkit/wallet-core` directly.
- Stamp `directSigningSupport: Partial<Record<Chain, boolean>>` on every `createWallet({...})` call so the SDK can decide V3 routing per (wallet, chain) without consulting a central map.
- Wire two real signers as part of the rollout:
  - **Xaman / Ripple** — `submitXamanPayload` now exposes the signed `hex` blob and accepts `{ submit: false }`; a new `ChainSigner` wraps `xumm.payload.createAndSubscribe` and is passed to `getRippleToolbox({ signer })`, unblocking V3 for XRPL.
  - **Ledger / Cosmos Hub** — pass the existing `CosmosLedger` (already an `OfflineAminoSigner`) into `getCosmosToolbox(Chain.Cosmos, { signer })`, unblocking V3 for ATOM. Bespoke `transfer` retained for back-compat.
- BitGet Cosmos: switch `getOfflineSignerOnlyAmino` → `getOfflineSignerAuto` so V3 proto SignDocs sign natively (Ledger via BitGet still falls back to amino).
- WalletConnect EVM: fix latent bugs flagged by the V3 audit — add Aurora and Berachain to the EVM `getToolbox` switch, register `XLAYER_MAINNET_ID` so XLayer's namespace negotiation works.
