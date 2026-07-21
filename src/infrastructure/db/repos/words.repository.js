// 単語問題記録の DB リポジトリ。共通ファクトリを wordRecKey で具体化する。
import { wordRecKey } from '../../../domain/records/recordKeys.service.js'
import { makeWordDictDb } from './wordDict.repository.js'

const { save, load, replaceGroup } = makeWordDictDb('word_records', wordRecKey)

export const saveWordRecordDb = save
export const loadWordRecordsDb = load
// #451 1件削除：削除後の残り list でグループを丸ごと置き換える。
export const replaceWordRecordsGroupDb = replaceGroup
