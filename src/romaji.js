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
  ー: ['-'],
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
