// 単語問題記録の DB リポジトリ。共通ファクトリを wordRecKey で具体化する。
import { wordRecKey } from '../../../domain/records/recordKeys.service.js'
import { makeWordDictDb } from './wordDictDb.js'

const { save, load } = makeWordDictDb('word_records', wordRecKey)

export const saveWordRecordDb = save
export const loadWordRecordsDb = load
