@echo off
chcp 65001 >nul
title SavorU 公网隧道（保持本窗口开启，关闭即断开）
cd /d %~dp0

echo ==============================================
echo   正在建立公网隧道（零安装，基于 ssh + serveo.net）
echo   稍等片刻会打印一个 https 网址，发给任何人都能打开
echo ==============================================
echo.
node scripts\tunnel.mjs
echo.
echo 隧道已结束。重新运行本文件即可获得新地址。
pause