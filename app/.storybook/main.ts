import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // PRプレビューはコミットごとのサブパス(/kodou/<sha>/storybook/)へ置くため、
  // アセットの参照先をそのパスに合わせる。通常のデプロイはルート配信なので既定の "/" のまま。
  async viteFinal(viteConfig) {
    viteConfig.base = process.env.STORYBOOK_BASE_PATH || "/";
    return viteConfig;
  },
};

export default config;
