// 問題列再現用のシードを1つ生成（0..2^32-1）。
// Math.random を使う非決定関数なので application 層に置く（domain は mulberry32 注入で純粋に保つ）。
// 通常プレイは記録ごとに新しい seed を切って record に保存し、どの記録も再現可能にする。
export const makeSeed = () => Math.floor(Math.random() * 0x100000000)
