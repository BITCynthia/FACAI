"""AkShare 数据层：把 A 股历史行情归一化成 [{date, close}]。

对外只暴露 get_kline(code, scale) 和 search(q)。
其余为内部实现细节。
"""
from __future__ import annotations

import datetime as _dt
import time
from functools import lru_cache
from typing import Callable, Literal, TypeVar

import akshare as ak
import pandas as pd

Scale = Literal["year", "month", "week", "day", "hour"]

# 默认前复权，趋势更连续
_ADJUST = "qfq"

# 代理偶发抖动时的轻量重试
_RETRIES = 5
_RETRY_WAIT = 0.8

_T = TypeVar("_T")


def _retry(fn: Callable[[], _T]) -> _T:
    """对可能因网络/代理抖动而失败的调用做有限重试。"""
    last: Exception | None = None
    for attempt in range(_RETRIES):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - 网络层异常种类多，统一重试
            last = exc
            if attempt < _RETRIES - 1:
                time.sleep(_RETRY_WAIT)
    assert last is not None
    raise last

# 各尺度默认回溯窗口（天）。None 表示尽可能取全。
_WINDOW_DAYS: dict[str, int | None] = {
    "hour": 30,      # 分钟级数据本身回溯有限
    "day": 730,      # 约 2 年
    "week": 1825,    # 约 5 年
    "month": None,   # 取全
    "year": None,    # 取全（基于月线重采样）
}


class DataSourceError(Exception):
    """数据源相关错误（代码不存在、上游异常、无数据等）。"""


def _date_range(scale: str) -> tuple[str, str]:
    """返回 (start, end)，格式 YYYYMMDD。"""
    today = _dt.date.today()
    end = today.strftime("%Y%m%d")
    days = _WINDOW_DAYS.get(scale)
    if days is None:
        start = "19900101"
    else:
        start = (today - _dt.timedelta(days=days)).strftime("%Y%m%d")
    return start, end


def _normalize(df: pd.DataFrame, date_col: str) -> list[dict]:
    """从 DataFrame 提取 date+close 两列，返回升序列表。"""
    if df is None or df.empty:
        return []
    if date_col not in df.columns or "收盘" not in df.columns:
        raise DataSourceError("上游数据格式异常，缺少日期或收盘列")
    out = df[[date_col, "收盘"]].copy()
    out.columns = ["date", "close"]
    out["date"] = out["date"].astype(str)
    out["close"] = pd.to_numeric(out["close"], errors="coerce")
    out = out.dropna(subset=["close"])
    return out.to_dict(orient="records")


def _fetch_daily_like(code: str, period: str, scale: str) -> list[dict]:
    start, end = _date_range(scale)
    df = _retry(
        lambda: ak.stock_zh_a_hist(
            symbol=code,
            period=period,
            start_date=start,
            end_date=end,
            adjust=_ADJUST,
        )
    )
    return _normalize(df, "日期")


def _fetch_hour(code: str) -> list[dict]:
    start, end = _date_range("hour")
    # 分钟接口需要带时分秒
    df = _retry(
        lambda: ak.stock_zh_a_hist_min_em(
            symbol=code,
            period="60",
            start_date=f"{start[:4]}-{start[4:6]}-{start[6:]} 09:30:00",
            end_date=f"{end[:4]}-{end[4:6]}-{end[6:]} 15:00:00",
            adjust=_ADJUST,
        )
    )
    return _normalize(df, "时间")


def _fetch_year(code: str) -> list[dict]:
    """AkShare 无年线，基于月线重采样取每年最后一个收盘。"""
    df = _retry(
        lambda: ak.stock_zh_a_hist(
            symbol=code,
            period="monthly",
            start_date="19900101",
            end_date=_dt.date.today().strftime("%Y%m%d"),
            adjust=_ADJUST,
        )
    )
    if df is None or df.empty:
        return []
    if "日期" not in df.columns or "收盘" not in df.columns:
        raise DataSourceError("上游数据格式异常，缺少日期或收盘列")
    tmp = df[["日期", "收盘"]].copy()
    tmp.columns = ["date", "close"]
    tmp["date"] = pd.to_datetime(tmp["date"], errors="coerce")
    tmp = tmp.dropna(subset=["date"])
    tmp["close"] = pd.to_numeric(tmp["close"], errors="coerce")
    yearly = (
        tmp.set_index("date")
        .resample("YE")["close"]
        .last()
        .dropna()
        .reset_index()
    )
    yearly["date"] = yearly["date"].dt.strftime("%Y")
    return yearly.to_dict(orient="records")


def get_kline(code: str, scale: Scale) -> list[dict]:
    """按尺度返回归一化的 [{date, close}]。"""
    code = (code or "").strip()
    if not (code.isdigit() and len(code) == 6):
        raise DataSourceError("请输入 6 位 A 股代码，例如 600519")

    try:
        if scale == "day":
            return _fetch_daily_like(code, "daily", "day")
        if scale == "week":
            return _fetch_daily_like(code, "weekly", "week")
        if scale == "month":
            return _fetch_daily_like(code, "monthly", "month")
        if scale == "hour":
            return _fetch_hour(code)
        if scale == "year":
            return _fetch_year(code)
        raise DataSourceError(f"不支持的尺度: {scale}")
    except DataSourceError:
        raise
    except Exception as exc:  # AkShare/网络异常统一包装
        raise DataSourceError(f"行情获取失败: {exc}") from exc


@lru_cache(maxsize=1)
def _code_name_table() -> pd.DataFrame:
    """全量 A 股代码-名称表，进程内缓存。"""
    df = _retry(ak.stock_info_a_code_name)
    # 兼容列名（code/name）
    cols = {c.lower(): c for c in df.columns}
    code_col = cols.get("code") or df.columns[0]
    name_col = cols.get("name") or df.columns[1]
    out = df[[code_col, name_col]].copy()
    out.columns = ["code", "name"]
    out["code"] = out["code"].astype(str).str.zfill(6)
    out["name"] = out["name"].astype(str)
    return out


def name_of(code: str) -> str:
    """根据代码查名称，查不到返回代码本身。

    用单只股票的轻量接口，避免触发整张代码表的慢速抓取。
    """
    return _name_cached(code)


@lru_cache(maxsize=1024)
def _name_cached(code: str) -> str:
    try:
        df = _retry(lambda: ak.stock_individual_info_em(symbol=code))
        # 返回 item/value 两列，名称在「股票简称」行
        hit = df.loc[df["item"] == "股票简称", "value"]
        if not hit.empty:
            return str(hit.iloc[0])
    except Exception:
        pass
    return code


def search(q: str, limit: int = 20) -> list[dict]:
    """按代码或名称模糊匹配，返回 [{code, name}]。"""
    q = (q or "").strip()
    if not q:
        return []
    try:
        tbl = _code_name_table()
    except Exception as exc:
        raise DataSourceError(f"代码表加载失败: {exc}") from exc

    mask = tbl["code"].str.contains(q, na=False) | tbl["name"].str.contains(q, na=False)
    hits = tbl[mask].head(limit)
    return hits.to_dict(orient="records")
