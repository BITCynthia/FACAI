import type { AppState, Group } from '../types'

const KEY = 'facai.watchlist.v1'
const VERSION = 1

// 默认分组：未分组
export const DEFAULT_GROUP_ID = 'default'

const DEFAULT_GROUPS: Group[] = [{ id: DEFAULT_GROUP_ID, name: '未分组' }]

const EMPTY: AppState = {
  version: VERSION,
  groups: DEFAULT_GROUPS,
  stocks: [],
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    const parsed = JSON.parse(raw) as AppState
    // 简单的版本/结构校验，结构异常时回退到空状态
    if (parsed.version !== VERSION || !Array.isArray(parsed.stocks) || !Array.isArray(parsed.groups)) {
      return structuredClone(EMPTY)
    }
    // 保证默认分组始终存在
    if (!parsed.groups.some((g) => g.id === DEFAULT_GROUP_ID)) {
      parsed.groups = [...DEFAULT_GROUPS, ...parsed.groups]
    }
    return parsed
  } catch {
    return structuredClone(EMPTY)
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // localStorage 写满或被禁用时静默失败，不影响浏览
  }
}
