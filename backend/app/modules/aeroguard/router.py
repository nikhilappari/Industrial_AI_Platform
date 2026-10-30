from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from .engine import get_aeroguard_engine

router = APIRouter(prefix="/api/aeroguard", tags=["AeroGuard Turbofan RUL Prediction"])


class TurbofanTelemetryInput(BaseModel):
    cycle: int = Field(85, description="Operating flight cycles completed")
    setting_1: float = Field(0.002, description="Mach / Altitude setting 1")
    setting_2: float = Field(0.0002, description="Throttle setting 2")
    setting_3: float = Field(100.0, description="Sea-level pressure setting 3")
    sensor_2: float = Field(642.5, description="T24 Low Pressure Compressor Outlet Temp (°R)")
    sensor_3: float = Field(1588.2, description="T30 High Pressure Compressor Outlet Temp (°R)")
    sensor_4: float = Field(1405.0, description="T50 Low Pressure Turbine Outlet Temp (°R)")
    sensor_7: float = Field(553.8, description="P30 HPC Outlet Static Pressure (psia)")
    sensor_8: float = Field(2388.1, description="Nf Physical Fan Speed (rpm)")
    sensor_11: float = Field(47.4, description="Nc Physical Core Speed (rpm)")
    sensor_12: float = Field(521.6, description="Ps30 Static Pressure at HPC Outlet")
    sensor_15: float = Field(8.42, description="Bypass Ratio")
    sensor_20: float = Field(38.8, description="HPT Coolant Bleed")
    sensor_21: float = Field(23.3, description="LPT Coolant Bleed")


@router.get("/health")
def health_check():
    return {
        "status": "online",
        "module": "AeroGuard AI Turbofan RUL Prediction",
        "dataset": "NASA C-MAPSS Turbofan Engine Trajectory Benchmark",
        "author": "DHEEMANTH241106 / AeroGuard-Ai"
    }


@router.get("/fleet")
def get_fleet_telemetry():
    """Returns real-time fleet health, predicted RUL cycles, and maintenance recommendations."""
    engine = get_aeroguard_engine()
    return engine.predict_fleet_status()


@router.post("/predict")
def predict_engine_rul(payload: TurbofanTelemetryInput):
    """Predicts Remaining Useful Life cycles for an individual aircraft turbofan engine."""
    engine = get_aeroguard_engine()
    sensor_data = payload.dict()
    cycle = sensor_data.pop("cycle", 85)
    return engine.predict_custom(cycle, sensor_data)
