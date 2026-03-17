# Frontend - Pagina "Voti Parlamento"

## 📋 Requisiti

1. Creare pagina `/voti-parlamento`
2. Aggiungere pulsante "Voti Parlamento" in `/gestisci`
3. Mostrare l'ultima votazione (la più recente) in ordine cronologico

## 🔌 Endpoint API

### GET `/api/voti-politici/ultime?limit=3`

Restituisce le ultime N votazioni più recenti (default: 3).

**Query Parameters:**
- `limit` (opzionale): Numero di votazioni da restituire (default: 3)

### GET `/api/voti-politici/ultima`

Alias che restituisce solo l'ultima votazione (per compatibilità).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (ultime 3):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uri": "http://dati.camera.it/ocd/votazione.rdf/vs19_590_001",
      "votazione_id": "vs19_590_001",
      "legislatura": 19,
      "data_votazione": "2024-01-15",
      "descrizione": "Votazione finale",
      "descrizione_completa": "Descrizione completa...",
      "esito": "Approvato",
      "sigla_atto": null,
      "numero_atto": null,
      "tipo_atto": null,
      "camera": "Camera",
      "spiegazione": "Spiegazione AI...",
      "metadati": {
        "label": "Votazione finale",
        "approvato": "1",
        "seduta": "http://dati.camera.it/ocd/seduta.rdf/s19_590"
      },
      "seduta": "http://dati.camera.it/ocd/seduta.rdf/s19_590",
      "data_sincronizzazione": "2024-01-15T10:30:00Z",
      "data_aggiornamento": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      ...
    },
    {
      "id": 3,
      ...
    }
  ],
  "count": 3
}
```

## 🎨 Codice Frontend

### 1. Aggiungi Pulsante in `/gestisci`

Aggiungi questo pulsante nella pagina di gestione:

```dart
// Nella pagina gestisci (es. lib/pages/gestisci.dart o simile)
ElevatedButton.icon(
  onPressed: () {
    Navigator.pushNamed(context, '/voti-parlamento');
  },
  icon: Icon(Icons.how_to_vote),
  label: Text('Voti Parlamento'),
  style: ElevatedButton.styleFrom(
    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
  ),
),
```

### 2. Crea Pagina Voti Parlamento

Crea il file `lib/pages/voti-parlamento.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/auth_service.dart'; // Adatta al tuo servizio auth

class VotiParlamentoPage extends StatefulWidget {
  @override
  _VotiParlamentoPageState createState() => _VotiParlamentoPageState();
}

class _VotiParlamentoPageState extends State<VotiParlamentoPage> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _votazioni = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _caricaUltimeVotazioni();
  }

  Future<void> _caricaUltimeVotazioni() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await AuthService.getToken(); // Adatta al tuo servizio
      final response = await http.get(
        Uri.parse('https://api.demos.community/api/voti-politici/ultime?limit=3'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] && data['data'] != null && data['data'] is List) {
          setState(() {
            _votazioni = List<Map<String, dynamic>>.from(data['data']);
            _isLoading = false;
          });
        } else {
          setState(() {
            _error = 'Nessuna votazione trovata';
            _isLoading = false;
          });
        }
      } else {
        setState(() {
          _error = 'Errore nel caricamento: ${response.statusCode}';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Errore: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  String _getEmojiCamera(String? camera) {
    if (camera == 'Camera') return '🏛️';
    if (camera == 'Senato') return '🏛️';
    return '📊';
  }

  String _getEmojiEsito(String? esito) {
    if (esito == 'Approvato') return '✅';
    if (esito == 'Non Approvato') return '❌';
    return '❓';
  }

  String _formattaData(String? data) {
    if (data == null) return 'Data non disponibile';
    try {
      final date = DateTime.parse(data);
      return '${date.day}/${date.month}/${date.year}';
    } catch (e) {
      return data;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Voti Parlamento'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _caricaUltimeVotazioni,
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red),
                      SizedBox(height: 16),
                      Text(
                        _error!,
                        style: TextStyle(fontSize: 16),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _caricaUltimeVotazioni,
                        child: Text('Riprova'),
                      ),
                    ],
                  ),
                )
              : _votazioni.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.info_outline, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'Nessuna votazione trovata',
                            style: TextStyle(fontSize: 16, color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : SingleChildScrollView(
                      padding: EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Titolo
                          Text(
                            'Ultime Votazioni',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          
                          SizedBox(height: 16),
                          
                          // Lista delle 3 votazioni
                          ..._votazioni.asMap().entries.map((entry) {
                            final index = entry.key;
                            final votazione = entry.value;
                            return _buildVotazioneCard(votazione, index);
                          }).toList(),
                          
                          SizedBox(height: 24),
                          
                          // Pulsante per vedere tutte le votazioni
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                // Naviga a pagina con tutte le votazioni
                                // Navigator.pushNamed(context, '/voti-parlamento/tutte');
                              },
                              icon: Icon(Icons.list),
                              label: Text('Vedi tutte le votazioni'),
                              style: ElevatedButton.styleFrom(
                                padding: EdgeInsets.symmetric(vertical: 16),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildVotazioneCard(Map<String, dynamic> votazione, int index) {
    return Card(
      elevation: index == 0 ? 3 : 1, // Prima votazione più evidenziata
      margin: EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header con Camera, Data e Esito
            Row(
              children: [
                Text(
                  _getEmojiCamera(votazione['camera']),
                  style: TextStyle(fontSize: 28),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              votazione['camera'] ?? 'Parlamento',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          if (index == 0)
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.blue,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                'PIÙ RECENTE',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),
                      SizedBox(height: 4),
                      Text(
                        _formattaData(votazione['data_votazione']),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  _getEmojiEsito(votazione['esito']),
                  style: TextStyle(fontSize: 28),
                ),
              ],
            ),
            
            SizedBox(height: 16),
            
            // Descrizione
            Text(
              votazione['descrizione'] ?? 
              votazione['descrizione_completa'] ?? 
              'Nessuna descrizione disponibile',
              style: TextStyle(
                fontSize: 15,
                height: 1.5,
                fontWeight: FontWeight.w500,
              ),
            ),
            
            if (votazione['descrizione_completa'] != null &&
                votazione['descrizione_completa'] != votazione['descrizione'])
              ...[
                SizedBox(height: 12),
                Divider(),
                SizedBox(height: 12),
                Text(
                  votazione['descrizione_completa'],
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey[700],
                    height: 1.5,
                  ),
                ),
              ],
            
            SizedBox(height: 16),
            
            // Dettagli compatti
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                if (votazione['esito'] != null)
                  _buildChip(
                    _getEmojiEsito(votazione['esito']),
                    votazione['esito'],
                  ),
                if (votazione['legislatura'] != null)
                  _buildChip('📜', 'Legislatura ${votazione['legislatura']}'),
                if (votazione['tipo_atto'] != null)
                  _buildChip('📄', votazione['tipo_atto']),
              ],
            ),
            
            // Spiegazione AI (se disponibile)
            if (votazione['spiegazione'] != null) ...[
              SizedBox(height: 16),
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.auto_awesome, size: 16, color: Colors.blue),
                        SizedBox(width: 6),
                        Text(
                          'Spiegazione AI',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.blue[900],
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Text(
                      votazione['spiegazione'],
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: Colors.blue[900],
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildChip(String emoji, String label) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: TextStyle(fontSize: 14)),
          SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[800],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, String emoji) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Text(emoji, style: TextStyle(fontSize: 20)),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

### 3. Aggiungi Route

Nel file delle route (es. `lib/routes.dart` o `main.dart`):

```dart
routes: {
  '/voti-parlamento': (context) => VotiParlamentoPage(),
  // ... altre route
},
```

## 📱 Note

- La pagina mostra l'ultima votazione in ordine cronologico (la più recente)
- Include pulsante refresh per ricaricare i dati
- Mostra tutti i dettagli disponibili (esito, descrizione, spiegazione AI)
- Design responsive e moderno
- Gestione errori e stati di caricamento

## 🔄 Aggiornamenti Futuri

- Aggiungere lista di tutte le votazioni
- Filtri per Camera/Senato
- Dettagli voti individuali dei politici
- Timeline cronologica
