import React from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useMinisteroData } from "./hooks/useMinisteroData";
import { useMinisteroActions } from "./hooks/useMinisteroActions";
import { useConsensoGovernoData } from "../hooks/useConsensoGovernoData";
import { Header } from "./components/Header";
import { TopTen } from "./components/TopTen";
import { VotingForm } from "./components/VotingForm";
import { ConsensoGovernoSection } from "../components/ConsensoGovernoSection";
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
    setVotingState,
    updateField, 
    addNomeLocal, 
    removeLocal, 
    toggleSelezioneClassifica, 
    showClassifica, 
    saveVoti 
  } = useMinisteroActions(data);

  // Hook per i dati di consenso del governo
  const { 
    data: consensoData, 
    isLoading: isLoadingConsenso, 
    voteConsenso, 
    isVoting: isVotingConsenso 
  } = useConsensoGovernoData(user);


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
        
        {isLoading || isLoadingConsenso ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState />
        ) : (
          <div className="space-y-8">
            {/* SEZIONE CONSENSO GOVERNO */}
            {consensoData && (
              <ConsensoGovernoSection
                data={consensoData}
                onVote={voteConsenso}
                isVoting={isVotingConsenso}
              />
            )}

            {/* FORM VOTO - PRIMA SEZIONE */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorazione di sfondo */}
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '200px',
                height: '200px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%',
                zIndex: 0
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '-30px',
                left: '-30px',
                width: '150px',
                height: '150px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '50%',
                zIndex: 0
              }}></div>
              
              <div style={{position: 'relative', zIndex: 1}}>
                <h2 style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  marginBottom: '8px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  Il Tuo Voto
                </h2>
                <p style={{
                  fontSize: '16px',
                  opacity: 0.9,
                  marginBottom: '24px'
                }}>
                  Esprimi la tua preferenza per questo ministero
                </p>
                
                <div style={{position: 'relative', marginBottom: '20px'}}>
                  <form onSubmit={addNomeLocal} style={{display: 'flex', gap: '12px'}}>
                    <div style={{flex: 1, position: 'relative'}}>
                      <input
                        type="text"
                        placeholder="Inserisci il nome del candidato..."
                        value={votingState.nomeInput}
                        onChange={(e) => updateField('nomeInput', e.target.value)}
                        onClick={() => {
                          console.log('🔍 DEBUG: Input clicked!');
                        }}
                        style={{
                          width: '100%',
                          padding: '16px 20px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          fontSize: '16px',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          color: '#1e293b',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          outline: 'none',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          fontWeight: '500'
                        }}
                        onFocus={(e) => {
                          console.log('🔍 DEBUG: Input focused, setting showSuggestions to true');
                          setVotingState(prev => ({ ...prev, showSuggestions: true }));
                          e.target.style.borderColor = '#3b82f6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onBlur={(e) => {
                          console.log('🔍 DEBUG: Input blurred, keeping showSuggestions true if there is text');
                          // Non nascondere i suggerimenti se c'è del testo nell'input
                          if (!votingState.nomeInput.trim()) {
                            setVotingState(prev => ({ ...prev, showSuggestions: false }));
                          }
                          e.target.style.borderColor = '#e2e8f0';
                          e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      />
                      
                      {/* SUGGERIMENTI AUTOCOMPLETE */}
                      {console.log('🔍 DEBUG Autocomplete:', {
                        showSuggestions: votingState.showSuggestions,
                        nomeInput: votingState.nomeInput,
                        classifiche: data?.classifiche?.length
                      })}
                      
                      
                      {(votingState.showSuggestions || votingState.nomeInput.trim()) && votingState.nomeInput.trim() && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          borderRadius: '12px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          zIndex: 1000,
                          maxHeight: '200px',
                          overflowY: 'auto',
                          marginTop: '8px',
                          backdropFilter: 'blur(10px)'
                        }}>
                          {data?.classifiche
                            ?.filter(candidato => 
                              candidato.nome.toLowerCase().includes(votingState.nomeInput.toLowerCase())
                            )
                            .map((candidato, index) => (
                              <div
                                key={candidato.nome}
                                onClick={() => {
                                  updateField('nomeInput', candidato.nome);
                                  updateField('showSuggestions', false);
                                }}
                                style={{
                                  padding: '16px 20px',
                                  cursor: 'pointer',
                                  borderBottom: index < (data?.classifiche?.filter(c => 
                                    c.nome.toLowerCase().includes(votingState.nomeInput.toLowerCase())
                                  ).length || 0) - 1 ? '1px solid rgba(59, 130, 246, 0.1)' : 'none',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  borderRadius: index === 0 ? '12px 12px 0 0' : index === (data?.classifiche?.filter(c => 
                                    c.nome.toLowerCase().includes(votingState.nomeInput.toLowerCase())
                                  ).length || 0) - 1 ? '0 0 12px 12px' : '0',
                                  color: '#1e293b',
                                  fontWeight: '500',
                                  fontSize: '15px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                                  e.currentTarget.style.color = 'white';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#1e293b';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                <span style={{
                                  fontWeight: '500',
                                  color: '#2d3748',
                                  fontSize: '15px'
                                }}>
                                  {candidato.nome}
                                </span>
                                <span style={{
                                  background: '#e2e8f0',
                                  color: '#4a5568',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>
                                  {candidato.voti} {candidato.voti === 1 ? 'voto' : 'voti'}
                                </span>
                              </div>
                            ))}
                          
                          {data?.classifiche?.filter(candidato => 
                            candidato.nome.toLowerCase().includes(votingState.nomeInput.toLowerCase())
                          ).length === 0 && (
                            <div style={{
                              padding: '16px 20px',
                              textAlign: 'center',
                              color: '#718096',
                              fontSize: '14px'
                            }}>
                              Nessun candidato trovato
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      disabled={!votingState.nomeInput.trim()}
                      style={{
                        padding: '16px 24px',
                        background: votingState.nomeInput.trim() ? 'linear-gradient(45deg, #ff6b6b, #ee5a24)' : 'rgba(255,255,255,0.3)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: votingState.nomeInput.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '16px',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s ease',
                        minWidth: '120px'
                      }}
                    >
                      Aggiungi
                    </button>
                  </form>
                </div>

                {votingState.selectedVoti.length > 0 && (
                  <div style={{marginBottom: '20px'}}>
                    <h4 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      marginBottom: '12px',
                      opacity: 0.9
                    }}>
                      Candidato selezionato:
                    </h4>
                    {votingState.selectedVoti.map((nome) => (
                      <div key={nome} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        background: 'rgba(255,255,255,0.15)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        marginBottom: '8px'
                      }}>
                        <span style={{fontWeight: '600', fontSize: '16px'}}>{nome}</span>
                        <button
                          onClick={() => removeLocal(nome)}
                          style={{
                            padding: '8px 16px',
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                          onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{
                  paddingTop: '20px',
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={handleSaveVoti}
                    disabled={votingState.selectedVoti.length === 0}
                    style={{
                      padding: '16px 32px',
                      background: votingState.selectedVoti.length === 0 
                        ? 'rgba(255,255,255,0.2)' 
                        : 'linear-gradient(45deg, #00b894, #00a085)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: votingState.selectedVoti.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '18px',
                      fontWeight: '700',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s ease',
                      minWidth: '160px'
                    }}
                  >
                    Salva Voto
                  </button>
                </div>
              </div>
            </div>

            {/* TOP 10 CANDIDATI - SECONDA SEZIONE */}
            <div style={{
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '2px solid #f1f3f4'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px',
                  boxShadow: '0 4px 12px rgba(255,215,0,0.3)'
                }}>
                  <span style={{fontSize: '24px'}}>🏆</span>
                </div>
                <div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#2d3748',
                    margin: 0
                  }}>
                    Top 10 Candidati
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#718096',
                    margin: '4px 0 0 0'
                  }}>
                    Classifica aggiornata in tempo reale
                  </p>
                </div>
              </div>

              {data?.classifiche?.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#718096'
                }}>
                  <div style={{fontSize: '48px', marginBottom: '16px'}}>📊</div>
                  <p style={{fontSize: '18px', margin: 0}}>
                    Nessun voto ancora registrato per questo ministero.
                  </p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {data.classifiche.map((candidato, index) => (
                    <div key={candidato.nome} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '20px 24px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      background: index < 3 
                        ? 'linear-gradient(135deg, #fff7ed, #fed7aa)' 
                        : '#f8fafc',
                      borderColor: index < 3 ? '#fed7aa' : '#e2e8f0',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}>
                      {/* Posizione */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: index < 3 
                            ? 'linear-gradient(135deg, #ffd700, #ffed4e)' 
                            : 'linear-gradient(135deg, #667eea, #764ba2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '700',
                          fontSize: '16px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}>
                          {index + 1}
                        </div>
                        <span style={{
                          fontWeight: '600',
                          fontSize: '18px',
                          color: '#2d3748'
                        }}>
                          {candidato.nome}
                        </span>
                      </div>
                      
                      {/* Voti */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{
                          background: index < 3 
                            ? 'linear-gradient(135deg, #ff6b6b, #ee5a24)' 
                            : 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: '600',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          {candidato.voti} {candidato.voti === 1 ? 'voto' : 'voti'}
                        </span>
                        {index < 3 && (
                          <span style={{fontSize: '20px'}}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
