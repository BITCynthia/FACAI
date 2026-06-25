import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { KlinePoint } from '../types'

interface Props {
  items: KlinePoint[]
  color: string
  loading: boolean
  error: string | null
}

export function PriceChart({ items, color, loading, error }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  // 初始化 + 自适应
  useEffect(() => {
    if (!elRef.current) return
    const chart = echarts.init(elRef.current)
    chartRef.current = chart
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  // 数据/颜色变化时重绘
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    if (!items.length) {
      chart.clear()
      return
    }

    const dates = items.map((d) => d.date)
    const closes = items.map((d) => d.close)

    chart.setOption(
      {
        grid: { left: 56, right: 24, top: 24, bottom: 64 },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'line' },
          valueFormatter: (v: number) => (typeof v === 'number' ? v.toFixed(2) : v),
        },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#999' } },
        },
        yAxis: {
          type: 'value',
          scale: true,
          splitLine: { lineStyle: { color: '#eee' } },
          axisLabel: { color: '#666' },
        },
        dataZoom: [
          { type: 'inside', start: 0, end: 100 },
          { type: 'slider', start: 0, end: 100, height: 18, bottom: 24 },
        ],
        series: [
          {
            name: '收盘价',
            type: 'line',
            data: closes,
            showSymbol: false,
            smooth: true,
            lineStyle: { color, width: 2 },
            itemStyle: { color },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: hexToRgba(color, 0.28) },
                { offset: 1, color: hexToRgba(color, 0.02) },
              ]),
            },
          },
        ],
      },
      { notMerge: true },
    )
  }, [items, color])

  return (
    <div className="chart-wrap">
      <div ref={elRef} className="chart" />
      {loading && <div className="chart-overlay">加载中…</div>}
      {!loading && error && <div className="chart-overlay error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="chart-overlay">输入股票代码开始查看价格趋势</div>
      )}
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
