interface LoadingStateProps {
  isLoading: boolean;
  isError: boolean;
  children: React.ReactNode;
}

export function LoadingState({ isLoading, isError, children }: LoadingStateProps) {
  if (isLoading) {
    return <p>Caricamento...</p>;
  }

  if (isError) {
    return <p className="text-red-600">Errore nel caricamento dei ministeri</p>;
  }

  return <>{children}</>;
}
