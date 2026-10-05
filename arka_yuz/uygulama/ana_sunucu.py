from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uygulama.cekirdek.ayarlar import ayarlar
from uygulama.modeller.veritabani_semasi import Base, engine

# API Router'ları
from uygulama.api.kimlik_dogrulama import router as kimlik_router
from uygulama.api.anonim_forum import router as forum_router
from uygulama.api.canli_triyaj_ws import router as ws_router
from uygulama.api.danismanlik_randevu import router as randevu_router
from uygulama.api.duygu_durumu import router as duygu_router

Base.metadata.create_all(bind=engine)

uygulama = FastAPI(
    title=ayarlar.PROJE_ADI,
    version="1.0.0",
    docs_url="/dokumantasyon",
    redoc_url=None
)

uygulama.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotalar
uygulama.include_router(kimlik_router, prefix=ayarlar.API_V1_STR)
uygulama.include_router(forum_router, prefix=ayarlar.API_V1_STR)
uygulama.include_router(randevu_router, prefix=ayarlar.API_V1_STR)
uygulama.include_router(duygu_router, prefix=ayarlar.API_V1_STR)
uygulama.include_router(ws_router)

@uygulama.get("/")
def durum_kontrol():
    return {
        "sistem": "KampüsDestek API",
        "durum": "aktif",
        "anonimlik_katmani": "3-Katmanlı Kripto İzolasyon Hazır",
        "triyaj_motoru": "Canlı WebSocket & NLP Devrede"
    }
