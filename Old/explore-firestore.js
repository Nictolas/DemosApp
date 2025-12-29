#!/usr/bin/env node

/**
 * Esplora tutte le collection di Firestore per identificare i dati da migrare
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Configurazione Firebase Admin SDK
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore(firebaseApp);

async function exploreFirestore() {
  console.log('🔍 Esplorazione completa di Firestore...');
  console.log('📅 Data esplorazione:', new Date().toISOString());
  
  try {
    // Lista delle collection che potrebbero esistere
    const possibleCollections = [
      'utenti',
      'comunicazioni', 
      'opinioni',
      'opinioni_proposte',
      'voti_capo_stato',
      'voti_referendum_abrogativi',
      'premium_requests',
      'admin_notifications',
      'elezioni',
      'candidati',
      'voti_elezioni',
      'referendum',
      'voti_referendum',
      'iniziative_popolari',
      'voti_iniziative_popolari',
      'ice',
      'voti_ice',
      'eventi',
      'notifiche',
      'sondaggi',
      'voti_sondaggi',
      'donazioni',
      'premium_users',
      'admin_users',
      'settings',
      'config',
      'logs',
      'backups',
      'analytics',
      'reports',
      'feedback',
      'support_tickets',
      'news',
      'announcements',
      'faq',
      'help_articles',
      'tutorials',
      'user_sessions',
      'user_activity',
      'user_preferences',
      'user_stats',
      'system_stats',
      'audit_logs',
      'security_logs',
      'error_logs',
      'performance_logs'
    ];
    
    const foundCollections = [];
    const collectionStats = {};
    
    console.log('\n📋 Controllo collection esistenti...');
    
    for (const collectionName of possibleCollections) {
      try {
        const snapshot = await firestore.collection(collectionName).limit(1).get();
        
        if (!snapshot.empty) {
          foundCollections.push(collectionName);
          
          // Conta tutti i documenti nella collection
          const countSnapshot = await firestore.collection(collectionName).get();
          const count = countSnapshot.size;
          
          collectionStats[collectionName] = count;
          
          console.log(`✅ ${collectionName}: ${count} documenti`);
          
          // Mostra un esempio di documento per capire la struttura
          const firstDoc = countSnapshot.docs[0];
          const firstDocData = firstDoc.data();
          
          console.log(`   📄 Esempio documento ${firstDoc.id}:`);
          console.log(`   🔑 Campi: ${Object.keys(firstDocData).join(', ')}`);
          
          // Mostra alcuni valori di esempio (primi 3 campi)
          const sampleFields = Object.entries(firstDocData).slice(0, 3);
          sampleFields.forEach(([key, value]) => {
            const valueStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : String(value);
            console.log(`      ${key}: ${valueStr}`);
          });
          
        } else {
          console.log(`❌ ${collectionName}: 0 documenti`);
        }
      } catch (error) {
        console.log(`⚠️ ${collectionName}: Errore accesso - ${error.message}`);
      }
    }
    
    console.log('\n📊 RIEPILOGO COLLECTION TROVATE:');
    console.log('================================');
    
    if (foundCollections.length === 0) {
      console.log('❌ Nessuna collection trovata!');
    } else {
      console.log(`✅ Trovate ${foundCollections.length} collection con dati:`);
      
      let totalDocuments = 0;
      foundCollections.forEach(collection => {
        const count = collectionStats[collection];
        totalDocuments += count;
        console.log(`   📁 ${collection}: ${count} documenti`);
      });
      
      console.log(`\n📈 TOTALE: ${totalDocuments} documenti da migrare`);
    }
    
    // Controlla anche le subcollection
    console.log('\n🔍 Controllo subcollection...');
    await checkSubcollections();
    
  } catch (error) {
    console.error('❌ Errore durante l\'esplorazione:', error);
  }
}

async function checkSubcollections() {
  try {
    // Controlla se ci sono subcollection in utenti
    const usersSnapshot = await firestore.collection('utenti').limit(5).get();
    
    for (const userDoc of usersSnapshot.docs) {
      const subcollections = await userDoc.ref.listCollections();
      
      if (subcollections.length > 0) {
        console.log(`\n👤 Subcollection per utente ${userDoc.id}:`);
        
        for (const subcollection of subcollections) {
          const subSnapshot = await subcollection.get();
          console.log(`   📁 ${subcollection.id}: ${subSnapshot.size} documenti`);
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Errore controllo subcollection:', error.message);
  }
}

// Esegui esplorazione
exploreFirestore();
