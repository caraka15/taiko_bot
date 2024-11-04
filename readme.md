# Taiko Bot by CrxaNode

Bot ini digunakan untuk melakukan operasi otomatis pada jaringan Taiko dengan dukungan untuk multiple wallets dan dua mode operasi: WETH (Deposit/Withdraw) dan Vote.

## ⚠️ Peringatan Penting

1. **RPC Usage**:

   - Gunakan RPC **PRIVATE** untuk transaksi utama (dari BlockPi, Ankr, atau penyedia lainnya)
   - Jangan gunakan RPC publik untuk transaksi karena berisiko tinggi gagal
   - Bot menggunakan RPC publik hanya untuk pengecekan konfirmasi blok untuk menghemat limit RPC private
   - File `publicRpc.json` berisi daftar RPC publik yang digunakan khusus untuk monitoring konfirmasi blok

2. **Security**:

   - **JANGAN PERNAH** menggunakan wallet utama
   - Gunakan wallet terpisah khusus untuk bot
   - Backup private key di tempat yang aman
   - Jangan share private key dengan siapapun

3. **Risk Management**:
   - Monitor aktivitas bot secara berkala
   - Set jumlah ETH yang aman untuk digunakan
   - Perhatikan gas price dan limit untuk menghindari kegagalan transaksi

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
     # Gunakan RPC PRIVATE untuk transaksi utama
     RPC_URL=your_private_rpc_url_here    # Blockpi/Ankr Private RPC

     # Contract Addresses
     WETH_CONTRACT_ADDRESS=0xA51894664A773981C6C112C43ce576f315d5b1B6
     VOTE_CONTRACT_ADDRESS=0x4D1E2145082d0AB0fDa4a973dC4887C7295e21aB

     # Telegram Config
     TELEGRAM_BOT_TOKEN=your_telegram_bot_token
     TELEGRAM_CHAT_ID=your_telegram_chat_id

     # Wallet Private Keys (Gunakan wallet terpisah!)
     PRIVATE_KEY_1=your_first_private_key_here
     PRIVATE_KEY_2=your_second_private_key_here
     # Tambahkan private key sesuai kebutuhan
     ```

   - File `config/publicRpc.json`:

     ```json
     {
       "checker_rpc": ["https://rpc.ankr.com/taiko", "https://taiko.drpc.org"]
     }
     ```

   - File `config/config.json`:
     ```json
     {
       "timezone": "Asia/Jakarta",
       "scheduledTime": "07:00",
       "confirmation": {
         "required": 1,
         "maxRetries": 3,
         "retryDelay": 5000
       },
       "weth": {
         "iterations": 35,
         "interval": 300,
         "gasPrice": "0.1",
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
         "interval": 300,
         "maxFee": "0.25",
         "maxPriorityFee": "0.12"
       }
     }
     ```

## Mode Operasi

Bot ini mendukung dua mode operasi:

### 1. Mode WETH

- Melakukan deposit ETH ke WETH
- Melakukan withdraw WETH ke ETH
- Konfigurasi jumlah dan range deposit per wallet
- Command untuk mulai sesuai jadwal: `npm run start:weth`
- Command untuk mulai langsung: `npm run start:weth:now`

### 2. Mode Vote

- Melakukan vote transaction
- Iterasi 2x lebih banyak dari mode WETH
- Tidak memerlukan konfigurasi amount
- Command untuk mulai sesuai jadwal: `npm run start:vote`
- Command untuk mulai langsung: `npm run start:vote:now`

## Commands

### Production Mode

```bash
npm run start:weth      # WETH mode, mulai sesuai jadwal
npm run start:vote      # Vote mode, mulai sesuai jadwal
npm run start:weth:now  # WETH mode, mulai langsung + jadwal
npm run start:vote:now  # Vote mode, mulai langsung + jadwal
```

### Development Mode (dengan auto-reload)

```bash
npm run dev:weth       # WETH mode, mulai sesuai jadwal
npm run dev:vote       # Vote mode, mulai sesuai jadwal
npm run dev:weth:now   # WETH mode, mulai langsung + jadwal
npm run dev:vote:now   # Vote mode, mulai langsung + jadwal
```

## Konfigurasi

### Parameter Umum

| Parameter     | Deskripsi                                           |
| ------------- | --------------------------------------------------- |
| timezone      | Zona waktu untuk penjadwalan (format: Asia/Jakarta) |
| scheduledTime | Waktu eksekusi harian (format: HH:mm)               |

### Parameter WETH Mode

| Parameter  | Deskripsi                                 |
| ---------- | ----------------------------------------- |
| iterations | Jumlah iterasi deposit-withdraw           |
| interval   | Interval antara iterasi (dalam detik)     |
| gasPrice   | Harga gas dalam gwei untuk transaksi WETH |
| amount_min | Jumlah minimum deposit (dalam ETH)        |
| amount_max | Jumlah maksimum deposit (dalam ETH)       |

### Parameter Vote Mode

| Parameter      | Deskripsi                                  |
| -------------- | ------------------------------------------ |
| iterations     | Jumlah iterasi voting (2x WETH iterations) |
| interval       | Interval antara votes (dalam detik)        |
| maxFee         | Maximum fee per gas dalam gwei             |
| maxPriorityFee | Maximum priority fee dalam gwei            |

### Pengaturan Konfirmasi

| Parameter  | Deskripsi                                            |
| ---------- | ---------------------------------------------------- |
| required   | Jumlah konfirmasi blok yang diperlukan               |
| maxRetries | Jumlah maksimal percobaan ulang jika transaksi gagal |
| retryDelay | Waktu tunggu sebelum percobaan ulang (dalam ms)      |

## RPC Management

Bot menggunakan dua jenis RPC:

1. **Private RPC** (dari .env):

   - Digunakan untuk transaksi utama (submit tx)
   - Memerlukan RPC private berbayar (BlockPi/Ankr)
   - Lebih stabil dan reliable
   - Hemat limit dengan hanya digunakan untuk transaksi

2. **Public RPC** (dari publicRpc.json):
   - Hanya digunakan untuk cek konfirmasi blok
   - Rotasi otomatis antar RPC publik
   - Menghemat limit RPC private
   - Tidak digunakan untuk transaksi

## Fitur

- 🔄 Dual mode: WETH dan Vote
- 👛 Dukungan multiple wallets
- 📊 Tracking points dan rank
- 💰 Perhitungan fee akurat per wallet
- 📱 Notifikasi Telegram dengan report detail
- ⏰ Penjadwalan otomatis dengan opsi start langsung
- 🔍 Monitoring transaksi real-time
- 📈 Statistik performa per wallet
- ♻️ Smart RPC management (private/public)

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
- Gunakan RPC private untuk transaksi

## Troubleshooting

1. Error transaksi:

   - Periksa saldo ETH mencukupi
   - Pastikan gas price sesuai
   - Cek status jaringan Taiko
   - Verifikasi RPC private berfungsi

2. Masalah penjadwalan:

   - Verifikasi timezone server
   - Cek format waktu (HH:mm)
   - Pastikan bot berjalan
   - Coba mode "now" untuk testing

3. Error Telegram:

   - Validasi bot token dan chat ID
   - Cek permission bot

4. Error RPC:
   - Pastikan RPC private aktif
   - Cek limit RPC tidak habis
   - Verifikasi daftar public RPC
   - Monitor rotasi RPC checker

## Support

Jika mengalami masalah atau ada pertanyaan:

- Buka issue di GitHub
- Hubungi: [@caraka17](https://t.me/caraka17)

## Donasi

Jika Anda merasa terbantu dengan bot ini, Anda dapat memberikan dukungan melalui:

- Crypto: `0xede7fa099638d4f39931d2df549ac36c90dfbd26`
- Saweria: [https://saweria.co/crxanode](https://saweria.co/crxanode)

## Disclaimer

Bot ini disediakan "as is" tanpa jaminan apapun. Pengguna bertanggung jawab penuh atas penggunaan bot dan resiko yang mungkin timbul. Pastikan untuk:

- Menggunakan wallet terpisah
- Mengatur jumlah ETH yang aman
- Monitoring secara berkala
- Menggunakan RPC yang sesuai
- Memahami resiko operasi di blockchain

## License

MIT License - lihat file [LICENSE](LICENSE) untuk detail lengkap.
