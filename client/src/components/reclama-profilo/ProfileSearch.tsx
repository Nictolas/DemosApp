import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { ProfileSearchProps } from "./types";

export function ProfileSearch({
  searchQuery,
  onSearchChange,
  onSearch,
  isSearching,
  searchResults,
  onClaimProfile,
  onCreateNewProfile
}: ProfileSearchProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Fase 1 - Cerca il tuo profilo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Inserisci il tuo nome e cognome..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            className="flex-1"
          />
          <Button onClick={onSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Cerca
          </Button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Profili trovati:</h4>
            {searchResults.map((profile, index) => (
              <Card key={index} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-medium">{profile.nome} {profile.cognome}</h5>
                    <p className="text-sm text-muted-foreground">
                      {profile.ruolo} - {profile.comune_elezione}, {profile.regione_elezione}
                    </p>
                  </div>
                  <Button onClick={() => onClaimProfile(profile)}>
                    Reclama questo profilo
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create New Profile Option */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            Non hai trovato il tuo profilo?
          </p>
          <Button variant="outline" onClick={onCreateNewProfile}>
            Crea un nuovo profilo da reclamare
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
