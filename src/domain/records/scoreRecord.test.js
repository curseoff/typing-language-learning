import { describe, it, expect } from 'vitest'
// #311: 記録レコード {...meta, keys, mistakes, speed, accuracy, seconds} を
// Score VO を内包する ScoreRecord VO（不変・自己検証）にする。
// 本体 src/domain/records/scoreRecord.vo.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 採点は score.vo.js の makeScore に委譲し、採点式を重複させない（形状は現行 sessionToRecord と互換）。
import { makeScoreRecord, isScoreRecord } from './scoreRecord.vo.js'
import { isScore } from './score.vo.js'

// ---- makeScoreRecord：ファクトリ（Score VO 内包）＋meta マージ＋自己検証＋凍結 ----
describe('makeScoreRecord（#311・ファクトリ/Score内包/meta マージ/凍結）', () => {
  describe('採点の合成（makeScore への委譲・具体例）', () => {
    it('keys20・mistakes5・elapsedMs60000 → keys20 / mistakes5 / speed20 / accuracy80 / seconds60', () => {
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      expect(rec.keys).toBe(20)
      expect(rec.mistakes).toBe(5)
      expect(rec.speed).toBe(20)
      expect(rec.accuracy).toBe(80)
      expect(rec.seconds).toBe(60)
    })

    it('keys0・mistakes0・elapsedMs0 → keys0 / mistakes0 / speed0 / accuracy100 / seconds0（ゼロ除算回避）', () => {
      const rec = makeScoreRecord({ keys: 0, mistakes: 0, elapsedMs: 0 })
      expect(rec.keys).toBe(0)
      expect(rec.mistakes).toBe(0)
      expect(rec.speed).toBe(0)
      expect(rec.accuracy).toBe(100)
      expect(rec.seconds).toBe(0)
    })
  })

  describe('elapsedMs は採点の入力のみ・出力に含めない（現行 sessionToRecord と同じ）', () => {
    it('返り値に elapsedMs プロパティを持たない', () => {
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      expect(rec).not.toHaveProperty('elapsedMs')
    })

    it('公開プロパティは keys/mistakes/speed/accuracy/seconds の5項目のみ（meta 無しのとき）', () => {
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      expect(Object.keys(rec).sort()).toEqual(['accuracy', 'keys', 'mistakes', 'seconds', 'speed'])
    })
  })

  describe('meta のマージ', () => {
    it('meta の各項目（mode/rank/source/theme/date）が記録に含まれる', () => {
      const meta = { mode: 'marathon', rank: 'A', source: 'play', theme: '日常', date: '2026-07-10' }
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000, meta })
      expect(rec.mode).toBe('marathon')
      expect(rec.rank).toBe('A')
      expect(rec.source).toBe('play')
      expect(rec.theme).toBe('日常')
      expect(rec.date).toBe('2026-07-10')
    })

    it('meta を省略しても throw せず、コア5項目だけの記録を返す', () => {
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      expect(Object.keys(rec).sort()).toEqual(['accuracy', 'keys', 'mistakes', 'seconds', 'speed'])
    })
  })

  describe('コア採点項目は meta を上書きする（meta が採点を汚染できない）', () => {
    it('meta に keys:999・speed:-1 があっても採点値が優先される', () => {
      const rec = makeScoreRecord({ keys: 5, mistakes: 0, elapsedMs: 60000, meta: { keys: 999, speed: -1 } })
      expect(rec.keys).toBe(5)
      expect(rec.speed).toBe(5) // keys5/分=5（elapsedMs60000=1分）＝採点値。meta の -1 ではない。
    })

    it('meta が mistakes/accuracy/seconds を持っても採点値で上書きされる', () => {
      const rec = makeScoreRecord({
        keys: 90,
        mistakes: 10,
        elapsedMs: 30000,
        meta: { mistakes: 0, accuracy: 0, seconds: 0 },
      })
      expect(rec.mistakes).toBe(10)
      expect(rec.accuracy).toBe(90)
      expect(rec.seconds).toBe(30)
    })
  })

  describe('凍結（不変）', () => {
    it('生成された記録は凍結されている', () => {
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      expect(Object.isFrozen(rec)).toBe(true)
    })

    it('凍結ゆえ keys を書き換えても変化しない', () => {
      const rec = makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 })
      try {
        rec.keys = 999
      } catch {
        // 凍結オブジェクトへの代入は strict で TypeError（許容）。
      }
      expect(rec.keys).toBe(20)
    })
  })

  describe('内包した Score が妥当（score.vo.js の isScore で検証）', () => {
    it('{speed, accuracy, seconds} を取り出すと妥当な Score である', () => {
      const rec = makeScoreRecord({ keys: 90, mistakes: 10, elapsedMs: 30000 })
      expect(isScore({ speed: rec.speed, accuracy: rec.accuracy, seconds: rec.seconds })).toBe(true)
    })
  })

  describe('純粋性（決定的・Date/乱数非依存）', () => {
    it('同一入力からは何度呼んでも同じ記録を返す（meta 含む）', () => {
      const args = { keys: 90, mistakes: 10, elapsedMs: 30000, meta: { mode: 'marathon', rank: 'A' } }
      const a = makeScoreRecord(args)
      const b = makeScoreRecord(args)
      expect(a).toEqual(b)
    })
  })

  describe('入力検証は throw する（makeScore 経由の自己検証）', () => {
    it('keys が負は throw する', () => {
      expect(() => makeScoreRecord({ keys: -1, mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('keys が非整数（1.5）は throw する', () => {
      expect(() => makeScoreRecord({ keys: 1.5, mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が負は throw する', () => {
      expect(() => makeScoreRecord({ keys: 100, mistakes: -1, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が非整数（2.5）は throw する', () => {
      expect(() => makeScoreRecord({ keys: 100, mistakes: 2.5, elapsedMs: 60000 })).toThrow()
    })

    it('elapsedMs が負は throw する', () => {
      expect(() => makeScoreRecord({ keys: 100, mistakes: 0, elapsedMs: -1 })).toThrow()
    })

    it('elapsedMs が NaN は throw する', () => {
      expect(() => makeScoreRecord({ keys: 100, mistakes: 0, elapsedMs: NaN })).toThrow()
    })

    it('elapsedMs が Infinity は throw する（有限が必須）', () => {
      expect(() => makeScoreRecord({ keys: 100, mistakes: 0, elapsedMs: Infinity })).toThrow()
    })

    it('elapsedMs が非数値（文字列）は throw する', () => {
      expect(() => makeScoreRecord({ keys: 100, mistakes: 0, elapsedMs: '60000' })).toThrow()
    })
  })
})

// ---- isScoreRecord：型ガード（throw しない） ----
describe('isScoreRecord（#311・型ガード）', () => {
  it('makeScoreRecord の戻り値は true', () => {
    expect(isScoreRecord(makeScoreRecord({ keys: 20, mistakes: 5, elapsedMs: 60000 }))).toBe(true)
  })

  it('meta 付き（余分な項目あり）の妥当な生レコードは true（寛容）', () => {
    const raw = {
      mode: 'marathon',
      rank: 'A',
      source: 'play',
      theme: '日常',
      date: '2026-07-10',
      keys: 20,
      mistakes: 5,
      speed: 20,
      accuracy: 80,
      seconds: 60,
    }
    expect(isScoreRecord(raw)).toBe(true)
  })

  it('コア5項目だけの妥当な生レコードは true', () => {
    expect(isScoreRecord({ keys: 20, mistakes: 5, speed: 20, accuracy: 80, seconds: 60 })).toBe(true)
  })

  it('keys が負は false', () => {
    expect(isScoreRecord({ keys: -1, mistakes: 5, speed: 20, accuracy: 80, seconds: 60 })).toBe(false)
  })

  it('keys が非整数（1.5）は false', () => {
    expect(isScoreRecord({ keys: 1.5, mistakes: 5, speed: 20, accuracy: 80, seconds: 60 })).toBe(false)
  })

  it('mistakes が負は false', () => {
    expect(isScoreRecord({ keys: 20, mistakes: -1, speed: 20, accuracy: 80, seconds: 60 })).toBe(false)
  })

  it('accuracy が 101 は false（内包 Score が範囲外）', () => {
    expect(isScoreRecord({ keys: 20, mistakes: 5, speed: 20, accuracy: 101, seconds: 60 })).toBe(false)
  })

  it('speed が負は false（内包 Score が不正）', () => {
    expect(isScoreRecord({ keys: 20, mistakes: 5, speed: -1, accuracy: 80, seconds: 60 })).toBe(false)
  })

  it('seconds が Infinity は false（内包 Score が不正）', () => {
    expect(isScoreRecord({ keys: 20, mistakes: 5, speed: 20, accuracy: 80, seconds: Infinity })).toBe(false)
  })

  it('null は false', () => {
    expect(isScoreRecord(null)).toBe(false)
  })

  it('非オブジェクト（数値・文字列・undefined）は false', () => {
    expect(isScoreRecord(20)).toBe(false)
    expect(isScoreRecord('record')).toBe(false)
    expect(isScoreRecord(undefined)).toBe(false)
  })
})
