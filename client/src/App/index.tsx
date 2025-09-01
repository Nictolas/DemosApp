import React from "react";
import { useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth-neon";
import { RegistrationProvider } from "@/hooks/use-registration";
import { queryClient } from "../lib/queryClient";
import { useTouchNavigation } from "./hooks/useTouchNavigation";
import { AppRouter } from "./components/AppRouter";
import { pageComponents } from "./imports";

export default function App() {
  // Hook per la navigazione touch
  useTouchNavigation();
  
  const [location] = useLocation();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RegistrationProvider>
          <div className="App">
            <AppRouter />
            {location !== '/' && 
             !location.startsWith('/reset-password') && 
             !location.startsWith('/auth') && 
             !location.startsWith('/registrazione-') && 
             <pageComponents.Navbar />}
            <Toaster />
          </div>
        </RegistrationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
