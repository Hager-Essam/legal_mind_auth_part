@echo off
echo ========================================
echo   Fix and Push to Hager Branch
echo ========================================
echo.

REM Navigate to root directory (where .git is)
cd /d "%~dp0\.."

echo Current directory: %cd%
echo.

echo Step 1: Pull latest changes from Hager branch...
echo ----------------------------------------
git pull oringin Hager --no-rebase

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Pull had conflicts or issues
    echo.
    echo If you see merge conflicts, you need to resolve them:
    echo 1. Open the conflicted files
    echo 2. Look for ^^^^^^^ HEAD and ======= markers
    echo 3. Choose which version to keep
    echo 4. Remove the conflict markers
    echo 5. Then run: git add .
    echo 6. Then run: git commit -m "fix: resolve merge conflicts"
    echo 7. Then run this script again
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Successfully pulled and merged changes
echo.

echo Step 2: Push your changes to Hager branch...
echo ----------------------------------------
git push -u oringin Hager

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Pushed to Hager branch
    echo ========================================
    echo.
    echo Your changes are now on GitHub!
    echo Visit: https://github.com/MohamedAhmedMaged/Legal-Graduation-ITI/tree/Hager
    echo.
) else (
    echo.
    echo ========================================
    echo   ERROR: Push still failed
    echo ========================================
    echo.
    echo Try these commands manually:
    echo   git status
    echo   git push -u oringin Hager
    echo.
)

pause
