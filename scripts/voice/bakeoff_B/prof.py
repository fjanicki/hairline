import time, torch, sys
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
dev=sys.argv[1]
m = ChatterboxMultilingualTTS.from_pretrained(device=dev)
T={}
def wrap(obj,name,key):
    f=getattr(obj,name)
    def g(*a,**k):
        if dev=="mps": torch.mps.synchronize()
        t=time.time(); r=f(*a,**k)
        if dev=="mps": torch.mps.synchronize()
        T[key]=T.get(key,0)+time.time()-t; return r
    setattr(obj,name,g)
wrap(m.t3,"inference","t3"); wrap(m.s3gen,"inference","s3gen"); wrap(m.watermarker,"apply_watermark","wm")
for i in range(3):
    T.clear(); t=time.time()
    w = m.generate("J'ai passé douze ans à tirer d'autres hommes en haut des cols.", language_id="fr")
    dt=time.time()-t; dur=w.shape[-1]/m.sr
    print(dev,"gen %.2f dur %.2f rtf %.2f"%(dt,dur,dt/dur), {k:round(v,2) for k,v in T.items()}, flush=True)
