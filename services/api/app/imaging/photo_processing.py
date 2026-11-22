"""Bytes-only local JPEG processing; no file IO, upload, account or model connection."""
from io import BytesIO
import math
import struct
from numbers import Real
from typing import Mapping, NamedTuple
import warnings
from PIL import Image, UnidentifiedImageError
from app.modules.photo_contracts import (
    MAX_BYTES, MAX_PIXELS, MAX_SECONDS, MAX_F_NUMBER, MAX_ISO, MAX_FOCAL_MM,
    FIELDS, ExifProjection, PhotoProcessingReport, PhotoProcessingFailure, FailureCode,
)

TAGS = {33434: 'exposure_seconds', 33437: 'f_number', 34855: 'iso',
        37386: 'focal_length_mm', 274: 'orientation'}
LIMITS = {'exposure_seconds': MAX_SECONDS, 'f_number': MAX_F_NUMBER,
          'iso': MAX_ISO, 'focal_length_mm': MAX_FOCAL_MM, 'orientation': 8}

class JpegProcessingError(ValueError):
    def __init__(self, code: FailureCode):
        self.code = code
        super().__init__(code)  # Never embed Pillow errors, metadata, filenames or bytes.

    def as_report(self) -> PhotoProcessingFailure:
        return PhotoProcessingFailure(schema_version='1.0', status='rejected', code=self.code)

class ProcessedJpeg(NamedTuple):
    report: PhotoProcessingReport
    derived_jpeg: bytes

def project_exif(root: Mapping, nested: Mapping | None = None, *, container='read') -> ExifProjection:
    """Projection only: this function cannot modify or strip any source JPEG bytes."""
    values = {name: None for name in FIELDS}
    states = {name: 'missing' if container == 'absent' else 'unreadable' for name in FIELDS}
    if container == 'read':
        nested = nested or {}
        for tag, name in TAGS.items():
            # Standard EXIF IFD wins; root fallback preserves the existing prototype's inputs.
            source = nested if tag != 274 and tag in nested else root
            if tag not in source:
                states[name] = 'missing'
                continue
            value = source[tag]
            states[name] = 'invalid'
            if isinstance(value, bool) or not isinstance(value, Real):
                continue
            try:
                number = float(value)
                if not math.isfinite(number) or not 0 < number <= LIMITS[name]:
                    continue
                if name in ('iso', 'orientation'):
                    if not number.is_integer():
                        continue
                    number = int(number)
                values[name], states[name] = number, 'available'
            except (ValueError, TypeError, OverflowError, ZeroDivisionError):
                continue
    return ExifProjection.model_validate({'source': 'input_exif_not_verified', 'container': container,
                                          'values': values, 'states': states})

def _read_exif(image: Image.Image) -> ExifProjection:
    # Do not use image.getexif(): Pillow may synthesize orientation from XMP there.
    raw = image.info.get('exif')
    if raw is None:
        return project_exif({}, container='absent')
    try:
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter('always')
            exif = Image.Exif()
            exif.load(raw)
            root = {tag: exif[tag] for tag in TAGS if tag in exif}
            nested = exif.get_ifd(34665) if 34665 in exif else {}
            result = project_exif(root, nested)
            # A parser warning makes completeness uncertain; never report it as missing.
            if captured:
                return project_exif({}, container='unreadable')
            return result
    except (ValueError, TypeError, OSError, SyntaxError, KeyError, IndexError, OverflowError, struct.error):
        return project_exif({}, container='unreadable')

TRANSPOSE = {2: Image.Transpose.FLIP_LEFT_RIGHT, 3: Image.Transpose.ROTATE_180,
             4: Image.Transpose.FLIP_TOP_BOTTOM, 5: Image.Transpose.TRANSPOSE,
             6: Image.Transpose.ROTATE_270, 7: Image.Transpose.TRANSVERSE, 8: Image.Transpose.ROTATE_90}

def process_jpeg_with_report(data: bytes) -> ProcessedJpeg:
    if not isinstance(data, bytes):
        raise JpegProcessingError('invalid_input_type')
    if not data or len(data) > MAX_BYTES:
        raise JpegProcessingError('bytes_limit')
    stage = 'decode'
    try:
        # Capture warnings rather than logging potentially private source metadata.
        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always')
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format != 'JPEG':
                    raise JpegProcessingError('unsupported_format')
                if image.width * image.height > MAX_PIXELS:
                    raise JpegProcessingError('pixel_limit')
                image.load()
                stage = 'processing'
                exif = _read_exif(image)
                orientation = exif.values.orientation
                normalized = image.transpose(TRANSPOSE[orientation]) if orientation in TRANSPOSE else image.copy()
                normalized = normalized.convert('RGB')
                normalized.thumbnail((1600, 1600))
                # A fresh pixel buffer, not deletion from a metadata-bearing Image object.
                clean = Image.frombytes('RGB', normalized.size, normalized.tobytes())
                output = BytesIO()
                clean.save(output, format='JPEG', quality=88)
                derived = output.getvalue()
                state = exif.states.orientation
                handling = ('normal' if orientation == 1 else 'applied') if state == 'available' else {
                    'missing': 'not_present', 'invalid': 'invalid', 'unreadable': 'unreadable'
                }[state]
                report = PhotoProcessingReport.model_validate({
                    'schema_version': '1.0', 'status': 'processed', 'projection_policy': 'allowlist_only',
                    'original_bytes': 'unchanged',
                    'input': {'format': 'jpeg', 'bytes': len(data), 'size': {'width': image.width, 'height': image.height}},
                    'exif': exif,
                    'derived': {'format': 'jpeg', 'bytes': len(derived),
                                'size': {'width': clean.width, 'height': clean.height},
                                'metadata': 'fresh_pixels_no_source_metadata', 'pixel_content': 'not_anonymized',
                                'color': 'no_icc_transform', 'orientation': handling}})
                return ProcessedJpeg(report, derived)
    except JpegProcessingError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise JpegProcessingError('pixel_limit') from None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, TypeError, OverflowError, struct.error):
        raise JpegProcessingError('decode_failed' if stage == 'decode' else 'processing_failed') from None
