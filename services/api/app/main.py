
from pathlib import Path
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from app.modules.contracts import Practice
from app.exporters.xmp import Recipe, export_recipe
ROOT=Path(__file__).resolve().parents[3]
FIXTURE=ROOT/"packages/contracts/practice.fixture.json"
app=FastAPI(title="Photography Academy local prototype",version="0.1.0")
@app.get("/health")
def health(): return {"status":"ok","mode":"mock","real_ai_enabled":False}
@app.get("/api/v1/practice", response_model=Practice)
def practice(): return Practice.model_validate(json.loads(FIXTURE.read_text()))
@app.post("/api/v1/exports/preview")
def preview(recipe: Recipe):
    try: return export_recipe(recipe)
    except ValueError as e: raise HTTPException(422,str(e)) from e
@app.post("/api/v1/exports/xmp")
def xmp(recipe: Recipe):
    try: result=export_recipe(recipe)
    except ValueError as e: raise HTTPException(422,str(e)) from e
    return Response(result["xmp"],media_type="application/rdf+xml",headers={"Content-Disposition":'attachment; filename="photography-academy-experimental.xmp"',"X-Validation-Status":result["validation_status"]})
