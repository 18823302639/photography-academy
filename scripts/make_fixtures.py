
from io import BytesIO
import json
from pathlib import Path
from PIL import Image
from app.imaging.jpeg import process_jpeg
from app.exporters.xmp import Recipe, export_recipe
root=Path(__file__).resolve().parents[1]
out=root/"tests/fixtures/generated";out.mkdir(parents=True,exist_ok=True)
im=Image.new("RGB",(80,40),(120,70,30))
exif=Image.Exif();exif[274]=6;exif[34665]={34855:100,33434:0.008,33437:4.0,37386:50.0,42033:"SYNTHETIC-SERIAL"}
exif[34853]={1:"N",2:(1.0,2.0,3.0)}
b=BytesIO();im.save(b,format="JPEG",exif=exif);original=b.getvalue()
(out/"synthetic-original.jpg").write_bytes(original)
compressed=BytesIO();im.save(compressed,format="JPEG",quality=70)
(out/"synthetic-reencoded.jpg").write_bytes(compressed.getvalue())
metadata,derived=process_jpeg(original)
(out/"synthetic-sanitized.jpg").write_bytes(derived)
(out/"metadata.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
r=export_recipe(Recipe(settings={"exposure":0.3,"shadows":20}))
(out/"experimental.xmp").write_text(r["xmp"])
(out/"experimental.recipe.json").write_text(json.dumps(r,ensure_ascii=False,indent=2))
print(out)
