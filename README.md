# Pleksi Hediye

Telefonla üyelik, yönetici onaylı bayi/komisyoncu sistemi, kişiselleştirilebilir ürünler ve mobil uygulama düzeninde mağaza. Node.js 24+, React 19, Vite, Express ve yerleşik SQLite.

## Çalıştırma

```sh
npm ci --cache /tmp/pleksi-npm
npm run dev
```

Varsayılan port 3000. Sunucu değişikliklerinde yeniden başlatın. Üretim HTML/SEO kontrolü için:

```sh
npm run build
npm test
npm start
```

## İlk yönetici ve WhatsApp destek numarası

1. Arayüzde telefon, isim, soyisim, il, ilçe, mahalle ve şifreyle başvuru oluşturun.
2. Yetkili kurulum operatörü aynı veritabanında aşağıdaki komutla bu hesabı onaylayıp yönetici yapar:

```sh
node scripts/admin.js 05XXXXXXXXX
```

3. Telefon ve şifreyle giriş yapın. Hesabım → yönetim merkezi açılır. İlk yöneticinin kayıtlı telefonu otomatik olarak şifremi unuttum WhatsApp hedefidir. Panelde Mağaza ayarları bölümünden gerekirse değiştirilebilir.

Hazır yönetici hesabı veya ortak şifre yoktur. Kullanıcılar API üzerinden kendilerine yönetici yetkisi veremez. Üyelikte ve girişte e-posta kullanılmaz. Önceki geliştirme veritabanlarının kayıtlarını korumak için eski `email` sütunu saklanır; yeni kayıtlarda yalnızca telefon tabanlı dahili kimlik içerir ve API'ye gönderilmez. Eski telefon/adres bilgisi olmayan hesaplar otomatik olarak uydurma telefonla dönüştürülmez.

## Üyelik ve şifre

- Yeni üyelikler yönetici onayı bekler; onay verilmeden oturum açılmaz ve bayi fiyatları gösterilmez. `05xx`, `5xx`, `+90 5xx` ve `0090 5xx` biçimleri tek telefon kimliğine dönüşür.
- Şifremi unuttum: yalnızca onaylı bayi telefonu için yöneticinin WhatsApp mesaj taslağı açılır. Mesajı kullanıcı kendisi gönderir; otomatik SMS, e-posta veya mesaj gönderimi yoktur.
- Yönetici komisyoncu listesinde kişiyi açıp kimliğini doğruladıktan sonra rastgele geçici şifre üretir. Eski oturumlar kapanır. Şifre sadece oluşturulduğu yanıtta gösterilir ve hash olarak saklanır; 24 saat geçerlidir. İlk girişte yeni şifre belirlenmeden ürün, sipariş veya görsel işlemi yapılamaz.
- Üyeliği pasife almak oturumları iptal eder. Oturum çerezi HttpOnly ve SameSite=Lax; HTTPS üretiminde `COOKIE_SECURE=true` kullanın.

## Mobil mağaza

Mobilde sabit, güvenli alt alanı gözeten Ürünler / Kategoriler / Sepetim / Siparişlerim / Profilim menüsü. Ürünler satırda 3 kart. Kategori ve profil ekranları ayrıdır. Arama, filtreleme, favoriler, paylaşım ve sepet bulunur.

## Ürünler ve komisyon

- Perakende fiyatı ve komisyon yüzdesi girilir. Bayi alış tutarı `perakende × (100 - komisyon) / 100`, kuruşa yuvarlanır. Örnek: 300 TL, %20 → bayi alış 240 TL, birim kâr 60 TL.
- Ürün formu sade: ad, isteğe bağlı açıklama, kategori, perakende fiyatı, komisyon ve en fazla 3 görsel. Görseller tek tek yüklenir, yükleme sırasında ve sonrasında önizlenir, kaldırılabilir. İlk görsel kapaktır.
- Ürün bazında “siparişte yazı zorunlu” ve “siparişte görsel zorunlu” seçilir. Kurallar hem sepete eklerken hem sunucuda sipariş oluşturma/düzenleme sırasında uygulanır.
- Toplu düzenleme: seçili ürünlerin fiyatını yüzdeyle değiştirme, komisyon yüzdesi atama, isim/açıklama ve zorunlu alanları düzenleme, pasife alma. Tablo önce kontrol edilir ve ayrıca kaydedilir. Geçersiz satır varsa işlem bütünüyle reddedilir.
- JPG/PNG/WebP dosya imzası kontrolü, tek dosya ve 5 MB sınırı. Tasarım görsellerini sahibi, ilgili sipariş sahibi ve yönetici görebilir. Ürün kapak görselleri herkese açıktır.

## Sepet ve teslimat

Sipariş sırasında alıcı/adres formu sorulmaz. İsim, telefon, il, ilçe ve mahalle kayıtlı bayi hesabından sunucuda alınır; istemciden gönderilen sahte adres/fiyat/ücret dikkate alınmaz. Kaydedilen konum bilgileri, kullanıcının istediği kapsam olan il/ilçe/mahalledir; sokak/kapı/daire kaydı bu sürümde yoktur.

Sepet her açılışta Ortak Nokta / Elden Teslim seçili başlar. Diğer seçenekler Kargo ve Adrese Teslim. Üç ücret yönetim panelinde ayarlanır. Kurulumda ücretler 0 TL'dir; satıcı gerçek ücretleri girmelidir. Tanıtım HTML'inde görülen ücretler örnektir. Ücretsiz kargo eşiği uygulanmaz. Sipariş anındaki teslimat şekli ve ücreti saklanır; sonraki ayar değişikliği eski siparişi etkilemez.

Sipariş “İncelemede” durumunda oluşur. Havale/EFT onayı yönetici tarafından takip edilir; gerçek IBAN tanımlı değildir. Kartlı ödeme entegrasyonu yoktur.

## Günlük dosyalar, düzenleme ve silme

- Aynı bayinin aynı Türkiye takvim günündeki (Europe/Istanbul) parça siparişleri tek günlük dosyada gruplanır. Farklı bayiler ve farklı günler ayrı dosyadır. Sonradan gelen aynı gün siparişi mevcut günlük dosyaya eklenir.
- Dosya bir gruplamadır: her parça siparişin ürünleri, teslimat şekli/ücreti ve fiyat anlık görüntüsü korunur. Teslimat ücreti otomatik olarak dosya başına birleştirilmez.
- Yönetici dosyanın tamamının veya seçili siparişlerin durumunu tek işlemle değiştirebilir; her parçanın durumu ayrıca değişebilir. Farklı durumlar “Karma durum” gösterilir.
- Bayi yalnızca kendi “İncelemede” siparişlerini düzenler. Yazı/isim, renk, görsel, adet, kalem ekleme/çıkarma ve teslimat seçimi desteklenir. Yönetici diğer durumlarda da düzenleyebilir ve alıcı bilgilerini düzeltebilir.
- Var olan ürün kaleminin sipariş anındaki fiyat/komisyonu korunur; yeni/değişen ürün güncel fiyattan alınır. Versiyon kontrolü eşzamanlı düzenlemelerde veri ezilmesini önler.
- Seçili parçalar veya günlük dosyanın tamamı silinenlere taşınabilir. Silinenler müşteri listelerinde ve kâr hesaplarında görünmez. Yönetici Silinenler bölümünden geri alabilir. Kalıcı fiziksel silme yapılmaz.
- Kâr: ürünlerin sipariş anındaki perakende ve bayi alış farkı × adet. Teslimat hariç; iptal/silinenler hariç. Tamamlanan ve potansiyel kâr ayrıdır. Bu, tahsilat veya komisyon ödeme defteri değildir.

## Gelişmiş yönetim paneli ve bildirimler

Yan menüde Genel Bakış, Siparişler, Komisyoncular, Ürün Yönetimi, XML, Mağaza Ayarları. Gerçek verilere dayanan özet kartları, son 7 gün sipariş grafiği, bekleyen işlemler, arama/durum/tarih filtreleri, günlük sipariş dosyaları, detay ekranı, toplu işlemler ve CSV dışa aktarımı.

Yeni sipariş ve yeni üyelik başvurusu veritabanında kalıcı bildirim oluşturur. Üstte okunmamış sayaç, bildirim listesi ve yeni kayıt için kısa uyarı gösterilir. Sipariş bildirimi detayına, üyelik bildirimi ilgili komisyoncuya götürür. Tek tek veya topluca okundu işaretlenir. İsteğe bağlı ses panelde açılır. Yönetim paneli açıkken 10 saniyede bir yenilenir ve sekmeye dönüldüğünde tekrar kontrol edilir. Tarayıcı/uygulama kapalıyken işletim sistemi push bildirimi gönderilmez.

## XML altyapısı

- HTTPS kaynak bağlantısı kaydetme veya XML dosyası/metniyle çalışma.
- Varsayılan eşleştirme: `products.product`; `id`, `name`, `description`, `price`, `category`, `image`. Farklı sağlayıcı alanları panelde noktalı yollarla eşleştirilir. Kaynaktaki fiyat perakende fiyatıdır; komisyon oranı ayrıca seçilir.
- Önce önizleme, sonra açık bir içe aktarma. Önizleme 10 dakika geçerlidir ve bir defa kullanılabilir. Kaynak + ürün kodu aynıysa güncellenir; tekrarlı kayıt oluşmaz. Yeni ürünler kontrol için pasif açılır; var olan ürünün yayın/zorunluluk ayarları korunur.
- HTTPS/TLS doğrulaması, DNS üzerinden özel/yerel ağ ve metadata adresi engeli, pinlenmiş bağlantı adresi, zaman aşımı, XML 5 MB / 1.000 ürün sınırı, toplam görsel 50 MB sınırı. DTD/ENTITY reddedilir. Yönlendirme izlenmez; son doğrudan HTTPS adresi gerekir.
- XML görselleri doğrulanıp yerel görsel deposuna alınır. Bir ürün/görsel hatalıysa katalog kısmen yazılmaz. Kaynakta görünmeyen ürünler otomatik silinmez.
- Gerçek tedarikçi bağlantısı henüz verilmedi; örnek XML akışı test edildi. Gerçek şema/erişim, sağlayıcıya özel stok-varyant alanları ve gerekiyorsa ağ izinleri bağlantı geldiğinde doğrulanacak. Otomatik zamanlı senkronizasyon yoktur; panelden tetiklenir.

## Paylaşım ve SEO

Paylaşımda yalnızca ürün adı, varsa açıklama, perakende fiyatı ve ürün bağlantısı kullanılır. WhatsApp bağlantısı, metin kopyalama, indirilebilir fiyatlı 1080×1350 görsel ve destekli cihazlarda Web Share. Instagram aktarımı cihaz/uygulama desteğine bağlıdır.

Ürün adından Türkçe karakter dönüşümlü URL, başlık, meta açıklaması, Open Graph, Product/Offer JSON-LD otomatik üretilir. Ürün içeriği üretimde ilk HTML yanıtında bulunur. Eski ad bağlantıları 301 ile güncel adrese yönlenir. `PUBLIC_SITE_URL` gerçek HTTPS alan adı olmalı; canonical ve sitemap için kullanılır. Alan adı yoksa sitemap 503 döner.

## Veri ve yayın

`DATABASE_PATH` varsayılan `.data/store.sqlite`; hesaplar, ürünler, siparişler, günlük dosyalar, görseller, ayarlar ve bildirimler burada kalıcıdır. Kalıcı diskte tutun, SQLite uyumlu yedekleme/geri yükleme uygulayın. Node.js sunucu tek süreçlidir; ölçekli üretim ayrıca ele alınmalıdır.

Orijinal logo dosyası çalışma alanında yoktur; şu an aynı renklerde yazı tabanlı marka kullanılır. Ürün/fotoğraf/fiyatlar başlangıç örnekleridir. Gerçek katalog, IBAN/firma/iletişim bilgileri, üretim süreleri, kargo politikası, hukuki metinler ve alan adı tamamlanmadan canlı satışa açmayın.

## Testler

`npm test` geçici, izole veritabanında gerçek HTTP istekleriyle telefon/onay/şifre akışını, geçici şifre ve oturum iptalini, yüzdelik komisyonu, zorunlu alanları, görsel yetkilerini, otomatik adresi, teslimat anlık görüntüsünü, toplu ürün işlemlerini, SEO'yu, XML'i, günlük dosyaları, düzenleme yetkilerini, versiyon çatışmalarını, silme/geri almayı ve iki tür kalıcı bildirimi doğrular. Geliştirme verilerini değiştirmez.
