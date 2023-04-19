// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * See the FAQ section of README.md for an explanation why the following ESLint rule is disabled for this file.
 */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { assertUnreachable } from 'langium';

import {
  BlockDefinition,
  collectIngoingPipes,
  collectOutgoingPipes,
} from '../../ast';
import { PipeWrapper } from '../../ast/wrappers/pipe-wrapper';
import {
  getMetaInformation,
  getOrFailMetaInformation,
} from '../../meta-information/meta-inf-registry';
import { ValidationContext } from '../validation-context';

export function validateBlockDefinition(
  block: BlockDefinition,
  context: ValidationContext,
): void {
  checkBlockType(block, context);
  if (context.hasErrorOccurred()) {
    return;
  }

  checkPipesOfBlock(block, 'input', context);
  checkPipesOfBlock(block, 'output', context);
}

function checkBlockType(
  block: BlockDefinition,
  context: ValidationContext,
): void {
  if (block.type === undefined) {
    return;
  }
  const metaInf = getMetaInformation(block.type);
  if (metaInf === undefined) {
    context.accept('error', `Unknown block type '${block?.type?.name ?? ''}'`, {
      node: block,
      property: 'type',
    });
  }
}

function checkPipesOfBlock(
  block: BlockDefinition,
  whatToCheck: 'input' | 'output',
  context: ValidationContext,
): void {
  const blockMetaInf = getOrFailMetaInformation(block.type);

  let pipes: PipeWrapper[];
  switch (whatToCheck) {
    case 'input': {
      pipes = collectIngoingPipes(block);
      break;
    }
    case 'output': {
      pipes = collectOutgoingPipes(block);
      break;
    }
    default: {
      assertUnreachable(whatToCheck);
    }
  }

  if (
    (whatToCheck === 'input' && !blockMetaInf.hasInput()) ||
    (whatToCheck === 'output' && !blockMetaInf.hasOutput())
  ) {
    for (const pipe of pipes) {
      context.accept(
        'error',
        `Blocks of type ${blockMetaInf.type} do not have an ${whatToCheck}`,
        whatToCheck === 'input'
          ? pipe.getToDiagnostic()
          : pipe.getFromDiagnostic(),
      );
    }
  } else if (pipes.length > 1 && whatToCheck === 'input') {
    for (const pipe of pipes) {
      context.accept(
        'error',
        `At most one pipe can be connected to the ${whatToCheck} of a ${blockMetaInf.type}`,
        pipe.getToDiagnostic(),
      );
    }
  } else if (pipes.length === 0) {
    context.accept(
      'warning',
      `A pipe should be connected to the ${whatToCheck} of this block`,
      {
        node: block,
        property: 'name',
      },
    );
  }
}
