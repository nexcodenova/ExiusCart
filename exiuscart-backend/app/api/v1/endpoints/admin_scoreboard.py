"""Admin scoreboard and data spend meter (owner only: it shows revenue and what the data costs).

  GET /admin/scoreboard           the targets, each counted from real records (or kept by hand)
  PUT /admin/scoreboard/manual    set a hand-kept number (interviews, case studies, unvalidated features)
  GET /admin/scoreboard/spend     what Prodora Intelligence cost this month against the budget
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import require_superuser
from app.core.database import get_db
from app.intel import scoreboard, spend
from app.models.intel import ScoreboardEntry
from app.models.user import User

router = APIRouter()


@router.get("/admin/scoreboard")
def get_scoreboard(db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    return scoreboard.compute(db)


class ManualIn(BaseModel):
    key: str
    value: int = Field(ge=0, le=100000)
    note: Optional[str] = Field(default=None, max_length=500)


@router.put("/admin/scoreboard/manual")
def set_manual(body: ManualIn, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    if body.key not in scoreboard.MANUAL_KEYS:
        raise HTTPException(status_code=422, detail="That number is counted automatically and cannot be typed in.")
    row = db.query(ScoreboardEntry).filter(ScoreboardEntry.key == body.key).first()
    if not row:
        row = ScoreboardEntry(key=body.key)
        db.add(row)
    row.value, row.note, row.updated_by_user_id = body.value, (body.note or "").strip() or None, admin.id
    db.commit()
    return scoreboard.manual_entries(db)[body.key]


@router.get("/admin/scoreboard/spend")
def get_spend(db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    return spend.report(db)
