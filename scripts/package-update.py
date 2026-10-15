"""Package application updates without changing an installed site's data or settings."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from datetime import datetime
import re
import stat

root = Path(__file__).resolve().parent.parent
hosting = root / 'hosting'
html = (hosting / 'app/frontend.html').read_text()
assets = sorted(set(re.findall(r'/assets/([^"\s]+)', html)))
assert assets, 'Arayüz dosyaları bulunamadı'
files = ['index.php', 'api.php', 'app/core.php', 'app/bootstrap.php', 'app/homepage.php', 'app/homepage-schema.json', 'app/accounts.php', 'app/orders.php', 'app/products.php', 'app/xml.php', 'app/frontend.html'] + ['assets/' + name for name in assets]
notes = '''PLEKSI HEDIYE - UYGULAMA GUNCELLEMESI

ZIP dosyasini mevcut sitenin kurulu oldugu klasore cikarin.
Paketteki index.php, api.php, app/ ve assets/ dosyalarinin uzerine yazilmasina izin verin.
Yeniden kurulum yapmayin. install.php calistirmayin.
Bu paket veritabani, siparisler, uyeler ve app/config.php ayarlarini degistirmez.
Yukledikten sonra sayfayi yenileyin. Gerekirse Ctrl+F5 kullanin.
Yonetim paneli acilisinda gereksiz istekler kaldirilmistir.
Gecici baglanti sorunlarinda veri okuma bir kez daha denenir.
Hesap ekrani veri isteklerini beklemeden acilir.
Uyelik listesi, basvuru sayaci ve bildirim yukleme durumu guncellenmistir.
Siparis duzenleme ekraninda urun fotograflari ve mevcut bilgiler gosterilir.
Urun paylasim metni ve gorseli site baglantisi icermez.
Mobil Siparislerim tek istek kullanir; kar ozeti siparislerden hesaplanir.
Mobil yonetimde kartli ana ekran ve geri donus eklenmistir.
API adresleri yeni ve eski bicimleri destekler; api.php mutlaka uzerine yazilmalidir.
Yonetim verileri ayri yuklenir; bir istegin hatasi digerlerini gizlemez.
Yoneticinin kisisel siparisleri atolyenin tum siparislerinden ayrilmistir.
Yonetim merkezine Profilim ekranindan girilir.
app/orders.php dosyasi da mutlaka uzerine yazilmalidir.
Magaza ayarlarinda onizlemeli logo yukleme alani vardir.
Logoyu bu alandan secip Ayarlari kaydet dugmesine basin.
Logo mobilde 150 px, bilgisayarda 220 px genislikte orani korunarak gosterilir.
SSL olmayan HTTP baglantilarinda yonetim panelinin bos ekrana dusmesi duzeltilmistir.
Sepet ve siparis duzenleme ayni HTTP uyumluluk duzeltmesini icerir.
Ana sayfa metinleri, kapak gorselleri ve bolumleri Yonetim > Ana sayfa alanindan duzenlenir.
Urunler tek tek veya secilerek kalici silinebilir; eski siparisler korunur.
XML otomatik alan bulma, kayitli kaynak duzenleme ve HTTPS yonlendirme destegi eklendi.
Cikis yap dugmesi de bu pakete dahildir.
'''
out = root / 'dagitim/pleksihediye-php82-guncelleme.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for name in files + ['GUNCELLEME.txt']:
        info = ZipInfo(name, datetime.now().timetuple()[:6])
        info.compress_type = ZIP_DEFLATED
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        archive.writestr(info, notes.encode() if name == 'GUNCELLEME.txt' else (hosting / name).read_bytes())
with ZipFile(out) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files + ['GUNCELLEME.txt'])
print(f'Guncelleme ZIP hazir: {out} ({out.stat().st_size} bayt)')
