# Pleksi Hediye — PHP 8.2 + MySQL

Sistem PHP 8.2 hosting üzerinde çalışacak şekilde hazırlandı. Üyelik, yönetim, ürünler, siparişler, bildirimler ve XML işlemleri **PHP + PDO MySQL** kullanır. Mevcut React tasarımı hazır JavaScript/CSS dosyalarıyla sunulur; hosting üzerinde Node.js, npm, Composer veya SSH gerekmez.

## Demo hosta hızlı yükleme

**Hazır paket:** [dagitim/pleksihediye-php82.zip](dagitim/pleksihediye-php82.zip)

1. Hosting panelinde PHP **8.2 veya üzerini** seçin. Boş bir MySQL veritabanı ve bu veritabanına yetkili bir kullanıcı oluşturun.
2. Hazır ZIP'in **içeriğini** `public_html/demo` gibi bir klasöre çıkarın. `index.php`, `api.php`, `install.php`, `app/`, `assets/`, `.htaccess` ve `.user.ini` birlikte kalmalı.
3. Tarayıcıda `https://siteadresiniz.com/demo/install.php` adresini açın.
4. Site adresi, MySQL bilgileri ve ilk yönetici telefon/isim/adres/şifresini girin. İsterseniz örnek ürünleri ekleyin.
5. Kurulum tamamlanınca mağazayı açın; telefon ve şifrenizle giriş yapın. **Hesabım → Yönetim Merkezi** üzerinden sistemi yönetin.

SQL dosyasını elle içe aktarmanız gerekmez. Kurulum tabloları oluşturur ve tekrar çalışmaya karşı kilitlenir. İlk yönetici telefonu WhatsApp şifre destek hattı olarak kullanılır. Teslimat ücretleri başlangıçta 0 TL'dir; panelden belirleyin.

**GitHub proje ZIP'ini indirdiyseniz:** Sadece `hosting/` klasörünün içeriğini hosta yükleyin. Hazır derlenmiş arayüz dosyaları bu klasörde bulunur. Daha ayrıntılı adımlar: [hosting/KURULUM.txt](hosting/KURULUM.txt).

## Hosting gereksinimleri

- PHP 8.2+, MySQL 5.7+/8.x veya MariaDB 10.3+; InnoDB ve utf8mb4.
- PDO MySQL, mbstring, cURL, DOM, SimpleXML, fileinfo, iconv uzantıları. Kurulum ekranı bunları kontrol eder.
- Apache/LiteSpeed ve `mod_rewrite`: temiz ürün URL'leri için `.htaccess` hazırdır. Alan adı kökü ve alt klasör kurulumu desteklenir.
- Nginx kullanılıyorsa `app/` dış erişimi engellenmeli ve temiz URL'ler `index.php`'ye yönlenmeli. API doğrudan `api.php` üzerinden çalışır.
- Kurulum sırasında `app/`, PHP kullanıcısı tarafından yazılabilir olmalı. 777 izni gerekmez.
- Gerçek kullanımda HTTPS kullanın. Kurulumdaki site adresi HTTPS ise oturum çerezi Secure olur.

Veritabanı bağlantısı kurulumda yerel `hosting/app/config.php` dosyasına yazılır; Git'e ve dağıtım ZIP'ine eklenmez. Dosya doğrudan çalıştırılırsa içerik göstermez. MySQL hataları arayüzde bağlantı şifrelerini göstermez.

## Korunan özellikler

- **Üyelik:** E-posta olmadan telefon, isim, soyisim, il, ilçe, mahalle ve şifre. Yönetici onayı beklenir. Giriş telefon/şifreyle olur; farklı telefon yazımları aynı kimliğe dönüşür.
- **Şifre yenileme:** Onaylı bayi numarası için yöneticinin WhatsApp ekranında hazır mesaj açılır. Yönetici kimlik kontrolünden sonra geçici şifre üretir. Eski oturumlar kapanır; şifre 24 saat geçerlidir. İlk girişte yeni şifre belirlenmeden işlem yapılamaz. Şifreler PHP `password_hash` ile, bcrypt uzunluk sınırında kesilmemesi için SHA-256 ön özeti kullanılarak saklanır.
- **Komisyon:** Perakende fiyatı ve yüzde. 300 TL / %20 → bayi alış 240 TL, birim kâr 60 TL. Sipariş anındaki fiyatlar ve komisyon saklanır; sonraki fiyat güncellemesi eski siparişi değiştirmez.
- **Ürünler:** Sade form, en fazla 3 görseli tek tek yükleme/önizleme, ürün bazında zorunlu yazı/görsel, toplu fiyat/komisyon/durum düzenleme. JPG/PNG/WebP, 5 MB ve 40 megapiksel sınırı.
- **Mobil:** Uygulama düzeninde sabit alt menü: Ürünler, Kategoriler, Sepetim, Siparişlerim, Profilim. Satırda 3 ürün; 320–430 px genişliklerde kontrol edildi.
- **Sepet:** Adres formu sorulmaz; kayıtlı bayi bilgileri sunucudan alınır. Ortak Nokta / Elden Teslim varsayılan; Kargo ve Adrese Teslim alternatifleri. Üç ücret panelden ayarlanır. Her parça siparişteki ücret anlık görüntüsü korunur.
- **Siparişler:** “İncelemede” başlar. Aynı bayi ve aynı Türkiye takvim günü tek günlük dosyada toplanır. Dosyanın tümünde veya parça parça durum değişikliği; seçili kayıtları/dosyayı silme ve geri alma. Bayi inceleme aşamasında kendi detaylarını düzenler; yönetici diğer aşamalarda da düzenleyebilir. Sürüm kontrolü eşzamanlı veri ezilmesini önler.
- **Kâr paneli:** Tamamlanan ve potansiyel kâr ayrılır. Teslimat hariç, iptal/silinenler hariç. Tahsilat veya komisyon ödeme defteri değildir.
- **Yönetim:** Genel bakış, son 7 gün grafiği, sipariş filtreleri, günlük dosyalar, komisyoncular, ürünler, XML, teslimat ayarları ve CSV.
- **Bildirimler:** Yeni sipariş ve yeni üyelik MySQL'de kalıcı bildirim oluşturur. Sayaç, okunmamış listesi, doğrudan ilgili ekrana geçiş ve isteğe bağlı ses. Panel açıkken 10 saniyede bir yenilenir; kapalı tarayıcıya push gönderilmez.
- **Paylaşım:** Ürün adı, açıklama, perakende fiyatı ve bağlantı. WhatsApp, metin kopyalama, fiyatlı paylaşım görseli ve destekli cihazlarda paylaşım menüsü. Instagram aktarımı cihaz/uygulama desteğine bağlıdır.
- **SEO:** Ürün adından Türkçe uyumlu URL, başlık, meta açıklaması, Open Graph, canonical ve Product/Offer JSON-LD. PHP ilk yanıtta ürün içeriğini de sunar. Eski ad bağlantıları 301; sitemap ve robots.txt hazırdır.

## XML

Bağlantı kaydetme veya XML dosyası/metni, alan eşleştirme, önizleme ve onaylı aktarım. Aynı kaynak + ürün kodu güncellenir; yeni ürünler pasif oluşturulur. Eşleştirme: `products.product`, `id`, `name`, `description`, `price`, `category`, `image`. Görseller içe alınır. MySQL'deki önizlemeler 10 dakika geçerli ve tek kullanımlıktır.

TLS doğrulaması korunur; yalnızca doğrudan HTTPS kabul edilir. DNS adresi doğrulanıp bağlantıya sabitlenir; özel/yerel adresler, DTD ve ENTITY engellenir. XML 5 MB / 1.000 ürün, görseller toplam 50 MB sınırı. Aktarım işlemi katalogda kısmi kayıt bırakmaz. Kaynakta görünmeyen ürün otomatik silinmez. İşlem panelden tetiklenir; cron gerekmez.

Gerçek tedarikçi bağlantısı henüz verilmedi. Örnek XML doğrulandı; gerçek kaynağın şeması, HTTPS erişimi ve sağlayıcıya özel alanlar bağlantı geldiğinde test edilecek.

## Geliştirici komutları

Arayüzü değiştirmiyorsanız bu komutlar hostta **gerekmez**. Düzenleme yapmak için yerel geliştirme bilgisayarında:

```sh
npm ci
npm run build:hosting
python3 scripts/package-hosting.py
```

`build:hosting`, hazır arayüzü `hosting/assets` ve `hosting/app/frontend.html` içine koyar. Paketleyici `dagitim/pleksihediye-php82.zip` oluşturur; veritabanı ayarları, kurulum kilidi, kullanıcı verileri ve geliştirici araçları dahil edilmez.

Yerel PHP sunucusu (ayrıca yerel MySQL gerekir):

```sh
php -S 127.0.0.1:8080 -t hosting scripts/php-router.php
```

## Testler

```sh
php tests/php-unit.php
PHP_BIN=php npm run test:php
```

PHP entegrasyon testleri varsayılan `localhost` MySQL sunucusunda **`pleksi_test_...` adlı geçici bir veritabanı oluşturup siler**. Kullanıcının test veritabanı oluşturma/silme yetkisi olmalı. Gerekirse `PHP_TEST_DB_HOST`, `PHP_TEST_DB_PORT`, `PHP_TEST_DB_USER`, `PHP_TEST_DB_PASS` ortam değişkenlerini yerelde ayarlayın; şifreleri komut metnine veya Git'e yazmayın. Testler hostunuzdaki mevcut mağaza veritabanını kullanmaz.

Telefon/onay/şifre, komisyon, görseller, otomatik adres, teslimat, ürün toplu işlemleri, SEO, XML, günlük dosyalar, düzenleme yetkileri, silme/geri alma ve bildirimler gerçek PHP HTTP istekleri + MySQL üzerinde test edilir. PHP sürümü 8.2.34, veritabanı MariaDB 10.11 ile doğrulandı. Tarayıcı testlerinde kurulum, yönetim, ürün görsel önizleme, XML, mobil alışveriş/sipariş düzenleme ve `/demo` alt klasörü kontrol edildi.

Önceki Node/SQLite prototipi `server.js`/`lib/` altında karşılaştırma ve regresyon için durur; PHP hosting paketi bunları içermez. `npm test` eski prototip regresyonlarını çalıştırır. PHP sürümü yeni MySQL kurulumu içindir; eski SQLite kullanıcı/sipariş verileri ve scrypt şifreleri otomatik taşınmaz.

## Canlı satış öncesi

Örnek ürünler/fiyatlar temsili; orijinal logo dosyası çalışma alanına henüz aktarılmadı. Gerçek katalog, banka/firma bilgileri, teslimat politikası, satış/iade/KVKK metinleri ve alan adı tamamlanmalı. Bu sürüm havale/EFT siparişini kaydeder; kartlı ödeme, SMS/e-posta ve kargo API entegrasyonu yoktur.

Güncellemede `app/config.php` ve MySQL veritabanını koruyun. Veritabanı hesapları, görselleri, siparişleri ve bildirimleri içerir; düzenli yedek alın. Bu kod demo host üzerinde değerlendirmeye hazırdır; sizin hostinginizin modül/yetki/limitleri kurulum ekranında ayrıca doğrulanacaktır.
