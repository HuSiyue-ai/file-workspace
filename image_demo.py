"""Create deterministic local image fixtures without external dependencies."""
from pathlib import Path
import struct
import zlib

def prepare_demo(root):
    root = Path(root); assets=root/'图片样例';assets.mkdir(exist_ok=True)
    def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    width,height=240,120
    pixels=b''.join(b'\0'+bytes(component for x in range(width) for component in (30+x*100//width,120+y*80//height,180-x*80//width)) for y in range(height))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
    (assets/'中文 空格.png').write_bytes(png)
    svg='''<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140" viewBox="0 0 480 140"><rect width="480" height="140" rx="16" fill="#e9f7f2"/><rect x="24" y="32" width="150" height="76" rx="10" fill="#087f70"/><text x="99" y="78" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20">Markdown</text><path d="M190 70H276m-12-12 12 12-12 12" stroke="#087f70" stroke-width="4" fill="none"/><rect x="294" y="32" width="160" height="76" rx="10" fill="white"/><text x="374" y="78" text-anchor="middle" fill="#087f70" font-family="sans-serif" font-size="20">本地图片 ✓</text></svg>'''
    (assets/'示意图.svg').write_text(svg,encoding='utf-8')
    absolute=(assets/'中文 空格.png').resolve()
    sample=root/'本地图片预览示例.md'
    sample.write_text(fr'''# 本地图片与公式预览

## 中文和空格路径

![中文空格 PNG](<图片样例/中文 空格.png>)

## SVG 相对路径

![本地示意图](图片样例/示意图.svg)

## Obsidian 图片与指定宽度

![[图片样例/中文 空格.png|120]]

## file URI

![file URI PNG]({absolute.as_uri()})

## 绝对路径

![绝对路径 PNG](<{absolute.as_posix()}>)

## HTML 图片

<img src="图片样例/中文 空格.png" alt="HTML 图片" width="100">

## 引用式图片

![引用式 PNG][test-image]

[test-image]: <图片样例/中文 空格.png>

## 公式与代码

图片下方的公式 $E=mc^2$ 与 $\frac{{a+b}}{{c+d}}$ 应正常排版。

```markdown
![代码中的图片](图片样例/中文 空格.png)
```

## 路径不存在时的提示

![缺失图片](图片样例/不存在.png)
''',encoding='utf-8')
    return sample

if __name__=='__main__': print(prepare_demo(Path(__file__).parent))
