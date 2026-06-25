import { useEffect, useMemo, useState } from 'react'
import { SearchBar } from './components/SearchBar'
import { Sidebar } from './components/Sidebar'
import { PriceChart } from './components/PriceChart'
import { useWatchlist } from './store/useWatchlist'
import { fetchKline } from './api/quotes'
import { SCALES, type KlinePoint, type Scale } from './types'

const DEFAULT_COLOR = '#3498db'

export default function App() {
  const wl = useWatchlist()
  const [code, setCode] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [scale, setScale] = useState<Scale>('day')
  const [items, setItems] = useState<KlinePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 拉取行情
  useEffect(() => {
    if (!code) return
    let alive = true
    setLoading(true)
    setError(null)
    fetchKline(code, scale)
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        // 后端名称解析失败时会回退为代码，此时保留已知名称
        if (res.name && res.name !== res.code) setName(res.name)
        if (res.items.length === 0) setError('该尺度下暂无数据')
      })
      .catch((e: Error) => {
        if (!alive) return
        setItems([])
        setError(e.message || '获取失败')
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [code, scale])

  // 当前股票的标记颜色（自选里有则用其颜色）
  const color = useMemo(() => {
    const s = wl.stocks.find((x) => x.code === code)
    return s?.color ?? DEFAULT_COLOR
  }, [wl.stocks, code])

  // 区间涨跌（最新 vs 区间首点）
  const stat = useMemo(() => {
    if (items.length === 0) return null
    const first = items[0].close
    const last = items[items.length - 1].close
    const diff = last - first
    const pct = first ? (diff / first) * 100 : 0
    return { last, diff, pct, up: diff >= 0 }
  }, [items])

  const fav = code ? wl.isFavorite(code) : false

  // 选股时同步已知名称（来自搜索建议或自选列表）
  function selectStock(nextCode: string, nextName?: string) {
    setCode(nextCode)
    if (nextName) setName(nextName)
    else setName('')
  }

  function toggleFav() {
    if (!code) return
    if (fav) wl.removeStock(code)
    else wl.addStock(code, name || code)
  }

  return (
    <div className="app">
      <Sidebar wl={wl} currentCode={code} onSelect={selectStock} />

      <main className="main">
        <div className="topbar">
          <SearchBar onSelect={selectStock} />
        </div>

        <div className="quote-head">
          {code ? (
            <>
              <div className="quote-title">
                <span className="q-name">{name || '—'}</span>
                <span className="q-code">{code}</span>
                <button className={'fav-btn' + (fav ? ' on' : '')} onClick={toggleFav}>
                  {fav ? '★ 已收藏' : '☆ 收藏'}
                </button>
              </div>
              {stat && (
                <div className={'quote-price ' + (stat.up ? 'up' : 'down')}>
                  <span className="price">{stat.last.toFixed(2)}</span>
                  <span className="change">
                    {stat.up ? '+' : ''}
                    {stat.diff.toFixed(2)} ({stat.up ? '+' : ''}
                    {stat.pct.toFixed(2)}%)
                  </span>
                  <span className="change-note">区间涨跌</span>
                </div>
              )}
            </>
          ) : (
            <div className="quote-title">
              <span className="q-name muted">未选择股票</span>
            </div>
          )}

          <div className="scale-switch">
            {SCALES.map((s) => (
              <button
                key={s.key}
                className={scale === s.key ? 'active' : ''}
                onClick={() => setScale(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <PriceChart items={items} color={color} loading={loading} error={error} />
      </main>
    </div>
  )
}
