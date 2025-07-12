import admin from "firebase-admin";
import { google } from "googleapis";
import serviceAccount from "../serviceAccountKey.json";

// Inizializza Firebase Admin se non è già inizializzato
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Configura Google Cloud Monitoring con le credenziali del service account
const monitoring = google.monitoring('v3');
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/monitoring.read']
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'demos-finale';
    const authClient = await auth.getClient();
    
    // Recupera i consumi per i diversi servizi Firebase
    const consumi = {
      firestore: await getFirestoreUsage(authClient, projectId),
      functions: await getFunctionsUsage(authClient, projectId),
      hosting: await getHostingUsage(authClient, projectId),
      storage: await getStorageUsage(authClient, projectId),
      timestamp: new Date().toISOString()
    };

    res.status(200).json(consumi);
  } catch (error) {
    console.error('Errore nel recupero dei consumi Firebase:', error);
    res.status(500).json({ 
      error: 'Errore nel recupero dei dati',
      details: error.message 
    });
  }
}

async function getFirestoreUsage(authClient, projectId) {
  try {
    const response = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "firestore.googleapis.com/document/read_count"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Ultimi 30 giorni
        endTime: new Date().toISOString()
      }
    });

    const readCount = response.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;
    
    // Recupera anche le scritture
    const writeResponse = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "firestore.googleapis.com/document/write_count"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const writeCount = writeResponse.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;

    return {
      reads: parseInt(readCount),
      writes: parseInt(writeCount),
      total: parseInt(readCount) + parseInt(writeCount)
    };
  } catch (error) {
    console.error('Errore nel recupero dati Firestore:', error);
    return { reads: 0, writes: 0, total: 0, error: error.message };
  }
}

async function getFunctionsUsage(authClient, projectId) {
  try {
    const response = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "cloudfunctions.googleapis.com/function/execution_count"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const executionCount = response.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;

    // Recupera anche il tempo di esecuzione
    const durationResponse = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "cloudfunctions.googleapis.com/function/execution_time"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const executionTime = durationResponse.data.timeSeries?.[0]?.points?.[0]?.value?.doubleValue || 0;

    return {
      invocations: parseInt(executionCount),
      executionTime: parseFloat(executionTime),
      gbSeconds: (parseFloat(executionTime) * parseInt(executionCount)) / 1000 // Converti in GB-seconds
    };
  } catch (error) {
    console.error('Errore nel recupero dati Functions:', error);
    return { invocations: 0, executionTime: 0, gbSeconds: 0, error: error.message };
  }
}

async function getHostingUsage(authClient, projectId) {
  try {
    const response = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "firebasehosting.googleapis.com/site/requests"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const requests = response.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;

    // Recupera anche i bytes trasferiti
    const bytesResponse = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "firebasehosting.googleapis.com/site/bytes_transferred"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const bytesTransferred = bytesResponse.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;

    return {
      requests: parseInt(requests),
      bytesTransferred: parseInt(bytesTransferred),
      gbTransferred: parseInt(bytesTransferred) / (1024 * 1024 * 1024)
    };
  } catch (error) {
    console.error('Errore nel recupero dati Hosting:', error);
    return { requests: 0, bytesTransferred: 0, gbTransferred: 0, error: error.message };
  }
}

async function getStorageUsage(authClient, projectId) {
  try {
    const response = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "firebasestorage.googleapis.com/storage/object_count"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const objectCount = response.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;

    // Recupera anche i bytes utilizzati
    const bytesResponse = await monitoring.projects.timeSeries.list({
      auth: authClient,
      name: `projects/${projectId}`,
      filter: 'metric.type = "firebasestorage.googleapis.com/storage/object_bytes"',
      interval: {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    const bytesUsed = bytesResponse.data.timeSeries?.[0]?.points?.[0]?.value?.int64Value || 0;

    return {
      objectCount: parseInt(objectCount),
      bytesUsed: parseInt(bytesUsed),
      gbUsed: parseInt(bytesUsed) / (1024 * 1024 * 1024)
    };
  } catch (error) {
    console.error('Errore nel recupero dati Storage:', error);
    return { objectCount: 0, bytesUsed: 0, gbUsed: 0, error: error.message };
  }
} 