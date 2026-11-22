
from typing import Literal
from uuid import NAMESPACE_URL, uuid5
from xml.etree import ElementTree as ET
from pydantic import BaseModel, ConfigDict, Field
class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    exposure: float | None = Field(None, ge=-5, le=5)
    contrast: int | None = Field(None, ge=-100, le=100)
    highlights: int | None = Field(None, ge=-100, le=100)
    shadows: int | None = Field(None, ge=-100, le=100)
    whites: int | None = Field(None, ge=-100, le=100)
    blacks: int | None = Field(None, ge=-100, le=100)
    vibrance: int | None = Field(None, ge=-100, le=100)
class Recipe(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipe_version: Literal["1.0"] = "1.0"
    input_kind: Literal["jpeg"] = "jpeg"
    target_product: Literal["Lightroom desktop (unverified)"] = "Lightroom desktop (unverified)"
    setting_semantics: Literal["absolute"] = "absolute"
    settings: Settings
FIELDS = {"exposure": ("Exposure2012", "曝光 EV"), "contrast": ("Contrast2012", "对比度"), "highlights": ("Highlights2012", "高光"), "shadows": ("Shadows2012", "阴影"), "whites": ("Whites2012", "白场"), "blacks": ("Blacks2012", "黑场"), "vibrance": ("Vibrance", "自然饱和度")}
CRS="http://ns.adobe.com/camera-raw-settings/1.0/"
RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
X="adobe:ns:meta/"
for prefix, uri in [("x",X),("rdf",RDF),("crs",CRS)]: ET.register_namespace(prefix, uri)
def export_recipe(recipe: Recipe) -> dict:
    values=recipe.settings.model_dump(exclude_none=True)
    if not values: raise ValueError("至少指定一个设置")
    root=ET.Element(f"{{{X}}}xmpmeta")
    rdf=ET.SubElement(root,f"{{{RDF}}}RDF")
    desc=ET.SubElement(rdf,f"{{{RDF}}}Description",{f"{{{RDF}}}about":""})
    # Preset identity only; no default tone, white balance, profile or crop settings.
    for k,v in {"PresetType":"Normal","UUID":uuid5(NAMESPACE_URL,recipe.model_dump_json()).hex.upper(),"SupportsAmount":"False"}.items(): desc.set(f"{{{CRS}}}{k}",v)
    name=ET.SubElement(desc,f"{{{CRS}}}Name")
    alt=ET.SubElement(name,f"{{{RDF}}}Alt")
    ET.SubElement(alt,f"{{{RDF}}}li",{"{http://www.w3.org/XML/1998/namespace}lang":"x-default"}).text="Photography Academy experimental"
    lines=[]
    for key,value in values.items():
        field,label=FIELDS[key]
        desc.set(f"{{{CRS}}}{field}",str(value))
        lines.append(f"{label}: {value}（目标覆盖值，非增量）")
    return {"validation_status":"experimental_not_import_verified","setting_semantics":"absolute","settings":values,"text":lines,"xmp":ET.tostring(root,encoding="unicode"),"unsupported_settings":["white_balance","HSL","curves","masks","camera_profile"],"warning":"仅通过结构与范围校验，尚未在指定 Lightroom 产品/版本验证导入。"}
