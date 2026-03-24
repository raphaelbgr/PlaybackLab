# Bug Report: `--chrome-native-host` crashes with Bun assertion failure on Windows

## Environment

- **Claude Code version**: 2.1.37 (also tested 2.1.36, 2.1.30, 2.1.0 — all crash)
- **OS**: Windows 11 (22631.6199)
- **CPU**: x64 (sse42 avx avx2)
- **RAM**: 68.53 GB
- **Chrome version**: Latest (with Claude in Chrome extension v1.0.47)
- **Extension ID**: fcoeoabgfenejglbffodgkkbkcdhcgfn

## Description

The `claude.exe --chrome-native-host` command crashes immediately on startup with a Bun internal assertion failure on Windows. This prevents the Claude in Chrome browser automation feature from working entirely.

The crash occurs after the socket listener path is created but before any messages are processed.

## Steps to Reproduce

1. Install Claude Code on Windows (any version with Chrome support: 2.1.0+)
2. Install the "Claude in Chrome" extension from Chrome Web Store
3. Start Claude Code with `--chrome` flag
4. Any attempt to use `mcp__claude-in-chrome__*` tools fails with "Browser extension is not connected"

Or reproduce directly:
```
"C:\Users\<user>\.local\bin\claude.exe" --chrome-native-host
```

## Crash Output

```
[Claude Chrome Native Host] Initializing...
[Claude Chrome Native Host] Creating socket listener: \\.\pipe\claude-mcp-browser-bridge-<user>
============================================================
Bun Canary v1.3.9-canary.51 (d5628db2) Windows x64 (baseline)
Windows v.win11_ge
CPU: sse42 avx avx2
Args: "C:\Users\<user>\.local\bin\claude.exe" "--chrome-native-host"
Features: Bun.stdin(2) jsc standalone_executable
Builtins: "bun:main" "node:buffer" "node:child_process" "node:crypto" "node:fs" ...
Elapsed: 92ms | User: 0ms | Sys: 15ms
RSS: 0.32GB | Peak: 0.32GB | Commit: 0.47GB | Faults: 78279 | Machine: 68.53GB

panic(main thread): Internal assertion failure
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

**Bun crash report**: https://bun.report/1.3.9/e_2d5628dbEkgggC+s1oU+vvkOu8t/uBysi5uB__qt24tCA0eNrzzCtJLcpLzFFILC5OLSrJzM9TSEvMzCktSgUAiSkKPg

## Versions Tested

| Claude Code | Bun Version | Result |
|-------------|-------------|--------|
| 2.1.37 | Bun Canary v1.3.9-canary.51 | Crash |
| 2.1.36 | Bun Canary v1.3.9-canary.51 | Crash |
| 2.1.30 | Bun v1.3.5 | Crash |
| 2.1.0 | Bun v1.3.5 | Crash |
| 2.0.0 | N/A | `--chrome-native-host` not supported |

## Analysis

The crash appears to be in Bun's `stdin` handling (`Bun.stdin(2)`) when used as a Windows standalone executable. The native messaging host protocol requires reading length-prefixed binary messages from stdin (piped from Chrome), and this triggers the Bun assertion failure.

**Key observations:**
- Crash happens regardless of whether Chrome is the caller or stdin is `/dev/null`
- Same crash across multiple Bun versions (1.3.5 and 1.3.9-canary.51)
- The named pipe path `\\.\pipe\claude-mcp-browser-bridge-<user>` is created but never becomes functional
- All native messaging host configuration is correct (registry, JSON manifest, bat file, extension permissions)

## Verified Configuration

- Registry: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.anthropic.claude_code_browser_extension` → points to correct JSON
- JSON manifest: correct `allowed_origins`, correct `path` to bat file
- Bat file: correctly calls `claude.exe --chrome-native-host`
- Extension: enabled, correct ID, correct permissions including "Communicate with cooperating native applications"
- No Chrome enterprise policies blocking native messaging

## Expected Behavior

`claude.exe --chrome-native-host` should start, create the named pipe, and bridge Chrome native messaging to the MCP browser server without crashing.

## Impact

Claude in Chrome browser automation is completely non-functional on Windows. The `--chrome` flag has no effect since the native messaging host crashes on every invocation.
