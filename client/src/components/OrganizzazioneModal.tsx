import React from 'react';
import { X, Facebook, Twitter, Instagram, Linkedin, MessageCircle, Globe, Twitch, Youtube } from 'lucide-react';
import { CustomAvatar } from '@/components/avatar/CustomAvatar';

interface TipologiaAttivismo {
  tipo: string;
  emoji: string;
  nome: string;
  descrizione?: string;
  colore?: string;
}

interface Organizzazione {
  id: string;
  nome: string;
  cognome?: string; // usato come Codice 5x1000 lato UI
  email: string;
  ruolo: string;
  status: string;
  created_at: string;
  updated_at: string;
  avatar_config?: string;
  regione_residenza?: string;
  facebook_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  telegram_url?: string;
  website_url?: string;
  twitch_url?: string;
  youtube_url?: string;
  tipologie_attivismo?: TipologiaAttivismo[];
}

interface OrganizzazioneModalProps {
  organizzazione: Organizzazione | null;
  isOpen: boolean;
  onClose: () => void;
}

const OrganizzazioneModal: React.FC<OrganizzazioneModalProps> = ({ organizzazione, isOpen, onClose }) => {
  if (!isOpen || !organizzazione) return null;

  const getInitials = (nome: string) => {
    return `${nome.charAt(0)}`.toUpperCase();
  };

  // Mappa locale codici → nomi regione per UI
  const REGIONI_DB_TO_FRONTEND: Record<string, string> = {
    LO: 'Lombardia',
    LA: 'Lazio',
    TO: 'Toscana',
    PI: 'Piemonte',
    VE: 'Veneto',
    EM: 'Emilia-Romagna',
    LI: 'Liguria',
    UM: 'Umbria',
    MA: 'Marche',
    AB: 'Abruzzo',
    MO: 'Molise',
    CM: 'Campania',
    PU: 'Puglia',
    BA: 'Basilicata',
    CA: 'Calabria',
    SI: 'Sicilia',
    SA: 'Sardegna',
    TR: 'Trentino-Alto Adige',
    FR: 'Friuli-Venezia Giulia',
    VA: 'Valle d\'Aosta'
  };

  const decompressRegioneLocal = (value?: string) => {
    if (!value) return undefined;
    const v = value.trim();
    return REGIONI_DB_TO_FRONTEND[v] || v; // fallback: mostra com'è
  };

  const socialLinks = [
    { name: 'Facebook', url: organizzazione.facebook_url, icon: Facebook, color: 'bg-blue-600 hover:bg-blue-700', textColor: 'text-white' },
    { name: 'Twitter', url: organizzazione.twitter_url, icon: Twitter, color: 'bg-sky-500 hover:bg-sky-600', textColor: 'text-white' },
    { name: 'Instagram', url: organizzazione.instagram_url, icon: Instagram, color: 'bg-pink-600 hover:bg-pink-700', textColor: 'text-white' },
    { name: 'LinkedIn', url: organizzazione.linkedin_url, icon: Linkedin, color: 'bg-blue-700 hover:bg-blue-800', textColor: 'text-white' },
    { name: 'Telegram', url: organizzazione.telegram_url, icon: MessageCircle, color: 'bg-blue-500 hover:bg-blue-600', textColor: 'text-white' },
    { name: 'Website', url: organizzazione.website_url, icon: Globe, color: 'bg-gray-600 hover:bg-gray-700', textColor: 'text-white' },
    { name: 'Twitch', url: organizzazione.twitch_url, icon: Twitch, color: 'bg-purple-600 hover:bg-purple-700', textColor: 'text-white' },
    { name: 'YouTube', url: organizzazione.youtube_url, icon: Youtube, color: 'bg-red-600 hover:bg-red-700', textColor: 'text-white' }
  ].filter(link => link.url);

  // Parsing robusto di avatar_config (gestisce doppia serializzazione)
  const parseAvatarConfig = (config?: string) => {
    if (!config) return null;
    try {
      let parsed: any = typeof config === 'string' ? JSON.parse(config) : config;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="organizzazione-modal-title" className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 id="organizzazione-modal-title" className="text-lg font-semibold text-white">Dettagli Organizzazione</h3>
              <button type="button" onClick={onClose} aria-label="Chiudi dettagli organizzazione" className="h-11 w-11 inline-flex items-center justify-center rounded-full text-white hover:text-gray-200 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{organizzazione.nome}</h2>
              {organizzazione.cognome && (
                <p className="text-sm text-gray-600">Codice 5x1000: {organizzazione.cognome}</p>
              )}
              {organizzazione.regione_residenza && (
                <p className="text-sm text-gray-600 mt-1">{decompressRegioneLocal(organizzazione.regione_residenza)}</p>
              )}
            </div>

            {organizzazione.tipologie_attivismo && organizzazione.tipologie_attivismo.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Ambiti</h4>
                <div className="flex flex-wrap gap-2">
                  {organizzazione.tipologie_attivismo.map((tipologia) => (
                    <div
                      key={tipologia.tipo}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg"
                      style={{ backgroundColor: tipologia.colore ? `${tipologia.colore}20` : undefined }}
                    >
                      <span className="text-lg">{tipologia.emoji}</span>
                      <span className="text-sm font-medium text-gray-700">{tipologia.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {socialLinks.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Social Media</h4>
                <div className="grid grid-cols-2 gap-3">
                  {socialLinks.map((social) => {
                    const IconComponent = social.icon;
                    return (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${social.color} ${social.textColor} transition-colors hover:shadow-md`}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="text-sm font-medium">{social.name}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizzazioneModal;


