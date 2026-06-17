import React, { useState, useEffect } from 'react';
import { useDatabase, useUsers, useOpinions, useVotes, useStats } from '../hooks/useDatabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { API_CONFIG } from '@/lib/api-config';

const DatabaseTest: React.FC = () => {
  const { loading, error, executeApiCall } = useDatabase();
  const { users, fetchUsers } = useUsers();
  const { opinions, fetchOpinions } = useOpinions();
  const { votes, fetchVotes } = useVotes();
  const { stats, fetchStats } = useStats();
  
  const [testResults, setTestResults] = useState<any>({});

  // Test connessione database
  const testConnection = async () => {
    const result = await executeApiCall('/candidati');
    setTestResults(prev => ({ ...prev, connection: result }));
  };

  // Test conteggio record
  const testRecordCounts = async () => {
    const result = await executeApiCall('/stats');
    setTestResults(prev => ({ ...prev, counts: result }));
  };

  useEffect(() => {
    // Esegui test automatici al caricamento
    testConnection();
    testRecordCounts();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🗄️ Test Database Supabase via API
            <Badge variant={error ? "destructive" : "default"}>
              {error ? "Errore" : "Connesso"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button 
              onClick={testConnection}
              disabled={loading}
              variant="outline"
            >
              🔗 Test Connessione
            </Button>
            
            <Button 
              onClick={testRecordCounts}
              disabled={loading}
              variant="outline"
            >
              📊 Conta Record
            </Button>
            
            <Button 
              onClick={fetchStats}
              disabled={loading}
              variant="outline"
            >
              📈 Carica Statistiche
            </Button>
          </div>
          
          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Caricamento...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risultati Test Connessione */}
      {testResults.connection && (
        <Card>
          <CardHeader>
            <CardTitle>🔗 Test Connessione</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Ora corrente:</strong> {testResults.connection.current_time}</p>
              <p><strong>Versione PostgreSQL:</strong> {testResults.connection.postgres_version}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risultati Conteggio Record */}
      {testResults.counts && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Conteggio Record</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(testResults.counts).map(([table, count]) => (
                <div key={table} className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{count}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {table.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiche API */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>📈 Statistiche Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(stats).map(([table, count]) => (
                <div key={table} className="text-center p-3 border rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-primary">{count}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {table.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Hook Utenti */}
      <Card>
        <CardHeader>
          <CardTitle>👥 Test Hook Utenti</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchUsers} disabled={loading} variant="outline" className="mb-4">
            Carica Utenti
          </Button>
          
          {users.length > 0 && (
            <div className="space-y-2">
              <p><strong>Utenti caricati:</strong> {users.length}</p>
              <div className="max-h-40 overflow-y-auto">
                {users.slice(0, 5).map((user: any) => (
                  <div key={user.id} className="text-sm p-2 border rounded">
                    {user.nome} {user.cognome} ({user.email})
                  </div>
                ))}
                {users.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... e altri {users.length - 5} utenti
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Hook Opinion */}
      <Card>
        <CardHeader>
          <CardTitle>💭 Test Hook Opinion</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchOpinions} disabled={loading} variant="outline" className="mb-4">
            Carica Opinion
          </Button>
          
          {opinions.length > 0 && (
            <div className="space-y-2">
              <p><strong>Opinion caricate:</strong> {opinions.length}</p>
              <div className="max-h-40 overflow-y-auto">
                {opinions.slice(0, 3).map((opinion: any) => (
                  <div key={opinion.id} className="text-sm p-2 border rounded">
                    {opinion.titolo || opinion.text?.substring(0, 50)}...
                  </div>
                ))}
                {opinions.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    ... e altre {opinions.length - 3} opinion
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Hook Voti */}
      <Card>
        <CardHeader>
          <CardTitle>🗳️ Test Hook Voti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Button 
              onClick={() => fetchVotes('capo-stato')} 
              disabled={loading} 
              variant="outline"
              size="sm"
            >
              Capo Stato
            </Button>
            <Button 
              onClick={() => fetchVotes('ministri')} 
              disabled={loading} 
              variant="outline"
              size="sm"
            >
              Ministri
            </Button>
            <Button 
              onClick={() => fetchVotes('amnistia')} 
              disabled={loading} 
              variant="outline"
              size="sm"
            >
              Amnistia
            </Button>
            <Button 
              onClick={() => fetchVotes('grazia')} 
              disabled={loading} 
              variant="outline"
              size="sm"
            >
              Grazia
            </Button>
          </div>
          
          {votes.length > 0 && (
            <div className="space-y-2">
              <p><strong>Voti caricati:</strong> {votes.length}</p>
              <div className="max-h-40 overflow-y-auto">
                {votes.slice(0, 3).map((vote: any) => (
                  <div key={vote.id} className="text-sm p-2 border rounded">
                    Voto: {vote.nome || vote.userId} - {new Date(vote.timestamp).toLocaleDateString()}
                  </div>
                ))}
                {votes.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    ... e altri {votes.length - 3} voti
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informazioni API */}
      <Card>
        <CardHeader>
          <CardTitle>🌐 Informazioni API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Base URL:</strong> {API_CONFIG.BASE_URL}</p>
            <p><strong>Endpoints disponibili:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code>/candidati</code> - Test connessione</li>
              <li><code>/users</code> - Lista utenti</li>
              <li><code>/opinions</code> - Lista opinioni</li>
              <li><code>/votes/capo-stato</code> - Voti capo stato</li>
              <li><code>/votes/ministri</code> - Voti ministri</li>
              <li><code>/votes/amnistia</code> - Voti amnistia</li>
              <li><code>/votes/grazia</code> - Voti grazia</li>
              <li><code>/initiatives/popolari</code> - Iniziative popolari</li>
              <li><code>/initiatives/ice</code> - ICE</li>
              <li><code>/initiatives/referendum</code> - Referendum</li>
              <li><code>/elections</code> - Elezioni</li>
              <li><code>/ministries</code> - Ministeri</li>
              <li><code>/stats</code> - Statistiche complete</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseTest;
