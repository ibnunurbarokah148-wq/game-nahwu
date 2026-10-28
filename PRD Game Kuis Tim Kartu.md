# PRD: Game Kuis Tim Kartu

Versi 1.0 · Platform: Web (mobile-first) · Dibangun dengan vibe coding

## 1. Ringkasan

Game kuis multiplayer real-time ala Quizizz/Kahoot, tapi bertema **pertarungan tim kartu**. Pemain dibagi ke tim 5 orang. Tiap pemain memegang satu kartu jawaban (A–E). Tim lawan melihat soal yang sama dan berebut mengangkat kartu yang benar. Jawaban benar menyerang tim musuh, jawaban salah melukai tim sendiri. Format turnamen sampai tersisa satu tim juara.

## 2. Tujuan dan Non-Tujuan

**Tujuan**

- Pengalaman kuis kompetitif tim yang seru, cepat, dan mudah dipahami.
- Bisa dimainkan lewat browser HP tanpa instal.
- Host (guru/EO) bisa membuat kuis, membuka room, dan menjalankan turnamen sendiri.

**Non-tujuan (v1)**

- Aplikasi native, voice chat, monetisasi, matchmaking publik global.

## 3. Pengguna

- **Host**: membuat kuis, membuka room, mengontrol jalannya turnamen.
- **Pemain**: join lewat kode room, nama panggilan, tanpa wajib akun.
- **Penonton (opsional)**: layar besar/proyektor untuk melihat bracket dan pertarungan.

## 4. Aturan Game

### 4.1 Struktur tim

- Satu tim = 5 pemain. Tim dibentuk **acak** dari semua pendaftar saat host menekan Mulai.
- Jika jumlah pemain tidak habis dibagi 5, tim yang kurang anggota diisi dengan **pemain memegang 2 kartu berbeda** (satu pemain bisa angkat dua kartu berbeda). Tim minimal 3 orang; sisa pemain digabung ke tim lain agar tidak ada tim di bawah 3.
- Jumlah tim ganjil: satu tim mendapat **bye** (otomatis lolos ronde itu), diacak dan dicatat agar tidak bye berulang.

### 4.2 Kartu jawaban

- Tiap soal punya 5 pilihan (A–E), setiap pemain dalam tim memegang satu huruf berbeda (pemain dengan 2 kartu memegang 2 huruf).
- Pembagian huruf per tim diacak ulang tiap pertandingan, dan **kedua tim punya set kartu yang sama** untuk soal yang sama.
- Di layar, pemain melihat kartunya sendiri sebagai tombol besar. "Mengangkat kartu" = menekan tombol kartu.

### 4.3 Alur satu pertandingan (Tim A vs Tim B)

1. Tiap tim mulai dengan HP tim (contoh 100).
2. Ada 5 soal per pertandingan, ditampilkan satu per satu.
3. Soal muncul untuk kedua tim. Pemain memegang kartu yang menurutnya benar lalu mengangkatnya.
4. **Rebutan**: kartu yang **pertama diterima server** untuk soal itu yang dihitung. Setelah ada yang menjawab, soal terkunci.
5. Jika benar: damage ke **tim musuh**. Jika salah: damage ke **tim sendiri** (si penjawab).
6. Jika tidak ada yang menjawab sampai timer habis: tidak ada damage (opsional: kedua tim kena damage kecil).
7. Setelah 5 soal, tim dengan HP lebih tinggi menang. Jika HP seri, soal tie-breaker (sudden death).
8. Jika HP salah satu tim 0 sebelum soal ke-5, pertandingan berakhir lebih awal.

### 4.4 Damage (bisa diatur host)

- Dasar: 20 HP per jawaban.
- Bonus kecepatan: sampai +10 jika menjawab dalam 30% pertama waktu.
- Tipe soal bisa punya pengali (soal sulit x1.5).
- Nilai default disimpan di konfigurasi room agar mudah di-balance.

### 4.5 Turnamen

- Format default: **single elimination** dengan bracket acak. Opsi v2: round robin atau double elimination.
- Pertandingan di satu ronde berjalan **paralel**; tiap pertandingan punya soal yang sama (adil) atau soal berbeda (opsional).
- Tim yang kalah menjadi penonton dan tetap melihat bracket.
- Pemenang akhir mendapat layar juara dan leaderboard (MVP pemain berdasarkan jawaban benar dan damage).

### 4.6 Kasus khusus

- **Pemain disconnect**: kartunya otomatis dipegang pemain lain di tim (bot-slot) sampai dia reconnect. Reconnect memakai token di localStorage.
- **Pemain telat join**: ditutup setelah turnamen mulai (opsi: masuk sebagai penonton).
- **Kartu pemain 2 huruf**: kedua kartu bersaing memperebutkan klik; satu jawaban per soal per tim tidak dibatasi, tetapi hanya jawaban pertama server yang dihitung secara global.
- **Anti-spam**: satu pemain hanya bisa mengangkat satu kartu per soal (kecuali pemegang 2 kartu: satu per kartu).

## 5. Fitur v1 (MVP)

**Host**

- Buat kuis (soal, 5 pilihan, jawaban benar, timer, kategori), simpan ke akun.
- Buka room dan dapat kode 6 karakter serta QR.
- Pengaturan: HP awal, damage, timer per soal, jumlah soal per pertandingan.
- Lobby: lihat daftar pemain real-time, kick pemain, tombol Mulai.
- Kontrol turnamen: lihat bracket, pause, skip soal.
- Layar proyektor (Display mode): bracket, pertarungan, HP bar.

**Pemain**

- Join dengan kode + nama panggilan, pilih avatar.
- Lihat tim dan anggota setelah dibagi.
- Layar kartu: soal, timer, tombol kartu, status HP tim.
- Umpan balik instan (benar/salah, animasi damage).
- Layar hasil dan leaderboard.

**Di luar v1**: marketplace kuis publik, mode tim buatan sendiri, skin kartu, item/power-up, replay pertandingan.

## 6. Alur Layar

**Host**: Login > Dashboard kuis > Editor kuis > Pengaturan room > Lobby > Kontrol turnamen > Hasil akhir.

**Pemain**: Halaman join > Lobby tunggu > Pengumuman tim > Layar pertandingan > Layar tunggu antar ronde > Hasil.

**Display**: Lobby (QR + kode) > Bracket > Arena pertarungan > Juara.

## 7. Arsitektur Teknis

### 7.1 Stack yang disarankan (cocok untuk vibe coding)

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend | **Next.js (React) + TypeScript + Tailwind** | Satu codebase untuk halaman host, pemain, display |
| Animasi | Framer Motion | Animasi kartu, damage, HP bar |
| State | Zustand | Ringan untuk state game di client |
| Realtime | **Socket.IO** (Node.js) | Event real-time, auto-reconnect, room bawaan |
| Backend | **Node.js + Fastify/Express + TypeScript** | Satu bahasa dengan frontend |
| Database | **PostgreSQL** (Supabase/Neon) + Prisma | Kuis, akun, riwayat |
| Cache/state live | **Redis** (Upstash) | State room/pertandingan aktif, pub/sub jika scale |
| Auth | Supabase Auth atau NextAuth | Hanya host yang wajib login |
| Deploy | Frontend di Vercel; backend realtime di Railway/Fly.io/VPS | Vercel serverless tidak cocok untuk WebSocket persisten |

Alternatif paling simpel untuk MVP: Next.js + Supabase (Auth, DB, Realtime) tanpa server Node terpisah. Tapi logika rebutan yang adil lebih aman di server sendiri.

### 7.2 Prinsip penting

- **Server authoritative**: server yang menentukan urutan jawaban, benar/salah, damage, dan pemenang. Client hanya mengirim aksi dan menampilkan state.
- **Penentuan "duluan"**: pakai waktu terima di server, bukan timestamp client. Untuk keadilan, pakai antrean serial per pertandingan (satu event loop per match) agar tidak ada race condition.
- Kunci jawaban benar **tidak pernah dikirim ke client** sebelum soal selesai.

### 7.3 Model data (ringkas)

- `User` (host): id, email, nama
- `Quiz`: id, ownerId, judul, deskripsi
- `Question`: id, quizId, teks, gambar?, opsi\[5\], indeksBenar, timerDetik, pengali
- `Room`: id, kode, hostId, quizId, status (lobby/running/finished), konfigurasi (JSON)
- `Player`: id, roomId, nama, avatar, token, tim, statusKoneksi
- `Team`: id, roomId, nama, anggota\[\]
- `Match`: id, roomId, ronde, timA, timB, hpA, hpB, soalAktif, pemenang
- `Answer`: id, matchId, questionId, playerId, kartu, benar, waktuMs, damage

State live (Redis/in-memory): room aktif, bracket, match aktif, timer, soket player.

### 7.4 Event Realtime (contoh)

**Client ke server**: `room:join`, `player:reconnect`, `host:start`, `host:pause`, `card:raise {matchId, questionId, card}`

**Server ke client**: `lobby:update`, `teams:assigned`, `bracket:update`, `match:start`, `question:show {teks, opsi, endsAt}`, `question:locked {winnerPlayer, benar}`, `damage:applied {target, amount, hpA, hpB}`, `match:end {winner}`, `tournament:end`

### 7.5 Algoritma pembagian tim

1. Acak pemain (Fisher-Yates).
2. Bagi per 5. Jika sisa 1 sampai 2 pemain, sebar ke tim lain (tim 6 pemain tidak diizinkan, jadi lebih baik buat sisa menjadi tim 3 atau 4 dengan mengambil pemain dari tim lain).
3. Tim berisi kurang dari 5: tetapkan pemain pemegang kartu ganda secara acak sampai kelima huruf A–E tercakup.
4. Buat bracket, tangani bye untuk jumlah tim ganjil.

Tulis ini sebagai fungsi murni dengan unit test.

## 8. Frontend: Rencana Halaman

- `/` landing + input kode join
- `/join/[code]` isi nama dan avatar
- `/play/[roomId]` layar pemain (lobby, kartu, hasil), mobile-first, tombol kartu besar
- `/host` dashboard kuis
- `/host/quiz/[id]` editor soal
- `/host/room/[id]` kontrol lobby dan turnamen
- `/display/[roomId]` layar proyektor (bracket, arena)

Komponen kunci: `CardButton`, `HpBar`, `TeamPanel`, `Bracket`, `QuestionTimer`, `DamagePopup`, `Leaderboard`.

UX penting: layar pemain harus responsif di HP kecil, getar (haptic) saat benar/salah, suara efek, dan tombol kartu tidak bisa salah tekan (konfirmasi tidak perlu; kecepatan utama).

## 9. Non-Fungsional

- **Latensi**: aksi kartu sampai server < 150 ms pada koneksi normal.
- **Skala target v1**: 1 room hingga 200 pemain, beberapa room bersamaan.
- **Reliabilitas**: reconnect otomatis, state room pulih dari Redis jika server restart.
- **Keamanan**: validasi semua event di server, rate limit, token pemain, sanitasi nama, kunci jawaban hanya di server.
- **Aksesibilitas**: kontras tinggi, label huruf pada kartu (bukan hanya warna).
- **Kompatibilitas**: Chrome/Safari mobile dua versi terakhir.

## 10. Metrik Sukses

- Waktu dari buka link sampai masuk lobby < 15 detik.
- > 90% pemain menyelesaikan pertandingan tanpa disconnect fatal.
- Host bisa membuat dan menjalankan kuis pertama kurang dari 10 menit.
- Rating kesenangan pemain pada playtest >= 4/5.

## 11. Risiko dan Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Jawaban "duluan" tidak adil karena beda latensi | Server authoritative + serial queue; tampilkan juga waktu respons; opsi jeda kecil sebelum kartu bisa diangkat |
| Pemain AFK/disconnect melemahkan tim | Bot-slot dan reconnect token |
| Tim tidak seimbang | Rekomendasi minimal pemain per room (10); aturan tim minimal 3 |
| Spam klik | Satu aksi per kartu per soal |
| Biaya server realtime | Mulai dengan satu instance kecil; scale dengan Redis adapter |
| Kompleksitas turnamen | Mulai dari single elimination saja |

## 12. Roadmap Pengembangan (cocok untuk vibe coding)

Kerjakan bertahap, tiap tahap harus bisa dijalankan dan dites sebelum lanjut.

1. **Fondasi**: setup monorepo/proyek Next.js + server Socket.IO, koneksi dasar, deploy awal.
2. **Room dan lobby**: buat room, join dengan kode, daftar pemain real-time.
3. **Pembagian tim**: algoritma + unit test, layar pengumuman tim.
4. **Pertandingan 1 vs 1 tim**: soal, kartu, rebutan, damage, HP bar, 5 soal, hasil.
5. **Editor kuis dan auth host**: simpan soal ke database.
6. **Turnamen**: bracket, bye, pertandingan paralel, juara.
7. **Polish**: animasi, suara, display mode, reconnect, tie-breaker.
8. **Playtest dan balancing**: uji dengan 20 sampai 50 orang, sesuaikan damage dan timer.

### Tips vibe coding

- Beri AI file PRD ini sebagai konteks tetap, dan minta kerjakan **satu tahap per prompt**.
- Minta tipe/skema event dibuat dulu (`shared/types.ts`) agar client dan server konsisten.
- Minta unit test untuk fungsi logika murni (pembagian tim, damage, bracket) sebelum UI.
- Buat script simulasi bot pemain untuk menguji 50+ pemain tanpa orang sungguhan.

## 13. Pertanyaan Terbuka

- Berapa HP awal dan damage default yang pas?
- Soal yang tidak dijawab: tanpa damage atau damage ke keduanya?
- Apakah semua pertandingan di satu ronde memakai soal yang sama?
- Perlu akun untuk pemain atau cukup nama panggilan?
- Mau ada power-up kartu spesial di versi berikutnya?
