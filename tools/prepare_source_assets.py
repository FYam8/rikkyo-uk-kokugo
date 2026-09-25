"""Render user-authorized source booklets; verify the original PDF SHA first."""
import argparse,hashlib,json
from pathlib import Path
import fitz
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);args=parser.parse_args()
indices={'FY24-A':'03','FY24-B':'04','FY25-A':'09','FY25-B':'10','FY26-A':'15','FY26-B':'16'}
manifest={}
for exam in json.loads((ROOT/'metadata/source_inventory.json').read_text())['exams']:
 eid=exam['examId'];matches=list(args.source_dir.glob(indices[eid]+'-*.pdf'));assert len(matches)==1
 pdf=matches[0];assert hashlib.sha256(pdf.read_bytes()).hexdigest()==exam['sha256'],eid
 doc=fitz.open(pdf);assert len(doc)==exam['pages']
 dest=ROOT/'raw/source-pages'/eid;dest.mkdir(parents=True,exist_ok=True)
 pages=[]
 for index,page in enumerate(doc,start=1):
  pix=page.get_pixmap(matrix=fitz.Matrix(1.65,1.65).prerotate(90),colorspace=fitz.csGRAY,alpha=False)
  img=Image.frombytes('L',[pix.width,pix.height],pix.samples);target=dest/f'{index:02}.webp';img.save(target,format='WEBP',quality=90,method=6)
  pages.append({'page':index,'path':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
 manifest[eid]={'sourcePdfSha256':exam['sha256'],'pages':pages}
(ROOT/'metadata/source_assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Verified and rendered',len(manifest),'source booklets;',sum(len(x['pages']) for x in manifest.values()),'pages')
