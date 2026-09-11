#!/usr/bin/env python3
"""Landlock worker for Keli shell execution. Adapted from personal-agent-rust-spike os_probe."""
import ctypes
import json
import os
import pathlib
import subprocess
import sys

libc = ctypes.CDLL(None, use_errno=True)

LANDLOCK_CREATE_RULESET = 444
LANDLOCK_ADD_RULE = 445
LANDLOCK_RESTRICT_SELF = 446
LANDLOCK_RULE_PATH_BENEATH = 1
PR_SET_NO_NEW_PRIVS = 38

READ_ONLY = 1 | 4 | 8  # execute, read file, read dir
READ_WRITE = (1 << 15) - 1
SYSTEM_READONLY = ("/usr", "/bin", "/lib", "/lib64", "/lib/x86_64-linux-gnu")


class Rule(ctypes.Structure):
    _pack_ = 1
    _fields_ = [("access", ctypes.c_uint64), ("fd", ctypes.c_int32)]


def checked(value: int) -> int:
    if value < 0:
        raise OSError(ctypes.get_errno(), os.strerror(ctypes.get_errno()))
    return value


def probe() -> dict:
    try:
        abi = checked(libc.syscall(LANDLOCK_CREATE_RULESET, 0, 0, 1))
        return {"available": abi >= 1, "landlock_abi": abi, "platform": sys.platform}
    except OSError as e:
        return {"available": False, "error": str(e), "platform": sys.platform}


def _is_within(path: pathlib.Path, root: pathlib.Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _add_path_rule(
    ruleset: int,
    path: pathlib.Path,
    access: int,
    seen: set[pathlib.Path],
    fds: list[int],
) -> None:
    resolved = path.resolve()
    if resolved in seen:
        return
    seen.add(resolved)
    fd = os.open(resolved, os.O_PATH)
    fds.append(fd)
    rule = Rule(access, fd)
    checked(
        libc.syscall(
            LANDLOCK_ADD_RULE,
            ruleset,
            LANDLOCK_RULE_PATH_BENEATH,
            ctypes.byref(rule),
            0,
        )
    )


def apply_landlock(workspace: pathlib.Path, readonly_roots: list[pathlib.Path]) -> None:
    attr = ctypes.c_uint64(READ_WRITE)
    ruleset = checked(libc.syscall(LANDLOCK_CREATE_RULESET, ctypes.byref(attr), 8, 0))
    fds: list[int] = []
    seen: set[pathlib.Path] = set()
    workspace = workspace.resolve()
    workspace.mkdir(parents=True, exist_ok=True)

    _add_path_rule(ruleset, workspace, READ_WRITE, seen, fds)

    for system_root in SYSTEM_READONLY:
        path = pathlib.Path(system_root)
        if path.exists():
            _add_path_rule(ruleset, path, READ_ONLY, seen, fds)

    for root in readonly_roots:
        root = root.resolve()
        if _is_within(workspace, root) or _is_within(root, workspace):
            continue
        root.mkdir(parents=True, exist_ok=True)
        _add_path_rule(ruleset, root, READ_ONLY, seen, fds)

    checked(libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0))
    checked(libc.syscall(LANDLOCK_RESTRICT_SELF, ruleset, 0))
    for fd in fds:
        os.close(fd)
    os.close(ruleset)


def run_confined(payload: dict) -> dict:
    workspace = pathlib.Path(payload["workspace"]).resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    readonly = [pathlib.Path(p).resolve() for p in payload.get("readonly_roots", [])]
    apply_landlock(workspace, readonly)
    command = payload["command"]
    proc = subprocess.run(
        command,
        cwd=str(workspace),
        capture_output=True,
        text=True,
        env={
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(workspace),
            "LANG": "C.UTF-8",
        },
    )
    return {
        "exitCode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--probe":
        print(json.dumps(probe()))
        return
    payload = json.loads(sys.stdin.read())
    print(json.dumps(run_confined(payload)))


if __name__ == "__main__":
    main()
