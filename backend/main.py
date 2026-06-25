"""FastAPI 入口：包装 AkShare 数据层，暴露 /api/kline 与 /api/search。"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import akshare_source as src

app = FastAPI(title="FACAI A股价格趋势 API", version="1.0.0")

# Vite proxy 已转发 /api，这里再兜底放开本地开发源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_SCALES = {"year", "month", "week", "day", "hour"}


@app.get("/api/kline")
def kline(
    code: str = Query(..., description="6 位 A 股代码，如 600519"),
    scale: str = Query("day", description="year|month|week|day|hour"),
):
    if scale not in _SCALES:
        raise HTTPException(status_code=400, detail=f"scale 必须是 {sorted(_SCALES)} 之一")
    try:
        items = src.get_kline(code, scale)  # type: ignore[arg-type]
    except src.DataSourceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"code": code, "name": src.name_of(code), "scale": scale, "items": items}


@app.get("/api/search")
def search(q: str = Query("", description="代码或名称关键词")):
    try:
        return src.search(q)
    except src.DataSourceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/health")
def health():
    return {"status": "ok"}
