import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { GeographicSelects } from './GeographicSelects';
import { NavigationButtons } from './NavigationButtons';
import { useRegistrationForm } from '../hooks/useRegistrationForm';

const genereOptions = [
  { id: 'Uomo', nome: 'Uomo' },
  { id: 'Donna', nome: 'Donna' },
  { id: 'Altro', nome: 'Altro' }
];

const cittadinanzaOptions = [
  { id: 'italiana', nome: 'Italiana' },
  { id: 'straniera', nome: 'Straniera' }
];

export const RegistrationForm: React.FC = () => {
  const [, navigate] = useLocation();
  const {
    formState,
    formActions,
    submitForm,
    getProvinceByRegione,
    getComuniByProvincia
  } = useRegistrationForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  const handlePrevious = () => {
    // Navigazione alla pagina precedente usando wouter invece di history.back()
    navigate('/registrazione-nome');
  };

  const handleNext = async () => {
    // Salva i dati nel localStorage e naviga alla pagina del ruolo
    const data = formState.data;
    Object.entries(data).forEach(([key, value]) => {
      if (value) {
        localStorage.setItem(`registrazione_${key}`, value);
      }
    });
    
    // Salva anche i dati geografici
    if (formState.selectedRegione) localStorage.setItem('registrazione_regione', formState.selectedRegione);
    if (formState.selectedProvincia) localStorage.setItem('registrazione_provincia', formState.selectedProvincia);
    if (formState.selectedComune) localStorage.setItem('registrazione_comune', formState.selectedComune);
    
    navigate('/registrazione-ruolo');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Registrazione - Dati Personali
            </CardTitle>
            <CardDescription className="text-center">
              Completa i tuoi dati personali per continuare la registrazione
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sezione Dati Personali */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Dati Personali
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Nome"
                    name="nome"
                    value={formState.data.nome}
                    onChange={(value) => formActions.setData({ nome: value })}
                    error={formState.errors.nome}
                    placeholder="Inserisci il tuo nome"
                    required
                  />
                  
                  <FormField
                    label="Cognome"
                    name="cognome"
                    value={formState.data.cognome}
                    onChange={(value) => formActions.setData({ cognome: value })}
                    error={formState.errors.cognome}
                    placeholder="Inserisci il tuo cognome"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField
                    label="Genere"
                    name="genere"
                    value={formState.data.genere}
                    onChange={(value) => formActions.setData({ genere: value })}
                    options={genereOptions}
                    error={formState.errors.genere}
                    required
                  />
                  
                  <SelectField
                    label="Cittadinanza"
                    name="cittadinanza"
                    value={formState.data.cittadinanza}
                    onChange={(value) => formActions.setData({ cittadinanza: value })}
                    options={cittadinanzaOptions}
                    error={formState.errors.cittadinanza}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Data di Nascita"
                    name="dataNascita"
                    type="date"
                    value={formState.data.dataNascita}
                    onChange={(value) => formActions.setData({ dataNascita: value })}
                    error={formState.errors.dataNascita}
                    required
                  />
                </div>
              </div>

              {/* Sezione Dati di Residenza */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Dati di Residenza
                </h3>
                
                <FormField
                  label="Indirizzo"
                  name="indirizzo"
                  value={formState.data.indirizzo}
                  onChange={(value) => formActions.setData({ indirizzo: value })}
                  error={formState.errors.indirizzo}
                  placeholder="Via, numero civico, città"
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="CAP"
                    name="cap"
                    value={formState.data.cap}
                    onChange={(value) => formActions.setData({ cap: value })}
                    error={formState.errors.cap}
                    placeholder="12345"
                    required
                  />
                  
                  <FormField
                    label="Telefono"
                    name="telefono"
                    type="tel"
                    value={formState.data.telefono}
                    onChange={(value) => formActions.setData({ telefono: value })}
                    error={formState.errors.telefono}
                    placeholder="+39 123 456 7890"
                    required
                  />
                </div>

                <GeographicSelects
                  geographicData={formState.geographicData}
                  selectedRegione={formState.selectedRegione}
                  selectedProvincia={formState.selectedProvincia}
                  selectedComune={formState.selectedComune}
                  onRegioneChange={formActions.setSelectedRegione}
                  onProvinciaChange={formActions.setSelectedProvincia}
                  onComuneChange={formActions.setSelectedComune}
                  regioneError={formState.errors.regione}
                  provinciaError={formState.errors.provincia}
                  comuneError={formState.errors.comune}
                  getProvinceByRegione={getProvinceByRegione}
                  getComuniByProvincia={getComuniByProvincia}
                />
              </div>

              {/* Sezione Contatti */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Contatti
                </h3>
                
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  value={formState.data.email}
                  onChange={(value) => formActions.setData({ email: value })}
                  error={formState.errors.email}
                  placeholder="nome@esempio.com"
                  required
                />
              </div>

              <NavigationButtons
                onPrevious={handlePrevious}
                onNext={handleNext}
                isSubmitting={formState.isSubmitting}
                canProceed={true}
                nextText="Continua"
              />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
