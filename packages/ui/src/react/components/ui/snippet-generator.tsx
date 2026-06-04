"use client";

import type { Chain, WalletOption } from "@swapkit/helpers";
import hljs from "highlight.js/lib/core";
// In highlight.js, `html` is an alias of the `xml` grammar — there is no separate HTML
// grammar. We register under `xml` and call `highlight()` with `html` to match intent.
import xml from "highlight.js/lib/languages/xml";
import { Check, Copy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { buildSdkConfigPatch } from "../../controls/build-sdk-config-patch";
import type { ControlsStoreFieldValues } from "../../types";
import { Button } from "./button";

if (!hljs.getLanguage("xml")) hljs.registerLanguage("xml", xml);

type SnippetGeneratorProps<TFieldValues extends FieldValues> = { control: Control<TFieldValues> };

const DEFAULT_COLORS: Record<string, string> = {
  colorAccent: "140 87% 79%",
  colorBgHover: "0 0% 100% / 0.08",
  colorBorder: "0 0% 100% / 0.12",
  colorMutedText: "0 0% 100% / 0.64",
  colorPrimary: "140 6% 8%",
  colorPrimaryButton: "0 0% 100% / 0.92",
  colorPrimaryButtonText: "140 6% 8%",
  colorSecondary: "120 3% 13%",
  colorText: "0 0% 100% / 0.92",
};

const COLOR_ATTRIBUTE_MAP: Record<string, string> = {
  colorAccent: "color-accent",
  colorBgHover: "color-bg-hover",
  colorBorder: "color-border",
  colorMutedText: "color-muted-foreground",
  colorPrimary: "color-primary",
  colorPrimaryButton: "color-primary-button",
  colorPrimaryButtonText: "color-primary-button-foreground",
  colorSecondary: "color-secondary",
  colorText: "color-text",
};

function addColorAttribute(attributes: string[], key: string, value: string | undefined) {
  const attributeName = COLOR_ATTRIBUTE_MAP[key];
  const defaultValue = DEFAULT_COLORS[key];

  if (value && attributeName && value !== defaultValue) {
    attributes.push(`  ${attributeName}="${value}"`);
  }
}

function buildSnippet(config: {
  widgetId: string;
  widgetKey: string;
  apiKey: string;
  useApiKeyAuth: boolean;
  apiBaseUrl: string;
  developMode: boolean;
  devApiUrl: string;
  enabledWalletOptions: WalletOption[] | "all";
  enabledChains: Chain[] | "all";
  colors: Record<string, string | undefined>;
  apiKeys: ControlsStoreFieldValues["apiKeys"];
  integrations: ControlsStoreFieldValues["integrations"];
}): string {
  const attributes: string[] = [];

  // Authentication — either api-key or widget-id + widget-key (HMAC mode requires both).
  if (config.useApiKeyAuth && config.apiKey) {
    attributes.push(`  api-key="${config.apiKey}"`);
  } else if (config.widgetId && config.widgetKey) {
    attributes.push(`  widget-id="${config.widgetId}"`);
    attributes.push(`  widget-key="${config.widgetKey}"`);
  }

  if (config.apiBaseUrl && config.apiBaseUrl !== "https://api.swapkit.dev") {
    attributes.push(`  api-base-url="${config.apiBaseUrl}"`);
  }

  // Developer mode settings
  if (config.developMode) {
    attributes.push("  develop-mode");
    if (config.devApiUrl) {
      attributes.push(`  dev-api-url="${config.devApiUrl}"`);
    }
  }

  // Wallet configuration (only if not "all")
  const wallets = config.enabledWalletOptions;
  if (wallets !== "all" && Array.isArray(wallets)) {
    if (wallets.length === 0) {
      attributes.push('  wallets="none"');
    } else {
      attributes.push(`  wallets="${wallets.join(",")}"`);
    }
  }

  // Empty `chains=""` is meaningful — the runtime resolver reads it as "none"
  // rather than falling through to the default "all".
  const chains = config.enabledChains;
  if (chains !== "all" && Array.isArray(chains)) {
    attributes.push(`  chains="${chains.join(",")}"`);
  }

  // Color attributes (only non-default values)
  for (const key of Object.keys(COLOR_ATTRIBUTE_MAP)) {
    addColorAttribute(attributes, key, config.colors[key]);
  }

  // Wallet/integration credentials don't fit cleanly as flat attributes — emit
  // them as a JSON `config` payload that the web component parses + applies via
  // SKConfig.set. Only included when at least one wallet field is non-empty.
  const sdkPatch = buildSdkConfigPatch({ apiKeys: config.apiKeys, integrations: config.integrations });
  if (Object.keys(sdkPatch).length > 0) {
    // HTML attribute values can't contain unescaped double quotes; use single
    // quotes for the attribute and escape any singles in the JSON.
    const json = JSON.stringify(sdkPatch).replace(/'/g, "&apos;");
    attributes.push(`  config='${json}'`);
  }

  // Build the snippet - use dev CDN when in develop mode
  const cdnDomain = config.developMode ? "cdn-dev.swapkit.dev" : "cdn.swapkit.dev";
  const cdnScript = `<script type="module" src="https://${cdnDomain}/widget/latest/swapkit-widget.js"></script>`;
  const widgetTag =
    attributes.length > 0
      ? `<swapkit-widget\n${attributes.join("\n")}\n></swapkit-widget>`
      : "<swapkit-widget></swapkit-widget>";

  return `<!-- SwapKit Widget -->\n${cdnScript}\n\n${widgetTag}`;
}

export function SnippetGenerator<TFieldValues extends FieldValues>({ control }: SnippetGeneratorProps<TFieldValues>) {
  const [copied, setCopied] = useState(false);

  const values = useWatch({
    control,
    name: [
      "widgetId",
      "widgetKey",
      "apiKey",
      "useApiKeyAuth",
      "apiBaseUrl",
      "developMode",
      "devApiUrl",
      "enabledWalletOptions",
      "enabledChains",
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
    ] as Path<TFieldValues>[],
  });

  const [
    widgetId,
    widgetKey,
    apiKey,
    useApiKeyAuth,
    apiBaseUrl,
    developMode,
    devApiUrl,
    enabledWalletOptions,
    enabledChains,
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
  ] = values as unknown as [
    string,
    string,
    string,
    boolean,
    string,
    boolean,
    string,
    WalletOption[] | "all",
    Chain[] | "all",
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    ControlsStoreFieldValues["apiKeys"],
    ControlsStoreFieldValues["integrations"],
  ];

  const snippet = useMemo(
    () =>
      buildSnippet({
        apiBaseUrl,
        apiKey,
        apiKeys,
        colors: {
          colorAccent,
          colorBgHover,
          colorBorder,
          colorMutedText,
          colorPrimary,
          colorPrimaryButton,
          colorPrimaryButtonText,
          colorSecondary,
          colorText,
        },
        devApiUrl,
        developMode,
        enabledChains,
        enabledWalletOptions,
        integrations,
        useApiKeyAuth,
        widgetId,
        widgetKey,
      }),
    [
      widgetId,
      widgetKey,
      apiKey,
      useApiKeyAuth,
      apiBaseUrl,
      developMode,
      devApiUrl,
      enabledWalletOptions,
      enabledChains,
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
    ],
  );

  const highlighted = useMemo(() => hljs.highlight(snippet, { language: "html" }).value, [snippet]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = snippet;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [snippet]);

  return (
    <div className="sk-ui-flex sk-ui-flex-col sk-ui-gap-3">
      <div className="sk-ui-relative">
        <pre className="swapkit-snippet sk-ui-bg-black/30 sk-ui-rounded-lg sk-ui-p-3 sk-ui-pr-12 sk-ui-text-xs sk-ui-text-foreground sk-ui-font-mono sk-ui-leading-relaxed sk-ui-overflow-x-auto sk-ui-whitespace-pre-wrap sk-ui-break-all">
          <code
            className="hljs sk-ui-bg-transparent sk-ui-p-0"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: hljs.highlight escapes its input before adding spans
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
        <Button
          className="sk-ui-absolute sk-ui-top-2 sk-ui-right-2 sk-ui-h-8 sk-ui-w-8 sk-ui-p-0"
          onClick={handleCopy}
          size="sm"
          title={copied ? "Copied!" : "Copy to clipboard"}
          variant="ghost">
          {copied ? (
            <Check className="sk-ui-h-4 sk-ui-w-4 sk-ui-text-green-500" />
          ) : (
            <Copy className="sk-ui-h-4 sk-ui-w-4" />
          )}
        </Button>
      </div>
      <p className="sk-ui-text-xs sk-ui-text-muted-foreground">
        Copy this snippet and paste it into your website's HTML.
      </p>
    </div>
  );
}
