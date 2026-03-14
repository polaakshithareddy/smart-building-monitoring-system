# Build and Run SBMS - Clean launcher
$PROJECT_ROOT = "c:\Users\polaa\OneDrive\Desktop\SBMS"
$BACKEND_ROOT = "$PROJECT_ROOT\backend"
$FRONTEND_ROOT = "$PROJECT_ROOT\frontend"
$TOMCAT_HOME  = "$PROJECT_ROOT\tomcat"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$LIB_PATH     = "$BACKEND_ROOT\src\main\webapp\WEB-INF\lib"
$CLASSES_PATH = "$BACKEND_ROOT\src\main\webapp\WEB-INF\classes"

# --- Step 1: Compile ---
Write-Host "--- Step 1: Compiling Backend ---"
if (-not (Test-Path $CLASSES_PATH)) { New-Item -ItemType Directory -Path $CLASSES_PATH -Force | Out-Null }

# Generate sources list to avoid shell expansion issues
Get-ChildItem -Path "$BACKEND_ROOT\src\main\java\com\sbms\util\*.java", "$BACKEND_ROOT\src\main\java\com\sbms\servlet\*.java" | Resolve-Path | Out-File -FilePath "$BACKEND_ROOT\sources.txt" -Encoding ascii

javac -cp ".;$TOMCAT_HOME\lib\servlet-api.jar;$LIB_PATH\*" -d "$CLASSES_PATH" "@$BACKEND_ROOT\sources.txt"

if ($LASTEXITCODE -ne 0) { 
    Write-Error "Compilation failed."
    Remove-Item "$BACKEND_ROOT\sources.txt" -ErrorAction SilentlyContinue
    exit 1 
}
Write-Host "Compilation successful."
Remove-Item "$BACKEND_ROOT\sources.txt" -ErrorAction SilentlyContinue

# --- Step 2: Deploy webapp ---
Write-Host "--- Step 2: Deploying to Tomcat ---"
$DEPLOY_PATH = "$TOMCAT_HOME\webapps\SBMS"
if (Test-Path $DEPLOY_PATH) { Remove-Item $DEPLOY_PATH -Recurse -Force }
# Copy backend webapp structure
Copy-Item "$BACKEND_ROOT\src\main\webapp" -Destination $DEPLOY_PATH -Recurse
# Sync frontend files (index.html, css, js) into deployment
Copy-Item "$FRONTEND_ROOT\*" -Destination $DEPLOY_PATH -Recurse -Force
Write-Host "Deployed to $DEPLOY_PATH"

# --- Step 3: Start Tomcat with explicit CATALINA_HOME ---
Write-Host "--- Step 3: Starting Tomcat on port 8081 ---"

$env:CATALINA_HOME = $TOMCAT_HOME
$env:CATALINA_BASE = $TOMCAT_HOME

Start-Process -FilePath "$TOMCAT_HOME\bin\catalina.bat" -ArgumentList "start" -WorkingDirectory $TOMCAT_HOME -NoNewWindow

Write-Host "--- Done! ---"
Write-Host "App will be available at: http://localhost:8081/SBMS/"
