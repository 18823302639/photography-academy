"""Real decoder checks for synthetic frontend fixtures, not a WeChat decoder claim."""
import unittest
from pathlib import Path
from io import BytesIO
from PIL import Image
from app.imaging.jpeg import process_jpeg
ROOT = Path(__file__).resolve().parents[3] / 'tests/fixtures/photo-input'

class LocalInputFixtures(unittest.TestCase):
    def test_supported_synthetic_jpegs_really_decode_without_exif(self):
        for name, size in [('landscape.jpg', (96, 64)), ('portrait.jpg', (64, 96))]:
            data = (ROOT / name).read_bytes()
            with Image.open(BytesIO(data)) as image:
                image.load()
                self.assertEqual(image.format, 'JPEG')
                self.assertEqual(image.size, size)
                self.assertEqual(dict(image.getexif()), {})
            metadata, _ = process_jpeg(data)
            self.assertEqual(metadata['source'], 'missing')

    def test_disguised_and_truncated_inputs_are_rejected_by_existing_decoder(self):
        for name in ['png-disguised.jpg', 'truncated.jpg']:
            with self.assertRaises(ValueError):
                process_jpeg((ROOT / name).read_bytes())
