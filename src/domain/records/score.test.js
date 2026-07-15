import { describe, it, expect } from 'vitest'
// #311: 採点結果 {speed, accuracy, seconds} を Value Object（不変・自己検証・値等価）にする。
// 本体 src/domain/records/score.vo.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 採点式は既存 src/domain/marathon/scoring.service.js の score() と一致させる（形状互換）。
import { makeScore, isScore, scoreEquals, keysPerMinute } from './score.vo.js'

// ---- makeScore：ファクトリ（採点式内包）＋自己検証＋凍結 ----
describe('makeScore（#311・ファクトリ/採点式/自己検証/凍結）', () => {
  describe('採点式と具体例（speed/accuracy/seconds の丸め含む）', () => {
    it('keys600・mistakes0・elapsedMs60000 → speed600 / accuracy100 / seconds60', () => {
      const s = makeScore({ keys: 600, mistakes: 0, elapsedMs: 60000 })
      expect(s.speed).toBe(600)
      expect(s.accuracy).toBe(100)
      expect(s.seconds).toBe(60)
    })

    it('keys90・mistakes10・elapsedMs60000 → speed90 / accuracy90 / seconds60', () => {
      const s = makeScore({ keys: 90, mistakes: 10, elapsedMs: 60000 })
      expect(s.speed).toBe(90)
      expect(s.accuracy).toBe(90)
      expect(s.seconds).toBe(60)
    })

    it('keys90・mistakes10・elapsedMs30000（minutes=0.5）→ speed180 / accuracy90 / seconds30', () => {
      const s = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
      expect(s.speed).toBe(180)
      expect(s.accuracy).toBe(90)
      expect(s.seconds).toBe(30)
    })

    it('keys0・mistakes0・elapsedMs0 → speed0 / accuracy100 / seconds0（ゼロ除算回避）', () => {
      const s = makeScore({ keys: 0, mistakes: 0, elapsedMs: 0 })
      expect(s.speed).toBe(0)
      expect(s.accuracy).toBe(100)
      expect(s.seconds).toBe(0)
    })

    it('keys100・mistakes0・elapsedMs45000 → speed133（100/0.75=133.33 を四捨五入）', () => {
      const s = makeScore({ keys: 100, mistakes: 0, elapsedMs: 45000 })
      expect(s.speed).toBe(133)
    })

    it('elapsedMs12345 → seconds12.3（Math.round(123.45)/10）', () => {
      const s = makeScore({ keys: 10, mistakes: 0, elapsedMs: 12345 })
      expect(s.seconds).toBe(12.3)
    })

    it('accuracy は keys+mistakes>0 のとき keys/(keys+mistakes)*100 を四捨五入（1/3 → 33）', () => {
      const s = makeScore({ keys: 1, mistakes: 2, elapsedMs: 60000 })
      expect(s.accuracy).toBe(33)
    })

    it('elapsedMs>0 だが keys=0 なら speed=0（打鍵ゼロ）', () => {
      const s = makeScore({ keys: 0, mistakes: 5, elapsedMs: 60000 })
      expect(s.speed).toBe(0)
    })
  })

  describe('凍結・データ項目のみ（メソッドを持たない・形状互換）', () => {
    it('生成された Score は凍結されている（不変）', () => {
      const s = makeScore({ keys: 600, mistakes: 0, elapsedMs: 60000 })
      expect(Object.isFrozen(s)).toBe(true)
    })

    it('凍結ゆえ speed を書き換えても変化しない', () => {
      const s = makeScore({ keys: 600, mistakes: 0, elapsedMs: 60000 })
      try {
        s.speed = 999
      } catch {
        // 凍結オブジェクトへの代入は strict で TypeError（許容）。
      }
      expect(s.speed).toBe(600)
    })

    it('公開プロパティは speed/accuracy/seconds の3項目のみ', () => {
      const s = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
      expect(Object.keys(s).sort()).toEqual(['accuracy', 'seconds', 'speed'])
    })

    it('生オブジェクト（{speed,accuracy,seconds}）と toEqual で一致（消費側と形状互換）', () => {
      const s = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
      expect(s).toEqual({ speed: 180, accuracy: 90, seconds: 30 })
    })
  })

  describe('純粋性（決定的・Date/乱数非依存）', () => {
    it('同一入力からは何度呼んでも値等価な Score を返す', () => {
      const a = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
      const b = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
      expect(scoreEquals(a, b)).toBe(true)
    })
  })

  describe('入力検証は throw する（自己検証）', () => {
    it('keys が負は throw する', () => {
      expect(() => makeScore({ keys: -1, mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('keys が非整数（1.5）は throw する', () => {
      expect(() => makeScore({ keys: 1.5, mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('keys が NaN は throw する', () => {
      expect(() => makeScore({ keys: NaN, mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('keys が Infinity は throw する', () => {
      expect(() => makeScore({ keys: Infinity, mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('keys が非数値（文字列）は throw する', () => {
      expect(() => makeScore({ keys: '600', mistakes: 0, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が負は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: -1, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が非整数（2.5）は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: 2.5, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が NaN は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: NaN, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が Infinity は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: Infinity, elapsedMs: 60000 })).toThrow()
    })

    it('mistakes が非数値（文字列）は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: '0', elapsedMs: 60000 })).toThrow()
    })

    it('elapsedMs が負は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: 0, elapsedMs: -1 })).toThrow()
    })

    it('elapsedMs が NaN は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: 0, elapsedMs: NaN })).toThrow()
    })

    it('elapsedMs が Infinity は throw する（有限が必須）', () => {
      expect(() => makeScore({ keys: 100, mistakes: 0, elapsedMs: Infinity })).toThrow()
    })

    it('elapsedMs が非数値（文字列）は throw する', () => {
      expect(() => makeScore({ keys: 100, mistakes: 0, elapsedMs: '60000' })).toThrow()
    })

    it('elapsedMs は小数を許容する（throw しない）', () => {
      expect(() => makeScore({ keys: 100, mistakes: 0, elapsedMs: 45000.5 })).not.toThrow()
    })
  })
})

// ---- isScore：型ガード（throw しない） ----
describe('isScore（#311・型ガード）', () => {
  it('makeScore の戻り値は true', () => {
    expect(isScore(makeScore({ keys: 600, mistakes: 0, elapsedMs: 60000 }))).toBe(true)
  })

  it('妥当な形の plain object は true', () => {
    expect(isScore({ speed: 180, accuracy: 90, seconds: 30 })).toBe(true)
  })

  it('accuracy の境界 0 は true', () => {
    expect(isScore({ speed: 0, accuracy: 0, seconds: 0 })).toBe(true)
  })

  it('accuracy の境界 100 は true', () => {
    expect(isScore({ speed: 600, accuracy: 100, seconds: 60 })).toBe(true)
  })

  it('accuracy が 101 は false（0..100 の範囲外）', () => {
    expect(isScore({ speed: 600, accuracy: 101, seconds: 60 })).toBe(false)
  })

  it('accuracy が -1 は false（0..100 の範囲外）', () => {
    expect(isScore({ speed: 600, accuracy: -1, seconds: 60 })).toBe(false)
  })

  it('accuracy が非整数（90.5）は false', () => {
    expect(isScore({ speed: 600, accuracy: 90.5, seconds: 60 })).toBe(false)
  })

  it('speed が負は false', () => {
    expect(isScore({ speed: -1, accuracy: 100, seconds: 60 })).toBe(false)
  })

  it('speed が非整数（180.5）は false', () => {
    expect(isScore({ speed: 180.5, accuracy: 100, seconds: 60 })).toBe(false)
  })

  it('seconds が負は false', () => {
    expect(isScore({ speed: 600, accuracy: 100, seconds: -1 })).toBe(false)
  })

  it('seconds が Infinity は false（有限が必須）', () => {
    expect(isScore({ speed: 600, accuracy: 100, seconds: Infinity })).toBe(false)
  })

  it('seconds が非数値（文字列）は false', () => {
    expect(isScore({ speed: 600, accuracy: 100, seconds: '60' })).toBe(false)
  })

  it('null は false', () => {
    expect(isScore(null)).toBe(false)
  })

  it('非オブジェクト（数値・文字列・undefined）は false', () => {
    expect(isScore(60)).toBe(false)
    expect(isScore('score')).toBe(false)
    expect(isScore(undefined)).toBe(false)
  })
})

// ---- scoreEquals：値等価（throw しない） ----
describe('scoreEquals（#311・値等価）', () => {
  it('speed/accuracy/seconds が厳密一致なら true（VO 同士）', () => {
    const a = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
    const b = makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 })
    expect(scoreEquals(a, b)).toBe(true)
  })

  it('speed/accuracy/seconds が厳密一致なら true（plain object 同士）', () => {
    expect(scoreEquals({ speed: 180, accuracy: 90, seconds: 30 }, { speed: 180, accuracy: 90, seconds: 30 })).toBe(true)
  })

  it('speed 違いは false', () => {
    expect(scoreEquals({ speed: 180, accuracy: 90, seconds: 30 }, { speed: 90, accuracy: 90, seconds: 30 })).toBe(false)
  })

  it('accuracy 違いは false', () => {
    expect(scoreEquals({ speed: 180, accuracy: 90, seconds: 30 }, { speed: 180, accuracy: 100, seconds: 30 })).toBe(false)
  })

  it('seconds 違いは false', () => {
    expect(scoreEquals({ speed: 180, accuracy: 90, seconds: 30 }, { speed: 180, accuracy: 90, seconds: 60 })).toBe(false)
  })

  it('一方が不正（accuracy=101）でも throw せず false を返す', () => {
    expect(scoreEquals({ speed: 180, accuracy: 101, seconds: 30 }, { speed: 180, accuracy: 90, seconds: 30 })).toBe(false)
  })

  it('一方が null でも throw せず false を返す', () => {
    expect(scoreEquals(makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 }), null)).toBe(false)
    expect(scoreEquals(null, makeScore({ keys: 90, mistakes: 10, elapsedMs: 30000 }))).toBe(false)
  })
})

// ---- #412 keysPerMinute：打鍵/分（ms 基準）の正準式を1関数へ集約（挙動不変リファクタ・Red） ----
// 正準は score.vo.js:37 の speed 式（= makeScore、segmentStats.service.js:20,35 と同系）。
//   ms>0 → Math.round(keys / (ms/60000))、ms=0 → 0（ゼロ除算回避）。
// coder が keysPerMinute(keys, ms) を score.vo.js に切り出し、makeScore/segmentScore/quizScore の
// 分あたり打鍵は本関数に寄せる（ms 基準に統一）。
// 注意：ui/romaji/RomajiView.container.jsx:24・ui/touch/TouchView.container.jsx:23 は seconds 基準の
//   別式 round(keys/seconds*60) を使っているが、#412 では canonical（ms 基準）を「正」として統一する。
//   よって旧 seconds 式は pin しない（canonical に寄せる意図）。
describe('keysPerMinute（#412：打鍵/分・ms 基準の正準式）', () => {
  it('canonical と一致：keys300・ms60000 → 300（現行 score.vo.js:37 式で算出）', () => {
    expect(keysPerMinute(300, 60000)).toBe(300)
  })

  it('丸め有り：keys250・ms30000 → 500 / keys123・ms45678 → 162（四捨五入）', () => {
    expect(keysPerMinute(250, 30000)).toBe(500)
    expect(keysPerMinute(123, 45678)).toBe(162)
  })

  it('keys0 は 0 を返す（ms>0）', () => {
    expect(keysPerMinute(0, 60000)).toBe(0)
  })

  it('ms=0 はゼロ除算回避で 0 を返す（現行 elapsedMs>0 の三項と一致）', () => {
    expect(keysPerMinute(100, 0)).toBe(0)
  })

  it('makeScore の speed と完全一致する（正準の同一式であることの回帰）', () => {
    for (const [keys, ms] of [[600, 60000], [123, 45678], [250, 30000], [0, 60000], [100, 0]]) {
      expect(keysPerMinute(keys, ms)).toBe(makeScore({ keys, mistakes: 0, elapsedMs: ms }).speed)
    }
  })
})
