# Game Kuis Tim Kartu

Game kuis multiplayer real-time bertema Nahwu/Shorof. Pemain dibagi ke dalam tim, masing-masing memegang kartu jawaban A–E. Jawaban benar menyerang HP tim lawan, jawaban salah mengurangi HP tim sendiri. Turnamen berjalan dengan format single elimination sampai tersisa satu tim juara.

Dokumen kebutuhan lengkap ada di [PRD Game Kuis Tim Kartu.md](./PRD%20Game%20Kuis%20Tim%20Kartu.md).

## Fitur

- Lobby real-time dengan kode room 6 karakter.
- Countdown 3 detik sebelum pertandingan dimulai.
- Fase baca soal 5 detik, lalu fase menjawab 5 detik.
- POV pemain berupa kartu tangan pribadi (A–E), bukan daftar pilihan ganda.
- Daftar tim dan rekan setim selalu terlihat di layar pemain.
- Pembagian tim acak (3–5 pemain per tim) dan pembagian kartu A–E per tim.
- Rebutan jawaban: kartu pertama yang diterima server yang dihitung, soal langsung terkunci.
- Damage dengan bonus kecepatan dan pengali per soal.
- Turnamen single elimination, termasuk bye untuk jumlah tim ganjil.
- Editor kuis: 5 pilihan jawaban, kunci jawaban, pengali damage, kategori.
- Layar proyektor (display mode) untuk bracket, arena, dan juara.
- Reconnect pemain lewat token di `localStorage`; kartu pemain yang terputus dioper ke rekan setim.
- Leaderboard MVP berdasarkan damage dan jawaban benar.
- Backsound dan efek suara (bisa dimatikan).

## Stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Realtime | Socket.IO 4 (client + server) |
| Backend | Node.js HTTP server kustom + Socket.IO |
| Validasi | Zod |
| Testing | Vitest |
| Penyimpanan kuis | File JSON lokal (`data/quizzes.json`) |
| State room | In-memory di proses server |

## Kebutuhan

- Node.js 20 LTS atau lebih baru (Next.js 15 minimal Node.js 18.18).
- npm.
- Port `3000` (web) dan `3001` (Socket.IO) tersedia.

## Instalasi

```bash
npm install
```

Salin konfigurasi environment bila perlu:

```bash
copy .env.example .env
```

Di macOS/Linux gunakan `cp .env.example .env`.

## Menjalankan

### Development

```bash
npm run dev
```

Perintah ini menjalankan dua proses sekaligus:

- Web Next.js di `http://localhost:3000`
- Server Socket.IO di `http://localhost:3001`

Buka `http://localhost:3000`.

### Produksi

```bash
npm run build
npm start
```

`npm start` menjalankan Next.js production dan server Socket.IO secara bersamaan.

## Konfigurasi Environment

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | kosong | URL server Socket.IO. Jika kosong, browser memakai hostname halaman + port `3001`. |
| `PORT` | `3001` | Port server Socket.IO. |
| `WEB_ORIGIN` | kosong | Daftar origin web tambahan yang diizinkan, dipisahkan koma. |

Contoh:

```env
NEXT_PUBLIC_SOCKET_URL=
PORT=3001
WEB_ORIGIN=http://localhost:3000,http://192.168.1.13:3000
```

## Cara Bermain

### Sebagai host

1. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.
2. Ada dua cara membuka room:
   - Klik **Buat room sebagai host** di halaman utama untuk room cepat dengan kuis default.
   - Buka **Dashboard & Editor Kuis** (`/host`), pilih kuis, lalu klik **Buka room**.
3. Bagikan kode 6 karakter kepada pemain, atau bagikan tautan `/join/KODE`.
4. Buka **Layar proyektor** (`/display/[roomId]`) di proyektor/layar besar bila diperlukan.
5. Atur HP awal, damage dasar, detik per soal, soal per match, dan paket kuis. Pengaturan hanya bisa diubah selama status masih lobby. Fase baca memakai 5 detik default, sedangkan "Detik per soal" mengatur durasi fase menjawab.
6. Tunggu minimal **6 pemain** (maksimal **200**), lalu klik **Acak tim dan mulai**.
7. Selama turnamen, host dapat **jeda soal**, **lanjutkan soal**, dan **lewati soal**.
8. Setelah selesai, layar menampilkan tim juara dan leaderboard MVP.

Catatan: sesi host disimpan di `localStorage` (`host-token:<roomId>` dan `host-id:<roomId>`). Jika `localStorage` dibersihkan, host tidak bisa lagi mengontrol room tersebut.

### Sebagai pemain

1. Buka `http://localhost:3000` atau tautan `/join/KODE`.
2. Masukkan kode room, nama panggilan, dan pilih avatar.
3. Tunggu di lobby sampai host memulai turnamen.
4. Setelah tim dibentuk, layar pemain menampilkan daftar rekan setim dan kartu yang dipegang (A–E).
5. Saat host memulai, muncul countdown 3 detik. Setelah itu soal tampil.
6. Fase pertama adalah waktu baca 5 detik. Kartu masih terkunci, jadi pemain bisa membaca soal dan kartunya.
7. Fase kedua adalah waktu menjawab 5 detik. Tekan kartu milikmu; hanya kartu yang kamu pegang yang bisa ditekan.
8. Kartu pertama yang sampai ke server menentukan hasil soal. Jawaban benar memberi damage ke tim lawan, jawaban salah mengurangi HP tim sendiri.
9. Pemain yang terputus otomatis di-reconnect memakai token. Kartunya sementara dioper ke rekan setim yang masih terhubung.

Pemain yang bergabung setelah turnamen berjalan akan ditolak, kecuali melakukan reconnect dengan token yang valid.

### Layar proyektor

Buka `/display/[roomId]`. Layar ini menampilkan kode room, daftar peserta, arena pertandingan, bracket, leaderboard, dan juara. Route ini juga menerima kode room, misalnya `/display/KARTU7`.

## Aturan Permainan

- Satu tim terdiri dari 3–5 pemain. Jika anggota tim kurang dari 5, sebagian pemain memegang 2 kartu.
- Setiap tim selalu memegang kelima kartu A–E untuk soal yang sama.
- Setiap pertandingan diawali countdown 3 detik sebelum soal pertama muncul.
- Setiap soal punya dua fase: baca 5 detik, lalu jawab 5 detik. Jawaban hanya diterima pada fase menjawab.
- Pemain hanya melihat dan menekan kartu yang dipegangnya, bukan seluruh pilihan A–E.
- Soal menerima satu jawaban pertama; setelah itu soal terkunci.
- Damage dihitung dari `(damage dasar + bonus kecepatan) x pengali soal`.
- Bonus kecepatan diberikan bila menjawab dalam 30% pertama durasi soal.
- Jika tidak ada yang menjawab sampai timer habis, tidak ada damage.
- Pertandingan selesai setelah jumlah soal habis, HP tim menyentuh 0, atau tie-breaker selesai.
- Bracket memakai single elimination. Tim yang mendapat bye otomatis lolos dan tidak diberi bye berulang.
- Satu pemain hanya bisa mengangkat satu kartu per soal (pemegang 2 kartu tetap dibatasi satu kartu per soal).

## Mengelola Kuis

- Halaman `/host` menampilkan bank kuis, tombol buka room, edit, dan hapus.
- Halaman `/host/quiz/new` untuk membuat kuis baru.
- Halaman `/host/quiz/[id]` untuk mengedit kuis.
- Setiap soal wajib punya teks dan 5 pilihan jawaban (A–E).
- Pengali damage tersedia dalam pilihan `1x`, `1.5x`, dan `2x`.
- Minimal satu kuis harus tersisa, sehingga kuis terakhir tidak bisa dihapus.
- Data kuis disimpan di `data/quizzes.json`. Jika file belum ada atau kosong, data seed dari `src/lib/quiz.ts` ditulis otomatis. Jika file gagal dibaca, seed dipakai sebagai fallback.

Tersedia dua kuis seed:

- `nahwu-dasar` — Nahwu & Mufradat Dasar (10 soal).
- `irab-jurumiyah` — Tanda I'rab & Jurumiyah (6 soal).

### REST API kuis

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/api/quizzes` | Daftar semua kuis |
| `POST` | `/api/quizzes` | Buat atau perbarui kuis |
| `GET` | `/api/quizzes/:id` | Detail satu kuis |
| `DELETE` | `/api/quizzes/:id` | Hapus kuis (selama menyisakan minimal 1 kuis) |

## Simulasi Bot

Script ini berguna untuk menguji room tanpa mengumpulkan banyak orang.

```bash
# 10 bot ke lobby aktif terbaru (room harus sudah dibuat)
npm run simulate

# 20 bot ke lobby aktif terbaru
npm run simulate 20

# 15 bot ke room dengan kode tertentu
npm run simulate KARTU7 15
```

Bot akan bergabung, menerima kartu, dan menjawab acak dengan jeda 1,2–5,7 detik. Kode room harus berupa 6 karakter tanpa tanda kurung.

Untuk menunjuk server lain:

```powershell
$env:SOCKET_URL="http://localhost:3001"; npm run simulate 10
```

## Perintah NPM

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Jalankan web + server Socket.IO (watch mode) |
| `npm run dev:web` | Jalankan Next.js saja |
| `npm run dev:server` | Jalankan server Socket.IO saja |
| `npm run build` | Build Next.js untuk produksi |
| `npm start` | Jalankan web produksi + server Socket.IO |
| `npm run lint` | Jalankan ESLint |
| `npm run typecheck` | Cek TypeScript tanpa emit |
| `npm run test` | Jalankan seluruh test Vitest |
| `npm run simulate` | Jalankan bot pemain |

## Testing

```bash
npm run test
```

Test mencakup:

- `src/lib/game.test.ts` — pembagian tim, pembagian kartu, redistribusi kartu saat disconnect, bracket/bye, damage, dan leaderboard.
- `src/lib/server.integration.test.ts` — alur real-time lengkap: buat room, join 6/11 pemain, countdown/fase baca/fase jawab, pembagian kartu privat, validasi jawaban pertama, pause/skip, spectator display, dan bracket multi-tim.

Test integrasi menjalankan server Socket.IO pada port acak, jadi tidak bentrok dengan server development.

## Struktur Proyek

```text
.
├── data/
│   └── quizzes.json              # Penyimpanan bank kuis
├── public/audio/                 # Backsound lobby dan battle
├── scripts/
│   └── simulate-bots.ts          # Simulator bot pemain
├── server/
│   └── index.ts                  # Server Socket.IO + state room in-memory
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing + join room
│   │   ├── join/[code]/          # Join lewat tautan kode
│   │   ├── play/[roomId]/        # Layar pemain
│   │   ├── display/[roomId]/     # Layar proyektor
│   │   ├── host/                 # Dashboard, editor kuis, kontrol room
│   │   └── api/quizzes/          # REST API kuis
│   ├── components/
│   │   ├── brand.tsx
│   │   └── game-widgets.tsx      # HP bar, bracket, leaderboard, QR
│   └── lib/
│       ├── game.ts               # Aturan & tipe game (fungsi murni)
│       ├── events.ts             # Tipe event Socket.IO
│       ├── quiz.ts               # Data seed kuis
│       ├── quiz-store.ts         # Baca/tulis data/quizzes.json
│       ├── socket.ts             # Singleton Socket.IO client
│       └── sound.ts              # BGM dan efek suara
├── .env.example
├── next.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## Arsitektur Singkat

- **Server authoritative**: server menentukan urutan jawaban, benar/salah, damage, HP, dan pemenang. Client hanya mengirim aksi dan menampilkan snapshot.
- **Kunci jawaban tidak dikirim ke client**: tipe `PublicQuestion` menghapus `correctIndex`.
- **State room disimpan in-memory** di `server/index.ts`, bukan di database.
- **Snapshot lengkap** dikirim lewat event `room:update` setiap ada perubahan.
- **Kuis disimpan di file JSON** dan dibaca oleh Next.js API route maupun server Socket.IO.
- **Event utama**:
  - Client ke server: `host:create`, `host:start`, `host:configure`, `host:kick`, `host:pause`, `host:skip`, `room:join`, `room:subscribe`, `room:spectate`, `card:raise`.
  - Server ke client: `room:update`, `player:cards`, `room:error`.

## Bermain Lewat Jaringan Lokal (HP Peserta)

1. Cari IP komputer host, misalnya `192.168.1.13`.
2. Pastikan semua perangkat berada di Wi-Fi yang sama.
3. Buka `http://192.168.1.13:3000` dari HP peserta.
4. Jika halaman diblokir, tambahkan IP tersebut ke `allowedDevOrigins` di `next.config.ts`, misalnya:

```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.13"],
};
```

5. Izinkan port `3000` dan `3001` di firewall Windows.
6. Socket.IO otomatis memakai hostname halaman dengan port `3001`, jadi `NEXT_PUBLIC_SOCKET_URL` boleh dikosongkan. Jika server Socket.IO berada di host lain, isi variabel tersebut.

## Batasan Saat Ini

- State room hilang saat server Socket.IO direstart. Kuis tetap aman karena tersimpan di file JSON.
- Belum ada akun, autentikasi host, database, atau Redis. Ini masih MVP lokal, bukan deployment multi-instance.
- Penyimpanan kuis berbasis file lokal, sehingga tidak cocok untuk platform serverless tanpa filesystem persisten.
- Belum ada rate limiting lanjutan selain pembatasan satu kartu per soal per pemain.
- Skor dan bracket hanya tersedia selama room masih hidup.

## Troubleshooting

| Masalah | Solusi |
| --- | --- |
| Web tidak menerima update real-time | Pastikan proses `dev:server` berjalan di port `3001` dan `NEXT_PUBLIC_SOCKET_URL` benar. |
| `Room tidak ditemukan atau sudah selesai` | Server mungkin restart sehingga room in-memory hilang. Buat room baru. |
| Tombol mulai tidak aktif | Room membutuhkan minimal 6 pemain dan maksimal 200 pemain. |
| Halaman host kembali ke beranda | Token host di `localStorage` tidak ada. Buat room baru dari dashboard. |
| Pemain tidak bisa join saat turnamen berjalan | Pemain baru ditolak; hanya reconnect dengan perangkat/token yang sama. |
| Suara tidak muncul | Browser memblokir autoplay. Klik halaman terlebih dahulu atau aktifkan backsound lewat tombol di header. |
| Bot simulasi tidak menemukan lobby | Buat room terlebih dahulu, atau jalankan `npm run simulate KODE 10`. |
