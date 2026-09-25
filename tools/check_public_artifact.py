#!/usr/bin/env python3
"""Fail closed on source PDFs, keys, private history, or source metadata leaking into Pages."""
from pathlib import Path
import sys

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else "dist")
FORBIDDEN_SUFFIX={".pdf",".docx",".pem",".key"}
FORBIDDEN_NAMES={
  "questions.local.json","scoring.json","grading.json","source_pdfs.json",
  "keyring.enc",".env"
}
FORBIDDEN_TERMS=["国語_問題","国語_解答","ROOT_KEY","PRIVATE KEY","github_pat_"]
bad=[]
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts: continue
    if p.suffix.lower() in FORBIDDEN_SUFFIX or p.name in FORBIDDEN_NAMES:
        bad.append(str(p)); continue
    if any(t.lower() in p.name.lower() for t in FORBIDDEN_TERMS):
        bad.append(str(p)); continue
    # Small textual assets can be scanned for accidental secrets/source names.
    if p.stat().st_size < 2_000_000 and p.suffix.lower() in {".html",".js",".css",".json",".md",".txt"}:
        try:
            s=p.read_text(errors="ignore")
            if any(t in s for t in ["github_pat_","ROOT_KEY_B64=","BEGIN PRIVATE KEY"]):
                bad.append(f"sensitive token/key marker: {p}")
        except Exception: pass
size=sum(p.stat().st_size for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts)
if size>900*1024*1024: bad.append(f"artifact too large: {size/1024/1024:.1f} MB")
if bad:
    print("PUBLIC ARTIFACT CHECK FAILED")
    for x in bad: print(" -",x)
    raise SystemExit(1)
print(f"PUBLIC ARTIFACT CHECK OK ({size/1024/1024:.1f} MB)")

