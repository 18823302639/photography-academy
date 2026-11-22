
from typing import Literal
from pydantic import BaseModel, ConfigDict
class Review(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["mock"]
    fact: str
    inference: str
    suggestion: str
class Practice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1.0"]
    mode: Literal["mock"]
    exercise_id: str
    title: str
    gear: list[str]
    steps: list[str]
    cautions: list[str]
    exif_source: Literal["missing"]
    intent: Literal["low_key"]
    review: Review
