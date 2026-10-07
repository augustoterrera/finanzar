import { db } from './src/lib/server/db/index.js';
import { people, cards, payment_methods } from './src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  console.log("Verificando owner...");
  const owners = await db.select().from(people).where(eq(people.is_owner, true));
  console.log("Owners encontrados:", owners.length, owners[0]?.name);

  console.log("\nIntentando crear tarjeta...");
  let cardId = "test_card_1";
  await db.insert(cards).values({ id: cardId, name: 'Test Card', owner_person_id: owners[0].id, closing_day: 10 });
  console.log("Tarjeta creada.");

  console.log("\nIntentando crear medio de pago (credit_card) con tarjeta...");
  await db.insert(payment_methods).values({ id: "pm_1", name: "Credit Test", type: "credit_card", card_id: cardId });
  console.log("Medio creado.");

  console.log("\nIntentando crear medio de pago (debit) sin tarjeta...");
  await db.insert(payment_methods).values({ id: "pm_2", name: "Debit Test", type: "debit", card_id: null });
  console.log("Medio creado.");

  console.log("\nProbando bloqueo: Eliminar tarjeta usada en medio de pago...");
  try {
    const hasPM = await db.select().from(payment_methods).where(eq(payment_methods.card_id, cardId)).get();
    if (hasPM) throw new Error("La tarjeta está asociada a un medio de pago");
    await db.delete(cards).where(eq(cards.id, cardId));
  } catch(e) {
    console.log("Bloqueo exitoso:", e.message);
  }

  console.log("\nLimpiando datos de prueba...");
  await db.delete(payment_methods).where(eq(payment_methods.id, "pm_1"));
  await db.delete(payment_methods).where(eq(payment_methods.id, "pm_2"));
  await db.delete(cards).where(eq(cards.id, cardId));
  console.log("Limpieza exitosa.");
  
  process.exit(0);
}

run().catch(console.error);
