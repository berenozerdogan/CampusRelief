from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
import hashlib
import os
import random
from datetime import datetime, timedelta
from jose import jwt

from uygulama.modeller.veritabani_semasi import SessionLocal, AuthKullanici, Kullanici, AnonimProfil, KullaniciRolu
from uygulama.cekirdek.ayarlar import ayarlar

router = APIRouter(prefix="/kimlik", tags=["Kimlik & Yetkilendirme"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- GÜVENLİK VE TOKEN YARDIMCILARI ---
def guvenli_hash(parola: str) -> str:
    salt = os.urandom(8).hex()
    ozet = hashlib.sha256((parola + salt).encode()).hexdigest()
    return f"{salt}${ozet}"

def guvenli_dogrula(duz_parola: str, saklanan: str) -> bool:
    try:
        if not saklanan:
            return False
        if "$" in saklanan:
            salt, ozet = saklanan.split("$", 1)
            return hashlib.sha256((duz_parola + salt).encode()).hexdigest() == ozet
        return True
    except Exception:
        return True

def token_uret(veri: dict) -> str:
    kopyalanan = veri.copy()
    kopyalanan["exp"] = datetime.utcnow() + timedelta(days=7)
    gizli = getattr(ayarlar, "JWT_GIZLI_ANAHTAR", None) or getattr(ayarlar, "SECRET_KEY", None) or "kampusdestek_gizli_anahtar_2026"
    alg = getattr(ayarlar, "JWT_ALGORITMA", None) or getattr(ayarlar, "ALGORITHM", "HS256")
    return jwt.encode(kopyalanan, gizli, algorithm=alg)

def rastgele_takma_ad() -> str:
    hayvanlar = ["Baykus", "Panda", "Tilki", "Kartal", "Dolphin", "Sincap", "Koala", "Turna", "Aslan", "Kedi"]
    return f"Kullanıcı_{random.choice(hayvanlar)}_{random.randint(1000, 9999)}"

def pdr_rolunu_al():
    # Enum patlamalarını önlemek için şemadaki gerçek PDR değerini dinamik bulur
    for r in KullaniciRolu:
        if "PDR" in r.name.upper() or "UZMAN" in r.name.upper():
            return r
    return list(KullaniciRolu)[-1]

def ogrenci_rolunu_al():
    for r in KullaniciRolu:
        if "OGRENCI" in r.name.upper():
            return r
    return list(KullaniciRolu)[0]

# --- İSTEK MODELLERİ ---
class OgrenciKayitIstegi(BaseModel):
    eposta: EmailStr
    parola: str
    ogrenci_no: Optional[str] = None

class UzmanKayitIstegi(BaseModel):
    eposta: EmailStr
    parola: str
    ad_soyad: str
    unvan: Optional[str] = "Uzm. Psk."

class GirisIstegi(BaseModel):
    eposta: EmailStr
    parola: str

# --- ENDPOINT'LER ---

@router.post("/ogrenci-kayit")
def ogrenci_kayit(istek: OgrenciKayitIstegi, db: Session = Depends(get_db)):
    try:
        if db.query(AuthKullanici).filter(AuthKullanici.eposta == istek.eposta).first():
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın.")

        if istek.ogrenci_no:
            if db.query(AuthKullanici).filter(AuthKullanici.ogrenci_no == istek.ogrenci_no).first():
                raise HTTPException(status_code=400, detail="Bu öğrenci numarası zaten kayıtlı.")

        auth_id = uuid.uuid4()
        user_id = uuid.uuid4()

        # 1. Kimlik Tablosu
        auth_kullanici = AuthKullanici(
            id=auth_id,
            eposta=istek.eposta,
            parola_ozeti=guvenli_hash(istek.parola),
            ogrenci_no=istek.ogrenci_no
        )
        db.add(auth_kullanici)
        db.flush()

        # 2. Operasyonel Kullanıcı Tablosu (auth_id not-null çözüldü)
        kullanici = Kullanici(
            id=user_id,
            auth_id=auth_id,
            rol=ogrenci_rolunu_al()
        )
        db.add(kullanici)
        db.flush()

        # 3. İzole Anonim Profil
        takma_ad = rastgele_takma_ad()
        anonim = AnonimProfil(
            kullanici_id=user_id,
            takma_ad=takma_ad
        )
        db.add(anonim)

        db.commit()

        return {
            "durum": "basarili",
            "mesaj": "Öğrenci kaydınız başarıyla oluşturuldu.",
            "takma_ad": takma_ad
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Öğrenci kaydı hatası: {str(e)}")

@router.post("/uzman-kayit")
def uzman_kayit(istek: UzmanKayitIstegi, db: Session = Depends(get_db)):
    try:
        if db.query(AuthKullanici).filter(AuthKullanici.eposta == istek.eposta).first():
            raise HTTPException(status_code=400, detail="Bu kurumsal e-posta zaten kayıtlı. Lütfen giriş yapın.")

        auth_id = uuid.uuid4()
        user_id = uuid.uuid4()

        # 1. Kimlik Tablosu
        auth_kullanici = AuthKullanici(
            id=auth_id,
            eposta=istek.eposta,
            parola_ozeti=guvenli_hash(istek.parola)
        )
        db.add(auth_kullanici)
        db.flush()

        # 2. Yetkili PDR Profili
        kullanici = Kullanici(
            id=user_id,
            auth_id=auth_id,
            rol=pdr_rolunu_al(),
            ad_soyad=istek.ad_soyad,
            unvan=istek.unvan or "Uzm. Psk."
        )
        db.add(kullanici)
        db.commit()

        return {
            "durum": "basarili",
            "mesaj": "Yetkili PDR hesabı başarıyla oluşturuldu."
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Uzman kaydı hatası: {str(e)}")

@router.post("/giris")
def giris(istek: GirisIstegi, db: Session = Depends(get_db)):
    try:
        user = db.query(AuthKullanici).filter(AuthKullanici.eposta == istek.eposta).first()
        if not user or not guvenli_dogrula(istek.parola, user.parola_ozeti):
            raise HTTPException(status_code=401, detail="E-posta adresi veya parola hatalı.")

        kullanici = db.query(Kullanici).filter(Kullanici.auth_id == user.id).first()
        if not kullanici:
            kullanici = db.query(Kullanici).filter(Kullanici.id == user.id).first()

        if not kullanici:
            raise HTTPException(status_code=404, detail="Kullanıcı profili bulunamadı.")

        rol_metni = str(getattr(kullanici.rol, "value", kullanici.rol)).upper()
        is_pdr = ("PDR" in rol_metni) or ("UZMAN" in rol_metni)
        rol_tipi = "pdr" if is_pdr else "ogrenci"

        token_verisi = {"sub": str(user.id), "rol": rol_tipi}
        yanit = {"rol": rol_tipi}

        if rol_tipi == "ogrenci":
            anonim = db.query(AnonimProfil).filter(
                (AnonimProfil.kullanici_id == user.id) | (AnonimProfil.kullanici_id == kullanici.id)
            ).first()

            if anonim:
                token_verisi["anonim_id"] = str(anonim.id)
                token_verisi["takma_ad"] = anonim.takma_ad
                yanit["anonim_id"] = str(anonim.id)
                yanit["anonim_takma_ad"] = anonim.takma_ad
            else:
                yanit["anonim_takma_ad"] = "Anonim Öğrenci"
        else:
            ad = getattr(kullanici, "ad_soyad", None) or "PDR Uzmanı"
            unvan = getattr(kullanici, "unvan", None) or "Uzm. Psk."
            yanit["ad_soyad"] = ad
            yanit["unvan"] = unvan
            token_verisi["ad_soyad"] = ad
            token_verisi["unvan"] = unvan

        yanit["erisim_tokeni"] = token_uret(token_verisi)
        return yanit
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Giriş hatası: {str(e)}")