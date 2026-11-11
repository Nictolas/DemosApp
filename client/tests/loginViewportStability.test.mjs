import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");

test("mobile layout is detected before the first paint", () => {
  const hook = read("hooks/use-mobile.tsx");
  assert.match(hook, /React\.useState<boolean>\(\(\) =>/);
  assert.match(hook, /window\.innerWidth < MOBILE_BREAKPOINT/);
  assert.doesNotMatch(hook, /React\.useState<boolean \| undefined>\(/);
  assert.match(hook, /mql\.addEventListener\("change", onChange\)/);
  assert.match(hook, /viewMode\?\.isMobilePreview/);
});

test("there is exactly one home-page auth redirect owner", () => {
  const wrapper = read("components/AppWrapper.tsx");
  const landing = read("pages/LandingPage.tsx");
  const authPage = read("pages/auth-page.tsx");
  assert.doesNotMatch(wrapper, /location === ['"]\/['"]\)\s*\{\s*setLocation/);
  assert.match(landing, /if \(user && !isLoading\)\s*\{\s*return <Redirect to="\/profilo" \/>/);
  assert.match(authPage, /if \(user && !isLoading\)\s*\{\s*return <Redirect to="\/profilo" \/>/);
});

test("login fixes do not bypass onboarding or alter the registration wizard", () => {
  const auth = read("hooks/useAuthLogin.ts");
  const wizard = read("pages/registrazione-consensi.tsx");
  const shell = read("components/RobustAppLayout.tsx");
  assert.match(shell, /useLayoutEffect\(\(\) => \{\s*document\.documentElement\.classList\.toggle/);
  assert.match(auth, /localStorage\.setItem\("registrazione_oauth_flow", "1"\)/);
  assert.match(auth, /navigate\("\/registrazione-consensi"\)/);
  assert.match(auth, /window\.location\.href = "\/profilo"/);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.match(wizard, new RegExp("step === " + n));
  }
  assert.match(shell, /location\.startsWith\('\/registrazione'\)/);
});

test("iOS login/profile viewport remains stable even while showing OAuth loaders", () => {
  const layout = read("components/RobustAppLayout.tsx");
  const shell = read("robust-layout.css");
  const css = read("index.css");
  const landing = read("pages/landing-mobile.css");
  assert.match(layout, /const isAuthEntryPage = location === '\/' \|\| location === '\/auth'/);
  assert.match(layout, /isStableAuthViewportRoute = isAuthEntryPage/);
  assert.match(layout, /location === '\/profilo' \|\| location\.startsWith\('\/profilo\/'\)/);
  assert.match(layout, /robust-app-layout--stable-auth-profile/);
  assert.match(layout, /app-main--auth-entry/);
  assert.match(shell, /@supports \(-webkit-touch-callout: none\) and \(height: 100svh\)/);
  assert.match(shell, /\.demos-mobile-layout \.robust-app-layout--stable-auth-profile/);
  assert.doesNotMatch(shell, /\.robust-app-layout:has\(\.landing-mobile\)/);
  assert.doesNotMatch(shell, /transition: all 0\.3s cubic-bezier/);
  assert.match(css, /\.app-main\.app-main--auth-entry \.fade-up-transition/);
  assert.match(css, /\.app-main\.app-main--profile \.fade-up-transition/);
  assert.match(css, /transform: none !important/);
  assert.doesNotMatch(css, /\.app-main:has\(\.registrazione/);
  assert.match(landing, /overflow-y: auto/);
  assert.match(landing, /-webkit-overflow-scrolling: touch/);
});

test("iPhone login methods reserve height while OAuth configuration arrives", () => {
  const card = read("components/AuthCard.tsx");
  const landing = read("pages/landing-mobile.css");
  const wizard = read("pages/registrazione-consensi.tsx");
  assert.match(card, /auth-card-compact__methods space-y-2\.5 p-0/);
  assert.match(card, /oauthConfigLoading && \(!compact \|\| !showAnyAuth\)/);
  assert.match(landing, /@supports \(-webkit-touch-callout: none\)/);
  assert.match(landing, /\.landing-mobile \.auth-card-compact__methods/);
  assert.match(landing, /min-height: 10\.55rem/);
  assert.doesNotMatch(wizard, /auth-card-compact__methods/);
});
