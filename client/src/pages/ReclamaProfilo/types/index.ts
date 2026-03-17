import React from "react";

export interface PremiumBenefit {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface AccountType {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  color: string;
  popular?: boolean;
}

export interface PoliticianProfile {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  comune_elezione: string;
  regione_elezione: string;
}

export interface ClaimFormData {
  nome: string;
  cognome: string;
  carica_attuale: string;
  ente_elettorale: string;
  email: string;
  riferimento_istituzionale: string;
  gdpr_accepted: boolean;
}

export interface ClaimDocuments {
  documento_identita: File | null;
  certificazione_elezione: File | null;
  dichiarazione_carica: File | null;
}

export type ClaimPhase = "search" | "form" | "success";
