/**
 * Changes to a single civic choice must not discard unrelated encrypted
 * profile sections. This concerns only successful owner mutations; session
 * authorization and consent revocation use stricter rules.
 */
export type ProfileCacheSection =
  | "full" | "government" | "representatives" | "candidates"
  | "opinions" | "preferences";

export type ProfileMutationImpact = {
  sections: ProfileCacheSection[];
  summary: boolean;
  consent: boolean;
};

export function profileMutationImpact(method: string, url: string): ProfileMutationImpact | null {
  if (method.toUpperCase() === "GET") return null;
  const path = url.split(/[?#]/, 1)[0];

  if (/^\/api\/user\/political-opinions-consent(?:\/|$)/.test(path)) {
    // Revoking or regranting consent is a security boundary, not a normal vote.
    return { sections: [], summary: false, consent: true };
  }
  if (/^\/api\/users\/(?:me|profile)(?:\/|$)/.test(path)) {
    return { sections: ["full"], summary: true, consent: false };
  }
  if (/^\/api\/rappresentanti(?:\/|$)/.test(path)) {
    return { sections: ["representatives", "full"], summary: false, consent: false };
  }
  if (/^\/api\/candidati(?:\/|$)/.test(path)) {
    return { sections: ["candidates", "full"], summary: false, consent: false };
  }
  if (/^\/api\/governo(?:\/|$)/.test(path)) {
    return { sections: ["government"], summary: false, consent: false };
  }
  if (/^\/api\/opinioni(?:\/|$)/.test(path)) {
    return { sections: ["opinions", "full"], summary: false, consent: false };
  }
  if (/^\/api\/(?:capo-stato|grazia|amnistia|iniziative-popolari|sostenitori)(?:\/|$)/.test(path)) {
    return { sections: ["preferences"], summary: false, consent: false };
  }
  if (/^\/api\/(?:attivisti|organizzazioni)\/sostenitori(?:\/|$)/.test(path)) {
    return { sections: ["preferences"], summary: false, consent: false };
  }
  return null;
}
