# KampüsDestek - Üniversite Öğrencileri İçin Dijital Destek ve Danışmanlık Platformu

KampüsDestek; üniversite öğrencilerinin psikolojik danışmanlık süreçlerini, duygu durumu takiplerini ve anonim etkileşimlerini güvenli bir altyapıda yönetebilmeleri amacıyla geliştirilmiş full-stack bir web platformudur. Sistem, öğrenci gizliliğini korumak adına KVKK ve üniversite etik kurulu yönergelerine uygun olarak anonimlik ve veri güvenliği önceliklendirilerek tasarlanmıştır.

---

## Mimari ve Temel Modüller

### 1.Backend - Python / FastAPI
- **Kimlik Doğrulama & Güvenlik:** Yetkilendirme protokolleri, şifreleme ve KVKK uyumlu veri saklama politikaları (`cekirdek/guvenlik.py`, `api/kimlik_dogrulama.py`).
- **Canlı Triyaj WebSocket Servisi:** Acil destek ve anlık danışman yönlendirmesi için düşük gecikmeli çift yönlü soket iletişimi (`api/canli_triyaj_ws.py`).
- **Doğal Dil İşleme (NLP):** Duygu durumu çıkarımı ve risk analizi odaklı metin işleme modülü (`dogal_dil_isleme/`, `api/duygu_durumu.py`).
- **Danışmanlık & Randevu:** Öğrenci ile uzman danışmanlar arasında randevu planlama ve seans takibi (`api/danismanlik_randevu.py`).
- **Anonim Forum:** Öğrencilerin kişisel verilerini paylaşmadan deneyim aktarımı yapabildikleri güvenli paylaşım alanı (`api/anonim_forum.py`).

### 2. Frontend - React / TypeScript
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
```
## Kurulum ve Çalıştırma
Ön Koşullar
Python 3.10 veya üzeri
Node.js 18+ ve npm
1. Arka Yüz (Backend) Kurulumu
  cd arka_yuz
  python3 -m venv venv
  source venv/bin/activate
Bağımlılıkları yükleyin:
  pip install --upgrade pip
  pip install -r gereksinimler.txt
API sunucusunu başlatın:
  python3 -m uvicorn uygulama.ana_sunucu:app --reload --port 8000
  API sunucusu http://127.0.0.1:8000 adresinde çalışacaktır.
  Otomatik oluşturulan interaktif Swagger dokümantasyonuna http://127.0.0.1:8000/docs üzerinden erişebilirsiniz.
2. Ön Yüz (Frontend) Kurulumu
   cd on_yuz
   npm install
   npm run dev # veya package.json betiğine göre: # npm start
   Tarayıcınızda arayüzü görüntülemek için açılan yerel adresi ziyaret edin (varsayılan olarak http://localhost:5173 veya http://localhost:3000).
Güvenlik ve Gizlilik Prensipleri
Kriptografik İzolasyon: Kullanıcı parolaları ve hassas sağlık/danışmanlık kayıtları güçlü tek yönlü hash ve şifreleme protokolleri ile saklanır.

Anonimlik Güvencesi: Anonim forum ve anlık triyaj kayıtlarında IP adresi, cihaz bilgisi ve öğrenci kimliği arındırılarak tutulur.

Erişim Kontrolü: Rol tabanlı yetkilendirme (RBAC) ile öğrenci, danışman ve sistem yöneticisi yetkileri katı kurallarla ayrıştırılmıştır.
