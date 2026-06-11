import { CardanoExtensionError } from "./errors";
import type { Cip30Api, Cip30Paginate, CborHex } from "./types";
import { isRecord } from "./utils";

export const CIP45 = {
  cip: 45,
  name: "Decentralized WebRTC dApp-Wallet Communication",
} as const;

export const CIP45_AUTHORITY = "connect";
export const CIP45_VERSION = "v1";

export const CIP45_CARDANO_RPC_METHODS = [
  "getNetworkId",
  "getUtxos",
  "getBalance",
  "getUsedAddresses",
  "getUnusedAddresses",
  "getChangeAddress",
  "getRewardAddresses",
  "signTx",
  "signData",
  "submitTx",
] as const;

export type Cip45RpcMethod = (typeof CIP45_CARDANO_RPC_METHODS)[number];

export type Cip45ConnectUri = {
  identifier: string;
  params: Record<string, string>;
  version: string;
};

export type Cip45RpcTransport = {
  disconnect?: () => Promise<void> | void;
  request<TResponse = unknown>(method: Cip45RpcMethod | string, args?: unknown[]): Promise<TResponse>;
};

export type Cip45RpcRouter = {
  methods: readonly Cip45RpcMethod[];
  request<TResponse = unknown>(method: Cip45RpcMethod | string, args?: unknown[]): Promise<TResponse>;
};

export const createCip45ConnectUri = ({ identifier, params = {}, version = CIP45_VERSION }: { identifier: string; params?: Record<string, string>; version?: string }) => {
  assertCip45Identifier(identifier);

  const search = new URLSearchParams({ ...params, identifier });

  return `web+cardano://${CIP45_AUTHORITY}/${version}?${search.toString()}`;
};

export const parseCip45ConnectUri = (uri: string): Cip45ConnectUri => {
  const parsed = new URL(uri);
  const identifier = parsed.searchParams.get("identifier");

  if (parsed.protocol !== "web+cardano:" || parsed.hostname !== CIP45_AUTHORITY || !parsed.pathname.startsWith(`/${CIP45_VERSION}`) || !identifier) {
    throw new CardanoExtensionError("cardano_cip45_invalid_identifier", "Invalid CIP-45 Cardano connect URI");
  }

  assertCip45Identifier(identifier);

  return {
    identifier,
    params: Object.fromEntries(parsed.searchParams.entries()),
    version: parsed.pathname.slice(1),
  };
};

export const createCip45RemoteApi = (transport: Cip45RpcTransport): Cip30Api => ({
  getBalance: () => transport.request<CborHex>("getBalance"),
  getChangeAddress: () => transport.request<string>("getChangeAddress"),
  getExtensions: () => transport.request("getExtensions"),
  getNetworkId: () => transport.request<number>("getNetworkId"),
  getRewardAddresses: () => transport.request<string[]>("getRewardAddresses"),
  getUnusedAddresses: () => transport.request<string[]>("getUnusedAddresses"),
  getUsedAddresses: (paginate?: Cip30Paginate) => transport.request<string[]>("getUsedAddresses", [paginate]),
  getUtxos: (amount?: CborHex, paginate?: Cip30Paginate) => transport.request<CborHex[] | null>("getUtxos", [amount, paginate]),
  signData: (address: string, payload: string) => transport.request("signData", [address, payload]),
  signTx: (tx: CborHex, partialSign = false) => transport.request<CborHex>("signTx", [tx, partialSign]),
  submitTx: (tx: CborHex) => transport.request<string>("submitTx", [tx]),
});

export const createCip45WalletRpcRouter = (api: Cip30Api): Cip45RpcRouter => {
  const handlers: Record<Cip45RpcMethod, (args: unknown[]) => Promise<unknown>> = {
    getBalance: () => api.getBalance(),
    getChangeAddress: () => api.getChangeAddress(),
    getNetworkId: () => api.getNetworkId(),
    getRewardAddresses: () => api.getRewardAddresses(),
    getUnusedAddresses: () => api.getUnusedAddresses(),
    getUsedAddresses: (args) => api.getUsedAddresses(asOptionalPaginate(args[0])),
    getUtxos: (args) => api.getUtxos(asOptionalString(args[0]), asOptionalPaginate(args[1])),
    signData: (args) => api.signData(asString(args[0], "address"), asString(args[1], "payload")),
    signTx: (args) => api.signTx(asString(args[0], "tx"), asOptionalBoolean(args[1], false)),
    submitTx: (args) => api.submitTx(asString(args[0], "tx")),
  };

  return {
    methods: CIP45_CARDANO_RPC_METHODS,
    request: async <TResponse = unknown>(method: Cip45RpcMethod | string, args: unknown[] = []) => {
      if (!isCip45RpcMethod(method)) {
        throw new CardanoExtensionError("cardano_cip45_rpc_method_not_found", `CIP-45 RPC method "${method}" is not supported`);
      }

      return handlers[method](args) as Promise<TResponse>;
    },
  };
};

const assertCip45Identifier = (identifier: string) => {
  if (identifier.trim().length === 0) {
    throw new CardanoExtensionError("cardano_cip45_invalid_identifier", "CIP-45 identifier cannot be empty");
  }
};

const isCip45RpcMethod = (method: string): method is Cip45RpcMethod =>
  CIP45_CARDANO_RPC_METHODS.includes(method as Cip45RpcMethod);

const asString = (value: unknown, name: string) => {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);

  return value;
};

const asOptionalString = (value: unknown) => (value === undefined ? undefined : asString(value, "value"));

const asOptionalBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new TypeError("value must be a boolean");

  return value;
};

const asOptionalPaginate = (value: unknown) => {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.limit !== "number" || typeof value.page !== "number") {
    throw new TypeError("paginate must include numeric limit and page fields");
  }

  return { limit: value.limit, page: value.page };
};
