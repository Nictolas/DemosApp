/**
 * Script per backup export su cloud storage gratuito
 * Supporta AWS S3, Google Cloud Storage, Backblaze B2
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);

// Configurazione cloud storage
const CLOUD_CONFIG = {
  // Tipo di storage: 's3', 'gcs', 'b2', 'azure'
  provider: process.env.CLOUD_STORAGE_PROVIDER || 's3',
  
  // Directory locale da cui caricare
  localDir: process.env.EXPORT_DIR || '/mnt/external-drive/archivio',
  
  // Configurazione AWS S3
  s3: {
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_S3_REGION || 'eu-west-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  
  // Configurazione Google Cloud Storage
  gcs: {
    bucket: process.env.GCS_BUCKET,
    keyFile: process.env.GCS_KEY_FILE
  },
  
  // Configurazione Backblaze B2
  b2: {
    bucket: process.env.B2_BUCKET,
    keyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
  },
  
  // Configurazione Azure Blob Storage
  azure: {
    accountName: process.env.AZURE_STORAGE_ACCOUNT,
    accountKey: process.env.AZURE_STORAGE_KEY,
    containerName: process.env.AZURE_CONTAINER_NAME
  }
};

/**
 * Backup su AWS S3 usando AWS CLI
 */
async function backupToS3(localPath, remotePath) {
  console.log(`☁️ Backup su AWS S3: ${remotePath}...`);
  
  const { bucket, region } = CLOUD_CONFIG.s3;
  const s3Path = `s3://${bucket}/${remotePath}`;
  
  try {
    // Verifica che AWS CLI sia installato
    await execAsync('aws --version');
    
    // Carica file
    const command = `aws s3 cp "${localPath}" "${s3Path}" --region ${region}`;
    await execAsync(command);
    
    console.log(`✅ File caricato su S3: ${s3Path}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore backup S3: ${error.message}`);
    return false;
  }
}

/**
 * Backup su Google Cloud Storage usando gsutil
 */
async function backupToGCS(localPath, remotePath) {
  console.log(`☁️ Backup su Google Cloud Storage: ${remotePath}...`);
  
  const { bucket } = CLOUD_CONFIG.gcs;
  const gcsPath = `gs://${bucket}/${remotePath}`;
  
  try {
    // Verifica che gsutil sia installato
    await execAsync('gsutil version');
    
    // Carica file
    const command = `gsutil cp "${localPath}" "${gcsPath}"`;
    await execAsync(command);
    
    console.log(`✅ File caricato su GCS: ${gcsPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore backup GCS: ${error.message}`);
    return false;
  }
}

/**
 * Backup su Backblaze B2 usando b2 CLI
 */
async function backupToB2(localPath, remotePath) {
  console.log(`☁️ Backup su Backblaze B2: ${remotePath}...`);
  
  const { bucket } = CLOUD_CONFIG.b2;
  
  try {
    // Verifica che b2 CLI sia installato
    await execAsync('b2 version');
    
    // Carica file
    const command = `b2 upload-file "${bucket}" "${localPath}" "${remotePath}"`;
    await execAsync(command);
    
    console.log(`✅ File caricato su B2: ${remotePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore backup B2: ${error.message}`);
    return false;
  }
}

/**
 * Backup su Azure Blob Storage usando Azure CLI
 */
async function backupToAzure(localPath, remotePath) {
  console.log(`☁️ Backup su Azure Blob Storage: ${remotePath}...`);
  
  const { accountName, containerName } = CLOUD_CONFIG.azure;
  
  try {
    // Verifica che Azure CLI sia installato
    await execAsync('az --version');
    
    // Carica file
    const command = `az storage blob upload --account-name ${accountName} --container-name ${containerName} --name "${remotePath}" --file "${localPath}"`;
    await execAsync(command);
    
    console.log(`✅ File caricato su Azure: ${remotePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Errore backup Azure: ${error.message}`);
    return false;
  }
}

/**
 * Backup ricorsivo di una directory
 */
async function backupDirectory(localDir, remotePrefix = '') {
  console.log(`📁 Backup directory: ${localDir}...`);
  
  const files = await fs.readdir(localDir, { withFileTypes: true });
  let backedUp = 0;
  let failed = 0;
  
  for (const file of files) {
    const localPath = path.join(localDir, file.name);
    const remotePath = remotePrefix ? `${remotePrefix}/${file.name}` : file.name;
    
    if (file.isDirectory()) {
      // Ricorsione per sottodirectory
      const result = await backupDirectory(localPath, remotePath);
      backedUp += result.backedUp;
      failed += result.failed;
    } else if (file.isFile()) {
      // Backup file
      let success = false;
      
      switch (CLOUD_CONFIG.provider) {
        case 's3':
          success = await backupToS3(localPath, remotePath);
          break;
        case 'gcs':
          success = await backupToGCS(localPath, remotePath);
          break;
        case 'b2':
          success = await backupToB2(localPath, remotePath);
          break;
        case 'azure':
          success = await backupToAzure(localPath, remotePath);
          break;
        default:
          console.error(`❌ Provider non supportato: ${CLOUD_CONFIG.provider}`);
          failed++;
          continue;
      }
      
      if (success) {
        backedUp++;
      } else {
        failed++;
      }
    }
  }
  
  return { backedUp, failed };
}

/**
 * Backup solo file nuovi (non ancora caricati)
 */
async function backupNewFiles(localDir, days = 7) {
  console.log(`📅 Backup file nuovi (ultimi ${days} giorni)...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const files = await fs.readdir(localDir, { withFileTypes: true, recursive: true });
  let backedUp = 0;
  
  for (const file of files) {
    if (!file.isFile()) continue;
    
    const filePath = path.join(localDir, file.name);
    const stats = await fs.stat(filePath);
    
    // Backup solo se modificato dopo cutoffDate
    if (stats.mtime > cutoffDate) {
      const remotePath = path.relative(localDir, filePath).replace(/\\/g, '/');
      
      let success = false;
      switch (CLOUD_CONFIG.provider) {
        case 's3':
          success = await backupToS3(filePath, remotePath);
          break;
        case 'gcs':
          success = await backupToGCS(filePath, remotePath);
          break;
        case 'b2':
          success = await backupToB2(filePath, remotePath);
          break;
        case 'azure':
          success = await backupToAzure(filePath, remotePath);
          break;
      }
      
      if (success) backedUp++;
    }
  }
  
  console.log(`✅ Backup completato: ${backedUp} file nuovi`);
  return backedUp;
}

/**
 * Funzione principale
 */
async function runCloudBackup() {
  const command = process.argv[2] || 'full';
  const localDir = CLOUD_CONFIG.localDir;
  
  console.log(`☁️ Avvio backup cloud storage...`);
  console.log(`   Provider: ${CLOUD_CONFIG.provider}`);
  console.log(`   Directory locale: ${localDir}\n`);
  
  try {
    // Verifica che la directory esista
    await fs.access(localDir);
    
    let result;
    
    switch (command) {
      case 'full':
        // Backup completo
        result = await backupDirectory(localDir);
        console.log(`\n✅ Backup completato:`);
        console.log(`   File caricati: ${result.backedUp}`);
        console.log(`   Errori: ${result.failed}`);
        break;
        
      case 'new':
        // Backup solo file nuovi
        const days = parseInt(process.argv[3]) || 7;
        await backupNewFiles(localDir, days);
        break;
        
      default:
        console.log('Uso: node cloud-backup-export.js [full|new] [days]');
        console.log('  full     - Backup completo della directory');
        console.log('  new      - Backup solo file nuovi (default: ultimi 7 giorni)');
    }
    
  } catch (error) {
    console.error(`❌ Errore backup cloud: ${error.message}`);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runCloudBackup();
}

module.exports = {
  backupToS3,
  backupToGCS,
  backupToB2,
  backupToAzure,
  backupDirectory,
  backupNewFiles
};

