/**
 * Adaptador Airtable para la tabla Modulos.
 */

import { Modulo } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';
import { fetchAlumnoCountByModulo } from './AlumnosAdapter';

interface AirtableModuloFields {
  'ID'?: string;
  'Nombre'?: string;
  'Precio Online'?: number;
  'Activo'?: boolean;
  'Capacidad'?: number;
  'Reserva Prelanzamiento'?: number;
}

function mapToModulo(record: AirtableRecord<AirtableModuloFields>): Modulo {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    moduloId: f['ID'] || '',
    nombre: f['Nombre'] || '',
    precioOnline: f['Precio Online'],
    activo: f['Activo'] || false,
    capacidad: f['Capacidad'],
    inscritos: 0,
    reservaPrelanzamiento: f['Reserva Prelanzamiento'],
  };
}

/** Strips accents and lowercases for fuzzy matching */
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export async function fetchModulos(): Promise<Modulo[]> {
  const [records, countsByModulo] = await Promise.all([
    listRecords<AirtableModuloFields>(AIRTABLE_TABLES.MODULOS, {
      filterByFormula: '{Activo} = TRUE()',
    }),
    fetchAlumnoCountByModulo(),
  ]);

  return records.map(record => {
    const modulo = mapToModulo(record);
    // Match module name against Modulo Solicitado values (normalize to ignore accent diffs)
    modulo.inscritos = countsByModulo.get(normalizeStr(modulo.nombre)) ?? 0;
    return modulo;
  });
}
