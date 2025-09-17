import React, { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ITALY_DATA } from "@/data/italyData";

interface CascadingLocationSelectProps {
  paese: string;
  setPaese: (val: string) => void;
  regione: string;
  setRegione: (val: string) => void;
  provincia: string;
  setProvincia: (val: string) => void;
  comune: string;
  setComune: (val: string) => void;
  labelPrefix?: string;
}

export const CascadingLocationSelect: React.FC<CascadingLocationSelectProps> = ({
  paese, setPaese, regione, setRegione, provincia, setProvincia, comune, setComune, labelPrefix = ""
}) => {
  const [regioni, setRegioni] = React.useState<string[]>([]);
  const [province, setProvince] = React.useState<string[]>([]);
  const [comuni, setComuni] = React.useState<string[]>([]);

  useEffect(() => {
    if (paese === "Italia") {
      setRegioni(ITALY_DATA.Italia.regioni.map(r => r.nome));
    } else {
      setRegioni([]);
      setRegione("");
    }
    setProvince([]);
    setComuni([]);
    setProvincia("");
    setComune("");
  }, [paese]);

  useEffect(() => {
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvince(reg.province.map(p => p.nome));
    } else {
      setProvince([]);
      setProvincia("");
    }
    setComuni([]);
    setComune("");
  }, [regione]);

  useEffect(() => {
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      const prov = reg?.province.find(p => p.nome === provincia);
      if (prov) setComuni(prov.comuni);
    } else {
      setComuni([]);
      setComune("");
    }
  }, [provincia]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label className="required-field">{labelPrefix}Paese</label>
        <Select value={paese} onValueChange={setPaese}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona paese" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Italia">Italia</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="required-field">{labelPrefix}Regione</label>
        <Select value={regione} onValueChange={setRegione} disabled={regioni.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona regione" />
          </SelectTrigger>
          <SelectContent>
            {regioni.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="required-field">{labelPrefix}Provincia</label>
        <Select value={provincia} onValueChange={setProvincia} disabled={province.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona provincia" />
          </SelectTrigger>
          <SelectContent>
            {province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="required-field">{labelPrefix}Comune</label>
        <Select value={comune} onValueChange={setComune} disabled={comuni.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona comune" />
          </SelectTrigger>
          <SelectContent>
            {comuni.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}; 
