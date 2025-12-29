@echo off
copy "client\src\pages\GestisciUtenti\components\*.tsx" "client\src\pages\Utenti\components\"
copy "client\src\pages\GestisciUtenti\utils\*.ts" "client\src\pages\Utenti\utils\"
copy "client\src\pages\GestisciUtenti\utils\*.tsx" "client\src\pages\Utenti\utils\"
echo Componenti copiati!
