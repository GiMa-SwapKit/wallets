"use client";

import { SKConfig } from "@swapkit/helpers";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFormControl, useForm } from "react-hook-form";
import type { SwapKitColors } from "../components/config";
import type { ControlsStoreFieldValues } from "../types";
import { buildSdkConfigPatch } from "./build-sdk-config-patch";

declare const __SWAPKIT_IS_DEV__: boolean | undefined;

const defaultApiUrl = SKConfig.getState().envs.apiUrl;

const defaultValues: ControlsStoreFieldValues = {
  apiBaseUrl: defaultApiUrl,
  apiKey: "",

  apiKeys: { keepKey: "", passkeys: "", walletConnectProjectId: "", xaman: "" },
  colorAccent: "140 87% 79%", // --sk-ui-accent (brand/accent color)
  colorBgHover: "0 0% 100% / 0.08", // --sk-bg-hover (subtle)
  colorBorder: "0 0% 100% / 0.12", // --sk-ui-border
  colorMutedText: "0 0% 100% / 0.64", // --sk-ui-muted-foreground (subtle text)

  colorPrimary: "140 6% 8%", // --sk-bg (primary background)
  colorPrimaryButton: "0 0% 100% / 0.92", // --sk-ui-primary-button (primary button background)
  colorPrimaryButtonText: "140 6% 8%", // --sk-ui-primary-button-text (text on primary buttons)
  colorSecondary: "120 3% 13%", // --sk-bg-surface (secondary background)
  colorText: "0 0% 100% / 0.92", // --sk-ui-primary-foreground (main text)
  devApiUrl: "",

  developMode: typeof __SWAPKIT_IS_DEV__ !== "undefined" ? __SWAPKIT_IS_DEV__ : false,

  enabledChains: "all" as const,
  enabledWalletOptions: "all" as const,
  integrations: {
    coinbase: { appLogoUrl: "", appName: "" },
    keepKey: {
      // All fields default to empty so buildSdkConfigPatch only emits a
      // KeepKey integration block when the user explicitly opts in. The
      // localhost bridge URLs live as placeholders on the inputs.
      basePath: "",
      imageUrl: "",
      name: "",
      url: "",
    },
    nearWalletSelector: { contractId: "" },
    radix: {
      applicationName: "",
      applicationVersion: "",
      dAppDefinitionAddress: "",
      dashboardBase: "https://dashboard.radixdlt.com",
      networkId: "1",
      networkName: "mainnet",
    },
    trezor: { appUrl: "", email: "" },
  },

  useApiKeyAuth: false,

  useV3SwapFlow: true,
  widgetId: "",
  widgetKey: "",
};

// Eagerly apply persisted auth config to SKConfig before any component renders,
// so the first API requests (e.g. price fetches) already carry the correct auth.
function hydrateSkConfigFromLocalStorage() {
  if (typeof window === "undefined") return;

  try {
    const raw = localStorage.getItem("formValues");
    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (parsed.useApiKeyAuth && parsed.apiKey) {
      SKConfig.set({ apiKeys: { swapKit: parsed.apiKey } });
      SKConfig.setWidgetId("");
      SKConfig.setWidgetKey("");
    } else if (parsed.widgetId && parsed.widgetKey) {
      SKConfig.set({ apiKeys: { swapKit: "" } });
      SKConfig.setWidgetId(parsed.widgetId);
      SKConfig.setWidgetKey(parsed.widgetKey);
    }

    if (parsed.developMode != null) {
      SKConfig.setEnv("isDev", parsed.developMode);
    }
    if (parsed.devApiUrl) {
      SKConfig.setEnv("devApiUrl", parsed.devApiUrl);
    }

    // Apply persisted SDK-level wallet config so the very first connect attempt
    // (no React render needed) sees credentials from the previous session.
    if (parsed.apiKeys || parsed.integrations) {
      const patch = buildSdkConfigPatch({
        apiKeys: { keepKey: "", passkeys: "", walletConnectProjectId: "", xaman: "", ...parsed.apiKeys },
        integrations: {
          coinbase: { appLogoUrl: "", appName: "", ...parsed.integrations?.coinbase },
          keepKey: { basePath: "", imageUrl: "", name: "", url: "", ...parsed.integrations?.keepKey },
          nearWalletSelector: { contractId: "", ...parsed.integrations?.nearWalletSelector },
          radix: {
            applicationName: "",
            applicationVersion: "",
            dAppDefinitionAddress: "",
            dashboardBase: "https://dashboard.radixdlt.com",
            networkId: "1",
            networkName: "mainnet",
            ...parsed.integrations?.radix,
          },
          trezor: { appUrl: "", email: "", ...parsed.integrations?.trezor },
        },
      });
      if (Object.keys(patch).length > 0) SKConfig.set(patch);
    }
  } catch {
    // Invalid localStorage data — ignore, the useEffect will handle cleanup
  }
}

hydrateSkConfigFromLocalStorage();

const formControlInstance = createFormControl<ControlsStoreFieldValues>({ defaultValues });

export const useSwapKitWidgetControlsForm = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const previousValues = useRef<string>("");
  const form = useForm({ formControl: formControlInstance });

  const [
    apiBaseUrl,
    widgetId,
    widgetKey,
    useV3SwapFlow,
    enabledChains,
    enabledWalletOptions,
    useApiKeyAuth,
    apiKey,
    developMode,
    devApiUrl,
    colorPrimary,
    colorSecondary,
    colorPrimaryButton,
    colorPrimaryButtonText,
    colorAccent,
    colorBgHover,
    colorBorder,
    colorText,
    colorMutedText,
    apiKeys,
    integrations,
  ] = form.watch([
    "apiBaseUrl",
    "widgetId",
    "widgetKey",
    "useV3SwapFlow",
    "enabledChains",
    "enabledWalletOptions",
    "useApiKeyAuth",
    "apiKey",
    "developMode",
    "devApiUrl",
    "colorPrimary",
    "colorSecondary",
    "colorPrimaryButton",
    "colorPrimaryButtonText",
    "colorAccent",
    "colorBgHover",
    "colorBorder",
    "colorText",
    "colorMutedText",
    "apiKeys",
    "integrations",
  ]);

  const stringifiedValues = JSON.stringify({
    apiBaseUrl,
    apiKey,
    apiKeys,
    colorAccent,
    colorBgHover,
    colorBorder,
    colorMutedText,
    colorPrimary,
    colorPrimaryButton,
    colorPrimaryButtonText,
    colorSecondary,
    colorText,
    devApiUrl,
    developMode,
    enabledChains,
    enabledWalletOptions,
    integrations,
    useApiKeyAuth,
    useV3SwapFlow,
    widgetId,
    widgetKey,
  });

  useEffect(() => {
    const persistedValues = localStorage.getItem("formValues");

    if (!persistedValues) {
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(persistedValues);
      // Deep-merge persisted values with defaults so the form's nested
      // objects (apiKeys, integrations.*) are always fully populated, even
      // for users with localStorage from before those keys existed.
      // Without this, form.reset leaves them `undefined` and downstream
      // helpers (buildSdkConfigPatch, the wallet-config UI) crash.
      form.reset(
        {
          ...defaultValues,
          ...parsed,
          apiKeys: { ...defaultValues.apiKeys, ...parsed.apiKeys },
          integrations: {
            ...defaultValues.integrations,
            ...parsed.integrations,
            coinbase: { ...defaultValues.integrations.coinbase, ...parsed.integrations?.coinbase },
            keepKey: { ...defaultValues.integrations.keepKey, ...parsed.integrations?.keepKey },
            nearWalletSelector: {
              ...defaultValues.integrations.nearWalletSelector,
              ...parsed.integrations?.nearWalletSelector,
            },
            radix: { ...defaultValues.integrations.radix, ...parsed.integrations?.radix },
            trezor: { ...defaultValues.integrations.trezor, ...parsed.integrations?.trezor },
          },
        },
        { keepDefaultValues: true },
      );
    } catch {
      localStorage.removeItem("formValues");
    }

    setIsHydrated(true);
  }, [form]);

  useEffect(() => {
    if (!form.formState.isReady) return;
    if (previousValues.current === stringifiedValues) return;

    localStorage.setItem("formValues", stringifiedValues);

    window.dispatchEvent(new CustomEvent("swapkit-settings-changed"));

    previousValues.current = stringifiedValues;
  }, [stringifiedValues, form.formState.isReady]);

  useEffect(() => {
    const colorMappings: [string | undefined, string[]][] = [
      [colorPrimary, ["--sk-bg", "--sk-ui-background", "--sk-ui-sidebar-background", "--sk-ui-sidebar-primary"]],
      [colorSecondary, ["--sk-bg-surface", "--sk-ui-card", "--sk-ui-secondary", "--sk-ui-muted"]],
      [colorPrimaryButton, ["--sk-ui-primary-button"]],
      [colorPrimaryButtonText, ["--sk-ui-primary-button-text", "--sk-ui-primary-button-foreground"]],
      [colorAccent, ["--sk-ui-accent"]],
      [colorBgHover, ["--sk-bg-hover"]],
      [colorBorder, ["--sk-ui-border"]],
      [
        colorText,
        ["--sk-ui-primary-foreground", "--sk-ui-foreground", "--sk-ui-secondary-foreground", "--sk-ui-card-foreground"],
      ],
      [colorMutedText, ["--sk-ui-muted-foreground"]],
    ];

    const applyColorVariables = (element: HTMLElement) => {
      for (const [color, vars] of colorMappings) {
        if (!color) continue;
        for (const v of vars) element.style.setProperty(v, color);
      }
    };

    const applyToAllElements = () => {
      const allPreflightElements = document.querySelectorAll(".swapkit-ui-preflight:not(.swapkit-controls-sidebar)");
      for (const element of allPreflightElements) {
        if (element instanceof HTMLElement) {
          applyColorVariables(element);
        }
      }
    };

    applyToAllElements();

    // Ensure entire page background matches theme in standalone mode
    if (colorPrimary) {
      document.documentElement.style.setProperty("background", `hsl(${colorPrimary})`);
      document.body.style.setProperty("background", `hsl(${colorPrimary})`);
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: performance optimization
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;

        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const isPreflightElement =
            node.classList.contains("swapkit-ui-preflight") && !node.classList.contains("swapkit-controls-sidebar");

          if (isPreflightElement) {
            applyColorVariables(node);
            continue;
          }

          if (node.querySelector(".swapkit-ui-preflight:not(.swapkit-controls-sidebar)")) {
            applyToAllElements();
            break;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [
    colorPrimary,
    colorSecondary,
    colorPrimaryButton,
    colorPrimaryButtonText,
    colorAccent,
    colorBgHover,
    colorBorder,
    colorText,
    colorMutedText,
  ]);

  useEffect(() => {
    SKConfig.set({ v3SwapFlow: { enabled: useV3SwapFlow } });
  }, [useV3SwapFlow]);

  useEffect(() => {
    SKConfig.setEnv("isDev", developMode);
    if (devApiUrl) {
      SKConfig.setEnv("devApiUrl", devApiUrl);
    }
  }, [developMode, devApiUrl]);

  useEffect(() => {
    if (useApiKeyAuth) {
      SKConfig.set({ apiKeys: { swapKit: apiKey } });
      SKConfig.setWidgetId("");
      SKConfig.setWidgetKey("");
    } else {
      SKConfig.set({ apiKeys: { swapKit: "" } });
      SKConfig.setWidgetId(widgetId);
      SKConfig.setWidgetKey(widgetKey);
    }
  }, [useApiKeyAuth, apiKey, widgetId, widgetKey]);

  // Push the wallet/integration credentials into SKConfig whenever the form
  // changes. Only non-empty values reach the SDK — empty inputs leave whatever
  // was previously set untouched (SKConfig.set is a partial merge).
  useEffect(() => {
    const patch = buildSdkConfigPatch({ apiKeys, integrations });
    if (Object.keys(patch).length > 0) SKConfig.set(patch);
  }, [apiKeys, integrations]);

  const colors = useMemo((): SwapKitColors | undefined => {
    const colorConfig: Array<[string | undefined, string, keyof SwapKitColors]> = [
      [colorPrimary, "140 6% 8%", "background"],
      [colorSecondary, "120 3% 13%", "surface"],
      [colorPrimaryButton, "0 0% 100% / 0.92", "primaryButton"],
      [colorPrimaryButtonText, "140 6% 8%", "primaryButtonText"],
      [colorAccent, "140 87% 79%", "accent"],
      [colorBgHover, "0 0% 100% / 0.08", "hover"],
      [colorBorder, "0 0% 100% / 0.12", "border"],
      [colorText, "0 0% 100% / 0.92", "text"],
      [colorMutedText, "0 0% 100% / 0.64", "mutedText"],
    ];

    const colorsObj = colorConfig.reduce<SwapKitColors>((acc, [value, defaultValue, key]) => {
      if (value && value !== defaultValue) acc[key] = value;
      return acc;
    }, {});

    return Object.keys(colorsObj).length > 0 ? colorsObj : undefined;
  }, [
    colorPrimary,
    colorSecondary,
    colorPrimaryButton,
    colorPrimaryButtonText,
    colorAccent,
    colorBgHover,
    colorBorder,
    colorText,
    colorMutedText,
  ]);

  return useMemo(
    () => ({
      apiBaseUrl,
      apiKey,
      colors,
      devApiUrl,
      developMode,
      enabledChains,
      enabledWalletOptions,
      form,
      isHydrated,
      useApiKeyAuth,
      useV3SwapFlow,
      widgetId,
      widgetKey,
    }),
    [
      apiBaseUrl,
      apiKey,
      colors,
      developMode,
      devApiUrl,
      enabledChains,
      enabledWalletOptions,
      form,
      isHydrated,
      useApiKeyAuth,
      useV3SwapFlow,
      widgetId,
      widgetKey,
    ],
  );
};
