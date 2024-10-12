# Taiko Bot by CrxaNode

Bot ini digunakan untuk melakukan operasi deposit dan withdraw otomatis pada jaringan Taiko.

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

4. Buat file `.env` di root direktori proyek dan tambahkan private key Anda:
   ```
   PRIVATE_KEY=your_private_key_here
   ```
   **PENTING:** Jangan pernah membagikan atau meng-commit file `.env` Anda ke repositori publik!

## Konfigurasi

Buka file `config.json` dan sesuaikan pengaturan berikut sesuai kebutuhan Anda:

```json
{
  "amount": "0.0004",
  "gasPrice": "0.09",
  "iterations": 70,
  "interval": 30
}
```

- `amount`: Jumlah ETH untuk deposit/withdraw (dalam ETH)
- `gasPrice`: Harga gas (dalam gwei)
- `iterations`: Jumlah total iterasi yang akan dijalankan oleh bot
- `interval`: Waktu tunggu (dalam detik) antara setiap operasi deposit dan withdraw

## Menjalankan Bot

Untuk menjalankan bot, gunakan perintah berikut:

```
node weth.js
```

Bot akan mulai menjalankan operasi deposit dan withdraw sesuai dengan konfigurasi yang telah Anda tetapkan di `config.json`.

## Catatan Penting

- Pastikan Anda memiliki cukup ETH di akun Anda untuk biaya gas.
- Monitor aktivitas bot secara berkala untuk memastikan semuanya berjalan dengan lancar.
- Jika Anda mengalami masalah atau error, periksa log output untuk informasi lebih lanjut.

## Keamanan

- Jangan pernah membagikan private key Anda.
- Gunakan akun terpisah untuk bot ini, bukan akun utama Anda.
- Selalu monitor aktivitas bot dan saldo akun Anda.

## Dukungan

Jika Anda mengalami masalah atau memiliki pertanyaan, silakan buka issue di repositori GitHub ini atau hubungi tim dukungan kami.

## Disclaimer

Penggunaan bot ini adalah risiko Anda sendiri. Pastikan Anda memahami sepenuhnya cara kerja bot dan risiko yang terkait dengan penggunaannya di jaringan blockchain.
