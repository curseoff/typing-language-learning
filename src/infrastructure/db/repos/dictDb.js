// 英英辞典クイズ記録の DB リポジトリ。共通ファクトリを dictRecKey で具体化する。
import { dictRecKey } from '../../../domain/records/recordKeys.service.js'
import { makeWordDictDb } from './wordDictDb.js'

const { save, load } = makeWordDictDb('dict_records', dictRecKey)

export const saveDictRecordDb = save
export const loadDictRecordsDb = load
