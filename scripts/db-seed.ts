function main() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    console.error("DATABASE_URL is required to seed. Set it in .env.local.");
    process.exitCode = 1;
    return;
  }

  console.error(
    "Seed is not implemented yet. This is a scaffold placeholder for later maturity work.",
  );
  process.exitCode = 1;
}

main();
