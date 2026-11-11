import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadEnvFile } from "node:process";

// Test integrasi ("live DB") butuh DATABASE_URL dari .env; tanpa ini koneksi
// jatuh ke default localhost:5432 dan gagal.
try {
  loadEnvFile(path.resolve(__dirname, ".env"));
} catch {
  // .env tidak ada — test yang butuh DB akan gagal dengan pesan jelas.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["src/db/migrations/**", "src/components/**", "tests/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // modul "server-only" hanya boleh diimpor di lingkungan RSC; untuk test
      // DIPAKAI stub kosong agar logika server bisa diuji langsung.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});