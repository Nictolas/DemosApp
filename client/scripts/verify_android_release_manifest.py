#!/usr/bin/env python3
"""Audit the *merged* unsigned Android release manifest from a Draft CI build.

The source AndroidManifest.xml is not enough: Gradle/Capacitor/Firebase may add
permissions and providers during manifest merging. This deliberately does NOT
inspect an AAB signed/uploaded to Google Play or test runtime prompts.
"""
from pathlib import Path
import json
import sys
import xml.etree.ElementTree as ET

NS = "{http://schemas.android.com/apk/res/android}"

# Baseline independently observed in the existing 1.0.10(12) UNSIGNED AAB.
# A change requires explicit review against Google Play Data Safety.
EXPECTED_PERMISSIONS = {
    "android.permission.INTERNET",
    "android.permission.VIBRATE",
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.WAKE_LOCK",
    "com.google.android.c2dm.permission.RECEIVE",
    "community.demos.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
}

def main():
    base = Path("client/android/app/build/intermediates")
    manifests = [
        p for p in base.rglob("AndroidManifest.xml")
        if "release" in p.parts
        and ("merged_manifest" in p.parts or "merged_manifests" in p.parts)
    ]
    if not manifests:
        raise RuntimeError("No Gradle release merged manifest; run :app:processReleaseMainManifest")
    # Prefer the canonical AGP 8.x output if both intermediate variants exist.
    manifests.sort(key=lambda p: (0 if "merged_manifest" in p.parts else 1, str(p)))
    source = manifests[0]
    root = ET.parse(source).getroot()
    declared = [
        p.attrib.get(NS + "name", "")
        for p in root
        if p.tag in {"uses-permission", "uses-permission-sdk-23", "uses-permission-sdk-m"}
    ]
    found = set(declared)
    missing = sorted(EXPECTED_PERMISSIONS - found)
    extra = sorted(found - EXPECTED_PERMISSIONS)
    app = root.find("application")
    if app is None:
        raise RuntimeError("Merged manifest lacks application")
    package = root.attrib.get("package")
    providers = [
        {"name": p.attrib.get(NS + "name"), "exported": p.attrib.get(NS + "exported")}
        for p in app.findall("provider")
    ]
    fileproviders = [p for p in providers if p["name"] == "androidx.core.content.FileProvider"]
    issues = []
    if missing:
        issues.append("missing previously observed permissions: " + ", ".join(missing))
    if extra:
        issues.append("NEW merged permissions need Play Data Safety review: " + ", ".join(extra))
    if package and package != "community.demos":
        issues.append("unexpected applicationId: " + package)
    if app.attrib.get(NS + "allowBackup") != "false":
        issues.append("Android backup not explicitly disabled")
    if app.attrib.get(NS + "usesCleartextTraffic") != "false":
        issues.append("cleartext traffic not explicitly disabled")
    if len(fileproviders) != 1 or fileproviders[0]["exported"] != "false":
        issues.append("FileProvider missing, duplicate or exported")
    report = {
        "scope": "CI-generated UNSIGNED release merged manifest; NOT the Play-delivered bundle",
        "path": str(source),
        "package": package,
        "permissions": sorted(found),
        "expected_count": len(EXPECTED_PERMISSIONS),
        "observed_count": len(declared),
        "application_allowBackup": app.attrib.get(NS + "allowBackup"),
        "application_usesCleartextTraffic": app.attrib.get(NS + "usesCleartextTraffic"),
        "fileprovider_exported": fileproviders[0]["exported"] if len(fileproviders) == 1 else None,
        "issues": issues,
        "next_gate": "Compare signed Play AAB and test permission prompts on two real Android devices",
    }
    out = Path("android-merged-manifest-audit.json")
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if issues:
        raise RuntimeError("Merged Android manifest privacy gate failed")
    print("PASS: merged permissions match existing unsigned 1.0.10 baseline, source hardening intact")

if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("FAIL: " + str(err), file=sys.stderr)
        sys.exit(1)
