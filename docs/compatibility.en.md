# Compatibility and validation

[Documentation](README.en.md) · [简体中文](compatibility.md) · [Installation](installation.en.md) · [Troubleshooting](troubleshooting.en.md)

This page separates source checks, real server tests, and desktop acceptance. **CLI installation, CI success, and a rendered test host do not independently establish a working native desktop entrypoint.**

## Platform status

| Environment | Evidence | Remaining checks |
| :--- | :--- | :--- |
| Windows local desktop | Primary desktop validation environment; viewer demonstrations; Python/Node/PDF CI passed | Not every desktop version or permission configuration is covered |
| Linux / SSH | Real stdio/file tests on Ubuntu 22.04 x86_64, Python 3.12.14, CLI 0.162.1; Linux CI passed | Remote desktop discovery, right-panel menu, actual math/image rendering, interactive saving |
| Linux with a graphical desktop | Python backend and explicit headless configuration can be checked | Native Tkinter picker and full desktop flow unverified |
| macOS, cloud threads, other hosts | No completed end-to-end validation | Host plugin support, entrypoints, paths, permissions, full workflow |

## Completed Linux checks

- Registration as the server login user, using locally generated Python and plugin paths.
- Real MCP stdio process from the installed configuration: handshake, tool list, offline UI resource.
- Current real chat ID resolving to the server project; explicit fallback with missing metadata.
- Markdown and local SVG/PNG under Unicode/space paths, with returned bytes compared to files.
- Dedicated test-document save, backup, readback, and stale-revision rejection.
- Out-of-boundary rejection, parent/symlink escape regressions, and no Tkinter launch in headless mode.

The first server installation did not test PDF. The subsequent release checks added PDF regressions. Linux and Windows passed the [v1.9.0-linux.1 workflow](https://github.com/HuSiyue-ai/file-workspace/actions/runs/40906237859); check [Actions](https://github.com/HuSiyue-ai/file-workspace/actions) for current results.

## Required desktop capabilities

The host needs local plugins, MCP App UI resources, file/thread entrypoints, and forwarding of file paths/chat context to the correct runtime host. Native file opening, project detection, and chat-draft support also depend on the desktop implementation.

The computer and SSH server have separate Python installations, paths, and Codex environments. A server command cannot run directly as a local desktop command. A server installation record is separate from desktop discovery.

## Manual acceptance

Follow the [Linux / SSH desktop acceptance steps](linux-ssh-installation.en.md#desktop-acceptance-check): menu visibility, correct paths, document/math/images, and saving a disposable test file. Include desktop, CLI, Python, and plugin versions plus SSH context in reports.

The [feature gallery](features.en.md) uses the real viewer in an isolated demonstration host with fictional data. It does not claim desktop acceptance on every platform.
