"""Deterministic, wholly synthetic local-input fixtures; no camera images or EXIF."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parent.parent / 'tests/fixtures/photo-input'
root.mkdir(parents=True, exist_ok=True)
for name, size, color in [('landscape.jpg', (96, 64), '#315b4a'), ('portrait.jpg', (64, 96), '#8a4d39')]:
    image = Image.new('RGB', size, color)
    draw = ImageDraw.Draw(image)
    draw.rectangle((8, 8, 30, 30), fill='#eddb98')
    draw.line((0, size[1]-1, size[0]-1, 0), fill='white', width=3)
    image.save(root / name, format='JPEG', quality=90)
# Incorrect extension is intentional: the input must use bytes, not a filename.
Image.new('RGB', (16, 16), '#315b4a').save(root / 'png-disguised.jpg', format='PNG')
(root / 'truncated.jpg').write_bytes(b'\xff\xd8\xff\xe0\x00\x10')
