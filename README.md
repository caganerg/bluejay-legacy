# 🐦 Bluejay

<div align="center">

> **Obsidian esintili, bulut tabanlı, çift yönlü bağlantı (bi-directional linking) ve interaktif bilgi grafiği destekli modern Markdown not alma platformu.**

[![Bun](https://img.shields.io/badge/Bun-v1.2-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## 📖 Genel Bakış

**Bluejay**, düşüncelerinizi, fikirlerinizi ve belgelerinizi doğrusal olmayan bir ağ şeklinde bağlamanızı sağlayan **ikinci bir beyin (second brain)** uygulamasıdır. 

Notlarınızı `[[wiki-links]]` ile birbirine bağlayabilir, anlık D3 destekli **İnteraktif Bilgi Grafiği** (Graph View) üzerinde görselleştirebilir ve güçlü Markdown editörü ile kesintisiz bir yazma deneyimi yaşayabilirsiniz.

---

## ✨ Öne Çıkan Özellikler

### 🔗 Çift Yönlü Bağlantılar (Wikilinks & Backlinks)
- **`[[Not Adı]]` Sözdizimi:** Notlarınızın içine wikilink ekleyin; sistem bağlantıları otomatik olarak tespit eder ve çift yönlü ilişki kurar.
- **Takma İsim (Alias) Desteği:** `[[Gerçek Not Adı|Görünen İsim]]` formatıyla bağlantı metnini özelleştirin.
- **Hayalet (Phantom) Notlar:** Henüz var olmayan bir nota link verdiğinizde grafikte ve editörde referansı korunur, tıklandığında anında otomatik olarak oluşturulur.
- **Geri Bağlantılar (Backlinks) Paneli:** Hangi notların mevcut nota referans verdiğini ve notun dışarıya giden bağlantılarını yan panelden anlık izleyin.

### 🕸️ İnteraktif 2D Bilgi Grafiği (Graph View)
- **D3-Force Fizik Simülasyonu:** Notlar ve etiketler arasındaki ilişkileri dinamik düğüm ağı olarak görselleştirin.
- **İnteraktif Kontroller:** Yakınlaştırma (Zoom), serbestçe kaydırma (Pan) ve düğümleri sürükleme (Drag & Drop).
- **Arama & Düğüm Vurgulama:** Grafikte doğrudan arama yaparak ilgili düğümleri öne çıkarın veya seçili notun komşularını aydınlatın.

### ✍️ Gelişmiş Markdown Editörü
- **Çoklu Görüntüleme Modları:** 
  - 🌓 *Bölünmüş Ekran (Split View)*: Yazarken eş zamanlı önizleme.
  - 📝 *Yalnızca Düzenle (Edit Mode)*: Odaklanmış yazma alanı.
  - 👁️ *Yalnızca Önizleme (Preview Mode)*: Temiz okuma deneyimi.
- **Akıllı Otomatik Tamamlama:** `[[` yazdığınızda mevcut notları listeleyen ve seçim yaptıran popup menü.
- **Hızlı Biçimlendirme Araç Çubuğu:** Kalın, İtalik, Başlıklar, Kod Blokları, Sıralı/Sırasız Listeler ve Görev Kutuları (`- [ ]`).
- **Anlık Otomatik Kaydetme:** Değişiklikler debounce ile otomatik kaydedilir, durum rozeti (*Kaydedildi / Kaydediliyor / Değişiklikler var*) ile bildirilir.

### 🔍 Hızlı Arama & Komut Paleti (Quick Switcher)
- **`Ctrl + K` / `Cmd + K` Kısayolu:** Herhangi bir sayfadan notlar, klasörler ve etiketler arasında bulanık (fuzzy) arama yapın.
- **Hızlı Not Oluşturma:** Aradığınız not bulunamadığında doğrudan arama kutusundan tek tuşla yeni not oluşturun.

### 📁 Hiyerarşik Klasör & Etiket Sistemi
- **Sınırsız İç İçe Klasörleme:** Notlarınızı hiyerarşik klasör ağacında düzenleyin.
- **Dahili `#etiket` Desteği:** Markdown içeriğinde geçen `#etiket` ifadeleri otomatik ayıklanır ve filtrelenebilir.

### 💾 Hibrit Veri Mimarisi
- **PostgreSQL + Prisma ORM:** Kalıcı, ilişkisel ve yüksek performanslı veri tabanı modeli.
- **Dahili Fallback (In-Memory Store):** Veritabanı yapılandırılmamış olsa bile uygulamanın tüm özellikleriyle anında test edilebilmesini sağlayan akıllı bellek içi depolama katmanı.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji / Kütüphane |
| :--- | :--- |
| **Çalışma Zamanı & Paket Yöneticisi** | [Bun](https://bun.sh/) `v1.2+` (Node.js/npm gerekmez) |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Components & Route Handlers) |
| **Arayüz & Çekirdek** | [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Stil & Tasarım** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons |
| **Grafik Motoru** | [D3.js (d3-force)](https://d3js.org/d3-force) Canvas Simulation |
| **Komut Paleti** | [cmdk](https://cmdk.paco.me/) |
| **Markdown İşleme** | `react-markdown`, `remark-gfm` |
| **ORM & Veritabanı** | [Prisma ORM](https://www.prisma.io/), PostgreSQL |

---

## ⌨️ Klavye Kısayolları

| Kısayol | İşlev |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Hızlı Arama / Komut Paletini (Quick Switcher) Aç |
| `Ctrl + S` / `Cmd + S` | Notu Manuel Olarak Kaydet |
| `[[` | Wikilink Otomatik Tamamlama Menüsünü Aç |
| `Esc` | Açık olan modalları ve pencereleri kapat |

---

## 🚀 Kurulum ve Başlangıç

### 1. Gereksinimler
- **[Bun](https://bun.sh)**: `v1.2` veya üzeri — projenin paket yöneticisi ve çalışma zamanı
- *(Opsiyonel)* **PostgreSQL** veritabanı

> Bluejay, paket yöneticisi ve çalışma zamanı olarak Bun kullanır; Node.js ve npm gerekmez.
> Bun kurulu değilse: `curl -fsSL https://bun.sh/install | bash`

### 2. Projeyi Klonlayın
```bash
git clone https://github.com/caganerg/bluejay.git
cd bluejay
```

### 3. Bağımlılıkları Yükleyin
```bash
bun install
```

> Kilit dosyası `bun.lock`'tur ve depoya dahildir; `package-lock.json` oluşturmayın.
>
> Kurulum sırasında görülen `Blocked 1 postinstall` (`unrs-resolver`) uyarısı beklenen ve
> zararsız bir çıktıdır: ilgili paket ihtiyaç duyduğu ikilikleri zaten hazır getirir.

### 4. Ortam Değişkenlerini Ayarlayın
`.env.example` dosyasını `.env` olarak kopyalayın:
```bash
cp .env.example .env
```

`.env` dosyasında veritabanı bağlantı adresinizi belirleyin:
```env
DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/bluejay?schema=public"
```
> *Not: Veritabanı URL'si tanımlanmazsa Bluejay otomatik olarak bellek içi (In-Memory) modda başlar.*

### 5. Veritabanı Şemasını Eşitleyin *(PostgreSQL kullanılıyorsa)*
```bash
bunx prisma db push
```
> `prisma/schema.prisma` dosyasını her değiştirdiğinizde `bunx prisma generate` çalıştırmayı unutmayın.

### 6. Geliştirme Sunucusunu Başlatın
```bash
bun run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine giderek Bluejay'i kullanmaya başlayabilirsiniz!

---

## 📦 Kullanılabilir Komutlar

Tüm komutlar Bun ile çalıştırılır; `npm`, `npx`, `yarn` veya `pnpm` ile başlayan
komutlar bu projede kullanılmaz.

| Komut | İşlev |
| :--- | :--- |
| `bun install` | Bağımlılıkları kurar |
| `bun add <paket>` | Bağımlılık ekler (geliştirme için: `bun add -d <paket>`) |
| `bun remove <paket>` | Bağımlılık kaldırır |
| `bun run dev` | Geliştirme sunucusunu başlatır |
| `bun run build` | Üretim derlemesi alır |
| `bun run start` | Üretim derlemesini sunar |
| `bun run lint` | ESLint denetimini çalıştırır |
| `bunx prisma <komut>` | Prisma CLI (`generate`, `db push`, `migrate dev` …) |

> `bunfig.toml` içindeki `[run] bun = true` ayarı, `node_modules/.bin` altındaki
> ikiliklerin (`next`, `eslint`, `prisma`) Node yerine Bun çalışma zamanıyla
> çalıştırılmasını sağlar. Bu dosyayı silmeyin.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
