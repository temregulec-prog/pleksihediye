from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from datetime import datetime
import stat
import re

root = Path(__file__).resolve().parent.parent
hosting = root / 'hosting'
html = (hosting / 'app/frontend.html').read_text()
for asset in re.findall(r'[/]assets/([^"\s]+)', html):
    if not (hosting / 'assets' / asset).is_file():
        raise SystemExit('Eksik hazır arayüz dosyası: ' + asset)

out = root / 'dagitim' / 'pleksihediye-php82.zip'
out.parent.mkdir(exist_ok=True)
allowed = ['index.php', 'api.php', 'install.php', '.htaccess', '.user.ini', 'KURULUM.txt']
allowed += ['app/' + p.name for p in (hosting / 'app').iterdir()
            if p.name in {'core.php', 'bootstrap.php', 'accounts.php', 'products.php', 'orders.php',
                          'xml.php', 'schema.sql', 'seed.json', 'frontend.html', '.htaccess'}]
allowed += ['assets/' + p.name for p in (hosting / 'assets').iterdir() if p.suffix in {'.js', '.css'}]
with ZipFile(out, 'w', ZIP_DEFLATED) as z:
    for name in sorted(allowed):
        info = ZipInfo(name, datetime.now().timetuple()[:6])
        info.compress_type = ZIP_DEFLATED
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        z.writestr(info, (hosting / name).read_bytes())
with ZipFile(out) as z:
    assert z.testzip() is None
    assert 'app/config.php' not in z.namelist()
    assert 'app/install.lock' not in z.namelist()
print(f'Hosting ZIP hazır: {out} ({out.stat().st_size} bayt, {len(allowed)} dosya)')
