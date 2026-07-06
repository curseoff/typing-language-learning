import type { StorybookConfig } from '@storybook/react-vite';

// @tll/ui（packages/ui）の presenter を独立閲覧するための Storybook。
// stories は各 presenter に colocate（packages/ui/src/**/*.stories.tsx）。
const config: StorybookConfig = {
  stories: ['../packages/ui/src/**/*.stories.tsx'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
