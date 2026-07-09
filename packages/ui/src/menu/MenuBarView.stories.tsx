import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MenuBarView } from '@tll/ui';
import type { MenuBarMenu } from '@tll/ui';

// TOP のメニューバー presenter。開閉状態は container 側で持つため、Story ではローカル state で再現する。
const meta = {
  title: 'menu/MenuBarView',
  component: MenuBarView,
} satisfies Meta<typeof MenuBarView>;
export default meta;
type Story = StoryObj<typeof meta>;

const appName = '英文・和文タイピング';

// 全項目が使える状態（sqlite 主タブ＋FSA 対応＋インストール可）。
const menusAllEnabled: MenuBarMenu[] = [
  {
    id: 'app',
    label: appName,
    items: [
      { id: 'about', label: 'このアプリについて', enabled: true },
      { id: 'install', label: 'アプリとして追加', icon: '＋', enabled: true },
    ],
  },
  {
    id: 'data',
    label: 'データ',
    items: [
      { id: 'export', label: 'エクスポート', icon: '💾', enabled: true },
      { id: 'import', label: '復元', icon: '↩️', enabled: true },
      { id: 'connectExternal', label: '自動バックアップ先を設定', icon: '📁', enabled: true },
      { id: 'restoreExternal', label: 'フォルダから復元', icon: '📂', enabled: true },
    ],
  },
];

// 能力不足で一部が disabled（理由つき）の状態（local タブ＝ハンドル無し／非対応ブラウザ）。
const menusDisabled: MenuBarMenu[] = [
  {
    id: 'app',
    label: appName,
    items: [
      { id: 'about', label: 'このアプリについて', enabled: true },
      { id: 'install', label: 'アプリとして追加', icon: '＋', enabled: false, reason: 'この環境では追加できません' },
    ],
  },
  {
    id: 'data',
    label: 'データ',
    items: [
      { id: 'export', label: 'エクスポート', icon: '💾', enabled: false, reason: 'SQLite 保存が有効なタブでのみ使えます' },
      { id: 'import', label: '復元', icon: '↩️', enabled: false, reason: 'SQLite 保存が有効なタブでのみ使えます' },
      { id: 'connectExternal', label: '自動バックアップ先を設定', icon: '📁', enabled: false, reason: '対応ブラウザ（Chrome 等）でのみ使えます' },
      { id: 'restoreExternal', label: 'フォルダから復元', icon: '📂', enabled: false, reason: '対応ブラウザ（Chrome 等）でのみ使えます' },
    ],
  },
];

function Demo({ menus, initialOpen }: { menus: MenuBarMenu[]; initialOpen: string | null }) {
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  return (
    <div style={{ minHeight: 320 }}>
      <MenuBarView
        appName={appName}
        menus={menus}
        openId={openId}
        onToggle={(id) => setOpenId((prev) => (prev === id ? null : id))}
        onSelect={(itemId) => setOpenId(null) || console.log('select', itemId)}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

export const Closed: Story = {
  render: () => <Demo menus={menusAllEnabled} initialOpen={null} />,
};
export const DataMenuOpen: Story = {
  render: () => <Demo menus={menusAllEnabled} initialOpen="data" />,
};
export const DisabledWithReasons: Story = {
  render: () => <Demo menus={menusDisabled} initialOpen="data" />,
};
