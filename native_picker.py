"""A user-triggered native dialog; no console window, shell, uploads or file reads."""
import json
import sys
from file_reader import SUPPORTED


def main():
    root = None
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        root.update()
        if len(sys.argv)>1 and sys.argv[1]=='directory':
            path=filedialog.askdirectory(parent=root,title='file-workspace — 选择项目文件夹',mustexist=True)
        else:
            path = filedialog.askopenfilename(parent=root, title='file-workspace — 打开文件',
            filetypes=[('PDF、Markdown、图片和文本', ' '.join('*'+suffix for suffix in sorted(SUPPORTED))),
                       ('PDF', '*.pdf'),('Markdown', '*.md *.markdown'),
                       ('图片', '*.png *.jpg *.jpeg *.gif *.webp *.svg *.bmp *.ico *.avif'),
                       ('所有文件', '*.*')])
        result = {'path': path} if path else {'cancelled': True}
    except Exception:
        result = {'error': '无法打开本机文件选择框，请从原生文件标签的“打开”菜单使用 file-workspace。'}
    finally:
        if root is not None:
            root.destroy()
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))


if __name__ == '__main__':
    main()
