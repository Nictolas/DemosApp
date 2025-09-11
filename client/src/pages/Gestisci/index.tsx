import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Header } from "./components/Header";
import { Title } from "./components/Title";
import { SectionsGrid } from "./components/SectionsGrid";

export default function Gestisci() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 page-with-navbar">
      <div className="w-full px-4 py-6 space-y-8">
        <Header />
        <Title />
        <SectionsGrid />
      </div>
    </div>
  );
}
