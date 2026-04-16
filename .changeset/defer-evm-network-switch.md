---
"@swapkit/wallet-extensions": patch
"@swapkit/wallets": patch
---

Defer EVM network switch from wallet connect to method call time. On connect we now just read the wallet's currently selected address and wire the toolbox; `prepareNetworkSwitch` handles the chain switch lazily when a transaction method is invoked. Stops the "add chain" prompt storm users saw on first connect.

Affected: evm-extensions (Metamask / Brave / Coinbase / EIP-6963), bitget, ctrl, okx, onekey, trustwallet, vultisig, phantom, talisman, keepkey-bex, passkeys.
