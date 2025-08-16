import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/lib/api-config';

const API_BASE_URL = API_CONFIG.BASE_URL;

// Hook per gestire il database tramite API
export const useDatabase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Funzione generica per eseguire chiamate API
  const executeApiCall = useCallback(async <T>(
    endpoint: string
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore API');
      }
      
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore API sconosciuto';
      setError(errorMessage);
      console.error('Errore API:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    executeApiCall
  };
};

// Hook per gli utenti
export const useUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento utenti');
      }
      
      setUsers(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento utenti';
      setError(errorMessage);
      console.error('Errore caricamento utenti:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserById = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${id}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento utente');
      }
      
      return result.data;
    } catch (err) {
      console.error('Errore caricamento utente:', err);
      return null;
    }
  }, []);

  return {
    users,
    loading,
    error,
    fetchUsers,
    getUserById
  };
};

// Hook per le opinioni
export const useOpinions = () => {
  const [opinions, setOpinions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpinions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/opinions`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento opinioni');
      }
      
      setOpinions(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento opinioni';
      setError(errorMessage);
      console.error('Errore caricamento opinioni:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getOpinionById = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/opinions/${id}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento opinione');
      }
      
      return result.data;
    } catch (err) {
      console.error('Errore caricamento opinione:', err);
      return null;
    }
  }, []);

  return {
    opinions,
    loading,
    error,
    fetchOpinions,
    getOpinionById
  };
};

// Hook per i voti
export const useVotes = () => {
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVotes = useCallback(async (type: 'capo-stato' | 'ministri' | 'amnistia' | 'grazia') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/votes/${type}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento voti');
      }
      
      setVotes(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento voti';
      setError(errorMessage);
      console.error('Errore caricamento voti:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    votes,
    loading,
    error,
    fetchVotes
  };
};

// Hook per le iniziative
export const useInitiatives = () => {
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInitiatives = useCallback(async (type: 'popolari' | 'ice' | 'referendum') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/initiatives/${type}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento iniziative');
      }
      
      setInitiatives(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento iniziative';
      setError(errorMessage);
      console.error('Errore caricamento iniziative:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    initiatives,
    loading,
    error,
    fetchInitiatives
  };
};

// Hook per le elezioni
export const useElections = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchElections = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/elections`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento elezioni');
      }
      
      setElections(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento elezioni';
      setError(errorMessage);
      console.error('Errore caricamento elezioni:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    elections,
    loading,
    error,
    fetchElections
  };
};

// Hook per i ministeri
export const useMinistries = () => {
  const [ministries, setMinistries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMinistries = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/ministries`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento ministeri');
      }
      
      setMinistries(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento ministeri';
      setError(errorMessage);
      console.error('Errore caricamento ministeri:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    ministries,
    loading,
    error,
    fetchMinistries
  };
};

// Hook per le notifiche
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserNotifications = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/user/${userId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento notifiche');
      }
      
      setNotifications(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento notifiche';
      setError(errorMessage);
      console.error('Errore caricamento notifiche:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/admin`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento notifiche admin');
      }
      
      setNotifications(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento notifiche admin';
      setError(errorMessage);
      console.error('Errore caricamento notifiche admin:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    notifications,
    loading,
    error,
    fetchUserNotifications,
    fetchAdminNotifications
  };
};

// Hook per le statistiche
export const useStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore caricamento statistiche');
      }
      
      setStats(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento statistiche';
      setError(errorMessage);
      console.error('Errore caricamento statistiche:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    fetchStats
  };
};
