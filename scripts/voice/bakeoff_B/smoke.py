import time, torch, torchaudio, sys
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
t=time.time()
m = ChatterboxMultilingualTTS.from_pretrained(device="mps")
print("load", time.time()-t, flush=True)
for i in range(2):
    t=time.time()
    w = m.generate("J'ai passé douze ans à tirer d'autres hommes en haut des cols.", language_id="fr")
    dt=time.time()-t; dur=w.shape[-1]/m.sr
    print("gen", dt, "dur", dur, "rtf", dt/dur, flush=True)
torchaudio.save(sys.argv[1], w, m.sr)
