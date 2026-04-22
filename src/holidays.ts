export interface Holiday {
  date: string; // MM-DD format
  name: string;
}

export interface RegionalHolidays {
  [region: string]: Holiday[];
}

export const NATIONAL_HOLIDAYS: { [country: string]: Holiday[] } = {
  'España': [
    { date: '01-01', name: 'Año Nuevo' },
    { date: '01-06', name: 'Epifanía del Señor' },
    { date: '04-03', name: 'Viernes Santo' },
    { date: '05-01', name: 'Fiesta del Trabajo' },
    { date: '08-15', name: 'Asunción de la Virgen' },
    { date: '10-12', name: 'Fiesta Nacional de España' },
    { date: '11-01', name: 'Todos los Santos' },
    { date: '12-06', name: 'Día de la Constitución Española' },
    { date: '12-08', name: 'Inmaculada Concepción' },
    { date: '12-25', name: 'Natividad del Señor' },
  ],
  'México': [
    { date: '01-01', name: 'Año Nuevo' },
    { date: '02-05', name: 'Día de la Constitución' },
    { date: '03-21', name: 'Natalicio de Benito Juárez' },
    { date: '05-01', name: 'Día del Trabajo' },
    { date: '09-16', name: 'Día de la Independencia' },
    { date: '11-20', name: 'Día de la Revolución' },
    { date: '12-25', name: 'Navidad' },
  ],
  'Argentina': [
    { date: '01-01', name: 'Año Nuevo' },
    { date: '03-24', name: 'Día de la Memoria' },
    { date: '04-02', name: 'Día del Veterano' },
    { date: '05-01', name: 'Día del Trabajador' },
    { date: '05-25', name: 'Revolución de Mayo' },
    { date: '07-09', name: 'Día de la Independencia' },
    { date: '12-08', name: 'Inmaculada Concepción' },
    { date: '12-25', name: 'Navidad' },
  ],
  'Colombia': [
    { date: '01-01', name: 'Año Nuevo' },
    { date: '05-01', name: 'Día del Trabajo' },
    { date: '07-20', name: 'Independencia' },
    { date: '08-07', name: 'Batalla de Boyacá' },
    { date: '12-08', name: 'Inmaculada Concepción' },
    { date: '12-25', name: 'Navidad' },
  ],
  'Chile': [
    { date: '01-01', name: 'Año Nuevo' },
    { date: '05-01', name: 'Día del Trabajo' },
    { date: '05-21', name: 'Día de las Glorias Navales' },
    { date: '09-18', name: 'Fiestas Patrias' },
    { date: '09-19', name: 'Glorias del Ejército' },
    { date: '12-25', name: 'Navidad' },
  ],
};

export const SPAIN_REGIONAL_HOLIDAYS: RegionalHolidays = {
  'Andalucía': [
    { date: '02-28', name: 'Día de Andalucía' },
    { date: '04-02', name: 'Jueves Santo' }
  ],
  'Aragón': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '04-23', name: 'San Jorge' }
  ],
  'Asturias': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '09-08', name: 'Día de Asturias' }
  ],
  'Baleares': [
    { date: '03-01', name: 'Día de las Islas Baleares' },
    { date: '04-02', name: 'Jueves Santo' },
    { date: '04-06', name: 'Lunes de Pascua' }
  ],
  'Canarias': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '05-30', name: 'Día de Canarias' }
  ],
  'Cantabria': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '07-28', name: 'Día de las Instituciones' }
  ],
  'Castilla-La Mancha': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '05-31', name: 'Día de Castilla-La Mancha' }
  ],
  'Castilla y León': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '04-23', name: 'Día de Castilla y León' }
  ],
  'Cataluña': [
    { date: '04-06', name: 'Lunes de Pascua' },
    { date: '06-24', name: 'San Juan' },
    { date: '09-11', name: 'Diada' }
  ],
  'Comunidad Valenciana': [
    { date: '03-19', name: 'San José' },
    { date: '04-06', name: 'Lunes de Pascua' },
    { date: '06-24', name: 'San Juan' },
    { date: '10-09', name: 'Día de la Comunitat' }
  ],
  'Extremadura': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '09-08', name: 'Día de Extremadura' }
  ],
  'Galicia': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '05-17', name: 'Día de las Letras Gallegas' }
  ],
  'Madrid': [
    { date: '03-19', name: 'San José' },
    { date: '04-02', name: 'Jueves Santo' },
    { date: '05-02', name: 'Día de la Comunidad de Madrid' }
  ],
  'Murcia': [
    { date: '03-19', name: 'San José' },
    { date: '04-02', name: 'Jueves Santo' },
    { date: '06-09', name: 'Día de la Región de Murcia' }
  ],
  'Navarra': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '04-06', name: 'Lunes de Pascua' },
    { date: '12-03', name: 'Día de Navarra' }
  ],
  'País Vasco': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '04-06', name: 'Lunes de Pascua' },
    { date: '10-25', name: 'Día del País Vasco' }
  ],
  'La Rioja': [
    { date: '04-02', name: 'Jueves Santo' },
    { date: '06-09', name: 'Día de La Rioja' }
  ],
};
