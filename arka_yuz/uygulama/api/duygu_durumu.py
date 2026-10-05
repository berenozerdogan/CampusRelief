from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import uuid

from uygulama.modeller.veritabani_semasi import SessionLocal, DuyguDurumuKaydi, AnonimProfil

router = APIRouter(prefix="/duygu-durumu", tags=["Mood & İyilik Hali"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class DuyguKayitIstegi(BaseModel):
    anonim_profil_id: str
    puan: int  # 1 (Tükenmiş) - 5 (Harika)
    not_metni: Optional[str] = None

@router.post("/kaydet", summary="Günlük Ruh Hali Kaydet (1-5 Puan)")
def duygu_kaydet(istek: DuyguKayitIstegi, db: Session = Depends(get_db)):
    if istek.puan < 1 or istek.puan > 5:
        raise HTTPException(status_code=400, detail="Puan 1 ile 5 arasında olmalıdır.")

    kayit = DuyguDurumuKaydi(
        anonim_profil_id=uuid.UUID(istek.anonim_profil_id),
        puan=istek.puan,
        not_metni=istek.not_metni
    )
    db.add(kayit)
    db.commit()
    return {"mesaj": "Duygu durumu başarıyla kaydedildi.", "puan": istek.puan}

@router.get("/haftalik-ozet", summary="Son 7 Günlük Ruh Hali Seyri")
def haftalik_ozet(anonim_profil_id: str, db: Session = Depends(get_db)):
    bir_hafta_once = datetime.utcnow() - timedelta(days=7)
    kayitlar = db.query(DuyguDurumuKaydi).filter(
        DuyguDurumuKaydi.anonim_profil_id == uuid.UUID(anonim_profil_id),
        DuyguDurumuKaydi.olusturulma_tarihi >= bir_hafta_once
    ).order_by(DuyguDurumuKaydi.olusturulma_tarihi.asc()).all()

    return [
        {
            "puan": k.puan,
            "not": k.not_metni,
            "tarih": k.olusturulma_tarihi.strftime("%a %d.%m")
        }
        for k in kayitlar
    ]
