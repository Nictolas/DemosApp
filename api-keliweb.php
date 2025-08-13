<?php
// API Proxy per Keliweb - Si connette al database locale
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Gestione preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configurazione database locale
$host = 'localhost'; // Database locale su Keliweb
$dbname = 'nome_database'; // Sostituisci con il nome del tuo database
$username = 'nome_utente'; // Sostituisci con il tuo utente
$password = 'password'; // Sostituisci con la tua password

try {
    $pdo = new PDO("pgsql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore connessione database: ' . $e->getMessage()]);
    exit;
}

// Routing delle richieste - Versione migliorata per Keliweb
$method = $_SERVER['REQUEST_METHOD'];
$request_uri = $_SERVER['REQUEST_URI'];
$script_name = $_SERVER['SCRIPT_NAME'];

// Estrai il path dalla request URI
$path = str_replace($script_name, '', $request_uri);
$path = trim($path, '/');

// Debug info
error_log("Request URI: " . $request_uri);
error_log("Script Name: " . $script_name);
error_log("Path: " . $path);

// Endpoint di test
if ($path === 'health' && $method === 'GET') {
    echo json_encode(['status' => 'OK', 'message' => 'API Keliweb funzionante']);
    exit;
}

// Endpoint login utenti
if ($path === 'utenti/login' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM utenti WHERE email = ? AND password = ?");
        $stmt->execute([$email, $password]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'nome' => $user['nome'],
                    'cognome' => $user['cognome']
                ]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Credenziali non valide']);
        }
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint governo
if ($path === 'governo' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM governo ORDER BY id DESC LIMIT 1");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint ministeri
if ($path === 'ministeri' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM ministeri ORDER BY nome");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint opinioni
if ($path === 'opinioni' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM opinioni ORDER BY data_creazione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint sondaggi
if ($path === 'sondaggi' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM sondaggi ORDER BY data_scadenza DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint elezioni
if ($path === 'elezioni' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM elezioni ORDER BY data_elezione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint referendum
if ($path === 'referendum' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM referendum_abrogativi ORDER BY data_scadenza DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint ICE
if ($path === 'ice' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM ice ORDER BY data_creazione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint iniziative popolari
if ($path === 'iniziative-popolari' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM iniziative_popolari ORDER BY data_creazione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint grazia
if ($path === 'grazia' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM grazia ORDER BY data_richiesta DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint amnistia
if ($path === 'amnistia' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM amnistia ORDER BY data_richiesta DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint capo di stato
if ($path === 'capo-stato' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM capo_stato ORDER BY data_elezione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint statistiche
if ($path === 'statistiche' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as totale_utenti FROM utenti");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode([
            'totale_utenti' => $result['totale_utenti'],
            'timestamp' => date('c')
        ]);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint sostenitori
if ($path === 'sostenitori' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM sostenitori ORDER BY data_adesione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint comunicazioni
if ($path === 'comunicazioni' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM comunicazioni ORDER BY data_invio DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint notifiche
if ($path === 'notifiche' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM notifiche ORDER BY data_creazione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint programma
if ($path === 'programma' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM programma ORDER BY data_creazione DESC");
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Errore database: ' . $e->getMessage()]);
    }
    exit;
}

// Route non trovata
http_response_code(404);
echo json_encode(['error' => 'Route non trovata', 'path' => $path, 'method' => $method]);
?>
