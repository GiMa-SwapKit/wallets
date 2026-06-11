import { CardanoExtensionError } from "./errors";
import type { CardanoNamespace, Cip30Api, Cip30Extension, Cip30Wallet, Cip30WalletInfo, CborHex, HexString } from "./types";
import { assertHex, isRecord } from "./utils";

export const CIP30 = {
  cip: 30,
  name: "Cardano dApp-Wallet Web Bridge",
} as const;

export type ConnectCardanoWalletParams = {
  cardano?: CardanoNamespace;
  extensions?: Cip30Extension[];
  walletName: string;
};

export type ConnectedCardanoWallet = {
  api: Cip30Api;
  wallet: Cip30Wallet;
  walletName: string;
};

const getWindowCardano = () => {
  if (typeof window === "undefined") return undefined;

  return window.cardano;
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

export const getCardanoWallets = (cardano: CardanoNamespace | undefined = getWindowCardano()): Cip30WalletInfo[] =>
  Object.entries(cardano ?? {}).flatMap(([id, wallet]) => (isCip30Wallet(wallet) ? [{ id, wallet }] : []));

export const getCardanoWallet = (walletName: string, cardano?: CardanoNamespace) => {
  const wallet = getCardanoWallets(cardano).find(({ id, wallet: walletInfo }) => id === walletName || walletInfo.name === walletName)?.wallet;

  if (!wallet) {
    throw new CardanoExtensionError("cardano_cip30_wallet_not_found", `Cardano wallet "${walletName}" was not found`);
  }

  return wallet;
};

export const normalizeCip30Extensions = (extensions: Cip30Extension[] = []) => {
  const byCip = new Map<number, Cip30Extension>();

  for (const extension of extensions) {
    byCip.set(extension.cip, extension);
  }

  return [...byCip.values()].sort((a, b) => a.cip - b.cip);
};

export const connectCardanoWallet = async ({ cardano, extensions, walletName }: ConnectCardanoWalletParams): Promise<ConnectedCardanoWallet> => {
  const wallet = getCardanoWallet(walletName, cardano);
  const api = await wallet.enable({ extensions: normalizeCip30Extensions(extensions) });

  if (!isCip30Api(api)) {
    throw new CardanoExtensionError("cardano_cip30_api_invalid", `Cardano wallet "${walletName}" returned an invalid CIP-30 API`);
  }

  return { api, wallet, walletName };
};

export const assertCardanoExtensionEnabled = async (api: Pick<Cip30Api, "getExtensions">, cip: number) => {
  const extensions = await api.getExtensions();
  const enabled = extensions.some((extension) => extension.cip === cip);

  if (!enabled) {
    throw new CardanoExtensionError("cardano_cip30_extension_missing", `Cardano wallet did not enable CIP-${cip}`);
  }

  return true;
};

export const signCardanoTx = async (api: Pick<Cip30Api, "signTx">, tx: CborHex, { partialSign = false } = {}) => {
  const witnessSet = await api.signTx(assertHex(tx, "Cardano transaction"), partialSign);

  return assertHex(witnessSet, "Cardano transaction witness set", { allowEmpty: true });
};

export const signCardanoData = async (api: Pick<Cip30Api, "signData">, address: HexString, payload: HexString) => {
  const signature = await api.signData(assertHex(address, "Cardano address"), assertHex(payload, "Cardano payload", { allowEmpty: true }));

  return {
    key: assertHex(signature.key, "CIP-8 COSE_Key"),
    signature: assertHex(signature.signature, "CIP-8 COSE_Sign1"),
  };
};

export const submitCardanoTx = async (api: Pick<Cip30Api, "submitTx">, tx: CborHex) => {
  const hash = await api.submitTx(assertHex(tx, "Cardano transaction"));

  return assertHex(hash, "Cardano transaction hash");
};

const isCip30Api = (api: unknown): api is Cip30Api => {
  if (!isRecord(api)) return false;

  return (
    typeof api.getBalance === "function" &&
    typeof api.getChangeAddress === "function" &&
    typeof api.getExtensions === "function" &&
    typeof api.getNetworkId === "function" &&
    typeof api.getRewardAddresses === "function" &&
    typeof api.getUnusedAddresses === "function" &&
    typeof api.getUsedAddresses === "function" &&
    typeof api.getUtxos === "function" &&
    typeof api.signData === "function" &&
    typeof api.signTx === "function" &&
    typeof api.submitTx === "function"
  );
};
