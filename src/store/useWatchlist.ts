import { useCallback, useEffect, useState } from 'react'
import type { AppState, Group, Stock } from '../types'
import { DEFAULT_GROUP_ID, loadState, saveState } from './storage'

// 新股票自动分配的调色板
const PALETTE = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#34495e']

function pickColor(existing: Stock[]): string {
  return PALETTE[existing.length % PALETTE.length]
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function useWatchlist() {
  const [state, setState] = useState<AppState>(() => loadState())

  // 状态变化即落 localStorage
  useEffect(() => {
    saveState(state)
  }, [state])

  const isFavorite = useCallback(
    (code: string) => state.stocks.some((s) => s.code === code),
    [state.stocks],
  )

  const addStock = useCallback((code: string, name: string, groupId = DEFAULT_GROUP_ID) => {
    setState((prev) => {
      if (prev.stocks.some((s) => s.code === code)) return prev
      const stock: Stock = { code, name, color: pickColor(prev.stocks), groupId }
      return { ...prev, stocks: [...prev.stocks, stock] }
    })
  }, [])

  const removeStock = useCallback((code: string) => {
    setState((prev) => ({ ...prev, stocks: prev.stocks.filter((s) => s.code !== code) }))
  }, [])

  const setStockColor = useCallback((code: string, color: string) => {
    setState((prev) => ({
      ...prev,
      stocks: prev.stocks.map((s) => (s.code === code ? { ...s, color } : s)),
    }))
  }, [])

  const moveStock = useCallback((code: string, groupId: string) => {
    setState((prev) => ({
      ...prev,
      stocks: prev.stocks.map((s) => (s.code === code ? { ...s, groupId } : s)),
    }))
  }, [])

  const addGroup = useCallback((name: string): string => {
    const id = uid()
    const group: Group = { id, name: name.trim() || '新分组' }
    setState((prev) => ({ ...prev, groups: [...prev.groups, group] }))
    return id
  }, [])

  const renameGroup = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)),
    }))
  }, [])

  // 删除分组：组内股票回退到「未分组」
  const removeGroup = useCallback((id: string) => {
    if (id === DEFAULT_GROUP_ID) return
    setState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
      stocks: prev.stocks.map((s) => (s.groupId === id ? { ...s, groupId: DEFAULT_GROUP_ID } : s)),
    }))
  }, [])

  return {
    groups: state.groups,
    stocks: state.stocks,
    isFavorite,
    addStock,
    removeStock,
    setStockColor,
    moveStock,
    addGroup,
    renameGroup,
    removeGroup,
  }
}

export type Watchlist = ReturnType<typeof useWatchlist>
