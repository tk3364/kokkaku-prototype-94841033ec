import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  ZoomControl,
  ScaleControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { initialPosts, TYPE_ORDER, TYPE_COLORS, TYPE_EMOJI, STATUS_META } from './data.js'

const CENTER = [32.7995, 130.7165] // 熊本市中心部

// 現在地ボタンで寄せる倍率。縮尺バーが 50m を示す近さ
const MY_POS_ZOOM = 18

// 同一の投稿の同一項目（状態変更・継続中・変化あり・削除依頼）は5分に1回まで（この端末内での制限）
const ACTION_COOLDOWN_MS = 5 * 60 * 1000

function timeLabel(t) {
  const min = Math.floor(Math.max(0, Date.now() - t) / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

function pinIcon(post, selected) {
  const closed = post.status === 'closed'
  const cls = `pin${selected ? ' pin-selected' : ''}${closed ? ' pin-closed' : ''}`
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="${cls}" style="border-color:${TYPE_COLORS[post.type] || '#5f6b7a'}"><span class="pin-emoji" role="img" aria-label="${post.type}">${TYPE_EMOJI[post.type] || '📍'}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

const draftIcon = () =>
  L.divIcon({
    className: 'pin-wrap',
    html: '<div class="pin pin-draft">＋</div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })

// 現在地マーカー（投稿ピンと区別できる青い点）
const myPosIcon = () =>
  L.divIcon({
    className: 'pin-wrap',
    html: '<div class="my-dot" role="img" aria-label="現在地"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

// 2点間のおおよその距離（m）。近い順の並び替えに使う
function distanceMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function distanceLabel(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`
  return `${(m / 1000).toFixed(1)}km`
}

// 並び替えの選択肢
const SORT_OPTIONS = [
  { value: 'new', label: '新しい順' },
  { value: 'near', label: '近い順（現在地）' },
  { value: 'status', label: '使える順（営業中→制限→休止）' },
  { value: 'confirm', label: '継続中の報告が多い順' },
  { value: 'active', label: '書き込みが多い順' },
  { value: 'type', label: 'ジャンル順' },
]

const STATUS_RANK = { ok: 0, limited: 1, closed: 2 }

// 最終更新＝いちばん新しい書き込みの時刻（書き込みが無ければ投稿時刻）
function lastActivityAt(p) {
  const cs = p.comments || []
  return cs.length ? cs[cs.length - 1].createdAt : p.createdAt
}

// 一覧内で該当カードが見える位置まで、なめらかにスクロールする
// （scroll-behavior / scrollIntoView / rAF の smooth が効かない環境でも動くようタイマー実装）
function scrollCardIntoView(container, card) {
  const c = container.getBoundingClientRect()
  const t = card.getBoundingClientRect()
  let delta = 0
  if (t.top < c.top) delta = t.top - c.top - 10
  else if (t.bottom > c.bottom) delta = t.bottom - c.bottom + 10
  if (!delta) return
  const start = container.scrollTop
  const t0 = performance.now()
  const duration = 300
  const timer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / duration)
    container.scrollTop = start + delta * (1 - Math.pow(1 - k, 3))
    if (k >= 1) clearInterval(timer)
  }, 16)
}

// 選択された一件（公開のみ）へ地図を移動する
function FlyToSelected({ post }) {
  const map = useMap()
  const postId = post?.id
  useEffect(() => {
    if (!post || !post.isPublic) return
    try {
      const size = map.getSize()
      // 狭い画面で一覧タブ表示中は地図が display:none（サイズ0）。
      // そのまま flyTo すると Leaflet が内部エラーを投げてアプリごと落ちるため動かさない
      // （地図タブへ切り替えた時に App 側の effect が位置を合わせる）。
      if (size.x === 0 || size.y === 0) return
      map.flyTo([post.lat, post.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
    } catch {
      // 描画途中の Leaflet 内部エラーは無視（骨格検証には影響しない）
    }
    // 確認ボタンで同じ一件のオブジェクトが差し替わっても再度飛ばないよう id だけ見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, map])
  return null
}

// 投稿フォームが開いている間だけ、地図クリックで位置を採取する
function MapClickPicker({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function App() {
  const [posts, setPosts] = useState(initialPosts)
  const [selectedId, setSelectedId] = useState(null)
  const [filterType, setFilterType] = useState(null) // null=すべて。一覧と地図の両方に効く
  const [sortMode, setSortMode] = useState('new')
  const [pane, setPane] = useState('list') // 狭い画面のタブ。一覧が既定
  const [form, setForm] = useState(null) // null | { type, text, isPublic, pos, status }
  const [commentDraft, setCommentDraft] = useState(null) // null | { postId, text }
  const [mergedNote, setMergedNote] = useState('') // 統合したときの案内
  const [lastActionAt, setLastActionAt] = useState({}) // `postId:項目` -> この端末で最後に操作した時刻
  const [, setNowTick] = useState(Date.now())

  // 残り時間表示と時刻ラベルを更新するための定期再描画
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // kind: 'status' | 'keep' | 'comment' | 'report'（項目ごとに独立して5分1回）
  function cooldownRemaining(id, kind) {
    const t = lastActionAt[`${id}:${kind}`]
    if (!t) return 0
    return Math.max(0, ACTION_COOLDOWN_MS - (Date.now() - t))
  }

  // 選択中カードに出す残り時間の案内（ロック中の項目だけ列挙）
  function lockNote(id) {
    const locked = [
      ['status', '状態変更'],
      ['keep', '👍継続中'],
      ['change', '⚠️変化あり'],
      ['report', '✕削除依頼'],
      ['comment', 'コメント'],
    ]
      .map(([k, label]) => ({ label, ms: cooldownRemaining(id, k) }))
      .filter((x) => x.ms > 0)
    if (locked.length === 0) return null
    return `同じ項目の操作は5分に1回です（${locked
      .map((x) => `${x.label} あと${Math.ceil(x.ms / 60000)}分`)
      .join('・')}）`
  }
  const mapRef = useRef(null)
  const cardRefs = useRef({})
  const cardsRef = useRef(null)
  const lastScrollTop = useRef(0)
  const [headerHidden, setHeaderHidden] = useState(false)

  // 地図が狭いとポップアップと右下のボタンが重なるので、その分だけボタンを上へ逃がす
  const popupRef = useRef(null)
  const fabRef = useRef(null)
  const [fabRaise, setFabRaise] = useState(0)

  // 現在地。取得するまでは null（地図・並び替え・投稿位置で共用する）
  const [myPos, setMyPos] = useState(null)
  const centerOnMyPos = useRef(false)
  const [geoState, setGeoState] = useState('idle') // idle | loading | ok | error
  const [geoError, setGeoError] = useState('')

  // 現在地を取得する。onDone があれば取得後に呼ぶ（投稿フォームで位置に使う等）
  function locateMe(onDone) {
    if (!navigator.geolocation) {
      setGeoState('error')
      setGeoError('この端末では現在地を取得できません')
      return
    }
    setGeoState('loading')
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude]
        setMyPos(p)
        setGeoState('ok')
        onDone?.(p)
      },
      (err) => {
        setGeoState('error')
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? '現在地の使用が許可されていません'
            : '現在地を取得できませんでした',
        )
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }

  // 現在地へ地図を移動（未取得なら取得してから移動）。縮尺25m相当まで寄せて中心に置く
  function goToMyPos() {
    // 狭い画面では地図タブへ切り替えた直後まだサイズ0なので、描画されるまで数回試す
    const move = (p, tries = 0) => {
      const map = mapRef.current
      if (!map) return
      try {
        if (map.getSize().x > 0) {
          map.invalidateSize()
          map.setView(p, MY_POS_ZOOM)
        } else if (tries < 12) {
          setTimeout(() => move(p, tries + 1), 60)
        }
      } catch {
        // 描画途中の Leaflet 内部エラーは無視
      }
    }
    centerOnMyPos.current = true // タブ切替時の「選択中の一件へ寄せる」処理より優先する
    setPane('map')
    if (myPos) move(myPos)
    else locateMe((p) => move(p))
  }

  // ポップアップと右下ボタンが横方向で重なるときだけ、ボタンをポップアップの上へ持ち上げる
  useLayoutEffect(() => {
    function measure() {
      const popup = popupRef.current
      const fab = fabRef.current
      if (!popup || !fab) {
        setFabRaise(0)
        return
      }
      const pr = popup.getBoundingClientRect()
      const fr = fab.getBoundingClientRect()
      // 上下位置は持ち上げで変わるので、横方向の重なりだけで判定する（判定が振動しない）
      const overlapsSideways = pr.right > fr.left - 8
      setFabRaise(overlapsSideways ? Math.round(pr.height) + 26 : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    // 画面幅やポップアップの高さが変わったときも測り直す
    const ro = new ResizeObserver(measure)
    if (popupRef.current) ro.observe(popupRef.current)
    if (fabRef.current) ro.observe(fabRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
  })

  // 一覧を下へスクロールするとヘッダーを隠し、上へ戻すと再表示する
  function onCardsScroll(e) {
    const top = e.currentTarget.scrollTop
    const prev = lastScrollTop.current
    if (Math.abs(top - prev) < 8) return // 小さな揺れは無視
    setHeaderHidden(top > prev && top > 60)
    lastScrollTop.current = top
  }

  const selected = posts.find((p) => p.id === selectedId) || null

  const visible = useMemo(
    () => (filterType ? posts.filter((p) => p.type === filterType) : posts),
    [posts, filterType],
  )
  const sorted = useMemo(() => {
    const arr = [...visible]
    const byNew = (a, b) => lastActivityAt(b) - lastActivityAt(a) // 最終更新が新しい順
    switch (sortMode) {
      case 'near':
        if (!myPos) return arr.sort(byNew) // 現在地が未取得のときは新しい順のまま
        return arr.sort(
          (a, b) =>
            distanceMeters(myPos, [a.lat, a.lng]) - distanceMeters(myPos, [b.lat, b.lng]),
        )
      case 'status':
        return arr.sort(
          (a, b) =>
            STATUS_RANK[a.status || 'ok'] - STATUS_RANK[b.status || 'ok'] || byNew(a, b),
        )
      case 'confirm':
        return arr.sort((a, b) => (b.confirmCount || 0) - (a.confirmCount || 0) || byNew(a, b))
      case 'active':
        return arr.sort(
          (a, b) => (b.comments || []).length - (a.comments || []).length || byNew(a, b),
        )
      case 'type':
        return arr.sort(
          (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || byNew(a, b),
        )
      default:
        return arr.sort(byNew)
    }
  }, [visible, sortMode, myPos])
  const publicCount = visible.filter((p) => p.isPublic).length

  // 絞り込みで選択中の一件が消えるときは選択も解除する
  function changeFilter(type) {
    setFilterType(type)
    if (type && selected && selected.type !== type) {
      setSelectedId(null)
    }
  }

  // 地図側で選ばれたとき、一覧の該当カードへスクロール
  useEffect(() => {
    const card = cardRefs.current[selectedId]
    if (card && cardsRef.current) {
      scrollCardIntoView(cardsRef.current, card)
    }
  }, [selectedId])

  // 狭い画面で地図タブへ切り替えた直後、Leaflet にサイズを再計算させ、
  // 一覧で選択済みの一件があればその位置へ合わせる（非表示中は飛べないため）
  useEffect(() => {
    if (pane === 'map') {
      setTimeout(() => {
        const map = mapRef.current
        if (!map) return
        try {
          map.invalidateSize()
          if (centerOnMyPos.current) {
            centerOnMyPos.current = false // 現在地ボタン経由のときは寄せ直さない
            return
          }
          const sel = posts.find((p) => p.id === selectedId)
          if (sel && sel.isPublic) {
            map.setView([sel.lat, sel.lng], Math.max(map.getZoom(), 15))
          }
        } catch {
          // 描画途中の Leaflet 内部エラーは無視
        }
      }, 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane])

  function markAction(id, kind) {
    setLastActionAt((m) => ({ ...m, [`${id}:${kind}`]: Date.now() }))
  }

  // 👍 継続中：訪れた人が「情報は今も有効」と報告する
  function confirmPost(e, id) {
    e.stopPropagation() // カードの選択切替やピン移動を起こさない
    if (cooldownRemaining(id, 'keep') > 0) return
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, confirmCount: (p.confirmCount || 0) + 1, lastConfirmedAt: Date.now() }
          : p,
      ),
    )
    markAction(id, 'keep')
  }

  // ⚠️ 変化あり：状況が変わったという報告（コメントとは独立）
  function reportChange(e, id) {
    e.stopPropagation()
    if (cooldownRemaining(id, 'change') > 0) return
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, changeCount: (p.changeCount || 0) + 1, lastChangedAt: Date.now() }
          : p,
      ),
    )
    markAction(id, 'change')
  }

  // 営業状態の変更（プルダウン）。項目「状態変更」として5分に1回
  function changeStatus(id, status) {
    if (cooldownRemaining(id, 'status') > 0) return
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
    markAction(id, 'status')
  }

  function submitComment() {
    if (!commentDraft || !commentDraft.text.trim()) return
    const { postId, text } = commentDraft
    if (cooldownRemaining(postId, 'comment') > 0) return
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...(p.comments || []),
                { id: `c${Date.now()}`, text: text.trim(), createdAt: Date.now() },
              ],
            }
          : p,
      ),
    )
    setCommentDraft(null)
    markAction(postId, 'comment')
  }

  // ！ 削除依頼：3件を超えたら投稿ごと削除する
  function reportPost(e, id) {
    e.stopPropagation()
    if (cooldownRemaining(id, 'report') > 0) return
    const target = posts.find((p) => p.id === id)
    const newCount = (target?.reportCount || 0) + 1
    if (newCount > 3) {
      setPosts((prev) => prev.filter((p) => p.id !== id))
      if (selectedId === id) setSelectedId(null)
      if (commentDraft?.postId === id) setCommentDraft(null)
    } else {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, reportCount: newCount } : p)),
      )
      if (commentDraft?.postId === id) setCommentDraft(null)
    }
    markAction(id, 'report')
  }

  // 同じ場所への投稿かどうか。ジャンルが違えば別の投稿として扱う（同じ建物のトイレとATM等）
  function findDuplicate(cand) {
    const norm = (s) => (s || '').trim().replace(/\s+/g, '').toLowerCase()
    const key = norm(cand.brand) + norm(cand.name)
    return posts.find((p) => {
      if (p.type !== cand.type) return false
      const sameName = key.length > 0 && norm(p.brand) + norm(p.name) === key
      const near = distanceMeters([p.lat, p.lng], [cand.lat, cand.lng]) <= 30
      return sameName || near
    })
  }

  function submitForm() {
    if (!form || !form.name.trim() || !form.text.trim() || !form.pos) return
    const p = {
      id: `u${Date.now()}`,
      type: form.type,
      brand: form.brand.trim(),
      name: form.name.trim(),
      area: form.area.trim(),
      body: form.text.trim(),
      lat: form.pos[0],
      lng: form.pos[1],
      isPublic: form.isPublic,
      createdAt: Date.now(),
      status: form.status,
      comments: [],
      reportCount: 0,
    }
    // 同じ場所・同じジャンルの投稿が既にあれば、新規に立てず書き込みとして足す
    const dup = findDuplicate(p)
    if (dup) {
      setPosts((prev) =>
        prev.map((q) =>
          q.id === dup.id
            ? {
                ...q,
                status: p.status, // 最新の状態で更新する
                comments: [
                  ...(q.comments || []),
                  { id: `c${Date.now()}`, text: p.body, createdAt: Date.now() },
                ],
              }
            : q,
        ),
      )
      setMergedNote(`同じ場所の投稿があったので「${[dup.brand, dup.name].filter(Boolean).join(' ')}」に書き込みました`)
      setSelectedId(dup.id)
    } else {
      setPosts((prev) => [p, ...prev])
      setMergedNote('')
      setSelectedId(p.id)
    }
    setForm(null)
    setFilterType(null) // 投稿した一件が絞り込みで隠れないようにする
  }

  // カード1件の描画。一覧と地図上のポップアップで同じ見た目を使う
  function renderCard(p, inPopup = false) {
    return (
      <article
        key={p.id}
        ref={inPopup ? undefined : (el) => (cardRefs.current[p.id] = el)}
        className={`card card-st-${p.status || 'ok'}${
          p.id === selectedId ? ' card-selected' : ''
        }${inPopup ? ' card-in-popup' : ''}`}
        onClick={() => setSelectedId(p.id)}
      >
        <div className="card-upper">
          <div
            className="card-icon"
            style={{ borderColor: TYPE_COLORS[p.type] }}
            role="img"
            aria-label={p.type}
          >
            {TYPE_EMOJI[p.type]}
          </div>
          <div className="card-main">
            <div className="card-top">
              <div className="card-chips">
                <span className="type-chip">{p.type}</span>
                <span
                  className={`status-badge status-select-wrap st-${p.status || 'ok'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <select
                    value={p.status || 'ok'}
                    disabled={cooldownRemaining(p.id, 'status') > 0}
                    aria-label="営業状態を変更（5分に1回）"
                    title={
                      cooldownRemaining(p.id, 'status') > 0
                        ? '状態の変更は5分に1回です'
                        : '営業状態を変更できます'
                    }
                    onChange={(e) => changeStatus(p.id, e.target.value)}
                  >
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <span
                className="time"
                title={
                  (p.comments || []).length
                    ? '最後の書き込みからの経過時間'
                    : '投稿からの経過時間'
                }
              >
                {timeLabel(lastActivityAt(p))}
              </span>
            </div>
            <h3 className="card-title">
              {p.brand && <span className="title-brand">{p.brand}</span>}
              <span className="title-name">{p.name}</span>
              <span className="title-area">{p.area}</span>
              {myPos && (
                <span className="title-dist">
                  {distanceLabel(distanceMeters(myPos, [p.lat, p.lng]))}
                </span>
              )}
            </h3>
            {!p.isPublic && (
              <div className="card-meta">
                <span className="loc-private">位置：非公開</span>
              </div>
            )}
            {/* 掲示板：新しい書き込みが上。いちばん下が最初の書き込み */}
            {(() => {
              const entries = [
                ...[...(p.comments || [])].reverse(),
                { id: `${p.id}-body`, text: p.body, createdAt: p.createdAt },
              ]
              const open = p.id === selectedId
              const shown = open ? entries : entries.slice(0, 2)
              return (
                <div
                  className={`board${open && entries.length > 6 ? ' board-scroll' : ''}`}
                  onClick={(e) => open && e.stopPropagation()}
                >
                  {shown.map((e) => (
                    <p key={e.id} className="board-line">
                      {e.text}
                      <span className="board-time">・{timeLabel(e.createdAt)}</span>
                    </p>
                  ))}
                  {entries.length > shown.length && (
                    <p className="board-more">
                      ほか{entries.length - shown.length}件の書き込み
                    </p>
                  )}
                </div>
              )
            })()}
            {p.id === selectedId && (
              <div className="comment-form" onClick={(e) => e.stopPropagation()}>
                <input
                  value={commentDraft?.postId === p.id ? commentDraft.text : ''}
                  placeholder="今どう？"
                  disabled={cooldownRemaining(p.id, 'comment') > 0}
                  onChange={(e) => setCommentDraft({ postId: p.id, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitComment()
                  }}
                />
                <button
                  className="comment-send"
                  disabled={
                    cooldownRemaining(p.id, 'comment') > 0 ||
                    !(commentDraft?.postId === p.id && commentDraft.text.trim())
                  }
                  onClick={submitComment}
                >
                  送信
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="react-row">
          <button
            className="react-btn react-keep"
            disabled={cooldownRemaining(p.id, 'keep') > 0}
            title="情報は今も有効（5分に1回）"
            onClick={(e) => confirmPost(e, p.id)}
          >
            <span className="react-label">👍 継続中</span>
            <span className="react-count">{p.confirmCount || 0}</span>
          </button>
          <button
            className="react-btn react-change"
            disabled={cooldownRemaining(p.id, 'change') > 0}
            title="状況が変わっていた（5分に1回）"
            onClick={(e) => reportChange(e, p.id)}
          >
            <span className="react-label">⚠️ 変化あり</span>
            <span className="react-count">{p.changeCount || 0}</span>
          </button>
          <button
            className="react-btn react-report"
            disabled={cooldownRemaining(p.id, 'report') > 0}
            title="投稿の削除を依頼する（3件を超えると削除・5分に1回）"
            onClick={(e) => reportPost(e, p.id)}
          >
            <span className="react-label">✕ 削除依頼</span>
            <span className="react-count">{p.reportCount || 0}</span>
          </button>
        </div>
        {p.id === selectedId && lockNote(p.id) && (
          <p className="cooldown-note">{lockNote(p.id)}</p>
        )}
      </article>
    )
  }

  return (
    <div className={`app pane-${pane}`} style={{ '--fab-raise': `${fabRaise}px` }}>
      <header className={headerHidden ? 'header header-hidden' : 'header'}>
        <h1 className="header-title">
          ご近所情報ボード <span className="proto-tag">骨格プロトタイプ</span>
        </h1>
      </header>

      <nav className="tabs">
        <button
          className={pane === 'list' ? 'tab tab-active' : 'tab'}
          onClick={() => setPane('list')}
        >
          一覧
        </button>
        <button
          className={pane === 'map' ? 'tab tab-active' : 'tab'}
          onClick={() => setPane('map')}
        >
          地図
        </button>
      </nav>

      <main className="main">
        <section className={`list-pane${pane === 'list' ? ' pane-active' : ''}`}>
          <div className="list-head">
            <span className="genre-select-wrap">
              <select
                value={filterType ?? ''}
                aria-label="ジャンルで絞り込み"
                title="ジャンルで絞り込めます"
                onChange={(e) => changeFilter(e.target.value || null)}
              >
                <option value="">🗂️ すべてのジャンル</option>
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_EMOJI[t]} {t}
                  </option>
                ))}
              </select>
            </span>
            <span className="genre-select-wrap">
              <select
                value={sortMode}
                aria-label="並び替え"
                title="並び替えできます"
                onChange={(e) => {
                  const v = e.target.value
                  setSortMode(v)
                  if (v === 'near' && !myPos) locateMe() // 近い順は現在地が要る
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    ↕ {o.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="list-sub">
            {mergedNote && (
              <span className="merged-note" onClick={() => setMergedNote('')}>
                🔗 {mergedNote}
              </span>
            )}
            <span className="count">
              {visible.length}件（地図 {publicCount}件）
            </span>
            {sortMode === 'near' && !myPos && (
              <span className="sort-warn">
                {geoState === 'loading'
                  ? '現在地を取得しています…'
                  : `${geoError || '現在地が必要です'}（新しい順で表示中）`}
              </span>
            )}
          </div>

          <div className="cards" ref={cardsRef} onScroll={onCardsScroll}>
            {sorted.length === 0 && (
              <p className="empty-note">この種類の投稿はまだありません。</p>
            )}
            {sorted.map((p) => renderCard(p))}
          </div>
        </section>

        <section className={`map-pane${pane === 'map' ? ' pane-active' : ''}`}>
          {/* 地図上のポップアップ：選択中の一件をカードで重ねて表示 */}
          {selected && (
            <div className="map-popup" ref={popupRef}>
              <button
                className="popup-close"
                aria-label="閉じる"
                title="閉じる"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
              {renderCard(selected, true)}
            </div>
          )}
          <MapContainer
            center={CENTER}
            zoom={14}
            maxZoom={19}
            ref={mapRef}
            className="map"
            zoomControl={false}
          >
            {/* 縮尺ボタンは右下、縮尺バーは左下 */}
            <ZoomControl position="bottomright" />
            <ScaleControl position="bottomleft" metric imperial={false} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            {visible
              .filter((p) => p.isPublic)
              .map((p) => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={pinIcon(p, p.id === selectedId)}
                  zIndexOffset={p.id === selectedId ? 1000 : 0}
                  eventHandlers={{ click: () => setSelectedId(p.id) }}
                >
                  <Tooltip>
                    {TYPE_EMOJI[p.type]} {[p.brand, p.name].filter(Boolean).join(' ')}
                  </Tooltip>
                </Marker>
              ))}
            {form?.pos && <Marker position={form.pos} icon={draftIcon()} />}
            {myPos && (
              <Marker position={myPos} icon={myPosIcon()} zIndexOffset={500}>
                <Tooltip>現在地</Tooltip>
              </Marker>
            )}
            <FlyToSelected post={selected} />
            <MapClickPicker enabled={!!form} onPick={(pos) => setForm((f) => ({ ...f, pos }))} />
          </MapContainer>
        </section>
      </main>

      {form && (
        <div className="form-panel">
          <div className="form-row">
            <label htmlFor="form-type">種類</label>
            <select
              id="form-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_EMOJI[t]} {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="form-brand">ブランド</label>
            <input
              id="form-brand"
              value={form.brand}
              placeholder="例：セブンイレブン（なければ空欄）"
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="form-name">店舗名</label>
            <input
              id="form-name"
              value={form.name}
              placeholder="例：水道町店"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="form-area">所在地</label>
            <input
              id="form-area"
              value={form.area}
              placeholder="例：中央区水道町"
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="form-text">内容</label>
            <input
              id="form-text"
              value={form.text}
              placeholder="例：トイレ開放中。紙もあります"
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>状態</label>
            <div className="status-select" role="group" aria-label="営業状態">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  className={`status-option st-${key}${form.status === key ? ' status-option-active' : ''}`}
                  onClick={() => setForm({ ...form, status: key })}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label>位置</label>
            <div className="pos-field">
              <button
                type="button"
                className="use-mypos"
                disabled={geoState === 'loading'}
                onClick={() => {
                  if (myPos) setForm((f) => ({ ...f, pos: myPos }))
                  else locateMe((p) => setForm((f) => ({ ...f, pos: p })))
                }}
              >
                {geoState === 'loading' ? '📍 取得中…' : '📍 現在地を使う'}
              </button>
              {form.pos ? (
                <span className="pos-ok">指定済み（地図クリックで変更できます）</span>
              ) : (
                <span className="pos-none">
                  {geoError || '地図をクリックするか、現在地を使ってください'}
                </span>
              )}
            </div>
          </div>
          <label className="form-check">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
            />
            地図に正確な場所を表示する（公開）
          </label>
          {!form.isPublic && (
            <p className="form-note">非公開：一覧には出ますが、地図にピンは表示されません。</p>
          )}
          <div className="form-actions">
            <button
              className="submit-button"
              disabled={!form.name.trim() || !form.text.trim() || !form.pos}
              onClick={submitForm}
            >
              投稿する
            </button>
          </div>
        </div>
      )}

      {/* 現在地・投稿は右下に固定（スクロールしても常に届く） */}
      <div className="fab-stack" ref={fabRef} style={{ bottom: 18 + fabRaise }}>
        {/* 投稿中はフォーム側の「現在地を使う」に任せて隠す（狭い画面の一覧ではCSSで非表示） */}
        {!form && (
          <button
            className={`fab fab-locate${geoState === 'ok' ? ' fab-locate-on' : ''}`}
            disabled={geoState === 'loading'}
            aria-label="現在地を表示する"
            onClick={goToMyPos}
          >
            {geoState === 'loading' ? '📍 取得中…' : '📍 現在地'}
          </button>
        )}
        <button
          className={`fab${form ? ' fab-close' : ''}`}
          aria-label={form ? '投稿をやめる' : '投稿する'}
          onClick={() =>
            setForm(
              form
                ? null
                : {
                    type: 'トイレ',
                    brand: '',
                    name: '',
                    area: '',
                    text: '',
                    isPublic: true,
                    pos: null,
                    status: 'ok',
                  },
            )
          }
        >
          {form ? '✕ やめる' : '＋ 投稿'}
        </button>
      </div>
    </div>
  )
}
