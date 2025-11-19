#!/usr/bin/env node
/**
 * Environment validation script
 * This script validates all required environment variables before the app starts.
 * Run this before starting your application to ensure all env vars are set correctly.
 */

import postgres from "postgres";
import { defaultDatabaseUrl, env } from "./env";

const URL_PASSWORD_REGEX = /:[^:@]+@/;

function maskUrl(url: string): string {
  return url.replace(URL_PASSWORD_REGEX, ":****@");
}

function isUsingDefault(url: string): boolean {
  return url === defaultDatabaseUrl;
}

async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = postgres(env.DATABASE_URL, { max: 1 });
    await client`SELECT 1`;
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
    const databaseUrl = env.DATABASE_URL;
    const isDefault = isUsingDefault(databaseUrl);

    console.log("All environment variables are valid!\n");
    console.log(`   DATABASE_URL: ${maskUrl(databaseUrl)}`);
    if (isDefault) {
      console.log("   ⚠️ Using default DATABASE_URL (local development)");
      console.log("   💡 Set DATABASE_URL environment variable to override\n");
    } else {
      console.log("   ✓ Using custom DATABASE_URL from environment\n");
    }

    const isConnected = await testDatabaseConnection();

    if (isConnected) {
      console.log("✅ Database connection successful!\n");
      console.log("✨ All checks passed! Your environment is ready.\n");
      process.exit(0);
    } else {
      console.error("❌ Database connection failed!");
      console.error("\n💡 Make sure your database is running and accessible.");
      if (isDefault) {
        console.error("   Start the local database with: pnpm db:start\n");
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("Environment validation failed!\n");
    if (error instanceof Error) {
      console.error(`Error: ${error.message}\n`);
    } else {
      console.error(`Error: ${String(error)}\n`);
    }
    console.error(
      "💡 Please check your environment variables and try again.\n"
    );
    process.exit(1);
  }
}

main();
