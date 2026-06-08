// Conversión de unidades de concentración entre lo que entrega OpenAQ y la
// unidad del catálogo del proyecto (µg/m³ para MP y gases, mg/m³ para CO).
//
// - Másico <-> másico (µg/m³ <-> mg/m³): factor 1000.
// - Volumétrico -> másico (ppm/ppb -> µg/m³): requiere el peso molecular del gas
//   y el volumen molar a 25 °C, 1 atm (24,45 L/mol).
//   µg/m³ = ppb · (PM / 24,45)
//
// Devuelve null cuando no hay forma de convertir (unidades desconocidas o un gas
// volumétrico sin peso molecular conocido): en ese caso el dato NO se guarda.

const VOLUMEN_MOLAR = 24.45; // L/mol a 25 °C y 1 atm

// Peso molecular (g/mol) de los gases que medimos.
const PESO_MOLECULAR: Record<string, number> = {
  CO: 28.01,
  O3: 48.0,
  NO2: 46.01,
  SO2: 64.07,
};

export function normalizarUnidad(u: string | null | undefined): string {
  if (!u) return '';
  return u
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/[µμ]/g, 'u') // micro (U+00B5) y mu griega (U+03BC)
    .replace(/³/g, '3');
}

function aMicrogramos(valor: number, unidad: string, codigo: string): number | null {
  switch (unidad) {
    case 'ug/m3':
      return valor;
    case 'mg/m3':
      return valor * 1000;
    case 'ppb': {
      const pm = PESO_MOLECULAR[codigo];
      return pm ? valor * (pm / VOLUMEN_MOLAR) : null;
    }
    case 'ppm': {
      const pm = PESO_MOLECULAR[codigo];
      return pm ? valor * 1000 * (pm / VOLUMEN_MOLAR) : null;
    }
    default:
      return null;
  }
}

// Convierte `valor` desde la unidad de OpenAQ a la unidad de catálogo `hacia`,
// para el contaminante `codigo`. null = no convertible (no se debe almacenar).
export function convertir(
  valor: number,
  desde: string | null | undefined,
  hacia: string,
  codigo: string,
): number | null {
  const origen = normalizarUnidad(desde);
  const destino = normalizarUnidad(hacia);
  if (!destino) return null;
  if (!origen || origen === destino) return redondear(valor); // sin unidad de origen: se asume ya en destino

  const ug = aMicrogramos(valor, origen, codigo);
  if (ug == null) return null;
  if (destino === 'ug/m3') return redondear(ug);
  if (destino === 'mg/m3') return redondear(ug / 1000);
  return null; // destino volumétrico no aplica (el catálogo es másico)
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
