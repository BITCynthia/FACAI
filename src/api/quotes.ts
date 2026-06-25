import type { KlineResponse, Scale, SearchHit } from '../types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // 忽略非 JSON 错误体
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function fetchKline(code: string, scale: Scale): Promise<KlineResponse> {
  return getJson<KlineResponse>(`/api/kline?code=${encodeURIComponent(code)}&scale=${scale}`)
}

export function searchStock(q: string): Promise<SearchHit[]> {
  return getJson<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}`)
}
