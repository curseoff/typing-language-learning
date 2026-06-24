// Node ツール専用：全レベルを連結（アプリからは import しない＝初回バンドルに含めない）。
import L1 from './L1.js'
import L2 from './L2.js'
import L3 from './L3.js'
import L4 from './L4.js'
export const WORD_SENTENCES = [...L1, ...L2, ...L3, ...L4]
