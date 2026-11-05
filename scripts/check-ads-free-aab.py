#!/usr/bin/env python3
"""Fail closed if an unsigned DEMOS Android release bundle includes ad SDK traces.

This checks the *built* AAB, not just Gradle source/dependencies. It is not
an audit of all network calls, user data, or the signed Play-delivered bundle.
"""
from __future__ import annotations

import argparse
import hashlib
import pathlib
import sys
import zipfile

EXPECTED_PACKAGE = b"community.demos"
REQUIRED = (
    "BundleConfig.pb",
    "base/manifest/AndroidManifest.xml",
    "BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb",
)
FORBIDDEN_MANIFEST = (
    b"com.google.android.gms.permission.AD_ID",
    b"com.google.android.gms.ads.APPLICATION_ID",
    b"ca-app-pub-",
)
FORBIDDEN_SDK = (
    b"com/google/android/ump/",
    b"com/google/android/libraries/ads/mobile/sdk/",
    b"com/google/android/gms/ads/",
    b"com.google.android.ump:user-messaging-platform",
    b"com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk",
    b"com.google.android.gms:play-services-ads",
)


def inspect_bundle(bundle: pathlib.Path) -> tuple[int, str]:
    if not bundle.is_file():
        raise ValueError(f"AAB file does not exist: {bundle}")
    digest = hashlib.sha256()
    with bundle.open("rb") as stream:
        while data := stream.read(1024 * 1024):
            digest.update(data)

    with zipfile.ZipFile(bundle) as zip_file:
        names = set(zip_file.namelist())
        for item in REQUIRED:
            if item not in names:
                raise ValueError(f"Missing mandatory AAB entry: {item}")
        manifest = zip_file.read("base/manifest/AndroidManifest.xml")
        if EXPECTED_PACKAGE not in manifest:
            raise ValueError("Unexpected package: missing community.demos in compiled manifest")
        for forbidden in FORBIDDEN_MANIFEST:
            if forbidden in manifest:
                raise ValueError(f"Advertising permission or metadata in compiled manifest: {forbidden.decode()}")

        dex_files = sorted(name for name in names if name.startswith("base/dex/") and name.endswith(".dex"))
        if not dex_files:
            raise ValueError("No compiled DEX files found in the AAB")
        for name in (*dex_files, "BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb"):
            binary = zip_file.read(name)
            for forbidden in FORBIDDEN_SDK:
                if forbidden in binary:
                    raise ValueError(f"Advertising SDK marker in {name}: {forbidden.decode()}")
        if any(name.startswith("META-INF/") and name.upper().endswith((".RSA", ".DSA", ".EC", ".SF")) for name in names):
            raise ValueError("AAB unexpectedly contains jar signature files; CI must verify unsigned candidates only")

    return len(dex_files), digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=pathlib.Path, help="Path to unsigned app-release.aab from Gradle bundleRelease")
    args = parser.parse_args()
    try:
        dex_count, sha = inspect_bundle(args.bundle)
    except (ValueError, OSError, zipfile.BadZipFile) as exc:
        print(f"FAIL ADS-FREE AAB: {exc}", file=sys.stderr)
        return 1
    print(f"PASS ADS-FREE AAB: package=community.demos, dex_files={dex_count}, sha256={sha}")
    print("PASS: no AdMob App ID/AD_ID in binary manifest, no selected Ads/UMP SDK markers in DEX or dependency metadata")
    print("Scope: unsigned CI artifact only, not Play-signed AAB or full Data Safety validation")
    return 0


if __name__ == "__main__":
    sys.exit(main())
