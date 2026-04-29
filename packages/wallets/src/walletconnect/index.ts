import type { StdSignDoc } from "@cosmjs/amino";
import type { Transaction } from "@near-js/transactions";
import {
  Chain,
  filterSupportedChains,
  type GenericTransferParams,
  getRPCUrl,
  SKConfig,
  SwapKitError,
  WalletOption,
} from "@swapkit/helpers";
import type { ThorchainDepositParams } from "@swapkit/toolboxes/cosmos";
import type { NearSigner } from "@swapkit/toolboxes/near";
import type { TronSignedTransaction, TronSigner, TronTransaction } from "@swapkit/toolboxes/tron";
import { createWallet, getWalletSupportedChains } from "@swapkit/wallet-core";
import type { WalletConnectModal } from "@walletconnect/modal";
import type SignClientClient from "@walletconnect/sign-client";
import type { SessionTypes, SignClientTypes } from "@walletconnect/types";
import {
  DEFAULT_APP_METADATA,
  DEFAULT_COSMOS_METHODS,
  DEFAULT_LOGGER,
  DEFAULT_RELAY_URL,
  THORCHAIN_MAINNET_ID,
} from "./constants";
import { getEVMSigner } from "./evmSigner";
import { chainToChainId, getAddressByChain } from "./helpers";
import { getConnectionNamespaces } from "./namespaces";

export * from "./constants";
export * from "./types";

export interface Walletconnect {
  accounts: string[];
  client: SignClientClient;
  disconnect: () => Promise<void>;
  session?: SessionTypes.Struct;
}

export const walletconnectWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectWalletconnect(chains: Chain[], walletconnectOptions?: SignClientTypes.Options) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });
      const { walletConnectProjectId } = SKConfig.get("apiKeys");

      if (!walletConnectProjectId) {
        throw new SwapKitError("wallet_walletconnect_project_id_not_specified");
      }

      const walletconnect = await getWalletconnect(
        filteredChains,
        supportedChains,
        walletConnectProjectId,
        walletconnectOptions,
      );

      const { accounts } = walletconnect;

      await Promise.all(
        filteredChains.map(async (chain) => {
          const address = getAddressByChain(chain, accounts || []);
          const toolbox = await getToolbox({ address, chain, walletconnect });

          addChain({
            ...toolbox,
            address,
            chain,
            disconnect: walletconnect.disconnect,
            walletType: WalletOption.WALLETCONNECT,
          });
        }),
      );

      return true;
    },
  directSigningSupport: {
    [Chain.Arbitrum]: true,
    [Chain.Aurora]: true,
    [Chain.Avalanche]: true,
    [Chain.Base]: true,
    [Chain.Berachain]: true,
    [Chain.BinanceSmartChain]: true,
    [Chain.Ethereum]: true,
    [Chain.Monad]: true,
    [Chain.Optimism]: true,
    [Chain.Polygon]: true,
    [Chain.XLayer]: true,
    // Cosmos/Kujira/Maya/THORChain: cosmos toolbox built without signer; Tron/Near: signer wired but pending hardening (V3 plan PRs)
  },
  name: "connectWalletconnect",
  supportedChains: [
    Chain.Arbitrum,
    Chain.Aurora,
    Chain.Avalanche,
    Chain.Base,
    Chain.Berachain,
    Chain.BinanceSmartChain,
    Chain.Cosmos,
    Chain.Ethereum,
    Chain.Kujira,
    Chain.Maya,
    Chain.Monad,
    Chain.Near,
    Chain.Optimism,
    Chain.Polygon,
    Chain.THORChain,
    Chain.Tron,
    Chain.XLayer,
  ],
  walletType: WalletOption.WALLETCONNECT,
});

export const WC_SUPPORTED_CHAINS = getWalletSupportedChains(walletconnectWallet);

async function getToolbox<T extends (typeof WC_SUPPORTED_CHAINS)[number]>({
  chain,
  walletconnect,
  address,
}: {
  walletconnect: Walletconnect;
  chain: T;
  address: string;
}) {
  const session = walletconnect?.session;
  if (!session) {
    throw new SwapKitError("wallet_walletconnect_connection_not_established");
  }

  switch (chain) {
    case Chain.Arbitrum:
    case Chain.Aurora:
    case Chain.Avalanche:
    case Chain.Base:
    case Chain.Berachain:
    case Chain.BinanceSmartChain:
    case Chain.Ethereum:
    case Chain.Monad:
    case Chain.Optimism:
    case Chain.Polygon:
    case Chain.XLayer: {
      const { getProvider, getEvmToolboxAsync } = await import("@swapkit/toolboxes/evm");

      const provider = await getProvider(chain);
      const signer = await getEVMSigner({ chain, provider, walletconnect });
      const toolbox = await getEvmToolboxAsync(chain, { provider, signer });

      return toolbox;
    }

    case Chain.THORChain: {
      const { SignMode } = await import("cosmjs-types/cosmos/tx/signing/v1beta1/signing.js");
      const { TxRaw } = await import("cosmjs-types/cosmos/tx/v1beta1/tx.js");

      const importedSigning = await import("@cosmjs/proto-signing");
      const encodePubkey = importedSigning.encodePubkey ?? importedSigning.default?.encodePubkey;
      const makeAuthInfoBytes = importedSigning.makeAuthInfoBytes ?? importedSigning.default?.makeAuthInfoBytes;
      const importedAmino = await import("@cosmjs/amino");
      const makeSignDoc = importedAmino.makeSignDoc ?? importedSigning.default?.makeSignDoc;

      const {
        getCosmosToolbox,
        buildAminoMsg,
        buildEncodedTxBody,
        createStargateClient,
        fromBase64,
        getDefaultChainFee,
        parseAminoMessageForDirectSigning,
      } = await import("@swapkit/toolboxes/cosmos");
      const toolbox = await getCosmosToolbox(chain);

      const fee = getDefaultChainFee(chain);

      const signRequest = (signDoc: StdSignDoc) =>
        walletconnect?.client.request({
          chainId: THORCHAIN_MAINNET_ID,
          request: { method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_AMINO, params: { signDoc, signerAddress: address } },
          topic: session.topic,
        });

      async function thorchainTransfer({ assetValue, memo, ...rest }: GenericTransferParams | ThorchainDepositParams) {
        const account = await toolbox.getAccount(address);
        if (!account) {
          throw new SwapKitError({ errorKey: "wallet_missing_params", info: { account } });
        }

        if (!account.pubkey) {
          throw new SwapKitError({ errorKey: "wallet_missing_params", info: { account, pubkey: account?.pubkey } });
        }

        const { accountNumber, sequence = 0 } = account;

        const msgs = [buildAminoMsg({ ...rest, assetValue, memo, sender: address })];

        const signDoc = makeSignDoc(
          msgs,
          fee,
          assetValue.chainId,
          memo,
          accountNumber?.toString(),
          sequence?.toString() || "0",
        );

        const signature: any = await signRequest(signDoc);

        const bodyBytes = await buildEncodedTxBody({
          chain: Chain.THORChain,
          memo: memo || "",
          msgs: msgs.map(parseAminoMessageForDirectSigning),
        });
        const pubkey = encodePubkey(account.pubkey);
        const authInfoBytes = makeAuthInfoBytes(
          [{ pubkey, sequence }],
          fee.amount,
          Number.parseInt(fee.gas, 10),
          undefined,
          undefined,
          SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
        );

        const txRaw = TxRaw.fromPartial({
          authInfoBytes,
          bodyBytes,
          signatures: [
            fromBase64(typeof signature.signature === "string" ? signature.signature : signature.signature.signature),
          ],
        });
        const txBytes = TxRaw.encode(txRaw).finish();

        const rpcUrl = await getRPCUrl(Chain.THORChain);
        const broadcaster = await createStargateClient(rpcUrl);
        const result = await broadcaster.broadcastTx(txBytes);
        return result.transactionHash;
      }

      return {
        ...toolbox,
        deposit: (params: ThorchainDepositParams) => thorchainTransfer(params),
        transfer: (params: GenericTransferParams) => thorchainTransfer(params),
      };
    }

    case Chain.Near: {
      const { getNearToolbox } = await import("@swapkit/toolboxes/near");
      const { DEFAULT_NEAR_METHODS } = await import("./constants");

      // Create a NEAR signer that uses WalletConnect
      const signer = {
        getAddress() {
          return Promise.resolve(address);
        },
        getPublicKey() {
          // WalletConnect NEAR doesn't expose public key directly
          return Promise.reject(
            new SwapKitError("wallet_walletconnect_method_not_supported", { method: "getPublicKey" }),
          );
        },

        signDelegateAction(_delegateAction: any) {
          return Promise.reject(
            new SwapKitError("wallet_walletconnect_method_not_supported", { method: "signDelegateAction" }),
          );
        },

        signNep413Message(
          _message: string,
          _accountId: string,
          _recipient: string,
          _nonce: Uint8Array,
          _callbackUrl?: string,
        ) {
          // WalletConnect NEAR spec doesn't include NEP-413 message signing
          return Promise.reject(
            new SwapKitError("wallet_walletconnect_method_not_supported", { method: "signNep413Message" }),
          );
        },

        async signTransaction(transaction: Transaction) {
          if (!walletconnect) {
            throw new SwapKitError("wallet_walletconnect_connection_not_established");
          }
          // WalletConnect signs and sends in one operation
          const result = await walletconnect.client.request({
            chainId: chainToChainId(Chain.Near),
            request: { method: DEFAULT_NEAR_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION, params: { transaction } },
            topic: session.topic,
          });
          // Return dummy hash and result
          return [new Uint8Array(32), result];
        },
      } as NearSigner;

      const toolbox = getNearToolbox({ signer });
      return toolbox;
    }

    case Chain.Tron: {
      const { getTronToolbox } = await import("@swapkit/toolboxes/tron");
      const { DEFAULT_TRON_METHODS } = await import("./constants");

      // Create a Tron signer that uses WalletConnect
      const signer: TronSigner = {
        getAddress() {
          return Promise.resolve(address);
        },

        async signTransaction(transaction: TronTransaction) {
          if (!walletconnect) {
            throw new SwapKitError("wallet_walletconnect_connection_not_established");
          }

          const signedTx = await walletconnect.client.request({
            chainId: chainToChainId(Chain.Tron),
            request: { method: DEFAULT_TRON_METHODS.TRON_SIGN_TRANSACTION, params: { transaction } },
            topic: session.topic,
          });

          return signedTx as TronSignedTransaction;
        },
      };

      const toolbox = getTronToolbox({ signer });

      return toolbox;
    }

    default:
      throw new SwapKitError({
        errorKey: "wallet_chain_not_supported",
        info: { chain, wallet: WalletOption.WALLETCONNECT },
      });
  }
}

async function getWalletconnect(
  chains: Chain[],
  allSupportedChains: Chain[],
  walletConnectProjectId: string,
  walletconnectOptions?: SignClientTypes.Options,
) {
  let modal: WalletConnectModal | undefined;
  const chainIds = chains.map(chainToChainId).filter(Boolean);
  const supportedChainIds = allSupportedChains.map(chainToChainId).filter(Boolean);
  const { optionalNamespaces, requiredNamespaces } = getConnectionNamespaces({
    optionalChains: supportedChainIds,
    requiredChains: chainIds,
  });

  try {
    const { SignClient } = await import("@walletconnect/sign-client");
    const { WalletConnectModal } = await import("@walletconnect/modal");

    const client = await SignClient.init({
      logger: DEFAULT_LOGGER,
      metadata: walletconnectOptions?.metadata || DEFAULT_APP_METADATA,
      projectId: walletConnectProjectId,
      relayUrl: DEFAULT_RELAY_URL,
      ...walletconnectOptions?.core,
    });

    modal = new WalletConnectModal({
      logger: DEFAULT_LOGGER,
      projectId: walletConnectProjectId,
      relayUrl: DEFAULT_RELAY_URL,
      ...walletconnectOptions?.core,
    });

    const existingSession = getPreferredSession(client.find({ requiredNamespaces }));
    if (existingSession) {
      return createWalletconnectConnection({ client, session: existingSession });
    }

    const pairingTopic = getPreferredPairingTopic(client);
    const { uri, approval } = await client.connect({
      optionalNamespaces,
      pairingTopic,
      requiredNamespaces,
    });

    if (uri) {
      modal.openModal({ uri });
    }

    const session = await approval();

    if (!session) {
      throw new SwapKitError("wallet_walletconnect_connection_not_established");
    }

    return createWalletconnectConnection({ client, session });
  } finally {
    if (modal) {
      modal.closeModal();
    }
  }
}

function createWalletconnectConnection({
  client,
  session,
}: {
  client: SignClientClient;
  session: SessionTypes.Struct;
}): Walletconnect {
  const walletconnect: Walletconnect = {
    accounts: extractAccountsFromSession(session),
    client,
    disconnect: async () => {
      if (!walletconnect.session) return;
      await client.disconnect({ reason: { code: 0, message: "User disconnected" }, topic: walletconnect.session.topic });
    },
    session,
  };

  client.on("session_delete", ({ topic }: SignClientTypes.EventArguments["session_delete"]) => {
    if (walletconnect.session?.topic !== topic) return;

    walletconnect.accounts = [];
    walletconnect.session = undefined;
  });

  client.on("session_expire", ({ topic }: SignClientTypes.EventArguments["session_expire"]) => {
    if (walletconnect.session?.topic !== topic) return;

    walletconnect.accounts = [];
    walletconnect.session = undefined;
  });

  client.on("session_update", ({ topic, params }: SignClientTypes.EventArguments["session_update"]) => {
    const currentSession = walletconnect.session;
    if (!currentSession || currentSession.topic !== topic) return;

    const nextSession = { ...currentSession, namespaces: params.namespaces };
    walletconnect.session = nextSession;
    walletconnect.accounts = extractAccountsFromSession(nextSession);
  });

  return walletconnect;
}

function extractAccountsFromSession(session: SessionTypes.Struct) {
  const accounts: string[] = [];

  for (const [_namespace, data] of Object.entries(session.namespaces)) {
    accounts.push(...data.accounts);
  }

  return accounts;
}

function getPreferredSession(sessions: SessionTypes.Struct[]) {
  return sessions
    .filter((session) => !isExpired(session.expiry))
    .sort((sessionA, sessionB) => sessionB.expiry - sessionA.expiry)[0];
}

function getPreferredPairingTopic(client: SignClientClient) {
  const sessions = client.session
    .getAll()
    .filter((session) => !isExpired(session.expiry))
    .sort((sessionA, sessionB) => sessionB.expiry - sessionA.expiry);

  if (sessions[0]?.pairingTopic) {
    return sessions[0].pairingTopic;
  }

  const pairings = client.core.pairing
    .getPairings()
    .filter((pairing) => pairing.active && !isExpired(pairing.expiry))
    .sort((pairingA, pairingB) => pairingB.expiry - pairingA.expiry);

  return pairings[0]?.topic;
}

function isExpired(expiry: number) {
  return expiry <= Math.floor(Date.now() / 1000);
}
