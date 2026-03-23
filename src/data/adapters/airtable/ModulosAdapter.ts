/**
 * Adaptador Airtable para la tabla Modulos.
 */

import { Modulo } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

interface AirtableModuloFields {
  'ID'?: string;
  'Nombre'?: string;
  'Precio Online'?: number;
  'Activo'?: boolean;
  'Capacidad'?: number;
  'Inscritos'?: number;
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
    inscritos: f['Inscritos'],
    reservaPrelanzamiento: f['Reserva Prelanzamiento'],
  };
}

export async function fetchModulos(): Promise<Modulo[]> {
  const records = await listRecords<AirtableModuloFields>(AIRTABLE_TABLES.MODULOS, {
    filterByFormula: '{Activo} = TRUE()',
  });
  return records.map(mapToModulo);
}
