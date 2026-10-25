import json,re,urllib.request,concurrent.futures,io
from pathlib import Path
root=Path('.');out=root/'public/assets/merchant-fabrics';out.mkdir(parents=True,exist_ok=True)
def download(item):
 kind,row=item;code=row['fabric_code'];safe=re.sub(r'[^A-Za-z0-9_-]','_',code);target=out/(kind+'-'+safe+'.webp');url=row['image_url'].replace('http://','https://');result={**row,'kind':kind,'image':'merchant-fabrics/'+target.name,'source_image_url':row['image_url']}
 try:
  if not target.exists():
   with urllib.request.urlopen(url,timeout=25) as r: body=r.read()
   if len(body)<100:raise ValueError('Empty image')
   from PIL import Image
   with Image.open(io.BytesIO(body)) as img:
    img.thumbnail((512,512),Image.Resampling.LANCZOS);img.save(target,quality=80,method=6)
  from PIL import Image
  with Image.open(target) as image:image.verify()
  result['image_available']=True
 except Exception as e:result['image_available']=False;result['image_error']=str(e)[:120]
 return result
cached=json.loads((root/'data/merchant-fabrics.json').read_text())['fabrics']
jobs=[(r['kind'],r) for r in cached]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: rows=list(pool.map(download,jobs))
(root/'data/merchant-fabrics.json').write_text(json.dumps({'sources':['https://www.suits.me/swatches/suit','https://www.suits.me/swatches/shirt'],'retrieved':'2026-10-24','fabrics':rows},indent=2))
print(json.dumps({'downloaded':sum(r['image_available'] for r in rows),'failed':[r['fabric_code'] for r in rows if not r['image_available']]}))
