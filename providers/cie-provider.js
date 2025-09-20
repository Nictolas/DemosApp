/**
 * Provider CIE (Carta d'Identità Elettronica) per Auth.js
 * 
 * Questo provider implementa l'autenticazione tramite CIE utilizzando
 * il protocollo OIDC (OpenID Connect) come specificato dall'AgID.
 */

function CIEProvider(options = {}) {
  return {
    id: 'cie',
    name: 'CIE - Carta d\'Identità Elettronica',
    type: 'oauth',
    version: '2.0',
    
    // Configurazione OIDC per CIE
    authorization: {
      url: process.env.CIE_AUTHORIZATION_URL || 'https://cie-provider-url/oauth/authorize',
      params: {
        scope: 'openid profile email',
        response_type: 'code',
        client_id: process.env.CIE_CLIENT_ID,
        redirect_uri: process.env.CIE_REDIRECT_URI,
        // Parametri specifici per CIE
        acr_values: 'https://www.spid.gov.it/SpidL1',
        prompt: 'consent',
      }
    },
    
    token: {
      url: process.env.CIE_TOKEN_URL || 'https://cie-provider-url/oauth/token',
      async request({ client, params, checks, provider }) {
        const response = await client.oauthCallback(provider.callbackUrl, params, checks, {
          exchangeBody: {
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
            grant_type: 'authorization_code',
            code: params.code,
            redirect_uri: provider.callbackUrl,
          }
        });
        
        return { tokens: response };
      }
    },
    
    userinfo: {
      url: process.env.CIE_USERINFO_URL || 'https://cie-provider-url/userinfo',
      async request({ client, tokens, provider }) {
        const response = await client.userinfo(tokens, {
          // Headers specifici per CIE
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Accept': 'application/json',
          }
        });
        
        return response;
      }
    },
    
    // Mappatura dei dati utente da CIE
    profile(profile) {
      return {
        id: profile.sub || profile.fiscal_number,
        name: `${profile.given_name || ''} ${profile.family_name || ''}`.trim(),
        email: profile.email,
        image: profile.picture,
        // Dati specifici CIE
        codice_fiscale: profile.fiscal_number,
        nome: profile.given_name,
        cognome: profile.family_name,
        data_nascita: profile.birthdate,
        sesso: profile.gender,
        luogo_nascita: profile.birthplace,
        // Verifica che l'utente sia autenticato tramite CIE
        auth_method: 'cie',
        verified: true, // CIE è sempre verificato
      };
    },
    
    // Configurazione client
    clientId: process.env.CIE_CLIENT_ID,
    clientSecret: process.env.CIE_CLIENT_SECRET,
    
    // URL di callback
    callbackUrl: process.env.CIE_CALLBACK_URL || `${process.env.NEXTAUTH_URL}/api/auth/callback/cie`,
    
    // Stile del pulsante di login
    style: {
      logo: '/icons/cie-logo.svg',
      bg: '#0066CC',
      text: '#FFFFFF',
    },
    
    // Opzioni aggiuntive
    ...options,
  };
}

module.exports = { CIEProvider };
