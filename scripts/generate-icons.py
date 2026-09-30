from PIL import Image, ImageDraw
from pathlib import Path
Path('icons').mkdir(exist_ok=True)
s=512
im=Image.new('RGBA',(s,s),(0,0,0,0));d=ImageDraw.Draw(im)
d.rounded_rectangle((0,0,511,511),radius=124,fill='#18121f')
d.ellipse((64,64,448,448),fill='#c5b4ff')
d.ellipse((91,91,421,421),fill='#18121f')
for x,h in [(164,75),(212,146),(260,204),(308,112)]:
 d.rounded_rectangle((x,256-h//2,x+30,256+h//2),radius=15,fill='#c5b4ff')
for n in [16,32,48,128]: im.resize((n,n),Image.Resampling.LANCZOS).save(f'icons/icon-{n}.png')
