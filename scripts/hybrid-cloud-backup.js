/**
 * Soluzione Ibrida: Backup Automatico Cloud + Export Manuale Hard Disk
 * 
 * Funzionamento:
 * 1. Backup automatico giornaliero su cloud storage gratuito
 * 2. Monitora dimensione totale
 * 3. Quando raggiunge 5GB, notifica per export manuale su hard disk
 * 4. Dopo export, rimuove dati dal cloud
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

// Configurazione soluzione ibrida
const HYBRID_CONFIG = {
  // Cloud storage provider
  cloudProvider: process.env.CLOUD_STORAGE_PROVIDER || 'b2', // 'b2', 's3', 'gcs'
  
  // Soglia per export manuale (in GB)
  exportThresholdGB: parseFloat(process.env.EXPORT_THRESHOLD_GB || '5'),
  
  // Compressione (riduzione ~70%)
  compressionRatio: 0.3,
  
  // Directory cloud (bucket/key)
  cloudBucket: process.env.CLOUD_BUCKET || 'demosapp-log-archive',
  cloudPrefix: process.env.CLOUD_PREFIX || 'logs',
  
  // Directory locale per export
  exportDir: process.env.EXPORT_DIR || '/mnt/external-drive/archivio',
  
  // Retention in database (giorni)
  retentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
  
  // Notifiche
  notifyEmail: process.env.NOTIFY_EMAIL,
  notifyEnabled: process.env.NOTIFY_ENABLED === 'true'
};

/**
 * Calcola dimensione totale log su cloud
 */
async function getCloudStorageSize() {
  try {
    switch (HYBRID_CONFIG.cloudProvider) {
      case 'b2':
        // Backblaze B2
        const b2List = await execAsync(`b2 ls --json ${HYBRID_CONFIG.cloudBucket} ${HYBRID_CONFIG.cloudPrefix}/`);
        const b2Files = JSON.parse(`[${b2List.stdout.trim().replace(/\n/g, ',')}]`);
        const b2Size = b2Files.reduce((sum, file) => sum + (file.size || 0), 0);
        return { sizeBytes: b2Size, sizeGB: b2Size / 1024 / 1024 / 1024, fileCount: b2Files.length };
        
      case 's3':
        // AWS S3
        const s3List = await execAsync(`aws s3 ls s3://${HYBRID_CONFIG.cloudBucket}/${HYBRID_CONFIG.cloudPrefix}/ --recursive --summarize`);
        const s3Match = s3List.stdout.match(/Total Size:\s+(\d+)/);
        const s3Size = s3Match ? parseInt(s3Match[1]) : 0;
        const s3Count = (s3List.stdout.match(/^\d{4}-\d{2}-\d{2}/gm) || []).length;
        return { sizeBytes: s3Size, sizeGB: s3Size / 1024 / 1024 / 1024, fileCount: s3Count };
        
      case 'gcs':
        // Google Cloud Storage
        const gcsList = await execAsync(`gsutil du -s gs://${HYBRID_CONFIG.cloudBucket}/${HYBRID_CONFIG.cloudPrefix}/`);
        const gcsSize = parseInt(gcsList.stdout.split(/\s+/)[0]) || 0;
        return { sizeBytes: gcsSize, sizeGB: gcsSize / 1024 / 1024 / 1024, fileCount: 0 };
        
      default:
        return { sizeBytes: 0, sizeGB: 0, fileCount: 0 };
    }
  } catch (error) {
    console.error('❌ Errore calcolo dimensione cloud:', error.message);
    return { sizeBytes: 0, sizeGB: 0, fileCount: 0 };
  }
}

/**
 * Esporta log dal database per backup cloud
 */
async function exportLogsForCloud() {
  console.log('📦 Esportazione log per backup cloud...');
  
  const { anonymizeRecords } = require('./gdpr-utils');
  
  const currentDate = new Date();
  const dateStr = currentDate.toISOString().split('T')[0];
  const timestamp = currentDate.toISOString().replace(/[:.]/g, '-');
  
  // Crea directory temporanea
  const tempDir = path.join(__dirname, '../temp', `export-${timestamp}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  const exports = {};
  
  // Export centralized_logs (ultimi 30 giorni)
  try {
    const query = `
      SELECT *
      FROM centralized_logs
      WHERE created_at >= NOW() - INTERVAL '${HYBRID_CONFIG.retentionDays} days'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length > 0) {
      // Anonimizza per GDPR
      const anonymized = anonymizeRecords(result.rows, 'centralized_logs');
      
      // Converti in JSON
      const filename = `centralized_logs_${dateStr}.json`;
      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, JSON.stringify(anonymized, null, 2));
      
      // Comprimi
      const zlib = require('zlib');
      const { promisify } = require('util');
      const gzip = promisify(zlib.gzip);
      const compressed = await gzip(await fs.readFile(filepath));
      
      const compressedFilename = filename + '.gz';
      const compressedFilepath = path.join(tempDir, compressedFilename);
      await fs.writeFile(compressedFilepath, compressed);
      
      // Rimuovi file non compresso
      await fs.unlink(filepath);
      
      exports.centralized_logs = {
        filename: compressedFilename,
        filepath: compressedFilepath,
        records: anonymized.length,
        sizeBytes: compressed.length
      };
      
      console.log(`   ✅ centralized_logs: ${anonymized.length} record, ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
    }
  } catch (error) {
    console.error('   ⚠️ Errore export centralized_logs:', error.message);
  }
  
  // Export audit_logs (ultimi 30 giorni)
  try {
    const query = `
      SELECT *
      FROM audit_logs_decompressed
      WHERE created_at >= NOW() - INTERVAL '${HYBRID_CONFIG.retentionDays} days'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length > 0) {
      // Anonimizza per GDPR
      const anonymized = anonymizeRecords(result.rows, 'audit_logs');
      
      // Converti in JSON
      const filename = `audit_logs_${dateStr}.json`;
      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, JSON.stringify(anonymized, null, 2));
      
      // Comprimi
      const zlib = require('zlib');
      const { promisify } = require('util');
      const gzip = promisify(zlib.gzip);
      const compressed = await gzip(await fs.readFile(filepath));
      
      const compressedFilename = filename + '.gz';
      const compressedFilepath = path.join(tempDir, compressedFilename);
      await fs.writeFile(compressedFilepath, compressed);
      
      // Rimuovi file non compresso
      await fs.unlink(filepath);
      
      exports.audit_logs = {
        filename: compressedFilename,
        filepath: compressedFilepath,
        records: anonymized.length,
        sizeBytes: compressed.length
      };
      
      console.log(`   ✅ audit_logs: ${anonymized.length} record, ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
    }
  } catch (error) {
    console.error('   ⚠️ Errore export audit_logs:', error.message);
  }
  
  return { tempDir, exports };
}

/**
 * Carica file su cloud storage
 */
async function uploadToCloud(tempDir, exports) {
  console.log(`\n☁️ Caricamento su ${HYBRID_CONFIG.cloudProvider.toUpperCase()}...`);
  
  const uploaded = [];
  
  for (const [tableName, exportData] of Object.entries(exports)) {
    const remotePath = `${HYBRID_CONFIG.cloudPrefix}/${exportData.filename}`;
    
    try {
      switch (HYBRID_CONFIG.cloudProvider) {
        case 'b2':
          await execAsync(`b2 upload-file ${HYBRID_CONFIG.cloudBucket} "${exportData.filepath}" "${remotePath}"`);
          break;
          
        case 's3':
          await execAsync(`aws s3 cp "${exportData.filepath}" "s3://${HYBRID_CONFIG.cloudBucket}/${remotePath}"`);
          break;
          
        case 'gcs':
          await execAsync(`gsutil cp "${exportData.filepath}" "gs://${HYBRID_CONFIG.cloudBucket}/${remotePath}"`);
          break;
      }
      
      uploaded.push({
        table: tableName,
        filename: exportData.filename,
        sizeMB: (exportData.sizeBytes / 1024 / 1024).toFixed(2),
        remotePath
      });
      
      console.log(`   ✅ ${exportData.filename} caricato`);
      
    } catch (error) {
      console.error(`   ❌ Errore caricamento ${exportData.filename}:`, error.message);
    }
  }
  
  // Pulisci directory temporanea
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('   ⚠️ Errore pulizia directory temporanea:', error.message);
  }
  
  return uploaded;
}

/**
 * Invia notifica email
 */
async function sendNotification(subject, message) {
  if (!HYBRID_CONFIG.notifyEnabled || !HYBRID_CONFIG.notifyEmail) {
    return;
  }
  
  // Usa Resend per inviare email (come da memoria)
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@demosapp.it',
      to: HYBRID_CONFIG.notifyEmail,
      subject: subject,
      html: message
    });
    
    console.log(`   📧 Notifica inviata a ${HYBRID_CONFIG.notifyEmail}`);
  } catch (error) {
    console.error('   ❌ Errore invio notifica:', error.message);
  }
}

/**
 * Verifica se è necessario export manuale
 */
async function checkExportNeeded() {
  const cloudSize = await getCloudStorageSize();
  
  console.log(`\n📊 Dimensione cloud storage: ${cloudSize.sizeGB.toFixed(2)} GB (${cloudSize.fileCount} file)`);
  console.log(`   Soglia export: ${HYBRID_CONFIG.exportThresholdGB} GB`);
  
  if (cloudSize.sizeGB >= HYBRID_CONFIG.exportThresholdGB) {
    const message = `
      <h2>🚨 Export Manuale Richiesto</h2>
      <p>La dimensione dei log su cloud storage ha raggiunto <strong>${cloudSize.sizeGB.toFixed(2)} GB</strong>.</p>
      <p>È necessario eseguire un export manuale su hard disk.</p>
      <p><strong>Comando:</strong></p>
      <pre>node scripts/hard-disk-export.js export --from-cloud</pre>
      <p><strong>Dopo l'export:</strong></p>
      <pre>node scripts/hybrid-cloud-backup.js cleanup --after-export</pre>
    `;
    
    await sendNotification('Export Manuale Richiesto - Log Cloud Storage', message);
    
    console.log('\n⚠️ ATTENZIONE: Soglia raggiunta!');
    console.log('   Esegui export manuale su hard disk:');
    console.log('   node scripts/hard-disk-export.js export --from-cloud');
    
    return true;
  }
  
  return false;
}

/**
 * Rimuovi dati dal cloud dopo export
 */
async function cleanupCloudAfterExport() {
  console.log('🗑️ Rimozione dati dal cloud dopo export...');
  
  try {
    switch (HYBRID_CONFIG.cloudProvider) {
      case 'b2':
        await execAsync(`b2 delete-file-version ${HYBRID_CONFIG.cloudBucket} ${HYBRID_CONFIG.cloudPrefix}/`);
        break;
        
      case 's3':
        await execAsync(`aws s3 rm s3://${HYBRID_CONFIG.cloudBucket}/${HYBRID_CONFIG.cloudPrefix}/ --recursive`);
        break;
        
      case 'gcs':
        await execAsync(`gsutil rm -r gs://${HYBRID_CONFIG.cloudBucket}/${HYBRID_CONFIG.cloudPrefix}/`);
        break;
    }
    
    console.log('   ✅ Dati rimossi dal cloud');
  } catch (error) {
    console.error('   ❌ Errore rimozione:', error.message);
  }
}

/**
 * Funzione principale - Backup giornaliero
 */
async function dailyBackup() {
  console.log('🚀 Avvio backup giornaliero cloud...\n');
  
  try {
    // 1. Esporta log
    const { tempDir, exports } = await exportLogsForCloud();
    
    if (Object.keys(exports).length === 0) {
      console.log('\n✅ Nessun log da esportare');
      return;
    }
    
    // 2. Carica su cloud
    const uploaded = await uploadToCloud(tempDir, exports);
    
    if (uploaded.length === 0) {
      console.log('\n⚠️ Nessun file caricato');
      return;
    }
    
    const totalSizeMB = uploaded.reduce((sum, file) => sum + parseFloat(file.sizeMB), 0);
    console.log(`\n✅ Backup completato: ${uploaded.length} file, ${totalSizeMB.toFixed(2)} MB`);
    
    // 3. Verifica se serve export manuale
    await checkExportNeeded();
    
  } catch (error) {
    console.error('❌ Errore backup:', error);
    throw error;
  }
}

/**
 * Funzione principale
 */
async function main() {
  const command = process.argv[2] || 'backup';
  
  try {
    switch (command) {
      case 'backup':
        await dailyBackup();
        break;
        
      case 'check':
        await checkExportNeeded();
        break;
        
      case 'stats':
        const cloudSize = await getCloudStorageSize();
        console.log(`\n📊 Statistiche Cloud Storage:`);
        console.log(`   Dimensione: ${cloudSize.sizeGB.toFixed(2)} GB`);
        console.log(`   File: ${cloudSize.fileCount}`);
        console.log(`   Soglia: ${HYBRID_CONFIG.exportThresholdGB} GB`);
        console.log(`   Rimanente: ${(HYBRID_CONFIG.exportThresholdGB - cloudSize.sizeGB).toFixed(2)} GB`);
        break;
        
      case 'cleanup':
        await cleanupCloudAfterExport();
        break;
        
      default:
        console.log('Uso: node hybrid-cloud-backup.js [backup|check|stats|cleanup]');
        console.log('  backup  - Esegue backup giornaliero');
        console.log('  check   - Verifica se serve export manuale');
        console.log('  stats   - Mostra statistiche cloud storage');
        console.log('  cleanup - Rimuove dati dal cloud dopo export');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = {
  dailyBackup,
  checkExportNeeded,
  getCloudStorageSize,
  cleanupCloudAfterExport
};

