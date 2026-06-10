import { Chain, WalletOption } from "@swapkit/helpers";
import { type TONTransactionMessage, getTONToolbox } from "@swapkit/toolboxes/ton";
import { createWallet } from "@swapkit/wallet-core";
import {
  type Account,
  type Wallet as TonConnectWallet,
  TonConnect,
  isWalletInfoCurrentlyInjected,
  isWalletInfoRemote,
  toUserFriendlyAddress,
} from "@tonconnect/sdk";

// TON mainnet network identifier (workchain global id), shared with the rest of the repo.
const TON_MAINNET_CHAIN_ID = "-239";

// How long a signed transaction stays valid, in seconds.
const TRANSACTION_VALIDITY_SECONDS = 600;

/**
 * Opens a TON Connect session and resolves once a wallet reports a connected account.
 *
 * Mirrors the event-based connect flow used by the Xaman wallet: it wraps the
 * SDK's `onStatusChange` subscription in a promise. Injected wallets (browser
 * extensions / in-app browsers) connect over the JS bridge; otherwise the first
 * remote wallet from the registry is used and its universal link is opened so
 * the user can approve from their wallet app.
 */
function openTonConnectConnection(connector: TonConnect): Promise<Account> {
  return new Promise<Account>((resolve, reject) => {
    let settled = false;

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      action();
    };

    const unsubscribe = connector.onStatusChange(
      (wallet: TonConnectWallet | null) => {
        if (wallet?.account) {
          finish(() => resolve(wallet.account));
        }
      },
      (error) => {
        finish(() => reject(error));
      },
    );

    connector
      .getWallets()
      .then((wallets) => {
        const injected = wallets.find(isWalletInfoCurrentlyInjected);

        if (injected) {
          connector.connect({ jsBridgeKey: injected.jsBridgeKey });
          return;
        }

        const remote = wallets.find(isWalletInfoRemote);

        if (!remote) {
          throw new Error("TON Connect: no compatible wallet found in the registry.");
        }

        const universalLink = connector.connect({
          universalLink: remote.universalLink,
          bridgeUrl: remote.bridgeUrl,
        });

        if (typeof universalLink === "string" && typeof window !== "undefined") {
          window.open(universalLink, "_blank", "noopener,noreferrer");
        }
      })
      .catch((error) => {
        finish(() => reject(error));
      });
  });
}

export const tonConnectWallet = createWallet({
  connect:
    ({ addChain, walletType }) =>
    /**
     * @param _chains chains requested by the caller (TON Connect only supports {@link Chain.Ton}).
     * @param manifestUrl HTTPS URL of the dApp's `tonconnect-manifest.json`. Falls back to
     *   `${window.location.origin}/tonconnect-manifest.json` when omitted.
     */
    async (_chains: Chain[], manifestUrl?: string) => {
      const connector = new TonConnect(manifestUrl ? { manifestUrl } : undefined);

      // Reconnect to a previously approved session if one exists, otherwise open a new one.
      await connector.restoreConnection();

      const account = connector.account ?? (await openTonConnectConnection(connector));

      if (!account) {
        throw new Error("TON Connect: wallet connection was not completed.");
      }

      // `account.address` is the raw `<wc>:<hex>` form; convert to the user-friendly address.
      const address = toUserFriendlyAddress(account.address);
      const toolbox = getTONToolbox();

      const signAndBroadcastTransaction = async (messages: TONTransactionMessage[]) => {
        const result = await connector.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + TRANSACTION_VALIDITY_SECONDS,
          network: TON_MAINNET_CHAIN_ID,
          from: account.address,
          messages,
        });

        if (!result?.boc) {
          throw new Error("TON Connect: transaction was not signed.");
        }

        return result.boc;
      };

      const transfer = async (params: Parameters<typeof toolbox.createTransaction>[0]) => {
        const messages = (await toolbox.createTransaction({
          ...params,
          from: (params as { from?: string }).from ?? address,
        })) as TONTransactionMessage[];

        return signAndBroadcastTransaction(messages);
      };

      addChain({
        ...toolbox,
        address,
        balance: [],
        chain: Chain.Ton,
        disconnect: () => connector.disconnect(),
        signAndBroadcastTransaction,
        transfer,
        walletType,
      });

      return true;
    },
  // TON Connect requires per-transaction user approval, so it is not wired for V3 direct signing.
  directSigningSupport: { [Chain.Ton]: false },
  name: "tonconnect",
  supportedChains: [Chain.Ton],
  walletType: WalletOption.TON_CONNECT,
});
