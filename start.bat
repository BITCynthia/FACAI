@echo off
rem 一键启动：分别拉起后端(FastAPI)与前端(Vite)
cd /d "%~dp0"

start "FACAI backend"  cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
start "FACAI frontend" cmd /k "npm run dev"

echo.
echo  后端 API 文档: http://127.0.0.1:8000/docs
echo  前端页面:      http://localhost:5173
echo.
