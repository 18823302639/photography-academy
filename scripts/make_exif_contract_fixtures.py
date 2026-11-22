"""Only synthetic images and fictional metadata. No real photos or identifiers."""
from io import BytesIO
import json
from pathlib import Path
from PIL import Image, ImageDraw
from PIL.TiffImagePlugin import IFDRational
from app.imaging.photo_processing import process_jpeg_with_report, JpegProcessingError

PRIVATE_MARKER = b'SYNTHETIC_PRIVATE_7D'

def app_segment(marker: int, payload: bytes) -> bytes:
    return bytes([255, marker]) + (len(payload) + 2).to_bytes(2, 'big') + payload

def make_image(with_exif=False, invalid=False):
    image = Image.new('RGB', (96, 64), '#315b4a')
    ImageDraw.Draw(image).rectangle((8, 8, 30, 30), fill='#eddb98')
    options = {}
    if with_exif:
        exif = Image.Exif()
        exif[274] = 9 if invalid else 6
        exif[315] = PRIVATE_MARKER.decode()  # Artist
        exif[270] = '/SYNTHETIC/PRIVATE/source.jpg'
        exif[33432] = PRIVATE_MARKER.decode()  # Copyright
        exif[271] = exif[272] = exif[305] = PRIVATE_MARKER.decode()
        exif[306] = '2099:01:02 03:04:05'
        exif[34665] = {
            33434: IFDRational(0, 1) if invalid else IFDRational(1, 125),
            33437: IFDRational(0, 1) if invalid else IFDRational(4, 1),
            34855: 0 if invalid else 200,
            37386: IFDRational(0, 1) if invalid else IFDRational(50, 1),
            42033: PRIVATE_MARKER.decode(), 42037: PRIVATE_MARKER.decode(),
            42032: PRIVATE_MARKER.decode(), 37510: b'ASCII\0\0\0' + PRIVATE_MARKER,
            37500: PRIVATE_MARKER, 36867: '2099:01:02 03:04:05',
        }
        exif[34853] = {1: 'N', 2: (IFDRational(1), IFDRational(2), IFDRational(3)),
                       3: 'E', 4: (IFDRational(4), IFDRational(5), IFDRational(6))}
        options = {'exif': exif, 'icc_profile': PRIVATE_MARKER, 'comment': PRIVATE_MARKER}
    output = BytesIO()
    image.save(output, format='JPEG', quality=90, **options)
    return output.getvalue()

def fixture_bytes():
    plain = make_image()
    xmp = (b'http://ns.adobe.com/xap/1.0/\0'
           b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
           b'<rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" tiff:Orientation="6" '
           b'xmlns:dc="http://purl.org/dc/elements/1.1/" dc:creator="' + PRIVATE_MARKER + b'"/></rdf:RDF></x:xmpmeta>')
    private = make_image(with_exif=True)
    # Valid Photoshop 0x0404 resource containing an IPTC IIM By-line (record 2, dataset 80).
    iptc = b'\x1c\x02\x50' + len(PRIVATE_MARKER).to_bytes(2, 'big') + PRIVATE_MARKER
    resource = b'8BIM\x04\x04\0\0' + len(iptc).to_bytes(4, 'big') + iptc
    if len(iptc) % 2:
        resource += b'\0'
    private = private[:2] + app_segment(0xE1, xmp) + app_segment(0xED, b'Photoshop 3.0\0' + resource) + private[2:]
    malformed = plain[:2] + app_segment(0xE1, b'Exif\0\0II*\0\xff\xff\xff\x7f' + PRIVATE_MARKER) + plain[2:]
    oversized = bytearray(plain)
    sof = oversized.index(b'\xff\xc0')
    oversized[sof+5:sof+7] = (5000).to_bytes(2, 'big')
    oversized[sof+7:sof+9] = (9000).to_bytes(2, 'big')
    return {'normal': private, 'no_exif': plain, 'invalid_fields': make_image(with_exif=True, invalid=True),
            'unreadable_exif': malformed, 'xmp_only': plain[:2] + app_segment(0xE1, xmp) + plain[2:],
            'over_pixels': bytes(oversized)}

def main():
    root = Path(__file__).resolve().parents[1]
    out = root / 'tests/fixtures/exif-contract'
    out.mkdir(parents=True, exist_ok=True)
    cases = {}
    for name, data in fixture_bytes().items():
        (out / (name + '.jpg')).write_bytes(data)
        try:
            result = process_jpeg_with_report(data)
            cases[name] = result.report.model_dump(mode='json')
            (out / (name + '-derived.jpg')).write_bytes(result.derived_jpeg)
        except JpegProcessingError as error:
            cases[name] = error.as_report().model_dump(mode='json')
    (root / 'packages/contracts/photo-processing.fixture.json').write_text(
        json.dumps(cases, ensure_ascii=False, indent=2) + '\n')
    print('Generated synthetic EXIF contract fixtures:', len(cases))

if __name__ == '__main__':
    main()
