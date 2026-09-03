// ダミーデータ：熊本市中心部の周辺に30件（15種類×2件、非公開4件を含む）
// 位置(lat/lng)は全件で必ず保持する。isPublic=false は「地図に出さない」だけで座標は消えない。
// 見出しは「brand（ブランド） name（店舗名） area（所在地）」の3点で構成する。
// body は掲示板の1件目の書き込み。以降の書き込みは comments に積み上がる。
// status: 'ok'=営業中・利用可 / 'limited'=制限あり / 'closed'=休止・閉鎖
// confirmCount/lastConfirmedAt=👍継続中、changeCount/lastChangedAt=⚠️変化あり（コメントとは独立）、
// reportCount=✕削除依頼（3件を超えたら削除）

// 種類は絵文字＋文字ラベルを必ずセットで表示する（ノンバーバル＋ユニバーサルデザイン）
export const TYPE_ORDER = [
  'スーパー',
  'ガソリンスタンド',
  '炊き出し',
  'コインランドリー',
  '温浴施設',
  'コンビニ',
  'ATM',
  '飲食店',
  '病院',
  '井戸水',
  '給水',
  '物資配布',
  'トイレ',
  '宿泊施設',
  '避難所',
  '危険地帯',
]

export const TYPE_EMOJI = {
  スーパー: '🛒',
  ガソリンスタンド: '⛽',
  炊き出し: '🍲',
  コインランドリー: '🧺',
  温浴施設: '♨️',
  コンビニ: '🏪',
  ATM: '🏧',
  飲食店: '🍴',
  病院: '🏥',
  井戸水: '💧',
  給水: '🚰',
  物資配布: '📦',
  トイレ: '🚻',
  宿泊施設: '🛏️',
  避難所: '🏫',
  危険地帯: '⛔',
}

// 営業状態。色だけに頼らず「●＋文字ラベル」で必ず表示する
export const STATUS_META = {
  ok: { label: '営業中・利用可', dot: '#2f9e5f', text: '#2f7d4f' },
  limited: { label: '制限あり', dot: '#e6a700', text: '#9a6700' },
  closed: { label: '休止・閉鎖', dot: '#c92a2a', text: '#a12626' },
}

// 色は「系統」の補助表示のみ（色だけに意味を持たせない）
const COLOR_WATER = '#1d7fd6' // 水：給水・井戸水
const COLOR_FOOD = '#2f9e5f' // 食：スーパー・コンビニ・飲食店・炊き出し
const COLOR_HYGIENE = '#7048b8' // 衛生：トイレ・ランドリー・温浴
const COLOR_MEDICAL = '#c92a2a' // 医療：病院
const COLOR_MONEY = '#9a6700' // 燃料・お金：ガソリン・ATM
const COLOR_SUPPLY = '#0b7285' // 物資
const COLOR_STAY = '#5f6b7a' // 滞在：宿泊・避難所
const COLOR_DANGER = '#b02020' // 危険：近づかない方がよい場所

export const TYPE_COLORS = {
  スーパー: COLOR_FOOD,
  ガソリンスタンド: COLOR_MONEY,
  炊き出し: COLOR_FOOD,
  コインランドリー: COLOR_HYGIENE,
  温浴施設: COLOR_HYGIENE,
  コンビニ: COLOR_FOOD,
  ATM: COLOR_MONEY,
  飲食店: COLOR_FOOD,
  病院: COLOR_MEDICAL,
  井戸水: COLOR_WATER,
  給水: COLOR_WATER,
  物資配布: COLOR_SUPPLY,
  トイレ: COLOR_HYGIENE,
  宿泊施設: COLOR_STAY,
  避難所: COLOR_STAY,
  危険地帯: COLOR_DANGER,
}

const now = Date.now()
const ago = (min) => now - min * 60000

export const initialPosts = [
  // ---- スーパー ----
  { id: 'p01', type: 'スーパー', brand: 'スーパーみやはら', name: '月出店', area: '東区月出3丁目', body: '食パンあり。開店直後が確実。レジは現金のみ。', lat: 32.7862, lng: 130.733, isPublic: true, createdAt: ago(37), status: 'ok' },
  { id: 'p02', type: 'スーパー', brand: 'マルショク', name: '新町店', area: '中央区新町2丁目', body: '15時まで短縮営業。お一人様5点まで。', lat: 32.797, lng: 130.699, isPublic: true, createdAt: ago(80), status: 'limited' },

  // ---- ガソリンスタンド ----
  { id: 'p03', type: 'ガソリンスタンド', brand: 'エネオス', name: '電車通り店', area: '中央区南熊本1丁目', body: '給油できます。20L制限、列は1時間ほど。', lat: 32.788, lng: 130.708, isPublic: true, createdAt: ago(50), status: 'limited', confirmCount: 4, lastConfirmedAt: ago(18) },
  { id: 'p04', type: 'ガソリンスタンド', brand: '出光', name: '世安店', area: '中央区世安町', body: '本日分は売り切れ。明朝入荷予定と貼り紙あり。', lat: 32.783, lng: 130.712, isPublic: true, createdAt: ago(95), status: 'closed', changeCount: 2, lastChangedAt: ago(25), comments: [{ id: 'c1', text: '明日は朝6時から並ぶ人がいるらしいです', createdAt: ago(20) }] },

  // ---- 炊き出し ----
  { id: 'p05', type: '炊き出し', brand: '', name: '白川小学校', area: '中央区大江6丁目', body: '味噌汁の炊き出し。12時から、なくなり次第終了。', lat: 32.7893, lng: 130.718, isPublic: true, createdAt: ago(65), status: 'ok' },
  { id: 'p06', type: '炊き出し', brand: '', name: '慶徳公園', area: '中央区新町4丁目', body: '町内会の方がおにぎり配布中。数に限りあり。', lat: 32.798, lng: 130.7075, isPublic: true, createdAt: ago(22), status: 'limited' },

  // ---- コインランドリー ----
  { id: 'p07', type: 'コインランドリー', brand: 'マンマチャオ', name: '大江店', area: '中央区大江4丁目', body: '乾燥機も使えます。混雑中。', lat: 32.7935, lng: 130.7285, isPublic: true, createdAt: ago(110), status: 'limited' },
  { id: 'p08', type: 'コインランドリー', brand: '', name: 'ランドリー京町', area: '中央区京町2丁目', body: '断水で休止中。貼り紙のみ、再開は未定。', lat: 32.8125, lng: 130.7055, isPublic: true, createdAt: ago(240), status: 'closed' },

  // ---- 温浴施設 ----
  { id: 'p09', type: '温浴施設', brand: '', name: '湯らっくす', area: '中央区本荘町', body: '日帰り入浴やってます。タオル持参で、待ち時間あり。', lat: 32.7838, lng: 130.7145, isPublic: true, createdAt: ago(150), status: 'limited' },
  { id: 'p10', type: '温浴施設', brand: '銭湯', name: 'たかの湯', area: '中央区坪井1丁目', body: '明日から再開予定。ボイラー点検が終わったそうです。', lat: 32.806, lng: 130.7095, isPublic: true, createdAt: ago(300), status: 'closed' },

  // ---- コンビニ ----
  { id: 'p11', type: 'コンビニ', brand: 'セブンイレブン', name: '水道町店', area: '中央区水道町', body: '営業中。おにぎりあり、数量制限あり。ATMは休止中。', lat: 32.8022, lng: 130.7135, isPublic: true, createdAt: ago(18), status: 'limited' },
  { id: 'p12', type: 'コンビニ', brand: 'ファミリーマート', name: '九品寺店', area: '中央区九品寺2丁目', body: '弁当売り切れ、飲料あり。次の入荷は未定とのこと。', lat: 32.7905, lng: 130.7235, isPublic: true, createdAt: ago(45), status: 'limited' },

  // ---- ATM ----
  { id: 'p13', type: 'ATM', brand: '肥後銀行', name: '本店', area: '中央区練兵町', body: 'ATM動いてます。列は20分ほど。手数料は通常どおり。', lat: 32.8005, lng: 130.7095, isPublic: true, createdAt: ago(60), status: 'ok' },
  { id: 'p14', type: 'ATM', brand: 'ゆうちょ銀行', name: '上通出張所', area: '中央区上通町', body: '停電で休止。入口に紙が貼ってあります。', lat: 32.8042, lng: 130.7112, isPublic: true, createdAt: ago(130), status: 'closed' },

  // ---- 飲食店 ----
  { id: 'p15', type: '飲食店', brand: 'ラーメン', name: '黒亭', area: '西区二本木2丁目', body: '営業してます。メニュー限定、現金のみ。', lat: 32.7925, lng: 130.7005, isPublic: true, createdAt: ago(75), status: 'ok' },
  { id: 'p16', type: '飲食店', brand: '喫茶', name: 'アロー', area: '中央区安政町', body: 'コーヒー注文で電源使えます。充電させてくれます。', lat: 32.8008, lng: 130.7122, isPublic: true, createdAt: ago(40), status: 'ok' },

  // ---- 病院 ----
  { id: 'p17', type: '病院', brand: '', name: '熊本市民病院', area: '東区東町4丁目', body: '外来受付してます。軽症の方は近くの診療所へ案内あり。', lat: 32.7885, lng: 130.7425, isPublic: true, createdAt: ago(55), status: 'ok' },
  { id: 'p18', type: '病院', brand: '', name: 'たなか内科', area: '中央区大江本町', body: '本日休診。入口に貼り紙、処方は市民病院へ。', lat: 32.7965, lng: 130.716, isPublic: true, createdAt: ago(170), status: 'closed' },

  // ---- 井戸水 ----
  { id: 'p19', type: '井戸水', brand: '', name: '八幡さんの井戸', area: '中央区京町本丁', body: '使わせてもらえます。生活用水に。飲む場合は煮沸を。', lat: 32.8105, lng: 130.7025, isPublic: true, createdAt: ago(85), status: 'ok' },
  { id: 'p20', type: '井戸水', brand: '', name: '個人宅の井戸', area: '中央区大江3丁目（非公開）', body: '洗濯・トイレ用に分けます。声をかけてください。', lat: 32.7952, lng: 130.726, isPublic: false, createdAt: ago(200), status: 'ok' },

  // ---- 給水 ----
  { id: 'p21', type: '給水', brand: '給水車', name: '水前寺公園前', area: '中央区水前寺公園', body: '17時まで。容器持参。列は30分ほど。', lat: 32.79, lng: 130.7351, isPublic: true, createdAt: ago(15), status: 'limited', confirmCount: 5, lastConfirmedAt: ago(9), comments: [{ id: 'c2', text: '列は今20分くらいになってました', createdAt: ago(5) }] },
  { id: 'p22', type: '給水', brand: '', name: '八王寺公民館', area: '南区八王寺町', body: '給水はじまりました。一人10Lまで、夕方まで。', lat: 32.7728, lng: 130.7101, isPublic: true, createdAt: ago(33), status: 'limited' },

  // ---- 物資配布 ----
  { id: 'p23', type: '物資配布', brand: '', name: '中央公民館', area: '中央区大江5丁目', body: '毛布・カイロ配布。一家族2枚まで、夕方まで。', lat: 32.8038, lng: 130.7078, isPublic: true, createdAt: ago(28), status: 'limited' },
  { id: 'p24', type: '物資配布', brand: '', name: '個人宅（おむつ）', area: '中央区大江2丁目（非公開）', body: 'おむつMサイズ未開封1パック譲ります。夕方まで在宅です。', lat: 32.7996, lng: 130.7304, isPublic: false, createdAt: ago(245), status: 'ok' },

  // ---- トイレ ----
  { id: 'p25', type: 'トイレ', brand: 'コスモス', name: '月出店', area: '東区月出1丁目', body: '店内トイレ開放中。紙もあります。', lat: 32.801, lng: 130.7566, isPublic: true, createdAt: ago(8), status: 'ok', confirmCount: 3, lastConfirmedAt: ago(12) },
  { id: 'p26', type: 'トイレ', brand: '', name: '個人宅トイレ', area: '中央区黒髪2丁目（非公開）', body: '子ども・高齢者優先で貸します。声をかけてください。夜間は不可。', lat: 32.8054, lng: 130.7203, isPublic: false, createdAt: ago(140), status: 'ok' },

  // ---- 宿泊施設 ----
  { id: 'p27', type: '宿泊施設', brand: 'ホテル日航', name: '熊本', area: '中央区上通町', body: 'ロビー開放しています。充電・休憩OK。宿泊は満室。', lat: 32.8015, lng: 130.7108, isPublic: true, createdAt: ago(90), status: 'limited' },
  { id: 'p28', type: '宿泊施設', brand: '', name: '個人宅の空き部屋', area: '中央区細工町（非公開）', body: '女性・子連れ優先で1組だけ。連絡をくれた方に場所を伝えます。', lat: 32.7898, lng: 130.7062, isPublic: false, createdAt: ago(115), status: 'ok', reportCount: 3 },

  // ---- 避難所 ----
  { id: 'p29', type: '避難所', brand: '', name: '五福小学校 体育館', area: '中央区細工町2丁目', body: '避難所開設されてます。毛布あり。ペット同伴は入口で相談。', lat: 32.7975, lng: 130.7028, isPublic: true, createdAt: ago(35), status: 'ok', confirmCount: 2, lastConfirmedAt: ago(25) },
  // ---- 危険地帯（近づかない方がよい場所。status は 制限あり=注意 / 休止・閉鎖=通行止め として使う）----
  { id: 'p31', type: '危険地帯', brand: '', name: '白川橋 東詰め', area: '中央区安政町', body: '橋げたにひび。車は通行止め、歩行者も迂回してください。', lat: 32.8032, lng: 130.7162, isPublic: true, createdAt: ago(42), status: 'closed', confirmCount: 3, lastConfirmedAt: ago(20) },
  { id: 'p32', type: '危険地帯', brand: '', name: '上通アーケード北口', area: '中央区上通町', body: 'ガラスの破片が散乱。夜は見えないので注意。', lat: 32.8058, lng: 130.7118, isPublic: true, createdAt: ago(70), status: 'limited' },

  { id: 'p30', type: '避難所', brand: '', name: '帯山中学校', area: '中央区帯山4丁目', body: 'もう満員で入れないようです。受付で近隣の避難所を案内されました。', lat: 32.7998, lng: 130.744, isPublic: true, createdAt: ago(58), status: 'closed', changeCount: 1, lastChangedAt: ago(45), comments: [{ id: 'c3', text: '託麻小はまだ空きがあるそうです', createdAt: ago(40) }] },
]
