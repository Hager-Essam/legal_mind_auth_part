@echo off
echo ========================================
echo   Force Push to Hager Branch
echo ========================================
echo.

cd /d "%~dp0\.."

echo WARNING: This will OVERWRITE the remote Hager branch!
echo.
echo Current branch: 
git branch --show-current
echo.
echo Are you sure you want to force push?
echo This will replace whatever is on GitHub with your local version.
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Force pushing to Hager branch...
echo ----------------------------------------
git push -u oringin Hager --force-with-lease

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Force pushed to Hager
    echo ========================================
    echo.
    echo Your version is now on GitHub
    echo Visit: https://github.com/MohamedAhmedMaged/Legal-Graduation-ITI/tree/Hager
    echo.
) else (
    echo.
    echo [ERROR] Force push failed
    echo.
    echo If --force-with-lease failed, someone else pushed recently.
    echo You can use: git push -u oringin Hager --force
    echo But this is less safe!
    echo.
)

pause
