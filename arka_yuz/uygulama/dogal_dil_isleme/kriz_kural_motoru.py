import re
from typing import Tuple, List

# Yüksek ve orta riskli semantik ifadeler & ağırlıkları
KRITIK_IFADELER = {
    # Kritik Kriz (85 - 100 Risk)
    "uyanmak istemiyorum": 90,
    "yaşamak istemiyorum": 95,
    "yasamak istemiyorum": 95,
    "intihar": 100,
    "canıma kıymak": 95,
    "canima kiymak": 95,
    "kendime zarar": 90,
    "her şeyin sonu": 85,
    "her seyin sonu": 85,
    "ölmek istiyorum": 95,
    "olmek istiyorum": 95,
    
    # Yüksek Kaygı & Bunalmışlık (60 - 80 Risk)
    "gücüm kalmadı": 70,
    "gucum kalmadi": 70,
    "tükenmiş hissediyorum": 65,
    "tukenmis hissediyorum": 65,
    "sokakta kalacağım": 75,
    "sokakta kalacagim": 75,
    "dayanamıyorum": 70,
    "dayanamiyorum": 70,
    "çaresizim": 65,
    "caresizim": 65,

    # Orta Düzey Stres (30 - 55 Risk)
    "uyku düzenim kalmadı": 40,
    "uyku duzenim kalmadi": 40,
    "bunalmış": 45,
    "bunalmis": 45,
    "aşırı kaygılıyım": 50,
    "asiri kaygiliyim": 50,
    "yetişemiyorum": 35,
    "yetisemiyorum": 35
}

def kriz_analizi_yap(metin: str) -> Tuple[int, bool, List[str]]:
    """
    Gönderi metnini tarayarak:
    - risk_skoru (0-100)
    - kriz_mi (True/False - 75 ve üzeri kritik alarm)
    - eslesen_etiketler (yakalanan kriz kökleri)
    döndürür.
    """
    if not metin:
        return 0, False, []

    temiz_metin = metin.lower()
    en_yuksek_skor = 0
    eslesenler = []

    for ifade, puan in KRITIK_IFADELER.items():
        if re.search(r'\b' + re.escape(ifade) + r'\b', temiz_metin) or ifade in temiz_metin:
            eslesenler.append(ifade)
            if puan > en_yuksek_skor:
                en_yuksek_skor = puan

    # Eğer metinde hiçbir anahtar ifade yoksa taban skor 5 (stabil)
    if en_yuksek_skor == 0:
        en_yuksek_skor = 5

    kriz_alarmi = en_yuksek_skor >= 75
    return en_yuksek_skor, kriz_alarmi, eslesenler
