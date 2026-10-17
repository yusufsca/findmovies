# 🎬 Duspeakingclub Movies Challenge

İki takımlı, Tabu mantığında sessiz sahne oyunu. Telefondaki **sessiz** dizi/film sahnesini izle, **İngilizce betimle**, takımın hangi yapım olduğunu bulsun.

## Nasıl oynanır?
1. İki takım oynar. Sırası gelen takımdan biri telefonu alır, ekranı kimseye göstermez.
2. **BAŞLA** deyince sessiz sahne oynar ve süre akar (süre çubuğu ekranın en altında).
3. Bulunursa **Bildi ✓**, bulunamazsa **Pas ⏭**, kural bozulursa **İhlal ⚠️**.
4. Süre dolunca telefon **diğer takıma** geçer. Yarım kalan sahne havuza geri döner.
5. Sahneler **rastgele** gelir, her sahne **bir kez** çıkar. Sahneler bitince oyun biter, en çok puan alan takım kazanır.

Oyun sırasında sol üstteki 🏠 ile istediğin an ana menüye dönebilirsin.

## Kurallar
- **Karakter ve film/dizi adı yasak.** "He is Spider-Man" ya da "This is Marvel" denmez, sadece ne görüldüğü betimlenir.
  ✅ *A guy in a red suit is jumping between buildings.*
- **Oyuncu/aktör adı yasak.** ❌ *Tom Holland is fighting.*
- **Anahtar kelime yasağı.** Belirgin nesnenin adı söylenmez. ❌ *lightsaber* → ✅ *a glowing sword*
- **Türkçe kelime ve beden dili yasak.** Türkçe kelime kaçırılırsa ya da el-kol hareketiyle ipucu verilirse sahne iptal edilir (**İhlal**, eksi puan).

Kurallar oyunun içinde de **📜 Kurallar** butonuyla görünür.

## Ana menü ayarları
- Takım isimleri
- Tur süresi
- Bildi puanı, Pas cezası, İhlal cezası (+ / − ile)

Ayarlar tarayıcıda otomatik saklanır. Oyuncular video ekleyemez, sahneler sadece `clips.json`'dan gelir.

## Sahne ekleme (sadece yönetici)
1. Videoları `clips/` klasörüne koy (sesi olması sorun değil, oyun zaten sessiz oynatır).
2. `clips.json` dosyasına her video için bir satır ekle:
   ```json
   [
     { "file": "clips/spiderman1.mp4", "start": 0, "end": 20, "banned": ["web", "suit"] },
     { "file": "clips/starwars1.mp4" }
   ]
   ```
   - `file` zorunlu.
   - `start` / `end` isteğe bağlı (saniye); sahne bu aralıkta döner.
   - `banned` isteğe bağlı; yazarsan bu kelimeler oyunda ekranın üstünde 🚫 olarak görünür.
   - `title` yazmana gerek yok, oyun film adını göstermez.

> Not: GitHub'da tek dosya limiti 100 MB, repo için önerilen toplam ~1 GB. Sahneleri kısa tut (10–30 sn).

## Yayınlama (GitHub Pages)
```bash
git init
git add .
git commit -m "Duspeakingclub Movies Challenge"
git branch -M main
git remote add origin https://github.com/KULLANICI/duspeakingclub-movies-challenge.git
git push -u origin main
```
Sonra GitHub'da **Settings → Pages → Branch: main / root → Save**. Site adresi:
`https://KULLANICI.github.io/duspeakingclub-movies-challenge/`

Yerelde denemek için: `python3 -m http.server 8000` → `http://localhost:8000`

## Dosyalar
| Dosya | Görev |
|---|---|
| `index.html` | Ekranlar (menü, kurallar, oyun, sonuç) |
| `style.css` | Pastel tasarım (mobil öncelikli) |
| `app.js` | Oyun mantığı, sayaç, puan |
| `clips.json` | Sahne listesi |
| `clips/` | Video dosyaları |
