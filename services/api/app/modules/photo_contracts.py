"""T09 offline processing contract. No paths, raw EXIF, arbitrary messages or identifiers."""
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

# Protocol acceptance bounds, not claims about the limits of any camera.
MAX_SECONDS = 86400
MAX_F_NUMBER = 256
MAX_ISO = 10_000_000
MAX_FOCAL_MM = 100_000
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 40_000_000
FIELDS = ('exposure_seconds', 'f_number', 'iso', 'focal_length_mm', 'orientation')
FieldState = Literal['available', 'missing', 'invalid', 'unreadable']

class ClosedModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, frozen=True, revalidate_instances='always')

class CaptureValues(ClosedModel):
    exposure_seconds: Annotated[float, Field(gt=0, le=MAX_SECONDS, allow_inf_nan=False)] | None
    f_number: Annotated[float, Field(gt=0, le=MAX_F_NUMBER, allow_inf_nan=False)] | None
    iso: Annotated[int, Field(ge=1, le=MAX_ISO)] | None
    focal_length_mm: Annotated[float, Field(gt=0, le=MAX_FOCAL_MM, allow_inf_nan=False)] | None
    orientation: Annotated[int, Field(ge=1, le=8)] | None

class CaptureStates(ClosedModel):
    exposure_seconds: FieldState
    f_number: FieldState
    iso: FieldState
    focal_length_mm: FieldState
    orientation: FieldState

class ExifProjection(ClosedModel):
    source: Literal['input_exif_not_verified']
    container: Literal['absent', 'read', 'unreadable']
    values: CaptureValues
    states: CaptureStates

    @model_validator(mode='after')
    def consistent_states(self):
        for name in FIELDS:
            state, value = getattr(self.states, name), getattr(self.values, name)
            if (state == 'available') != (value is not None):
                raise ValueError('EXIF state/value mismatch')
            if self.container == 'absent' and state != 'missing':
                raise ValueError('Absent EXIF must have missing fields')
            if self.container == 'unreadable' and state != 'unreadable':
                raise ValueError('Unreadable EXIF must not invent field availability')
            if self.container == 'read' and state == 'unreadable':
                raise ValueError('Read EXIF fields must be available, missing or invalid')
        return self

class PixelSize(ClosedModel):
    width: Annotated[int, Field(ge=1, le=MAX_PIXELS)]
    height: Annotated[int, Field(ge=1, le=MAX_PIXELS)]

    @model_validator(mode='after')
    def pixel_limit(self):
        if self.width * self.height > MAX_PIXELS:
            raise ValueError('Pixel limit exceeded')
        return self

class JpegInputInfo(ClosedModel):
    format: Literal['jpeg']
    bytes: Annotated[int, Field(ge=1, le=MAX_BYTES)]
    size: PixelSize

class DerivedJpegInfo(JpegInputInfo):
    metadata: Literal['fresh_pixels_no_source_metadata']
    pixel_content: Literal['not_anonymized']
    color: Literal['no_icc_transform']
    orientation: Literal['applied', 'normal', 'not_present', 'invalid', 'unreadable']

class PhotoProcessingReport(ClosedModel):
    schema_version: Literal['1.0']
    status: Literal['processed']
    projection_policy: Literal['allowlist_only']
    original_bytes: Literal['unchanged']
    input: JpegInputInfo
    exif: ExifProjection
    derived: DerivedJpegInfo

    @model_validator(mode='after')
    def transformation_matches_exif(self):
        state, value = self.exif.states.orientation, self.exif.values.orientation
        expected = ('normal' if value == 1 else 'applied') if state == 'available' else {
            'missing': 'not_present', 'invalid': 'invalid', 'unreadable': 'unreadable'
        }[state]
        if self.derived.orientation != expected:
            raise ValueError('Orientation processing does not match EXIF')
        width, height = self.input.size.width, self.input.size.height
        if value in (5, 6, 7, 8):
            width, height = height, width
        if (self.derived.size.width > min(width, 1600) or
                self.derived.size.height > min(height, 1600)):
            raise ValueError('Derived size exceeds processing bounds')
        return self

FailureCode = Literal['invalid_input_type', 'bytes_limit', 'unsupported_format', 'pixel_limit',
                      'decode_failed', 'processing_failed']
class PhotoProcessingFailure(ClosedModel):
    schema_version: Literal['1.0']
    status: Literal['rejected']
    code: FailureCode

PhotoProcessingOutcome = Annotated[Union[PhotoProcessingReport, PhotoProcessingFailure], Field(discriminator='status')]
photo_outcome_adapter = TypeAdapter(PhotoProcessingOutcome)

def parse_photo_outcome(raw: object) -> PhotoProcessingReport | PhotoProcessingFailure:
    """Safe boundary: never include rejected input or arbitrary metadata in an error."""
    try:
        return photo_outcome_adapter.validate_python(raw)
    except (ValueError, TypeError):
        raise ValueError('Invalid photo processing contract') from None
