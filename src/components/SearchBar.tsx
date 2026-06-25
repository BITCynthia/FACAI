import { useEffect, useRef, useState } from 'react'
import type { SearchHit } from '../types'
import { searchStock } from '../api/quotes'

interface Props {
  onSelect: (code: string, name?: string) => void
}

export function SearchBar({ onSelect }: Props) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // 防抖联想
  useEffect(() => {
    const kw = q.trim()
    if (!kw) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      searchStock(kw)
        .then((res) => {
          setHits(res)
          setOpen(true)
        })
        .catch(() => setHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  // 点击外部关闭下拉
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function choose(code: string, name?: string) {
    onSelect(code, name)
    setOpen(false)
  }

  function onSubmit() {
    const kw = q.trim()
    if (!kw) return
    // 6 位数字直接当代码查询；否则取第一条联想
    if (/^\d{6}$/.test(kw)) choose(kw)
    else if (hits[0]) choose(hits[0].code, hits[0].name)
  }

  return (
    <div className="searchbar" ref={boxRef}>
      <input
        value={q}
        placeholder="输入股票代码或名称，如 600519 / 茅台"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
      <button onClick={onSubmit}>查询</button>
      {open && hits.length > 0 && (
        <ul className="suggest">
          {hits.map((h) => (
            <li key={h.code} onClick={() => choose(h.code, h.name)}>
              <span className="code">{h.code}</span>
              <span className="name">{h.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
