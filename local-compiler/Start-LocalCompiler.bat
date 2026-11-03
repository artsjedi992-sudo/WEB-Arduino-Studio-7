@echo off
chcp 65001 >nul
title Arduino Studio 7 - Local Compiler
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ArduinoStudio7-LocalCompiler.ps1"
if errorlevel 1 (
  echo.
  echo Local compiler stopped with an error.
  pause
)
