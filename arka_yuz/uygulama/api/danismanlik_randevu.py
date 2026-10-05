from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from uygulama.modeller.veritabani_semasi import (
    SessionLocal, DanismanlikMesaji, Randevu, RandevuDurumu, AnonimProfil, Kullanici, KullaniciRolu
)

router = APIRouter(prefix="/danismanlik", tags=["PDR Danışmanlık & Randevu"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Şemalar
class MesajGonderIstegi(BaseModel):
    anonim_profil_id: str
    uzman_kullanici_id: str
    gonderen_turu: str  # 'uzman' veya 'ogrenci'
    icerik: str

class RandevuTeklifIstegi(BaseModel):
    anonim_profil_id: str
    uzman_kullanici_id: str
    tarih: datetime
    sure_dakika: Optional[int] = 45
    gorusme_turu: Optional[str] = "online_sesli"  # 'online_sesli', 'online_metin', 'yuzyuze'
    notlar: Optional[str] = "Anonim PDR Görüşmesi - Kamera zorunluluğu yoktur."

class RandevuYanitIstegi(BaseModel):
    randevu_id: str
    onaylandi_mi: bool

# 1. Uzman ile Öğrenci Arasındaki Güvenli Mesajlaşma
@router.post("/mesaj-gonder", summary="Güvenli Özel Mesaj İlet")
def mesaj_gonder(istek: MesajGonderIstegi, db: Session = Depends(get_db)):
    yeni_mesaj = DanismanlikMesaji(
        anonim_profil_id=uuid.UUID(istek.anonim_profil_id),
        uzman_kullanici_id=uuid.UUID(istek.uzman_kullanici_id),
        gonderen_turu=istek.gonderen_turu,
        icerik=istek.icerik
    )
    db.add(yeni_mesaj)
    db.commit()
    db.refresh(yeni_mesaj)
    return {"mesaj": "Mesaj iletildi.", "id": str(yeni_mesaj.id)}

@router.get("/mesaj-gecmisi", summary="Konuşma Geçmişini Getir")
def mesaj_gecmisi(anonim_profil_id: str, uzman_kullanici_id: str, db: Session = Depends(get_db)):
    mesajlar = db.query(DanismanlikMesaji).filter(
        DanismanlikMesaji.anonim_profil_id == uuid.UUID(anonim_profil_id),
        DanismanlikMesaji.uzman_kullanici_id == uuid.UUID(uzman_kullanici_id)
    ).order_by(DanismanlikMesaji.olusturulma_tarihi.asc()).all()

    uzman = db.query(Kullanici).filter(Kullanici.id == uuid.UUID(uzman_kullanici_id)).first()
    anonim = db.query(AnonimProfil).filter(AnonimProfil.id == uuid.UUID(anonim_profil_id)).first()

    return {
        "uzman": f"{uzman.unvan or ''} {uzman.ad_soyad or ''}".strip() if uzman else "PDR Uzmanı",
        "ogrenci_takma_ad": anonim.takma_ad if anonim else "Anonim Öğrenci",
        "mesajlar": [
            {
                "id": str(m.id),
                "gonderen": m.gonderen_turu,
                "icerik": m.icerik,
                "zaman": m.olusturulma_tarihi.strftime("%H:%M - %d.%m.%Y")
            }
            for m in mesajlar
        ]
    }

# 2. PDR Uzmanının Mesaj İçinden Randevu Teklif Etmesi
@router.post("/randevu-teklif-et", summary="PDR Uzmanı: Randevu Teklifi Oluştur")
def randevu_teklif_et(istek: RandevuTeklifIstegi, db: Session = Depends(get_db)):
    yeni_randevu = Randevu(
        anonim_profil_id=uuid.UUID(istek.anonim_profil_id),
        uzman_kullanici_id=uuid.UUID(istek.uzman_kullanici_id),
        tarih=istek.tarih,
        sure_dakika=istek.sure_dakika,
        gorusme_turu=istek.gorusme_turu,
        durum=RandevuDurumu.BEKLEMEDE,
        notlar=istek.notlar
    )
    db.add(yeni_randevu)
    db.commit()
    db.refresh(yeni_randevu)

    # Otomatik olarak danışmanlık mesajlarına da randevu bildirim kartı ekleyelim
    sistem_mesaji = DanismanlikMesaji(
        anonim_profil_id=uuid.UUID(istek.anonim_profil_id),
        uzman_kullanici_id=uuid.UUID(istek.uzman_kullanici_id),
        gonderen_turu="uzman",
        icerik=f"[RANDEVU_TEKLIFI]: {istek.tarih.strftime('%d.%m.%Y saat %H:%M')} için {istek.sure_dakika} dakikalık {istek.gorusme_turu} seans teklif edildi."
    )
    db.add(sistem_mesaji)
    db.commit()

    return {
        "mesaj": "Randevu teklifi oluşturuldu ve öğrenciye iletildi.",
        "randevu_id": str(yeni_randevu.id),
        "durum": yeni_randevu.durum.value
    }

# 3. Öğrencinin Randevuyu Tek Tıkla Onaylaması / Reddetmesi
@router.patch("/randevu-yanitla", summary="Öğrenci: Randevuyu Onayla veya Reddet")
def randevu_yanitla(istek: RandevuYanitIstegi, db: Session = Depends(get_db)):
    randevu = db.query(Randevu).filter(Randevu.id == uuid.UUID(istek.randevu_id)).first()
    if not randevu:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı.")

    randevu.durum = RandevuDurumu.ONAYLANDI if istek.onaylandi_mi else RandevuDurumu.REDDEDILDI
    
    # Karşı tarafa otomatik onay bildirimi mesajı düşür
    bildirim_metni = "✓ Randevu teklifini kabul ettim, belirlenen saatte görüşmek üzere." if istek.onaylandi_mi else "✗ Randevu saatini uygun bulmadığım için reddettim."
    yanit_mesaji = DanismanlikMesaji(
        anonim_profil_id=randevu.anonim_profil_id,
        uzman_kullanici_id=randevu.uzman_kullanici_id,
        gonderen_turu="ogrenci",
        icerik=bildirim_metni
    )
    db.add(yanit_mesaji)
    db.commit()

    return {
        "mesaj": "Randevu yanıtınız kaydedildi.",
        "randevu_id": str(randevu.id),
        "guncel_durum": randevu.durum.value
    }

# 4. PDR Uzmanı İçin Ajanda / Randevu Listesi
@router.get("/uzman-randevulari", summary="PDR Uzmanı: Tüm Randevu Ajandasını Gör")
def uzman_randevulari(uzman_kullanici_id: str, db: Session = Depends(get_db)):
    randevular = db.query(Randevu).filter(
        Randevu.uzman_kullanici_id == uuid.UUID(uzman_kullanici_id)
    ).order_by(Randevu.tarih.asc()).all()

    sonuclar = []
    for r in randevular:
        anon = db.query(AnonimProfil).filter(AnonimProfil.id == r.anonim_profil_id).first()
        sonuclar.append({
            "randevu_id": str(r.id),
            "danisan_takma_ad": anon.takma_ad if anon else "Anonim",
            "tarih": r.tarih.strftime("%d.%m.%Y %H:%M"),
            "sure": r.sure_dakika,
            "tur": r.gorusme_turu,
            "durum": r.durum.value,
            "notlar": r.notlar
        })
    return sonuclar
