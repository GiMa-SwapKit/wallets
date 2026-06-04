"use client";

import { type Chain, getChainConfig, WalletOption } from "@swapkit/helpers";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  CodeIcon,
  ExternalLinkIcon,
  InfoIcon,
  KeyRoundIcon,
  LinkIcon,
  MoonIcon,
  PaletteIcon,
  SlidersIcon,
  SunIcon,
  Wallet2Icon,
  WrenchIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type Control, Controller } from "react-hook-form";
import { cn } from "../../lib/utils";
import { SwapKitLogoHorizontalWhite } from "../assets/swapkit-logo-horizontal-white";
import { ChainIcon } from "../components/simple/chain-icon";
import { WalletIcon } from "../components/simple/wallet-icon";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ColorPickerField } from "../components/ui/color-picker-field";
import { InputField } from "../components/ui/input-field";
import { Separator } from "../components/ui/separator";
import { SnippetGenerator } from "../components/ui/snippet-generator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ToggleField } from "../components/ui/toggle-field";
import { ALL_CONTROLLABLE_WALLETS, WalletSelectionField } from "../components/ui/wallet-selection-field";
import { ALL_CONTROLLABLE_CHAINS, CHAIN_CATALOG, CHAIN_PRESETS, pickDefaultAssetPair } from "../lib/chain-catalog";
import { detectMissingWalletConfig, WALLET_CONFIG_REQUIREMENTS } from "../lib/wallet-config-requirements";
import type { ControlsStoreFieldValues } from "../types";
import { useSwapKitWidgetControlsForm } from "./use-swapkit-widget-controls-form";

// Ordered list driving the Wallet Configuration UI section. Hard-required first
// (connect throws without config), recommended-only after, NEAR last because it
// has no dedicated WalletOption in our enum (handled by wallet-selector toolbox).
type WalletConfigBlock = {
  /** WalletOption keyed in WALLET_CONFIG_REQUIREMENTS. Omitted for NEAR (no enum entry). */
  wallet?: WalletOption;
  label: string;
  /** One-line description rendered under the wallet name in the redesigned row. */
  description: string;
  fields: ReadonlyArray<{ name: `apiKeys.${string}` | `integrations.${string}`; label: string; placeholder?: string }>;
};

const WALLET_CONFIG_BLOCKS: ReadonlyArray<WalletConfigBlock> = [
  {
    description: "Required: Project ID",
    fields: [
      { label: "Project ID", name: "apiKeys.walletConnectProjectId", placeholder: "Project ID from cloud.reown.com" },
    ],
    label: "WalletConnect",
    wallet: WalletOption.WALLETCONNECT,
  },
  {
    description: "Required: API Key",
    fields: [{ label: "API Key", name: "apiKeys.xaman", placeholder: "API key from apps.xumm.dev" }],
    label: "Xaman (XRPL)",
    wallet: WalletOption.XAMAN,
  },
  {
    description: "Required: dApp definition, app name + version",
    fields: [
      {
        label: "dApp Definition Address",
        name: "integrations.radix.dAppDefinitionAddress",
        placeholder: "account_rdx128...",
      },
      { label: "Application Name", name: "integrations.radix.applicationName", placeholder: "Your App" },
      { label: "Application Version", name: "integrations.radix.applicationVersion", placeholder: "1.0.0" },
      { label: "Network ID", name: "integrations.radix.networkId", placeholder: "1 (mainnet) | 2 (stokenet)" },
      { label: "Network Name", name: "integrations.radix.networkName", placeholder: "mainnet" },
      {
        label: "Dashboard Base URL",
        name: "integrations.radix.dashboardBase",
        placeholder: "https://dashboard.radixdlt.com",
      },
    ],
    label: "Radix Wallet",
    wallet: WalletOption.RADIX_WALLET,
  },
  {
    description: "Required: bridge base path + URL",
    fields: [
      { label: "Bridge Base Path", name: "integrations.keepKey.basePath", placeholder: "http://localhost:1646" },
      { label: "Bridge URL", name: "integrations.keepKey.url", placeholder: "ws://localhost:1646/spec/swagger.json" },
      { label: "Name", name: "integrations.keepKey.name", placeholder: "Your App" },
      { label: "Image URL", name: "integrations.keepKey.imageUrl", placeholder: "https://example.com/logo.png" },
      { label: "API Key (cloud relay only)", name: "apiKeys.keepKey", placeholder: "" },
    ],
    label: "KeepKey",
    wallet: WalletOption.KEEPKEY,
  },
  {
    description: "Required: App ID",
    fields: [{ label: "App ID", name: "apiKeys.passkeys", placeholder: "Issued by SwapKit" }],
    label: "Passkeys",
    wallet: WalletOption.PASSKEYS,
  },
  {
    description: "Recommended: email + app URL",
    fields: [
      { label: "Email", name: "integrations.trezor.email", placeholder: "team@example.com" },
      { label: "App URL", name: "integrations.trezor.appUrl", placeholder: "https://example.com" },
    ],
    label: "Trezor",
    wallet: WalletOption.TREZOR,
  },
  {
    description: "Recommended: app name",
    fields: [
      { label: "App Name", name: "integrations.coinbase.appName", placeholder: "Your App" },
      { label: "App Logo URL", name: "integrations.coinbase.appLogoUrl", placeholder: "https://example.com/logo.png" },
    ],
    label: "Coinbase Wallet",
    wallet: WalletOption.COINBASE_WEB,
  },
  {
    description: "Recommended: contract ID",
    fields: [
      { label: "Contract ID", name: "integrations.nearWalletSelector.contractId", placeholder: "your-app.near" },
    ],
    // No dedicated WalletOption — NEAR connect goes through wallet-selector.
    label: "NEAR Wallet Selector",
  },
];

const COLOR_TOKENS = [
  { label: "Background", name: "colorPrimary", placeholder: "140 6% 8%" },
  { label: "Surface", name: "colorSecondary", placeholder: "120 3% 13%" },
  { label: "Accent", name: "colorAccent", placeholder: "140 87% 79%" },
  { label: "Button", name: "colorPrimaryButton", placeholder: "0 0% 100% / 0.92" },
  { label: "Button Text", name: "colorPrimaryButtonText", placeholder: "140 6% 8%" },
  { label: "Text", name: "colorText", placeholder: "0 0% 100% / 0.92" },
  { label: "Muted Text", name: "colorMutedText", placeholder: "0 0% 100% / 0.64" },
  { label: "Border", name: "colorBorder", placeholder: "0 0% 100% / 0.12" },
  { label: "Hover", name: "colorBgHover", placeholder: "0 0% 100% / 0.08" },
] as const satisfies ReadonlyArray<{ name: keyof ControlsStoreFieldValues; label: string; placeholder: string }>;

type PresetColors = Partial<
  Pick<
    ControlsStoreFieldValues,
    | "colorPrimary"
    | "colorSecondary"
    | "colorAccent"
    | "colorPrimaryButton"
    | "colorPrimaryButtonText"
    | "colorText"
    | "colorMutedText"
    | "colorBorder"
    | "colorBgHover"
  >
>;

type Mode = "dark" | "light";

type Preset = { name: string; dark: PresetColors; light: PresetColors };

// Dark variants share the same neutral text/border/hover layer (white-on-black with
// alpha) — defined once and reused so switching between dark presets, or Light → Dark,
// is a complete colour replacement instead of inheriting stale tokens.
const DARK_NEUTRALS = {
  colorBgHover: "0 0% 100% / 0.08",
  colorBorder: "0 0% 100% / 0.12",
  colorMutedText: "0 0% 100% / 0.64",
  colorText: "0 0% 100% / 0.92",
} as const satisfies PresetColors;

const PRESETS: ReadonlyArray<Preset> = [
  {
    dark: {
      ...DARK_NEUTRALS,
      colorAccent: "140 87% 79%",
      colorPrimary: "140 6% 8%",
      colorPrimaryButton: "0 0% 100% / 0.92",
      colorPrimaryButtonText: "140 6% 8%",
      colorSecondary: "120 3% 13%",
    },
    light: {
      colorAccent: "140 70% 38%",
      colorBgHover: "140 8% 12% / 0.05",
      colorBorder: "140 8% 12% / 0.10",
      colorMutedText: "140 6% 40%",
      colorPrimary: "0 0% 100%",
      colorPrimaryButton: "140 8% 12%",
      colorPrimaryButtonText: "0 0% 100%",
      colorSecondary: "140 14% 96%",
      colorText: "140 8% 12%",
    },
    name: "Default",
  },
  {
    dark: {
      ...DARK_NEUTRALS,
      colorAccent: "210 95% 70%",
      colorPrimary: "230 25% 8%",
      colorPrimaryButton: "210 95% 70%",
      colorPrimaryButtonText: "230 25% 8%",
      colorSecondary: "230 18% 14%",
    },
    light: {
      colorAccent: "230 75% 56%",
      colorBgHover: "230 30% 14% / 0.05",
      colorBorder: "230 30% 14% / 0.10",
      colorMutedText: "230 14% 42%",
      colorPrimary: "0 0% 100%",
      colorPrimaryButton: "230 35% 16%",
      colorPrimaryButtonText: "0 0% 100%",
      colorSecondary: "230 22% 96%",
      colorText: "230 30% 14%",
    },
    name: "Midnight",
  },
  {
    dark: {
      ...DARK_NEUTRALS,
      colorAccent: "22 95% 65%",
      colorPrimary: "20 18% 9%",
      colorPrimaryButton: "22 95% 65%",
      colorPrimaryButtonText: "20 18% 9%",
      colorSecondary: "20 12% 15%",
    },
    light: {
      colorAccent: "18 80% 50%",
      colorBgHover: "20 30% 14% / 0.05",
      colorBorder: "20 30% 14% / 0.10",
      colorMutedText: "20 14% 42%",
      colorPrimary: "30 50% 99%",
      colorPrimaryButton: "18 80% 50%",
      colorPrimaryButtonText: "0 0% 100%",
      colorSecondary: "24 60% 96%",
      colorText: "20 30% 14%",
    },
    name: "Sunset",
  },
];

// Tighter than the shared <InputField/> (h-8, 11px label, surface bg) so a
// 5-field wallet-config block fits without scrolling.
function CompactConfigField({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<ControlsStoreFieldValues>;
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <Controller
      control={control as unknown as Control}
      name={name}
      render={({ field }) => (
        <label className="sk-ui-flex sk-ui-flex-col sk-ui-gap-1">
          <span className="sk-ui-text-[11px] sk-ui-text-muted-foreground">{label}</span>
          <input
            {...field}
            className="sk-ui-h-8 sk-ui-rounded-[7px] sk-ui-border sk-ui-border-border sk-ui-bg-bg-surface sk-ui-px-2.5 sk-ui-text-[12px] sk-ui-text-foreground placeholder:sk-ui-text-muted-foreground focus:sk-ui-border-accent/50 focus-visible:sk-ui-outline-none"
            placeholder={placeholder}
            value={field.value ?? ""}
          />
        </label>
      )}
    />
  );
}

export function SwapKitWidgetControls() {
  const { apiBaseUrl, devApiUrl, developMode, enabledChains, enabledWalletOptions, form, useApiKeyAuth } =
    useSwapKitWidgetControlsForm();

  const totalWallets = ALL_CONTROLLABLE_WALLETS.length;
  const enabledWalletCount =
    enabledWalletOptions === "all"
      ? totalWallets
      : Array.isArray(enabledWalletOptions)
        ? enabledWalletOptions.length
        : 0;
  const walletStatusText =
    enabledWalletCount === totalWallets
      ? `All ${totalWallets} enabled`
      : enabledWalletCount === 0
        ? "None enabled"
        : `${enabledWalletCount} of ${totalWallets} enabled`;

  // Open by default when the user has already customised the selection so they
  // see what's currently on; otherwise stay collapsed and let them opt in.
  const [walletsExpanded, setWalletsExpanded] = useState(() => enabledWalletOptions !== "all");

  const devSettingsStatus = developMode ? "Dev mode on" : "Default";
  // Open by default when any developer field is non-default so users see what they've already changed.
  const [devSettingsExpanded, setDevSettingsExpanded] = useState(
    () => developMode || (devApiUrl ?? "") !== "" || (apiBaseUrl ?? "") !== "https://api.swapkit.dev",
  );

  const formValues = form.watch();
  const missingConfigSummaries = useMemo(
    () => detectMissingWalletConfig(formValues, enabledWalletOptions),
    [formValues, enabledWalletOptions],
  );
  const requiredMissingCount = missingConfigSummaries.filter((s) => s.missingRequired.length > 0).length;
  const walletConfigStatus =
    requiredMissingCount > 0
      ? `${requiredMissingCount} need config`
      : missingConfigSummaries.length > 0
        ? "Recommended fields missing"
        : "All set";
  const [walletConfigExpanded, setWalletConfigExpanded] = useState(false);
  const [expandedConfigRows, setExpandedConfigRows] = useState<Set<string>>(new Set());
  const toggleConfigRow = useCallback((label: string) => {
    setExpandedConfigRows((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Theme mode is component-only state — it picks which colour set ships out of the
  // selected preset, but isn't persisted in the form schema. Active preset is null
  // until the user clicks a card; "freeform" edits leave it null so toggling mode
  // alone never clobbers in-progress work.
  const [mode, setMode] = useState<Mode>("dark");
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const applyPresetColors = useCallback(
    (colors: PresetColors) => {
      for (const [key, value] of Object.entries(colors) as Array<[keyof PresetColors, string]>) {
        form.setValue(key, value, { shouldDirty: true });
      }
    },
    [form],
  );

  const applyPreset = useCallback(
    (preset: Preset) => {
      setActivePreset(preset);
      applyPresetColors(preset[mode]);
    },
    [applyPresetColors, mode],
  );

  const handleModeChange = useCallback(
    (next: Mode) => {
      setMode(next);
      if (activePreset) applyPresetColors(activePreset[next]);
    },
    [activePreset, applyPresetColors],
  );

  const handleAuthModeChange = useCallback(
    (next: "widget" | "api") => {
      form.setValue("useApiKeyAuth", next === "api", { shouldDirty: true });
    },
    [form],
  );

  // Quick toggle for enabling/disabling a wallet directly from its config block.
  // Mirrors the togglewallet logic inside WalletSelectionField but reads the
  // current enabledWalletOptions from the form so the two views stay in sync.
  const setWalletEnabled = useCallback(
    (wallet: WalletOption, next: boolean) => {
      const current = form.getValues("enabledWalletOptions");
      const isAll = current === "all";
      const currentList: WalletOption[] = isAll
        ? [...ALL_CONTROLLABLE_WALLETS]
        : Array.isArray(current)
          ? [...current]
          : [];
      const isPresent = isAll || currentList.includes(wallet);
      if (next === isPresent) return;
      const updated = next ? [...currentList, wallet] : currentList.filter((w) => w !== wallet);
      const normalised: WalletOption[] | "all" = updated.length === ALL_CONTROLLABLE_WALLETS.length ? "all" : updated;
      form.setValue("enabledWalletOptions", normalised, { shouldDirty: true });
    },
    [form],
  );

  const enabledChainList = useMemo(
    () => (enabledChains === "all" ? [...ALL_CONTROLLABLE_CHAINS] : enabledChains),
    [enabledChains],
  );
  const enabledChainSet = useMemo(() => new Set(enabledChainList), [enabledChainList]);
  const totalChains = ALL_CONTROLLABLE_CHAINS.length;
  const enabledChainCount = enabledChains === "all" ? totalChains : enabledChainList.length;

  const setChainList = useCallback(
    (next: ReadonlyArray<Chain>) => {
      // Re-normalise to the "all" sentinel when every chain is on so the snippet
      // and runtime resolver stay terse instead of emitting a 30-entry array.
      const normalised: Chain[] | "all" = next.length === ALL_CONTROLLABLE_CHAINS.length ? "all" : [...next];
      form.setValue("enabledChains", normalised, { shouldDirty: true });
    },
    [form],
  );

  const toggleChain = useCallback(
    (chain: Chain) => {
      const baseline = enabledChains === "all" ? [...ALL_CONTROLLABLE_CHAINS] : [...enabledChainList];
      const exists = baseline.includes(chain);
      const next = exists ? baseline.filter((c) => c !== chain) : [...baseline, chain];
      setChainList(next);
    },
    [enabledChains, enabledChainList, setChainList],
  );

  const applyChainPreset = useCallback((preset: ReadonlyArray<Chain>) => setChainList([...preset]), [setChainList]);

  const defaultPairUsable = useMemo(
    () => (enabledChains === "all" ? true : pickDefaultAssetPair(enabledChainList).hasUsableDefault),
    [enabledChains, enabledChainList],
  );

  const chainsStatusText =
    enabledChains === "all"
      ? `All ${totalChains} enabled`
      : enabledChainCount === 0
        ? "None enabled"
        : `${enabledChainCount} of ${totalChains} enabled`;

  const [chainsExpanded, setChainsExpanded] = useState(() => enabledChains !== "all");

  // Reset preserves auth fields — colours and toggles snap back, credentials stay.
  const handleReset = useCallback(() => {
    const { widgetId, widgetKey, apiKey, useApiKeyAuth: keepAuthMode } = form.getValues();
    form.reset(undefined, { keepDefaultValues: true });
    form.setValue("widgetId", widgetId);
    form.setValue("widgetKey", widgetKey);
    form.setValue("apiKey", apiKey);
    form.setValue("useApiKeyAuth", keepAuthMode);
  }, [form]);

  const authMode: "widget" | "api" = useApiKeyAuth ? "api" : "widget";

  return (
    <div className="swapkit-ui-preflight swapkit-controls-sidebar sk-ui-bg-background sk-ui-flex sk-ui-flex-col sk-ui-h-full">
      <div className="sk-ui-flex sk-ui-items-center sk-ui-justify-between sk-ui-gap-3 sk-ui-px-4 sk-ui-pt-4 sk-ui-pb-3 sk-ui-border-b sk-ui-border-border">
        <SwapKitLogoHorizontalWhite className="sk-ui-h-5 sk-ui-w-auto" />
        <span className="sk-ui-text-xs sk-ui-font-medium sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-muted-foreground">
          Widget Studio
        </span>
      </div>

      <Tabs className="sk-ui-flex-1 sk-ui-flex sk-ui-flex-col sk-ui-min-h-0" defaultValue="settings">
        <div className="sk-ui-px-4 sk-ui-pt-3">
          <TabsList className="sk-ui-grid sk-ui-grid-cols-3 sk-ui-gap-1.5 sk-ui-bg-white/[0.04] sk-ui-p-1.5 sk-ui-h-auto sk-ui-rounded-lg sk-ui-w-full">
            <TabsTrigger
              className="sk-ui-text-white/[0.92] sk-ui-bg-transparent data-[state=active]:sk-ui-bg-bg-hover sk-ui-h-auto sk-ui-py-1.5 sk-ui-rounded-md sk-ui-flex sk-ui-items-center sk-ui-gap-1.5"
              value="settings">
              <SlidersIcon className="sk-ui-w-3.5 sk-ui-h-3.5" /> Settings
            </TabsTrigger>
            <TabsTrigger
              className="sk-ui-text-white/[0.92] sk-ui-bg-transparent data-[state=active]:sk-ui-bg-bg-hover sk-ui-h-auto sk-ui-py-1.5 sk-ui-rounded-md sk-ui-flex sk-ui-items-center sk-ui-gap-1.5"
              value="design">
              <PaletteIcon className="sk-ui-w-3.5 sk-ui-h-3.5" /> Design
            </TabsTrigger>
            <TabsTrigger
              className="sk-ui-text-white/[0.92] sk-ui-bg-transparent data-[state=active]:sk-ui-bg-bg-hover sk-ui-h-auto sk-ui-py-1.5 sk-ui-rounded-md sk-ui-flex sk-ui-items-center sk-ui-gap-1.5"
              value="integrate">
              <CodeIcon className="sk-ui-w-3.5 sk-ui-h-3.5" /> Integrate
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          className="sk-ui-flex-1 sk-ui-overflow-y-auto sk-ui-px-4 sk-ui-py-4 sk-ui-flex sk-ui-flex-col sk-ui-gap-5"
          style={{ scrollbarGutter: "stable" }}
          value="design">
          <section>
            <div className="sk-ui-flex sk-ui-items-center sk-ui-justify-between sk-ui-mb-2">
              <h3 className="sk-ui-text-xs sk-ui-font-medium sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-muted-foreground">
                Presets
              </h3>
              <div
                aria-label="Theme mode"
                className="sk-ui-inline-flex sk-ui-p-0.5 sk-ui-bg-card sk-ui-border sk-ui-border-border sk-ui-rounded-md"
                role="radiogroup">
                {/* biome-ignore lint/a11y/useSemanticElements: icon-only segmented toggle — buttons + role=radio match the spec and stay style-scoped */}
                <button
                  aria-checked={mode === "dark"}
                  aria-label="Dark mode"
                  className={cn(
                    "sk-ui-inline-flex sk-ui-items-center sk-ui-justify-center sk-ui-w-7 sk-ui-h-6 sk-ui-rounded sk-ui-bg-transparent sk-ui-transition-colors focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring",
                    mode === "dark"
                      ? "sk-ui-bg-background sk-ui-text-foreground sk-ui-shadow-sm sk-ui-ring-1 sk-ui-ring-border"
                      : "sk-ui-text-muted-foreground hover:sk-ui-text-foreground",
                  )}
                  onClick={() => handleModeChange("dark")}
                  role="radio"
                  type="button">
                  <MoonIcon className="sk-ui-w-3 sk-ui-h-3" />
                </button>
                {/* biome-ignore lint/a11y/useSemanticElements: icon-only segmented toggle — buttons + role=radio match the spec and stay style-scoped */}
                <button
                  aria-checked={mode === "light"}
                  aria-label="Light mode"
                  className={cn(
                    "sk-ui-inline-flex sk-ui-items-center sk-ui-justify-center sk-ui-w-7 sk-ui-h-6 sk-ui-rounded sk-ui-bg-transparent sk-ui-transition-colors focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring",
                    mode === "light"
                      ? "sk-ui-bg-background sk-ui-text-foreground sk-ui-shadow-sm sk-ui-ring-1 sk-ui-ring-border"
                      : "sk-ui-text-muted-foreground hover:sk-ui-text-foreground",
                  )}
                  onClick={() => handleModeChange("light")}
                  role="radio"
                  type="button">
                  <SunIcon className="sk-ui-w-3 sk-ui-h-3" />
                </button>
              </div>
            </div>
            <div className="sk-ui-grid sk-ui-grid-cols-3 sk-ui-gap-2">
              {PRESETS.map((preset) => {
                const swatch = preset[mode];
                const isActive = activePreset?.name === preset.name;
                return (
                  <button
                    className={cn(
                      "sk-ui-flex sk-ui-flex-col sk-ui-items-start sk-ui-gap-1.5 sk-ui-p-2 sk-ui-rounded-lg sk-ui-border sk-ui-bg-card sk-ui-transition-colors hover:sk-ui-border-accent/30",
                      isActive ? "sk-ui-border-accent/60" : "sk-ui-border-border",
                    )}
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    type="button">
                    <div className="sk-ui-flex sk-ui-gap-0.5 sk-ui-w-full">
                      {(
                        [
                          ["primary", swatch.colorPrimary],
                          ["secondary", swatch.colorSecondary],
                          ["accent", swatch.colorAccent],
                        ] as const
                      ).map(([role, c]) => (
                        <span
                          className="sk-ui-flex-1 sk-ui-h-4 sk-ui-rounded-sm"
                          key={role}
                          style={{ background: c ? `hsl(${c})` : "transparent" }}
                        />
                      ))}
                    </div>
                    <span className="sk-ui-text-xs sk-ui-font-medium">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="sk-ui-text-xs sk-ui-font-medium sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-muted-foreground sk-ui-mb-2">
              Theme Colors
            </h3>
            <p className="sk-ui-text-xs sk-ui-text-muted-foreground sk-ui-mb-3">
              Click any token to open the picker, or enter HSL directly.
            </p>
            <div className="sk-ui-grid sk-ui-grid-cols-2 sk-ui-gap-2">
              {COLOR_TOKENS.map((token) => (
                <ColorPickerField
                  control={form.control}
                  key={token.name}
                  label={token.label}
                  name={token.name}
                  placeholder={token.placeholder}
                />
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent
          className="sk-ui-flex-1 sk-ui-overflow-y-auto sk-ui-px-4 sk-ui-py-4 sk-ui-flex sk-ui-flex-col sk-ui-gap-5"
          style={{ scrollbarGutter: "stable" }}
          value="settings">
          <section className="sk-ui-flex sk-ui-flex-col sk-ui-gap-3">
            <h3 className="sk-ui-text-xs sk-ui-font-medium sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-muted-foreground">
              Authentication
            </h3>

            <div className="sk-ui-grid sk-ui-grid-cols-2 sk-ui-gap-1 sk-ui-bg-white/[0.04] sk-ui-p-1 sk-ui-rounded-md">
              <button
                className={`sk-ui-py-1.5 sk-ui-px-3 sk-ui-rounded sk-ui-text-xs sk-ui-font-medium sk-ui-transition-colors ${
                  authMode === "widget"
                    ? "sk-ui-bg-bg-hover sk-ui-text-foreground"
                    : "sk-ui-text-muted-foreground hover:sk-ui-text-foreground"
                }`}
                onClick={() => handleAuthModeChange("widget")}
                type="button">
                Widget Key
              </button>
              <button
                className={`sk-ui-py-1.5 sk-ui-px-3 sk-ui-rounded sk-ui-text-xs sk-ui-font-medium sk-ui-transition-colors ${
                  authMode === "api"
                    ? "sk-ui-bg-bg-hover sk-ui-text-foreground"
                    : "sk-ui-text-muted-foreground hover:sk-ui-text-foreground"
                }`}
                onClick={() => handleAuthModeChange("api")}
                type="button">
                API Key
              </button>
            </div>

            {authMode === "widget" ? (
              <>
                <InputField
                  control={form.control}
                  label="Widget ID"
                  name="widgetId"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
                <InputField
                  control={form.control}
                  description={
                    <>
                      Find both in your{" "}
                      <Button asChild className="sk-ui-h-auto sk-ui-p-0 sk-ui-text-xs" variant="link">
                        <a href="https://docs.swapkit.dev" rel="noopener noreferrer" target="_blank">
                          dashboard
                        </a>
                      </Button>
                      .
                    </>
                  }
                  label="Widget Key"
                  name="widgetKey"
                  placeholder="Enter your widget key"
                />
              </>
            ) : (
              <InputField
                control={form.control}
                description="Use an API key for server-side or testing."
                label="API Key"
                name="apiKey"
                placeholder="Enter your API key"
              />
            )}
          </section>

          <Separator />

          <section>
            <button
              aria-expanded={devSettingsExpanded}
              className="sk-ui-flex sk-ui-w-full sk-ui-items-center sk-ui-gap-2 sk-ui-rounded-md sk-ui-bg-transparent sk-ui-px-1 sk-ui-py-1.5 sk-ui-text-left sk-ui-text-sm sk-ui-text-muted-foreground sk-ui-transition-colors hover:sk-ui-text-foreground focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring"
              onClick={() => setDevSettingsExpanded((open) => !open)}
              type="button">
              <WrenchIcon className="sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0" />
              <span>Developer settings</span>
              <span className="sk-ui-ml-auto sk-ui-text-xs sk-ui-tabular-nums">{devSettingsStatus}</span>
              <ChevronRightIcon
                className={cn(
                  "sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0 sk-ui-transition-transform sk-ui-duration-150",
                  devSettingsExpanded && "sk-ui-rotate-90",
                )}
              />
            </button>

            {devSettingsExpanded && (
              <div className="sk-ui-mt-2.5 sk-ui-flex sk-ui-flex-col sk-ui-gap-3">
                <InputField
                  control={form.control}
                  label="API Endpoint"
                  name="apiBaseUrl"
                  placeholder="https://api.swapkit.dev"
                />
                <ToggleField
                  control={form.control}
                  description="Use development endpoints & CDN"
                  label="Developer Mode"
                  name="developMode"
                />
                {developMode && (
                  <Card>
                    <CardContent className="!sk-ui-py-4 !sk-ui-px-4">
                      <InputField
                        control={form.control}
                        label="Dev API URL"
                        name="devApiUrl"
                        placeholder="https://dev-api.swapkit.dev"
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </section>

          <Separator />

          <section>
            <button
              aria-expanded={chainsExpanded}
              className="sk-ui-flex sk-ui-w-full sk-ui-items-center sk-ui-gap-2 sk-ui-rounded-md sk-ui-bg-transparent sk-ui-px-1 sk-ui-py-1.5 sk-ui-text-left sk-ui-text-sm sk-ui-text-muted-foreground sk-ui-transition-colors hover:sk-ui-text-foreground focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring"
              onClick={() => setChainsExpanded((open) => !open)}
              type="button">
              <LinkIcon className="sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0" />
              <span>Chains</span>
              <span className="sk-ui-ml-auto sk-ui-text-xs sk-ui-tabular-nums">{chainsStatusText}</span>
              <ChevronRightIcon
                className={cn(
                  "sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0 sk-ui-transition-transform sk-ui-duration-150",
                  chainsExpanded && "sk-ui-rotate-90",
                )}
              />
            </button>

            {chainsExpanded && (
              <div className="sk-ui-mt-2.5 sk-ui-flex sk-ui-flex-col sk-ui-gap-2.5">
                <div className="sk-ui-flex sk-ui-items-start sk-ui-gap-2 sk-ui-rounded-md sk-ui-border sk-ui-border-accent/20 sk-ui-bg-accent/[0.06] sk-ui-px-2.5 sk-ui-py-2 sk-ui-text-[11.5px] sk-ui-text-muted-foreground">
                  <InfoIcon className="sk-ui-w-3.5 sk-ui-h-3.5 sk-ui-shrink-0 sk-ui-mt-0.5 sk-ui-text-accent" />
                  <div className="sk-ui-flex sk-ui-flex-col sk-ui-gap-0.5">
                    <span>
                      Disabling a chain hides it from the asset selector. Wallets will be disabled if{" "}
                      <strong className="sk-ui-text-foreground sk-ui-font-medium">
                        none of their supported chains remain enabled
                      </strong>
                      .
                    </span>
                  </div>
                </div>

                {!defaultPairUsable && (
                  <div className="sk-ui-flex sk-ui-items-start sk-ui-gap-2 sk-ui-rounded-md sk-ui-border sk-ui-border-destructive/40 sk-ui-bg-destructive/10 sk-ui-px-2.5 sk-ui-py-2 sk-ui-text-[11.5px] sk-ui-text-foreground">
                    <AlertTriangleIcon className="sk-ui-w-3.5 sk-ui-h-3.5 sk-ui-shrink-0 sk-ui-mt-0.5 sk-ui-text-destructive-foreground" />
                    <span>
                      {enabledChainCount === 0 ? (
                        <>
                          <strong className="sk-ui-font-medium">No chains enabled.</strong> The widget can't operate
                          without at least one chain.
                        </>
                      ) : (
                        <>
                          <strong className="sk-ui-font-medium">No token pairs available</strong> on the enabled chain.
                          SwapKit doesn't route on-chain swaps for native-only chains — enable a second chain or pick
                          one with stablecoin support (Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, BNB
                          Chain, Solana, Tron).
                        </>
                      )}
                    </span>
                  </div>
                )}

                <div className="sk-ui-flex sk-ui-flex-wrap sk-ui-gap-1">
                  {CHAIN_PRESETS.map((preset) => {
                    // A preset is "active" when the user's selection matches it 1:1.
                    const presetSet = new Set(preset.chains);
                    const isAllPreset = preset.id === "all";
                    const matchesAll = isAllPreset && enabledChains === "all";
                    const matchesExact =
                      !isAllPreset &&
                      enabledChainList.length === preset.chains.length &&
                      enabledChainList.every((c) => presetSet.has(c));
                    const isActive = matchesAll || matchesExact;
                    return (
                      <button
                        aria-pressed={isActive}
                        className={cn(
                          "sk-ui-inline-flex sk-ui-items-center sk-ui-rounded-full sk-ui-border sk-ui-px-2.5 sk-ui-py-1 sk-ui-text-[11.5px] sk-ui-transition-colors focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring",
                          isActive
                            ? "sk-ui-border-accent/40 sk-ui-bg-accent/15 sk-ui-text-foreground"
                            : "sk-ui-border-border sk-ui-bg-transparent sk-ui-text-muted-foreground hover:sk-ui-bg-bg-hover hover:sk-ui-text-foreground",
                        )}
                        key={preset.id}
                        onClick={() => applyChainPreset(preset.chains)}
                        type="button">
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="sk-ui-flex sk-ui-items-center sk-ui-gap-1.5 sk-ui-text-[11.5px] sk-ui-text-muted-foreground">
                  <button
                    className="sk-ui-text-foreground hover:sk-ui-underline focus-visible:sk-ui-outline-none"
                    onClick={() => applyChainPreset(ALL_CONTROLLABLE_CHAINS)}
                    type="button">
                    Select all
                  </button>
                  <span aria-hidden>·</span>
                  <button
                    className="sk-ui-text-foreground hover:sk-ui-underline focus-visible:sk-ui-outline-none"
                    onClick={() => applyChainPreset([])}
                    type="button">
                    Clear
                  </button>
                  <span className="sk-ui-ml-auto sk-ui-tabular-nums">
                    {enabledChainCount} / {totalChains}
                  </span>
                </div>

                <div className="sk-ui-grid sk-ui-grid-cols-2 sk-ui-gap-1.5">
                  {CHAIN_CATALOG.map(({ chain, name }) => {
                    const isOn = enabledChainSet.has(chain);
                    return (
                      <button
                        aria-pressed={isOn}
                        className={cn(
                          "sk-ui-flex sk-ui-items-center sk-ui-gap-2 sk-ui-rounded-md sk-ui-border sk-ui-px-2 sk-ui-py-1.5 sk-ui-text-left sk-ui-transition-colors focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring",
                          isOn
                            ? "sk-ui-border-accent/30 sk-ui-bg-accent/[0.10]"
                            : "sk-ui-border-border sk-ui-bg-transparent hover:sk-ui-bg-bg-hover",
                        )}
                        key={chain}
                        onClick={() => toggleChain(chain)}
                        type="button">
                        <ChainIcon chain={chain} className="sk-ui-shrink-0 sk-ui-h-4 sk-ui-w-4" />
                        <span
                          className="sk-ui-flex-1 sk-ui-text-[12px] sk-ui-text-foreground sk-ui-truncate"
                          title={getChainConfig(chain)?.name ?? name}>
                          {name}
                        </span>
                        <CheckIcon
                          className={cn(
                            "sk-ui-w-3.5 sk-ui-h-3.5 sk-ui-shrink-0 sk-ui-text-accent sk-ui-transition-opacity",
                            isOn ? "sk-ui-opacity-100" : "sk-ui-opacity-0",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <Separator />

          <section>
            <button
              aria-expanded={walletsExpanded}
              className="sk-ui-flex sk-ui-w-full sk-ui-items-center sk-ui-gap-2 sk-ui-rounded-md sk-ui-bg-transparent sk-ui-px-1 sk-ui-py-1.5 sk-ui-text-left sk-ui-text-sm sk-ui-text-muted-foreground sk-ui-transition-colors hover:sk-ui-text-foreground focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring"
              onClick={() => setWalletsExpanded((open) => !open)}
              type="button">
              <Wallet2Icon className="sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0" />
              <span>Enabled wallets</span>
              <span className="sk-ui-ml-auto sk-ui-text-xs sk-ui-tabular-nums">{walletStatusText}</span>
              <ChevronRightIcon
                className={cn(
                  "sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0 sk-ui-transition-transform sk-ui-duration-150",
                  walletsExpanded && "sk-ui-rotate-90",
                )}
              />
            </button>

            {walletsExpanded && (
              <div className="sk-ui-mt-2.5 sk-ui-flex sk-ui-flex-col sk-ui-gap-1">
                <WalletSelectionField control={form.control} name="enabledWalletOptions" />
              </div>
            )}
          </section>

          <Separator />

          <section>
            <button
              aria-expanded={walletConfigExpanded}
              className="sk-ui-flex sk-ui-w-full sk-ui-items-center sk-ui-gap-2 sk-ui-rounded-md sk-ui-bg-transparent sk-ui-px-1 sk-ui-py-1.5 sk-ui-text-left sk-ui-text-sm sk-ui-text-muted-foreground sk-ui-transition-colors hover:sk-ui-text-foreground focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring"
              onClick={() => setWalletConfigExpanded((open) => !open)}
              type="button">
              <KeyRoundIcon className="sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0" />
              <span>Wallet configuration</span>
              <span
                className={cn(
                  "sk-ui-ml-auto sk-ui-text-xs sk-ui-tabular-nums sk-ui-inline-flex sk-ui-items-center sk-ui-gap-1",
                  requiredMissingCount > 0 && "sk-ui-text-destructive-foreground",
                )}>
                {requiredMissingCount > 0 && <AlertTriangleIcon className="sk-ui-w-3 sk-ui-h-3" />}
                {walletConfigStatus}
              </span>
              <ChevronRightIcon
                className={cn(
                  "sk-ui-w-4 sk-ui-h-4 sk-ui-shrink-0 sk-ui-transition-transform sk-ui-duration-150",
                  walletConfigExpanded && "sk-ui-rotate-90",
                )}
              />
            </button>

            {walletConfigExpanded && (
              <div className="sk-ui-mt-2.5 sk-ui-flex sk-ui-flex-col sk-ui-gap-2">
                {requiredMissingCount > 0 && (
                  <div className="sk-ui-flex sk-ui-items-start sk-ui-gap-2 sk-ui-rounded-md sk-ui-border sk-ui-border-destructive/40 sk-ui-bg-destructive/10 sk-ui-px-2.5 sk-ui-py-2 sk-ui-text-xs sk-ui-text-foreground">
                    <AlertTriangleIcon className="sk-ui-w-3.5 sk-ui-h-3.5 sk-ui-shrink-0 sk-ui-mt-0.5 sk-ui-text-destructive-foreground" />
                    <span>
                      <strong className="sk-ui-text-foreground sk-ui-font-medium">
                        {requiredMissingCount} enabled wallet{requiredMissingCount === 1 ? "" : "s"} need
                        {requiredMissingCount === 1 ? "s" : ""} configuration
                      </strong>{" "}
                      to connect. Click each row to expand.
                    </span>
                  </div>
                )}

                <div className="sk-ui-flex sk-ui-flex-col">
                  {[...WALLET_CONFIG_BLOCKS]
                    .map((block) => {
                      const requirement = block.wallet ? WALLET_CONFIG_REQUIREMENTS[block.wallet] : undefined;
                      const summary = block.wallet
                        ? missingConfigSummaries.find((s) => s.wallet === block.wallet)
                        : undefined;
                      const isWalletEnabled = block.wallet
                        ? enabledWalletOptions === "all" ||
                          (Array.isArray(enabledWalletOptions) && enabledWalletOptions.includes(block.wallet))
                        : true;
                      const hasMissingRequired = (summary?.missingRequired.length ?? 0) > 0;
                      const state: "needs-config" | "ready" | "off" = !isWalletEnabled
                        ? "off"
                        : hasMissingRequired
                          ? "needs-config"
                          : "ready";
                      return { block, isWalletEnabled, requirement, state, summary };
                    })
                    .map(({ block, requirement, isWalletEnabled, state }) => {
                      const isOpen = expandedConfigRows.has(block.label);
                      const tagText =
                        state === "needs-config" ? "Needs config" : state === "ready" ? "Ready" : "Disabled";
                      const tagClasses =
                        state === "needs-config"
                          ? "sk-ui-bg-destructive/15 sk-ui-text-destructive-foreground"
                          : state === "ready"
                            ? "sk-ui-bg-accent/15 sk-ui-text-accent"
                            : "sk-ui-bg-bg-hover sk-ui-text-muted-foreground";
                      // The status tag carries the urgency signal; the sub-line just needs the field hint.
                      const subline = block.description.replace(/^(Required|Recommended):\s*/i, "");
                      return (
                        <div
                          className="sk-ui-flex sk-ui-flex-col sk-ui-py-2.5 sk-ui-border-t sk-ui-border-border first:sk-ui-border-t-0"
                          key={block.label}>
                          <div className="sk-ui-flex sk-ui-items-center sk-ui-gap-2.5">
                            {block.wallet ? (
                              <WalletIcon
                                className="sk-ui-shrink-0 sk-ui-size-6 sk-ui-rounded-md"
                                wallet={block.wallet}
                              />
                            ) : (
                              // NEAR has no WalletOption entry, so no icon to render.
                              <span
                                aria-hidden
                                className="sk-ui-shrink-0 sk-ui-inline-flex sk-ui-h-6 sk-ui-w-6 sk-ui-items-center sk-ui-justify-center sk-ui-rounded-md sk-ui-bg-bg-hover sk-ui-text-[11px] sk-ui-font-semibold sk-ui-text-foreground">
                                {block.label.charAt(0)}
                              </span>
                            )}
                            <div className="sk-ui-flex sk-ui-flex-col sk-ui-min-w-0 sk-ui-flex-1 sk-ui-gap-0.5">
                              <div className="sk-ui-flex sk-ui-items-center sk-ui-gap-1.5">
                                <span className="sk-ui-text-sm sk-ui-font-medium sk-ui-text-foreground sk-ui-truncate">
                                  {block.label}
                                </span>
                                <span
                                  className={cn(
                                    "sk-ui-inline-flex sk-ui-items-center sk-ui-gap-1 sk-ui-rounded-full sk-ui-px-1.5 sk-ui-py-px sk-ui-text-[10px] sk-ui-font-semibold sk-ui-uppercase sk-ui-tracking-wider",
                                    tagClasses,
                                  )}>
                                  {state === "needs-config" && (
                                    <AlertTriangleIcon className="sk-ui-w-2.5 sk-ui-h-2.5" />
                                  )}
                                  {tagText}
                                </span>
                              </div>
                              <div className="sk-ui-flex sk-ui-items-center sk-ui-gap-1 sk-ui-text-[11px] sk-ui-text-muted-foreground">
                                <span className="sk-ui-truncate">{subline}</span>
                                {requirement?.link && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <a
                                      className="sk-ui-inline-flex sk-ui-shrink-0 sk-ui-items-center sk-ui-gap-0.5 sk-ui-text-foreground hover:sk-ui-underline"
                                      href={requirement.link}
                                      rel="noopener noreferrer"
                                      target="_blank">
                                      Learn more
                                      <ExternalLinkIcon className="sk-ui-w-2.5 sk-ui-h-2.5" />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="sk-ui-shrink-0 sk-ui-inline-flex sk-ui-items-center sk-ui-gap-1.5">
                              {block.wallet && (
                                <button
                                  aria-checked={isWalletEnabled}
                                  aria-label={`${isWalletEnabled ? "Disable" : "Enable"} ${block.label}`}
                                  className={cn(
                                    "sk-ui-shrink-0 sk-ui-inline-flex sk-ui-items-center sk-ui-rounded-full sk-ui-border sk-ui-transition-colors focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring",
                                    isWalletEnabled
                                      ? "sk-ui-bg-accent/20 sk-ui-border-accent/40"
                                      : "sk-ui-bg-bg-hover sk-ui-border-border",
                                  )}
                                  onClick={() => block.wallet && setWalletEnabled(block.wallet, !isWalletEnabled)}
                                  role="switch"
                                  style={{ height: 16, padding: 1, width: 28 }}
                                  type="button">
                                  <span
                                    className={cn(
                                      "sk-ui-block sk-ui-rounded-full sk-ui-transition-transform",
                                      isWalletEnabled ? "sk-ui-bg-accent" : "sk-ui-bg-muted-foreground/40",
                                    )}
                                    style={{
                                      height: 12,
                                      transform: isWalletEnabled ? "translateX(12px)" : "translateX(0)",
                                      width: 12,
                                    }}
                                  />
                                </button>
                              )}
                              <button
                                aria-expanded={isOpen}
                                aria-label={`${isOpen ? "Close" : "Configure"} ${block.label}`}
                                className={cn(
                                  "sk-ui-inline-flex sk-ui-h-7 sk-ui-w-7 sk-ui-items-center sk-ui-justify-center sk-ui-rounded-md sk-ui-border sk-ui-bg-transparent sk-ui-text-muted-foreground sk-ui-transition-colors hover:sk-ui-text-foreground focus-visible:sk-ui-outline-none focus-visible:sk-ui-ring-2 focus-visible:sk-ui-ring-ring",
                                  isOpen ? "sk-ui-border-border-hover sk-ui-text-foreground" : "sk-ui-border-border",
                                )}
                                onClick={() => toggleConfigRow(block.label)}
                                type="button">
                                <ChevronRightIcon
                                  className={cn(
                                    "sk-ui-w-3.5 sk-ui-h-3.5 sk-ui-transition-transform sk-ui-duration-150",
                                    isOpen && "sk-ui-rotate-90",
                                  )}
                                />
                              </button>
                            </div>
                          </div>
                          {isOpen && (
                            <div className="sk-ui-mt-2 sk-ui-flex sk-ui-flex-col sk-ui-gap-2 sk-ui-pl-[34px]">
                              {block.fields.map((field) => (
                                <CompactConfigField
                                  control={form.control}
                                  key={field.name}
                                  label={field.label}
                                  name={field.name}
                                  placeholder={field.placeholder}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent
          className="sk-ui-flex-1 sk-ui-overflow-y-auto sk-ui-px-4 sk-ui-py-4 sk-ui-flex sk-ui-flex-col sk-ui-gap-5"
          style={{ scrollbarGutter: "stable" }}
          value="integrate">
          <section>
            <h3 className="sk-ui-text-xs sk-ui-font-medium sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-muted-foreground sk-ui-mb-2">
              Embed Snippet
            </h3>
            <p className="sk-ui-text-xs sk-ui-text-muted-foreground sk-ui-mb-3">
              Drop this into your site's HTML — colors and wallet config are baked in.
            </p>
            <SnippetGenerator control={form.control} />
          </section>
        </TabsContent>
      </Tabs>

      <div className="sk-ui-flex sk-ui-items-center sk-ui-justify-end sk-ui-px-4 sk-ui-py-3 sk-ui-border-t sk-ui-border-border sk-ui-bg-black/20">
        <Button disabled={!form.formState.isDirty} onClick={handleReset} size="sm" variant="ghost">
          Reset
        </Button>
      </div>
    </div>
  );
}
