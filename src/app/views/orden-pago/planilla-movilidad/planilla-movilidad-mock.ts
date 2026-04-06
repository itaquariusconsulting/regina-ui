// src/app/mocks/orden-pago-planilla-movilidad.mock.ts

import { OrdenPagoPlanillaMovilidadDet } from "../../../models/orden-pago-planilla-movilidad-det";

export const MOCK_PLANILLA_MOVILIDAD: OrdenPagoPlanillaMovilidadDet[] = [
    ...Array.from({ length: 20 }, (_, i) => ({
        codEmpresa: '0001',
        codSucursal: '001',
        anioPeriodo: '2026',
        codPeriodo: '12',
        numOrden: '000016172',

        codPlanilla: 'PL' + String(i + 1).padStart(3, '0'),
        numItem: String(i + 1),

        fecItemPlanilla: randomDate(),
        codDocumento: randomFrom(['FC', 'RH', 'BV']),
        numDocumento: 'DOC' + Math.floor(Math.random() * 100000),

        codAuxiliarProveedor: randomFrom(['YANGO', 'UBER', 'CABIFY', 'INDRIVE', 'SATELITAL']),
        codOrigen: randomFrom(['LIMA', 'CALLAO', 'SURCO', 'MIRAFLORES']),
        codDestino: randomFrom(['SAN ISIDRO', 'LA MOLINA', 'SJL', 'BARRANCO']),

        observaciones: 'Movilidad ' + (i + 1),

        codMoneda: randomFrom(['PEN', 'USD']),
        importe: randomMoney(),
        impDolares: randomMoney(),
        tipCambio: +(3.5 + Math.random()).toFixed(3),
        cantPersonas: Math.floor(Math.random() * 5) + 1
    }))
];

// helpers
function randomFrom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomMoney(): number {
    return +(Math.random() * 500).toFixed(2);
}

function randomDate(): Date {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 11, 31);
    const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return d;
}