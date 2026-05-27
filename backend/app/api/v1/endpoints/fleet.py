"""Fleet endpoints — Vehicles & Service Records."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.fleet import Vehicle, VehicleService
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _vout(v: Vehicle):
    return {
        "id": v.id, "name": v.name, "make": v.make, "model": v.model,
        "year": v.year, "plate_number": v.plate_number, "vin": v.vin,
        "fuel_type": v.fuel_type, "mileage": v.mileage, "status": v.status,
        "assigned_to": v.assigned_to,
        "insurance_expiry": v.insurance_expiry.isoformat() if v.insurance_expiry else None,
        "registration_expiry": v.registration_expiry.isoformat() if v.registration_expiry else None,
        "service_count": len(v.services),
        "notes": v.notes,
    }


@router.get("/shops/{shop_id}/fleet")
def list_vehicles(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return [_vout(v) for v in db.query(Vehicle).filter(Vehicle.shop_id == shop_id).order_by(Vehicle.name).all()]


@router.post("/shops/{shop_id}/fleet", status_code=201)
def create_vehicle(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    v = Vehicle(
        shop_id=shop_id, name=body.get("name", "").strip(),
        make=body.get("make") or None, model=body.get("model") or None,
        year=body.get("year"), plate_number=body.get("plate_number") or None,
        vin=body.get("vin") or None, fuel_type=body.get("fuel_type", "petrol"),
        mileage=body.get("mileage", 0), assigned_to=body.get("assigned_to") or None,
        insurance_expiry=date.fromisoformat(body["insurance_expiry"]) if body.get("insurance_expiry") else None,
        registration_expiry=date.fromisoformat(body["registration_expiry"]) if body.get("registration_expiry") else None,
        notes=body.get("notes") or None,
    )
    db.add(v); db.commit(); db.refresh(v)
    return _vout(v)


@router.put("/shops/{shop_id}/fleet/{vid}")
def update_vehicle(shop_id: int, vid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    v = db.query(Vehicle).filter(Vehicle.id == vid, Vehicle.shop_id == shop_id).first()
    if not v: raise HTTPException(status_code=404, detail="Vehicle not found")
    for f in ("name", "make", "model", "year", "plate_number", "vin", "fuel_type", "mileage", "status", "assigned_to", "notes"):
        if f in body: setattr(v, f, body[f] or None if isinstance(body[f], str) and not body[f] else body[f])
    for df in ("insurance_expiry", "registration_expiry"):
        if df in body and body[df]: setattr(v, df, date.fromisoformat(body[df]))
    db.commit(); return _vout(v)


@router.delete("/shops/{shop_id}/fleet/{vid}", status_code=204)
def delete_vehicle(shop_id: int, vid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    v = db.query(Vehicle).filter(Vehicle.id == vid, Vehicle.shop_id == shop_id).first()
    if not v: raise HTTPException(status_code=404, detail="Not found")
    db.delete(v); db.commit()


@router.get("/shops/{shop_id}/fleet/{vid}/services")
def list_services(shop_id: int, vid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(VehicleService).filter(VehicleService.vehicle_id == vid, VehicleService.shop_id == shop_id).order_by(VehicleService.service_date.desc()).all()


@router.post("/shops/{shop_id}/fleet/{vid}/services", status_code=201)
def add_service(shop_id: int, vid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    s = VehicleService(
        vehicle_id=vid, shop_id=shop_id,
        service_type=body.get("service_type", "").strip(),
        service_date=date.fromisoformat(body["service_date"]),
        mileage_at_service=body.get("mileage_at_service"),
        cost=float(body.get("cost", 0)),
        provider=body.get("provider") or None,
        notes=body.get("notes") or None,
    )
    db.add(s); db.commit(); db.refresh(s)
    return s
