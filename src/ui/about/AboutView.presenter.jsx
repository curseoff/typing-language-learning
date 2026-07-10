// 紹介ページ（LP）の薄板 shim：@tll/ui の AboutView（純粋 presenter）を再エクスポートする。
// 導線ハンドラ（onStart）は App から props で渡す（フック/データ非依存）。
export { AboutView as default } from '@tll/ui'
