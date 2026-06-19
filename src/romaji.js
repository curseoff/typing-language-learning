// ひらがな読みを、標準的なローマ字(1通りに固定)へ変換する。
// 全文を最初から表示する都合上、入力対象は固定文字列にする。
// 例: わたしはがっこう -> watashihagakkou

const KANA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'di', づ: 'du', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  ぁ: 'la', ぃ: 'li', ぅ: 'lu', ぇ: 'le', ぉ: 'lo',
  ー: '-', '、': ',', '。': '.', '　': ' ',
}

const YOUON = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
}

// カタカナ -> ひらがな
function toHiragana(s) {
  let out = ''
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : ch
  }
  return out
}

// 位置 i のモーラ(拗音含む)のローマ字と長さ。っ/ん は呼び出し側で処理。
function unitAt(hira, i) {
  const two = hira.slice(i, i + 2)
  if (YOUON[two]) return [YOUON[two], 2]
  const ch = hira[i]
  return [KANA[ch] ?? ch, 1]
}

export function toRomaji(kana) {
  const hira = toHiragana(kana)
  let out = ''
  let i = 0
  while (i < hira.length) {
    const ch = hira[i]
    if (ch === 'っ') {
      const [nr] = i + 1 < hira.length ? unitAt(hira, i + 1) : ['', 0]
      // 次の子音を重ねる(母音始まりなら xtu)
      out += nr && !'aiueo'.includes(nr[0]) ? nr[0] : 'xtu'
      i += 1
      continue
    }
    if (ch === 'ん') {
      const [nr] = i + 1 < hira.length ? unitAt(hira, i + 1) : ['', 0]
      const c0 = nr[0] || ''
      // 母音・な行・や行・末尾の前は nn、それ以外は n
      out += i + 1 >= hira.length || 'aiueoyn'.includes(c0) ? 'nn' : 'n'
      i += 1
      continue
    }
    const [r, len] = unitAt(hira, i)
    out += r
    i += len
  }
  return out
}
