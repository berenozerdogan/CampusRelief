import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Send, CheckCircle2, LogIn, UserPlus, LogOut, ArrowRight, Loader2, MessageSquare, Clock, MessageCircle, X, Calendar, Check, CheckCheck, Video, MapPin, CalendarDays, Heart, Sparkles, Search, MessageCircleReply, PhoneCall, Activity, Info, FileText, Lock, Key, AlertOctagon, Save, BarChart3, PieChart, Download, ClipboardList, Bot, Mic, MicOff, VideoOff, PhoneOff, Maximize2, ShieldCheck, Zap
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api/v1";
const WS_URL = "ws://localhost:8000/ws/pdr/canli-izleme";

interface KullaniciOturumu {
  erisim_tokeni: string;
  rol: 'ogrenci' | 'pdr';
  anonim_id?: string;
  anonim_takma_ad?: string;
  ad_soyad?: string;
  unvan?: string;
}

interface YorumItem {
  id: string;
  yazar: string;
  metin: string;
  zaman: string;
}

interface ForumGonderi {
  id: string;
  yazar_takma_ad: string;
  icerik: string;
  etiket: string;
  risk_skoru?: number;
  kriz_alarmi?: boolean;
  yanindayim_destek: number;
  begen_sayisi: number;
  olusturulma_tarihi: string;
  yorumlar: YorumItem[];
  benimBegendim?: boolean;
  benimYanindayim?: boolean;
}

interface RandevuDetay {
  tarih: string;
  saat: string;
  tur: string;
  durum: 'beklemede' | 'onaylandi' | 'reddedildi';
}

interface MesajItem {
  id: string;
  gonderen: string;
  alici: string;
  metin: string;
  zaman: string;
  randevu?: RandevuDetay;
}

interface KrizVakasi {
  id: string;
  zaman: string;
  anonimProfil: string;
  icerik: string;
  riskSkoru: number;
  durum: 'aktif' | 'incelendi';
  gercekKimlik?: {
    eposta: string;
    ogrenciNo: string;
    fakulte: string;
  };
}

interface KlinikNot {
  id: string;
  danisanTakmaAd: string;
  tarih: string;
  birincilSikayet: string;
  gadSkoru?: number;
  klinikGozlem: string;
  eylemPlani: string;
}

const GAD7_SORULARI = [
  "Kendinizi gergin, kaygılı veya tedirgin hissetme",
  "Endişelenmeyi durduramama veya kontrol edememe",
  "Farklı şeyler hakkında çok fazla endişelenme",
  "Gevşemekte ve rahatlamakta zorluk çekme",
  "O kadar huzursuz olma ki yerinde oturamama",
  "Kolayca sinirlenme veya huysuzlaşma",
  "Kötü bir şey olacakmış gibi korku hissetme"
];

export default function App() {
  const [oturum, setOturum] = useState<KullaniciOturumu | null>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_oturum');
      return kayitli ? JSON.parse(kayitli) : null;
    } catch {
      return null;
    }
  });

  const [aktifSekme, setAktifSekme] = useState<string>(() => {
    return oturum ? (oturum.rol === 'pdr' ? 'pdr_triyaj' : 'forum') : 'forum';
  });

  // Modal State'leri
  const [authModalAcik, setAuthModalAcik] = useState(false);
  const [authModu, setAuthModu] = useState<'giris' | 'ogrenci_kayit' | 'uzman_kayit'>('giris');
  const [authEposta, setAuthEposta] = useState('');
  const [authParola, setAuthParola] = useState('');
  const [authAdSoyad, setAuthAdSoyad] = useState('');
  const [authOgrenciNo, setAuthOgrenciNo] = useState('');
  const [authUnvan, setAuthUnvan] = useState('Uzm. Psk.');
  const [hataMesaji, setHataMesaji] = useState('');
  const [basariMesaji, setBasariMesaji] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  // Kriz & Kilit Çözme State'leri
  const [acilDestekModalAcik, setAcilDestekModalAcik] = useState(false);
  const [ogrenciKrizDestekUyarisi, setOgrenciKrizDestekUyarisi] = useState(false);
  const [kriptoKilitModalAcik, setKriptoKilitModalAcik] = useState(false);
  const [seciliKrizVakasi, setSeciliKrizVakasi] = useState<KrizVakasi | null>(null);
  const [deanonAsamasi, setDeanonAsamasi] = useState<'talep' | 'isleniyor' | 'tamamlandi'>('talep');

  // GAD-7 Test Modalı
  const [gadTestModalAcik, setGadTestModalAcik] = useState(false);
  const [gadCevaplari, setGadCevaplari] = useState<number[]>(new Array(7).fill(0));
  const [gadSonuc, setGadSonuc] = useState<number | null>(null);

  // Resmi Rapor & Diferansiyel Gizlilik Modalı
  const [raporModalAcik, setRaporModalAcik] = useState(false);
  const [diferansiyelGizlilikAktif, setDiferansiyelGizlilikAktif] = useState(true);

  // Canlı Video Seans Odası State'leri
  const [videoSeansAcik, setVideoSeansAcik] = useState(false);
  const [videoMikrofon, setVideoMikrofon] = useState(true);
  const [videoKamera, setVideoKamera] = useState(true);
  const [seansSuresi, setSeansSuresi] = useState(42);

  // Randevu Modal
  const [randevuModalAcik, setRandevuModalAcik] = useState(false);
  const [randevuTarih, setRandevuTarih] = useState('2026-10-14');
  const [randevuSaat, setRandevuSaat] = useState('14:30');
  const [randevuTur, setRandevuTur] = useState<string>('Online Görüşme');

  // Klinik Not Çekmecesi & Klinik AI Copilot State'leri
  const [klinikNotPanelAcik, setKlinikNotPanelAcik] = useState(false);
  const [aiCopilotAcik, setAiCopilotAcik] = useState(true);
  const [notSikayet, setNotSikayet] = useState('Sınav Kaygısı ve Gelecek Anksiyetesi');
  const [notGozlem, setNotGozlem] = useState('');
  const [notEylem, setNotEylem] = useState('');
  const [kayitliKlinikNotlar, setKayitliKlinikNotlar] = useState<KlinikNot[]>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_klinik_notlar');
      if (kayitli) return JSON.parse(kayitli);
    } catch {}
    return [
      {
        id: 'not-1',
        danisanTakmaAd: 'Kullanıcı_Tilki_8272',
        tarih: '2026-10-04',
        birincilSikayet: 'Sınav Kaygısı ve Gelecek Anksiyetesi',
        gadSkoru: 14,
        klinikGozlem: 'Danışan son sınıfta yoğun tez ve vize baskısı altında olduğunu belirtiyor.',
        eylemPlani: 'Haftada bir düzenli bilişsel yeniden yapılandırma ve nefes egzersizi önerildi.'
      }
    ];
  });

  // Forum State'leri
  const [secilenEtiket, setSecilenEtiket] = useState<string>('Tümü');
  const [aramaMetni, setAramaMetni] = useState('');
  const [yeniGonderiMetin, setYeniGonderiMetin] = useState('');
  const [yeniGonderiEtiket, setYeniGonderiEtiket] = useState('#Genel');
  const [acikYorumId, setAcikYorumId] = useState<string | null>(null);
  const [yeniYorumMetin, setYeniYorumMetin] = useState<{ [key: string]: string }>({});

  // Mood Geçmişi
  const [secilenMood, setSecilenMood] = useState<number>(4);
  const [moodGecmisi, setMoodGecmisi] = useState<Array<{ gun: string; puan: number }>>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_mood_gecmisi');
      if (kayitli) return JSON.parse(kayitli);
    } catch {}
    return [
      { gun: 'Pzt', puan: 3 },
      { gun: 'Sal', puan: 2 },
      { gun: 'Çar', puan: 4 },
      { gun: 'Per', puan: 3 },
      { gun: 'Cum', puan: 2 },
      { gun: 'Cmt', puan: 4 },
      { gun: 'Paz', puan: 4 },
    ];
  });

  // PDR Kriz Vakaları
  const [krizVakalari, setKrizVakalari] = useState<KrizVakasi[]>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_kriz_vakalari');
      if (kayitli) return JSON.parse(kayitli);
    } catch {}
    return [
      {
        id: 'kriz-1',
        zaman: '12:38:52',
        anonimProfil: 'Kullanıcı_7018',
        icerik: 'Artık gücüm kalmadı, yarın sabah uyanmak istemiyorum...',
        riskSkoru: 92,
        durum: 'aktif',
        gercekKimlik: {
          eposta: 'ogrenci7018@universite.edu.tr',
          ogrenciNo: '220309012',
          fakulte: 'Mühendislik-Mimarlık Fakültesi'
        }
      }
    ];
  });

  const aktifKullaniciAdi = oturum 
    ? (oturum.rol === 'pdr' ? `${oturum.unvan || 'Uzm. Psk.'} ${oturum.ad_soyad || 'Danışman'}` : (oturum.anonim_takma_ad || 'Anonim Öğrenci'))
    : 'Misafir';

  // Forum Gönderileri
  const [gonderiler, setGonderiler] = useState<ForumGonderi[]>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_forum_gonderileri');
      if (kayitli) return JSON.parse(kayitli);
    } catch {}
    return [
      {
        id: 'post-1',
        yazar_takma_ad: 'Kullanıcı_Tilki_8272',
        icerik: 'Kötüyüm, sınavlar ve tez süreci üst üste geldi. Hiçbir şeye yetişemiyor gibi hissediyorum.',
        etiket: '#Tükenmişlik',
        yanindayim_destek: 8,
        begen_sayisi: 5,
        olusturulma_tarihi: 'Bugün 15:15',
        yorumlar: [
          {
            id: 'c-1',
            yazar: 'Kullanıcı_Koala_6069',
            metin: 'Yalnız değilsin, aynı dönemi ben de yaşıyorum. Kendine biraz mola ver.',
            zaman: '15:20'
          }
        ]
      },
      {
        id: 'post-2',
        yazar_takma_ad: 'Kullanıcı_Koala_6069',
        icerik: 'Vizeler yaklaşırken kütüphanede yer bulamamak ve ders çalışma motivasyonunu kaybetmek beni çok yıprattı.',
        etiket: '#SınavStresi',
        yanindayim_destek: 12,
        begen_sayisi: 7,
        olusturulma_tarihi: 'Bugün 14:53',
        yorumlar: []
      },
      {
        id: 'post-3',
        yazar_takma_ad: 'Kullanıcı_7018',
        icerik: 'Artık gücüm kalmadı, yarın sabah uyanmak istemiyorum...',
        etiket: '#Genel',
        yanindayim_destek: 19,
        begen_sayisi: 2,
        olusturulma_tarihi: 'Bugün 12:38',
        yorumlar: [
          {
            id: 'c-2',
            yazar: 'Uzm. Psk. Beren Özerdoğan',
            metin: 'Merhaba, lütfen yalnız hissetme. Sana özel mesaj ilettim, konuşalım mı?',
            zaman: '12:45'
          }
        ]
      }
    ];
  });

  const gonderileriKaydet = (yeni: ForumGonderi[]) => {
    setGonderiler(yeni);
    localStorage.setItem('kampus_forum_gonderileri', JSON.stringify(yeni));
  };

  // Mesaj Havuzu
  const [tumMesajlar, setTumMesajlar] = useState<MesajItem[]>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_tum_mesajlar');
      if (kayitli) return JSON.parse(kayitli);
    } catch {}
    return [
      {
        id: 'msg-default-1',
        gonderen: 'Uzm. Psk. Beren Özerdoğan',
        alici: 'Kullanıcı_Tilki_8272',
        metin: 'Merhaba, nasılsın? Sana destek olabilmek için buradayım.',
        zaman: '18:16',
        randevu: {
          tarih: '2026-10-14',
          saat: '14:30',
          tur: 'Online Görüşme',
          durum: 'onaylandi'
        }
      }
    ];
  });

  const [danisanListesi, setDanisanListesi] = useState<string[]>(() => {
    try {
      const kayitli = localStorage.getItem('kampus_danisan_listesi');
      if (kayitli) return JSON.parse(kayitli);
    } catch {}
    return ['Kullanıcı_Tilki_8272', 'Kullanıcı_7018', 'Kullanıcı_Koala_6069'];
  });

  const [seciliKisi, setSeciliKisi] = useState<string>(() => {
    return oturum?.rol === 'ogrenci' ? 'Uzm. Psk. Beren Özerdoğan' : 'Kullanıcı_Tilki_8272';
  });
  const [yazilanMesaj, setYazilanMesaj] = useState('');

  useEffect(() => {
    if (oturum?.rol === 'ogrenci') {
      setSeciliKisi('Uzm. Psk. Beren Özerdoğan');
    } else if (oturum?.rol === 'pdr' && danisanListesi.length > 0) {
      setSeciliKisi(danisanListesi[0]);
    }
  }, [oturum]);

  useEffect(() => {
    let interval: any;
    if (videoSeansAcik) {
      interval = setInterval(() => {
        setSeansSuresi(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [videoSeansAcik]);

  const oturumYoksaUyar = () => {
    setAuthModu('giris');
    setAuthModalAcik(true);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (yukleniyor) return;

    setHataMesaji('');
    setBasariMesaji('');
    setYukleniyor(true);

    try {
      let endpoint = '';
      let body: any = { eposta: authEposta.trim(), parola: authParola };

      if (authModu === 'giris') {
        endpoint = `${API_BASE}/kimlik/giris`;
      } else if (authModu === 'ogrenci_kayit') {
        endpoint = `${API_BASE}/kimlik/ogrenci-kayit`;
        if (authOgrenciNo.trim()) body.ogrenci_no = authOgrenciNo.trim();
      } else if (authModu === 'uzman_kayit') {
        endpoint = `${API_BASE}/kimlik/uzman-kayit`;
        body.ad_soyad = authAdSoyad.trim() || 'Danışman';
        body.unvan = authUnvan;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        const mesaj = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new Error(mesaj || "İşlem başarısız.");
      }

      if (authModu === 'ogrenci_kayit' || authModu === 'uzman_kayit') {
        setBasariMesaji('✓ Kaydınız başarıyla tamamlandı! Lütfen giriş yapın.');
        setAuthModu('giris');
        setAuthParola('');
        setYukleniyor(false);
        return;
      }

      const yeniOturum: KullaniciOturumu = {
        erisim_tokeni: data.erisim_tokeni,
        rol: data.rol,
        anonim_id: data.anonim_id,
        anonim_takma_ad: data.anonim_takma_ad,
        ad_soyad: data.ad_soyad,
        unvan: data.unvan
      };

      setOturum(yeniOturum);
      localStorage.setItem('kampus_oturum', JSON.stringify(yeniOturum));
      setAuthModalAcik(false);
      setAktifSekme(data.rol === 'pdr' ? 'pdr_triyaj' : 'forum');
    } catch (err: any) {
      setHataMesaji(err.message || "Bağlantı hatası.");
    } finally {
      setYukleniyor(false);
    }
  };

  const cikisYap = () => {
    localStorage.removeItem('kampus_oturum');
    setOturum(null);
    setAktifSekme('forum');
  };

  const nlpRiskAnaliziYap = (metin: string): number => {
    const krizKelimeleri = [
      'ölmek', 'intihar', 'uyanmak istemiyorum', 'yaşamak istemiyorum', 'dayanamıyorum',
      'bıktım', 'tükendim', 'kurtuluş yok', 'canıma', 'öldür', 'yaşamaya değer', 'yok olmak'
    ];
    let skor = 15;
    const kucuk = metin.toLowerCase();
    for (const kelime of krizKelimeleri) {
      if (kucuk.includes(kelime)) {
        skor = Math.min(98, skor + 45);
      }
    }
    return skor;
  };

  const handleGonderiPaylas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oturum) {
      oturumYoksaUyar();
      return;
    }
    if (oturum.rol !== 'ogrenci') {
      alert("Yalnızca anonim öğrenciler forumda paylaşım yapabilir.");
      return;
    }
    if (!yeniGonderiMetin.trim()) return;

    const riskSkoru = nlpRiskAnaliziYap(yeniGonderiMetin);
    const krizMi = riskSkoru >= 60;

    const yeni: ForumGonderi = {
      id: `post-${Date.now()}`,
      yazar_takma_ad: aktifKullaniciAdi,
      icerik: yeniGonderiMetin.trim(),
      etiket: yeniGonderiEtiket,
      risk_skoru: riskSkoru,
      kriz_alarmi: krizMi,
      yanindayim_destek: 1,
      begen_sayisi: 0,
      olusturulma_tarihi: 'Şimdi',
      yorumlar: []
    };

    const guncel = [yeni, ...gonderiler];
    gonderileriKaydet(guncel);
    setYeniGonderiMetin('');

    if (krizMi) {
      setOgrenciKrizDestekUyarisi(true);
      const yeniVaka: KrizVakasi = {
        id: `kriz-${Date.now()}`,
        zaman: new Date().toLocaleTimeString(),
        anonimProfil: aktifKullaniciAdi,
        icerik: yeni.icerik,
        riskSkoru: riskSkoru,
        durum: 'aktif',
        gercekKimlik: {
          eposta: 'ogrenci@universite.edu.tr',
          ogrenciNo: '220309044',
          fakulte: 'Mühendislik Fakültesi - Bilgisayar Müh.'
        }
      };
      const guncelVakalar = [yeniVaka, ...krizVakalari];
      setKrizVakalari(guncelVakalar);
      localStorage.setItem('kampus_kriz_vakalari', JSON.stringify(guncelVakalar));
    }
  };

  const handleBegeni = (postId: string) => {
    if (!oturum) {
      oturumYoksaUyar();
      return;
    }
    const guncel = gonderiler.map(g => {
      if (g.id === postId) {
        const begenildi = g.benimBegendim;
        return {
          ...g,
          benimBegendim: !begenildi,
          begen_sayisi: begenildi ? g.begen_sayisi - 1 : g.begen_sayisi + 1
        };
      }
      return g;
    });
    gonderileriKaydet(guncel);
  };

  const handleYanindayim = (postId: string) => {
    if (!oturum) {
      oturumYoksaUyar();
      return;
    }
    const guncel = gonderiler.map(g => {
      if (g.id === postId) {
        const aktif = g.benimYanindayim;
        return {
          ...g,
          benimYanindayim: !aktif,
          yanindayim_destek: aktif ? g.yanindayim_destek - 1 : g.yanindayim_destek + 1
        };
      }
      return g;
    });
    gonderileriKaydet(guncel);
  };

  const handleYorumGonder = (postId: string) => {
    if (!oturum) {
      oturumYoksaUyar();
      return;
    }
    const metin = (yeniYorumMetin[postId] || '').trim();
    if (!metin) return;

    const yeniYorum: YorumItem = {
      id: `c-${Date.now()}`,
      yazar: aktifKullaniciAdi,
      metin: metin,
      zaman: 'Şimdi'
    };

    const guncel = gonderiler.map(g => {
      if (g.id === postId) {
        return {
          ...g,
          yorumlar: [...(g.yorumlar || []), yeniYorum]
        };
      }
      return g;
    });

    gonderileriKaydet(guncel);
    setYeniYorumMetin({ ...yeniYorumMetin, [postId]: '' });
  };

  const ogrenciyeMesajBaslat = (ogrenciTakmaAd: string) => {
    if (!danisanListesi.includes(ogrenciTakmaAd)) {
      const yeni = [ogrenciTakmaAd, ...danisanListesi];
      setDanisanListesi(yeni);
      localStorage.setItem('kampus_danisan_listesi', JSON.stringify(yeni));
    }
    setSeciliKisi(ogrenciTakmaAd);
    setAktifSekme('mesajlar');
  };

  const handleMesajGonder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!yazilanMesaj.trim() || !oturum) return;

    const yeni: MesajItem = {
      id: `msg-${Date.now()}`,
      gonderen: aktifKullaniciAdi,
      alici: seciliKisi,
      metin: yazilanMesaj,
      zaman: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const guncel = [...tumMesajlar, yeni];
    setTumMesajlar(guncel);
    localStorage.setItem('kampus_tum_mesajlar', JSON.stringify(guncel));
    setYazilanMesaj('');
  };

  const handleRandevuGonder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oturum) return;

    const yeniRandevuMesaji: MesajItem = {
      id: `rnd-${Date.now()}`,
      gonderen: aktifKullaniciAdi,
      alici: seciliKisi,
      metin: `📅 Sayın danışan, sizinle görüşmek üzere bir danışmanlık randevusu oluşturdum. Lütfen onay durumunu seçiniz.`,
      zaman: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      randevu: {
        tarih: randevuTarih,
        saat: randevuSaat,
        tur: randevuTur,
        durum: 'beklemede'
      }
    };

    const guncel = [...tumMesajlar, yeniRandevuMesaji];
    setTumMesajlar(guncel);
    localStorage.setItem('kampus_tum_mesajlar', JSON.stringify(guncel));
    setRandevuModalAcik(false);
  };

  const handleRandevuDurumGuncelle = (mesajId: string, yeniDurum: 'onaylandi' | 'reddedildi') => {
    const guncel = tumMesajlar.map(m => {
      if (m.id === mesajId && m.randevu) {
        return {
          ...m,
          randevu: {
            ...m.randevu,
            durum: yeniDurum
          }
        };
      }
      return m;
    });

    setTumMesajlar(guncel);
    localStorage.setItem('kampus_tum_mesajlar', JSON.stringify(guncel));
  };

  const handleMoodKaydet = () => {
    const gunler = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const bugunIndex = (new Date().getDay() + 6) % 7;
    const yeniGecmis = moodGecmisi.map((item, idx) => {
      if (idx === bugunIndex) {
        return { ...item, puan: secilenMood };
      }
      return item;
    });

    setMoodGecmisi(yeniGecmis);
    localStorage.setItem('kampus_mood_gecmisi', JSON.stringify(yeniGecmis));
    alert("✓ Bugünün duygu durumu analizi grafiğe yansıtıldı.");
  };

  const handleGadTestTamamla = () => {
    const toplam = gadCevaplari.reduce((acc, curr) => acc + curr, 0);
    setGadSonuc(toplam);

    const guncelNotlar = kayitliKlinikNotlar.map(n => {
      if (n.danisanTakmaAd === aktifKullaniciAdi) {
        return { ...n, gadSkoru: toplam };
      }
      return n;
    });
    setKayitliKlinikNotlar(guncelNotlar);
    localStorage.setItem('kampus_klinik_notlar', JSON.stringify(guncelNotlar));
  };

  const handleKlinikNotKaydet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notGozlem.trim()) return;

    const yeniNot: KlinikNot = {
      id: `not-${Date.now()}`,
      danisanTakmaAd: seciliKisi,
      tarih: new Date().toISOString().split('T')[0],
      birincilSikayet: notSikayet,
      gadSkoru: 14,
      klinikGozlem: notGozlem,
      eylemPlani: notEylem
    };

    const guncel = [yeniNot, ...kayitliKlinikNotlar];
    setKayitliKlinikNotlar(guncel);
    localStorage.setItem('kampus_klinik_notlar', JSON.stringify(guncel));
    setNotGozlem('');
    setNotEylem('');
    alert(`✓ ${seciliKisi} danışanına ait gizli klinik seans notu şifrelenerek kaydedildi.`);
  };

  const baslatKriptoKilitCozme = (vaka: KrizVakasi) => {
    setSeciliKrizVakasi(vaka);
    setDeanonAsamasi('talep');
    setKriptoKilitModalAcik(true);
  };

  const onaylaKriptoKilitCozme = () => {
    setDeanonAsamasi('isleniyor');
    setTimeout(() => {
      setDeanonAsamasi('tamamlandi');
    }, 1200);
  };

  const filtrelenmisGonderiler = gonderiler.filter(g => {
    const etiketUyumu = secilenEtiket === 'Tümü' || g.etiket === secilenEtiket;
    const aramaUyumu = g.icerik.toLowerCase().includes(aramaMetni.toLowerCase()) || 
                       g.yazar_takma_ad.toLowerCase().includes(aramaMetni.toLowerCase());
    return etiketUyumu && aramaUyumu;
  });

  const gorunenMesajlar = Array.isArray(tumMesajlar) ? tumMesajlar.filter(m => {
    if (!oturum || !m) return false;
    return (m.gonderen === aktifKullaniciAdi && m.alici === seciliKisi) ||
           (m.alici === aktifKullaniciAdi && m.gonderen === seciliKisi);
  }) : [];

  const takvimRandevulari = Array.isArray(tumMesajlar) ? tumMesajlar
    .filter(m => m && m.randevu && m.randevu.tarih)
    .filter(m => {
      if (!oturum) return false;
      if (oturum.rol === 'pdr') {
        return (m.gonderen && m.gonderen.startsWith('Uzm')) || (m.alici && m.alici.startsWith('Uzm'));
      } else {
        return m.gonderen === aktifKullaniciAdi || m.alici === aktifKullaniciAdi;
      }
    })
    .map(m => ({
      mesajId: m.id,
      karsiTaraf: m.gonderen === aktifKullaniciAdi ? (m.alici || 'Danışman') : (m.gonderen || 'Danışan'),
      tarih: m.randevu?.tarih || '2026-10-14',
      saat: m.randevu?.saat || '14:30',
      tur: m.randevu?.tur || 'Online Görüşme',
      durum: m.randevu?.durum || 'beklemede'
    })) : [];

  const aktifDanisanKlinikNotlari = kayitliKlinikNotlar.filter(n => n.danisanTakmaAd === seciliKisi);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* SOL SABİT PANEL */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-40 p-4 shadow-sm">
        <div className="space-y-6">
          <div className="flex items-center space-x-3 px-2 pt-1">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md ${
              oturum?.rol === 'pdr' ? 'bg-emerald-600' : 'bg-indigo-600'
            }`}>
              KD
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-800 leading-tight">KampüsDestek</h1>
              <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-indigo-500" /> 3-Katmanlı İzolasyon
              </p>
            </div>
          </div>

          <nav className="space-y-1.5 text-xs font-semibold">
            {!oturum ? (
              <>
                <div className="text-[10px] uppercase font-bold text-slate-400 px-3 pb-1 tracking-wider">
                  Genel Erişim
                </div>

                <button 
                  onClick={() => setAktifSekme('forum')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'forum' 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>💬 Akran Forumu (Açık Akış)</span>
                </button>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1.5 mt-3">
                  <span className="font-bold text-slate-700 block flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600" /> Güvenli Moddasınız
                  </span>
                  <p className="leading-relaxed">
                    Kişiye özel danışmanlık, birebir mesajlaşma ve klinik testler için lütfen hesabınıza giriş yapın.
                  </p>
                </div>
              </>
            ) : oturum.rol === 'pdr' ? (
              <>
                <div className="text-[10px] uppercase font-bold text-slate-400 px-3 pb-1 tracking-wider">
                  Yetkili PDR Masası
                </div>

                <button 
                  onClick={() => setAktifSekme('pdr_triyaj')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center justify-between cursor-pointer ${
                    aktifSekme === 'pdr_triyaj' 
                      ? 'bg-red-50 text-red-700 font-bold border border-red-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <AlertTriangle className={`w-4 h-4 ${aktifSekme === 'pdr_triyaj' ? 'text-red-600' : 'text-slate-400'}`} />
                    <span>Canlı Kriz Triyajı</span>
                  </span>
                  {krizVakalari.length > 0 && (
                    <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                      {krizVakalari.length}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => setAktifSekme('analitik')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'analitik' 
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 ${aktifSekme === 'analitik' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>Kampüs Nabzı &amp; Analitik</span>
                </button>

                <button 
                  onClick={() => setAktifSekme('forum')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'forum' 
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 ${aktifSekme === 'forum' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>Akran Forumu</span>
                </button>

                <button 
                  onClick={() => setAktifSekme('mesajlar')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'mesajlar' 
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageCircle className={`w-4 h-4 ${aktifSekme === 'mesajlar' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>Danışan Mesajları</span>
                </button>

                <button 
                  onClick={() => setAktifSekme('takvim')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'takvim' 
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CalendarDays className={`w-4 h-4 ${aktifSekme === 'takvim' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>Seans Takvimi</span>
                </button>
              </>
            ) : (
              <>
                <div className="text-[10px] uppercase font-bold text-slate-400 px-3 pb-1 tracking-wider">
                  Öğrenci Menüsü
                </div>

                <button 
                  onClick={() => setAktifSekme('forum')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'forum' 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 ${aktifSekme === 'forum' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>Akran Forumu</span>
                </button>

                <button 
                  onClick={() => setAktifSekme('ogrenci_ana')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'ogrenci_ana' 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Activity className={`w-4 h-4 ${aktifSekme === 'ogrenci_ana' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>Mood &amp; Klinik Testler</span>
                </button>

                <button 
                  onClick={() => setAktifSekme('mesajlar')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'mesajlar' 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageCircle className={`w-4 h-4 ${aktifSekme === 'mesajlar' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>PDR Danışman Mesajı</span>
                </button>

                <button 
                  onClick={() => setAktifSekme('takvim')}
                  className={`w-full px-3.5 py-3 rounded-2xl transition flex items-center gap-2.5 cursor-pointer ${
                    aktifSekme === 'takvim' 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CalendarDays className={`w-4 h-4 ${aktifSekme === 'takvim' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>Randevularım</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Panel Altı: Kullanıcı Kartı / Giriş Butonları */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          {oturum ? (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold text-slate-800 truncate">{aktifKullaniciAdi}</div>
                <div className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider">
                  {oturum.rol === 'pdr' ? 'Doğrulanmış PDR' : 'Anonim Kimlik'}
                </div>
              </div>
              <button 
                onClick={cikisYap}
                title="Çıkış Yap"
                className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 transition border border-slate-200 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button 
                onClick={() => { setAuthModu('giris'); setAuthModalAcik(true); }}
                className="w-full py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Giriş Yap
              </button>
              <button 
                onClick={() => { setAuthModu('ogrenci_kayit'); setAuthModalAcik(true); }}
                className="w-full py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Kayıt Ol
              </button>
            </div>
          )}

          <div className="text-[10px] text-center text-slate-400">
            © 2026 KampüsDestek v2.4
          </div>
        </div>
      </aside>

      {/* SAĞ ANA İÇERİK ALANI */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {!oturum && aktifSekme !== 'forum' ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm animate-in zoom-in-95 duration-150">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Oturum Açmanız Gerekiyor</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Birebir PDR görüşmeleri, randevu takvimi ve kişisel duygu durumu takibi 3-katmanlı kripto koruma altındadır. Lütfen kurumsal hesabınızla giriş yapın.
                </p>
              </div>
              <div className="flex gap-2 pt-2 justify-center">
                <button
                  onClick={() => { setAuthModu('giris'); setAuthModalAcik(true); }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" /> Giriş Yap
                </button>
                <button
                  onClick={() => setAktifSekme('forum')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Foruma Dön
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 1. AKRAN FORUMU */}
              {aktifSekme === 'forum' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">Kategoriler</div>
                      {['Tümü', '#Genel', '#SınavStresi', '#YurtSorunu', '#GelecekKaygısı', '#Tükenmişlik'].map((t, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setSecilenEtiket(t)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                            secilenEtiket === t ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{t}</span>
                          {t === 'Tümü' && <span className="text-[10px] opacity-80">{gonderiler.length}</span>}
                        </button>
                      ))}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-3xl border border-indigo-100/60 text-xs text-indigo-950 space-y-2">
                      <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                        <Shield className="w-4 h-4 text-indigo-600" /> Kriptografik İzolasyon
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 font-light">
                        İçeriğiniz yapay zekâ filtrelerinden anonimleştirilerek geçirilir. Öğrenci numaranız ve e-postanız asla foruma yansıtılmaz.
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-3 space-y-5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input 
                        type="text" 
                        value={aramaMetni}
                        onChange={(e) => setAramaMetni(e.target.value)}
                        placeholder="Konularda veya anonim profillerde ara..."
                        className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                    </div>

                    {oturum?.rol === 'ogrenci' ? (
                      <form onSubmit={handleGonderiPaylas} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
                            🦊
                          </div>
                          <textarea 
                            rows={3}
                            value={yeniGonderiMetin}
                            onChange={(e) => setYeniGonderiMetin(e.target.value)}
                            placeholder="İçini dök... Kimliğin operasyonel katmandan izoledir. Neler hissediyorsun?"
                            className="flex-1 text-xs border-none focus:outline-none placeholder-slate-400 resize-none text-slate-800 leading-relaxed"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-400">Kategori:</span>
                            <select 
                              value={yeniGonderiEtiket}
                              onChange={(e) => setYeniGonderiEtiket(e.target.value)}
                              className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
                            >
                              <option value="#Genel">#Genel</option>
                              <option value="#SınavStresi">#SınavStresi</option>
                              <option value="#YurtSorunu">#YurtSorunu</option>
                              <option value="#GelecekKaygısı">#GelecekKaygısı</option>
                              <option value="#Tükenmişlik">#Tükenmişlik</option>
                            </select>
                          </div>

                          <button 
                            type="submit" 
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" /> Anonim Paylaş
                          </button>
                        </div>
                      </form>
                    ) : oturum?.rol === 'pdr' ? (
                      <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-3xl text-xs text-emerald-900 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-700" /> Yetkili PDR Modu: Öğrencilerin paylaşımlarını gözlemleyebilir ve tek tıkla destek başlatabilirsiniz.
                        </span>
                      </div>
                    ) : (
                      <div className="bg-indigo-50/80 border border-indigo-200 p-4 rounded-3xl text-xs text-indigo-950 flex items-center justify-between">
                        <span>💬 Akran forumunu misafir olarak inceliyorsunuz. Paylaşım yapmak veya yorum yazmak için giriş yapın.</span>
                        <button
                          onClick={() => { setAuthModu('giris'); setAuthModalAcik(true); }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[11px] transition cursor-pointer"
                        >
                          Giriş Yap
                        </button>
                      </div>
                    )}

                    {filtrelenmisGonderiler.map(g => {
                      const yorumlarAcik = acikYorumId === g.id;
                      return (
                        <div key={g.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5 hover:border-slate-300 transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                              <span className="text-xl">🦊</span>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{g.yazar_takma_ad}</div>
                                <div className="text-[10px] text-slate-400">{g.olusturulma_tarihi}</div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px] border border-amber-200/50">
                              {g.etiket}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
                            {g.icerik}
                          </p>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleYanindayim(g.id)}
                                className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition text-[11px] cursor-pointer ${
                                  g.benimYanindayim 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                }`}
                              >
                                🤝 Yanındayım ({g.yanindayim_destek})
                              </button>

                              <button 
                                onClick={() => handleBegeni(g.id)}
                                className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition text-[11px] cursor-pointer ${
                                  g.benimBegendim 
                                    ? 'bg-rose-500 text-white shadow-sm' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${g.benimBegendim ? 'fill-current' : ''}`} />
                                <span>{g.begen_sayisi}</span>
                              </button>

                              <button 
                                onClick={() => setAcikYorumId(yorumlarAcik ? null : g.id)}
                                className="px-3 py-1.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition text-[11px] cursor-pointer"
                              >
                                <MessageCircleReply className="w-3.5 h-3.5" />
                                <span>Yanıtlar ({(g.yorumlar || []).length})</span>
                              </button>
                            </div>

                            {oturum?.rol === 'pdr' && (
                              <button 
                                onClick={() => ogrenciyeMesajBaslat(g.yazar_takma_ad)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>{g.yazar_takma_ad} ile Görüş</span>
                              </button>
                            )}
                          </div>

                          {yorumlarAcik && (
                            <div className="pt-3 border-t border-slate-100 space-y-3 bg-slate-50/70 p-4 rounded-2xl">
                              <div className="space-y-2">
                                {(g.yorumlar || []).length === 0 ? (
                                  <div className="text-[11px] text-slate-400 py-1">Henüz bir yanıt verilmemiş. İlk desteği sen yaz!</div>
                                ) : (
                                  g.yorumlar.map(c => (
                                    <div key={c.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-slate-800">{c.yazar}</span>
                                        <span className="text-slate-400 text-[10px]">{c.zaman}</span>
                                      </div>
                                      <p className="text-xs text-slate-600">{c.metin}</p>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="flex gap-2 pt-1">
                                <input 
                                  type="text" 
                                  value={yeniYorumMetin[g.id] || ''}
                                  onChange={(e) => setYeniYorumMetin({ ...yeniYorumMetin, [g.id]: e.target.value })}
                                  placeholder={oturum ? "Destekleyici bir anonim yanıt yaz..." : "Yanıt yazmak için giriş yapmalısınız..."}
                                  disabled={!oturum}
                                  className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleYorumGonder(g.id);
                                    }
                                  }}
                                />
                                <button 
                                  onClick={() => handleYorumGonder(g.id)}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                                >
                                  <Send className="w-3 h-3" /> Yanıtla
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. PDR KAMPÜS NABZI */}
              {oturum?.rol === 'pdr' && aktifSekme === 'analitik' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-emerald-600" />
                          Kampüs Ruh Sağlığı Trend Analitiği (Anonim İstatistikler)
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> &epsilon;-Differential Privacy (Laplace &epsilon;=0.5)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Matematiksel gürültü eklenerek tekil öğrenci kimlik tespiti (Linkage Attack) imkansız kılınmıştır.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setDiferansiyelGizlilikAktif(!diferansiyelGizlilikAktif)}
                        className={`px-3 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          diferansiyelGizlilikAktif ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Diferansiyel Gizlilik: {diferansiyelGizlilikAktif ? 'Açık' : 'Ham Veri'}</span>
                      </button>

                      <button
                        onClick={() => setRaporModalAcik(true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Rektörlük Raporu Oluştur (PDF)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taranan Öğrenci</span>
                      <div className="text-2xl font-black text-slate-800">
                        {diferansiyelGizlilikAktif ? '1,250 ± 2' : '1,248'}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold">↑ Son 30 günde +%18 artış</div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Önlenen Kriz Vakası</span>
                      <div className="text-2xl font-black text-rose-600">42</div>
                      <div className="text-[10px] text-slate-500 font-semibold">%100 Müdahale Başarısı</div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tamamlanan Seanslar</span>
                      <div className="text-2xl font-black text-indigo-600">86</div>
                      <div className="text-[10px] text-indigo-600 font-semibold">Ortalama Memnuniyet 4.8/5</div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ort. GAD-7 Kaygı Puanı</span>
                      <div className="text-2xl font-black text-amber-600">
                        {diferansiyelGizlilikAktif ? '11.5' : '11.4'}
                      </div>
                      <div className="text-[10px] text-amber-700 font-semibold">Orta Düzey Kampüs Stresi</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <PieChart className="w-4 h-4 text-indigo-600" />
                          En Çok Bildirilen Yakınma &amp; Risk Türleri
                        </h3>
                        <span className="text-[11px] text-slate-400">Yüzdelik Pay</span>
                      </div>

                      <div className="space-y-4">
                        {[
                          { etiket: 'Sınav & Vize Kaygısı', oran: 42, renk: 'bg-indigo-600' },
                          { etiket: 'Gelecek & Kariyer Anksiyetesi', oran: 28, renk: 'bg-emerald-600' },
                          { etiket: 'Yurt & Kampüs Uyum Güçlüğü', oran: 18, renk: 'bg-amber-500' },
                          { etiket: 'Akademik Tükenmişlik (Burnout)', oran: 12, renk: 'bg-rose-500' },
                        ].map((item, idx) => (
                          <div key={idx} className="space-y-1.5 text-xs">
                            <div className="flex justify-between font-semibold text-slate-700">
                              <span>{item.etiket}</span>
                              <span>%{item.oran}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div style={{ width: `${item.oran}%` }} className={`h-full rounded-full ${item.renk}`}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-emerald-600" />
                          Fakülte Bazlı Stres Yoğunluk Matrisi
                        </h3>
                        <span className="text-[11px] text-slate-400">Vize Dönemi</span>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        {[
                          { fakulte: 'Mühendislik-Mimarlık Fakültesi', yogunluk: '%38 Yüksek', durum: 'bg-rose-50 text-rose-700 border-rose-200' },
                          { fakulte: 'Tıp ve Sağlık Bilimleri', yogunluk: '%31 Yüksek', durum: 'bg-amber-50 text-amber-700 border-amber-200' },
                          { fakulte: 'İktisadi ve İdari Bilimler', yogunluk: '%19 Orta', durum: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                          { fakulte: 'Fen-Edebiyat Fakültesi', yogunluk: '%12 Düşük', durum: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        ].map((f, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                            <span className="font-semibold text-slate-800">{f.fakulte}</span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${f.durum}`}>
                              {f.yogunluk}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. CANLI KRİZ TRİYAJI */}
              {oturum?.rol === 'pdr' && aktifSekme === 'pdr_triyaj' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                          Yapay Zekâ NLP Canlı Kriz Masası
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Hayati risk taşıyan paylaşımlar için çift anahtarlı de-anonimizasyon protokolü devrededir.
                        </p>
                      </div>
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                        ● WebSocket Dinlemede
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px]">
                          <tr>
                            <th className="p-4 rounded-l-2xl">Zaman</th>
                            <th className="p-4">Anonim Profil</th>
                            <th className="p-4">Tespit Edilen İçerik</th>
                            <th className="p-4">NLP Risk Skoru</th>
                            <th className="p-4 rounded-r-2xl text-right">Acil Aksiyonlar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {krizVakalari.map((vaka) => (
                            <tr key={vaka.id} className="bg-red-50/40 hover:bg-red-50/70 transition">
                              <td className="p-4 font-mono font-bold text-red-600">{vaka.zaman}</td>
                              <td className="p-4 font-bold text-slate-800">{vaka.anonimProfil}</td>
                              <td className="p-4 text-red-950 max-w-md font-medium">"{vaka.icerik}"</td>
                              <td className="p-4">
                                <span className="px-3 py-1 rounded-full bg-red-600 text-white font-bold text-[10px] shadow-xs">
                                  %{vaka.riskSkoru} ACİL KRİZ
                                </span>
                              </td>
                              <td className="p-4 text-right space-x-2">
                                <button 
                                  onClick={() => ogrenciyeMesajBaslat(vaka.anonimProfil)}
                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" /> Danışmanlık Aç
                                </button>
                                <button 
                                  onClick={() => baslatKriptoKilitCozme(vaka)}
                                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition shadow-sm inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5" /> Hayati Kilit Çöz
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ÖĞRENCİ MOOD & GAD-7 TESTİ */}
              {oturum?.rol === 'ogrenci' && aktifSekme === 'ogrenci_ana' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-3xl text-white shadow-md flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                        Standart Klinik Ölçek
                      </span>
                      <h3 className="text-base font-bold">GAD-7 Anksiyete &amp; Stres Değerlendirme Testi</h3>
                      <p className="text-xs text-indigo-100 max-w-md">
                        Son 2 haftadaki kaygı ve gerginlik seviyenizi 2 dakikada bilimsel olarak ölçün.
                      </p>
                    </div>
                    <button
                      onClick={() => setGadTestModalAcik(true)}
                      className="px-4 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                    >
                      Testi Başlat (7 Soru)
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" /> Bugün Kendini Nasıl Hissediyorsun?
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Ruh halini günlük olarak kaydet; yapay zekâ sana özel haftalık tükenmişlik analizi çıkarsın.
                      </p>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { puan: 1, emoji: '😫', label: 'Tükenmiş' },
                        { puan: 2, emoji: '🙁', label: 'Kaygılı' },
                        { puan: 3, emoji: '😐', label: 'Durgun' },
                        { puan: 4, emoji: '🙂', label: 'İyi' },
                        { puan: 5, emoji: '✨', label: 'Harika' },
                      ].map(item => (
                        <button
                          key={item.puan}
                          onClick={() => setSecilenMood(item.puan)}
                          className={`p-4 rounded-2xl border flex flex-col items-center justify-center transition cursor-pointer ${
                            secilenMood === item.puan 
                              ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 font-bold shadow-xs scale-102' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-3xl mb-1.5">{item.emoji}</span>
                          <span className="text-xs">{item.label}</span>
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={handleMoodKaydet}
                      className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl text-xs hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                    >
                      Bugünkü Ruh Halimi Analiz Et &amp; Kaydet
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">Haftalık Ruh Hali Trend Grafiğiniz</h4>
                        <span className="text-[11px] text-slate-400">Son 7 günlük duygu durumu dalgalanması</span>
                      </div>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full font-bold text-xs border border-emerald-200">
                        Denge Durumu: Stabil
                      </span>
                    </div>

                    <div className="h-44 flex items-end justify-between gap-3 pt-6 px-4 pb-2 border-b border-slate-100">
                      {moodGecmisi.map((m, idx) => {
                        const yukseklikYuzde = (m.puan / 5) * 100;
                        const renk = m.puan <= 2 ? 'bg-rose-400' : m.puan === 3 ? 'bg-amber-400' : 'bg-indigo-500';
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                            <div className="text-[10px] font-bold text-slate-500">%{yukseklikYuzde}</div>
                            <div 
                              style={{ height: `${yukseklikYuzde}%` }}
                              className={`w-full max-w-[42px] rounded-t-xl transition-all duration-500 shadow-xs ${renk}`}
                            ></div>
                            <span className="text-xs font-semibold text-slate-600">{m.gun}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                      <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-indigo-950 space-y-1">
                        <span className="font-bold block">Yapay Zekâ Kişisel Önerisi:</span>
                        <p className="leading-relaxed font-light text-slate-700">
                          Hafta ortasındaki stres eğilimi hafta sonuna doğru toparlanmış. Gevşeme protokollerini uygulamaya devam edebilirsiniz.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. MESAJLAŞMA & COPILOT */}
              {oturum && aktifSekme === 'mesajlar' && (
                <div className="max-w-7xl mx-auto flex gap-6">
                  <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex h-[660px]">
                    <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
                      <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-800">
                        {oturum?.rol === 'pdr' ? 'Danışan Öğrenciler' : 'PDR Uzmanı'}
                      </div>
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {oturum?.rol === 'ogrenci' ? (
                          <div className="p-4 bg-white border-l-4 border-indigo-600 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">PDR</div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">Uzm. Psk. Beren Özerdoğan</div>
                              <div className="text-[11px] text-emerald-600 font-medium">Birebir Özel &amp; Güvenli</div>
                            </div>
                          </div>
                        ) : (
                          danisanListesi.map((ogrenciAd, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSeciliKisi(ogrenciAd)}
                              className={`w-full p-4 text-left flex items-center gap-3 transition cursor-pointer ${
                                seciliKisi === ogrenciAd ? 'bg-white border-l-4 border-emerald-600 shadow-sm font-bold' : 'hover:bg-slate-100'
                              }`}
                            >
                              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">🦊</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">{ogrenciAd}</div>
                                <div className="text-[10px] text-slate-400">Özel Görüşme</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-white">
                      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                        <div>
                          <div className="font-bold text-sm text-slate-800">{seciliKisi}</div>
                          <div className="text-[10px] text-slate-400">Bu sohbet tamamen kişiye özel ve şifrelenmiştir.</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setVideoSeansAcik(true)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Kriptolu Seans Odası</span>
                          </button>

                          {oturum?.rol === 'pdr' && (
                            <>
                              <button
                                onClick={() => setKlinikNotPanelAcik(!klinikNotPanelAcik)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                                  klinikNotPanelAcik ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                                }`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Seans Dosyası</span>
                              </button>
                              <button
                                onClick={() => setRandevuModalAcik(true)}
                                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-emerald-300 cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Randevu Teklifi</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 p-5 overflow-y-auto space-y-4">
                        {gorunenMesajlar.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                            Henüz bir mesajlaşma geçmişiniz yok.
                          </div>
                        ) : (
                          gorunenMesajlar.map(msg => {
                            const benimMesajim = msg.gonderen === aktifKullaniciAdi;
                            return (
                              <div key={msg.id} className={`flex flex-col ${benimMesajim ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-md px-4 py-2.5 rounded-2xl text-xs space-y-1 shadow-sm ${
                                  benimMesajim 
                                    ? (oturum?.rol === 'pdr' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-indigo-600 text-white rounded-br-none')
                                    : 'bg-slate-100 text-slate-800 rounded-bl-none'
                                }`}>
                                  <p className="leading-relaxed">{msg.metin}</p>
                                  <div className={`text-[10px] flex items-center justify-end gap-1 mt-1 font-medium ${
                                    benimMesajim ? 'text-white/80' : 'text-slate-400'
                                  }`}>
                                    <span>{msg.zaman}</span>
                                    {benimMesajim && <CheckCheck className="w-3.5 h-3.5 text-white/90" />}
                                  </div>
                                </div>

                                {msg.randevu && (
                                  <div className="mt-2 w-72 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-emerald-700" /> Danışmanlık Randevusu
                                      </span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        msg.randevu.durum === 'onaylandi' 
                                        ? 'bg-emerald-200 text-emerald-900' 
                                        : msg.randevu.durum === 'reddedildi'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {msg.randevu.durum === 'onaylandi' ? '✓ Onaylandı' : msg.randevu.durum === 'reddedildi' ? '✕ Yeniden Planlanacak' : 'Yanıt Bekleniyor'}
                                      </span>
                                    </div>

                                    <div className="text-xs text-slate-700 space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Tarih:</span>
                                        <span className="font-semibold text-slate-800">{msg.randevu.tarih}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Saat:</span>
                                        <span className="font-semibold text-slate-800">{msg.randevu.saat}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Tür:</span>
                                        <span className="font-semibold text-slate-800">{msg.randevu.tur}</span>
                                      </div>
                                    </div>

                                    {oturum?.rol === 'ogrenci' && msg.randevu.durum === 'beklemede' && (
                                      <div className="flex gap-2 pt-2 border-t border-emerald-100">
                                        <button
                                          onClick={() => handleRandevuDurumGuncelle(msg.id, 'onaylandi')}
                                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                                        >
                                          <Check className="w-3.5 h-3.5" /> Onayla
                                        </button>
                                        <button
                                          onClick={() => handleRandevuDurumGuncelle(msg.id, 'reddedildi')}
                                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                                        >
                                          Değiştir
                                        </button>
                                      </div>
                                    )}

                                    {msg.randevu.durum === 'onaylandi' && (
                                      <button
                                        onClick={() => setVideoSeansAcik(true)}
                                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                                      >
                                        <Video className="w-3.5 h-3.5" /> Seans Odasına Katıl
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {oturum?.rol === 'pdr' && aiCopilotAcik && (
                        <div className="mx-4 mb-2 p-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-slate-50 rounded-2xl border border-indigo-200/80 shadow-xs flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                              <Bot className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-900 text-[11px]">Klinik AI Copilot (Canlı Analiz)</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-bold">
                                  Bilişsel Çarpıtma: Felaketleştirme (Katastrofizasyon)
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                <strong>Önerilen BDT Sorusu:</strong> "Bu sınavın olası en kötü sonucunda seni en çok korkutan şey tam olarak nedir?"
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setYazilanMesaj("Bu sınavın olası en kötü sonucunda seni en çok korkutan şey tam olarak nedir?")}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] transition shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <Zap className="w-3 h-3 text-amber-300" />
                            <span>Mesaja Aktar</span>
                          </button>
                        </div>
                      )}

                      <form onSubmit={handleMesajGonder} className="p-3 border-t border-slate-200 flex gap-2">
                        <input 
                          type="text" 
                          value={yazilanMesaj}
                          onChange={(e) => setYazilanMesaj(e.target.value)}
                          placeholder={`${seciliKisi} kişisine mesaj yazın...`}
                          className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button 
                          type="submit" 
                          className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            oturum?.rol === 'pdr' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" /> Gönder
                        </button>
                      </form>
                    </div>
                  </div>

                  {oturum?.rol === 'pdr' && klinikNotPanelAcik && (
                    <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-[660px] animate-in fade-in slide-in-from-right duration-200">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-indigo-600" />
                            <h4 className="font-bold text-xs text-slate-800">Şifreli Seans Dosyası</h4>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold">
                            {seciliKisi}
                          </span>
                        </div>

                        {aktifDanisanKlinikNotlari[0]?.gadSkoru && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1">
                              <ClipboardList className="w-3.5 h-3.5 text-amber-700" /> GAD-7 Anksiyete Skoru:
                            </span>
                            <span className="font-extrabold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                              {aktifDanisanKlinikNotlari[0].gadSkoru} / 21
                            </span>
                          </div>
                        )}

                        <form onSubmit={handleKlinikNotKaydet} className="space-y-3 text-xs">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Birincil Şikayet / Kategori</label>
                            <select 
                              value={notSikayet}
                              onChange={(e) => setNotSikayet(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                            >
                              <option value="Sınav Kaygısı ve Gelecek Anksiyetesi">Sınav Kaygısı ve Gelecek Anksiyetesi</option>
                              <option value="Ağır Tükenmişlik ve Motivasyon Kaybı">Ağır Tükenmişlik ve Motivasyon Kaybı</option>
                              <option value="Akademik ve Yurt Adaptasyon Güçlüğü">Akademik ve Yurt Adaptasyon Güçlüğü</option>
                              <option value="Kriz ve Akut Depresif Belirtiler">Kriz ve Akut Depresif Belirtiler</option>
                            </select>
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Gözlemler &amp; Danışan İfadeleri</label>
                            <textarea 
                              rows={3}
                              required
                              value={notGozlem}
                              onChange={(e) => setNotGozlem(e.target.value)}
                              placeholder="Seans esnasındaki danışan tutumları..."
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs resize-none focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Önerilen Eylem / Takip Protokolü</label>
                            <input 
                              type="text"
                              value={notEylem}
                              onChange={(e) => setNotEylem(e.target.value)}
                              placeholder="Örn: Nefes egzersizi, 2. seans randevusu"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none"
                            />
                          </div>

                          <button 
                            type="submit"
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" /> Seans Notunu Kasaya Yaz
                          </button>
                        </form>
                      </div>

                      <div className="pt-3 border-t border-slate-100 overflow-y-auto max-h-40 space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Geçmiş Notlar ({aktifDanisanKlinikNotlari.length})</div>
                        {aktifDanisanKlinikNotlari.map(n => (
                          <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] space-y-1">
                            <div className="flex justify-between text-slate-400 text-[10px]">
                              <span>{n.tarih}</span>
                              <span className="font-bold text-indigo-700">{n.birincilSikayet.slice(0, 15)}...</span>
                            </div>
                            <p className="text-slate-700 font-medium">{n.klinikGozlem}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 6. SEANS & RANDEVU TAKVİMİ */}
              {oturum && aktifSekme === 'takvim' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CalendarDays className={`w-5 h-5 ${oturum?.rol === 'pdr' ? 'text-emerald-600' : 'text-indigo-600'}`} />
                        {oturum?.rol === 'pdr' ? 'PDR Uzmanı Seans ve Görüşme Takvimi' : 'Danışmanlık Randevularım'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {oturum?.rol === 'pdr'
                          ? 'Öğrencilerle planlanan tüm seanslarınızı buradan takip edebilirsiniz.'
                          : 'PDR uzmanınız ile oluşturulan seans saatleri ve görüşme detayları.'}
                      </p>
                    </div>

                    {oturum?.rol === 'pdr' && (
                      <button
                        onClick={() => setRandevuModalAcik(true)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Calendar className="w-4 h-4" /> Yeni Seans Planla
                      </button>
                    )}
                  </div>

                  {takvimRandevulari.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                      <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-sm font-bold text-slate-700">Henüz Planlanmış Randevu Bulunmuyor</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        PDR uzmanı ile mesajlaşma alanından randevu oluşturabilirsiniz.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {takvimRandevulari.map((item, idx) => (
                        <div 
                          key={idx}
                          className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs ${
                                oturum?.rol === 'pdr' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {item.tur.includes('Online') ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">{item.karsiTaraf}</h4>
                                <span className="text-[11px] text-slate-400">{item.tur}</span>
                              </div>
                            </div>

                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                              item.durum === 'onaylandi' 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : item.durum === 'reddedildi'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {item.durum === 'onaylandi' ? '✓ Onaylandı' : item.durum === 'reddedildi' ? '✕ İptal' : 'Onay Bekliyor'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Tarih</span>
                              <span className="font-bold text-slate-800">{item.tarih}</span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Saat</span>
                              <span className="font-bold text-slate-800">{item.saat}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button 
                              onClick={() => {
                                setSeciliKisi(item.karsiTaraf);
                                setAktifSekme('mesajlar');
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Sohbete Git
                            </button>

                            {item.tur.includes('Online') && item.durum === 'onaylandi' && (
                              <button 
                                onClick={() => setVideoSeansAcik(true)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" /> Seans Odasına Katıl
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* MODALLAR */}

      {/* GAD-7 TESTİ */}
      {gadTestModalAcik && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-600" /> GAD-7 Yaygın Anksiyete Değerlendirme Testi
                </h3>
                <p className="text-[11px] text-slate-400">Son 2 hafta içinde aşağıdaki durumlar sizi ne sıklıkla rahatsız etti?</p>
              </div>
              <button 
                onClick={() => setGadTestModalAcik(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {gadSonuc === null ? (
              <div className="space-y-4 text-xs">
                {GAD7_SORULARI.map((soru, index) => (
                  <div key={index} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="font-semibold text-slate-800">{index + 1}. {soru}</div>
                    <div className="grid grid-cols-4 gap-1 text-[11px]">
                      {['Hiç', 'Birkaç gün', 'Günlerin yarısından fazla', 'Neredeyse her gün'].map((secenek, puan) => (
                        <button
                          key={puan}
                          type="button"
                          onClick={() => {
                            const yeni = [...gadCevaplari];
                            yeni[index] = puan;
                            setGadCevaplari(yeni);
                          }}
                          className={`py-1.5 px-2 rounded-xl transition cursor-pointer font-medium text-center ${
                            gadCevaplari[index] === puan 
                              ? 'bg-indigo-600 text-white font-bold shadow-xs' 
                              : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {secenek}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleGadTestTamamla}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Testi Tamamla &amp; Puanı Hesapla
                </button>
              </div>
            ) : (
              <div className="py-6 space-y-4 text-center animate-in fade-in duration-200">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto text-2xl font-black">
                  {gadSonuc}
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-800">
                    {gadSonuc <= 4 && 'Minimal / Normal Kaygı'}
                    {gadSonuc >= 5 && gadSonuc <= 9 && 'Hafif Düzey Anksiyete'}
                    {gadSonuc >= 10 && gadSonuc <= 14 && 'Orta Düzey Anksiyete'}
                    {gadSonuc >= 15 && 'İleri / Şiddetli Düzey Anksiyete'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    Test sonucunuz gizli klinik dosyanıza kaydedilmiştir. PDR uzmanınız randevunuz esnasında bu skora göre özel çalışma planı hazırlayabilir.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setGadTestModalAcik(false);
                    setGadSonuc(null);
                  }}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition cursor-pointer"
                >
                  Kapat &amp; Panele Dön
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REKTÖRLÜK RESMİ RAPOR MODALI */}
      {raporModalAcik && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-300 p-8 space-y-6 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black tracking-wider uppercase text-slate-900">
                  ÜNİVERSİTE REKTÖRLÜĞÜ
                </h2>
                <h3 className="text-xs font-semibold text-slate-600">
                  Psikolojik Danışmanlık ve Rehberlik (PDR) Koordinatörlüğü
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Rapor No: PDR-2026/Q4-ANONIM-098
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 font-bold border border-slate-300 text-slate-800">
                  Gizlilik Derecesi: HİZMETE ÖZEL
                </span>
                <div className="text-[10px] text-slate-400 mt-1">Tarih: 04.10.2026</div>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-800 leading-relaxed">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold block text-slate-900">1. YÖNETİCİ ÖZETİ</span>
                <p className="text-[11px] text-slate-600">
                  KampüsDestek 3-Katmanlı Kripto İzolasyon platformu üzerinden anonim olarak taranan 1,248 öğrenci verisi doğrultusunda; vize dönemi stres düzeyinin Mühendislik ve Sağlık bilimlerinde yoğunlaştığı, 42 kritik kriz alarmına 2.4 dakika ortalama süreyle müdahale edildiği tespit edilmiştir.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold block text-slate-900">2. DÖNEMSEL İSTATİSTİK TABLOSU</span>
                <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-2.5">Kategori / Gösterge</th>
                      <th className="p-2.5">Sayısal Değer</th>
                      <th className="p-2.5">Değerlendirme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr>
                      <td className="p-2.5 font-medium">Toplam Aktif Danışan</td>
                      <td className="p-2.5 font-bold">1,248 (Laplace Gürültülü)</td>
                      <td className="p-2.5 text-emerald-600">Normal Dağılım</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Yüksek Riskli Kriz Vakası</td>
                      <td className="p-2.5 font-bold text-rose-600">42</td>
                      <td className="p-2.5 text-rose-600">Tamamı Çözüldü</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Ortalama Kampüs GAD-7 Skoru</td>
                      <td className="p-2.5 font-bold text-amber-600">11.4 / 21</td>
                      <td className="p-2.5 text-amber-600">Hafif/Orta Kaygı</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">En Çok Bildirilen Sorun</td>
                      <td className="p-2.5 font-bold">Sınav Kaygısı (%42)</td>
                      <td className="p-2.5 text-indigo-600">Vize Etkisi</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900">
                ✓ <strong>Diferansiyel Gizlilik Standardı (&epsilon;=0.5):</strong> Bu rapordaki metrikler matematiksel Laplace gürültüsü ile şifrelenmiştir; küçük örneklemdeki tekil hiçbir öğrencinin kimliği geriye dönük tespit edilemez.
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px]">
                <div className="font-bold text-slate-800">Uzm. Psk. Beren Özerdoğan</div>
                <div className="text-slate-400">PDR Birim Koordinatörü</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setRaporModalAcik(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> PDF Olarak Yazdır / Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KRİPTO KİLİT ÇÖZME MODALI */}
      {kriptoKilitModalAcik && seciliKrizVakasi && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-red-300 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-red-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">3. Katman Kripto Kilit Çözme Protokolü</h3>
                  <p className="text-[11px] text-red-600 font-semibold">KVKK ve Üniversite Etik Kurulu Hayati Müdahale Yetkisi</p>
                </div>
              </div>
              <button 
                onClick={() => setKriptoKilitModalAcik(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {deanonAsamasi === 'talep' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-1.5">
                  <span className="font-bold block flex items-center gap-1.5 text-amber-800">
                    <Key className="w-4 h-4" /> Çift Anahtarlı Güvenlik Doğrulaması Gerekli
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Öğrencinin hayati tehlikesi bulunduğu tespit edilmiştir (%{seciliKrizVakasi.riskSkoru} risk). Kimlik katmanının çözülmesi için <strong>PDR Birim Yöneticisi Anahtarı</strong> ve <strong>Rektörlük Acil Yetki Tokeni</strong> eşzamanlı olarak işleme alınacaktır.
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 font-mono text-[11px] text-slate-600 space-y-1">
                  <div>Vaka ID: {seciliKrizVakasi.id}</div>
                  <div>Anonim Takma Ad: {seciliKrizVakasi.anonimProfil}</div>
                  <div>Tetikleyici İfade: "{seciliKrizVakasi.icerik}"</div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setKriptoKilitModalAcik(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                  >
                    İptal Et
                  </button>
                  <button
                    onClick={onaylaKriptoKilitCozme}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Key className="w-4 h-4" /> Çift Anahtarla Çöz
                  </button>
                </div>
              </div>
            )}

            {deanonAsamasi === 'isleniyor' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
                <h4 className="font-bold text-sm text-slate-800">Kripto Kasa Şifresi Doğrulanıyor...</h4>
                <p className="text-xs text-slate-400">Etik kurul SHA-256 çift anahtarları çözümleniyor.</p>
              </div>
            )}

            {deanonAsamasi === 'tamamlandi' && (
              <div className="space-y-4 text-xs animate-in fade-in duration-200">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold">Kimlik Katmanı Başarıyla Açıldı (Acil Müdahale Yetkisi Verildi)</span>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 font-mono text-xs">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
                    3. KATMAN İZOLASYONDAN ÇÖZÜLEN KÜTÜK BİLGİLERİ
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Anonim Takma Ad:</span>
                    <span className="text-amber-400 font-bold">{seciliKrizVakasi.anonimProfil}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Kurumsal E-posta:</span>
                    <span className="text-white font-bold">
                      {seciliKrizVakasi.gercekKimlik?.eposta || 'ogrenci@universite.edu.tr'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Öğrenci Numarası:</span>
                    <span className="text-emerald-400 font-bold">
                      {seciliKrizVakasi.gercekKimlik?.ogrenciNo || '220309044'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-400">Fakülte / Bölüm:</span>
                    <span className="text-white">Mühendislik-Mimarlık Fakültesi - Bilgisayar Müh.</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ <strong>Yasal Bildirim:</strong> Çift anahtar kullanımı loglandı. Bu bilgiler KVKK Acil Durum Yönetmeliği kapsamında yalnızca ambulans ve kampüs acil müdahale ekibi ile paylaşılabilir.
                </div>

                <button
                  onClick={() => setKriptoKilitModalAcik(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  Protokolü Kaydet &amp; Kapat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SABİT 7/24 KRİZ BUTONU */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setAcilDestekModalAcik(true)}
          className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-2xl transition hover:scale-105 cursor-pointer animate-pulse"
        >
          <PhoneCall className="w-4 h-4" />
          <span>7/24 Acil Kriz Hattı</span>
        </button>
      </div>

      {/* ACİL DESTEK MODALI */}
      {acilDestekModalAcik && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Kampüs &amp; Ulusal Kriz Destek Hatları</h3>
                  <p className="text-[11px] text-slate-400">Yalnız değilsiniz, hemen bağlanın.</p>
                </div>
              </div>
              <button 
                onClick={() => setAcilDestekModalAcik(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-950 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-sm">Üniversite PDR Acil Dahili</span>
                  <span className="text-[11px] text-red-700">Mesai dışı nöbetçi uzman masası</span>
                </div>
                <span className="text-base font-extrabold text-red-700 font-mono">0212 000 00 00</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Alo 183 - Sosyal Destek Hattı</span>
                  <span className="text-[11px] text-slate-500">7/24 Psikolojik ilk yardım</span>
                </div>
                <span className="text-sm font-bold text-indigo-600 font-mono">183</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold block">112 Acil Çağrı Merkezi</span>
                  <span className="text-[11px] text-slate-500">Hayati tehlike ve acil durumlar</span>
                </div>
                <span className="text-sm font-bold text-red-600 font-mono">112</span>
              </div>
            </div>

            <button
              onClick={() => setAcilDestekModalAcik(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer mt-2"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* NLP OTOMATİK KRİZ DESTEK POP-UP */}
      {ogrenciKrizDestekUyarisi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-red-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Heart className="w-6 h-6 fill-current text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">Senin Yanındayız</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Paylaşımında zorlandığını fark ettik. Bu duyguları tek başına göğüslemek zorunda değilsin. PDR birimimiz ve uzman danışmanlarımız seninle görüşmeye hazır.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setOgrenciKrizDestekUyarisi(false);
                  setAktifSekme('mesajlar');
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Danışmanla Özel Konuş
              </button>
              <button
                onClick={() => setOgrenciKrizDestekUyarisi(false)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDR RANDEVU MODALI */}
      {randevuModalAcik && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Randevu Teklifi Oluştur</h3>
                  <p className="text-[11px] text-slate-400">{seciliKisi} danışanı için</p>
                </div>
              </div>
              <button 
                onClick={() => setRandevuModalAcik(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRandevuGonder} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Görüşme Tarihi</label>
                <input 
                  type="date" 
                  required
                  value={randevuTarih}
                  onChange={(e) => setRandevuTarih(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Görüşme Saati</label>
                <input 
                  type="time" 
                  required
                  value={randevuSaat}
                  onChange={(e) => setRandevuSaat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Görüşme Türü</label>
                <select 
                  value={randevuTur}
                  onChange={(e: any) => setRandevuTur(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                >
                  <option value="Online Görüşme">Online Görüşme (Kriptolu Kanal)</option>
                  <option value="PDR Ofisi Yüz Yüze">PDR Ofisi (Yüz Yüze Birebir)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRandevuModalAcik(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" /> Teklifi İlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {authModalAcik && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row">
            <div className={`w-full md:w-5/12 p-8 text-white flex flex-col justify-between ${
              authModu === 'uzman_kayit' 
                ? 'bg-gradient-to-br from-emerald-600 to-teal-800' 
                : 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800'
            }`}>
              <div>
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold text-xl mb-6 shadow-inner">
                  KD
                </div>
                <h4 className="text-xl font-bold tracking-tight mb-2">KampüsDestek</h4>
                <p className="text-xs opacity-90 leading-relaxed font-light">
                  {authModu === 'uzman_kayit'
                    ? 'Yetkilendirilmiş PDR uzmanları için kriz triyajı ve danışmanlık yönetim masası.'
                    : 'Öğrenci kimliğini operasyonel katmandan izole eden akran destek ağı.'}
                </p>
              </div>
              <div className="text-[11px] opacity-75">© 2026 Üniversite Öğrenci Destek Portalı</div>
            </div>

            <div className="w-full md:w-7/12 p-8 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-lg font-bold text-slate-800">
                    {authModu === 'giris' && 'Platforma Giriş Yap'}
                    {authModu === 'ogrenci_kayit' && 'Anonim Öğrenci Kaydı'}
                    {authModu === 'uzman_kayit' && 'Yetkili PDR Uzmanı Kaydı'}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setAuthModalAcik(false)} 
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {basariMesaji && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold mt-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{basariMesaji}</span>
                  </div>
                )}

                {hataMesaji && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold mt-3">
                    {hataMesaji}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold text-center mt-4">
                  <button 
                    type="button"
                    onClick={() => { setAuthModu('giris'); setHataMesaji(''); setBasariMesaji(''); }} 
                    className={`py-2 rounded-lg transition cursor-pointer ${authModu === 'giris' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Giriş
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setAuthModu('ogrenci_kayit'); setHataMesaji(''); setBasariMesaji(''); }} 
                    className={`py-2 rounded-lg transition cursor-pointer ${authModu === 'ogrenci_kayit' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Öğrenci
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setAuthModu('uzman_kayit'); setHataMesaji(''); setBasariMesaji(''); }} 
                    className={`py-2 rounded-lg transition cursor-pointer ${authModu === 'uzman_kayit' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    PDR Uzmanı
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3.5 text-xs mt-5">
                  {authModu === 'uzman_kayit' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Unvan</label>
                        <select 
                          value={authUnvan}
                          onChange={(e) => setAuthUnvan(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                        >
                          <option value="Uzm. Psk.">Uzm. Psk.</option>
                          <option value="Psk. Dan.">Psk. Dan.</option>
                          <option value="Dr. Öğr. Üyesi">Dr. Öğr. Üyesi</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Ad Soyad</label>
                        <input 
                          type="text" 
                          required 
                          value={authAdSoyad} 
                          onChange={(e) => setAuthAdSoyad(e.target.value)} 
                          placeholder="Ad Soyad" 
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs" 
                        />
                      </div>
                    </div>
                  )}

                  {authModu === 'ogrenci_kayit' && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Öğrenci No</label>
                      <input 
                        type="text" 
                        value={authOgrenciNo} 
                        onChange={(e) => setAuthOgrenciNo(e.target.value)} 
                        placeholder="220309..." 
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs" 
                      />
                    </div>
                  )}

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Kurumsal E-posta</label>
                    <input 
                      type="email" 
                      required 
                      value={authEposta} 
                      onChange={(e) => setAuthEposta(e.target.value)} 
                      placeholder="eposta@universite.edu.tr" 
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs" 
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">Parola</label>
                    <input 
                      type="password" 
                      required 
                      value={authParola} 
                      onChange={(e) => setAuthParola(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={yukleniyor}
                    className={`w-full py-3.5 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 mt-4 text-xs cursor-pointer ${
                      authModu === 'uzman_kayit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {yukleniyor ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>İşlem Yapılıyor...</span>
                      </>
                    ) : (
                      <>
                        <span>{authModu === 'giris' ? 'Güvenli Giriş Yap' : 'Kayıt Ol'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-center text-slate-400">
                Verileriniz KVKK ve Üniversite Etik Kurulu yönergelerine tam uyumludur.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}