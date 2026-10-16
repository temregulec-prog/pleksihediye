"""Package application updates without changing an installed site's data or settings."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from datetime import datetime
import re
import stat

root = Path(__file__).resolve().parent.parent
hosting = root / 'hosting'
html = (hosting / 'app/frontend.html').read_text()
assets = sorted(p.name for p in (hosting / 'assets').iterdir() if p.suffix in {'.js', '.css'})
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
XML kaynaklari ve gorseller HTTP / HTTPS ile alinabilir.
Tarayicidan kopyalanan Turkce XML icin urun_adi, fiyat, gorsel alanlari otomatik bulunur.
Ayni tedarikcinin HTTPS gorsellerini HTTP ile alma secenegi eklenmistir.
XML aktariminda hata ayrintisi ve onizlemeyi koruyarak yeniden deneme eklendi.
Gorselleri atlama ve yalnizca urun bilgilerini aktarma acik seceneklerdir.
Ana sayfa gorselleri yuklenirken otomatik sikistirilir.
Mevcut gorseller Ana sayfa > Mevcut gorseli sikistir ile donusturulup yayinlanabilir.
Kategoriler artik dinamiktir; XML urunlerinin kategorileri otomatik gosterilir.
Yonetim > Urun yonetimi > Kategorileri yonet ile kategori eklenir/silinir.
Silinen kategorinin urunleri Genel kategorisine tasinir.
Pasif / yayinda urun filtresi ve filtrelenen urunleri topluca yayinlama eklendi.
Excel ve ZIP aktarimi Urun yonetimi ekranindadir; alt klasor gorselleri eslestirilir.
Excel urunleri varsayilan olarak ana sayfada gizlenir, kategorilerinde gorunur.
Aktarimda fiyat perakende fiyatidir, yeni urunler pasif kaydedilir.
Excel ile aktar ekraninda Sunucudaki gorseller secenegi varsayilandir.
Yalnizca XLSX secilir; gerekirse /gorseller/uzun-acacak klasoru belirtilir.
Mevcut gorseller HTTP istegi olmadan yerel dosyadan kontrol edilir ve alinir.
Kategoriler Exceldeki Kategori sutunundan otomatik gelir.
Urun duzenlemede Secenek ekle ile Renk, Boyut gibi secenekler tanimlanir.
Tanimlanmayan urunlerde renk/secenek alani gosterilmez.
Secimler sepette, sipariste ve duzenleme ekraninda saklanir ve sunucuda kontrol edilir.
Yazi ve gorsel alanlari tum urunlerde vardir; sadece zorunlu secilenler zorunludur.
HTTP baglantida oturum cerezleri ve site baglantilari gercek protokole gore olusur.
Ilk urun listesi sayfanin icindedir; acilista ayri API istegi beklenmez.
Urun yenilemesi basarisizsa mevcut liste korunur ve tekrar deneme gosterilir.
Giris sonrasi katalog yuklemesi giris ekranini bekletmez.
index.php, app/bootstrap.php ve app/core.php mutlaka guncellenmelidir.
Yonetimde urunler sunucudan 50serli sayfalarla yuklenir.
Arama, kategori/yayin filtresi ve filtredeki tum sayfalari secme vardir.
Genel bakis yalnizca urun sayaclarini alir; katalogu tekrar indirmez.
Gorsel erisiminde tum katalog taramasi yerine indeksli eslestirme kullanilir.
Mevcut gorsel dizini ilk istekte otomatik hazirlanir; yeniden kurulum gerekmez.
503 duzeltmesi: gorsel dizini/kilit destegi yoksa site ve giris acilmaya devam eder.
Bu optimizasyon basarisizsa katalog ve gorseller alternatif sorguyla calisir.
app/bootstrap.php ve app/core.php birlikte mutlaka guncellenmelidir.
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
