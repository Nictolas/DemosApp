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
  assert.match(auth, /localStorage\.setItem\("registrazione_oauth_flow", "1"\)/);
  assert.match(auth, /navigate\("\/registrazione-consensi"\)/);
  assert.match(auth, /window\.location\.href = "\/profilo"/);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.match(wizard, new RegExp("step === " + n));
  }
  assert.match(shell, /location\.startsWith\('\/registrazione'\)/);
});

test("iOS login/profile viewport is stable without locking registration scroll", () => {
  const shell = read("robust-layout.css");
  const css = read("index.css");
  const landing = read("pages/landing-mobile.css");
  assert.match(shell, /@supports \(-webkit-touch-callout: none\) and \(height: 100svh\)/);
  assert.match(shell, /\.robust-app-layout:has\(\.landing-mobile\)/);
  assert.match(shell, /\.robust-app-layout:has\(\.app-main--profile\)/);
  assert.doesNotMatch(shell, /\.robust-app-layout:has\(\.registrazione/);
  assert.doesNotMatch(shell, /transition: all 0\.3s cubic-bezier/);
  assert.match(css, /\.fade-up-transition:has\(> \.landing-mobile\)/);
  assert.match(css, /\.app-main\.app-main--profile \.fade-up-transition/);
  assert.match(css, /transform: none !important/);
  assert.doesNotMatch(css, /\.app-main:has\(\.registrazione/);
  assert.match(landing, /overflow-y: auto/);
  assert.match(landing, /-webkit-overflow-scrolling: touch/);
});
