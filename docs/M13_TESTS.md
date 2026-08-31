# M13 — Cadastro Inteligente de Ativos

## Implementado

- OCR local no navegador com PaddleOCR.js / PP-OCRv5 em português;
- carregamento sob demanda;
- leitura de códigos de barras 1D/2D antes do OCR;
- revisão humana antes de aplicar dados;
- fabricante, modelo, serial, Service Tag, Product/Part Number e alimentação;
- foto da etiqueta preservada como evidência;
- histórico da leitura OCR;
- aquisição e garantia;
- nota fiscal compartilhável por vários ativos;
- foto/PDF da NF como evidência;
- posse/custódia;
- instituições externas;
- identificadores externos pesquisáveis;
- busca inteligente do patrimônio;
- resolução exata também por serial, Service Tag, Product Number e patrimônio externo.

## Macroteste antes do commit

1. OCR: abrir Novo Express, usar duas etiquetas reais, revisar os dados sugeridos e confirmar que o cadastro manual continua funcionando se o OCR falhar.
2. Evidência: criar um ativo com OCR e confirmar a foto original em Fotos e evidências.
3. Custódia: criar ativo cedido/emprestado, informar instituição e patrimônio externo; buscar depois por esse patrimônio.
4. Nota fiscal: cadastrar número, série, emitente, data e arquivo; localizar depois pelo número.
5. Busca inteligente: testar código WIS, serial, Service Tag, Product Number, patrimônio externo, nome/sigla da instituição e NF.
6. Garantia: definir aquisição e garantia e conferir na ficha.
7. Regressão M12: scanner, vínculos, código curto, etiquetas e PDF.

## Critério de aprovação

Somente fazer commit/deploy depois de:
- build OK;
- lint OK;
- migration M13 OK;
- OCR real OK;
- evidência OK;
- custódia/identificador externo OK;
- NF OK;
- busca inteligente OK;
- regressão M12 OK.
