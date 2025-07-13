import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

export default function Riscontro() {
  const { user } = useAuth();
  const [comunicazione, setComunicazione] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const q = query(
      collection(db, "comunicazioni"),
      where("id_utente", "==", user.id),
      orderBy("data_creazione", "desc"),
      limit(1)
    );
    getDocs(q).then(snapshot => {
      if (!snapshot.empty) {
        setComunicazione({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
      setIsLoading(false);
    });
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Riscontro sulla tua ultima comunicazione</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Caricamento...</p>
              ) : comunicazione ? (
                <div>
                  <p className="mb-2"><strong>Titolo:</strong> {comunicazione.titolo}</p>
                  <p><strong>Like:</strong> {comunicazione.likes || 0}</p>
                  <p><strong>Dislike:</strong> {comunicazione.dislikes || 0}</p>
                </div>
              ) : (
                <p>Non hai ancora inviato comunicazioni.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 