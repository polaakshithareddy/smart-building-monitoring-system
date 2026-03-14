# SBMS Automated Deployment Script
$TOMCAT_PATH = Read-Host "Please enter the full path to your Apache Tomcat folder (e.g., C:\apache-tomcat-9.0.x)"

if (-not (Test-Path "$TOMCAT_PATH\lib\servlet-api.jar")) {
    Write-Error "Could not find servlet-api.jar at $TOMCAT_PATH\lib\. Please check the path."
    exit
}

Write-Host "--- Step 1: Moving JARs ---"
$LIB_PATH = "src\main\webapp\WEB-INF\lib"
if (-not (Test-Path $LIB_PATH)) { New-Item -ItemType Directory -Path $LIB_PATH -Force }

# Search for JARs in Downloads if they aren't in lib already
if (-not (Test-Path "$LIB_PATH\mysql-connector*.jar")) {
    $JAR = Get-ChildItem -Path "$HOME\Downloads" -Filter "mysql-connector*.jar" | Select-Object -First 1
    if ($JAR) { 
        Copy-Item $JAR.FullName -Destination $LIB_PATH
        Write-Host "Moved MySQL Connector to lib folder."
    } else {
        Write-Warning "MySQL Connector JAR not found in Downloads. Please place it in $LIB_PATH manually."
    }
}

Write-Host "--- Step 2: Compiling Backend ---"
$CLASSES_PATH = "src\main\webapp\WEB-INF\classes"
if (-not (Test-Path $CLASSES_PATH)) { New-Item -ItemType Directory -Path $CLASSES_PATH -Force }

javac -cp ".;$TOMCAT_PATH\lib\servlet-api.jar;src/main/webapp/WEB-INF/lib/*" -d $CLASSES_PATH src/main/java/com/sbms/util/*.java src/main/java/com/sbms/servlet/*.java

if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed. Please check for missing JARs or errors above."
    exit
}
Write-Host "Compilation successful."

Write-Host "--- Step 3: Deploying to Tomcat ---"
$DEPLOY_PATH = "$TOMCAT_PATH\webapps\SBMS"
if (Test-Path $DEPLOY_PATH) { Remove-Item $DEPLOY_PATH -Recurse -Force }
# Copy backend webapp structure
Copy-Item "src/main/webapp" -Destination $DEPLOY_PATH -Recurse
# Sync frontend files from the sibling directory
Copy-Item "../frontend/*" -Destination $DEPLOY_PATH -Recurse -Force

Write-Host "--- Done! ---"
Write-Host "1. Run setup.sql in MySQL if you haven't already."
Write-Host "2. Start Tomcat (run $TOMCAT_PATH\bin\startup.bat)."
Write-Host "3. Open http://localhost:8080/SBMS"
