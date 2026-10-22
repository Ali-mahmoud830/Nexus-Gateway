import { connectDatabase } from '../src/config/database';
import { Invoice } from '../src/models/Invoice';

async function inspect() {
  await connectDatabase();
  const invoice = await Invoice.findOne({ invoiceId: 'inv_f0cb47047f2342fe' });
  console.log('--- FULL INVOICE DETAILS ---');
  console.log(JSON.stringify(invoice, null, 2));
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
