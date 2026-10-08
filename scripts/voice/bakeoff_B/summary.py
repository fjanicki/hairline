"""Summarise a finals json: per-character F0/VTL/MOS, distinctness matrix over the chosen cast."""
import sys, json, itertools, numpy as np
R = json.load(open(sys.argv[1])); keep = sys.argv[2].split(",") if len(sys.argv) > 2 else None
L = R["lines"]; S = R["sim_matrix"]
ids = [k for k in L if (keep is None or k in keep)]
by = {}
for k in ids: by.setdefault(L[k]["character"], []).append(k)
print(f"{'char':8s} {'lines':14s} {'F0med':>6s} {'VTLcm':>6s} {'jit%':>5s} {'HNR':>5s} {'MOSfin':>6s} {'MOSraw':>6s} {'CER':>5s} {'intra':>6s}")
for c, ks in by.items():
    g = lambda f: np.mean([L[k].get(f) or 0 for k in ks])
    intra = [S[a][b] for a, b in itertools.combinations(ks, 2)]
    print(f"{c:8s} {','.join(ks):14s} {np.median([L[k]['f0_raw'] or L[k]['f0_med'] for k in ks]):6.0f} {g('vtl_cm'):6.1f} {g('jitter')*100:5.2f} {g('hnr'):5.1f} {g('mos'):6.2f} {g('mos_raw'):6.2f} {g('cer'):5.3f} {np.mean(intra) if intra else float('nan'):6.3f}")
chars = list(by)
M = np.array([[np.mean([S[a][b] for a in by[c1] for b in by[c2] if a != b]) for c2 in chars] for c1 in chars])
print("\ninter-character mean cosine (ECAPA, raw takes):")
print(" " * 9 + " ".join(f"{c[:6]:>6s}" for c in chars))
for i, c in enumerate(chars):
    print(f"{c[:8]:8s} " + " ".join(f"{M[i,j]:6.2f}" for j in range(len(chars))))
off = [M[i, j] for i in range(len(chars)) for j in range(len(chars)) if i < j]
print(f"off-diagonal: mean={np.mean(off):.3f} max={np.max(off):.3f}; diagonal (multi-line chars) mean={np.mean([M[i,i] for i in range(len(chars)) if len(by[chars[i]])>1]):.3f}")
