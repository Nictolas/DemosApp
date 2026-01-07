#!/usr/bin/env python3
"""
Script per interrogare l'endpoint SPARQL della Camera dei Deputati
e visualizzare tutti i metadati disponibili sulle votazioni dell'ultima legislatura.
"""

import json
from SPARQLWrapper import SPARQLWrapper, JSON

def query_votazioni_camera():
    """
    Interroga l'endpoint SPARQL della Camera per ottenere informazioni
    sulle votazioni dell'ultima legislatura (XIX legislatura).
    """
    
    # Imposta l'endpoint SPARQL
    sparql = SPARQLWrapper("http://dati.camera.it/sparql")
    
    # Query SPARQL per ottenere tutte le proprietà delle votazioni dell'ultima legislatura
    # La XIX legislatura è quella attualmente in corso (2022-2027)
    query = """
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX dc: <http://purl.org/dc/elements/1.1/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?predicato ?oggetto
    WHERE {
      ?votazione a ocd:Votazione .
      ?votazione ?predicato ?oggetto .
      
      # Filtra per la XIX legislatura (2022-2027)
      ?votazione ocd:rif_legislatura ?legislatura .
      ?legislatura ocd:numero 19 .
    }
    LIMIT 10
    """
    
    # Imposta la query e il formato di ritorno
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)
    
    try:
        print("=" * 80)
        print("Interrogazione endpoint SPARQL: http://dati.camera.it/sparql")
        print("=" * 80)
        print("\nEsecuzione query...\n")
        
        # Esegui la query e ottieni i risultati
        results = sparql.query().convert()
        
        # Controlla se ci sono risultati
        if not results["results"]["bindings"]:
            print("Nessun risultato trovato.")
            return
        
        print(f"Trovati {len(results['results']['bindings'])} record.\n")
        print("=" * 80)
        print("METADATI DISPONIBILI")
        print("=" * 80)
        print()
        
        # Raggruppa i risultati per votazione
        votazioni = {}
        for result in results["results"]["bindings"]:
            votazione_uri = result["votazione"]["value"]
            predicato = result["predicato"]["value"]
            oggetto = result["oggetto"]["value"]
            
            if votazione_uri not in votazioni:
                votazioni[votazione_uri] = {}
            
            votazioni[votazione_uri][predicato] = oggetto
        
        # Stampa i risultati organizzati per votazione
        for idx, (votazione_uri, proprieta) in enumerate(votazioni.items(), 1):
            print(f"\n{'=' * 80}")
            print(f"VOTAZIONE #{idx}")
            print(f"{'=' * 80}")
            print(f"URI: {votazione_uri}\n")
            print("Predicati e valori:")
            print("-" * 80)
            
            for predicato, oggetto in sorted(proprieta.items()):
                # Estrai il nome del predicato (ultima parte dopo / o #)
                nome_predicato = predicato.split('/')[-1].split('#')[-1]
                print(f"  {nome_predicato:40} | {oggetto}")
            
            print()
        
        # Stampa anche un riepilogo di tutti i predicati unici trovati
        print("\n" + "=" * 80)
        print("RIEPILOGO PREDICATI UNICI")
        print("=" * 80)
        print()
        
        tutti_predicati = set()
        for proprieta in votazioni.values():
            tutti_predicati.update(proprieta.keys())
        
        for predicato in sorted(tutti_predicati):
            nome_predicato = predicato.split('/')[-1].split('#')[-1]
            print(f"  - {nome_predicato}")
            print(f"    URI completo: {predicato}")
        
        print(f"\n\nTotale predicati unici trovati: {len(tutti_predicati)}")
        
        # Salva anche un file JSON con i risultati completi
        output_file = "votazioni_camera_metadata.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"\nRisultati completi salvati in: {output_file}")
        
    except Exception as e:
        print(f"Errore durante l'esecuzione della query: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    query_votazioni_camera()

