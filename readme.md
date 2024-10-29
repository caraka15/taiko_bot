# Taiko Bot by CrxaNode

Bot ini digunakan untuk melakukan operasi otomatis pada jaringan Taiko dengan dukungan untuk multiple wallets dan dua mode operasi: WETH (Deposit/Withdraw) dan Vote.

## Persiapan

1. Clone repositori ini:

   ```bash
   git clone https://github.com/caraka15/taiko_bot.git
   ```

2. Masuk ke direktori proyek:

   ```bash
   cd taiko_bot
   ```

3. Instal dependensi:

   ```bash
   npm install
   ```

4. Setup konfigurasi:

   a. Menggunakan file example:

   ```bash
   cp .env.example .env
   cp config.json.example config/config.json
   ```

   b. Edit file sesuai kebutuhan:

   - File `.env`:

     ```env
     RPC_URL=https://rpc.taiko.tools/
     WETH_CONTRACT_ADDRESS=0xA51894664A773981C6C112C43ce576f315d5b1B6
     VOTE_CONTRACT_ADDRESS=0x4D1E2145082d0AB0fDa4a973dC4887C7295e21aB
     TELEGRAM_BOT_TOKEN=your_telegram_bot_token
     TELEGRAM_CHAT_ID=your_telegram_chat_id
     PRIVATE_KEY_1=your_first_private_key_here
     PRIVATE_KEY_2=your_second_private_key_here
     # Tambahkan private key sesuai kebutuhan
     ```

   - File `config/config.json`:
     ```json
     {
       "timezone": "Asia/Jakarta",
       "scheduledTime": "07:00",
       "gasPrice": "0.1",
       "confirmation": {
         "required": 1,
         "maxRetries": 3,
         "retryDelay": 5000
       },
       "weth": {
         "iterations": 35,
         "interval": 300,
         "amount_min": "0.001",
         "amount_max": "0.003",
         "wallets": {
           "wallet1": {
             "amount_min": "0.001",
             "amount_max": "0.003"
           }
         }
       },
       "vote": {
         "iterations": 70,
         "interval": 300
       }
     }
     ```

## Mode Operasi

Bot ini mendukung dua mode operasi:

### 1. Mode WETH

- Melakukan deposit ETH ke WETH
- Melakukan withdraw WETH ke ETH
- Konfigurasi jumlah dan range deposit per wallet
- Command: `npm run start:weth`

### 2. Mode Vote

- Melakukan vote transaction
- Iterasi 2x lebih banyak dari mode WETH
- Tidak memerlukan konfigurasi amount
- Command: `npm run start:vote`

## Konfigurasi

### Parameter Umum

|
Parameter
|
Deskripsi
|
|

---

## |

|
|
timezone
|
Zona waktu untuk penjadwalan (format: Asia/Jakarta)
|
|
scheduledTime
|
Waktu eksekusi harian (format: HH:mm)
|

### Parameter WETH Mode

|
Parameter
|
Deskripsi
|
|

---

## |

|
|
iterations
|
Jumlah iterasi deposit-withdraw
|
|
interval
|
Interval antara iterasi (dalam detik)
|
|
gasPrice
|
Harga gas dalam gwei untuk transaksi WETH
|
|
amount_min
|
Jumlah minimum deposit (dalam ETH)
|
|
amount_max
|
Jumlah maksimum deposit (dalam ETH)
|

### Parameter Vote Mode

|
Parameter
|
Deskripsi
|
|

---

## |

|
|
iterations
|
Jumlah iterasi voting (2x WETH iterations)
|
|
interval
|
Interval antara votes (dalam detik)
|
|
gasPrice
|
Harga gas dalam gwei untuk transaksi Vote
|

### Pengaturan Konfirmasi

|
Parameter
|
Deskripsi
|
|

---

## |

|
|
required
|
Jumlah konfirmasi yang diperlukan
|
|
maxRetries
|
Jumlah maksimal percobaan ulang jika transaksi gagal
|
|
retryDelay
|
Waktu tunggu sebelum percobaan ulang (dalam ms)
|

## Menjalankan Bot

1. Mode WETH:

   ```bash
   npm run start:weth
   ```

   atau untuk development:

   ```bash
   npm run dev:weth
   ```

2. Mode Vote:
   ```bash
   npm run start:vote
   ```
   atau untuk development:
   ```bash
   npm run dev:vote
   ```

Bot akan:

- Mulai pada waktu yang ditentukan dalam `scheduledTime`
- Menjalankan operasi sesuai mode yang dipilih
- Melacak points dan biaya gas
- Mengirim laporan detail ke Telegram setelah selesai

## Fitur

- 🔄 Dual mode: WETH dan Vote
- 👛 Dukungan multiple wallets
- 📊 Tracking points dan rank
- 💰 Perhitungan fee akurat per wallet
- 📱 Notifikasi Telegram dengan report detail
- ⏰ Penjadwalan otomatis
- 🔍 Monitoring transaksi real-time
- 📈 Statistik performa per wallet

## Update Bot

```bash
git pull origin main
npm install
```

## Keamanan

- Jangan pernah membagikan private key
- Gunakan wallet terpisah untuk bot
- Pastikan file `.env` dalam .gitignore
- Monitor aktivitas bot secara berkala
- Backup private key dengan aman

## Troubleshooting

1. Error transaksi:

   - Periksa saldo ETH mencukupi
   - Pastikan gas price sesuai
   - Cek status jaringan Taiko

2. Masalah penjadwalan:

   - Verifikasi timezone server
   - Cek format waktu (HH:mm)
   - Pastikan bot berjalan

3. Error Telegram:
   - Validasi bot token dan chat ID
   - Cek permission bot

## Support

Jika mengalami masalah atau ada pertanyaan:

- Buka issue di GitHub
- Hubungi: [@caraka17](https://t.me/caraka17)

## Donasi

Jika Anda merasa terbantu dengan bot ini, Anda dapat memberikan dukungan melalui:

- Crypto: `0xede7fa099638d4f39931d2df549ac36c90dfbd26`
- Saweria: [https://saweria.co/crxanode](https://saweria.co/crxanode)

## Disclaimer

Bot ini disediakan "as is" tanpa jaminan apapun. Pengguna bertanggung jawab penuh atas penggunaan bot dan resiko yang mungkin timbul.

## License

MIT License - lihat file [LICENSE](LICENSE) untuk detail lengkap.
