export class RegSunResponseComprobanteSunat {
  success!: boolean;
  message!: string;
  data!: DataComprobante;
  errorCode!: string;
}

export class DataComprobante {
  estadoCp!: string;
  estadoRuc!: string;
  condDomiRuc!: string;
  observaciones: any[] = [];
}