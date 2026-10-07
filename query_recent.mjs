import { createClient } from "@libsql/client";
const client = createClient({
  url: "libsql://finanzar-augustoterrera.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg3NDQzNTcsImlkIjoiMDFhMDc5NzctZjkwMS03MDVmLTg3NDYtYzk5NzVhZjkyYmU3Iiwia2lkIjoiYzRUaUluUzdYZml2MzJySzV2QVNOQUNRQmJERWdpNDRaVUVlOUVNdVJMRSIsInJpZCI6ImFmY2IzYjFkLTU4MmItNDI1MS04YmUwLTljNDcyYjI5MTVlYyJ9.eaHkfnxsWaS0ZWJZtyr-EiDX-hNnpX6hHmgoD5iJy6nG2-RzYVCDAluq9Ca_g1u7uzGf6TcU07jWKQutAb9dCQ"
});
async function main() {
  const result = await client.execute("SELECT id, date, month, amount, description, type, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 10;");
  console.log(JSON.stringify(result.rows, null, 2));
}
main().catch(console.error);
