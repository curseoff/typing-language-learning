// ひらがな読みを、許容される全ローマ字パターンの配列に変換する簡易エンジン。
// 例: し → ['shi','si','ci'] / がっこう → ['gakkou', ...]
// 複数の打ち方(shi/si, tsu/tu, n/nn など)を受理する。

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
  わ: ['wa'], を: ['wo', 'o'],
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

// カタカナをひらがなに正規化
function toHiragana(s) {
  let out = ''
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCharCode(code - 0x60)
    else out += ch
  }
  return out
}

function expand(kana, i) {
  if (i >= kana.length) return ['']
  const ch = kana[i]
  const next = kana[i + 1]

  // 促音 っ
  if (ch === 'っ') {
    const rest = expand(kana, i + 1)
    const out = []
    for (const r of rest) {
      // 次の子音を重ねる
      if (r && !VOWELS.has(r[0]) && r[0] !== 'n') out.push(r[0] + r)
      // 単独入力 xtu / ltu
      out.push('xtu' + r, 'ltu' + r)
    }
    return out
  }

  // 撥音 ん
  if (ch === 'ん') {
    const rest = expand(kana, i + 1)
    const out = []
    for (const r of rest) {
      out.push('nn' + r, "n'" + r)
      // 次が母音・な行・や行・末尾でなければ単独 n も可
      const c0 = r[0]
      if (r !== '' && !VOWELS.has(c0) && c0 !== 'n' && c0 !== 'y') {
        out.push('n' + r)
      }
    }
    return out
  }

  // 拗音 (きゃ 等)
  if (next && SMALL_Y.has(next) && YOUON[ch + next]) {
    const heads = YOUON[ch + next]
    const rest = expand(kana, i + 2)
    const out = []
    for (const h of heads) for (const r of rest) out.push(h + r)
    return out
  }

  // 通常
  const heads = BASE[ch] || [ch]
  const rest = expand(kana, i + 1)
  const out = []
  for (const h of heads) for (const r of rest) out.push(h + r)
  return out
}

// かな読み -> 許容ローマ字パターンの配列(重複除去)
export function romajiVariants(kana) {
  const hira = toHiragana(kana)
  return [...new Set(expand(hira, 0))]
}

// 入力中の表示用ローマ字: input を前方一致で含む最短のパターンを返す
export function displayRomaji(variants, input) {
  let best = null
  for (const v of variants) {
    if (v.startsWith(input) && (best === null || v.length < best.length)) best = v
  }
  return best ?? variants[0] ?? ''
}
