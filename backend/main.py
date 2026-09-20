import datetime
import json
import pathlib
import uuid
from typing import Any, Dict, Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
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
    url: str
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

def record_error(export_data: Dict[str, Any], key: str, exc: Exception) -> None:
    export_data["export_metadata"].setdefault("errors", {})[key] = f"{type(exc).__name__}: {exc}"


def normalize_for_dedup(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): normalize_for_dedup(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, list):
        return [normalize_for_dedup(item) for item in value]
    if isinstance(value, tuple):
        return [normalize_for_dedup(item) for item in value]
    if isinstance(value, set):
        return sorted(normalize_for_dedup(item) for item in value)
    return value


def deduplicate_records(records: list, keys: Optional[tuple] = None) -> list:
    unique_records = []
    seen_signatures = set()

    for record in records:
        if record is None:
            continue

        if keys is not None:
            payload = {key: record.get(key) for key in keys if key in record}
        else:
            payload = record

        signature = json.dumps(
            normalize_for_dedup(payload),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )

        if signature in seen_signatures:
            continue

        seen_signatures.add(signature)
        unique_records.append(record)

    return unique_records


def deduplicate_export_data(export_data: Dict[str, Any]) -> Dict[str, Any]:
    for key in (
        "periods",
        "homework",
        "absences",
        "delays",
        "punishments",
        "news",
        "menus",
    ):
        if isinstance(export_data.get(key), list):
            export_data[key] = deduplicate_records(export_data[key])

    if "timetable" in export_data and isinstance(export_data["timetable"], list):
        export_data["timetable"] = export_data["timetable"]

    for period in export_data.get("periods", []):
        if not isinstance(period, dict):
            continue

        for nested_key in ("grades", "averages"):
            if isinstance(period.get(nested_key), list):
                period[nested_key] = deduplicate_records(period[nested_key])

    return export_data


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

    periods = []
    try:
        periods = list(client.periods)
        for period in periods:
            p_data = {
                "id": getattr(period, "id", None),
                "name": getattr(period, "name", None),
                "start": safe_iso(getattr(period, "start", None)),
                "end": safe_iso(getattr(period, "end", None)),
                "overall_average": None,
                "class_overall_average": None,
                "grades": [],
                "averages": [],
            }

            for field_name in ("overall_average", "class_overall_average"):
                try:
                    p_data[field_name] = getattr(period, field_name)
                except Exception as e:
                    record_error(export_data, f"periods[{p_data['name']}].{field_name}", e)

            try:
                grades = period.grades
                for index, grade in enumerate(grades):
                    try:
                        subject = getattr(grade, "subject", None)
                        p_data["grades"].append({
                            "id": getattr(grade, "id", None),
                            "subject": getattr(subject, "name", None),
                            "date": safe_iso(getattr(grade, "date", None)),
                            "grade": getattr(grade, "grade", None),
                            "out_of": getattr(grade, "out_of", None),
                            "coefficient": getattr(grade, "coefficient", None),
                            "comment": getattr(grade, "comment", None),
                            "average": getattr(grade, "average", None),
                            "max": getattr(grade, "max", None),
                            "min": getattr(grade, "min", None),
                            "is_bonus": getattr(grade, "is_bonus", False),
                            "is_optional": getattr(grade, "is_optionnal", False),
                        })
                    except Exception as e:
                        record_error(export_data, f"grades[{p_data['name']}][{index}]", e)
            except Exception as e:
                record_error(export_data, f"grades[{p_data['name']}]", e)

            try:
                averages = period.averages
                for index, average in enumerate(averages):
                    try:
                        subject = getattr(average, "subject", None)
                        p_data["averages"].append({
                            "subject": getattr(subject, "name", None),
                            "student": getattr(average, "student", None),
                            "out_of": getattr(average, "out_of", None),
                            "class_average": getattr(average, "class_average", None),
                            "max": getattr(average, "max", None),
                            "min": getattr(average, "min", None),
                        })
                    except Exception as e:
                        record_error(export_data, f"averages[{p_data['name']}][{index}]", e)
            except Exception as e:
                record_error(export_data, f"averages[{p_data['name']}]", e)

            try:
                for absence in period.absences:
                    export_data["absences"].append({
                        "id": absence.id,
                        "from": safe_iso(absence.from_date),
                        "to": safe_iso(absence.to_date),
                        "justified": absence.justified,
                        "hours": absence.hours,
                        "days": absence.days,
                        "reasons": absence.reasons,
                    })
            except Exception as e:
                record_error(export_data, f"absences[{period.name}]", e)

            try:
                for delay in period.delays:
                    export_data["delays"].append({
                        "id": delay.id,
                        "date": safe_iso(delay.date),
                        "minutes": delay.minutes,
                        "justified": delay.justified,
                        "justification": delay.justification,
                        "reasons": delay.reasons,
                    })
            except Exception as e:
                record_error(export_data, f"delays[{period.name}]", e)

            try:
                for punishment in period.punishments:
                    export_data["punishments"].append({
                        "id": punishment.id,
                        "given": safe_iso(punishment.given),
                        "during_lesson": punishment.during_lesson,
                        "exclusion": punishment.exclusion,
                        "homework": punishment.homework,
                        "circumstances": punishment.circumstances,
                        "nature": punishment.nature,
                        "reasons": punishment.reasons,
                        "giver": punishment.giver,
                        "duration": punishment.duration.total_seconds() / 60 if punishment.duration else None,
                    })
            except Exception as e:
                record_error(export_data, f"punishments[{period.name}]", e)

            export_data["periods"].append(p_data)
    except Exception as e:
        record_error(export_data, "periods", e)

    try:
        start_tt = today - datetime.timedelta(days=60)
        end_tt = today + datetime.timedelta(days=30)
        for lesson in client.lessons(start_tt, end_tt):
            teacher_val = None
            teacher = getattr(lesson, "teacher", None)
            if teacher:
                teacher_val = teacher if isinstance(teacher, str) else getattr(teacher, "name", str(teacher))
            elif getattr(lesson, "teacher_name", None):
                teacher_val = getattr(lesson, "teacher_name")

            export_data["timetable"].append({
                "subject": lesson.subject.name if lesson.subject else None,
                "teacher": teacher_val,
                "classroom": lesson.classroom,
                "start": safe_iso(lesson.start),
                "end": safe_iso(lesson.end),
                "canceled": lesson.canceled,
            })
    except Exception as e:
        record_error(export_data, "timetable", e)

    try:
        period_starts = [
            period.start.date()
            for period in periods
            if isinstance(getattr(period, "start", None), datetime.datetime)
        ]
        period_ends = [
            period.end.date()
            for period in periods
            if isinstance(getattr(period, "end", None), datetime.datetime)
        ]
        start_hw = min(period_starts, default=today - datetime.timedelta(days=365))
        end_hw = max(period_ends, default=today + datetime.timedelta(days=365))
        fetched_homework = client.homework(start_hw, end_hw)

        for index, homework in enumerate(fetched_homework):
            try:
                subject = getattr(homework, "subject", None)
                export_data["homework"].append({
                    "id": getattr(homework, "id", None),
                    "subject": getattr(subject, "name", None),
                    "description": getattr(homework, "description", None),
                    "done": getattr(homework, "done", False),
                    "date": safe_iso(getattr(homework, "date", None)),
                })
            except Exception as e:
                record_error(export_data, f"homework[{index}]", e)
    except Exception as e:
        record_error(export_data, "homework", e)
        
    try:
        start_news = datetime.datetime.combine(today - datetime.timedelta(days=60), datetime.time.min)
        end_news = datetime.datetime.combine(today + datetime.timedelta(days=30), datetime.time.max)
        
        try:
            news_items = client.information_and_surveys(date_from=start_news, date_to=end_news)
        except TypeError:
            news_items = client.information_and_surveys(start_news, end_news)

        for info in news_items:
            content = None
            try:
                content = info.content() if callable(getattr(info, "content", None)) else getattr(info, "content", None)
            except Exception:
                pass

            export_data["news"].append({
                "id": getattr(info, "id", None),
                "title": getattr(info, "title", None),
                "author": getattr(info, "author", None),
                "category": getattr(info, "category", None),
                "read": getattr(info, "read", None),
                "creation_date": safe_iso(getattr(info, "creation_date", None)),
                "start_date": safe_iso(getattr(info, "start_date", None)),
                "end_date": safe_iso(getattr(info, "end_date", None)),
                "content": content,
            })
    except Exception as e:
        record_error(export_data, "news", e)

    try:
        start_menu = today - datetime.timedelta(days=7)
        end_menu = today + datetime.timedelta(days=14)

        def food_names(foods):
            if not foods:
                return []
            res = []
            for f in foods:
                if isinstance(f, str):
                    res.append(f)
                else:
                    res.append(getattr(f, "name", str(f)))
            return res

        try:
            menus_list = client.menus(start_menu, end_menu)
        except TypeError:
            menus_list = client.menus(start_menu)

        for menu in menus_list:
            export_data["menus"].append({
                "id": getattr(menu, "id", None),
                "name": getattr(menu, "name", None),
                "date": safe_iso(getattr(menu, "date", None)),
                "is_lunch": getattr(menu, "is_lunch", None),
                "is_dinner": getattr(menu, "is_dinner", None),
                "first_meal": food_names(getattr(menu, "first_meal", [])),
                "main_meal": food_names(getattr(menu, "main_meal", [])),
                "side_meal": food_names(getattr(menu, "side_meal", [])),
                "other_meal": food_names(getattr(menu, "other_meal", [])),
                "cheese": food_names(getattr(menu, "cheese", [])),
                "dessert": food_names(getattr(menu, "dessert", [])),
            })
    except Exception as e:
        record_error(export_data, "menus", e)

    return deduplicate_export_data(export_data)

@app.post("/api/export/qrcode")
def export_qrcode(payload: QRCodePayload):
    qr_dict = payload.qr_data
    if isinstance(qr_dict, str):
        try:
            qr_dict = json.loads(qr_dict)
        except Exception:
            raise HTTPException(status_code=400, detail="Contenu du QR Code invalide.")

    if not isinstance(qr_dict, dict):
        raise HTTPException(status_code=400, detail="Le QR Code doit contenir un objet JSON.")

    missing_keys = [key for key in ("login", "jeton", "url") if not qr_dict.get(key)]
    if missing_keys:
        missing = ", ".join(missing_keys)
        raise HTTPException(
            status_code=400,
            detail=f"QR Code PRONOTE incomplet : champ(s) manquant(s) : {missing}.",
        )

    if not payload.pin.isdigit() or len(payload.pin) != 4:
        raise HTTPException(status_code=400, detail="Le code PIN doit contenir exactement 4 chiffres.")

    try:
        device_uuid = str(uuid.uuid4())
        client = pronotepy.Client.qrcode_login(qr_dict, payload.pin, device_uuid)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"QR Code PRONOTE invalide : champ {e.args[0]} absent.")
    except Exception as e:
        error_message = str(e).strip()
        if "invalid confirmation code" in error_message.lower():
            error_message = "Code PIN incorrect pour ce QR Code."
        elif not error_message:
            error_message = "Le QR Code n'a pas pu être traité par PRONOTE."
        raise HTTPException(status_code=400, detail=f"Erreur QR Code : {error_message}")

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
            pronote_url=clean_url,
            username=payload.username,
            password=payload.token,
            uuid=str(uuid.uuid4()),
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