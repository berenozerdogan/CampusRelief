import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import (
    Column, String, Text, Integer, ForeignKey, DateTime, Boolean, Enum as SQLEnum, create_engine
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from uygulama.cekirdek.ayarlar import ayarlar

engine = create_engine(ayarlar.VERITABANI_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class KullaniciRolu(str, Enum):
    OGRENCI = "ogrenci"
    PDR = "pdr"
    ADMIN = "admin"

class RandevuDurumu(str, Enum):
    BEKLEMEDE = "beklemede"
    ONAYLANDI = "onaylandi"
    REDDEDILDI = "reddedildi"
    IPTAL = "iptal"

class AuthKullanici(Base):
    __tablename__ = "auth_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    eposta = Column(String(255), unique=True, nullable=False, index=True)
    parola_ozeti = Column(String(255), nullable=False)
    ogrenci_no = Column(String(50), unique=True, nullable=True)
    aktif_mi = Column(Boolean, default=True)
    olusturulma_tarihi = Column(DateTime, default=datetime.utcnow)

    profil = relationship("Kullanici", back_populates="auth", uselist=False)

class Kullanici(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), unique=True, nullable=False)
    rol = Column(SQLEnum(KullaniciRolu), default=KullaniciRolu.OGRENCI, nullable=False)
    
    ad_soyad = Column(String(100), nullable=True)
    unvan = Column(String(100), nullable=True)
    birim = Column(String(100), nullable=True)

    auth = relationship("AuthKullanici", back_populates="profil")
    anonim_profil = relationship("AnonimProfil", back_populates="kullanici", uselist=False)
    uzman_randevulari = relationship("Randevu", back_populates="uzman")

class AnonimProfil(Base):
    __tablename__ = "anonymous_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kullanici_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    takma_ad = Column(String(50), unique=True, nullable=False)
    avatar_kodu = Column(String(50), default="avatar_tilki")
    destek_puani = Column(Integer, default=0)

    kullanici = relationship("Kullanici", back_populates="anonim_profil")
    gonderiler = relationship("ForumGonderisi", back_populates="yazar")
    destekler = relationship("GonderiDestegi", back_populates="destekleyen")
    duygular = relationship("DuyguDurumuKaydi", back_populates="profil")

class ForumGonderisi(Base):
    __tablename__ = "forum_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anonim_profil_id = Column(UUID(as_uuid=True), ForeignKey("anonymous_profiles.id"), nullable=False)
    icerik = Column(Text, nullable=False)
    etiket = Column(String(50), index=True)
    risk_skoru = Column(Integer, default=0)
    kriz_alarmi_mi = Column(Boolean, default=False)
    olusturulma_tarihi = Column(DateTime, default=datetime.utcnow)

    yazar = relationship("AnonimProfil", back_populates="gonderiler")
    destekler = relationship("GonderiDestegi", back_populates="gonderi")
    yorumlar = relationship("GonderiYorumu", back_populates="gonderi")

class GonderiDestegi(Base):
    __tablename__ = "post_supports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gonderi_id = Column(UUID(as_uuid=True), ForeignKey("forum_posts.id"), nullable=False)
    anonim_profil_id = Column(UUID(as_uuid=True), ForeignKey("anonymous_profiles.id"), nullable=False)
    tur = Column(String(20), default="yanindayim")

    gonderi = relationship("ForumGonderisi", back_populates="destekler")
    destekleyen = relationship("AnonimProfil", back_populates="destekler")

class GonderiYorumu(Base):
    __tablename__ = "post_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gonderi_id = Column(UUID(as_uuid=True), ForeignKey("forum_posts.id"), nullable=False)
    anonim_profil_id = Column(UUID(as_uuid=True), ForeignKey("anonymous_profiles.id"), nullable=True)
    uzman_kullanici_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    icerik = Column(Text, nullable=False)
    olusturulma_tarihi = Column(DateTime, default=datetime.utcnow)

    gonderi = relationship("ForumGonderisi", back_populates="yorumlar")

class DuyguDurumuKaydi(Base):
    __tablename__ = "mood_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anonim_profil_id = Column(UUID(as_uuid=True), ForeignKey("anonymous_profiles.id"), nullable=False)
    puan = Column(Integer, nullable=False)
    not_metni = Column(String(255), nullable=True)
    olusturulma_tarihi = Column(DateTime, default=datetime.utcnow)

    profil = relationship("AnonimProfil", back_populates="duygular")

class DanismanlikMesaji(Base):
    __tablename__ = "consultation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anonim_profil_id = Column(UUID(as_uuid=True), ForeignKey("anonymous_profiles.id"), nullable=False)
    uzman_kullanici_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    gonderen_turu = Column(String(20), nullable=False)
    icerik = Column(Text, nullable=False)
    olusturulma_tarihi = Column(DateTime, default=datetime.utcnow)

class Randevu(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anonim_profil_id = Column(UUID(as_uuid=True), ForeignKey("anonymous_profiles.id"), nullable=False)
    uzman_kullanici_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    tarih = Column(DateTime, nullable=False)
    sure_dakika = Column(Integer, default=45)
    gorusme_turu = Column(String(50), default="online_sesli")
    durum = Column(SQLEnum(RandevuDurumu), default=RandevuDurumu.BEKLEMEDE)
    notlar = Column(Text, nullable=True)
    olusturulma_tarihi = Column(DateTime, default=datetime.utcnow)

    uzman = relationship("Kullanici", back_populates="uzman_randevulari")
