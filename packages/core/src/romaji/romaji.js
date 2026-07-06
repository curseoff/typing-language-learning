// ひらがな読みを扱う。
// - romajiVariants: 許容する全ローマ字パターン(shi/si など複数)を返す
// - toRomaji: 標準(ヘボン式)の1通り。表示ガイドの既定値に使う
// 各 BASE/YOUON はヘボン式を先頭に並べ、[0] を canonical とする。

const BASE = {
  あ: ['a'], い: ['i'], う: ['u'], え: ['e'], お: ['o'],
  か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu'], け: ['ke'], こ: ['ko', 'co'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  さ: ['sa'], し: ['shi', 'si', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
  だ: ['da'], ぢ: ['di'], づ: ['du'], で: ['de'], ど: ['do'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], を: ['wo'], ん: ['n'],
  ぁ: ['la', 'xa'], ぃ: ['li', 'xi'], ぅ: ['lu', 'xu'], ぇ: ['le', 'xe'], ぉ: ['lo', 'xo'],
  ー: ['-'], '。': ['.'], '、': [','], '？': ['?'], '！': ['!'],
}

const YOUON = {
  きゃ: ['kya'], きゅ: ['kyu'], きょ: ['kyo'],
  ぎゃ: ['gya'], ぎゅ: ['gyu'], ぎょ: ['gyo'],
  しゃ: ['sha', 'sya'], しゅ: ['shu', 'syu'], しょ: ['sho', 'syo'],
  じゃ: ['ja', 'jya', 'zya'], じゅ: ['ju', 'jyu', 'zyu'], じょ: ['jo', 'jyo', 'zyo'],
  ちゃ: ['cha', 'tya'], ちゅ: ['chu', 'tyu'], ちょ: ['cho', 'tyo'],
  にゃ: ['nya'], にゅ: ['nyu'], にょ: ['nyo'],
  ひゃ: ['hya'], ひゅ: ['hyu'], ひょ: ['hyo'],
  びゃ: ['bya'], びゅ: ['byu'], びょ: ['byo'],
  ぴゃ: ['pya'], ぴゅ: ['pyu'], ぴょ: ['pyo'],
  みゃ: ['mya'], みゅ: ['myu'], みょ: ['myo'],
  りゃ: ['rya'], りゅ: ['ryu'], りょ: ['ryo'],
}

const SMALL_Y = new Set(['ゃ', 'ゅ', 'ょ'])
const VOWELS = new Set(['a', 'i', 'u', 'e', 'o'])

function toHiragana(s) {
  let out = ''
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : ch
  }
  return out
}

// --- 全パターン展開 ---
function expand(kana, i) {
  if (i >= kana.length) return ['']
  const ch = kana[i]
  const next = kana[i + 1]

  if (ch === 'っ') {
    const rest = expand(kana, i + 1)
    const out = []
    for (const r of rest) {
      if (r && !VOWELS.has(r[0]) && r[0] !== 'n') out.push(r[0] + r) // 子音重ね
      out.push('xtu' + r, 'ltu' + r) // 単独入力
    }
    return out
  }

  if (ch === 'ん') {
    const rest = expand(kana, i + 1)
    const out = []
    for (const r of rest) {
      out.push('nn' + r, "n'" + r)
      const c0 = r[0]
      if (r !== '' && !VOWELS.has(c0) && c0 !== 'n' && c0 !== 'y') out.push('n' + r)
    }
    return out
  }

  if (next && SMALL_Y.has(next) && YOUON[ch + next]) {
    const heads = YOUON[ch + next]
    const rest = expand(kana, i + 2)
    const out = []
    for (const h of heads) for (const r of rest) out.push(h + r)
    return out
  }

  const heads = BASE[ch] || [ch]
  const rest = expand(kana, i + 1)
  const out = []
  for (const h of heads) for (const r of rest) out.push(h + r)
  return out
}

export function romajiVariants(kana) {
  return [...new Set(expand(toHiragana(kana), 0))]
}

// ローマ字入力 input が、kana の先頭から何文字ぶんを打ち終えたかを返す。
// 先頭 k 文字を綴り切るローマ字のいずれかが input の先頭にあれば、k 文字完了。
//
// 全変種展開（expand）は読みの長さに対して指数的になるため、input を直接マッチして
// 線形に解く。状態 (i=かなindex, p=入力位置) を DFS＋メモ化で辿り、到達できた最大の i を返す。
// expand と同一の規則（っ＝子音重ね/xtu/ltu、ん＝nn/n'/単独n、拗音、BASE/濁点）を局所適用する。
export function kanaConsumed(kana, input) {
  const hira = toHiragana(kana)
  const n = hira.length
  let best = 0
  // 1ユニット（拗音=2字 / それ以外=1字。っ・ん は呼び出し側で別扱い）の [綴り, 進めるかな数]
  const units = (j) => {
    if (j >= n) return []
    const ch = hira[j]
    const nx = hira[j + 1]
    if (nx && SMALL_Y.has(nx) && YOUON[ch + nx]) return YOUON[ch + nx].map((h) => [h, 2])
    return (BASE[ch] || [ch]).map((h) => [h, 1])
  }
  const seen = new Set()
  const stack = [[0, 0]]
  while (stack.length) {
    const [i, p] = stack.pop()
    const key = i * (input.length + 1) + p
    if (seen.has(key)) continue
    seen.add(key)
    if (i > best) best = i
    if (i >= n) continue
    const ch = hira[i]
    const nx = hira[i + 1]
    const opts = [] // [綴り, 次のかなindex]
    if (ch === 'っ') {
      opts.push(['xtu', i + 1], ['ltu', i + 1]) // 単独入力（っ単体で確定）
      // 子音重ね：次のユニットの頭子音を重ねる。結合形は「っ＋次の音」をまとめて進める
      for (const [s2, adv] of units(i + 1)) {
        const c = s2[0]
        if (!VOWELS.has(c) && c !== 'n') opts.push([c + s2, i + 1 + adv])
      }
    } else if (ch === 'ん') {
      opts.push(['nn', i + 1], ["n'", i + 1]) // ん単体で確定
      // 単独 n：後続が子音（n/y以外）のときのみ。結合形は「ん＋次の音」をまとめて進める
      for (const [s2, adv] of units(i + 1)) {
        const c = s2[0]
        if (!VOWELS.has(c) && c !== 'n' && c !== 'y') opts.push(['n' + s2, i + 1 + adv])
      }
    } else if (nx && SMALL_Y.has(nx) && YOUON[ch + nx]) {
      for (const h of YOUON[ch + nx]) opts.push([h, i + 2])
    } else {
      for (const h of BASE[ch] || [ch]) opts.push([h, i + 1])
    }
    for (const [s, ni] of opts) {
      if (input.startsWith(s, p)) stack.push([ni, p + s.length])
    }
  }
  return best
}

// --- canonical(ヘボン式1通り) ---
function unitAt(hira, i) {
  const two = hira.slice(i, i + 2)
  if (YOUON[two]) return [YOUON[two][0], 2]
  const ch = hira[i]
  return [(BASE[ch] || [ch])[0], 1]
}

export function toRomaji(kana) {
  const hira = toHiragana(kana)
  let out = ''
  let i = 0
  while (i < hira.length) {
    const ch = hira[i]
    if (ch === 'っ') {
      const [nr] = i + 1 < hira.length ? unitAt(hira, i + 1) : ['', 0]
      out += nr && !VOWELS.has(nr[0]) ? nr[0] : 'xtu'
      i += 1
      continue
    }
    if (ch === 'ん') {
      const [nr] = i + 1 < hira.length ? unitAt(hira, i + 1) : ['', 0]
      const c0 = nr[0] || ''
      out += i + 1 >= hira.length || VOWELS.has(c0) || c0 === 'y' || c0 === 'n' ? 'nn' : 'n'
      i += 1
      continue
    }
    const [r, len] = unitAt(hira, i)
    out += r
    i += len
  }
  return out
}
