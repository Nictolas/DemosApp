import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/AuthCard";
import { useMobile } from "@/hooks/use-mobile";
import LandingPage from "./LandingPage";
import "./auth-page.css";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const isMobileLayout = useMobile();

  if (user && !isLoading) {
    return <Redirect to="/profilo" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMobileLayout) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <AuthCard />
    </div>
  );
}
