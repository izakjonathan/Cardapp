from pathlib import Path
from PIL import Image
import numpy as np

TARGET=(450,630)
PAD=14
CARDS=Path(__file__).resolve().parents[1]/"public"/"cards"

def normalize_card(path: Path):
    img=Image.open(path).convert("RGBA")
    arr=np.array(img)
    rgb=arr[:,:,:3]
    alpha=arr[:,:,3]
    mask=(alpha>18) & ((rgb<247).any(axis=2) | (alpha<245))
    ys,xs=np.where(mask)
    crop=img.crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1)) if len(xs) else img
    inner_w,inner_h=TARGET[0]-2*PAD, TARGET[1]-2*PAD
    scale=min(inner_w/crop.width, inner_h/crop.height)
    nw=max(1, round(crop.width*scale))
    nh=max(1, round(crop.height*scale))
    resized=crop.resize((nw,nh), Image.LANCZOS)
    canvas=Image.new("RGBA", TARGET, (255,255,255,0))
    x=(TARGET[0]-nw)//2
    y=(TARGET[1]-nh)//2
    canvas.alpha_composite(resized,(x,y))
    canvas.save(path)

if __name__ == "__main__":
    for fp in sorted(CARDS.glob("*.png")):
        normalize_card(fp)
    print(f"Normalized {len(list(CARDS.glob('*.png')))} card assets in {CARDS}")
