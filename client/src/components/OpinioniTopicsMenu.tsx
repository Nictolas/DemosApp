import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Landmark, HeartHandshake, Leaf, PawPrint, GraduationCap, ShieldCheck, TrainFront, Globe2, Vote, Earth, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { loadEncryptedProfile } from "@/pages/Profilo/utils/encryptedProfileVault";
import { OPINION_TOPIC_DEFINITIONS } from "@/lib/opinionTopics";
import { OPINION_TOPIC_COLORS } from "@/lib/opinionTopicColors";
import { topicProgressFromEncryptedProfile, type TopicsProgress } from "@/lib/opinionTopicProgress";

const icons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "landmark": Landmark, "heart-handshake": HeartHandshake, "leaf": Leaf,
  "paw-print": PawPrint, "graduation-cap": GraduationCap, "shield-check": ShieldCheck,
  "train-front": TrainFront, "globe-2": Globe2, "vote": Vote,
  "earth": Earth, "building-2": Building2,
};

export function OpinioniTopicsMenu() {
  const { user, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const [, navigate] = useLocation();
  const [progress, setProgress] = useState<TopicsProgress | null>(null);

  useEffect(() => {
    let active = true;
    setProgress(null);
    const epoch = verifiedPoliticalConsent?.timestamp;
    if (!user?.id || !isSessionVerified || verifiedPoliticalConsent?.granted !== true || !epoch) {
      return;
    }
    // Existing encrypted owner vault only: no network or additional storage.
    void loadEncryptedProfile(user.id).then(profile => {
      if (active) setProgress(topicProgressFromEncryptedProfile(profile, epoch));
    });
    return () => { active = false; };
  }, [user?.id, isSessionVerified, verifiedPoliticalConsent?.granted, verifiedPoliticalConsent?.timestamp]);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto overscroll-contain pb-4 sm:grid-cols-2" aria-label="Categorie tematiche">
      {OPINION_TOPIC_DEFINITIONS.map(topic => {
        const Icon = icons[topic.icon];
        const saved = progress?.[topic.id];
        const palette = OPINION_TOPIC_COLORS[topic.id];
        return (
          <button key={topic.id} type="button"
            className="opinioni-topic-card flex min-h-28 flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition hover:brightness-[0.98] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            data-topic-id={topic.id}
            style={{ "--opinion-topic-accent": palette.primary, backgroundColor: palette.softBg, borderColor: palette.border } as React.CSSProperties}
            onClick={() => navigate(`/opinioni-argomento/${topic.id}`)}>
            <div className="flex items-center gap-3">
              <Icon className="opinioni-topic-card__icon h-6 w-6 shrink-0" style={{ color: palette.primary }} />
              <span className="font-semibold text-slate-900">{topic.title}</span>
            </div>
            <p className="text-sm text-slate-600">{topic.description}</p>
            <div className="mt-auto w-full">
              <p className="mb-1 text-xs text-slate-600">
                {saved ? `${saved.completed} / ${saved.total} · ${saved.percent}%` : "Completamento disponibile dopo il caricamento"}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: palette.border }} role="progressbar"
                aria-label={`Completamento ${topic.title}`}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={saved?.percent}>
                <div className="opinioni-topic-card__progress h-full rounded-full" style={{ width: `${saved?.percent ?? 0}%`, backgroundColor: palette.primary }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
