"""Package built frontend files without changing an installed site's data or settings."""
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
files = ['app/frontend.html'] + ['assets/' + name for name in assets]
notes = '''PLEKSI HEDIYE - ARAYUZ GUNCELLEMESI

ZIP dosyasini mevcut sitenin kurulu oldugu klasore cikarin.
app/frontend.html ve assets icindeki dosyalarin uzerine yazilmasina izin verin.
Yeniden kurulum yapmayin. install.php calistirmayin.
Bu paket veritabani, siparisler, uyeler ve app/config.php ayarlarini degistirmez.
Yukledikten sonra sayfayi yenileyin. Gerekirse Ctrl+F5 kullanin.
Yonetim panelinin ust kisminda Cikis yap dugmesi gorunecektir.
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
