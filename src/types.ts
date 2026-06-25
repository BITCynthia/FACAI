// 价格尺度
export type Scale = 'year' | 'month' | 'week' | 'day' | 'hour'

export const SCALES: { key: Scale; label: string }[] = [
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' },
  { key: 'hour', label: '时' },
]

// 单个 K 线点（只保留趋势所需的收盘价）
export interface KlinePoint {
  date: string
  close: number
}

export interface KlineResponse {
  code: string
  name: string
  scale: Scale
  items: KlinePoint[]
}

// 搜索建议项
export interface SearchHit {
  code: string
  name: string
}

// 自选股票
export interface Stock {
  code: string
  name: string
  color: string // 该股票在侧栏/图表中的标记颜色
  groupId: string // 所属分组 id
}

// 自定义分组
export interface Group {
  id: string
  name: string
}

// 持久化到 localStorage 的整体状态
export interface AppState {
  version: number
  groups: Group[]
  stocks: Stock[]
}
