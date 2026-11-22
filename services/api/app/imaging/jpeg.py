
"""Legacy S0 tuple view. New consumers use process_jpeg_with_report's versioned contract."""
from app.imaging.photo_processing import process_jpeg_with_report
from app.modules.photo_contracts import MAX_BYTES, MAX_PIXELS

def process_jpeg(data: bytes) -> tuple[dict, bytes]:
    if not data or len(data)>MAX_BYTES: raise ValueError("JPEG 字节数超出限制")
    result=process_jpeg_with_report(data)
    r=result.report
    if r.input.size.width*r.input.size.height>MAX_PIXELS: raise ValueError("像素数超出限制")
    values=r.exif.values.model_dump()
    return {"source":"original_exif" if any(v is not None for v in values.values()) else "missing",
            "values":values,"original_size":[r.input.size.width,r.input.size.height],
            "derived_size":[r.derived.size.width,r.derived.size.height],
            "color_handling":"prototype: no ICC color transform; do not use for color-critical evaluation"},result.derived_jpeg
