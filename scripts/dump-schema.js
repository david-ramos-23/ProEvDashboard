import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pat = process.env.VITE_AIRTABLE_PAT;
const base = process.env.VITE_AIRTABLE_BASE_ID;

const tables = ['Alumnos', 'Revisiones', 'Pagos', 'Ediciones', 'Modulos'];
const schemas = {};

async function run() {
  for (const table of tables) {
    try {
      const resp = await fetch(`https://api.airtable.com/v0/${base}/${table}?maxRecords=1`, {
        headers: { Authorization: `Bearer ${pat}` }
      });
      const data = await resp.json();
      if (data.records && data.records.length > 0) {
        schemas[table] = Object.keys(data.records[0].fields);
      } else {
        schemas[table] = ['No records or error', JSON.stringify(data)];
      }
    } catch (e) {
      schemas[table] = e.message;
    }
  }
  fs.writeFileSync('schema.json', JSON.stringify(schemas, null, 2));
  console.log('Schemas written to schema.json');
}

run();
