const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

async function runCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    return {
      output: stdout,
      error: stderr,
      retval: 0,
    };
  } catch (error) {
    return {
      output: error.stdout,
      error: error.stderr,
      retval: error.code,
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fungsi utama
async function main() {
  // Jumlah iterasi
  const iterations = 70; // Ganti dengan jumlah tx yang diinginkan

  // Interval waktu dalam detik
  const interval = 30;

  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1} of ${iterations}`);

    // Jalankan deposit
    console.log("Running deposit...");
    const depositResult = await runCommand("node weth_deposit.js");
    console.log(depositResult.output);

    if (depositResult.retval === 0) {
      console.log(`Deposit successful, waiting for ${interval} seconds...`);

      await sleep(interval * 1000);

      // Jalankan withdraw
      console.log("Running withdraw...");
      const withdrawResult = await runCommand("node weth_withdraw.js");
      console.log(withdrawResult.output);

      if (withdrawResult.retval === 0) {
        console.log("Withdraw successful.");
      } else {
        console.log("Withdraw failed.");
      }
    } else {
      console.log("Deposit failed.");
    }

    if (i < iterations - 1) {
      console.log(`Waiting for ${interval} seconds before next iteration...`);
      await sleep(interval * 1000);
    }
  }

  console.log("All iterations completed.");
}

// Jalankan fungsi utama
main().catch(console.error);
