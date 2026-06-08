from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name = Column(String(255), nullable=False)      # e.g. "Delivery Van 1"
    make = Column(String(100), nullable=True)        # Toyota
    model = Column(String(100), nullable=True)       # Hilux
    year = Column(Integer, nullable=True)
    plate_number = Column(String(30), nullable=True)
    vin = Column(String(50), nullable=True)
    fuel_type = Column(String(20), default="petrol")  # petrol | diesel | electric | hybrid
    mileage = Column(Integer, default=0)
    status = Column(String(20), default="active")     # active | maintenance | retired
    assigned_to = Column(String(255), nullable=True)   # employee name
    insurance_expiry = Column(Date, nullable=True)
    registration_expiry = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    services = relationship("VehicleService", back_populates="vehicle", cascade="all, delete-orphan")


class VehicleService(Base):
    __tablename__ = "vehicle_services"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    service_type = Column(String(100), nullable=False)   # Oil Change, Tyre, etc.
    service_date = Column(Date, nullable=False)
    mileage_at_service = Column(Integer, nullable=True)
    cost = Column(Numeric(10, 2), default=0)
    provider = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vehicle = relationship("Vehicle", back_populates="services")
