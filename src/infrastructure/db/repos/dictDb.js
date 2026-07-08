// 英英辞典クイズ記録の DB リポジトリ（現行 dictRepository と同値）。共通ファクトリを dictRecKey で具体化する。
import { dictRecKey } from '../../dictRepository.js'
import { makeWordDictDb } from './wordDictDb.js'

const { save, load } = makeWordDictDb('dict_records', dictRecKey)

export const saveDictRecordDb = save
export const loadDictRecordsDb = load
