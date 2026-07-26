import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Calculator, Info } from "lucide-react";

/** Default dal vecchio calcolo limiti di voto: 1.5 GB / 1M utenti. */
const DEFAULT_STORAGE_GB_PER_MILLION = 1.5;
const DEFAULT_TARGET_USERS = 1_000_000;
const DEFAULT_MAU_PERCENT = 20;
const DEFAULT_REQUESTS_PER_ACTIVE_DAY = 30;
const DEFAULT_DESKTOP_SHARE_PERCENT = 15;
const DEFAULT_DESKTOP_HUB_EXTRA_REQUESTS = 4;
const DEFAULT_AVG_RESPONSE_KB = 8;

type PlanLimits = {
  storageGb: number;
  egressGb: number;
  connections: number;
  registeredUsers: number;
};

type CapacityEstimateCardProps = {
  liveRegisteredUsers?: number | null;
  liveStorageGb?: number | null;
  freeLimits: PlanLimits;
  proLimits?: PlanLimits;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "N/D";
  return value.toLocaleString("it-IT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function usageBarClass(percent: number): string {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function ratioPercent(used: number, limit: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.max(0, Math.min(999, Number(((used / limit) * 100).toFixed(1))));
}

export function CapacityEstimateCard({
  liveRegisteredUsers,
  liveStorageGb,
  freeLimits,
  proLimits = {
    storageGb: 8,
    egressGb: 250,
    connections: 200,
    registeredUsers: 100_000,
  },
}: CapacityEstimateCardProps) {
  const [targetUsers, setTargetUsers] = useState(DEFAULT_TARGET_USERS);
  const [storageGbPerMillion, setStorageGbPerMillion] = useState(DEFAULT_STORAGE_GB_PER_MILLION);
  const [mauPercent, setMauPercent] = useState(DEFAULT_MAU_PERCENT);
  const [requestsPerActiveDay, setRequestsPerActiveDay] = useState(DEFAULT_REQUESTS_PER_ACTIVE_DAY);
  const [desktopSharePercent, setDesktopSharePercent] = useState(DEFAULT_DESKTOP_SHARE_PERCENT);
  const [desktopHubExtra, setDesktopHubExtra] = useState(DEFAULT_DESKTOP_HUB_EXTRA_REQUESTS);
  const [avgResponseKb, setAvgResponseKb] = useState(DEFAULT_AVG_RESPONSE_KB);

  const estimate = useMemo(() => {
    const users = clampNumber(targetUsers, 1, 50_000_000);
    const gbPerM = clampNumber(storageGbPerMillion, 0.05, 100);
    const mauPct = clampNumber(mauPercent, 1, 100) / 100;
    const reqDay = clampNumber(requestsPerActiveDay, 1, 500);
    const deskPct = clampNumber(desktopSharePercent, 0, 100) / 100;
    const deskExtra = clampNumber(desktopHubExtra, 0, 50);
    const respKb = clampNumber(avgResponseKb, 1, 500);

    const kbPerUser = (gbPerM * 1024 * 1024) / 1_000_000;
    const storageGb = (users / 1_000_000) * gbPerM;
    const mau = Math.round(users * mauPct);
    const desktopMau = Math.round(mau * deskPct);

    const baseDailyRequests = mau * reqDay;
    const desktopExtraDaily = desktopMau * deskExtra;
    const dailyRequests = baseDailyRequests + desktopExtraDaily;
    const monthlyRequests = dailyRequests * 30;

    const monthlyEgressGb = (monthlyRequests * respKb) / (1024 * 1024);
    // Picco grezzo: ~1% dei MAU online insieme (ordine di grandezza)
    const peakConnections = Math.max(1, Math.ceil(mau * 0.01));

    const freeStoragePct = ratioPercent(storageGb, freeLimits.storageGb);
    const freeEgressPct = ratioPercent(monthlyEgressGb, freeLimits.egressGb);
    const freeConnPct = ratioPercent(peakConnections, freeLimits.connections);
    const freeUsersPct = ratioPercent(users, freeLimits.registeredUsers);

    const proStoragePct = ratioPercent(storageGb, proLimits.storageGb);
    const proEgressPct = ratioPercent(monthlyEgressGb, proLimits.egressGb);

    const freeOk =
      freeStoragePct < 90 &&
      freeEgressPct < 90 &&
      freeConnPct < 90 &&
      freeUsersPct < 90;

    const freeRisk =
      !freeOk &&
      freeStoragePct < 150 &&
      freeEgressPct < 200 &&
      freeConnPct < 200;

    const needsPaid = !freeOk && !freeRisk;

    let verdict: { label: string; tone: string; detail: string };
    if (freeOk) {
      verdict = {
        label: "Free ok (stima)",
        tone: "bg-emerald-100 text-emerald-800 border-emerald-300",
        detail:
          "Con queste ipotesi resti sotto i limiti tipici del piano Free. Restano i limiti di compute/concorrenza reale.",
      };
    } else if (freeRisk || (proStoragePct < 90 && proEgressPct < 90)) {
      verdict = {
        label: "Free a rischio → Pro",
        tone: "bg-amber-100 text-amber-900 border-amber-300",
        detail:
          "La stima supera uno o più limiti Free. Un piano Pro (o archivio/export) è più realistico a questo target.",
      };
    } else {
      verdict = {
        label: "Serve upgrade / architettura",
        tone: "bg-red-100 text-red-800 border-red-300",
        detail:
          "Oltre Free e vicino/oltre Pro tipico: servono piani superiori, sharding, CDN e/o export dati storici.",
      };
    }

    return {
      users,
      kbPerUser,
      storageGb,
      mau,
      desktopMau,
      dailyRequests,
      monthlyRequests,
      monthlyEgressGb,
      peakConnections,
      freeStoragePct,
      freeEgressPct,
      freeConnPct,
      freeUsersPct,
      proStoragePct,
      proEgressPct,
      verdict,
      needsPaid,
    };
  }, [
    targetUsers,
    storageGbPerMillion,
    mauPercent,
    requestsPerActiveDay,
    desktopSharePercent,
    desktopHubExtra,
    avgResponseKb,
    freeLimits,
    proLimits,
  ]);

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm hover:shadow-md transition-shadow mb-8">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-cyan-700" />
              Stima capacità
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Calcolo indicativo basato sul modello con limiti di voto (~{DEFAULT_STORAGE_GB_PER_MILLION} GB / 1M utenti).
              Non è una garanzia: serve per confrontare ipotesi con i limiti Free/Pro.
            </CardDescription>
          </div>
          <Badge variant="outline" className={`inline-flex items-center gap-1 ${estimate.verdict.tone}`}>
            {estimate.needsPaid ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {estimate.verdict.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cap-target-users">Utenti target (registrati)</Label>
            <Input
              id="cap-target-users"
              type="number"
              min={1}
              step={1000}
              value={targetUsers}
              onChange={(e) => setTargetUsers(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-gb-per-m">GB storage / 1M utenti</Label>
            <Input
              id="cap-gb-per-m"
              type="number"
              min={0.05}
              step={0.1}
              value={storageGbPerMillion}
              onChange={(e) => setStorageGbPerMillion(Number(e.target.value))}
            />
            <p className="text-[11px] text-slate-500">Default 1.5 (con limiti voto). Senza limiti era ~20.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-mau">% utenti attivi / mese (MAU)</Label>
            <Input
              id="cap-mau"
              type="number"
              min={1}
              max={100}
              step={1}
              value={mauPercent}
              onChange={(e) => setMauPercent(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-req">Richieste / giorno per utente attivo</Label>
            <Input
              id="cap-req"
              type="number"
              min={1}
              step={1}
              value={requestsPerActiveDay}
              onChange={(e) => setRequestsPerActiveDay(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-desk-share">% MAU su Preferiti desktop</Label>
            <Input
              id="cap-desk-share"
              type="number"
              min={0}
              max={100}
              step={1}
              value={desktopSharePercent}
              onChange={(e) => setDesktopSharePercent(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-desk-extra">API extra hub desktop / sessione</Label>
            <Input
              id="cap-desk-extra"
              type="number"
              min={0}
              step={1}
              value={desktopHubExtra}
              onChange={(e) => setDesktopHubExtra(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-resp-kb">KB medi risposta API</Label>
            <Input
              id="cap-resp-kb"
              type="number"
              min={1}
              step={1}
              value={avgResponseKb}
              onChange={(e) => setAvgResponseKb(Number(e.target.value))}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-800 flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> Live attuale
            </p>
            <p>
              Utenti registrati:{" "}
              <strong>{liveRegisteredUsers != null ? formatNumber(liveRegisteredUsers, 0) : "N/D"}</strong>
            </p>
            <p>
              Storage DB: <strong>{liveStorageGb != null ? `${formatNumber(liveStorageGb)} GB` : "N/D"}</strong>
            </p>
            <p className="text-slate-500">≈ {formatNumber(estimate.kbPerUser, 2)} KB / utente (modello)</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {estimate.verdict.detail}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Storage stimato</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(estimate.storageGb)} GB</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>vs Free {formatNumber(freeLimits.storageGb)} GB</span>
                <span>{formatNumber(estimate.freeStoragePct, 1)}%</span>
              </div>
              <Progress
                value={Math.min(100, estimate.freeStoragePct)}
                className="h-2"
                indicatorClassName={usageBarClass(estimate.freeStoragePct)}
              />
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>vs Pro ~{formatNumber(proLimits.storageGb)} GB</span>
                <span>{formatNumber(estimate.proStoragePct, 1)}%</span>
              </div>
              <Progress
                value={Math.min(100, estimate.proStoragePct)}
                className="h-2"
                indicatorClassName={usageBarClass(estimate.proStoragePct)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Egress / mese</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(estimate.monthlyEgressGb)} GB</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>vs Free {formatNumber(freeLimits.egressGb)} GB</span>
                <span>{formatNumber(estimate.freeEgressPct, 1)}%</span>
              </div>
              <Progress
                value={Math.min(100, estimate.freeEgressPct)}
                className="h-2"
                indicatorClassName={usageBarClass(estimate.freeEgressPct)}
              />
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>vs Pro ~{formatNumber(proLimits.egressGb)} GB</span>
                <span>{formatNumber(estimate.proEgressPct, 1)}%</span>
              </div>
              <Progress
                value={Math.min(100, estimate.proEgressPct)}
                className="h-2"
                indicatorClassName={usageBarClass(estimate.proEgressPct)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">MAU / richieste</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(estimate.mau, 0)}</p>
            <p className="text-xs text-slate-600">
              Desktop hub: {formatNumber(estimate.desktopMau, 0)} MAU · +{formatNumber(desktopHubExtra, 0)} API/sessione
            </p>
            <p className="text-xs text-slate-600">
              ~{formatNumber(estimate.dailyRequests, 0)} req/giorno · ~{formatNumber(estimate.monthlyRequests, 0)} /mese
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Picco connessioni</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(estimate.peakConnections, 0)}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>vs Free {formatNumber(freeLimits.connections, 0)}</span>
                <span>{formatNumber(estimate.freeConnPct, 1)}%</span>
              </div>
              <Progress
                value={Math.min(100, estimate.freeConnPct)}
                className="h-2"
                indicatorClassName={usageBarClass(estimate.freeConnPct)}
              />
              <p className="text-[11px] text-slate-500">Ipotesi grezza: ~1% dei MAU contemporanei.</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          Nota: i “milioni possibili” del calcolo storico riguardano soprattutto storage/query con limiti di voto, non la
          permanenza illimitata sul piano Free. L&apos;auth Demos è custom: il tetto MAU Supabase è solo un riferimento.
          Preferiti desktop aggiunge poche API in più solo sulla quota stimata di utenti PC.
        </div>
      </CardContent>
    </Card>
  );
}
