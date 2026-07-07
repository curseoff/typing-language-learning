// 紹介ページ（LP）の presenter：初見ユーザー向けにアプリの狙いと機能を硬派・簡潔に説明する。
// 純粋描画のみ。導線ハンドラ（onStart＝はじめる／戻る）は App 側から props で受け取る。
export interface AboutViewProps {
  onStart: () => void
}

// 「なぜ打つのか」の 3 つの理由（見出し＋説明）
const REASONS: Array<[string, string]> = [
  ['能動的', '見て終わりにしない'],
  ['正確', '間違えれば、正しく打つまで進めない'],
  ['英語も日本語も', '和文はローマ字で自由に、漢字はそのまま'],
]

// 5 つの学習モード（見出し＋説明）
const LEARNINGS: Array<[string, string]> = [
  ['文章', '会話文を打つ。場面と丁寧さでレベルが上がる'],
  ['物語', '選択肢で分岐、4つのエンド'],
  ['単語', '難易度4段階 × テーマ3種。入力と4択'],
  ['英英辞典', '英語の定義から語彙を掴む'],
  ['タッチタイピング', '打つキーと指を、色で誘導'],
]

export default function AboutView({ onStart }: AboutViewProps) {
  return (
    <div className="about">
      <button type="button" className="about-back" onClick={onStart}>
        ← 戻る
      </button>

      <header className="about-hero">
        <h2 className="about-title">打って、覚える。</h2>
        <p className="about-lead">
          英語学習タイピング。語彙・読解・入力を、手を動かして鍛える。
        </p>
        <button type="button" className="btn-primary" onClick={onStart}>
          はじめる
        </button>
        <p className="about-note">無料・登録不要</p>
      </header>

      <section className="about-section">
        <h3>なぜ「打つ」のか</h3>
        <p>読む・選ぶだけでは、手は動かない。打つことで英語が定着する。</p>
        <dl className="about-defs">
          {REASONS.map(([term, desc]) => (
            <div className="about-def" key={term}>
              <dt>{term}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h3>5つの学習</h3>
        <dl className="about-defs">
          {LEARNINGS.map(([term, desc]) => (
            <div className="about-def" key={term}>
              <dt>{term}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h3>記録が、伸びを示す</h3>
        <p>速度・正確率・ミスを、種類・レベル・モードごとに記録。ランキングで実力を測る。</p>
      </section>

      <section className="about-section">
        <h3>無料・登録不要</h3>
        <p>
          オープンソース（MIT）。インストール不要、ブラウザで動く。記録は端末内にのみ保存。
        </p>
      </section>

      <footer className="about-closing">
        <p className="about-closing-line">打てば、変わる。</p>
        <button type="button" className="btn-primary" onClick={onStart}>
          はじめる
        </button>
      </footer>
    </div>
  )
}
