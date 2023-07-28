// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import { IOType } from '../ast';
import { PrimitiveValuetypes } from '../ast/wrappers/value-type/primitive/primitive-valuetypes';
import {
  BlockMetaInformation,
  metaInformationRegistry,
} from '../meta-information';

import { PartialStdLib } from './generated/partial-stdlib';

export const BuiltinValuetypesLib = {
  'builtin:///stdlib/builtin-valuetypes.jv': Object.values(PrimitiveValuetypes)
    .map(
      (valueType) =>
        `${(valueType.getUserDoc()?.trim().split('\n') ?? [])
          .map((t) => '// ' + t)
          .join('\n')}
builtin valuetype ${valueType.getName()};`,
    )
    .join('\n\n'),
};

// Is a method since metaInformationRegistry might not be initialized when this as variable.
export function getBulitinBlocktypesLib() {
  return {
    'builtin:///stdlib/builtin-blocktypes.jv': metaInformationRegistry
      .getAllEntries()
      .reduce(
        (filtered: { key: string; value: BlockMetaInformation }[], entry) => {
          if (entry.value instanceof BlockMetaInformation) {
            filtered.push({ key: entry.key, value: entry.value });
          }
          return filtered;
        },
        [],
      )
      .map((entry) => parseMetaInfToJayvee(entry.key, entry.value))
      .join('\n\n'),
  };
}

export function getStdLib() {
  return {
    ...PartialStdLib,
    ...BuiltinValuetypesLib,
    ...getBulitinBlocktypesLib(),
  };
}

function parseMetaInfToJayvee(
  name: string,
  metaInf: BlockMetaInformation,
): string {
  const lines: string[] = [];
  if (metaInf.docs.description !== undefined) {
    lines.push(parseAsComment(metaInf.docs.description));
  }
  if (metaInf.docs.examples !== undefined) {
    metaInf.docs.examples.forEach((example, i) => {
      lines.push('//');
      lines.push(`// Example ${i + 1}: ${example.description}`);
      lines.push(parseAsComment(example.code));
    });
  }

  lines.push(`builtin blocktype ${name} {`);
  lines.push(praseBuiltinBlocktypeBody(metaInf));
  lines.push('}');

  return lines.join('\n');
}

function praseBuiltinBlocktypeBody(metaInf: BlockMetaInformation): string {
  const bodyLines: string[] = [];

  if (metaInf.inputType !== IOType.NONE) {
    bodyLines.push(`\tinput default oftype ${metaInf.inputType};`);
  }
  if (metaInf.outputType !== IOType.NONE) {
    bodyLines.push(`\toutput default oftype ${metaInf.outputType};`);
  }
  bodyLines.push('\t');

  Object.entries(metaInf.getPropertySpecifications()).forEach(
    ([propName, propSpecification]) => {
      const propDoc = propSpecification.docs?.description;
      if (propDoc !== undefined) {
        bodyLines.push(parseAsComment(propDoc, 1));
      }
      bodyLines.push(
        `\tproperty ${propName} oftype ${propSpecification.type.getName()};`,
      );
    },
  );

  return bodyLines.join('\n');
}

function parseAsComment(text: string, indents = 0) {
  return text
    .split('\n')
    .map((l) => `// ${l}`)
    .map((l) => '\t'.repeat(indents) + l)
    .join('\n');
}
