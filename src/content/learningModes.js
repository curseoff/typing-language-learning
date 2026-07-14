// 学習モードの定義（通常入力 / 穴埋め）。#402
// modes.js（入力モード）と同じ形＝キー配列＋ラベル/説明の純関数。
// 単語/単語例文/英英の「通常入力（both/en/ja）」のときだけ選べる（翻訳・4択は対象外）。
export const LEARNING_MODES = ['normal', 'cloze']

export function learningLabel(key) {
  return key === 'cloze' ? '穴埋め' : '通常'
}

export function learningDesc(key) {
  return key === 'cloze'
    ? '5問ごとに、覚えた語を伏字（____）で出題。ヒントは反対側の言語。ミスすると正解が現れます。'
    : '通常のタイピング（順に入力）。'
}

// 通常入力（both/en/ja）のときだけ穴埋めを選べる（翻訳 en-tr/ja-tr・4択 quiz/pick は対象外）。
export function supportsLearning(inputMode) {
  return inputMode === 'both' || inputMode === 'en' || inputMode === 'ja'
}
