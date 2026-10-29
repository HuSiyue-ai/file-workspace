"""Optional server-configured filesystem boundary (never supplied by the UI)."""
import os
from pathlib import Path


def allowed_root():
    value = os.environ.get('FILE_WORKSPACE_ALLOWED_ROOT')
    return Path(value).resolve(strict=True) if value else None


def checked_path(path):
    root = allowed_root()
    if root is not None:
        resolved = path.resolve()
        if not resolved.is_relative_to(root):
            raise ValueError('路径超出服务器配置的工作区范围')
    return path
