import time, sys, numpy as np, soundfile as sf
from mlx_audio.tts.utils import load_model
t=time.time(); m=load_model("mlx-community/chatterbox-multilingual-v3"); print("load",time.time()-t,flush=True)
txt="J'ai passé douze ans à tirer d'autres hommes en haut des cols."
for i in range(3):
    t=time.time(); segs=list(m.generate(txt, ref_audio=sys.argv[1], lang_code="fr", exaggeration=0.3, cfg_weight=0.5, verbose=False))
    a=np.concatenate([np.array(s.audio) for s in segs]); dt=time.time()-t; dur=len(a)/m.sample_rate
    print(f"gen {dt:.2f}s dur {dur:.2f}s rtf {dt/dur:.2f}",flush=True)
sf.write(sys.argv[2], a, m.sample_rate)
