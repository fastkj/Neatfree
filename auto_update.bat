@echo off
REM 进入python目录  运行脚本 .\auto_update.bat
cd /d %~dp0clash

REM 运行Neat.py
python Neat.py

REM 返回项目根目录
cd ..

REM 添加所有更改
git add .

REM 提交更改（如果有）
git commit -m "Auto update: %date% %time%" || exit 0

REM 推送到远程仓库
git push