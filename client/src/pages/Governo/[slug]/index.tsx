import React from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useMinisteroData } from "./hooks/useMinisteroData";
import { useMinisteroActions } from "./hooks/useMinisteroActions";
import { Header } from "./components/Header";
import { TopTen } from "./components/TopTen";
import { VotingForm } from "./components/VotingForm";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { ministeri } from "../constants/ministeri";

export default function MinisteroPage() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  
  // Trova il ministero corrispondente
  const ministero = ministeri.find(m => m.slug === slug);
  
  const { data, isLoading, isError, saveVotiMutation } = useMinisteroData(user, ministero?.categoria);
  const { 
    votingState, 
    updateField, 
    addNomeLocal, 
    removeLocal, 
    toggleSelezioneClassifica, 
    showClassifica, 
    saveVoti 
  } = useMinisteroActions(data);


  const handleSaveVoti = () => {
    saveVotiMutation.mutate(votingState.selectedVoti, {
      onSuccess: () => {
        saveVoti();
      }
    });
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!ministero) {
    return <Redirect to="/governo" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Header ministero={ministero} unlockDate={data?.blocco.unlockDate} />
        
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState />
        ) : (
          <div className="space-y-6">
            {/* TEST HTML NATIVO */}
            <div style={{backgroundColor: 'red', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <h2 style={{fontSize: '24px', fontWeight: 'bold'}}>TEST HTML NATIVO</h2>
              <p>Se vedi questo, il rendering funziona!</p>
              <p>Classifiche: {data?.classifiche?.length || 0}</p>
              <p>Miei voti: {data?.mieiVoti?.length || 0}</p>
              <p>Blocco: {data?.blocco?.isBlocked ? 'Sì' : 'No'}</p>
            </div>

            {/* TOP 10 HTML NATIVO */}
            <div style={{backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
              <h2 style={{fontSize: '20px', fontWeight: 'bold', marginBottom: '16px'}}>Top 10 Candidati</h2>
              {data?.classifiche?.length === 0 ? (
                <p>Nessun voto ancora registrato per questo ministero.</p>
              ) : (
                <div>
                  {data.classifiche.map((candidato, index) => (
                    <div key={candidato.nome} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      backgroundColor: index < 3 ? '#fef3c7' : '#f3f4f6'
                    }}>
                      <span style={{fontWeight: '500'}}>
                        {index + 1}. {candidato.nome}
                      </span>
                      <span style={{
                        backgroundColor: '#dbeafe',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}>
                        {candidato.voti} voti
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM VOTO HTML NATIVO */}
            <div style={{backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
              <h2 style={{fontSize: '20px', fontWeight: 'bold', marginBottom: '16px'}}>I Tuoi Voti</h2>
              <form onSubmit={addNomeLocal} style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                <input
                  type="text"
                  placeholder="Inserisci il nome del candidato..."
                  value={votingState.nomeInput}
                  onChange={(e) => updateField('nomeInput', e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px'
                  }}
                />
                <button
                  type="submit"
                  disabled={!votingState.nomeInput.trim()}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Aggiungi
                </button>
              </form>

              {votingState.selectedVoti.length > 0 && (
                <div>
                  <h4 style={{fontSize: '16px', fontWeight: '500', marginBottom: '8px'}}>Candidati selezionati:</h4>
                  {votingState.selectedVoti.map((nome) => (
                    <div key={nome} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      marginBottom: '8px'
                    }}>
                      <span style={{fontWeight: '500'}}>{nome}</span>
                      <button
                        onClick={() => removeLocal(nome)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb'}}>
                <button
                  onClick={handleSaveVoti}
                  disabled={votingState.selectedVoti.length === 0}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: votingState.selectedVoti.length === 0 ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: votingState.selectedVoti.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Salva Voti
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
