// SPDX-FileCopyrightText: 2024 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as fsPromise from 'node:fs/promises';
import path from 'node:path';

import * as R from '@jvalue/jayvee-execution';
import {
  constructTable,
  getTestExecutionContext,
} from '@jvalue/jayvee-execution/test';
import {
  type BlockDefinition,
  IOType,
  type JayveeServices,
  createJayveeServices,
} from '@jvalue/jayvee-language-server';
import {
  type ParseHelperOptions,
  expectNoParserAndLexerErrors,
  loadTestExtensions,
  parseHelper,
  readJvTestAssetHelper,
} from '@jvalue/jayvee-language-server/test';
import {
  type AstNode,
  type AstNodeLocator,
  type LangiumDocument,
} from 'langium';
import { NodeFileSystem } from 'langium/node';
import { vol } from 'memfs';
import { vi } from 'vitest';

import { CSVFileLoaderExecutor } from './csv-file-loader-executor';

describe('Validation of CSVFileLoaderExecutor', () => {
  let parse: (
    input: string,
    options?: ParseHelperOptions,
  ) => Promise<LangiumDocument<AstNode>>;

  let locator: AstNodeLocator;
  let services: JayveeServices;

  const readJvTestAsset = readJvTestAssetHelper(
    __dirname,
    '../../test/assets/csv-file-loader-executor/',
  );

  async function parseAndExecuteExecutor(
    input: string,
    IOInput: R.Table,
  ): Promise<R.Result<R.None>> {
    const document = await parse(input, { validation: true });
    expectNoParserAndLexerErrors(document);

    const block = locator.getAstNode<BlockDefinition>(
      document.parseResult.value,
      'pipelines@0/blocks@1',
    ) as BlockDefinition;

    return new CSVFileLoaderExecutor().doExecute(
      IOInput,
      getTestExecutionContext(locator, document, services, [block]),
    );
  }

  beforeAll(async () => {
    // Create language services
    services = createJayveeServices(NodeFileSystem).Jayvee;
    await loadTestExtensions(services, [
      path.resolve(__dirname, '../../test/test-extension/TestBlockTypes.jv'),
    ]);
    locator = services.workspace.AstNodeLocator;
    // Parse function for Jayvee (without validation)
    parse = parseHelper(services);
  });
  beforeEach(() => {
    // NOTE: The virtual filesystem is reset before each test
    vol.reset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should diagnose no error on valid loader config', async () => {
    const text = readJvTestAsset('valid-csv-file-loader.jv');

    const inputTable = constructTable(
      [
        {
          columnName: 'Column1',
          column: {
            values: ['value 1'],
            valueType: services.ValueTypeProvider.Primitives.Text,
          },
        },
        {
          columnName: 'Column2',
          column: {
            values: [20.2],
            valueType: services.ValueTypeProvider.Primitives.Decimal,
          },
        },
      ],
      1,
    );
    const result = await parseAndExecuteExecutor(text, inputTable);

    expect(R.isErr(result)).toEqual(false);
    if (R.isOk(result)) {
      expect(result.right.ioType).toEqual(IOType.NONE);
      const expectedOutput = `Column1,Column2
value 1,20.2`;
      const actualOutput = await fsPromise.readFile('test.csv');
      expect(actualOutput.toString()).toEqual(expectedOutput);
    }
  });
});
