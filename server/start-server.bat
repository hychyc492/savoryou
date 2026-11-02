@echo off
chcp 65001 >nul
title SavorU 服务器（保持本窗口开启，关闭即停止）
cd /d %~dp0

echo ==============================================
echo   正在启动 SavorU ...
echo ==============================================
start "" /b node --env-file=.env src\index.js

timeout /t 4 >nul

echo.
echo   本机访问：   http://127.0.0.1:3001
echo   应用首页：   http://127.0.0.1:3001/app
echo   校外地图：   http://127.0.0.1:3001/nearby
echo   接口文档：   http://127.0.0.1:3001/api/docs
echo.
echo   局域网（同一 WiFi 的其他电脑/手机可用）：
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do echo      http://%%i:3001
echo.
echo   关闭本窗口即停止服务；需要外网访问请另开一个窗口运行 share-tunnel.bat
echo ==============================================
pause