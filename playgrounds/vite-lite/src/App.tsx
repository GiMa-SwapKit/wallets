"use client";

import { SKConfig } from "@swapkit/helpers";
import { SwapKitWidget } from "@swapkit/ui/react";
import { SwapKitWidgetControls, useSwapKitWidgetControlsForm } from "@swapkit/ui/react/controls";
import { useCallback, useEffect, useRef, useState } from "react";

const SETTINGS_ICON = (
  <svg
    aria-hidden
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24">
    <line x1="4" x2="14" y1="6" y2="6" />
    <line x1="20" x2="18" y1="6" y2="6" />
    <line x1="4" x2="6" y1="12" y2="12" />
    <line x1="12" x2="20" y1="12" y2="12" />
    <line x1="4" x2="14" y1="18" y2="18" />
    <line x1="20" x2="18" y1="18" y2="18" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </svg>
);

const CLOSE_ICON = (
  <svg
    aria-hidden
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

function resolveAuthConfig({
  apiKey,
  envApiKey,
  envWidgetId,
  envWidgetKey,
  useApiKeyAuth,
  widgetId,
  widgetKey,
}: {
  apiKey: string;
  envApiKey: string;
  envWidgetId: string;
  envWidgetKey: string;
  useApiKeyAuth: boolean;
  widgetId: string;
  widgetKey: string;
}) {
  const hasExplicitWidgetAuth = Boolean(widgetId && widgetKey);
  const shouldUseApiKeyAuth = useApiKeyAuth || (!hasExplicitWidgetAuth && Boolean(apiKey || envApiKey));

  return {
    effectiveApiKey: shouldUseApiKeyAuth ? apiKey || envApiKey : "",
    effectiveWidgetId: shouldUseApiKeyAuth ? "" : widgetId || envWidgetId,
    effectiveWidgetKey: shouldUseApiKeyAuth ? "" : widgetKey || envWidgetKey,
  };
}

export default function App() {
  const {
    apiBaseUrl,
    apiKey,
    colors,
    devApiUrl,
    developMode,
    isHydrated,
    useApiKeyAuth,
    useV3SwapFlow,
    widgetId,
    widgetKey,
  } = useSwapKitWidgetControlsForm();
  const [isControlsOpen, setControlsOpen] = useState(false);
  const envApiBaseUrl = import.meta.env.VITE_SWAPKIT_API_BASE_URL || "";
  const envApiKey = import.meta.env.VITE_SWAPKIT_API_KEY || "";
  const envWidgetId = import.meta.env.VITE_SWAPKIT_WIDGET_ID || "";
  const envWidgetKey = import.meta.env.VITE_SWAPKIT_WIDGET_KEY || "";
  const effectiveApiBaseUrl = apiBaseUrl || envApiBaseUrl || "";
  const normalizedDevApiUrl = (devApiUrl || "").trim();
  const shouldUseDevApi = Boolean(developMode && normalizedDevApiUrl);
  const { effectiveApiKey, effectiveWidgetId, effectiveWidgetKey } = resolveAuthConfig({
    apiKey,
    envApiKey,
    envWidgetId,
    envWidgetKey,
    useApiKeyAuth,
    widgetId,
    widgetKey,
  });

  const applyEnvConfig = useCallback(() => {
    SKConfig.set({
      envs: {
        apiUrl: effectiveApiBaseUrl,
        devApiUrl: shouldUseDevApi ? normalizedDevApiUrl : "",
        isDev: shouldUseDevApi,
      },
      v3SwapFlow: { enabled: useV3SwapFlow },
    });
  }, [effectiveApiBaseUrl, normalizedDevApiUrl, shouldUseDevApi, useV3SwapFlow]);

  // Apply endpoint config during render so the widget's own mount effects
  // (notably swap quote / swap-to requests that hit SwapKitApi directly)
  // see the correct base URL on their very first pass.
  const envBootRef = useRef("");
  const envSignature = JSON.stringify({
    apiUrl: effectiveApiBaseUrl,
    devApiUrl: shouldUseDevApi ? normalizedDevApiUrl : "",
    isDev: shouldUseDevApi,
    useV3SwapFlow,
  });
  if (envBootRef.current !== envSignature) {
    envBootRef.current = envSignature;
    applyEnvConfig();
  }

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 769px)");
    const handle = () => {
      if (mql.matches) setControlsOpen(false);
    };

    mql.addEventListener("change", handle);

    return () => mql.removeEventListener("change", handle);
  }, []);

  useEffect(() => {
    applyEnvConfig();
  }, [applyEnvConfig]);

  return (
    <div className="studio-layout">
      <main className="studio-layout__widget">
        {isHydrated && (
          <SwapKitWidget
            apiBaseUrl={effectiveApiBaseUrl}
            apiKey={effectiveApiKey}
            colors={colors}
            inputAsset="BTC.BTC"
            key={JSON.stringify({
              apiKey: Boolean(effectiveApiKey),
              apiUrl: effectiveApiBaseUrl,
              devApiUrl: shouldUseDevApi ? normalizedDevApiUrl : "",
              isDev: shouldUseDevApi,
              useV3SwapFlow,
              widgetId: effectiveWidgetId,
              widgetKey: Boolean(effectiveWidgetKey),
            })}
            outputAsset="ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7"
            wallets="all"
            widgetId={effectiveWidgetId}
            widgetKey={effectiveWidgetKey}
          />
        )}
      </main>

      {isControlsOpen && (
        <button
          aria-label="Close controls"
          className="studio-layout__backdrop"
          onClick={() => setControlsOpen(false)}
          type="button"
        />
      )}

      <aside
        aria-label="Widget Studio settings"
        className={isControlsOpen ? "studio-layout__sidebar studio-layout__sidebar--open" : "studio-layout__sidebar"}>
        <SwapKitWidgetControls />
      </aside>

      <button
        aria-label={isControlsOpen ? "Close Widget Studio settings" : "Open Widget Studio settings"}
        className="studio-layout__settings-trigger"
        onClick={() => setControlsOpen((open) => !open)}
        type="button">
        <span className="studio-layout__icon">{isControlsOpen ? CLOSE_ICON : SETTINGS_ICON}</span>
        <span className="studio-layout__settings-trigger-label">{isControlsOpen ? "Close" : "Configure"}</span>
      </button>
    </div>
  );
}
