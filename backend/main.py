import datetime
import json
import pathlib
import uuid
from typing import Any, Dict, Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pronotepy
from pronotepy import ent

app = FastAPI(title="PronoteXP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CredentialsPayload(BaseModel):
    url: str = Field(..., example="https://URL.index-education.net/pronote/eleve.html")
    username: str
    password: str
    ent_name: Optional[str] = "monlycee_net"

class QRCodePayload(BaseModel):
    qr_data: Union[Dict[str, Any], str]
    pin: str

class TokenPayload(BaseModel):
    url: str
    username: str
    token: str

def safe_iso(val: Any) -> Any:
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.isoformat()
    return val

def extract_pronote_data(client: pronotepy.Client) -> Dict[str, Any]:
    today = datetime.date.today()

    export_data: Dict[str, Any] = {
        "export_metadata": {
            "app": "PronoteXP",
            "generated_at": datetime.datetime.now().isoformat(),
            "logged_in": client.logged_in,
        },
        "user_info": {},
        "periods": [],
        "timetable": [],
        "homework": [],
        "absences": [],
        "delays": [],
        "punishments": [],
        "news": [],
        "menus": [],
    }

    try:
        info = client.info
        export_data["user_info"] = {
            "name": getattr(info, "name", None),
            "class_name": getattr(info, "class_name", None),
            "establishment": getattr(info, "establishment", None),
        }
    except Exception:
        pass

    try:
        for period in client.periods:
            p_data = {
                "name": period.name,
                "start": safe_iso(period.start),
                "end": safe_iso(period.end),
                "overall_average": period.overall_average,
                "class_overall_average": period.class_overall_average,
                "grades": [],
                "averages": [],
            }

            try:
                for g in period.grades:
                    p_data["grades"].append({
                        "id": getattr(g, "id", None),
                        "subject": g.subject.name if g.subject else None,
                        "date": safe_iso(g.date),
                        "grade": g.grade,
                        "out_of": g.out_of,
                        "coefficient": g.coefficient,
                        "comment": g.comment,
                    })
            except Exception:
                pass

            try:
                for avg in period.averages:
                    p_data["averages"].append({
                        "subject": avg.subject.name if avg.subject else None,
                        "student": avg.student,
                        "class_average": avg.class_average,
                        "max": avg.max,
                        "min": avg.min,
                    })
            except Exception:
                pass

            export_data["periods"].append(p_data)
    except Exception:
        pass

    try:
        start_tt = today - datetime.timedelta(days=60)
        end_tt = today + datetime.timedelta(days=30)
        for lesson in client.lessons(start_tt, end_tt):
            export_data["timetable"].append({
                "subject": lesson.subject.name if lesson.subject else None,
                "teacher": getattr(lesson, "teacher_name", getattr(lesson, "teacher", None)),
                "classroom": lesson.classroom,
                "start": safe_iso(lesson.start),
                "end": safe_iso(lesson.end),
                "canceled": lesson.canceled,
            })
    except Exception:
        pass

    try:
        start_hw = today - datetime.timedelta(days=60)
        end_hw = today + datetime.timedelta(days=30)
        for hw in client.homework(start_hw, end_hw):
            export_data["homework"].append({
                "subject": hw.subject.name if hw.subject else None,
                "description": hw.description,
                "done": hw.done,
                "date": safe_iso(hw.date),
            })
    except Exception:
        pass

    return export_data

@app.post("/api/export/qrcode")
def export_qrcode(payload: QRCodePayload):
    qr_dict = payload.qr_data
    if isinstance(qr_dict, str):
        try:
            qr_dict = json.loads(qr_dict)
        except Exception:
            raise HTTPException(status_code=400, detail="Contenu du QR Code invalide.")

    try:
        device_uuid = str(uuid.uuid4())
        client = pronotepy.Client.qrcode_login(qr_dict, payload.pin, device_uuid)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur QR Code : {str(e)}")

    if not client.logged_in:
        raise HTTPException(status_code=401, detail="Code PIN invalide ou QR code expiré.")

    return extract_pronote_data(client)

@app.post("/api/export/credentials")
def export_credentials(payload: CredentialsPayload):
    clean_url = payload.url.split("/eleve.html")[0]
    if not clean_url.endswith("/"):
        clean_url += "/"

    ent_func = None
    if payload.ent_name and hasattr(ent, payload.ent_name):
        ent_func = getattr(ent, payload.ent_name)

    try:
        client = pronotepy.Client(
            clean_url,
            username=payload.username,
            password=payload.password,
            ent=ent_func,
        )
    except Exception as e:
        err_msg = str(e)
        if "Page html is different" in err_msg:
            raise HTTPException(
                status_code=400, 
                detail="Cet établissement impose une connexion SSO/ENT. Veuillez utiliser l'onglet QR Code."
            )
        raise HTTPException(status_code=400, detail=f"Échec de connexion : {err_msg}")

    if not client.logged_in:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")

    return extract_pronote_data(client)

@app.post("/api/export/token")
def export_token(payload: TokenPayload):
    clean_url = payload.url.split("/eleve.html")[0]
    if not clean_url.endswith("/"):
        clean_url += "/"

    try:
        client = pronotepy.Client.token_login(
            url=clean_url,
            username=payload.username,
            token=payload.token
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Échec jeton : {str(e)}")

    if not client.logged_in:
        raise HTTPException(status_code=401, detail="Jeton expiré ou identifiants incorrects.")

    return extract_pronote_data(client)

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")