import 'dotenv/config';
import { prisma } from '../src/lib/data/db';

async function main() {
  const count = await prisma.priceData.count();
  console.log('Total PriceData records:', count);
  
  const sample = await prisma.priceData.findFirst({
    orderBy: { timestamp: 'desc' }
  });
  console.log('Latest record:', sample);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
