#!/usr/bin/env python3
"""PreToolUse(Bash) 훅: API 키·비밀 파일(.env 등)을 git에 올리거나 지우는 명령을 막는다.

막는 것
- git add / git commit / git stash 로 비밀 파일이 스테이징·커밋되는 경우
  (경로를 직접 적은 경우 + `git add .`/`-A`/`-u`/`commit -a`처럼 한꺼번에 올리는 경우 모두)
- rm / git rm / unlink / shred / truncate / mv 등으로 비밀 파일을 지우거나 옮기는 경우
  (비밀 파일이 들어 있는 폴더를 rm -r 하는 경우 포함)
막으면 exit 2 + 이유를 stderr로 → Claude Code가 명령을 실행하지 않는다.
"""
import fnmatch, json, os, re, shlex, subprocess, sys

# 비밀 파일 이름 규칙 (파일 이름 기준). firebase-config.js는 공개 설정이라 제외.
SECRET = [".env", ".env.*", "*.env", ".dev.vars", ".dev.vars.*", "*.pem", "*.key", "*.p12", "*.pfx",
          "*.keystore", "*.jks", "id_rsa*", "id_ed25519*", "id_ecdsa*", "*serviceaccount*.json",
          "*service-account*.json", "*credentials*.json", "*-adminsdk-*.json", "secrets.*", ".secrets*",
          ".npmrc", ".netrc", "*.token"]
ALLOW = [".env.example", ".env.sample", ".env.template", "*.example", "*.sample"]

def is_secret(path):
    n = os.path.basename(path.rstrip("/")).lower()
    if not n or any(fnmatch.fnmatch(n, a) for a in ALLOW):
        return False
    return any(fnmatch.fnmatch(n, p) for p in SECRET)

def git(*a):
    try:
        return subprocess.run(["git", *a], capture_output=True, text=True, timeout=10).stdout.splitlines()
    except Exception:
        return []

def changed_files():  # 한꺼번에 올릴 때 대상이 될 파일: 수정·새로 만든(무시되지 않은) 파일
    return git("diff", "--name-only") + git("ls-files", "--others", "--exclude-standard")

def secrets_under(path):
    if os.path.isfile(path) or os.path.islink(path):
        return [path] if is_secret(path) else []
    found = []
    if os.path.isdir(path):
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
            found += [os.path.join(root, f) for f in files if is_secret(f)]
            if len(found) > 20:
                break
    return found

def split_cmds(cmd):
    # && || ; | 줄바꿈으로 나눈 각 명령을 토큰 목록으로
    out = []
    for part in re.split(r"&&|\|\||[;|\n]", cmd):
        try:
            t = shlex.split(part, comments=True)
        except ValueError:
            t = part.split()
        while t and (re.match(r"^\w+=", t[0]) or t[0] in ("sudo", "command", "exec", "env", "xargs", "nohup", "time")):
            t = t[1:]
        if t:
            out.append(t)
    return out

def check(tokens):
    prog = os.path.basename(tokens[0])
    args = tokens[1:]
    if prog == "git":
        # git -C dir ... 같은 앞 옵션 건너뛰기
        i = 0
        while i < len(args) and args[i].startswith("-"):
            i += 2 if args[i] in ("-C", "-c", "--git-dir", "--work-tree") else 1
        if i >= len(args):
            return None
        sub, rest = args[i], args[i + 1:]
        paths = [a for a in rest if not a.startswith("-")]
        if sub in ("add", "stage"):
            bad = [p for p in paths if p not in (".", ":/", "*") and is_secret(p)]
            if any(a in ("-A", "--all", "-u", "--update", ".", ":/", "*") for a in rest) or any(os.path.isdir(p) for p in paths):
                bad += [f for f in changed_files() if is_secret(f)]
            if bad:
                return f"비밀 파일을 git에 올리려 합니다: {', '.join(sorted(set(bad))[:5])}"
        if sub == "commit":
            staged = git("diff", "--cached", "--name-only")
            if any(a == "-a" or a == "--all" or (re.match(r"^-[a-zA-Z]*a", a) and not a.startswith("--")) for a in rest):
                staged += git("diff", "--name-only")
            staged += [p for p in paths if is_secret(p)]
            bad = [f for f in staged if is_secret(f)]
            if bad:
                return f"비밀 파일이 커밋에 들어갑니다: {', '.join(sorted(set(bad))[:5])} (git restore --staged 로 빼 주세요)"
        if sub == "rm":
            bad = [p for p in paths if is_secret(p)] + sum((secrets_under(p) for p in paths if os.path.isdir(p)), [])
            if bad:
                return f"비밀 파일을 지우려 합니다: {', '.join(sorted(set(bad))[:5])}"
        return None
    if prog in ("rm", "unlink", "shred", "truncate", "mv", "srm", "trash", "rmdir"):
        paths = [a for a in args if not a.startswith("-")]
        if prog == "mv" and paths:
            paths = paths[:-1]  # 옮기는 대상만(마지막은 목적지)
        bad = []
        for p in paths:
            bad += [p] if is_secret(p) else secrets_under(p) if os.path.isdir(p) else []
        if bad:
            return f"비밀 파일을 지우거나 옮기려 합니다: {', '.join(sorted(set(bad))[:5])}"
    if prog == "find" and "-delete" in args or prog == "find" and "-exec" in args and "rm" in args:
        if any(is_secret(a.strip("'\"")) for a in args):
            return "find로 비밀 파일을 지우려 합니다"
    if prog == "cp" and len(args) >= 2 and is_secret(args[-1]) and os.path.exists(args[-1]):
        return f"비밀 파일을 덮어쓰려 합니다: {args[-1]}"
    return None

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return 0
    if data.get("cwd"):
        try:
            os.chdir(data["cwd"])
        except Exception:
            pass
    # 셸 리다이렉션으로 비밀 파일을 비우는 경우 (: > .env)
    for m in re.finditer(r"(?<![<>&\d])>\s*([^\s;&|]+)", cmd):
        if is_secret(m.group(1)) and os.path.exists(m.group(1)):
            print(f"[guard-secrets] 비밀 파일을 덮어쓰려 합니다: {m.group(1)}", file=sys.stderr)
            return 2
    for t in split_cmds(cmd):
        why = check(t)
        if why:
            print(f"[guard-secrets] 막음 — {why}\n비밀 파일(.env·키)은 커밋·삭제하지 않습니다. 정말 필요하면 사용자가 직접 터미널에서 하도록 안내하세요.", file=sys.stderr)
            return 2
    return 0

if __name__ == "__main__":
    sys.exit(main())
