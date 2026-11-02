#!/usr/bin/env python3
"""Fail-closed QA capture for Android Google Play phone screenshots.

Run only on an authorized test device with synthetic data:
  python client/scripts/play_store_screenshot_guard.py --serial emulator-5584 --check-only
  python client/scripts/play_store_screenshot_guard.py --serial emulator-5584 \
    --capture opinioni --synthetic-account-reviewed --crop-top 190 --crop-bottom 290

Never uploads images to Google Play. A human must approve images and verify
that the APK came from the intended Play test track before publishing.
"""
import argparse
import hashlib
import io
import json
import re
import subprocess
import sys
from pathlib import Path

EXPECTED_PACKAGE = "community.demos"
EXPECTED_VERSION_NAME = "1.0.11"
EXPECTED_VERSION_CODE = 14
PNG_HEADER = b"\x89PNG\r\n\x1a\n"


class GateError(Exception):
    pass


def parse_package_metadata(detail):
    code = re.search(r"\bversionCode=(\d+)\b", detail)
    name = re.search(r"\bversionName=([^\s]+)", detail)
    if not code or not name:
        raise GateError("Unable to attest installed package version")
    if re.search(r"\bDEBUGGABLE\b", detail):
        raise GateError("Debuggable Android package is not a Play release candidate")
    return int(code.group(1)), name.group(1)


def check_device(adb, serial, package=EXPECTED_PACKAGE,
                 version_code=EXPECTED_VERSION_CODE,
                 version_name=EXPECTED_VERSION_NAME, runner=subprocess.run):
    if not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,80}", serial):
        raise GateError("Invalid ADB device serial")
    if package != EXPECTED_PACKAGE:
        raise GateError("Wrong Android application ID for DEMOS")
    base = [adb, "-s", serial]
    def invoke(*command, binary=False):
        try:
            result = runner(base + list(command), capture_output=True, check=True,
                            timeout=25)
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise GateError("ADB command failed: " + " ".join(command)) from exc
        return result.stdout if binary else result.stdout.decode("utf-8", "replace").strip()
    if invoke("get-state") != "device":
        raise GateError("Target is not an online Android device")
    packages = invoke("shell", "pm", "list", "packages", package).splitlines()
    if "package:" + package not in packages:
        raise GateError("DEMOS is not installed with expected application ID")
    detail = invoke("shell", "dumpsys", "package", package)
    code, name = parse_package_metadata(detail)
    if (code, name) != (version_code, version_name):
        raise GateError("Version mismatch: installed %s (%s), required %s (%s)"
                        % (name, code, version_name, version_code))
    return invoke, {"serial": serial, "package": package,
                    "version_code": code, "version_name": name,
                    "play_track_provenance": "NOT_ATTESTED"}


def validate_capture_name(name):
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,60}", name or ""):
        raise GateError("Capture name must be a simple filename without paths")
    return name


def convert_png_for_play(data, crop_top, crop_bottom):
    if not data.startswith(PNG_HEADER):
        raise GateError("ADB screenshot was not a PNG")
    if crop_top < 0 or crop_bottom < 0:
        raise GateError("Cropping cannot be negative")
    try:
        from PIL import Image
    except ImportError as exc:
        raise GateError("Pillow is required for verified 24-bit RGB screenshots") from exc
    try:
        with Image.open(io.BytesIO(data)) as source:
            source.verify()
        with Image.open(io.BytesIO(data)) as source:
            width, height = source.size
            if height - crop_top - crop_bottom <= 0:
                raise GateError("Cropping removes the full image")
            image = source.crop((0, crop_top, width, height - crop_bottom)).convert("RGB")
            short, long = sorted(image.size)
            if short < 320 or long > 3840 or long > 2 * short:
                raise GateError("Google Play dimensions invalid; choose explicit crop")
            out = io.BytesIO()
            image.save(out, format="PNG", optimize=True)
            result = out.getvalue()
    except GateError:
        raise
    except Exception as exc:
        raise GateError("Screenshot validation failed") from exc
    if result[25] != 2:  # PNG IHDR colour type 2 = 24-bit truecolour, no alpha.
        raise GateError("Output must be 24-bit RGB PNG with no alpha channel")
    return result, (width, height), image.size


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--serial", required=True, help="ADB device serial from adb devices")
    p.add_argument("--adb", default="adb", help="ADB executable path")
    p.add_argument("--check-only", action="store_true", help="Do not capture any pixels")
    p.add_argument("--capture", help="Simple output basename, e.g. opinioni")
    p.add_argument("--synthetic-account-reviewed", action="store_true",
                   help="Confirms ONLY synthetic content is on screen; manual review remains mandatory")
    p.add_argument("--crop-top", type=int, default=0)
    p.add_argument("--crop-bottom", type=int, default=0)
    p.add_argument("--output-dir", default="play-store/qa_candidate_1.0.11_14")
    args = p.parse_args(argv)
    try:
        invoke, metadata = check_device(args.adb, args.serial)
        if args.check_only:
            print(json.dumps({"gate": "PACKAGE_VERSION_PASS", **metadata}, indent=2))
            return 0
        if not args.capture:
            raise GateError("Specify --check-only or --capture")
        validate_capture_name(args.capture)
        if not args.synthetic_account_reviewed:
            raise GateError("Refusing screenshot without synthetic-account confirmation")
        image, before, after = convert_png_for_play(
            invoke("exec-out", "screencap", "-p", binary=True),
            args.crop_top, args.crop_bottom
        )
        folder = Path(args.output_dir).resolve()
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / (args.capture + ".png")
        if target.exists():
            raise GateError("Refusing to overwrite a previously reviewed screenshot")
        target.write_bytes(image)
        metadata.update({
            "gate": "CAPTURE_QA_ONLY",
            "source_dimensions": list(before), "png_dimensions": list(after),
            "sha256": hashlib.sha256(image).hexdigest(),
            "file": str(target),
            "synthetic_content": "USER_ATTESTED_NOT_AUTOMATICALLY_VERIFIED",
            "manual_preview_approved": False,
            "play_upload_approved": False,
        })
        print(json.dumps(metadata, indent=2))
        return 0
    except GateError as exc:
        print("NO_GO: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
