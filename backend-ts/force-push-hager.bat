@echo off
echo ========================================
echo   Fix Unrelated Histories and Push
echo ========================================
echo.

REM Navigate to root directory
cd /d "%~dp0\.."

echo Step 1: Pull with allow-unrelated-histories...
echo ----------------------------------------
git pull oringin Hager --allow-unrelated-histories --no-edit

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Pull failed with merge conflicts
    echo.
    echo You need to resolve conflicts manually:
    echo 1. Check which files have conflicts: git status
    echo 2. Open conflicted files and resolve them
    echo 3. After resolving: git add .
    echo 4. Then: git commit -m "fix: merge unrelated histories"
    echo 5. Then: git push -u oringin Hager
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Successfully merged histories
echo.

echo Step 2: Push to GitHub...
echo ----------------------------------------
git push -u oringin Hager

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Pushed to Hager branch
    echo ========================================
    echo.
    echo Visit: https://github.com/MohamedAhmedMaged/Legal-Graduation-ITI/tree/Hager
    echo.
) else (
    echo.
    echo [ERROR] Push failed
    echo Try: git push -u oringin Hager
    echo.
)

pause
