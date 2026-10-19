# 비교용 한 장 만들기: python3 tools/compare.py 출력.png 그림1.png 그림2.png ... (세로 길이는 가장 긴 것 기준, 폭 390 기준으로 맞춤)
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
W = int(390 * 1.2)
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    ims.append(im.resize((W, round(im.height * W / im.width))))
H = max(i.height for i in ims)
c = Image.new("RGB", (W * len(ims) + 12 * (len(ims) - 1), H), (128, 128, 128))
for k, im in enumerate(ims):
    c.paste(im, (k * (W + 12), 0))
c.save(out)
