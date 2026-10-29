"""Check local documentation links, heading anchors and images without network access."""
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent


class References(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get('id'):
            self.ids.add(values['id'])
        if tag == 'a' and values.get('name'):
            self.ids.add(values['name'])
        for attribute in ('href', 'src'):
            if values.get(attribute):
                self.urls.append(values[attribute])


def plain_source(text):
    return re.sub(r'(?ms)^\s*(`{3,}|~{3,})[^\n]*\n.*?^\s*\1[^\n]*(?:\n|$)', '', text)


def anchors(text):
    source = plain_source(text)
    parser = References()
    parser.feed(source)
    result = set(parser.ids)
    counts = {}
    for match in re.finditer(r'^ {0,3}#{1,6}\s+(.+?)\s*#*$', source, re.M):
        value = re.sub(r'<[^>]*>', '', match[1])
        value = re.sub(r'!?\[([^\]]+)\]\([^)]*\)', r'\1', value)
        value = re.sub(r'[^\w\- ]', '', unescape(value).lower()).replace(' ', '-')
        count = counts.get(value, 0)
        counts[value] = count + 1
        result.add(value if count == 0 else f'{value}-{count}')
    return result


def main():
    pages = sorted(set(ROOT.glob('README*.md')) | set((ROOT/'docs').rglob('*.md')) |
                   {ROOT/'CONTRIBUTING.md', ROOT/'CHANGELOG.md', ROOT/'THIRD-PARTY-NOTICES.md'})
    failures = []
    total = 0
    for page in pages:
        source = plain_source(page.read_text(encoding='utf-8'))
        parser = References()
        parser.feed(source)
        urls = parser.urls + [a or b for a, b in re.findall(r'!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)', source)]
        for url in urls:
            parts = urlsplit(unescape(url))
            repo_prefix = '/HuSiyue-ai/file-workspace/blob/main/'
            if parts.netloc == 'github.com' and parts.path.startswith(repo_prefix):
                target = (ROOT/unquote(parts.path.removeprefix(repo_prefix))).resolve()
            elif parts.scheme or parts.netloc:
                continue
            else:
                target = (page.parent/unquote(parts.path)).resolve() if parts.path else page
            total += 1
            if not target.is_relative_to(ROOT):
                failures.append(f'{page.relative_to(ROOT)}: outside repository: {url}')
            elif not target.exists():
                failures.append(f'{page.relative_to(ROOT)}: missing target: {url}')
            elif parts.fragment and target.suffix.lower() == '.md':
                if unquote(parts.fragment) not in anchors(target.read_text(encoding='utf-8')):
                    failures.append(f'{page.relative_to(ROOT)}: missing anchor: {url}')
    if failures:
        raise SystemExit('\n'.join(failures))
    print(f'PASS: {len(pages)} documentation pages, {total} local links/anchors/images')


if __name__ == '__main__':
    main()
