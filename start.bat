@echo off
rem 一键启动：分别拉起后端(FastAPI)与前端(Vite)
cd /d "%~dp0"

rem 让后端直连数据源(eastmoney/akshare)，绕过公司代理，避免间歇性 ProxyError
set "NO_PROXY=localhost,127.0.0.1,.eastmoney.com,.push2his.eastmoney.com,akshare.akfamily.xyz"

start "FACAI backend"  cmd /k "set NO_PROXY=%NO_PROXY% && cd backend && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
start "FACAI frontend" cmd /k "npm run dev"

echo.
echo  后端 API 文档: http://127.0.0.1:8000/docs
echo  前端页面:      http://localhost:5173
echo.
