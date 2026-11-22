
from io import BytesIO
from pathlib import Path
import json
import unittest
from unittest.mock import patch
from xml.etree import ElementTree as ET
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app, practice, ROOT
from app.exporters.xmp import Recipe, export_recipe, CRS, FIELDS
from app.imaging.jpeg import process_jpeg
def jpeg(exif=True):
    image=Image.new("RGB",(80,40),(120,70,30))
    data=BytesIO()
    tags=Image.Exif()
    if exif:
        tags[274]=6
        tags[34665]={33434:0.008,33437:4.0,34855:100,37386:50.0,42033:"SYNTHETIC-SERIAL"}
        tags[34853]={1:"N",2:(1.0,2.0,3.0)}
    image.save(data,format="JPEG",exif=tags)
    return data.getvalue()
class ImagingTests(unittest.TestCase):
    def test_original_exif_before_derivation_and_rotation(self):
        original=jpeg()
        metadata,derived=process_jpeg(original)
        self.assertEqual(metadata["source"],"original_exif")
        self.assertEqual(metadata["values"]["iso"],100)
        self.assertEqual(metadata["values"]["orientation"],6)
        self.assertEqual(metadata["derived_size"],[40,80])
        with Image.open(BytesIO(derived)) as im:
            self.assertEqual(len(im.getexif()),0)
            self.assertNotIn("icc_profile",im.info)
        self.assertNotIn(b"SYNTHETIC-SERIAL",derived)
        self.assertEqual(process_jpeg(derived)[0]["source"],"missing")
        self.assertEqual(original,jpeg())
    def test_missing_metadata_remains_missing(self):
        m,_=process_jpeg(jpeg(False))
        self.assertEqual(m["source"],"missing")
        self.assertTrue(all(v is None for v in m["values"].values()))
    def test_reencode_cannot_be_assumed_to_keep_exif(self):
        original=jpeg()
        with Image.open(BytesIO(original)) as im:
            b=BytesIO(); im.save(b,format="JPEG",quality=70)
        self.assertEqual(process_jpeg(b.getvalue())[0]["source"],"missing")
    def test_bad_files_and_limits(self):
        for bad in [b"",b"fake.jpg",jpeg()[:60]]:
            with self.assertRaises(ValueError): process_jpeg(bad)
        b=BytesIO();Image.new("RGB",(2,2)).save(b,format="PNG")
        with self.assertRaises(ValueError): process_jpeg(b.getvalue())
        with patch("app.imaging.jpeg.MAX_BYTES",10):
            with self.assertRaises(ValueError):process_jpeg(jpeg())
        with patch("app.imaging.jpeg.MAX_PIXELS",10):
            with self.assertRaises(ValueError):process_jpeg(jpeg())
class ApiTests(unittest.TestCase):
    def setUp(self):self.client=TestClient(app)
    def test_health_and_fixture_contract(self):
        self.assertFalse(self.client.get("/health").json()["real_ai_enabled"])
        self.assertEqual(self.client.get("/api/v1/practice").json(),json.loads((ROOT/"packages/contracts/practice.fixture.json").read_text()))
        self.assertEqual(practice().review.kind,"mock")
    def test_deterministic_export_and_text_match(self):
        recipe=Recipe(settings={"exposure":0.3,"shadows":20})
        a=export_recipe(recipe);self.assertEqual(a,export_recipe(recipe))
        tree=ET.fromstring(a["xmp"]);attrs=next(e.attrib for e in tree.iter() if e.tag.endswith("Description"))
        self.assertEqual(attrs[f"{{{CRS}}}Exposure2012"],"0.3")
        self.assertEqual(attrs[f"{{{CRS}}}Shadows2012"],"20")
        self.assertNotIn(f"{{{CRS}}}Contrast2012",attrs)
        self.assertNotIn("WhiteBalance",a["xmp"])
        self.assertIn("0.3",a["text"][0])
        self.assertEqual(a["validation_status"],"experimental_not_import_verified")
    def test_api_download_and_preview(self):
        body={"settings":{"exposure":0.3}}
        r=self.client.post("/api/v1/exports/xmp",json=body)
        self.assertEqual(r.status_code,200);ET.fromstring(r.text)
        self.assertIn("attachment",r.headers["content-disposition"])
        self.assertEqual(r.text,self.client.post("/api/v1/exports/preview",json=body).json()["xmp"])
    def test_bad_recipes_rejected(self):
        for settings in [{},{"exposure":6},{"shadows":101},{"unknown":1},{"exposure":"NaN"},{"contrast":1.5},{"contrast":True}]:
            self.assertEqual(self.client.post("/api/v1/exports/preview",json={"settings":settings}).status_code,422,settings)
        with self.assertRaises(ValueError):Recipe(settings={"exposure":float("nan")})
        with self.assertRaises(ValueError):Recipe(settings={"exposure":float("inf")})
    def test_ranges_and_only_specified_fields(self):
        for key,(field,_) in FIELDS.items():
            limit=5 if key=="exposure" else 100
            for value in [-limit,limit]:
                r=export_recipe(Recipe(settings={key:value}))
                self.assertEqual(r["settings"],{key:value})
                self.assertIn(field,r["xmp"])
if __name__=="__main__":unittest.main()
