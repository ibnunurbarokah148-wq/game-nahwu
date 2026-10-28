import type { Quiz, QuizQuestion } from "./game";

export const SEED_QUESTIONS: QuizQuestion[] = [
  { id: "q1", text: "Apa bentuk jamak dari كِتَابٌ (kitābun)?", options: ["كُتُبٌ", "كَاتِبٌ", "مَكْتَبٌ", "كِتَابَانِ", "كِتَابَةٌ"], correctIndex: 0, multiplier: 1, category: "Mufradat & Jamak" },
  { id: "q2", text: "Kata مَدْرَسَةٌ termasuk jenis kata apa?", options: ["Fi'il", "Isim", "Huruf", "Jumlah fi'liyah", "Dhamir"], correctIndex: 1, multiplier: 1, category: "Kalimah" },
  { id: "q3", text: "Apa arti kata طَالِبٌ?", options: ["Guru", "Buku", "Murid laki-laki", "Sekolah", "Pelajaran"], correctIndex: 2, multiplier: 1, category: "Mufradat" },
  { id: "q4", text: "Manakah contoh fi'il madhi?", options: ["يَكْتُبُ", "اُكْتُبْ", "كَتَبَ", "كِتَابٌ", "كَاتِبٌ"], correctIndex: 2, multiplier: 1.5, category: "Shorof" },
  { id: "q5", text: "Dhamir هُمْ digunakan untuk siapa?", options: ["Dia perempuan", "Mereka laki-laki", "Kalian berdua", "Kami", "Kamu perempuan"], correctIndex: 1, multiplier: 1, category: "Dhamir" },
  { id: "q6", text: "Apa bentuk mutsanna dari مُعَلِّمٌ?", options: ["مُعَلِّمُونَ", "مُعَلِّمَاتٌ", "مُعَلِّمَانِ", "مُعَلَّمٌ", "مُعَلِّمٍ"], correctIndex: 2, multiplier: 1.5, category: "Shorof" },
  { id: "q7", text: "Dalam jumlah اِسْمِيَّة, susunan umumnya adalah...", options: ["Fi'il + fa'il", "Mubtada + khabar", "Huruf + fi'il", "Fa'il + maf'ul", "Jar + majrur"], correctIndex: 1, multiplier: 1, category: "Nahwu" },
  { id: "q8", text: "Apa lawan kata كَبِيرٌ?", options: ["طَوِيلٌ", "جَدِيدٌ", "صَغِيرٌ", "قَرِيبٌ", "جَمِيلٌ"], correctIndex: 2, multiplier: 1, category: "Mufradat" },
  { id: "q9", text: "Tanda rafa' asli pada isim mufrad adalah...", options: ["Fathah", "Kasrah", "Dhammah", "Sukun", "Alif"], correctIndex: 2, multiplier: 1, category: "I'rab" },
  { id: "q10", text: "Pada kalimat قَرَأَ زَيْدٌ القُرْآنَ, kedudukan القُرْآنَ adalah...", options: ["Fa'il", "Mubtada", "Khabar", "Maf'ul bih", "Majrur"], correctIndex: 3, multiplier: 1.5, category: "I'rab" },
];

export const SEED_QUIZZES: Quiz[] = [
  {
    id: "nahwu-dasar",
    title: "Nahwu & Mufradat Dasar",
    description: "Kuis dasar pembagian kalimah, dhamir, mutsanna/jamak, dan susunan jumlah ismiyah/fi'liyah.",
    category: "Nahwu Dasar",
    updatedAt: "2026-10-20T00:00:00.000Z",
    questions: SEED_QUESTIONS,
  },
  {
    id: "irab-jurumiyah",
    title: "Tanda I'rab & Jurumiyah",
    description: "Uji ketangkasan tim menentukan hukum i'rab (rafa', nashab, khafadh, jazm) dan kedudukan kata.",
    category: "Nahwu Lanjutan",
    updatedAt: "2026-10-20T00:00:00.000Z",
    questions: [
      { id: "j1", text: "Hukum asal bagi Fa'il (pelaku pekerjaan) dalam ilmu nahwu adalah...", options: ["Manshub", "Marfu'", "Majrur", "Majzum", "Mabni"], correctIndex: 1, multiplier: 1, category: "Marfu'at" },
      { id: "j2", text: "Tanda nashab bagi jamak mudzakkar salim adalah...", options: ["Fathah", "Alif", "Ya'", "Kasrah", "Wawu"], correctIndex: 2, multiplier: 1.5, category: "I'rab" },
      { id: "j3", text: "Manakah di antara berikut ini yang termasuk huruf jar?", options: ["لَمْ", "أَنْ", "فِي", "إِنَّ", "كَأَنَّ"], correctIndex: 2, multiplier: 1, category: "Huruf" },
      { id: "j4", text: "Amil إِنَّ dan saudara-saudaranya memiliki amal...", options: ["Merafa'kan isim, menashabkan khabar", "Menashabkan isim, merafa'kan khabar", "Menjazmkan dua fi'il", "Mengkafdahkan isim", "Merafa'kan keduanya"], correctIndex: 1, multiplier: 1.5, category: "Nawashikh" },
      { id: "j5", text: "Pada kalimat ذَهَبْتُ إِلَى المَسْجِدِ, kata المَسْجِدِ dibaca kasrah karena...", options: ["Menjadi fa'il", "Menjadi maf'ul bih", "Kemasukan huruf jar", "Menjadi khabar", "Menjadi na'at"], correctIndex: 2, multiplier: 1, category: "Majrurat" },
      { id: "j6", text: "Tanda rafa' pada Asma'ul Khamsah (seperti أَبُوكَ) adalah...", options: ["Dhammah", "Alif", "Wawu", "Ya'", "Nun"], correctIndex: 2, multiplier: 1.5, category: "I'rab" },
    ],
  },
];
