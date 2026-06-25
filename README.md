# 发财 · A股价格趋势查询

输入股票代码即可查看 A 股历史价格趋势。支持自选收藏、自定义分组与股票颜色标记，
按 年 / 月 / 周 / 日 / 时 五种尺度观察价格。个人数据存于浏览器 localStorage，无需登录。

## 架构

- **后端** `backend/`：FastAPI 包装 [AkShare](https://akshare.akfamily.xyz/) 获取行情，
  统一返回 `{date, close}`，并解决跨域。
- **前端** `src/`：React + Vite + TypeScript + ECharts，折线图展示价格趋势。
- 开发期 Vite 把 `/api` 代理到后端 `127.0.0.1:8000`。

## 首次准备

后端依赖（Python 3.11+）：

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

前端依赖（Node 18+）：

```powershell
npm install
```

## 启动

双击 `start.bat`，或分别运行：

```powershell
# 终端 1：后端
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

# 终端 2：前端
npm run dev
```

打开 http://localhost:5173 即可使用。后端 API 文档见 http://127.0.0.1:8000/docs 。

## 数据接口

- `GET /api/kline?code=600519&scale=day` — 返回 `{code, name, scale, items:[{date, close}]}`，
  `scale` 取 `year|month|week|day|hour`。
- `GET /api/search?q=茅台` — 代码/名称联想，返回 `[{code, name}]`。

> 行情来自 AkShare（东方财富等公开源）。若处于公司代理/弱网环境，请求可能偶发失败，
> 重试或切换尺度即可；后端已内置有限重试。
