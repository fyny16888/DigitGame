@echo off
setlocal EnableDelayedExpansion

pushd %~dp0
 
for /f "tokens=*" %%i in ("%cd%") do set work=%%~nxi
echo Memdbcluater workdir: %work%
echo.
choice /M ȷ��ֹͣMemdbcluster�����Redis���棬��ȷ��Redis�����ѱ��־û�
if ERRORLEVEL 2 goto :EOF

echo.
echo ============Process  list==============
wmic process where "name='node.exe' and commandline like '%%!work!/config/memdb.conf.js%%'" get ProcessId, CommandLine /value | findstr /R "."

set param=
for /f "usebackq tokens=1 skip=1 delims= " %%i in (`wmic process where "name='node.exe' and commandline like '%%!work!/config/memdb.conf.js%%'" get ProcessId ^| findstr /R "."`) do (
set param=!param! /pid %%i
)
echo ============Kill  process==============
if not "%param%"=="" taskkill /f %param%
echo ============Redis flushdb==============
for /f "usebackq" %%i in (`node.exe -e "console.log(require('./config/memdb.conf').locking.db)"`) do set db=%%i

set /p=db%db%: <nul
redis-cli -n %db% flushdb 2>nul

popd
echo.
echo ��������˳�...
pause>nul

