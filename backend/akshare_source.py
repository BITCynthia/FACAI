"""行情数据层：把 A 股历史行情归一化成 [{date, close}]。

数据源为腾讯行情（qt.gtimg.cn / web.ifzq.gtimg.cn / smartbox.gtimg.cn），
经系统代理访问（部分企业代理放行腾讯而封锁东方财富，故不再使用 AkShare/东财）。

对外只暴露 get_kline(code, scale)、search(q)、name_of(code)。
其余为内部实现细节。
"""
from __future__ import annotations

import time
from functools import lru_cache
from typing import Callable, Literal, TypeVar

import pandas as pd
import requests

Scale = Literal["year", "month", "week", "day", "hour"]

# 网络抖动时的轻量重试
_RETRIES = 5
_RETRY_WAIT = 0.8
_TIMEOUT = 8

# 各尺度默认取多少根 K 线（腾讯按数量返回）
_BAR_COUNT: dict[str, int] = {
    "hour": 120,     # 60 分钟线，约 1 个月（前端默认展示最近 3 个交易日）
    "day": 500,      # 约 2 年交易日
    "week": 320,     # 约 6 年
    "month": 360,    # 约 30 年（对多数标的等同取全）
    "year": 360,     # 基于月线重采样，取月线数量
}

_T = TypeVar("_T")


class DataSourceError(Exception):
    """数据源相关错误（代码不存在、上游异常、无数据等）。"""


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


def _symbol(code: str) -> str:
    """把 6 位代码加上市场前缀（sh/sz/bj），供腾讯接口使用。"""
    head = code[0]
    if head in ("5", "6", "9"):
        return "sh" + code
    if head in ("0", "1", "2", "3"):
        return "sz" + code
    return "bj" + code


def _http_get(url: str) -> requests.Response:
    """经系统代理发起 GET，带重试。"""
    def call() -> requests.Response:
        r = requests.get(url, timeout=_TIMEOUT)
        r.raise_for_status()
        return r
    return _retry(call)


def _unescape(s: str) -> str:
    r"""解码腾讯 smartbox 返回的 \uXXXX 转义中文。"""
    if "\\u" not in s:
        return s
    try:
        return s.encode("latin-1", "ignore").decode("unicode_escape")
    except Exception:
        return s


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _fetch_daily_like(code: str, period: str, scale: str) -> list[dict]:
    """day/week/month 历史（前复权）。腾讯 fqkline 接口。"""
    sym = _symbol(code)
    count = _BAR_COUNT.get(scale, 500)
    url = (
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
        f"?param={sym},{period},,,{count},qfq"
    )
    data = _http_get(url).json()
    node = (data.get("data") or {}).get(sym) or {}
    rows = node.get("qfq" + period) or node.get(period) or []
    out: list[dict] = []
    for row in rows:
        # [date, open, close, high, low, volume, ...]
        if len(row) < 3:
            continue
        close = _to_float(row[2])
        if close is None:
            continue
        out.append({"date": str(row[0]), "close": close})
    return out


def _fetch_hour(code: str) -> list[dict]:
    """60 分钟线。腾讯 mkline 接口。"""
    sym = _symbol(code)
    count = _BAR_COUNT["hour"]
    url = (
        "https://ifzq.gtimg.cn/appstock/app/kline/mkline"
        f"?param={sym},m60,,{count}"
    )
    data = _http_get(url).json()
    node = (data.get("data") or {}).get(sym) or {}
    rows = node.get("m60") or []
    out: list[dict] = []
    for row in rows:
        # ['YYYYMMDDHHMM', open, close, high, low, volume, ...]
        if len(row) < 3:
            continue
        close = _to_float(row[2])
        if close is None:
            continue
        ts = str(row[0])
        if len(ts) >= 12:
            ts = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}"
        out.append({"date": ts, "close": close})
    return out


def _fetch_year(code: str) -> list[dict]:
    """腾讯无年线，基于月线重采样取每年最后一个收盘。"""
    monthly = _fetch_daily_like(code, "month", "year")
    if not monthly:
        return []
    tmp = pd.DataFrame(monthly)
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
            return _fetch_daily_like(code, "day", "day")
        if scale == "week":
            return _fetch_daily_like(code, "week", "week")
        if scale == "month":
            return _fetch_daily_like(code, "month", "month")
        if scale == "hour":
            return _fetch_hour(code)
        if scale == "year":
            return _fetch_year(code)
        raise DataSourceError(f"不支持的尺度: {scale}")
    except DataSourceError:
        raise
    except Exception as exc:  # 网络异常统一包装
        raise DataSourceError(f"行情获取失败: {exc}") from exc


@lru_cache(maxsize=1024)
def name_of(code: str) -> str:
    """根据代码查名称，查不到返回代码本身。腾讯实时行情接口。"""
    code = (code or "").strip()
    if not (code.isdigit() and len(code) == 6):
        return code
    try:
        sym = _symbol(code)
        r = _http_get(f"https://qt.gtimg.cn/q={sym}")
        r.encoding = "gbk"
        # 形如 v_sh600519="1~贵州茅台~600519~1206.00~...";
        text = r.text
        eq = text.find('="')
        if eq != -1:
            payload = text[eq + 2 :].strip().rstrip('";')
            fields = payload.split("~")
            if len(fields) > 1 and fields[1]:
                return fields[1]
    except Exception:
        pass
    return code


def search(q: str, limit: int = 20) -> list[dict]:
    """按代码或名称/拼音模糊匹配，返回 [{code, name}]。腾讯 smartbox 接口。"""
    q = (q or "").strip()
    if not q:
        return []
    try:
        r = _http_get(f"https://smartbox.gtimg.cn/s3/?v=2&q={q}&t=all")
        r.encoding = "gbk"
    except Exception as exc:
        raise DataSourceError(f"搜索失败: {exc}") from exc

    text = r.text
    eq = text.find('="')
    if eq == -1:
        return []
    payload = text[eq + 2 :].strip().rstrip('";')
    if not payload:
        return []

    out: list[dict] = []
    seen: set[str] = set()
    for item in payload.split("^"):
        fields = item.split("~")
        if len(fields) < 3:
            continue
        market, code, name = fields[0], fields[1], _unescape(fields[2])
        # 只保留沪深京 A 股/ETF（6 位数字代码）
        if not (code.isdigit() and len(code) == 6):
            continue
        if market not in ("sh", "sz", "bj"):
            continue
        if code in seen:
            continue
        seen.add(code)
        out.append({"code": code, "name": name})
        if len(out) >= limit:
            break
    return out
