"""Archive committed sources only; never ship local runtimes or generated paths."""
import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD', help='Git commit/tree to archive')
    options = parser.parse_args()
    version = subprocess.check_output(['git', 'show', f'{options.ref}:VERSION'], cwd=ROOT, text=True).strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+-linux\.\d+', version):
        raise SystemExit('Expected a Linux preview version in VERSION')
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    archive = output / f'file-workspace-{version}-linux-source.tar.gz'
    if archive.exists():
        raise SystemExit(f'Refusing to overwrite {archive}')
    prefix = f'file-workspace-{version}/'
    subprocess.run(['git', 'archive', '--format=tar.gz', f'--prefix={prefix}', f'--output={archive}', options.ref], cwd=ROOT, check=True)
    with tarfile.open(archive) as stream:
        names = {entry.name.removeprefix(prefix).rstrip('/') for entry in stream.getmembers()}
        forbidden = {'.runtime', '.venv', 'plugins', '.git', 'backups', 'dist'}
        if any((Path(name).parts and Path(name).parts[0] in forbidden) or Path(name).name == '.mcp.json' for name in names):
            raise SystemExit('Archive contains local/generated data; refusing release')
        assert {'VERSION', 'build.py', 'server.py', 'access_policy.py', 'LICENSE', 'docs/linux-ssh-installation.md'}.issubset(names)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output/'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n', encoding='ascii')
    print(f'{archive.name}: {archive.stat().st_size} bytes, SHA256 {digest}')


if __name__ == '__main__':
    main()
