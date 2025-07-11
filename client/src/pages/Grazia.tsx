import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Grazia() {
  const [classifica, setClassifica] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClassifica() {
      setLoading(true);
      const colRef = collection(db, "voti_grazia");
      const snapshot = await getDocs(colRef);
      const votiList = snapshot.docs.map(doc => doc.data().nome);
      // Conta i voti per ogni nome
      const conteggio = {};
      votiList.forEach(nome => {
        if (nome) conteggio[nome] = (conteggio[nome] || 0) + 1;
      });
      // Trasforma in array ordinato per numero di voti
      const classificaArray = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      setLoading(false);
    }
    fetchClassifica();
  }, []);

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Classifica Grazia</h2>
      {classifica.length === 0 ? (
        <div className="text-gray-500">Nessun voto trovato.</div>
      ) : (
        <ul className="space-y-2">
          {classifica.map(item => (
            <li key={item.nome} className="border rounded p-3 bg-white shadow flex justify-between">
              <span>{item.nome}</span>
              <span className="font-bold">{item.voti} voto{item.voti > 1 ? "i" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}