#!/usr/bin/env python3
"""Offline contract tests; no real ADB/device, user data or screenshots."""
import contextlib
import io
import subprocess
import unittest
from unittest.mock import patch

from play_store_screenshot_guard import (
    EXPECTED_PACKAGE, GateError, check_device, convert_png_for_play,
    main, parse_package_metadata, validate_capture_name,
)

GOOD = "Package [community.demos]\nversionCode=14 minSdk=24 targetSdk=36\nversionName=1.0.11\npkgFlags=[ HAS_CODE ]"


def runner_factory(detail=GOOD, state=b"device\n", packages=b"package:community.demos\n"):
    def runner(argv, capture_output=False, check=False, timeout=None):
        if argv[-1] == "get-state":
            payload = state
        elif argv[-4:] == ["shell", "pm", "list", "packages", EXPECTED_PACKAGE]:
            payload = packages
        elif argv[-3:] == ["shell", "dumpsys", "package", EXPECTED_PACKAGE]:
            payload = detail.encode()
        else:
            raise AssertionError("Unexpected ADB invocation " + repr(argv))
        return subprocess.CompletedProcess(argv, 0, stdout=payload)
    return runner


class PlayScreenshotGuardTests(unittest.TestCase):
    def test_accepts_only_exact_play_package_and_target_release(self):
        invoke, details = check_device("adb", "emulator-5584", runner=runner_factory())
        self.assertEqual(details["version_code"], 14)
        self.assertEqual(details["version_name"], "1.0.11")
        self.assertEqual(details["play_track_provenance"], "NOT_ATTESTED")
        self.assertTrue(callable(invoke))

    def test_rejects_code13_even_when_version_name_matches(self):
        with self.assertRaisesRegex(GateError, "Version mismatch"):
            check_device("adb", "emulator-5584",
                         runner=runner_factory(detail=GOOD.replace("versionCode=14", "versionCode=13")))

    def test_rejects_old_110_build(self):
        with self.assertRaisesRegex(GateError, "Version mismatch"):
            check_device("adb", "emulator-5584",
                         runner=runner_factory(detail=GOOD.replace("1.0.11", "1.0.10")))

    def test_rejects_debug_build_even_with_correct_version(self):
        with self.assertRaisesRegex(GateError, "Debuggable"):
            check_device("adb", "emulator-5584",
                         runner=runner_factory(detail=GOOD.replace("HAS_CODE", "HAS_CODE DEBUGGABLE")))

    def test_rejects_missing_wrong_package_and_offline_device(self):
        for kwargs in (
            dict(packages=b"package:community.demos.qaopen\n"),
            dict(state=b"offline\n")
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(GateError):
                check_device("adb", "emulator-5584", runner=runner_factory(**kwargs))

    def test_rejects_invalid_serial_and_application_id_before_adb(self):
        for serial in ("serial;rm", "../../foo", "", " "*4):
            with self.subTest(serial=serial), self.assertRaisesRegex(GateError, "serial"):
                check_device("adb", serial, runner=runner_factory())
        with self.assertRaisesRegex(GateError, "application ID"):
            check_device("adb", "emulator-5584", package="community.demos.qaopen",
                         runner=runner_factory())

    def test_rejects_unverified_capture_name_traversal(self):
        for name in ("../secrets", "a/b", "a.png", "..", "", "\\bad"):
            with self.subTest(name=name), self.assertRaises(GateError):
                validate_capture_name(name)
        self.assertEqual(validate_capture_name("screenshot_opinioni_01"), "screenshot_opinioni_01")

    def test_rejects_non_png_and_invalid_cropping_before_writing(self):
        for payload, top, bottom in ((b"not a png", 0, 0), (b"not a png", -1, 0)):
            with self.subTest(top=top), self.assertRaises(GateError):
                convert_png_for_play(payload, top, bottom)

    def test_check_only_has_no_screen_capture(self):
        import play_store_screenshot_guard as guard
        with patch.object(guard, "check_device", return_value=(lambda *a, **k: None,
                  {"package": EXPECTED_PACKAGE, "version_code": 14, "version_name": "1.0.11"})):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(main(["--serial", "emulator-5584", "--check-only"]), 0)
            self.assertIn("PACKAGE_VERSION_PASS", out.getvalue())

    def test_refuses_capture_without_synthetic_attestation_before_screencap(self):
        import play_store_screenshot_guard as guard
        calls = []
        def invoke(*args, **kwargs):
            calls.append(args)
            raise AssertionError("Screenshot must not be taken")
        with patch.object(guard, "check_device", return_value=(invoke, {})):
            errors = io.StringIO()
            with contextlib.redirect_stderr(errors):
                self.assertEqual(main(["--serial", "emulator-5584", "--capture", "opinioni"]), 2)
            self.assertEqual(calls, [])
            self.assertIn("synthetic-account", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
