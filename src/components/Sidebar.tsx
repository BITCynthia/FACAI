import { useState } from 'react'
import type { Watchlist } from '../store/useWatchlist'
import { ColorPicker } from './ColorPicker'

interface Props {
  wl: Watchlist
  currentCode: string | null
  onSelect: (code: string, name?: string) => void
}

export function Sidebar({ wl, currentCode, onSelect }: Props) {
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [newGroup, setNewGroup] = useState('')

  function addGroup() {
    const name = newGroup.trim()
    if (!name) return
    wl.addGroup(name)
    setNewGroup('')
  }

  return (
    <aside className="sidebar">
      <h2>自选股</h2>

      <div className="group-add">
        <input
          value={newGroup}
          placeholder="新建分组，如 金属 / 能源"
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGroup()}
        />
        <button onClick={addGroup}>+</button>
      </div>

      {wl.groups.map((group) => {
        const stocks = wl.stocks.filter((s) => s.groupId === group.id)
        return (
          <section className="group" key={group.id}>
            <header className="group-head">
              <span className="group-name">{group.name}</span>
              <span className="group-count">{stocks.length}</span>
              {group.id !== 'default' && (
                <button
                  className="link-btn"
                  title="重命名分组"
                  onClick={() => {
                    const name = prompt('分组新名称', group.name)
                    if (name != null) wl.renameGroup(group.id, name)
                  }}
                >
                  改
                </button>
              )}
              {group.id !== 'default' && (
                <button
                  className="link-btn danger"
                  title="删除分组（股票移到未分组）"
                  onClick={() => wl.removeGroup(group.id)}
                >
                  删
                </button>
              )}
            </header>

            {stocks.length === 0 && <p className="empty-hint">暂无股票</p>}

            {stocks.map((s) => (
              <div key={s.code}>
                <div
                  className={'stock-row' + (s.code === currentCode ? ' active' : '')}
                  onClick={() => onSelect(s.code, s.name)}
                >
                  <span className="dot" style={{ background: s.color }} />
                  <span className="stock-name">{s.name}</span>
                  <span className="stock-code">{s.code}</span>
                  <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="link-btn"
                      title="设置颜色"
                      onClick={() => setEditingColor(editingColor === s.code ? null : s.code)}
                    >
                      色
                    </button>
                    <select
                      value={s.groupId}
                      title="移动到分组"
                      onChange={(e) => wl.moveStock(s.code, e.target.value)}
                    >
                      {wl.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="link-btn danger"
                      title="取消收藏"
                      onClick={() => wl.removeStock(s.code)}
                    >
                      ×
                    </button>
                  </span>
                </div>
                {editingColor === s.code && (
                  <ColorPicker
                    value={s.color}
                    onChange={(c) => {
                      wl.setStockColor(s.code, c)
                      setEditingColor(null)
                    }}
                  />
                )}
              </div>
            ))}
          </section>
        )
      })}

      {wl.stocks.length === 0 && (
        <p className="empty-hint">查询股票后点「收藏」即可加入自选</p>
      )}
    </aside>
  )
}
