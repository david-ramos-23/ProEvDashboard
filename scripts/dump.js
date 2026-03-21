import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const p = env.match(/VITE_AIRTABLE_PAT=(.*)/)?.[1]?.trim();
const b = env.match(/VITE_AIRTABLE_BASE_ID=(.*)/)?.[1]?.trim();

const tables = ['Alumnos', 'Revisiones', 'Pagos', 'Ediciones', 'Modulos'];
const schemas = {};

async function run() {
  for (const table of tables) {
    try {
      const resp = await fetch(`https://api.airtable.com/v0/${b}/${table}?maxRecords=1`, {
        headers: { Authorization: `Bearer ${p}` }
      });
      const data = await resp.json();
      if (data.records && data.records.length > 0) {
        schemas[table] = {
          fields: Object.keys(data.records[0].fields),
          sample: data.records[0].fields
        };
      } else {
        schemas[table] = data;
      }
    } catch (e) {
      schemas[table] = e.message;
    }
  }
  fs.writeFileSync('schema.json', JSON.stringify(schemas, null, 2));
}

run();
