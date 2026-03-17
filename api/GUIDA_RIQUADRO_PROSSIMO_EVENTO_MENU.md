# Guida: Aggiungere Riquadro Prossimo Evento nella Pagina Menu

## 📋 Panoramica

Questa guida spiega come aggiungere un riquadro che mostra il prossimo evento nella pagina menu (`/menu`).

## 🔌 Endpoint API Disponibile

È stato creato un nuovo endpoint API:

**GET `/api/eventi/prossimo`**

- **Autenticazione**: Richiesta (token Bearer)
- **Risposta**: Restituisce il prossimo evento futuro (quello con `giorno_inizio` più vicino a oggi)
- **Formato risposta**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome_evento": "Assemblea Pubblica Demos",
    "tipologia_evento": "Assemblea",
    "paese_evento": "Italia",
    "regione_evento": "Lombardia",
    "provincia_evento": "Milano",
    "comune_evento": "Milano",
    "indirizzo_evento": "Piazza del Duomo, 1",
    "giorno_inizio": "2026-02-15",
    "giorno_fine": "2026-02-15",
    "orario_inizio": "18:00",
    "orario_fine": "20:00",
    "organizzatore": "Demos Community",
    "created_at": "2026-01-24T10:00:00.000Z"
  }
}
```

Se non ci sono eventi futuri:
```json
{
  "success": true,
  "data": null,
  "message": "Nessun evento futuro trovato"
}
```

## 🎨 Implementazione Frontend

### Opzione 1: React/Next.js (per sito web)

#### Componente React per il Riquadro

```jsx
import React, { useState, useEffect } from 'react';

const ProssimoEventoRiquadro = () => {
  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProssimoEvento = async () => {
      try {
        const token = localStorage.getItem('token'); // O dal tuo sistema di auth
        
        const response = await fetch('https://www.demos.community/api/eventi/prossimo', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        
        if (data.success && data.data) {
          setEvento(data.data);
        } else {
          setEvento(null);
        }
      } catch (err) {
        console.error('Errore nel recupero prossimo evento:', err);
        setError('Errore nel caricamento dell\'evento');
      } finally {
        setLoading(false);
      }
    };

    fetchProssimoEvento();
  }, []);

  if (loading) {
    return (
      <div className="prossimo-evento-riquadro loading">
        <p>Caricamento prossimo evento...</p>
      </div>
    );
  }

  if (error || !evento) {
    return null; // Non mostrare nulla se non c'è un evento
  }

  // Formatta la data
  const formattaData = (dataString) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="prossimo-evento-riquadro">
      <div className="prossimo-evento-header">
        <h3>📅 Prossimo Evento</h3>
      </div>
      <div className="prossimo-evento-content">
        <h4>{evento.nome_evento}</h4>
        <p className="tipologia">{evento.tipologia_evento}</p>
        
        <div className="prossimo-evento-info">
          <p className="data">
            <strong>📆 Data:</strong> {formattaData(evento.giorno_inizio)}
          </p>
          
          {evento.orario_inizio && (
            <p className="orario">
              <strong>🕐 Orario:</strong> {evento.orario_inizio}
              {evento.orario_fine && ` - ${evento.orario_fine}`}
            </p>
          )}
          
          {evento.comune_evento && (
            <p className="luogo">
              <strong>📍 Luogo:</strong> {evento.comune_evento}
              {evento.provincia_evento && `, ${evento.provincia_evento}`}
              {evento.regione_evento && ` (${evento.regione_evento})`}
            </p>
          )}
          
          {evento.indirizzo_evento && (
            <p className="indirizzo">
              <strong>🏠 Indirizzo:</strong> {evento.indirizzo_evento}
            </p>
          )}
          
          {evento.organizzatore && (
            <p className="organizzatore">
              <strong>👤 Organizzatore:</strong> {evento.organizzatore}
            </p>
          )}
        </div>
        
        <a 
          href="/eventi" 
          className="vedi-tutti-eventi-btn"
        >
          Vedi tutti gli eventi →
        </a>
      </div>
    </div>
  );
};

export default ProssimoEventoRiquadro;
```

#### CSS per il Riquadro

```css
.prossimo-evento-riquadro {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.prossimo-evento-header h3 {
  margin: 0 0 15px 0;
  font-size: 1.3em;
  font-weight: 600;
}

.prossimo-evento-content h4 {
  margin: 0 0 10px 0;
  font-size: 1.5em;
  font-weight: 700;
}

.prossimo-evento-content .tipologia {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.9em;
  margin-bottom: 15px;
}

.prossimo-evento-info {
  margin: 15px 0;
}

.prossimo-evento-info p {
  margin: 8px 0;
  font-size: 0.95em;
}

.prossimo-evento-info strong {
  margin-right: 8px;
}

.vedi-tutti-eventi-btn {
  display: inline-block;
  margin-top: 15px;
  padding: 10px 20px;
  background: white;
  color: #667eea;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  transition: transform 0.2s;
}

.vedi-tutti-eventi-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.prossimo-evento-riquadro.loading {
  text-align: center;
  padding: 40px;
}
```

#### Utilizzo nella Pagina Menu

```jsx
import ProssimoEventoRiquadro from '../components/ProssimoEventoRiquadro';

function MenuPage() {
  return (
    <div className="menu-page">
      <h1>Menu</h1>
      
      {/* Altri contenuti del menu */}
      
      {/* Aggiungi il riquadro del prossimo evento */}
      <ProssimoEventoRiquadro />
      
      {/* Altri contenuti del menu */}
    </div>
  );
}
```

### Opzione 2: Flutter (per app mobile)

#### Widget Flutter per il Riquadro

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ProssimoEventoRiquadro extends StatefulWidget {
  final String? token;
  
  const ProssimoEventoRiquadro({Key? key, this.token}) : super(key: key);

  @override
  _ProssimoEventoRiquadroState createState() => _ProssimoEventoRiquadroState();
}

class _ProssimoEventoRiquadroState extends State<ProssimoEventoRiquadro> {
  Map<String, dynamic>? evento;
  bool loading = true;
  bool error = false;

  @override
  void initState() {
    super.initState();
    _fetchProssimoEvento();
  }

  Future<void> _fetchProssimoEvento() async {
    try {
      final response = await http.get(
        Uri.parse('https://www.demos.community/api/eventi/prossimo'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          setState(() {
            evento = data['data'];
            loading = false;
          });
        } else {
          setState(() {
            evento = null;
            loading = false;
          });
        }
      } else {
        setState(() {
          error = true;
          loading = false;
        });
      }
    } catch (e) {
      print('Errore nel recupero prossimo evento: $e');
      setState(() {
        error = true;
        loading = false;
      });
    }
  }

  String _formattaData(String dataString) {
    final data = DateTime.parse(dataString);
    return '${data.day}/${data.month}/${data.year}';
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Container(
        padding: EdgeInsets.all(20),
        child: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (error || evento == null) {
      return SizedBox.shrink(); // Non mostrare nulla se non c'è un evento
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.event, color: Colors.white),
              SizedBox(width: 8),
              Text(
                'Prossimo Evento',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: 16),
          Text(
            evento!['nome_evento'] ?? '',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 8),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              evento!['tipologia_evento'] ?? '',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
              ),
            ),
          ),
          SizedBox(height: 16),
          if (evento!['giorno_inizio'] != null)
            _buildInfoRow(Icons.calendar_today, 'Data', _formattaData(evento!['giorno_inizio'])),
          if (evento!['orario_inizio'] != null)
            _buildInfoRow(
              Icons.access_time,
              'Orario',
              '${evento!['orario_inizio']}${evento!['orario_fine'] != null ? ' - ${evento!['orario_fine']}' : ''}',
            ),
          if (evento!['comune_evento'] != null)
            _buildInfoRow(
              Icons.location_on,
              'Luogo',
              '${evento!['comune_evento']}${evento!['provincia_evento'] != null ? ', ${evento!['provincia_evento']}' : ''}',
            ),
          if (evento!['indirizzo_evento'] != null)
            _buildInfoRow(Icons.home, 'Indirizzo', evento!['indirizzo_evento']),
          if (evento!['organizzatore'] != null)
            _buildInfoRow(Icons.person, 'Organizzatore', evento!['organizzatore']),
          SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              Navigator.pushNamed(context, '/eventi');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Color(0xFF667eea),
            ),
            child: Text('Vedi tutti gli eventi'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, color: Colors.white, size: 18),
          SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

#### Utilizzo nella Pagina Menu Flutter

```dart
import 'package:flutter/material.dart';
import 'widgets/prossimo_evento_riquadro.dart';

class MenuPage extends StatelessWidget {
  final String? token;
  
  const MenuPage({Key? key, this.token}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Menu'),
      ),
      body: ListView(
        children: [
          // Altri widget del menu
          
          // Aggiungi il riquadro del prossimo evento
          ProssimoEventoRiquadro(token: token),
          
          // Altri widget del menu
        ],
      ),
    );
  }
}
```

## ✅ Checklist Implementazione

- [ ] Aggiunto endpoint `/api/eventi/prossimo` (già fatto)
- [ ] Creato componente/widget per il riquadro
- [ ] Aggiunto il componente nella pagina menu
- [ ] Testato il caricamento dell'evento
- [ ] Verificato che il riquadro non venga mostrato se non ci sono eventi futuri
- [ ] Aggiunto stile CSS/styling appropriato
- [ ] Testato su dispositivi diversi (se applicabile)

## 🔧 Personalizzazione

Puoi personalizzare:
- **Colori**: Modifica i gradienti e i colori nel CSS/styling
- **Layout**: Cambia la disposizione degli elementi
- **Informazioni mostrate**: Aggiungi o rimuovi campi dall'evento
- **Link**: Modifica il link "Vedi tutti gli eventi" per puntare alla pagina corretta

## 📝 Note

- L'endpoint richiede autenticazione, assicurati di passare il token correttamente
- Se non ci sono eventi futuri, il componente non mostra nulla (o mostra un messaggio personalizzato)
- La data viene formattata automaticamente, ma puoi personalizzare il formato
