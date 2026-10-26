@echo off
rem Double-click to open the portfolio app on this laptop, with the figures
rem the tracker last worked out here (?local). The phone uses the online copy.
title Portfolio
cd /d "%~dp0"

rem A copy left running from last time would still hold the port: stop it.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8540 " ^| findstr LISTENING') do taskkill /pid %%p /f >nul 2>nul

py tools\serve.py . 8540 --open
