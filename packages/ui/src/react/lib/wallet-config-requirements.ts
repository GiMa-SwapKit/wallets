import { WalletOption } from "@swapkit/helpers";
import type { ControlsStoreFieldValues } from "../types";

/**
 * Per-wallet declaration of which form-field paths must be set for the SDK
 * connect path to succeed. Verified against the actual `@swapkit/wallets` /
 * `@swapkit/wallet-hardware` / `@swapkit/toolboxes` source (April 2026):
 *
 *   - WalletConnect, Xaman, KeepKey, Radix, Passkeys throw at connect time
 *     when their required keys are missing.
 *   - Trezor, Coinbase, NEAR fall back to (broken/empty) defaults at SDK
 *     init — they don't throw but still need credentials to actually work.
 *
 * `link` is the canonical page where the credential is acquired; rendered as a
 * "Get yours" affordance next to the wallet's config block in the studio.
 */
export type WalletConfigRequirement = {
  /** Hard-required fields — connect will throw without them. */
  required: ReadonlyArray<{ path: ConfigPath; label: string }>;
  /** Soft-required — SDK won't throw, but the connect won't be functional. */
  recommended: ReadonlyArray<{ path: ConfigPath; label: string }>;
  /** Where the user gets the credential. */
  link: string;
};

/** Dotted form-field path (e.g. `apiKeys.walletConnectProjectId`). */
export type ConfigPath = string;

export const WALLET_CONFIG_REQUIREMENTS: Partial<Record<WalletOption, WalletConfigRequirement>> = {
  [WalletOption.WALLETCONNECT]: {
    link: "https://cloud.reown.com",
    recommended: [],
    required: [{ label: "Project ID", path: "apiKeys.walletConnectProjectId" }],
  },
  [WalletOption.XAMAN]: {
    link: "https://apps.xumm.dev",
    recommended: [],
    required: [{ label: "API Key", path: "apiKeys.xaman" }],
  },
  [WalletOption.RADIX_WALLET]: {
    link: "https://console.radixdlt.com",
    recommended: [],
    required: [
      { label: "dApp Definition Address", path: "integrations.radix.dAppDefinitionAddress" },
      { label: "Application Name", path: "integrations.radix.applicationName" },
      { label: "Application Version", path: "integrations.radix.applicationVersion" },
    ],
  },
  [WalletOption.KEEPKEY]: {
    link: "https://docs.keepkey.com",
    recommended: [
      { label: "Name", path: "integrations.keepKey.name" },
      { label: "Image URL", path: "integrations.keepKey.imageUrl" },
    ],
    required: [
      { label: "Base Path", path: "integrations.keepKey.basePath" },
      { label: "Bridge URL", path: "integrations.keepKey.url" },
    ],
  },
  [WalletOption.PASSKEYS]: {
    link: "https://dashboard.swapkit.dev",
    recommended: [],
    required: [{ label: "App ID", path: "apiKeys.passkeys" }],
  },
  [WalletOption.TREZOR]: {
    link: "https://docs.trezor.io/trezor-suite/packages/connect",
    recommended: [
      { label: "Email", path: "integrations.trezor.email" },
      { label: "App URL", path: "integrations.trezor.appUrl" },
    ],
    // Trezor SDK falls back to empty fields, but TrezorConnect will reject
    // them at runtime. Treat as soft-required from our perspective.
    required: [],
  },
  [WalletOption.COINBASE_WEB]: {
    link: "https://docs.cdp.coinbase.com/wallet-sdk/docs/installing",
    recommended: [{ label: "App Name", path: "integrations.coinbase.appName" }],
    required: [],
  },
  [WalletOption.COINBASE_MOBILE]: {
    link: "https://docs.cdp.coinbase.com/wallet-sdk/docs/installing",
    recommended: [{ label: "App Name", path: "integrations.coinbase.appName" }],
    required: [],
  },
};

/** Walk a dotted path on the form values and return whether it resolves to a non-empty string. */
function readPath(values: ControlsStoreFieldValues, path: ConfigPath): string {
  const parts = path.split(".");
  let cursor: unknown = values;
  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return "";
    }
  }
  return typeof cursor === "string" ? cursor : "";
}

export type MissingConfigSummary = {
  wallet: WalletOption;
  link: string;
  missingRequired: ReadonlyArray<{ path: ConfigPath; label: string }>;
  missingRecommended: ReadonlyArray<{ path: ConfigPath; label: string }>;
};

/**
 * For every enabled wallet that has a configuration requirement, return the
 * subset of fields that haven't been filled in. Empty array means everything
 * configured wallets need is present.
 */
export function detectMissingWalletConfig(
  values: ControlsStoreFieldValues,
  enabledWallets: WalletOption[] | "all",
): MissingConfigSummary[] {
  const isEnabled = (wallet: WalletOption): boolean => enabledWallets === "all" || enabledWallets.includes(wallet);

  const summaries: MissingConfigSummary[] = [];
  for (const [walletKey, req] of Object.entries(WALLET_CONFIG_REQUIREMENTS)) {
    const wallet = walletKey as WalletOption;
    if (!isEnabled(wallet) || !req) continue;

    const missingRequired = req.required.filter(({ path }) => !readPath(values, path));
    const missingRecommended = req.recommended.filter(({ path }) => !readPath(values, path));
    if (missingRequired.length === 0 && missingRecommended.length === 0) continue;

    summaries.push({ link: req.link, missingRecommended, missingRequired, wallet });
  }

  return summaries;
}
