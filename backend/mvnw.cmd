@REM ----------------------------------------------------------------------------
@REM MediCare Backend Maven Wrapper
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set MAVEN_CMD=mvn
if exist "C:\Users\thavi\.m2\wrapper\apache-maven-3.9.9\bin\mvn.cmd" (
    set "MAVEN_CMD=C:\Users\thavi\.m2\wrapper\apache-maven-3.9.9\bin\mvn.cmd"
)

call "%MAVEN_CMD%" %*
exit /b %ERRORLEVEL%

