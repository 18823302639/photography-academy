from copy import deepcopy
from io import BytesIO
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import warnings
from PIL import Image, ImageOps, IptcImagePlugin
from PIL.TiffImagePlugin import IFDRational
from app.imaging.photo_processing import process_jpeg_with_report, project_exif, JpegProcessingError
from app.modules.photo_contracts import FIELDS, MAX_BYTES, photo_outcome_adapter, parse_photo_outcome

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / 'tests/fixtures/exif-contract'
PRIVATE = b'SYNTHETIC_PRIVATE_7D'

def fixture(name):
    return (FIXTURES / (name + '.jpg')).read_bytes()

def metadata_markers(data):
    """JPEG segment walk through SOS; attached metadata lives outside entropy-coded pixels."""
    markers = []
    offset = 2
    while offset < len(data):
        if data[offset] != 255:
            raise AssertionError('Invalid JPEG marker')
        marker = data[offset+1]
        markers.append(marker)
        if marker in (0xDA, 0xD9):
            break
        length = int.from_bytes(data[offset+2:offset+4], 'big')
        offset += 2 + length
    return markers

class PhotoProcessingTests(unittest.TestCase):
    def test_private_metadata_is_projected_out_but_original_bytes_are_unchanged(self):
        data = fixture('normal')
        before = bytes(data)
        self.assertIn(PRIVATE, data)
        self.assertIn(b'/SYNTHETIC/PRIVATE/source.jpg', data)
        with Image.open(BytesIO(data)) as image:
            exif = image.getexif()
            self.assertEqual(IptcImagePlugin.getiptcinfo(image)[(2, 80)], PRIVATE)
            projected = project_exif(exif, exif.get_ifd(34665)).model_dump(mode='json')
            self.assertIn(34853, exif)  # GPS is still in the original after projection.
        self.assertEqual(data, before)
        self.assertIn(PRIVATE, data)
        self.assertEqual(set(projected['values']), set(FIELDS))
        text = json.dumps(projected)
        for private in ['SYNTHETIC', 'serial', 'owner', 'GPS', 'path', 'copyright', '2099']:
            self.assertNotIn(private, text)
        self.assertEqual(projected['values'], {'exposure_seconds': .008, 'f_number': 4., 'iso': 200,
                                              'focal_length_mm': 50., 'orientation': 6})

    def test_derived_bytes_really_drop_source_metadata_and_are_decodable(self):
        data = fixture('normal')
        result = process_jpeg_with_report(data)
        r, derived = result
        self.assertEqual(r.original_bytes, 'unchanged')
        self.assertEqual(r.derived.metadata, 'fresh_pixels_no_source_metadata')
        self.assertEqual(r.derived.pixel_content, 'not_anonymized')
        source_markers = metadata_markers(data)
        for marker in [0xE1, 0xE2, 0xED, 0xFE]:
            self.assertIn(marker, source_markers)
            self.assertNotIn(marker, metadata_markers(derived))
        for token in [PRIVATE, b'/SYNTHETIC/PRIVATE', b'2099:01:02', b'Exif\0\0', b'ICC_PROFILE', b'Photoshop']:
            self.assertNotIn(token, derived)
        with Image.open(BytesIO(derived)) as image:
            image.load()
            self.assertEqual(image.size, (64, 96))
            self.assertFalse(image.getexif())
            self.assertIsNone(IptcImagePlugin.getiptcinfo(image))
            self.assertTrue({'exif', 'xmp', 'icc_profile', 'comment'}.isdisjoint(image.info))
        self.assertEqual(r.derived.bytes, len(derived))

    def test_missing_invalid_and_unreadable_exif_have_distinct_null_states(self):
        for name, container, state in [('no_exif', 'absent', 'missing'), ('invalid_fields', 'read', 'invalid'),
                                        ('unreadable_exif', 'unreadable', 'unreadable')]:
            with warnings.catch_warnings(record=True) as leaked:
                r, derived = process_jpeg_with_report(fixture(name))
            self.assertEqual(leaked, [])
            self.assertEqual(r.exif.container, container)
            self.assertEqual(set(r.exif.states.model_dump().values()), {state})
            self.assertEqual(set(r.exif.values.model_dump().values()), {None})
            with Image.open(BytesIO(derived)) as image:
                image.load()
                self.assertEqual(image.size, (96, 64))
                self.assertFalse(image.getexif())

    def test_xmp_does_not_masquerade_as_source_exif(self):
        data = fixture('xmp_only')
        self.assertIn(b'tiff:Orientation="6"', data)
        r, _ = process_jpeg_with_report(data)
        self.assertEqual(r.exif.container, 'absent')
        self.assertEqual(r.exif.states.orientation, 'missing')
        self.assertEqual(r.derived.orientation, 'not_present')
        self.assertEqual((r.derived.size.width, r.derived.size.height), (96, 64))

    def test_numeric_projection_rejects_bad_types_nonfinite_and_out_of_range_without_echo(self):
        for tag in [33434, 33437, 34855, 37386, 274]:
            for value in [True, 'SYNTHETIC_PRIVATE_7D', 0, -1, float('nan'), float('inf'),
                          IFDRational(1, 0), (1, 125), 10**1000]:
                report = project_exif({tag: value})
                key = {33434:'exposure_seconds',33437:'f_number',34855:'iso',37386:'focal_length_mm',274:'orientation'}[tag]
                self.assertEqual(getattr(report.states, key), 'invalid')
                self.assertIsNone(getattr(report.values, key))
        self.assertEqual(project_exif({34855: 1.5}).states.iso, 'invalid')
        self.assertEqual(project_exif({274: 9}).states.orientation, 'invalid')
        self.assertEqual(project_exif({33434: 86401}).states.exposure_seconds, 'invalid')
        self.assertEqual(project_exif({33437: 257}).states.f_number, 'invalid')
        self.assertEqual(project_exif({37386: 100001}).states.focal_length_mm, 'invalid')
        self.assertEqual(project_exif({34855: 10_000_001}).states.iso, 'invalid')
        self.assertEqual(project_exif({34855: 200}, {34855: 0}).states.iso, 'invalid')

    def test_all_eight_orientations_match_pillow_geometry_before_metadata_removal(self):
        for orientation in range(1, 9):
            with Image.open(BytesIO(fixture('no_exif'))) as image:
                exif = Image.Exif(); exif[274] = orientation
                source = BytesIO(); image.save(source, format='JPEG', exif=exif, quality=90)
            data = source.getvalue()
            r, derived = process_jpeg_with_report(data)
            with Image.open(BytesIO(data)) as image:
                expected = ImageOps.exif_transpose(image).convert('RGB')
                clean = Image.frombytes('RGB', expected.size, expected.tobytes())
                encoded = BytesIO(); clean.save(encoded, format='JPEG', quality=88)
                self.assertEqual(derived, encoded.getvalue())
            self.assertEqual(r.derived.orientation, 'normal' if orientation == 1 else 'applied')

    def test_failures_have_only_fixed_codes_and_do_not_echo_inputs(self):
        png = BytesIO(); Image.new('RGB', (2, 2)).save(png, format='PNG')
        cases = [(b'', 'bytes_limit'), (b'x'*(MAX_BYTES+1), 'bytes_limit'),
                 ('/SYNTHETIC/PRIVATE/source.jpg', 'invalid_input_type'),
                 (b'SYNTHETIC_PRIVATE_7D bad jpeg', 'decode_failed'),
                 (fixture('normal')[:40], 'decode_failed'), (png.getvalue(), 'unsupported_format'),
                 (fixture('over_pixels'), 'pixel_limit')]
        for data, code in cases:
            with self.assertRaises(JpegProcessingError) as caught:
                process_jpeg_with_report(data)
            self.assertEqual(str(caught.exception), code)
            output = caught.exception.as_report().model_dump(mode='json')
            self.assertEqual(output, {'schema_version':'1.0','status':'rejected','code':code})
            self.assertEqual(parse_photo_outcome(output).model_dump(), output)

    def test_limits_reject_before_decode_or_pixel_allocation(self):
        with patch('app.imaging.photo_processing.Image.open') as opened:
            with self.assertRaises(JpegProcessingError):
                process_jpeg_with_report(b'x'*(MAX_BYTES+1))
            opened.assert_not_called()
        with patch.object(Image.Image, 'load', side_effect=AssertionError('must not load oversized pixels')):
            with self.assertRaises(JpegProcessingError) as caught:
                process_jpeg_with_report(fixture('over_pixels'))
            self.assertEqual(caught.exception.code, 'pixel_limit')

    def test_closed_schema_and_safe_parser_reject_private_fields_and_false_claims(self):
        valid = process_jpeg_with_report(fixture('normal')).report.model_dump(mode='json')
        for location in ['', 'input', 'input.size', 'exif', 'exif.values', 'exif.states', 'derived', 'derived.size']:
            raw = deepcopy(valid); target = raw
            for key in location.split('.') if location else []: target = target[key]
            target['private_path'] = '/SYNTHETIC/PRIVATE/source.jpg'
            with self.assertRaisesRegex(ValueError, '^Invalid photo processing contract$'):
                parse_photo_outcome(raw)
        for mutate in [lambda r:r['exif']['states'].update(iso='missing'),
                       lambda r:r['exif']['values'].update(iso=True),
                       lambda r:r['exif'].update(container='unreadable'),
                       lambda r:r['derived'].update(metadata='copied'),
                       lambda r:r['derived'].update(pixel_content='anonymized'),
                       lambda r:r['derived'].update(orientation='normal'),
                       lambda r:r['derived']['size'].update(width=97)]:
            raw = deepcopy(valid); mutate(raw)
            with self.assertRaises(ValueError): parse_photo_outcome(raw)
        schema = photo_outcome_adapter.json_schema()
        for definition in schema['$defs'].values():
            if definition.get('type') == 'object':self.assertIs(definition['additionalProperties'], False)
        self.assertEqual(schema, json.loads((ROOT/'packages/contracts/photo-processing.schema.json').read_text()))

    def test_shared_wire_fixtures_are_reproducible(self):
        stored = json.loads((ROOT/'packages/contracts/photo-processing.fixture.json').read_text())
        for name, report in stored.items():
            try:
                current = process_jpeg_with_report(fixture(name)).report
            except JpegProcessingError as error:
                current = error.as_report()
            self.assertEqual(current.model_dump(mode='json'), report)
