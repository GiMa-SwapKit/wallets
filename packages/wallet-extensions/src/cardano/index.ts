/**
 * Single-file Cardano wallet helpers for dApps.
 *
 * Covers the dApp-facing parts of:
 * - CIP-30: browser wallet bridge: discover, connect, sign, submit
 * - CIP-8: message signing via CIP-30 api.signData(address, payloadHex)
 * - CIP-45: mobile ↔ desktop QR/deep-link connect URI + injectable P2P RPC adapter
 * - CIP-158: open a dApp inside a mobile wallet's in-app browser
 */

export const CARDANO_CIPS = {
  messageSigning: { cip: 8, name: "Message signing" },
  p2pWalletConnection: { cip: 45, name: "Decentralized WebRTC dApp-Wallet Communication" },
  webWalletBridge: { cip: 30, name: "Cardano dApp-Wallet Web Bridge" },
  walletBrowseDeepLink: { cip: 158, name: "Cardano URIs - Browse Application" },
} as const;

export type Address = string;
export type CborHex = string;
export type Hash32 = string;
export type HexString = string;

export type Cip30Extension = {
  cip: number;
};

export type Cip30Paginate = {
  limit: number;
  page: number;
};

export type Cip30DataSignature = {
  key: CborHex;
  signature: CborHex;
};

export type Cip30WalletApi = {
  getBalance(): Promise<CborHex>;
  getChangeAddress(): Promise<Address>;
  getExtensions?(): Promise<Cip30Extension[]>;
  getNetworkId(): Promise<number>;
  getRewardAddresses(): Promise<Address[]>;
  getUnusedAddresses(): Promise<Address[]>;
  getUsedAddresses(paginate?: Cip30Paginate): Promise<Address[]>;
  getUtxos(amount?: CborHex, paginate?: Cip30Paginate): Promise<CborHex[] | null>;
  signData(address: Address, payload: HexString): Promise<Cip30DataSignature>;
  signTx(tx: CborHex, partialSign?: boolean): Promise<CborHex>;
  submitTx(tx: CborHex): Promise<Hash32>;
  getCollateral?(params?: { amount?: CborHex; paginate?: Cip30Paginate }): Promise<CborHex[] | null>;
};

export type Cip30Wallet = {
  apiVersion: string;
  enable(options?: { extensions?: Cip30Extension[] }): Promise<Cip30WalletApi>;
  icon: string;
  isEnabled(): Promise<boolean>;
  name: string;
  supportedExtensions?: Cip30Extension[];
};

export type CardanoNamespace = Record<string, unknown>;

export type CardanoWalletInfo = {
  id: string;
  wallet: Cip30Wallet;
};

export type ConnectedCardanoWallet = {
  api: Cip30WalletApi;
  wallet: Cip30Wallet;
  walletId: string;
};

export type ConnectCardanoWalletParams = {
  /** Pass explicitly in tests/SSR. Defaults to window.cardano in browsers. */
  cardano?: CardanoNamespace;
  /** Request CIP-8 support by default because dApps commonly need signData. */
  extensions?: Cip30Extension[];
  walletId: string;
};

export class CardanoWalletError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CardanoWalletError";
  }
}

declare global {
  interface Window {
    cardano?: CardanoNamespace;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const getInjectedCardano = (): CardanoNamespace | undefined => {
  if (typeof window === "undefined") return undefined;

  return window.cardano;
};

export const isHex = (value: string) => value.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(value);

export const assertHex = (value: string, fieldName: string): void => {
  if (!isHex(value)) throw new CardanoWalletError("cardano_invalid_hex", `${fieldName} must be an even-length hex string`);
};

export const utf8ToHex = (value: string): HexString => {
  const bytes = new TextEncoder().encode(value);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const isCip30Wallet = (wallet: unknown): wallet is Cip30Wallet => {
  if (!isRecord(wallet)) return false;

  return (
    typeof wallet.apiVersion === "string" &&
    typeof wallet.enable === "function" &&
    typeof wallet.icon === "string" &&
    typeof wallet.isEnabled === "function" &&
    typeof wallet.name === "string"
  );
};

export const getCardanoWallets = (cardano: CardanoNamespace | undefined = getInjectedCardano()): CardanoWalletInfo[] =>
  Object.entries(cardano ?? {}).flatMap(([id, wallet]) => (isCip30Wallet(wallet) ? [{ id, wallet }] : []));

export const getCardanoWallet = (walletId: string, cardano?: CardanoNamespace): Cip30Wallet => {
  const walletInfo = getCardanoWallets(cardano).find(({ id, wallet }) => id === walletId || wallet.name === walletId);

  if (!walletInfo) throw new CardanoWalletError("cardano_wallet_not_found", `Cardano wallet "${walletId}" was not found`);

  return walletInfo.wallet;
};

export const connectCardanoWallet = async ({
  cardano,
  extensions = [{ cip: CARDANO_CIPS.messageSigning.cip }],
  walletId,
}: ConnectCardanoWalletParams): Promise<ConnectedCardanoWallet> => {
  const wallet = getCardanoWallet(walletId, cardano);
  const api = await wallet.enable(extensions.length > 0 ? { extensions } : undefined);

  return { api, wallet, walletId };
};

export const connectFirstCardanoWallet = async ({
  cardano = getInjectedCardano(),
  extensions = [{ cip: CARDANO_CIPS.messageSigning.cip }],
}: Omit<ConnectCardanoWalletParams, "walletId"> = {}): Promise<ConnectedCardanoWallet> => {
  const [firstWallet] = getCardanoWallets(cardano);
  if (!firstWallet) throw new CardanoWalletError("cardano_wallet_not_found", "No CIP-30 Cardano wallet was found");

  return connectCardanoWallet({ cardano, extensions, walletId: firstWallet.id });
};

export const getPrimaryCardanoAddress = async (api: Cip30WalletApi): Promise<Address> => {
  const usedAddresses = await api.getUsedAddresses();
  const [usedAddress] = usedAddresses;
  if (usedAddress) return usedAddress;

  return api.getChangeAddress();
};

export type CardanoMessage = string | { hex: HexString } | { text: string };

export const cardanoMessageToHex = (message: CardanoMessage): HexString => {
  if (typeof message === "string") return utf8ToHex(message);
  if ("text" in message) return utf8ToHex(message.text);

  assertHex(message.hex, "message.hex");
  return message.hex;
};

export const signCardanoMessage = async ({
  address,
  api,
  message,
}: {
  address?: Address;
  api: Cip30WalletApi;
  message: CardanoMessage;
}): Promise<Cip30DataSignature> => {
  const signingAddress = address ?? (await getPrimaryCardanoAddress(api));

  return api.signData(signingAddress, cardanoMessageToHex(message));
};

export type CardanoDappClient = ConnectedCardanoWallet & {
  getAddress(): Promise<Address>;
  signMessage(message: CardanoMessage, address?: Address): Promise<Cip30DataSignature>;
  signMessageHex(payloadHex: HexString, address?: Address): Promise<Cip30DataSignature>;
  signTransaction(txCborHex: CborHex, partialSign?: boolean): Promise<CborHex>;
  submitTransaction(txCborHex: CborHex): Promise<Hash32>;
};

export const createCardanoDappClient = async (params: ConnectCardanoWalletParams): Promise<CardanoDappClient> => {
  const connected = await connectCardanoWallet(params);
  const { api } = connected;

  return {
    ...connected,
    getAddress: () => getPrimaryCardanoAddress(api),
    signMessage: (message, address) => signCardanoMessage({ address, api, message }),
    signMessageHex: (payloadHex, address) => signCardanoMessage({ address, api, message: { hex: payloadHex } }),
    signTransaction: (txCborHex, partialSign = false) => {
      assertHex(txCborHex, "txCborHex");

      return api.signTx(txCborHex, partialSign);
    },
    submitTransaction: (txCborHex) => {
      assertHex(txCborHex, "txCborHex");

      return api.submitTx(txCborHex);
    },
  };
};

const ensureHttpUri = (uri: string): string => {
  const uriWithScheme = /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : `https://${uri}`;
  const parsed = new URL(uriWithScheme);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CardanoWalletError("cardano_invalid_uri", "Only http and https dApp URIs are supported");
  }

  return parsed.toString();
};

/** CIP-158: deep-link a user into a wallet's in-app browser with your dApp URL. */
export const createCardanoBrowseUri = (dappUri: string): string =>
  `web+cardano://browse/v1?uri=${encodeURIComponent(ensureHttpUri(dappUri))}`;

export const parseCardanoBrowseUri = (uri: string): { dappUri: string; version: "v1" } => {
  const parsed = new URL(uri);
  const dappUri = parsed.searchParams.get("uri");

  if (parsed.protocol !== "web+cardano:" || parsed.hostname !== "browse" || parsed.pathname !== "/v1" || !dappUri) {
    throw new CardanoWalletError("cardano_invalid_browse_uri", "Invalid CIP-158 browse URI");
  }

  return { dappUri: ensureHttpUri(dappUri), version: "v1" };
};

/** CIP-45: QR/deep-link payload for mobile ↔ desktop P2P wallet connection. */
export const createCardanoP2PConnectUri = ({
  identifier,
  params = {},
}: {
  identifier: string;
  params?: Record<string, string | number | boolean>;
}): string => {
  if (!identifier) throw new CardanoWalletError("cardano_missing_identifier", "A CIP-45 identifier is required");

  const search = new URLSearchParams({ identifier });
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));

  return `web+cardano://connect/v1?${search.toString()}`;
};

export const parseCardanoP2PConnectUri = (uri: string): { identifier: string; params: Record<string, string>; version: "v1" } => {
  const parsed = new URL(uri);
  const identifier = parsed.searchParams.get("identifier");

  if (parsed.protocol !== "web+cardano:" || parsed.hostname !== "connect" || parsed.pathname !== "/v1" || !identifier) {
    throw new CardanoWalletError("cardano_invalid_connect_uri", "Invalid CIP-45 connect URI");
  }

  const params = Object.fromEntries(parsed.searchParams.entries());
  delete params.identifier;

  return { identifier, params, version: "v1" };
};

/**
 * Transport-agnostic adapter for CIP-45-style P2P/RPC connections.
 * Plug in Bugout, Meerkat, WebRTC, postMessage, WalletConnect-like transport, etc.
 */
export type CardanoP2PTransport = {
  disconnect?(): Promise<void> | void;
  request<TResponse>(method: keyof Cip30WalletApi | string, params?: unknown): Promise<TResponse>;
};

export const createRemoteCardanoApi = (transport: CardanoP2PTransport): Cip30WalletApi => ({
  getBalance: () => transport.request<CborHex>("getBalance"),
  getChangeAddress: () => transport.request<Address>("getChangeAddress"),
  getCollateral: (params) => transport.request<CborHex[] | null>("getCollateral", params),
  getExtensions: () => transport.request<Cip30Extension[]>("getExtensions"),
  getNetworkId: () => transport.request<number>("getNetworkId"),
  getRewardAddresses: () => transport.request<Address[]>("getRewardAddresses"),
  getUnusedAddresses: () => transport.request<Address[]>("getUnusedAddresses"),
  getUsedAddresses: (paginate) => transport.request<Address[]>("getUsedAddresses", paginate),
  getUtxos: (amount, paginate) => transport.request<CborHex[] | null>("getUtxos", { amount, paginate }),
  signData: (address, payload) => {
    assertHex(payload, "payload");

    return transport.request<Cip30DataSignature>("signData", { address, payload });
  },
  signTx: (tx, partialSign = false) => {
    assertHex(tx, "tx");

    return transport.request<CborHex>("signTx", { partialSign, tx });
  },
  submitTx: (tx) => {
    assertHex(tx, "tx");

    return transport.request<Hash32>("submitTx", { tx });
  },
});

export const openCardanoBrowseUri = (dappUri: string, target: Pick<Location, "assign"> = window.location): void => {
  target.assign(createCardanoBrowseUri(dappUri));
};
