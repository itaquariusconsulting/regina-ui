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
                    // ZipFile::CreateFromDirectory recorre subdirectorios de verdad.
                    // Compress-Archive con comodin dejaba fuera assets/ y media/,
                    // y la app se quedaba sin config.ini, fuentes ni imagenes.
                    bat """
                        @echo off
                        if exist ${WAR_NAME}.war del /F /Q ${WAR_NAME}.war
                        powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('%CD%\\${dir}', '%CD%\\${WAR_NAME}.war')"
                    """
                    bat """
                        @echo off
                        echo --- contenido del WAR (primeras lineas) ---
                        powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; \$z=[System.IO.Compression.ZipFile]::OpenRead('%CD%\\${WAR_NAME}.war'); \$z.Entries.Count; \$z.Entries | Select-Object -First 15 -ExpandProperty FullName; \$z.Dispose()"
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
