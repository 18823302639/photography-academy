
import json
from pathlib import Path
from app.main import app, ROOT
from app.modules.contracts import Practice
from app.modules.photo_contracts import photo_outcome_adapter
target=ROOT/"packages/contracts"
(target/"practice.schema.json").write_text(json.dumps(Practice.model_json_schema(),ensure_ascii=False,indent=2)+"\n")
(target/"openapi.json").write_text(json.dumps(app.openapi(),ensure_ascii=False,indent=2)+"\n")
(target/"photo-processing.schema.json").write_text(json.dumps(photo_outcome_adapter.json_schema(),ensure_ascii=False,indent=2)+"\n")
