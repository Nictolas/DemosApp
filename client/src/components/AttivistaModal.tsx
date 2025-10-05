import React from 'react';
import { X, Facebook, Twitter, Instagram, Linkedin, MessageCircle, Globe, Twitch, Youtube } from 'lucide-react';

interface Attivista {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: string;
  created_at: string;
  updated_at: string;
  avatar_config: string;
  genere: string;
  data_nascita: string;
  cittadinanza: string;
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;
  facebook_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  telegram_url?: string;
  website_url?: string;
  twitch_url?: string;
  youtube_url?: string;
}

interface AttivistaModalProps {
  attivista: Attivista | null;
  isOpen: boolean;
  onClose: () => void;
}

const AttivistaModal: React.FC<AttivistaModalProps> = ({ attivista, isOpen, onClose }) => {
  if (!isOpen || !attivista) return null;

  const getInitials = (nome: string, cognome: string) => {
    return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'approved':
        return 'Approvato';
      case 'pending':
        return 'In attesa';
      case 'rejected':
        return 'Rifiutato';
      default:
        return status;
    }
  };

  const socialLinks = [
    {
      name: 'Facebook',
      url: attivista.facebook_url,
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-white'
    },
    {
      name: 'Twitter',
      url: attivista.twitter_url,
      icon: Twitter,
      color: 'bg-sky-500 hover:bg-sky-600',
      textColor: 'text-white'
    },
    {
      name: 'Instagram',
      url: attivista.instagram_url,
      icon: Instagram,
      color: 'bg-pink-600 hover:bg-pink-700',
      textColor: 'text-white'
    },
    {
      name: 'LinkedIn',
      url: attivista.linkedin_url,
      icon: Linkedin,
      color: 'bg-blue-700 hover:bg-blue-800',
      textColor: 'text-white'
    },
    {
      name: 'Telegram',
      url: attivista.telegram_url,
      icon: MessageCircle,
      color: 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-white'
    },
    {
      name: 'Website',
      url: attivista.website_url,
      icon: Globe,
      color: 'bg-gray-600 hover:bg-gray-700',
      textColor: 'text-white'
    },
    {
      name: 'Twitch',
      url: attivista.twitch_url,
      icon: Twitch,
      color: 'bg-purple-600 hover:bg-purple-700',
      textColor: 'text-white'
    },
    {
      name: 'YouTube',
      url: attivista.youtube_url,
      icon: Youtube,
      color: 'bg-red-600 hover:bg-red-700',
      textColor: 'text-white'
    }
  ].filter(link => link.url); // Filtra solo i social con URL

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Dettagli Attivista
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Avatar e Info Base */}
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                {attivista.avatar_config ? (
                  <img
                    src={attivista.avatar_config}
                    alt={`${attivista.nome} ${attivista.cognome}`}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-blue-600">
                    {getInitials(attivista.nome, attivista.cognome)}
                  </span>
                )}
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {attivista.nome} {attivista.cognome}
              </h2>
              
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(attivista.status)}`}>
                  {translateStatus(attivista.status)}
                </span>
              </div>
              
              <p className="text-sm text-gray-600">
                {attivista.regione_residenza || 'Non specificata'}
              </p>
            </div>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Social Media
                </h4>
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

            {/* Info Aggiuntive - Rimosse per semplificare il modale */}
          </div>

          {/* Footer */}
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

export default AttivistaModal;
