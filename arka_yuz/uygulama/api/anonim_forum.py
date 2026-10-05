from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from uygulama.modeller.veritabani_semasi import (
    SessionLocal, ForumGonderisi, GonderiDestegi, GonderiYorumu, AnonimProfil, Kullanici, KullaniciRolu
)
from uygulama.dogal_dil_isleme.kriz_kural_motoru import kriz_analizi_yap
from uygulama.api.canli_triyaj_ws import triyaj_yoneticisi

router = APIRouter(prefix="/forum", tags=["Anonim Akran Forumu"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# İstek Şemaları
class GonderiOlusturIstegi(BaseModel):
    anonim_profil_id: str
    icerik: str
    etiket: Optional[str] = "#Genel"

class DestekVerIstegi(BaseModel):
    gonderi_id: str
    anonim_profil_id: str
    tur: Optional[str] = "yanindayim"  # 'yanindayim' veya 'begen'

class YorumEkleIstegi(BaseModel):
    gonderi_id: str
    icerik: str
    anonim_profil_id: Optional[str] = None
    uzman_kullanici_id: Optional[str] = None

@router.post("/gonderi-olustur", summary="Yeni Gönderi (NLP Risk Taraması & Canlı Alarm)")
async def gonderi_olustur(istek: GonderiOlusturIstegi, db: Session = Depends(get_db)):
    profil = db.query(AnonimProfil).filter(AnonimProfil.id == uuid.UUID(istek.anonim_profil_id)).first()
    if not profil:
        raise HTTPException(status_code=404, detail="Anonim profil bulunamadı.")

    # 1. Doğal Dil İşleme Kriz Taraması
    risk_puani, kriz_mi, etiketler = kriz_analizi_yap(istek.icerik)

    # 2. Gönderiyi Veritabanına Yaz
    yeni_gonderi = ForumGonderisi(
        anonim_profil_id=profil.id,
        icerik=istek.icerik,
        etiket=istek.etiket,
        risk_skoru=risk_puani,
        kriz_alarmi_mi=kriz_mi
    )
    db.add(yeni_gonderi)
    db.commit()
    db.refresh(yeni_gonderi)

    # 3. Kriz Seviyesindeyse PDR Masasına Canlı WebSocket Uyarısı Gönder
    if kriz_mi:
        await triyaj_yoneticisi.kriz_alarmi_yayinla({
            "olay": "KRITIK_KRIZ_ALARMI",
            "gonderi_id": str(yeni_gonderi.id),
            "anonim_id": str(profil.id),
            "takma_ad": profil.takma_ad,
            "icerik_ozeti": istek.icerik[:90] + "...",
            "etiket": istek.etiket,
            "risk_skoru": risk_puani,
            "zaman": datetime.utcnow().strftime("%H:%M:%S")
        })

    return {
        "mesaj": "Gönderi paylaşıldı.",
        "gonderi_id": str(yeni_gonderi.id),
        "takma_ad": profil.takma_ad,
        "risk_skoru": risk_puani,
        "kriz_durumu": "Acil PDR Bildirimi Tetiklendi" if kriz_mi else "Normal Akran Akışı"
    }

@router.get("/akis", summary="Forum Gönderilerini Listele")
def forum_akisi(db: Session = Depends(get_db)):
    gonderiler = db.query(ForumGonderisi).order_by(ForumGonderisi.olusturulma_tarihi.desc()).limit(30).all()
    sonuc = []
    for g in gonderiler:
        destek_sayisi = db.query(GonderiDestegi).filter(
            GonderiDestegi.gonderi_id == g.id, GonderiDestegi.tur == "yanindayim"
        ).count()
        begen_sayisi = db.query(GonderiDestegi).filter(
            GonderiDestegi.gonderi_id == g.id, GonderiDestegi.tur == "begen"
        ).count()
        yorum_sayisi = db.query(GonderiYorumu).filter(GonderiYorumu.gonderi_id == g.id).count()

        sonuc.append({
            "id": str(g.id),
            "yazar_takma_ad": g.yazar.takma_ad,
            "icerik": g.icerik,
            "etiket": g.etiket,
            "risk_skoru": g.risk_skoru,
            "kriz_alarmi": g.kriz_alarmi_mi,
            "yanindayim_destek": destek_sayisi,
            "begen_sayisi": begen_sayisi,
            "yorum_sayisi": yorum_sayisi,
            "olusturulma_tarihi": g.olusturulma_tarihi.strftime("%Y-%m-%d %H:%M")
        })
    return sonuc

@router.post("/destek-ol", summary="Gönderiye Yanındayım / Beğeni Ekle")
def destek_ol(istek: DestekVerIstegi, db: Session = Depends(get_db)):
    mevcut = db.query(GonderiDestegi).filter(
        GonderiDestegi.gonderi_id == uuid.UUID(istek.gonderi_id),
        GonderiDestegi.anonim_profil_id == uuid.UUID(istek.anonim_profil_id),
        GonderiDestegi.tur == istek.tur
    ).first()

    if mevcut:
        db.delete(mevcut)
        db.commit()
        return {"mesaj": "Destek geri alındı."}

    yeni_destek = GonderiDestegi(
        gonderi_id=uuid.UUID(istek.gonderi_id),
        anonim_profil_id=uuid.UUID(istek.anonim_profil_id),
        tur=istek.tur
    )
    db.add(yeni_destek)

    # Destek veren anonim öğrencinin XP puanını artır (Oyunlaştırma Rozet Motoru)
    profil = db.query(AnonimProfil).filter(AnonimProfil.id == uuid.UUID(istek.anonim_profil_id)).first()
    if profil:
        profil.destek_puani += 10

    db.commit()
    return {"mesaj": "Desteğiniz kaydedildi.", "yeni_xp": profil.destek_puani if profil else 0}

@router.post("/yorum-yap", summary="Gönderiye Yorum Ekle (Akran veya Doğrulanmış Uzman)")
def yorum_yap(istek: YorumEkleIstegi, db: Session = Depends(get_db)):
    if not istek.anonim_profil_id and not istek.uzman_kullanici_id:
        raise HTTPException(status_code=400, detail="Yorum yapan kişi anonim profil veya PDR uzmanı olmalıdır.")

    yorum = GonderiYorumu(
        gonderi_id=uuid.UUID(istek.gonderi_id),
        icerik=istek.icerik,
        anonim_profil_id=uuid.UUID(istek.anonim_profil_id) if istek.anonim_profil_id else None,
        uzman_kullanici_id=uuid.UUID(istek.uzman_kullanici_id) if istek.uzman_kullanici_id else None
    )
    db.add(yorum)
    db.commit()
    return {"mesaj": "Yorum başarıyla eklendi."}
