export type HexString = string;
export type CborHex = HexString;
export type CardanoAddressHex = HexString;

export type Cip30Extension = {
  cip: number;
  [key: string]: unknown;
};

export type Cip30Paginate = {
  limit: number;
  page: number;
};

export type Cip8DataSignature = {
  key: HexString;
  signature: HexString;
};

export type Cip30Api = {
  experimental?: Record<string, unknown>;
  getBalance(): Promise<CborHex>;
  getChangeAddress(): Promise<CardanoAddressHex>;
  getCollateral?(params?: { amount?: CborHex; paginate?: Cip30Paginate }): Promise<CborHex[] | null>;
  getExtensions(): Promise<Cip30Extension[]>;
  getNetworkId(): Promise<number>;
  getRewardAddresses(): Promise<CardanoAddressHex[]>;
  getUnusedAddresses(): Promise<CardanoAddressHex[]>;
  getUsedAddresses(paginate?: Cip30Paginate): Promise<CardanoAddressHex[]>;
  getUtxos(amount?: CborHex, paginate?: Cip30Paginate): Promise<CborHex[] | null>;
  signData(address: CardanoAddressHex, payload: HexString): Promise<Cip8DataSignature>;
  signTx(tx: CborHex, partialSign?: boolean): Promise<CborHex>;
  submitTx(tx: CborHex): Promise<HexString>;
};

export type Cip30EnableOptions = {
  extensions?: Cip30Extension[];
};

export type Cip30Wallet = {
  apiVersion: string;
  enable(options?: Cip30EnableOptions): Promise<Cip30Api>;
  icon: string;
  isEnabled(): Promise<boolean>;
  name: string;
  supportedExtensions?: Cip30Extension[];
};

export type CardanoNamespace = Record<string, Cip30Wallet | undefined>;

export type Cip30WalletInfo = {
  id: string;
  wallet: Cip30Wallet;
};

declare global {
  interface Window {
    cardano?: CardanoNamespace;
  }
}
