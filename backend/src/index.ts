import "dotenv/config";
import { app } from "./app";
import { migrate } from "./db/migrate";

const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
  try {
    console.log("[server] Running database migrations...");
    await migrate();
    console.log("[server] Migrations complete.");
  } catch (error) {
    console.warn("[server] Migration warning (check DATABASE_URL connection):", error);
  }

  app.listen(PORT, () => {
    console.log(`[server] PRIVATUM Co-Signer running at http://localhost:${PORT}`);
    console.log(`[server] Network: Robinhood Chain (ID: 4663)`);
  });
}

bootstrap();
