import { Redirect } from "wouter";

/** Vecchio URL: la guida è ora la tab "Guida" in Parametri */
export default function RiduzioneCompute() {
  return <Redirect to="/admin/parametri?tab=guida" />;
}
