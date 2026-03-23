import { $ } from "bun";

const dtsPlugin = {
  name: "@swapkit-dev/bun-dts-plugin",
  setup: async (pkgName: string) => {
    const scope = `./packages/${pkgName}`;

    await $`find ${scope}/dist/types/ -name "*.d.ts*" -type f -delete 2>/dev/null || true`;
    await $`rm -rf ${scope}/tsconfig.tsbuildinfo`;

    const tempConfig = {
      compilerOptions: {
        allowImportingTsExtensions: false,
        baseUrl: ".",
        declaration: true,
        declarationMap: true,
        emitDeclarationOnly: true,
        isolatedDeclarations: false,
        noEmit: false,
        outDir: "./dist/types",
        paths: {
          "@cosmjs/*": ["../../node_modules/@cosmjs/*"],
          "@near-wallet-selector/*": ["../../node_modules/@near-wallet-selector/*"],
          "@solana/*": ["../../node_modules/@solana/*"],
          "@ton/*": ["../../node_modules/@ton/*"],
          "@walletconnect/*": ["../../node_modules/@walletconnect/*"],
          xrpl: ["../../node_modules/xrpl"],
        } as Record<string, string[]>,
        rootDir: "./src",
        tsBuildInfoFile: "./tsconfig.tsbuildinfo",
      },
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
      extends: "./tsconfig.json",
      include: ["src/**/*"],
    };

    await Bun.write(`${scope}/.tsconfig.tmp.json`, JSON.stringify(tempConfig));
    try {
      await $`cd ${scope} && bun --bun tsc -p .tsconfig.tmp.json`;
    } catch (error: any) {
      if (error?.stdout) {
        console.error(Buffer.from(error.stdout).toString());
      }
      throw new Error(
        `Error building @swapkit-dev/${pkgName} d.ts files
         Fix the errors above and run "bun build:dts" again`,
      );
    } finally {
      await $`rm -f ${scope}/.tsconfig.tmp.json`;
    }
  },
};

export const orderedPackages = [
  "utxo-signer",
  "wallet-core",
  "wallet-extensions",
  "wallet-hardware",
  "wallet-keystore",
  "wallet-mobile",
  "wallets",
];

for (const pkg of orderedPackages) {
  console.info(`Building @swapkit-dev/${pkg} d.ts files`);
  await dtsPlugin.setup(pkg);
}
