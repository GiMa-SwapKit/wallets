import { describe, expect, test } from "bun:test";
import {
  type Cip30WalletApi,
  createCardanoBrowseUri,
  createCardanoDappClient,
  createCardanoP2PConnectUri,
  createRemoteCardanoApi,
  parseCardanoBrowseUri,
  parseCardanoP2PConnectUri,
} from "../src/cardano";

const mockApi: Cip30WalletApi = {
  getBalance: async () => "1a",
  getChangeAddress: async () => "addr_change",
  getNetworkId: async () => 1,
  getRewardAddresses: async () => [],
  getUnusedAddresses: async () => [],
  getUsedAddresses: async () => ["addr_used"],
  getUtxos: async () => [],
  signData: async (address, payload) => ({ key: `key:${address}`, signature: `sig:${payload}` }),
  signTx: async (tx, partialSign) => `${tx}:${partialSign ? "partial" : "full"}`,
  submitTx: async (tx) => `hash:${tx}`,
};

describe("cardano extensions", () => {
  test("connects to an injected CIP-30 wallet and signs/submits through the dApp client", async () => {
    const client = await createCardanoDappClient({
      cardano: {
        nami: {
          apiVersion: "1.0.0",
          enable: async () => mockApi,
          icon: "data:image/svg+xml;base64,",
          isEnabled: async () => true,
          name: "Nami",
        },
      },
      walletId: "nami",
    });

    expect(await client.getAddress()).toBe("addr_used");
    expect(await client.signTransaction("deadbeef", true)).toBe("deadbeef:partial");
    expect(await client.submitTransaction("cafe")).toBe("hash:cafe");
  });

  test("wraps CIP-8 message signing through CIP-30 signData", async () => {
    const client = await createCardanoDappClient({
      cardano: {
        eternl: {
          apiVersion: "1.0.0",
          enable: async () => mockApi,
          icon: "data:image/svg+xml;base64,",
          isEnabled: async () => true,
          name: "Eternl",
        },
      },
      walletId: "Eternl",
    });

    const signature = await client.signMessage("Login");

    expect(signature.key).toBe("key:addr_used");
    expect(signature.signature).toBe("sig:4c6f67696e");
  });

  test("creates and parses CIP-158 wallet browse deep links", () => {
    const uri = createCardanoBrowseUri("https://swapkit.dev/swap?asset=ada");
    const parsed = parseCardanoBrowseUri(uri);

    expect(uri).toBe("web+cardano://browse/v1?uri=https%3A%2F%2Fswapkit.dev%2Fswap%3Fasset%3Dada");
    expect(parsed).toEqual({ dappUri: "https://swapkit.dev/swap?asset=ada", version: "v1" });
  });

  test("creates and parses CIP-45 P2P connect URIs", () => {
    const uri = createCardanoP2PConnectUri({ identifier: "peer_public_key", params: { name: "SwapKit" } });
    const parsed = parseCardanoP2PConnectUri(uri);

    expect(uri).toBe("web+cardano://connect/v1?identifier=peer_public_key&name=SwapKit");
    expect(parsed).toEqual({ identifier: "peer_public_key", params: { name: "SwapKit" }, version: "v1" });
  });

  test("adapts any P2P transport into a CIP-30-shaped remote API", async () => {
    const calls: { method: string; params?: unknown }[] = [];
    const remote = createRemoteCardanoApi({
      request: async <TResponse>(method: keyof Cip30WalletApi | string, params?: unknown): Promise<TResponse> => {
        calls.push({ method, params });

        return (method === "getNetworkId" ? 1 : "ok") as TResponse;
      },
    });

    expect(await remote.getNetworkId()).toBe(1);
    expect(await remote.signTx("beef", true)).toBe("ok");
    expect(calls).toEqual([
      { method: "getNetworkId", params: undefined },
      { method: "signTx", params: { partialSign: true, tx: "beef" } },
    ]);
  });
});
