import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import Preferiti from "@/pages/Preferiti";
import Opinioni from "@/pages/Opinioni";
import Eventi from "@/pages/Eventi";
import Menu from "@/pages/Menu";
import Impostazioni from "@/pages/Impostazioni";
import Profilo from "@/pages/Profilo";
import "@/index.css";
import "@/robust-layout.css";

const SCREEN_COMPONENTS = {
  preferiti: Preferiti,
  opinioni: Opinioni,
  eventi: Eventi,
  menu: Menu,
  impostazioni: Impostazioni,
  profilo: Profilo,
} as const;

type ScreenName = keyof typeof SCREEN_COMPONENTS;

const syntheticUser = {
  id: "demos-responsive-audit-user",
  email: "responsive-audit@demos.invalid",
  name: "DEMOS Responsive Audit",
  nome: "DEMOS",
  cognome: "Audit",
  ruolo: "E",
  role: "E",
  status: "a",
  comune_residenza: "Pisa",
  regione: "Toscana",
  account_type: "PERSON" as const,
  is_admin: false,
  is_activist: false,
  is_candidate: false,
  is_politician: false,
  capabilities: {
    accountType: "PERSON" as const,
    isAdmin: false,
    isActivist: false,
    isCandidate: false,
    isPolitician: false,
  },
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installAuditFetch() {
  const originalFetch = window.fetch.bind(window);
  (window as any).__DEMOS_AUDIT_ORIGINAL_FETCH__ = originalFetch;

  window.fetch = async (input: RequestInfo | URL) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, window.location.origin);
    const path = url.pathname;

    if (path.endsWith("/api/eventi") || path.endsWith("/api/eventi/admin/pending")) {
      return jsonResponse({
        success: true,
        data: [{
          id: "responsive-audit-event",
          nome_evento: "Manifestazione nazionale per democrazia partecipativa e trasparenza istituzionale",
          tipologia_evento: "Manifestazione",
          organizzatore: "Coordinamento civico territoriale DEMOS per la partecipazione democratica",
          regione_evento: "Toscana",
          provincia_evento: "Pisa",
          comune_evento: "San Giuliano Terme",
          indirizzo_evento: "Piazza pubblica con una descrizione volutamente lunga per stressare il layout mobile",
          giorno_inizio: "2026-10-17",
          orario_inizio: "17:00",
          orario_fine: "20:30",
          creator_user_id: "another-audit-user",
          approval_status: "APPROVED",
        }],
      });
    }
    if (path.endsWith("/auth/identity/status")) {
      return jsonResponse({ success: true, identity: { verified: false } });
    }
    if (path.endsWith("/api/users/me")) {
      return jsonResponse({
        success: true,
        user: {
          ...syntheticUser,
          nome: "Alessandromassimiliano",
          cognome: "Responsività-Democratica",
          data_nascita: "1990-01-01",
          genere: "Non specificato",
          cittadinanza: "Italia",
          paese_residenza: "Italia",
          regione_residenza: "Toscana",
          provincia_residenza: "Pisa",
          avatar_config: null,
        },
      });
    }
    if (path.endsWith("/api/opinioni/profile")) {
      return jsonResponse({ success: true, data: { opinioni: [] } });
    }
    if (path.endsWith("/api/governo/ideale")) {
      return jsonResponse({ success: true, data: {} });
    }
    if (path.endsWith("/api/rappresentanti")) {
      return jsonResponse({ success: true, data: { rappresentanti: {} } });
    }
    if (path.endsWith("/api/candidati/selezioni")) {
      return jsonResponse({ success: true, data: { candidati: {} } });
    }
    if (path.includes("/api/notific") || path.includes("/api/iniziative") || path.includes("/api/referendum")) {
      return jsonResponse({ success: true, data: [] });
    }

    return jsonResponse({ success: true, data: [], count: 0 });
  };
}

function collectAudit(screen: ScreenName) {
  const root = document.documentElement;
  const body = document.body;
  const appMain = document.querySelector<HTMLElement>(".app-main");
  const page = document.querySelector<HTMLElement>("[data-audit-screen-host]");
  const failures: string[] = [];
  const tolerance = 2;

  const viewportWidth = root.clientWidth;
  if (root.scrollWidth > viewportWidth + tolerance || body.scrollWidth > viewportWidth + tolerance) {
    failures.push(`horizontal-document-overflow:${Math.max(root.scrollWidth, body.scrollWidth)}>${viewportWidth}`);
  }

  if (appMain && appMain.scrollWidth > appMain.clientWidth + tolerance) {
    failures.push(`horizontal-main-overflow:${appMain.scrollWidth}>${appMain.clientWidth}`);
  }

  if (page && page.scrollWidth > page.clientWidth + tolerance) {
    failures.push(`horizontal-screen-overflow:${page.scrollWidth}>${page.clientWidth}`);
  }

  const interactive = [...document.querySelectorAll<HTMLElement>("button,a,input,select,textarea,[role='button']")]
    .filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
    });

  for (const [index, el] of interactive.entries()) {
    const rect = el.getBoundingClientRect();
    if (rect.left < -tolerance || rect.right > viewportWidth + tolerance) {
      failures.push(`interactive-${index + 1}-horizontal-clip:${Math.round(rect.left)}..${Math.round(rect.right)}`);
      if (failures.length >= 10) break;
    }
  }

  const result = failures.length ? "FAIL" : "PASS";
  body.dataset.auditResult = result;
  body.dataset.auditFailures = failures.join(" | ");
  body.dataset.auditScreen = screen;
  document.title = `${result} — ${screen} — ${innerWidth}x${innerHeight}`;

  const badge = document.getElementById("audit-status");
  if (badge) {
    badge.dataset.pass = String(result === "PASS");
    badge.textContent = `${result} | ${screen} | ${innerWidth}x${innerHeight}${failures.length ? ` | ${failures.join(" ; ")}` : ""}`;
  }
}

function AuditApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requested = (params.get("screen") || "preferiti") as ScreenName;
  const screen: ScreenName = requested in SCREEN_COMPONENTS ? requested : "preferiti";
  const android = params.get("android") === "1";
  const Screen = SCREEN_COMPONENTS[screen];
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    queryClient.clear();
    localStorage.setItem("auth_token", "audit.synthetic.token");
    document.documentElement.classList.add("demos-mobile-layout");
    document.documentElement.classList.remove("demos-desktop-layout");
    document.body.classList.toggle("android-device", android);
    document.body.classList.toggle("device-android", android);
    document.body.classList.add("device-mobile", "device-portrait");
    const timer = window.setTimeout(() => setSettled(true), 900);
    return () => window.clearTimeout(timer);
  }, [android]);

  useEffect(() => {
    if (!settled) return;
    requestAnimationFrame(() => requestAnimationFrame(() => collectAudit(screen)));
  }, [settled, screen]);

  const authValue = {
    user: syntheticUser,
    isLoading: false,
    isError: false,
    isAuthenticated: true,
    logoutMutation: { mutate: () => undefined, isPending: false } as any,
  };

  return (
    <AuthContext.Provider value={authValue as any}>
      <QueryClientProvider client={queryClient}>
        <div className="robust-app-layout">
          <div className="robust-app-layout__content">
            <main className="app-main">
              <div className="app-main__inner" data-audit-screen-host>
                <Screen />
              </div>
            </main>
            <nav className="app-navbar navbar-visible" aria-label="Audit navbar spacer">
              <div className="app-bottom-nav" style={{ minHeight: "60px" }} />
            </nav>
          </div>
        </div>
        <div id="audit-status" className="audit-status">AUDIT IN ESECUZIONE…</div>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}

installAuditFetch();

const mount = document.getElementById("root");
if (!mount) throw new Error("Audit root missing");
createRoot(mount).render(<AuditApp />);
