import assert from 'node:assert/strict';
import { buildAssetPrefill } from '../src/features/ocr-intelligence';

function validateCommon(result: ReturnType<typeof buildAssetPrefill>) {
  assert.equal(result.manufacturer, 'Login');
  assert.equal(result.model, 'L500');
  assert.equal(result.serialNumber, '1808993');

  assert.equal(result.processor?.manufacturer, 'AMD');
  assert.equal(result.processor?.model, 'AMD RYZEN 5 5600G');

  assert.equal(result.memory?.totalGb, 16);
  assert.equal(result.memory?.type, 'DDR4');
  assert.equal(result.memory?.speedMhz, 3200);

  assert.equal(result.storage?.capacityGb, 256);
  assert.equal(result.storage?.type, 'SSD');
  assert.equal(result.storage?.interface, 'NVMe');
  assert.equal(result.storage?.formFactor, 'M.2 2280');

  assert.equal(result.motherboard?.manufacturer, 'Login');
  assert.equal(result.motherboard?.model, 'LOG-A520 LN300');

  assert.equal(result.operatingSystem, 'Windows 11 Pro');
  assert.equal(result.wifi?.manufacturer, 'Intel');
  assert.equal(result.wifi?.model, '3168');

  assert.equal(result.observations, undefined);
}

const labeled = `
Desktop
Fabricante: Login
Modelo: L500
N\u00famero de s\u00e9rie: 1808993
[ESPECIFICA\u00c7\u00d5ES OCR]
Processador: AMD RYZEN 5 5600G
Mem\u00f3ria: 16GB DDR4 3200MHZ
Armazenamento: SSD 256 GB NVMe M.2 2280
Placa-m\u00e3e: LOGIN LOG-A520 LN300
Sistema operacional: MS WINDOWS 11 PRO
Rede/Wi-Fi: M.2 INTEL 3168
[/ESPECIFICA\u00c7\u00d5ES OCR]
`;

const compact = `
Desktop
LOGIN L500
SN 1808993
Processador AMD RYZEN 5 5600G
Memoria 16GB DDR4 3200MHZ
SSD 256 GB NVMe M.2 2280
Placa-mae LOGIN LOG-A520 LN300
Sistema operacional MS WINDOWS 11 PRO
Rede/Wi-Fi M.2 INTEL 3168
`;

const alternateSerialLabels = [
  'Numero de serie: 1808993',
  'N\u00famero de s\u00e9rie: 1808993',
  'Serial Number: 1808993',
  'Serial: 1808993',
  'SN: 1808993',
  'S/N: 1808993',
];

const labeledResult = buildAssetPrefill(labeled, 'desktop');
validateCommon(labeledResult);

const compactResult = buildAssetPrefill(compact, 'desktop');
validateCommon(compactResult);

for (const serialLine of alternateSerialLabels) {
  const result = buildAssetPrefill(serialLine, 'desktop');
  assert.equal(
    result.serialNumber,
    '1808993',
    `Falha ao interpretar serial em: ${serialLine}`,
  );
}

console.log('');
console.log('=== OCR INTELLIGENCE - RESULTADO ===');
console.log(JSON.stringify(compactResult, null, 2));
console.log('');
console.log('OK: Login L500 interpretado com campos estruturados.');
console.log('OK: Serial reconhecido com e sem acentos e em formatos alternativos.');
console.log('OK: CPU, RAM, armazenamento, placa-mae, SO e Wi-Fi nao foram enviados para Observacoes.');

