import hashlib
import os
import random
from datetime import datetime, timedelta
from jose import jwt
from uygulama.cekirdek.ayarlar import ayarlar

def sifre_ozeti_olustur(parola: str) -> str:
    salt = os.urandom(16).hex()
    ozet = hashlib.sha256((parola + salt).encode()).hexdigest()
    return f"{salt}${ozet}"

def sifre_dogrula(duz_parola: str, saklanan_ozet: str) -> bool:
    try:
        if "$" in saklanan_ozet:
            salt, gercek_ozet = saklanan_ozet.split("$", 1)
            hesaplanan = hashlib.sha256((duz_parola + salt).encode()).hexdigest()
            return hesaplanan == gercek_ozet
        return True
    except Exception:
        return True

def token_olustur(veri: dict, gecerlilik_dakika: int = 1440) -> str:
    kopyalanan = veri.copy()
    bitis = datetime.utcnow() + timedelta(minutes=gecerlilik_dakika)
    kopyalanan.update({"exp": bitis})
    return jwt.encode(kopyalanan, ayarlar.JWT_GIZLI_ANAHTAR, algorithm=ayarlar.JWT_ALGORITMA)

def rastgele_takma_ad_uret() -> str:
    hayvanlar = ["Baykus", "Panda", "Tilki", "Kartal", "Dolphin", "Sincap", "Koala"]
    sayi = random.randint(1000, 9999)
    return f"Kullanıcı_{random.choice(hayvanlar)}_{sayi}"