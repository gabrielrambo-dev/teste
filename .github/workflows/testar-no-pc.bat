@echo off
title Nemotron Chat - PC sem erro CORS
echo Instalando dependencias...
call npm install
echo.
echo Abrindo app no PC com proxy local...
call npm run dev
pause
