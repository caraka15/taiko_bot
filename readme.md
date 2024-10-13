# Taiko Bot by CrxaNode

Bot ini digunakan untuk melakukan operasi deposit dan withdraw otomatis pada jaringan Taiko dengan dukungan untuk multiple wallets.

## Persiapan

1. Clone repositori ini:

   ```
   git clone https://github.com/caraka15/taiko_bot.git
   ```

2. Masuk ke direktori proyek:

   ```
   cd taiko_bot
   ```

3. Instal dependensi:

   ```
   npm install
   ```

4. Buat file `.env` di root direktori proyek dan tambahkan konfigurasi berikut:
   ```
   RPC_URL=https://rpc.taiko.tools/
   CONTRACT_ADDRESS=0xA51894664A773981C6C112C43ce576f315d5b1B6
   PRIVATE_KEY_1=your_first_private_key_here
   PRIVATE_KEY_2=your_second_private_key_here
   PRIVATE_KEY_3=your_third_private_key_here
   # Tambahkan lebih banyak private keys sesuai kebutuhan
   ```
   **PENTING:** Jangan pernah membagikan atau meng-commit file `.env` Anda ke repositori publik!

## Konfigurasi

Buka file `config.json` dan sesuaikan pengaturan berikut sesuai kebutuhan Anda:

```json
{
  "iterations": 70,
  "interval": 30,
  "timezone": "Asia/Jakarta",
  "scheduledTime": "07:00",
  "gasPrice": "0.09",
  "amount_min": "0.0001",
  "amount_max": "0.001"
}
```

- `iterations`: Jumlah total iterasi yang akan dijalankan oleh bot
- `interval`: Waktu tunggu (dalam detik) antara setiap operasi
- `timezone`: Zona waktu untuk penjadwalan (gunakan format tz database)
- `scheduledTime`: Waktu harian untuk menjalankan bot (format 24 jam)
- `gasPrice`: Harga gas (dalam gwei)
- `amount_min`: Jumlah minimum ETH untuk deposit (dalam ETH)
- `amount_max`: Jumlah maksimum ETH untuk deposit (dalam ETH)

## Menjalankan Bot

Untuk menjalankan bot, gunakan perintah berikut:

```
node weth.js
```

Bot akan dijadwalkan untuk berjalan pada waktu yang ditentukan dalam `config.json`. Setiap kali dijalankan, bot akan melakukan operasi deposit dan withdraw untuk semua wallet yang dikonfigurasi dalam file `.env`.

## Update Bot

Untuk menjalankan bot, gunakan perintah berikut:

```
git fetch origin && git checkout origin/main config.json
```

```
git pull
```

```
npm install
```

## Catatan Penting

- Pastikan setiap wallet memiliki cukup ETH untuk biaya gas dan deposit.
- Monitor aktivitas bot secara berkala untuk memastikan semuanya berjalan dengan lancar.
- Jika Anda mengalami masalah atau error, periksa log output untuk informasi lebih lanjut.
- Bot akan melakukan deposit dengan jumlah acak antara `amount_min` dan `amount_max` untuk setiap transaksi.
- Withdraw akan selalu menggunakan seluruh balance WETH yang tersedia.

## Keamanan

- Jangan pernah membagikan private key Anda.
- Gunakan akun terpisah untuk bot ini, bukan akun utama Anda.
- Selalu monitor aktivitas bot dan saldo akun Anda.
- Pastikan file `.env` ditambahkan ke `.gitignore` Anda.

## Kustomisasi

- Anda dapat menambahkan atau mengurangi jumlah wallet dengan menambah atau mengurangi entri `PRIVATE_KEY_X` di file `.env`.
- Untuk mengubah jadwal bot, sesuaikan `scheduledTime` dan `timezone` di `config.json`.

## Troubleshooting

- Jika bot tidak berjalan pada waktu yang dijadwalkan, pastikan timezone server Anda sesuai dengan yang dikonfigurasi.
- Periksa log untuk melihat detail setiap transaksi dan error yang mungkin terjadi.

## Dukungan

Jika Anda mengalami masalah atau memiliki pertanyaan, silakan buka issue di repositori GitHub ini atau hubungi tim dukungan kami.

## Disclaimer

Penggunaan bot ini adalah risiko Anda sendiri. Pastikan Anda memahami sepenuhnya cara kerja bot dan risiko yang terkait dengan penggunaannya di jaringan blockchain.
