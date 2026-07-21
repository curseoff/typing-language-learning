// 英英辞典クイズ記録の DB リポジトリ。共通ファクトリを dictRecKey で具体化する。
import { dictRecKey } from '../../../domain/records/recordKeys.service.js'
import { makeWordDictDb } from './wordDict.repository.js'

const { save, load, replaceGroup } = makeWordDictDb('dict_records', dictRecKey)

export const saveDictRecordDb = save
export const loadDictRecordsDb = load
// #451 1件削除：削除後の残り list でグループを丸ごと置き換える。
export const replaceDictRecordsGroupDb = replaceGroup
