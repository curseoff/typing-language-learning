// 分岐物語データ「海外旅行アドベンチャー」。
// テキストを打って進み、選択肢のいずれかを打つと分岐する。複数エンド。
// node/choice: en(英文) / ja(和文・漢字) / kana(和文の読み=ローマ字判定用)。
//   ja には鉤括弧「」を入れない（ローマ字入力できないため）。長音「ー」はハイフン入力。
// jaWords(nodeのみ): 翻訳モードの単語チップ用。連結すると ja になる（句読点は語に付ける）。
// node: choices?[{en,ja,kana,next}] / next?(直線) / ending?(エンドID) / endLabel?
export const STORY = {
  title: '海外旅行アドベンチャー',
  start: 'arrival',
  endingCount: 4,
  nodes: {
    arrival: {
      en: 'After a long flight, your plane finally lands. You are excited to start your trip.',
      ja: '長いフライトの後、飛行機がついに着陸した。あなたは旅の始まりにわくわくしている。',
      kana: 'ながいふらいとのあと、ひこうきがついにちゃくりくした。あなたはたびのはじまりにわくわくしている。',
      jaWords: ['長い', 'フライトの', '後、', '飛行機が', 'ついに', '着陸した。', 'あなたは', '旅の', '始まりに', 'わくわくしている。'],
      next: 'immigration',
    },
    immigration: {
      en: 'An immigration officer looks at your passport. "What is the purpose of your visit?"',
      ja: '入国審査官があなたのパスポートを見る。訪問の目的は何ですか？',
      kana: 'にゅうこくしんさかんがあなたのぱすぽーとをみる。ほうもんのもくてきはなんですか？',
      jaWords: ['入国審査官が', 'あなたの', 'パスポートを', '見る。', '訪問の', '目的は', '何ですか？'],
      choices: [
        { en: 'I am here for sightseeing.', ja: '観光で来ました。', kana: 'かんこうできました。', next: 'taxi' },
        { en: 'I am here on business.', ja: '仕事で来ました。', kana: 'しごとできました。', next: 'business' },
        { en: 'Why do you want to know that?', ja: 'なぜそれを知りたいのですか？', kana: 'なぜそれをしりたいのですか？', next: 'suspicious' },
      ],
    },
    suspicious: {
      en: 'The officer frowns and asks many more questions. After a long wait, he lets you go.',
      ja: '審査官は顔をしかめ、さらに多くの質問をする。長い待ち時間の後、彼はあなたを通した。',
      kana: 'しんさかんはかおをしかめ、さらにおおくのしつもんをする。ながいまちじかんのあと、かれはあなたをとおした。',
      jaWords: ['審査官は', '顔をしかめ、', 'さらに', '多くの', '質問をする。', '長い', '待ち時間の', '後、', '彼は', 'あなたを', '通した。'],
      next: 'taxi',
    },
    business: {
      en: '"Welcome. Have a nice stay." Outside, a driver is holding a sign with your name.',
      ja: 'ようこそ。良いご滞在を。外では運転手があなたの名前の看板を持っている。',
      kana: 'ようこそ。よいごたいざいを。そとではうんてんしゅがあなたのなまえのかんばんをもっている。',
      jaWords: ['ようこそ。', '良い', 'ご滞在を。', '外では', '運転手が', 'あなたの', '名前の', '看板を', '持っている。'],
      next: 'hotel',
    },
    taxi: {
      en: 'Outside the airport, a friendly man smiles at you. "Taxi? Very cheap, my friend!"',
      ja: '空港の外で、人懐っこい男があなたに微笑む。タクシー？とても安いよ、友よ！',
      kana: 'くうこうのそとで、ひとなつっこいおとこがあなたにほほえむ。たくしー？とてもやすいよ、ともよ！',
      jaWords: ['空港の', '外で、', '人懐っこい', '男が', 'あなたに', '微笑む。', 'タクシー？', 'とても', '安いよ、', '友よ！'],
      choices: [
        { en: 'Thank you, but I will take the official taxi.', ja: 'ありがとう、でも正規のタクシーに乗ります。', kana: 'ありがとう、でもせいきのたくしーにのります。', next: 'hotel' },
        { en: 'Great, let us go!', ja: 'いいね、行きましょう！', kana: 'いいね、いきましょう！', next: 'scam' },
      ],
    },
    scam: {
      en: 'The man drives far from the city and demands a lot of money. Something is wrong.',
      ja: '男は街から遠く離れて運転し、大金を要求する。何かがおかしい。',
      kana: 'おとこはまちからとおくはなれてうんてんし、たいきんをようきゅうする。なにかがおかしい。',
      jaWords: ['男は', '街から', '遠く', '離れて', '運転し、', '大金を', '要求する。', '何かが', 'おかしい。'],
      choices: [
        { en: 'I will not pay that. Stop the car.', ja: 'それは払いません。車を止めて。', kana: 'それははらいません。くるまをとめて。', next: 'end_escape' },
        { en: 'Okay, okay. Here is the money.', ja: '分かった、分かった。これがお金です。', kana: 'わかった、わかった。これがおかねです。', next: 'end_bad' },
      ],
    },
    hotel: {
      en: 'You arrive safely at the hotel. The receptionist greets you with a warm smile.',
      ja: '無事にホテルに到着した。受付係が温かい笑顔であなたを迎える。',
      kana: 'ぶじにほてるにとうちゃくした。うけつけがかりがあたたかいえがおであなたをむかえる。',
      jaWords: ['無事に', 'ホテルに', '到着した。', '受付係が', '温かい', '笑顔で', 'あなたを', '迎える。'],
      choices: [
        { en: 'Good evening. I have a reservation.', ja: 'こんばんは。予約しています。', kana: 'こんばんは。よやくしています。', next: 'end_good' },
        { en: 'Do you have a room with a nice view?', ja: '眺めの良い部屋はありますか？', kana: 'ながめのよいへやはありますか？', next: 'end_view' },
      ],
    },
    end_good: {
      en: 'You check in smoothly and relax in your room. Your real adventure begins tomorrow.',
      ja: 'スムーズに手続きを終え、部屋でくつろぐ。本当の冒険は明日から始まる。',
      kana: 'すむーずにてつづきをおえ、へやでくつろぐ。ほんとうのぼうけんはあしたからはじまる。',
      jaWords: ['スムーズに', '手続きを', '終え、', '部屋で', 'くつろぐ。', '本当の', '冒険は', '明日から', '始まる。'],
      ending: 'good',
      endLabel: 'グッドエンド：順調な滑り出し',
    },
    end_view: {
      en: 'The receptionist upgrades your room for free. The city lights are beautiful tonight.',
      ja: '受付係が無料で部屋を格上げしてくれた。今夜は街の灯がとても美しい。',
      kana: 'うけつけがかりがむりょうでへやをかくあげしてくれた。こんやはまちのひがとてもうつくしい。',
      jaWords: ['受付係が', '無料で', '部屋を', '格上げしてくれた。', '今夜は', '街の', '灯が', 'とても', '美しい。'],
      ending: 'view',
      endLabel: 'ラッキーエンド：素敵な夜景',
    },
    end_bad: {
      en: 'You lost most of your money on the first day. This is a rough start to your trip.',
      ja: '初日にお金の大半を失った。波乱の旅の幕開けだ。',
      kana: 'しょにちにおかねのたいはんをうしなった。はらんのたびのまくあけだ。',
      jaWords: ['初日に', 'お金の', '大半を', '失った。', '波乱の', '旅の', '幕開けだ。'],
      ending: 'bad',
      endLabel: 'バッドエンド：災難の初日',
    },
    end_escape: {
      en: 'You refuse firmly and get out. A police officer helps you. You are safe, but shaken.',
      ja: 'きっぱり断って車を降りる。警官が助けてくれた。無事だが、肝を冷やした。',
      kana: 'きっぱりことわってくるまをおりる。けいかんがたすけてくれた。ぶじだが、きもをひやした。',
      jaWords: ['きっぱり', '断って', '車を', '降りる。', '警官が', '助けてくれた。', '無事だが、', '肝を', '冷やした。'],
      ending: 'escape',
      endLabel: '生還エンド：危機一髪',
    },
  },
}
