import { describe, expect, test } from "bun:test";
import {
  connectCardanoWallet,
  createCardanoBrowseUri,
  createCardanoDappClient,
  createCardanoP2PConnectUri,
  createRemoteCardanoApi,
  parseCardanoBrowseUri,
  parseCardanoP2PConnectUri,
  signCardanoMessage,
  utf8ToHex,
  type Cip30WalletApi,
} from "../src/cardano";

describe("cardano wallet extension", () => {
  const createApi = () => {
    let signDataArgs: { address: string; payload: string } | undefined;
    let signTxArgs: { partialSign?: boolean; tx: string } | undefined;
    let submitTxArg: string | undefined;

    const api: Cip30WalletApi = {
      getBalance: async () => "00",
      getChangeAddress: async () => "change_address_hex",
      getNetworkId: async () => 1,
      getRewardAddresses: async () => [],
      getUnusedAddresses: async () => [],
      getUsedAddresses: async () => ["used_address_hex"],
      getUtxos: async () => null,
      signData: async (address, payload) => {
        signDataArgs = { address, payload };
        return { key: "aabb", signature: "ccdd" };
      },
      signTx: async (tx, partialSign) => {
        signTxArgs = { partialSign, tx };
        return "beef";
      },
      submitTx: async (tx) => {
        submitTxArg = tx;
        return "hash";
      },
    };

    return { api, getSignDataArgs: () => signDataArgs, getSignTxArgs: () => signTxArgs, getSubmitTxArg: () => submitTxArg };
  };

  test("connects to an injected CIP-30 wallet and signs/submits through the dApp client", async () => {
    const state = createApi();
    let enableOptions: unknown;
    const cardano = {
      nami: {
        apiVersion: "1.0.0",
        enable: async (options?: unknown) => {
          enableOptions = options;
          return state.api;
        },
        icon: "data:image/png;base64,",
        isEnabled: async () => false,
        name: "Nami",
      },
    };

    const connected = await connectCardanoWallet({ cardano, walletId: "nami" });
    expect(connected.wallet.name).toBe("Nami");
    expect(enableOptions).toEqual({ extensions: [{ cip: 8 }] });

    const client = await createCardanoDappClient({ cardano, walletId: "Nami" });
    expect(await client.getAddress()).toBe("used_address_hex");
    expect(await client.signMessage("hello")).toEqual({ key: "aabb", signature: "ccdd" });
    expect(state.getSignDataArgs()).toEqual({ address: "used_address_hex", payload: "68656c6c6f" });
    expect(await client.signMessageHex("deadbeef")).toEqual({ key: "aabb", signature: "ccdd" });
    expect(state.getSignDataArgs()).toEqual({ address: "used_address_hex", payload: "deadbeef" });
    expect(await client.signTransaction("c0ffee", true)).toBe("beef");
    expect(state.getSignTxArgs()).toEqual({ partialSign: true, tx: "c0ffee" });
    expect(await client.submitTransaction("c0ffee")).toBe("hash");
    expect(state.getSubmitTxArg()).toBe("c0ffee");
  });

  test("wraps CIP-8 message signing through CIP-30 signData", async () => {
    const state = createApi();

    expect(utf8ToHex("SwapKit")).toBe("537761704b6974");
    expect(await signCardanoMessage({ address: "addr", api: state.api, message: { hex: "aabb" } })).toEqual({ key: "aabb", signature: "ccdd" });
    expect(state.getSignDataArgs()).toEqual({ address: "addr", payload: "aabb" });
    expect(signCardanoMessage({ address: "addr", api: state.api, message: { hex: "abc" } })).rejects.toThrow("even-length hex");
  });

  test("creates and parses CIP-158 wallet browse deep links", () => {
    const uri = createCardanoBrowseUri("app.sundae.fi/swap?x=1");

    expect(uri).toBe("web+cardano://browse/v1?uri=https%3A%2F%2Fapp.sundae.fi%2Fswap%3Fx%3D1");
    expect(parseCardanoBrowseUri(uri)).toEqual({ dappUri: "https://app.sundae.fi/swap?x=1", version: "v1" });
  });

  test("creates and parses CIP-45 P2P connect URIs", () => {
    const uri = createCardanoP2PConnectUri({ identifier: "pubkey", params: { network: 1, relay: "wss://relay.example" } });

    expect(parseCardanoP2PConnectUri(uri)).toEqual({ identifier: "pubkey", params: { network: "1", relay: "wss://relay.example" }, version: "v1" });
  });

  test("adapts any P2P transport into a CIP-30-shaped remote API", async () => {
    const calls: unknown[] = [];
    const remote = createRemoteCardanoApi({
      request: async <TResponse>(method: keyof Cip30WalletApi | string, params?: unknown): Promise<TResponse> => {
        calls.push({ method, params });
        return (method === "getNetworkId" ? 1 : "ok") as TResponse;
      },
    });

    expect(await remote.getNetworkId()).toBe(1);
    expect(await remote.signTx("abcd", false)).toBe("ok");
    expect(calls.at(-1)).toEqual({ method: "signTx", params: { partialSign: false, tx: "abcd" } });
  });
});
