import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Calculator } from "lucide-react";

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
        label: "Free ok",
        tone: "bg-emerald-100 text-emerald-800 border-emerald-300",
        detail: "Sotto i limiti Free tipici (stima).",
      };
    } else if (freeRisk || (proStoragePct < 90 && proEgressPct < 90)) {
      verdict = {
        label: "Free → Pro",
        tone: "bg-amber-100 text-amber-900 border-amber-300",
        detail: "Oltre Free: Pro o archivio più realistici.",
      };
    } else {
      verdict = {
        label: "Upgrade",
        tone: "bg-red-100 text-red-800 border-red-300",
        detail: "Oltre Free/Pro tipico: piano superiore o architettura.",
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

  const fields: { id: string; label: string; value: number; set: (n: number) => void; step?: number; min?: number; max?: number }[] = [
    { id: "cap-target-users", label: "Utenti target", value: targetUsers, set: setTargetUsers, step: 1000, min: 1 },
    { id: "cap-gb-per-m", label: "GB / 1M utenti", value: storageGbPerMillion, set: setStorageGbPerMillion, step: 0.1, min: 0.05 },
    { id: "cap-mau", label: "% MAU", value: mauPercent, set: setMauPercent, step: 1, min: 1, max: 100 },
    { id: "cap-req", label: "Req/giorno", value: requestsPerActiveDay, set: setRequestsPerActiveDay, step: 1, min: 1 },
    { id: "cap-desk-share", label: "% desktop", value: desktopSharePercent, set: setDesktopSharePercent, step: 1, min: 0, max: 100 },
    { id: "cap-desk-extra", label: "API extra hub", value: desktopHubExtra, set: setDesktopHubExtra, step: 1, min: 0 },
    { id: "cap-resp-kb", label: "KB risposta", value: avgResponseKb, set: setAvgResponseKb, step: 1, min: 1 },
  ];

  return (
    <Card className="border-slate-200 bg-white shadow-none mb-2">
      <CardContent className="p-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-cyan-700 shrink-0" />
          <p className="text-xs font-semibold text-slate-900">Stima capacità</p>
          <Badge variant="outline" className={`inline-flex items-center gap-1 text-[10px] px-1 py-0 ${estimate.verdict.tone}`}>
            {estimate.needsPaid ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {estimate.verdict.label}
          </Badge>
          <span className="text-[10px] text-slate-500 truncate">
            live {liveRegisteredUsers != null ? formatNumber(liveRegisteredUsers, 0) : "N/D"} ·{" "}
            {liveStorageGb != null ? `${formatNumber(liveStorageGb)} GB` : "N/D"} · {estimate.verdict.detail}
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 xl:grid-cols-11 gap-1">
          {fields.map((f) => (
            <div key={f.id} className="space-y-0.5 min-w-0">
              <Label htmlFor={f.id} className="text-[9px] text-slate-500 leading-none">
                {f.label}
              </Label>
              <Input
                id={f.id}
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={f.value}
                onChange={(e) => f.set(Number(e.target.value))}
                className="h-6 text-[11px] px-1.5"
              />
            </div>
          ))}
          <div className="rounded border border-slate-200 px-1.5 py-0.5 min-w-0">
            <p className="text-[9px] text-slate-500">Storage</p>
            <p className="text-xs font-bold tabular-nums">{formatNumber(estimate.storageGb)} GB</p>
            <Progress value={Math.min(100, estimate.freeStoragePct)} className="h-1 mt-0.5" indicatorClassName={usageBarClass(estimate.freeStoragePct)} />
          </div>
          <div className="rounded border border-slate-200 px-1.5 py-0.5 min-w-0">
            <p className="text-[9px] text-slate-500">Egress/mese</p>
            <p className="text-xs font-bold tabular-nums">{formatNumber(estimate.monthlyEgressGb)} GB</p>
            <Progress value={Math.min(100, estimate.freeEgressPct)} className="h-1 mt-0.5" indicatorClassName={usageBarClass(estimate.freeEgressPct)} />
          </div>
          <div className="rounded border border-slate-200 px-1.5 py-0.5 min-w-0">
            <p className="text-[9px] text-slate-500">MAU</p>
            <p className="text-xs font-bold tabular-nums">{formatNumber(estimate.mau, 0)}</p>
            <p className="text-[9px] text-slate-500 truncate">{formatNumber(estimate.dailyRequests, 0)} req/g</p>
          </div>
          <div className="rounded border border-slate-200 px-1.5 py-0.5 min-w-0">
            <p className="text-[9px] text-slate-500">Picco conn.</p>
            <p className="text-xs font-bold tabular-nums">{formatNumber(estimate.peakConnections, 0)}</p>
            <Progress value={Math.min(100, estimate.freeConnPct)} className="h-1 mt-0.5" indicatorClassName={usageBarClass(estimate.freeConnPct)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
