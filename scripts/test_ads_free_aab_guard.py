"""Synthetic, no-user-data tests of the release AAB advertising exclusion gate."""
from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = pathlib.Path(__file__).with_name("check-ads-free-aab.py")


class AdsFreeAabGuardTests(unittest.TestCase):
    def _check(self, *, manifest=b"package:community.demos", dex=b"dex-safe",
               metadata=b"google-auth-only", omit=None):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "candidate.aab"
            entries = {
                "BundleConfig.pb": b"test-bundle",
                "base/manifest/AndroidManifest.xml": manifest,
                "base/dex/classes.dex": dex,
                "BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb": metadata,
            }
            if omit:
                entries.pop(omit)
            with zipfile.ZipFile(path, mode="w") as archive:
                for name, content in entries.items():
                    archive.writestr(name, content)
            return subprocess.run([sys.executable, str(SCRIPT), str(path)],
                                  capture_output=True, text=True, check=False)

    def test_ads_free_bundle_passes(self):
        result = self._check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PASS ADS-FREE AAB", result.stdout)

    def test_rejects_advertising_id_permission(self):
        result = self._check(manifest=b"community.demos com.google.android.gms.permission.AD_ID")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("AD_ID", result.stderr)

    def test_rejects_admob_app_id_metadata(self):
        result = self._check(manifest=b"community.demos com.google.android.gms.ads.APPLICATION_ID")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("APPLICATION_ID", result.stderr)

    def test_rejects_publisher_test_id_in_manifest(self):
        result = self._check(manifest=b"community.demos ca-app-pub-3940256099942544")
        self.assertNotEqual(result.returncode, 0)

    def test_rejects_admob_sdk_in_dex(self):
        result = self._check(dex=b"com/google/android/libraries/ads/mobile/sdk/")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SDK marker", result.stderr)

    def test_rejects_ump_in_dependency_metadata(self):
        result = self._check(metadata=b"com.google.android.ump:user-messaging-platform:4.0.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SDK marker", result.stderr)

    def test_rejects_missing_dependency_metadata(self):
        result = self._check(omit="BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing mandatory", result.stderr)

    def test_rejects_wrong_package(self):
        result = self._check(manifest=b"package:com.example.different")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unexpected package", result.stderr)

    def test_rejects_missing_dex(self):
        result = self._check(omit="base/dex/classes.dex")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("No compiled DEX", result.stderr)


if __name__ == "__main__":
    unittest.main()
