"""List every X.509 certificate in an APK's signing block, with its block ID and SHA-256.

Usage: python3 -I scripts/apk-signing-certs.py path/to/base.apk

For app/assetlinks.json: Play signs store installs with certificates Play Console only partly
shows (the Android 17+ hybrid signer is missing there, and apksigner hides it). Pull a
Play-installed APK (adb shell pm path in.spanion.dino.twa, then adb pull its base.apk) and list
every fingerprint here. Never list the source stamp block (0x6dff800d): it is Play's own.
Reads bytes only. Each DER certificate is found by its SEQUENCE header and checked by
asking openssl to parse it.
"""
import hashlib
import struct
import subprocess
import sys

NAMES = {
    0x7109871A: "v2",
    0xF05368C0: "v3",
    0x1B93AD61: "v3.1",
    0x6DFF800D: "source stamp v2",
    0x2B09189E: "source stamp v1",
    0x42726577: "padding",
}


def signing_block(data):
    eocd = data.rfind(b"PK\x05\x06")
    cd_offset = struct.unpack_from("<I", data, eocd + 16)[0]
    magic = data[cd_offset - 16 : cd_offset]
    assert magic == b"APK Sig Block 42", "no APK signing block"
    size = struct.unpack_from("<Q", data, cd_offset - 24)[0]
    start = cd_offset - size - 8
    pos, end = start + 8, cd_offset - 24
    while pos < end:
        length = struct.unpack_from("<Q", data, pos)[0]
        block_id = struct.unpack_from("<I", data, pos + 8)[0]
        yield block_id, data[pos + 12 : pos + 8 + length]
        pos += 8 + length


def der_length(buf, i):
    first = buf[i]
    if first < 0x80:
        return first, 1
    n = first & 0x7F
    return int.from_bytes(buf[i + 1 : i + 1 + n], "big"), 1 + n


def certificates(value):
    seen = set()
    i = 0
    while i < len(value) - 4:
        if value[i] == 0x30 and value[i + 1] in (0x82, 0x83):
            length, size = der_length(value, i + 1)
            der = value[i : i + 1 + size + length]
            inner = 1 + size
            if len(der) == 1 + size + length and der[inner] == 0x30:
                ok = subprocess.run(
                    ["openssl", "x509", "-inform", "DER", "-noout", "-subject"],
                    input=der,
                    capture_output=True,
                )
                if ok.returncode == 0:
                    digest = hashlib.sha256(der).hexdigest().upper()
                    if digest not in seen:
                        seen.add(digest)
                        yield der, ok.stdout.decode().strip(), digest
                    i += len(der)
                    continue
        i += 1


def main(path):
    data = open(path, "rb").read()
    for block_id, value in signing_block(data):
        name = NAMES.get(block_id, "unknown")
        for der, subject, digest in certificates(value):
            key = subprocess.run(
                ["openssl", "x509", "-inform", "DER", "-noout", "-text"],
                input=der,
                capture_output=True,
            ).stdout.decode()
            algo = next(
                (l.split(":", 1)[1].strip() for l in key.splitlines() if "Public Key Algorithm" in l),
                "?",
            )
            pretty = ":".join(digest[j : j + 2] for j in range(0, 64, 2))
            print(f"block 0x{block_id:08x} ({name}) | {algo} | {subject}\n  SHA256 {pretty}")


main(sys.argv[1])
