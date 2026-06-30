import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/AuthCard";
import "./auth-page.css";

export default function AuthPage() {
  const { user, isLoading } = useAuth();

  if (user && !isLoading) {
    return <Redirect to="/preferiti" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <AuthCard />
    </div>
  );
}
