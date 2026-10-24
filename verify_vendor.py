"""Verify bundled frontend assets against the repository's fixed SHA-256 manifest."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent


def main():
    expected=json.loads((ROOT/'vendor/SHA256SUMS.json').read_text(encoding='utf-8'))
    actual={p.relative_to(ROOT/'vendor').as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (ROOT/'vendor').rglob('*') if p.is_file() and p.name!='SHA256SUMS.json'}
    if actual!=expected:raise SystemExit('Vendor assets changed; verify their source and update the integrity manifest intentionally.')
    print(f'PASS: {len(actual)} bundled asset hashes')


if __name__=='__main__':main()
