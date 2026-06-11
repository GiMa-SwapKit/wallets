import { describe, expect, test } from "bun:test";
import {
  assertCardanoExtensionEnabled,
  connectCardanoWallet,
  createCip45ConnectUri,
  createCip45RemoteApi,
  createCip45WalletRpcRouter,
  createCip158BrowseUri,
  hexToUtf8,
  parseCip45ConnectUri,
  parseCip158BrowseUri,
  signCip8Data,
  signCardanoTx,
  submitCardanoTx,
  toCip8HexPayload,
  type CardanoNamespace,
  type Cip30Api,
  type Cip30Extension,
} from "../src";

const createMockApi = (): Cip30Api => ({
  getBalance: async () => "00",
  getChangeAddress: async () => "ab12",
  getExtensions: async () => [{ cip: 8 }],
  getNetworkId: async () => 1,
  getRewardAddresses: async () => ["beef"],
  getUnusedAddresses: async () => ["cafe"],
  getUsedAddresses: async () => ["babe"],
  getUtxos: async () => ["abcd"],
  signData: async () => ({ key: "aabb", signature: "ccdd" }),
  signTx: async (_tx, partialSign = false) => (partialSign ? "01" : "02"),
  submitTx: async () => "ef01",
});

describe("Cardano extension helpers", () => {
  test("connects to a CIP-30 wallet and forwards requested extensions", async () => {
    const enabledExtensions: Cip30Extension[][] = [];
    const api = createMockApi();
    const cardano: CardanoNamespace = {
      eternl: {
        apiVersion: "1.0.0",
        enable: async (options) => {
          enabledExtensions.push(options?.extensions ?? []);

          return api;
        },
        icon: "data:image/svg+xml;base64,",
        isEnabled: async () => true,
        name: "Eternl",
      },
    };

    const connected = await connectCardanoWallet({ cardano, extensions: [{ cip: 45 }, { cip: 8 }, { cip: 8 }], walletName: "eternl" });

    expect(connected.api).toBe(api);
    expect(enabledExtensions[0]).toEqual([{ cip: 8 }, { cip: 45 }]);
    await expect(assertCardanoExtensionEnabled(api, 8)).resolves.toBe(true);
    await expect(signCardanoTx(api, "aabb", { partialSign: true })).resolves.toBe("01");
    await expect(submitCardanoTx(api, "aabb")).resolves.toBe("ef01");
  });

  test("wraps CIP-8 signData and converts utf8 payloads to hex", async () => {
    const api = createMockApi();

    expect(toCip8HexPayload("hello")).toBe("68656c6c6f");
    expect(hexToUtf8("68656c6c6f")).toBe("hello");
    await expect(signCip8Data({ address: "aabb", api, payload: new Uint8Array([1, 2, 3]) })).resolves.toEqual({
      key: "aabb",
      signature: "ccdd",
    });
  });

  test("creates and parses CIP-45 QR connection URIs", () => {
    const uri = createCip45ConnectUri({ identifier: "wallet-public-key", params: { relay: "tracker" } });
    const parsed = parseCip45ConnectUri(uri);

    expect(uri).toBe("web+cardano://connect/v1?relay=tracker&identifier=wallet-public-key");
    expect(parsed.identifier).toBe("wallet-public-key");
    expect(parsed.params.relay).toBe("tracker");
    expect(parsed.version).toBe("v1");
  });

  test("maps CIP-45 remote RPC requests to a CIP-30 API", async () => {
    const requests: { args?: unknown[]; method: string }[] = [];
    const remoteApi = createCip45RemoteApi({
      request: async (method, args) => {
        requests.push({ args, method });

        return method === "getNetworkId" ? 1 : "ok";
      },
    });

    await expect(remoteApi.getNetworkId()).resolves.toBe(1);
    await remoteApi.signTx("aabb", true);

    expect(requests).toEqual([
      { args: undefined, method: "getNetworkId" },
      { args: ["aabb", true], method: "signTx" },
    ]);
  });

  test("routes wallet-side CIP-45 RPC calls to the local CIP-30 API", async () => {
    const router = createCip45WalletRpcRouter(createMockApi());

    await expect(router.request("getBalance")).resolves.toBe("00");
    await expect(router.request("unknown")).rejects.toThrow("not supported");
  });

  test("creates and parses CIP-158 mobile browse deep links", () => {
    const uri = createCip158BrowseUri({ targetUri: "app.sundae.fi/exchange?given=ada.lovelace" });
    const parsed = parseCip158BrowseUri(uri);

    expect(uri).toBe("web+cardano://browse/v1?uri=https%3A%2F%2Fapp.sundae.fi%2Fexchange%3Fgiven%3Dada.lovelace");
    expect(parsed).toEqual({ targetUri: "https://app.sundae.fi/exchange?given=ada.lovelace", version: "v1" });
  });
});
