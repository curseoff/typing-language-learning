// 4択（単語/英英）の1問記録(segStat)を作る純関数。
// ユーザーが選んだ選択肢(picked)を英日で保持し、記録詳細で「あなたの回答」を出せるようにする。
// picked=null（無選択）でも例外を出さず、picked 系キーは一切付けない（旧記録と同形状）。
export function buildQuizSegStat({ question, picked, no, mistakes }) {
  return {
    no,
    label: question.prompt,
    answer: question.answerDisplay,
    correct: !!picked?.answer,
    mistakes,
    // 選んだ選択肢の表示・英日は在るものだけ optional 展開で付ける（segTracker の sentenceIndex に倣う）。
    ...(picked?.display != null ? { picked: picked.display } : {}),
    ...(picked?.en != null ? { pickedEn: picked.en } : {}),
    ...(picked?.ja != null ? { pickedJa: picked.ja } : {}),
  }
}
