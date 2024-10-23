# Taiko Bot by CrxaNode

Bot ini digunakan untuk melakukan operasi deposit dan withdraw otomatis pada jaringan Taiko dengan dukungan untuk multiple wallets.

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
     CONTRACT_ADDRESS=0xA51894664A773981C6C112C43ce576f315d5b1B6
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
       "iterations": 70,
       "interval": 300,
       "gasPrice": "0.1",
       "amount_min": "0.001",
       "amount_max": "0.003",
       "confirmation": {
         "required": 1,
         "maxRetries": 3,
         "retryDelay": 5000
       },
       "wallets": {
         "wallet1": {
           "amount_min": "0.001",
           "amount_max": "0.003"
         }
       }
     }
     ```

## Konfigurasi

### Parameter Konfigurasi

| Parameter     | Deskripsi                                           |
| ------------- | --------------------------------------------------- |
| timezone      | Zona waktu untuk penjadwalan (format: Asia/Jakarta) |
| scheduledTime | Waktu eksekusi harian (format: HH:mm)               |
| iterations    | Jumlah iterasi per eksekusi                         |
| interval      | Interval antara iterasi (dalam detik)               |
| gasPrice      | Harga gas dalam gwei                                |
| amount_min    | Jumlah minimum deposit (dalam ETH)                  |
| amount_max    | Jumlah maksimum deposit (dalam ETH)                 |

### Pengaturan Konfirmasi

| Parameter  | Deskripsi                                            |
| ---------- | ---------------------------------------------------- |
| required   | Jumlah konfirmasi yang diperlukan                    |
| maxRetries | Jumlah maksimal percobaan ulang jika transaksi gagal |
| retryDelay | Waktu tunggu sebelum percobaan ulang (dalam ms)      |

## Menjalankan Bot

1. Start bot:

   ```bash
   npm start
   ```

   atau untuk development:

   ```bash
   npm run dev
   ```

2. Bot akan:
   - Mulai pada waktu yang ditentukan dalam `scheduledTime`
   - Menjalankan operasi deposit dan withdraw sesuai jumlah iterasi
   - Mengirim laporan ke Telegram setelah selesai

## Fitur

- 🔄 Otomatisasi deposit dan withdraw
- 👛 Dukungan multiple wallets
- 📊 Tracking points dan rank
- 💰 Perhitungan fee akurat
- 📱 Notifikasi Telegram
- ⏰ Penjadwalan otomatis
- 🔍 Monitoring transaksi real-time

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

## Disclaimer

Bot ini disediakan "as is" tanpa jaminan apapun. Pengguna bertanggung jawab penuh atas penggunaan bot dan risiko yang mungkin timbul.

## License

MIT License - lihat file [LICENSE](LICENSE) untuk detail lengkap.
