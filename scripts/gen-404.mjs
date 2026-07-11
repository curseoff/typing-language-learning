// #357 SPA app-shell 方式：ビルド後に dist/index.html を dist/404.html へ複製する。
// GitHub Pages は未知パス（/…/story/travel の直アクセス）に 404.html を返すので、その中身を
// index と同一（app-shell）にしておくと、絶対 base のおかげでアセットが解決し、JS 起動→
// parseRoute(location) でルートが復元される（＝ディープリンクが直接開ける）。
//
// postbuild で gen-precache の「前」に実行する（複製後に gen-precache が dist を走査して
// 404.html も shell 群として拾えるように）。import 時は副作用なし（テスト可能）。
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const DIST = 'dist'

export function gen404(dist = DIST) {
  const src = join(dist, 'index.html')
  const dest = join(dist, '404.html')
  copyFileSync(src, dest) // index.html が無ければ throw（＝先に build が要る）
  return dest
}

function main() {
  try {
    gen404()
    console.log('✓ 404.html 生成: dist/index.html を複製（SPA app-shell フォールバック）')
  } catch {
    console.error('✖ dist/index.html が見つかりません。先に npm run build を実行してください。')
    process.exit(1)
  }
}

// 直接実行された時だけ複製する（import 時は副作用なし）。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
