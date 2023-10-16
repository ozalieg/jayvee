// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as path from 'path';

import * as R from '@jvalue/jayvee-execution';
import { getTestExecutionContext } from '@jvalue/jayvee-execution/test';
import { StdLangExtension } from '@jvalue/jayvee-extensions/std/lang';
import {
  BlockDefinition,
  IOType,
  createJayveeServices,
  useExtension,
} from '@jvalue/jayvee-language-server';
import {
  ParseHelperOptions,
  TestLangExtension,
  expectNoParserAndLexerErrors,
  parseHelper,
  readJvTestAssetHelper,
} from '@jvalue/jayvee-language-server/test';
import { AstNode, AstNodeLocator, LangiumDocument } from 'langium';
import { NodeFileSystem } from 'langium/node';

import { createBinaryFileFromLocalFile } from '../test';

import { TextFileInterpreterExecutor } from './text-file-interpreter-executor';

describe('Validation of TextFileInterpreterExecutor', () => {
  let parse: (
    input: string,
    options?: ParseHelperOptions,
  ) => Promise<LangiumDocument<AstNode>>;

  let locator: AstNodeLocator;

  const readJvTestAsset = readJvTestAssetHelper(
    __dirname,
    '../test/assets/text-file-interpreter-executor/',
  );

  function readTestFile(fileName: string): R.BinaryFile {
    const absoluteFileName = path.resolve(
      __dirname,
      '../test/assets/text-file-interpreter-executor/',
      fileName,
    );
    return createBinaryFileFromLocalFile(absoluteFileName);
  }

  async function parseAndExecuteExecutor(
    input: string,
    IOInput: R.BinaryFile,
  ): Promise<R.Result<R.TextFile>> {
    const document = await parse(input, { validationChecks: 'all' });
    expectNoParserAndLexerErrors(document);

    const block = locator.getAstNode<BlockDefinition>(
      document.parseResult.value,
      'pipelines@0/blocks@1',
    ) as BlockDefinition;

    return new TextFileInterpreterExecutor().doExecute(
      IOInput,
      getTestExecutionContext(locator, document, [block]),
    );
  }

  beforeAll(() => {
    // Register extensions
    useExtension(new StdLangExtension());
    useExtension(new TestLangExtension());
    // Create language services
    const services = createJayveeServices(NodeFileSystem).Jayvee;
    locator = services.workspace.AstNodeLocator;
    // Parse function for Jayvee (without validation)
    parse = parseHelper(services);
  });

  it('should diagnose no error on valid text file', async () => {
    const text = readJvTestAsset('valid-default-file-interpreter.jv');

    const testFile = readTestFile('test.txt');
    const result = await parseAndExecuteExecutor(text, testFile);

    expect(R.isErr(result)).toEqual(false);
    if (R.isOk(result)) {
      expect(result.right.ioType).toEqual(IOType.TEXT_FILE);
      expect(result.right.content).toEqual(
        expect.arrayContaining(['Multiline ', 'Test  File']),
      );
    }
  });

  it('should diagnose no error on non text file', async () => {
    const text = readJvTestAsset('valid-default-file-interpreter.jv');

    const testFile = readTestFile('gtfs-vehicle');
    const result = await parseAndExecuteExecutor(text, testFile);

    expect(R.isErr(result)).toEqual(false);
    if (R.isOk(result)) {
      expect(result.right.ioType).toEqual(IOType.TEXT_FILE);
      expect(result.right.content).toEqual(
        expect.arrayContaining(['vehicle:268435857"0']),
      );
    }
  });

  it('should diagnose no error on custom lineBreak', async () => {
    const text = readJvTestAsset('valid-custom-line-break.jv');

    const testFile = readTestFile('test.txt');
    const result = await parseAndExecuteExecutor(text, testFile);

    expect(R.isErr(result)).toEqual(false);
    if (R.isOk(result)) {
      expect(result.right.ioType).toEqual(IOType.TEXT_FILE);
      expect(result.right.content).toEqual(
        expect.arrayContaining(['Multiline \nTest', 'File\n']),
      );
    }
  });
});
