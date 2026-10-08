#!/usr/bin/env python3
"""Search the BBC Sound Effects archive (sound-effects.bbcrewind.co.uk) from the shell.

Usage: python3 -I scripts/sfx/bbc_search.py [-n 12] "query one" "query two" ...
Prints: id, duration (s), channels, wav size (MB), description, cdName. Stdlib only.
"""
import json, sys, urllib.request

API = "https://sound-effects-api.bbcrewind.co.uk/api/sfx/search"

def search(q, n):
    body = json.dumps({"criteria": {"from": 0, "size": n, "query": q}}).encode()
    req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json", "User-Agent": "hairline-sfx/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main(argv):
    n = 12
    if argv[:1] == ["-n"]:
        n = int(argv[1]); argv = argv[2:]
    for q in argv:
        res = search(q, n)
        print(f"== {q}  ({res.get('total')} hits)")
        for x in res.get("results", []):
            tm = x.get("technicalMetadata", {})
            sz = int(x.get("fileSizes", {}).get("wavFileSize") or 0) / 1e6
            cd = x.get("additionalMetadata", {}).get("cdName", "")
            print(f"  {x['id']}  {x['duration']/1000:7.1f}s ch{tm.get('channels','?')} {sz:6.1f}MB  {x['description'][:110]}  [{cd[:40]}]")

if __name__ == "__main__":
    main(sys.argv[1:])
