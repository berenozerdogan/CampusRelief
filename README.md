# KampüsDestek - Üniversite Öğrencileri İçin Dijital Destek ve Danışmanlık Platformu

KampüsDestek; üniversite öğrencilerinin psikolojik danışmanlık süreçlerini, duygu durumu takiplerini ve anonim etkileşimlerini güvenli bir altyapıda yönetebilmeleri amacıyla geliştirilmiş full-stack bir web platformudur. Sistem, öğrenci gizliliğini korumak adına KVKK ve üniversite etik kurulu yönergelerine uygun olarak anonimlik ve veri güvenliği önceliklendirilerek tasarlanmıştır.

---

## Mimari ve Temel Modüller

### 1. Arka Yüz (Backend - Python / FastAPI)
- **Kimlik Doğrulama & Güvenlik:** Yetkilendirme protokolleri, şifreleme ve KVKK uyumlu veri saklama politikaları (`cekirdek/guvenlik.py`, `api/kimlik_dogrulama.py`).
- **Canlı Triyaj WebSocket Servisi:** Acil destek ve anlık danışman yönlendirmesi için düşük gecikmeli çift yönlü soket iletişimi (`api/canli_triyaj_ws.py`).
- **Doğal Dil İşleme (NLP):** Duygu durumu çıkarımı ve risk analizi odaklı metin işleme modülü (`dogal_dil_isleme/`, `api/duygu_durumu.py`).
- **Danışmanlık & Randevu:** Öğrenci ile uzman danışmanlar arasında randevu planlama ve seans takibi (`api/danismanlik_randevu.py`).
- **Anonim Forum:** Öğrencilerin kişisel verilerini paylaşmadan deneyim aktarımı yapabildikleri güvenli paylaşım alanı (`api/anonim_forum.py`).

### 2. Ön Yüz (Frontend - React / TypeScript)
- **Tip Güvenliği & Performans:** TypeScript (`.tsx`) tabanlı bileşen mimarisi ve Tailwind CSS ile hazırlanan kullanıcı arayüzü.
- **Duyarlı Bildirim ve Form Yönetimi:** Randevu talepleri, form doğrulama süreçleri ve anlık geri bildirim mekanizmaları.

---

## Dizin Yapısı

```text
kampusdestek/
├── arka_yuz/
│   ├── migrasyonlar/          # Veritabanı şema ve sürüm geçişleri
│   ├── uygulama/
│   │   ├── api/               # REST ve WebSocket uç noktaları
│   │   │   ├── anonim_forum.py
│   │   │   ├── canli_triyaj_ws.py
│   │   │   ├── danismanlik_randevu.py
│   │   │   ├── duygu_durumu.py
│   │   │   └── kimlik_dogrulama.py
│   │   ├── cekirdek/          # Yapılandırma, ayarlar ve güvenlik fonksiyonları
│   │   │   ├── ayarlar.py
│   │   │   └── guvenlik.py
│   │   ├── dogal_dil_isleme/  # NLP modelleri ve duygu analiz boru hatları
│   │   ├── modeller/          # Veritabanı veri modelleri (ORM)
│   │   └── ana_sunucu.py      # Ana sunucu başlangıç noktası (FastAPI Application)
│   └── gereksinimler.txt      # Python bağımlılıkları
├── on_yuz/
│   ├── public/                # Statik varlıklar
│   ├── src/                   # React TypeScript kaynak dosyaları (App.tsx vb.)
│   ├── package.json           # Node.js bağımlılıkları
│   └── tsconfig.json          # TypeScript yapılandırması
└── README.md
