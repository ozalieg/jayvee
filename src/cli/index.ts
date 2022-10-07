import chalk from 'chalk';
import { Command } from 'commander';
import { NodeFileSystem } from 'langium/node';

import { Model } from '../language-server/generated/ast';
import { OpenDataLanguageLanguageMetaData } from '../language-server/generated/module';
import { createOpenDataLanguageServices } from '../language-server/open-data-language-module';

import { extractAstNode } from './cli-util';
import { generateJavaScript } from './generator';

export const generateAction = async (
  fileName: string,
  opts: GenerateOptions,
): Promise<void> => {
  const services =
    createOpenDataLanguageServices(NodeFileSystem).OpenDataLanguage;
  const model = await extractAstNode<Model>(fileName, services);
  const generatedFilePath = generateJavaScript(
    model,
    fileName,
    opts.destination,
  );
  console.log(
    chalk.green(`JavaScript code generated successfully: ${generatedFilePath}`),
  );
};

export interface GenerateOptions {
  destination?: string;
}

export default function (): void {
  const program = new Command();

  const fileExtensions =
    OpenDataLanguageLanguageMetaData.fileExtensions.join(', ');
  program
    .command('generate')
    .argument(
      '<file>',
      `source file (possible file extensions: ${fileExtensions})`,
    )
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description(
      'generates JavaScript code that prints "Hello, {name}!" for each greeting in a source file',
    )
    .action(generateAction);

  program.parse(process.argv);
}
