from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
from datetime import datetime

router = APIRouter(tags=["PDR Canlı Triyaj Masası"])

class TriyajBaglantiYoneticisi:
    def __init__(self):
        # Aktif bağlı PDR uzmanlarının WebSocket oturumları
        self.aktif_uzmanlar: List[WebSocket] = []

    async def baglan(self, websocket: WebSocket):
        await websocket.accept()
        self.aktif_uzmanlar.append(websocket)

    def ayril(self, websocket: WebSocket):
        if websocket in self.aktif_uzmanlar:
            self.aktif_uzmanlar.remove(websocket)

    async def kriz_alarmi_yayinla(self, bildirim: Dict):
        """Tüm açık PDR uzman ekranlarına anlık kriz paketini gönderir"""
        kopuk_baglantilar = []
        for baglanti in self.aktif_uzmanlar:
            try:
                await baglanti.send_text(json.dumps(bildirim, ensure_ascii=False))
            except Exception:
                kopuk_baglantilar.append(baglanti)
        
        for kopuk in kopuk_baglantilar:
            self.ayril(kopuk)

triyaj_yoneticisi = TriyajBaglantiYoneticisi()

@router.websocket("/ws/pdr/canli-izleme")
async def pdr_canli_izleme_ws(websocket: WebSocket):
    await triyaj_yoneticisi.baglan(websocket)
    try:
        # PDR uzmanına ilk bağlantı doğrulama mesajı
        await websocket.send_text(json.dumps({
            "olay": "BAGLANTI_BASARILI",
            "mesaj": "KampüsDestek Canlı PDR Masasına bağlandınız. Kriz sinyalleri dinleniyor.",
            "zaman": datetime.utcnow().isoformat()
        }, ensure_ascii=False))

        while True:
            # PDR ekranından gelen heartbeat/ping yanıtlarını dinler
            await websocket.receive_text()
    except WebSocketDisconnect:
        triyaj_yoneticisi.ayril(websocket)
