import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
// import '../services/auth_service.dart'; // Adatta al tuo servizio auth

class BachecaPage extends StatefulWidget {
  @override
  _BachecaPageState createState() => _BachecaPageState();
}

class _BachecaPageState extends State<BachecaPage> {
  bool _isLoading = true;
  Map<String, dynamic>? _dati;
  String? _error;

  @override
  void initState() {
    super.initState();
    _caricaDatiBacheca();
  }

  Future<void> _caricaDatiBacheca() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // TODO: Sostituisci con il tuo metodo per ottenere il token
      // final token = await AuthService.getToken();
      final token = 'YOUR_TOKEN_HERE'; // Sostituisci con il token reale
      
      final response = await http.get(
        Uri.parse('https://api.demos.community/api/bacheca'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] && data['data'] != null) {
          setState(() {
            _dati = data['data'];
            _isLoading = false;
          });
        } else {
          setState(() {
            _error = 'Nessun dato disponibile';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Bacheca'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _caricaDatiBacheca,
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
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 32),
                        child: Text(
                          _error!,
                          style: TextStyle(fontSize: 16),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _caricaDatiBacheca,
                        child: Text('Riprova'),
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
                        'Bacheca',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      
                      SizedBox(height: 24),
                      
                      // Sezione Notifiche Recenti
                      if (_dati?['notifiche_recenti'] != null)
                        _buildSezione(
                          '🔔 Notifiche Recenti',
                          _dati!['notifiche_recenti'],
                          _buildNotificaCard,
                        ),
                      
                      SizedBox(height: 24),
                      
                      // Sezione Votazioni Recenti
                      if (_dati?['votazioni_recenti'] != null)
                        _buildSezione(
                          '📊 Votazioni Recenti',
                          _dati!['votazioni_recenti'],
                          _buildVotazioneCard,
                        ),
                      
                      SizedBox(height: 24),
                      
                      // Sezione Eventi
                      if (_dati?['eventi'] != null)
                        _buildSezione(
                          '📅 Eventi',
                          _dati!['eventi'],
                          _buildEventoCard,
                        ),
                      
                      SizedBox(height: 24),
                      
                      // Sezione Attività
                      if (_dati?['attivita'] != null)
                        _buildSezione(
                          '⚡ Attività Recenti',
                          _dati!['attivita'],
                          _buildAttivitaCard,
                        ),
                      
                      // Messaggio se non ci sono dati
                      if ((_dati?['notifiche_recenti'] == null || 
                           (_dati!['notifiche_recenti'] as List).isEmpty) &&
                          (_dati?['votazioni_recenti'] == null || 
                           (_dati!['votazioni_recenti'] as List).isEmpty) &&
                          (_dati?['eventi'] == null || 
                           (_dati!['eventi'] as List).isEmpty) &&
                          (_dati?['attivita'] == null || 
                           (_dati!['attivita'] as List).isEmpty))
                        Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.dashboard_outlined, size: 64, color: Colors.grey),
                              SizedBox(height: 16),
                              Text(
                                'Nessun contenuto disponibile',
                                style: TextStyle(fontSize: 16, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildSezione(String titolo, dynamic items, Widget Function(dynamic) builder) {
    if (items == null || (items is List && items.isEmpty)) {
      return SizedBox.shrink();
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          titolo,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: 12),
        ...(items as List).map((item) => Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: builder(item),
        )).toList(),
      ],
    );
  }

  Widget _buildNotificaCard(dynamic notifica) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.notifications, color: Colors.blue),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notifica['titolo'] ?? 'Notifica',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (notifica['messaggio'] != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        notifica['messaggio'],
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey[700],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  if (notifica['data'] != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        _formattaData(notifica['data']),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVotazioneCard(dynamic votazione) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.how_to_vote, color: Colors.green),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    votazione['descrizione'] ?? 'Votazione',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            SizedBox(height: 8),
            if (votazione['camera'] != null)
              Text(
                '${votazione['camera']}',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[700],
                ),
              ),
            if (votazione['data_votazione'] != null)
              Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text(
                  _formattaData(votazione['data_votazione']),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildEventoCard(dynamic evento) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.event, color: Colors.orange),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    evento['titolo'] ?? 'Evento',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (evento['descrizione'] != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        evento['descrizione'],
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey[700],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  if (evento['data'] != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        _formattaData(evento['data']),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttivitaCard(dynamic attivita) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.trending_up, color: Colors.purple),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    attivita['tipo'] ?? 'Attività',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (attivita['descrizione'] != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        attivita['descrizione'],
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey[700],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  if (attivita['data'] != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        _formattaData(attivita['data']),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
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
}
