// ============================================================================
//  REGINA-UI-PROD  -  regina-ui  (Angular 19)
//  Rama: prod   |   Tomcat de PRODUCCION: 192.168.50.248:8080
//  Empaqueta el build como WAR y lo publica por el Tomcat Manager.
//  Reemplaza la copia manual de carpetas (ren-aquarius_old2).
// ============================================================================

pipeline {
    agent any

    environment {
        TOMCAT_URL  = 'http://192.168.50.248:8080'
        TOMCAT_CRED = credentials('tomcat-manager-sicore')

        WAR_NAME    = 'ren-aquarius'
        CONTEXT     = 'ren-aquarius'   // debe coincidir con baseHref /ren-aquarius/
        NODE_OPTIONS = '--max_old_space_size=4096'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
        timeout(time: 40, unit: 'MINUTES')
    }

    stages {

        stage('Dependencias') {
            steps {
                script { env.SHA = env.GIT_COMMIT.take(7) }
                echo "Commit a desplegar: ${env.SHA}"
                // ng-bootstrap 17 declara Angular 18 como peer y el proyecto va en Angular 19.
                // El arbol nunca ha sido resoluble en estricto; se instala como siempre
                // se instalo. PENDIENTE: subir @ng-bootstrap/ng-bootstrap a 18.x.
                bat 'npm ci --legacy-peer-deps'
            }
        }

        stage('Compilar') {
            steps {
                bat 'npx ng build --configuration=production'
            }
        }

        stage('Empaquetar WAR') {
            steps {
                script {
                    // Angular 17+ (builder "application") deja la salida en dist/<app>/browser
                    def dir = fileExists('dist/ren-aquarius/browser/index.html') ?
                              'dist\\ren-aquarius\\browser' : 'dist\\ren-aquarius'
                    echo "Empaquetando desde ${dir}"
                    // Se usa 'jar' del JDK y no Compress-Archive ni ZipFile:
                    // en Windows esos escriben las rutas de subcarpetas con barra
                    // invertida (assets\config.ini) y Tomcat no las encuentra.
                    // Sintoma: los bundles de la raiz cargan y assets/ y media/ dan 404.
                    bat """
                        @echo off
                        if exist "%WORKSPACE%\\%WAR_NAME%.war" del /F /Q "%WORKSPACE%\\%WAR_NAME%.war"
                        set "JARX=jar"
                        if exist "%JAVA_HOME%\\bin\\jar.exe" set "JARX=%JAVA_HOME%\\bin\\jar.exe"
                        cd /d "%WORKSPACE%\\${dir}"
                        "%JARX%" -cf "%WORKSPACE%\\%WAR_NAME%.war" .
                    """
                    bat """
                        @echo off
                        set "JARX=jar"
                        if exist "%JAVA_HOME%\\bin\\jar.exe" set "JARX=%JAVA_HOME%\\bin\\jar.exe"
                        echo --- verificacion: rutas de assets/ y media/ dentro del WAR ---
                        "%JARX%" -tf "%WORKSPACE%\\%WAR_NAME%.war" | findstr /i "assets/ media/ icons/"
                    """
                }
            }
        }

        stage('Aprobacion') {
            steps {
                timeout(time: 60, unit: 'MINUTES') {
                    input message: "Publicar ${WAR_NAME} (${env.SHA}) en PRODUCCION?", ok: 'Publicar'
                }
            }
        }

        stage('Publicar') {
            steps {
                bat """
                    @echo off
                    curl -f -u %TOMCAT_CRED_USR%:%TOMCAT_CRED_PSW% ^
                         --upload-file %WAR_NAME%.war ^
                         "%TOMCAT_URL%/manager/text/deploy?path=/%CONTEXT%&update=true"
                """
            }
        }

        stage('Health-check') {
            steps {
                script {
                    def running = false
                    for (int i = 1; i <= 12 && !running; i++) {
                        sleep 5
                        def rc = bat(returnStatus: true, script:
                            '@curl -f -s -u %TOMCAT_CRED_USR%:%TOMCAT_CRED_PSW% ' +
                            '"%TOMCAT_URL%/manager/text/list" | findstr /C:"/%CONTEXT%:running" >nul')
                        if (rc == 0) { running = true }
                        else { echo "Intento ${i}: el contexto aun no figura como running" }
                    }
                    if (!running) { error("Health-check FALLIDO: Tomcat no reporta /%CONTEXT% como running.") }

                    // A diferencia de los backends, aqui el 200 SI es exigible:
                    // es un sitio estatico, la raiz debe devolver index.html.
                    def out = bat(returnStdout: true, script:
                        '@echo off\ncurl -s -o nul -w "%%{http_code}" "%TOMCAT_URL%/%CONTEXT%/"').trim()
                    def code = out.tokenize().last()
                    echo "La raiz del frontend respondio HTTP ${code}"
                    if (code != '200') { error("Health-check FALLIDO: index.html no se sirve (HTTP ${code}).") }
                    echo "Health-check OK."
                }
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: "${WAR_NAME}.war", fingerprint: true
            echo "PUBLICADO: ${WAR_NAME} (${env.SHA}) en produccion."
        }
        failure {
            echo "FALLO el despliegue. ROLLBACK: descargar el .war de la ultima build exitosa de este job y subirlo con el curl del stage 'Publicar'."
        }
    }
}
