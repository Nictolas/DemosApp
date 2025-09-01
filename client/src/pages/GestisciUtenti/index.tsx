import React, { useState } from 'react';
import { Link, Redirect } from 'wouter';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EditUserDialog } from '@/components/EditUserDialog';
import { EditOpinioniDialog } from '@/components/EditOpinioniDialog';
import { useAuth } from '@/hooks/use-auth-neon';
import { useUsersData } from './hooks/useUsersData';
import { useUsersActions } from './hooks/useUsersActions';
import { useUsersFilters } from './hooks/useUsersFilters';
import { UsersStats, UsersFilters, PendingUsersTable, UsersTable } from './components';
import { User } from './types';

export default function GestisciUtenti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // Hook per gestione dati
  const { 
    utenti, 
    pendingUsers, 
    isLoadingUsers, 
    isError, 
    lastUpdateTime, 
    refreshData 
  } = useUsersData();
  
  // Hook per azioni utenti
  const { approvalMutation, deleteMutation } = useUsersActions();
  
  // Hook per filtri e ricerca
  const {
    searchTerm,
    sortField,
    sortDirection,
    currentPage,
    displayColumns,
    filteredAndSortedUsers,
    paginatedUsers,
    totalPages,
    setSearchTerm,
    handleSort,
    setQuickFilter,
    setCurrentPage
  } = useUsersFilters(utenti);
  
  // Stato per dialoghi
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEditOpinioniDialog, setShowEditOpinioniDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Debug logging per capire il ruolo dell'utente
  console.log('🔍 DEBUG GestisciUtenti - Auth state:', {
    user: user ? { id: user.id, email: user.email, role: user.role, ruolo: (user as any).ruolo } : null,
    isAuthLoading,
    userRole: user?.role,
    userRuolo: (user as any)?.ruolo,
    isAdmin: user?.role === 'Admin' || (user as any)?.ruolo === 'Admin'
  });

  // Gestione azioni
  const handleApprove = (userId: string) => {
    approvalMutation.mutate({ userId, approve: true });
  };

  const handleReject = (userId: string) => {
    approvalMutation.mutate({ userId, approve: false });
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const handleEditOpinions = (user: User) => {
    setSelectedUser(user);
    setShowEditOpinioniDialog(true);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
      setUserToDelete(null);
    }
  };

  // Loading e autenticazione
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  // Controllo più flessibile per il ruolo admin
  const isAdmin = user.role === 'Admin' || (user as any)?.ruolo === 'Admin';
  console.log('🔍 DEBUG GestisciUtenti - Admin check:', { 
    isAdmin, 
    userRole: user.role, 
    userRuolo: (user as any)?.ruolo 
  });
  
  if (!isAdmin) {
    console.log('🔍 DEBUG GestisciUtenti - Redirecting to menu: user is not admin');
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 select-none page-with-navbar">
      <div className="w-full px-6">
        {/* Header moderno con gradiente */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Link href="/menu">
              <Button variant="ghost" className="mr-4 hover:bg-white/50">
                <ArrowLeft className="h-5 w-5 mr-2" />Torna al Menu
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gestione Utenti
              </h1>
            </div>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Amministra gli utenti della piattaforma, gestisci ruoli e approva nuove registrazioni
          </p>
        </div>
        
        {isLoadingUsers ? (
          <div className="flex items-center justify-center min-h-[80vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center text-red-500 p-8">Errore nel caricamento degli utenti.</div>
        ) : (
          <>
            {/* Statistiche utenti */}
            <UsersStats utenti={utenti} pendingUsers={pendingUsers} />

            {/* Tabella utenti in attesa */}
            <PendingUsersTable
              pendingUsers={pendingUsers}
              onApprove={handleApprove}
              onReject={handleReject}
              isApprovalPending={approvalMutation.isPending}
            />

            {/* Tabella utenti attivi */}
            <div className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
              <div className="p-6">
                {/* Filtri e ricerca */}
                <UsersFilters
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  setQuickFilter={setQuickFilter}
                  filteredCount={filteredAndSortedUsers.length}
                  lastUpdateTime={lastUpdateTime}
                  onRefresh={refreshData}
                  isLoading={isLoadingUsers}
                />

                {/* Tabella utenti */}
                <UsersTable
                  users={paginatedUsers}
                  displayColumns={displayColumns}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onEdit={handleEdit}
                  onEditOpinions={handleEditOpinions}
                  onDelete={handleDelete}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          </>
        )}

        {/* Dialog di conferma eliminazione */}
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <svg className="h-5 w-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Conferma eliminazione
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare l'utente <strong>{userToDelete?.nome} {userToDelete?.cognome}</strong>? 
                L'operazione non è reversibile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete} 
                className="bg-red-500 hover:bg-red-600 text-white" 
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin"/>
                ) : (
                  "Elimina"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog di modifica utente */}
        {selectedUser && (
          <>
            <EditUserDialog 
              userUid={selectedUser.id} 
              open={showEditDialog} 
              onOpenChange={setShowEditDialog} 
              onUserUpdated={() => {
                // Invalida le query per aggiornare i dati
                // queryClient.invalidateQueries({ queryKey: ['allUsers'] });
              }} 
            />
            <EditOpinioniDialog 
              utenteId={selectedUser.id} 
              open={showEditOpinioniDialog} 
              onOpenChange={setShowEditOpinioniDialog} 
            />
          </>
        )}
      </div>
    </div>
  );
}
