-- Script per eliminare la colonna codice_attivista dalla tabella users

ALTER TABLE users DROP COLUMN IF EXISTS codice_attivista CASCADE;

