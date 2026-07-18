@echo off
echo ========================================
echo Push to Hager Branch (Force)
echo ========================================
echo.
echo This will OVERWRITE the remote Hager branch with your local changes.
echo All your optimizations will be pushed to GitHub.
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Pushing to oringin/Hager with --force-with-lease...
git push oringin Hager --force-with-lease

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! 
    echo ========================================
    echo Your changes are now on GitHub!
    echo View at: https://github.com/MohamedAhmedMaged/Legal-Graduation-ITI/tree/Hager
    echo.
) else (
    echo.
    echo ========================================
    echo FAILED!
    echo ========================================
    echo The push failed. Check the error above.
    echo.
)

pause
