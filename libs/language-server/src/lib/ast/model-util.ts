// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import { strict as assert } from 'assert';

import { AstNode, assertUnreachable } from 'langium';

// eslint-disable-next-line import/no-cycle
import { getMetaInformation } from '../meta-information/meta-inf-registry';
// eslint-disable-next-line import/no-cycle
import { ValidationContext } from '../validation';

import {
  BinaryExpression,
  BlockDefinition,
  Expression,
  PipelineDefinition,
  PrimitiveValuetypeKeywordLiteral,
  PropertyValueLiteral,
  UnaryExpression,
  ValuetypeDefinitionReference,
  isBinaryExpression,
  isBooleanLiteral,
  isCellRangeLiteral,
  isCollectionLiteral,
  isConstraintReferenceLiteral,
  isExpression,
  isExpressionLiteral,
  isNumericLiteral,
  isRegexLiteral,
  isTextLiteral,
  isUnaryExpression,
  isValuetypeAssignmentLiteral,
  isValuetypeDefinitionReference,
} from './generated/ast';
import { PipeWrapper, createSemanticPipes } from './wrappers/pipe-wrapper';

export function collectStartingBlocks(
  pipeline: PipelineDefinition,
): BlockDefinition[] {
  const result: BlockDefinition[] = [];
  for (const block of pipeline.blocks) {
    const blockMetaInf = getMetaInformation(block.type);
    if (blockMetaInf === undefined) {
      continue;
    }

    if (!blockMetaInf.hasInput()) {
      result.push(block);
    }
  }
  return result;
}

export function collectChildren(block: BlockDefinition): BlockDefinition[] {
  const outgoingPipes = collectOutgoingPipes(block);
  return outgoingPipes.map((pipe) => pipe.to);
}

export function collectParents(block: BlockDefinition): BlockDefinition[] {
  const ingoingPipes = collectIngoingPipes(block);
  return ingoingPipes.map((pipe) => pipe.from);
}

export function collectOutgoingPipes(block: BlockDefinition) {
  return collectPipes(block, 'outgoing');
}

export function collectIngoingPipes(block: BlockDefinition) {
  return collectPipes(block, 'ingoing');
}

function collectPipes(
  block: BlockDefinition,
  kind: 'outgoing' | 'ingoing',
): PipeWrapper[] {
  const pipeline = block.$container;
  const allPipes = collectAllPipes(pipeline);

  return allPipes.filter((semanticPipe) => {
    switch (kind) {
      case 'outgoing':
        return semanticPipe.from === block;
      case 'ingoing':
        return semanticPipe.to === block;
    }
    return assertUnreachable(kind);
  });
}

export function collectAllPipes(pipeline: PipelineDefinition): PipeWrapper[] {
  const result: PipeWrapper[] = [];
  for (const pipe of pipeline.pipes) {
    result.push(...createSemanticPipes(pipe));
  }
  return result;
}

/**
 * Returns blocks in a pipeline in topological order, based on
 * Kahn's algorithm.
 *
 * Considers a pipeline as a directed, acyclical graph where
 * blocks are nodes and pipes are edges. A list in topological
 * order has the property that parent nodes are always listed
 * before their children.
 *
 * "[...] a list in topological order is such that no element
 * appears in it until after all elements appearing on all paths
 * leading to the particular element have been listed."
 *
 * Kahn, A. B. (1962). Topological sorting of large networks. Communications of the ACM, 5(11), 558–562.
 */
export function getBlocksInTopologicalSorting(
  pipeline: PipelineDefinition,
): BlockDefinition[] {
  const sortedNodes = [];
  const currentNodes = [...collectStartingBlocks(pipeline)];
  let unvisitedEdges = [...collectAllPipes(pipeline)];

  while (currentNodes.length > 0) {
    const node = currentNodes.pop();
    assert(node !== undefined);

    sortedNodes.push(node);

    for (const childNode of collectChildren(node)) {
      // Mark edges between parent and child as visited
      collectIngoingPipes(childNode)
        .filter((e) => e.from === node)
        .forEach((e) => {
          unvisitedEdges = unvisitedEdges.filter((edge) => !edge.equals(e));
        });

      // If all edges to the child have been visited
      const notRemovedEdges = collectIngoingPipes(childNode).filter((e) =>
        unvisitedEdges.some((edge) => edge.equals(e)),
      );
      if (notRemovedEdges.length === 0) {
        // Insert it into currentBlocks
        currentNodes.push(childNode);
      }
    }
  }

  // If the graph still contains unvisited edges it is not a DAG
  assert(
    unvisitedEdges.length === 0,
    `The pipeline ${pipeline.name} is expected to have no cycles`,
  );

  return sortedNodes;
}

export enum IOType {
  NONE = 'None',
  FILE = 'File',
  TEXT_FILE = 'TextFile',
  FILE_SYSTEM = 'FileSystem',
  SHEET = 'Sheet',
  TABLE = 'Table',
}

export enum PropertyValuetype {
  TEXT = 'text',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  CELL_RANGE = 'cell-range',
  REGEX = 'regex',
  COLLECTION = 'collection',
  VALUETYPE_ASSIGNMENT = 'valuetype-assignment',
  CONSTRAINT = 'constraint',
}

export function runtimeParameterAllowedForType(
  type: PropertyValuetype,
): boolean {
  switch (type) {
    case PropertyValuetype.CELL_RANGE:
    case PropertyValuetype.REGEX:
    case PropertyValuetype.VALUETYPE_ASSIGNMENT:
    case PropertyValuetype.COLLECTION:
    case PropertyValuetype.CONSTRAINT:
      return false;
    case PropertyValuetype.TEXT:
    case PropertyValuetype.INTEGER:
    case PropertyValuetype.DECIMAL:
    case PropertyValuetype.BOOLEAN:
      return true;
    default:
      assertUnreachable(type);
  }
}

export function isNumericType(type: PropertyValuetype): boolean {
  return (
    type === PropertyValuetype.INTEGER || type === PropertyValuetype.DECIMAL
  );
}

export function inferTypeFromValue(
  value: PropertyValueLiteral,
  context?: ValidationContext,
): PropertyValuetype | undefined {
  if (isCollectionLiteral(value)) {
    return PropertyValuetype.COLLECTION;
  }
  if (isCellRangeLiteral(value)) {
    return PropertyValuetype.CELL_RANGE;
  }
  if (isRegexLiteral(value)) {
    return PropertyValuetype.REGEX;
  }
  if (isValuetypeAssignmentLiteral(value)) {
    return PropertyValuetype.VALUETYPE_ASSIGNMENT;
  }
  if (isConstraintReferenceLiteral(value)) {
    return PropertyValuetype.CONSTRAINT;
  }
  if (isExpression(value)) {
    return inferTypeFromExpression(value, context);
  }
  assertUnreachable(value);
}

function inferTypeFromExpression(
  expression: Expression,
  context: ValidationContext | undefined,
): PropertyValuetype | undefined {
  if (isTextLiteral(expression)) {
    return PropertyValuetype.TEXT;
  }
  if (isBooleanLiteral(expression)) {
    return PropertyValuetype.BOOLEAN;
  }
  if (isNumericLiteral(expression)) {
    if (Number.isInteger(expression.value)) {
      return PropertyValuetype.INTEGER;
    }
    return PropertyValuetype.DECIMAL;
  }
  if (isUnaryExpression(expression)) {
    const unaryOperator = expression.operator;
    switch (unaryOperator) {
      case 'not':
        return inferTypeFromUnaryLogicalExpression(expression, context);
      default:
        assertUnreachable(unaryOperator);
    }
  }
  if (isBinaryExpression(expression)) {
    const binaryOperator = expression.operator;
    switch (binaryOperator) {
      case '==':
      case '!=':
        return inferTypeFromBinaryEqualityExpression(expression, context);
      case '<':
      case '<=':
      case '>':
      case '>=':
        return inferTypeFromBinaryRelationalExpression(expression, context);
      case 'xor':
      case 'and':
      case 'or':
        return inferTypeFromBinaryLogicalExpression(expression, context);
      default:
        assertUnreachable(binaryOperator);
    }
  }
  assertUnreachable(expression);
}

function inferTypeFromUnaryLogicalExpression(
  expression: UnaryExpression,
  context: ValidationContext | undefined,
): PropertyValuetype | undefined {
  const innerType = inferTypeFromExpression(expression.expression, context);
  if (innerType === undefined) {
    return undefined;
  }
  if (innerType !== PropertyValuetype.BOOLEAN) {
    context?.accept(
      'error',
      `The operand needs to be of type ${PropertyValuetype.BOOLEAN} but is of type ${innerType}`,
      {
        node: expression.expression,
      },
    );
    return undefined;
  }
  return PropertyValuetype.BOOLEAN;
}

function inferTypeFromBinaryEqualityExpression(
  expression: BinaryExpression,
  context: ValidationContext | undefined,
): PropertyValuetype | undefined {
  assert(expression.operator === '==' || expression.operator === '!=');

  const leftType = inferTypeFromExpression(expression.left, context);
  const rightType = inferTypeFromExpression(expression.right, context);
  if (leftType === undefined || rightType === undefined) {
    return undefined;
  }
  if (leftType !== rightType) {
    if (isNumericType(leftType) && isNumericType(rightType)) {
      context?.accept(
        'warning',
        `The operands are of different numeric types (left: ${leftType}, right: ${rightType})`,
        {
          node: expression,
        },
      );
    } else {
      context?.accept(
        'error',
        `The types of the operands need to be equal but they differ (left: ${leftType}, right: ${rightType})`,
        { node: expression },
      );
      return undefined;
    }
  }

  return PropertyValuetype.BOOLEAN;
}

function inferTypeFromBinaryRelationalExpression(
  expression: BinaryExpression,
  context: ValidationContext | undefined,
): PropertyValuetype | undefined {
  assert(
    expression.operator === '<' ||
      expression.operator === '<=' ||
      expression.operator === '>' ||
      expression.operator === '>=',
  );

  const leftType = inferTypeFromExpression(expression.left, context);
  const rightType = inferTypeFromExpression(expression.right, context);
  if (leftType === undefined || rightType === undefined) {
    return undefined;
  }
  if (!isNumericType(leftType)) {
    context?.accept(
      'error',
      `The operand needs to be of type ${PropertyValuetype.DECIMAL} or ${PropertyValuetype.INTEGER} but is of type ${leftType}`,
      {
        node: expression.left,
      },
    );
    return undefined;
  }
  if (!isNumericType(rightType)) {
    context?.accept(
      'error',
      `The operand needs to be of type ${PropertyValuetype.DECIMAL} or ${PropertyValuetype.INTEGER} but is of type ${rightType}`,
      {
        node: expression.right,
      },
    );
    return undefined;
  }
  if (leftType !== rightType) {
    context?.accept(
      'warning',
      `The operands are of different numeric types (left: ${leftType}, right: ${rightType})`,
      {
        node: expression,
      },
    );
  }
  return PropertyValuetype.BOOLEAN;
}

function inferTypeFromBinaryLogicalExpression(
  expression: BinaryExpression,
  context: ValidationContext | undefined,
): PropertyValuetype | undefined {
  assert(
    expression.operator === 'xor' ||
      expression.operator === 'and' ||
      expression.operator === 'or',
  );

  const leftType = inferTypeFromExpression(expression.left, context);
  const rightType = inferTypeFromExpression(expression.right, context);
  if (leftType === undefined || rightType === undefined) {
    return undefined;
  }
  if (
    leftType !== PropertyValuetype.BOOLEAN ||
    rightType !== PropertyValuetype.BOOLEAN
  ) {
    if (leftType !== PropertyValuetype.BOOLEAN) {
      context?.accept(
        'error',
        `The operand needs to be of type ${PropertyValuetype.BOOLEAN} but is of type ${leftType}`,
        {
          node: expression.left,
        },
      );
    }
    if (rightType !== PropertyValuetype.BOOLEAN) {
      context?.accept(
        'error',
        `The operand needs to be of type ${PropertyValuetype.BOOLEAN} but is of type ${rightType}`,
        {
          node: expression.right,
        },
      );
    }
    return undefined;
  }
  return PropertyValuetype.BOOLEAN;
}

export function evaluateExpression(
  expression: Expression,
): boolean | number | string {
  if (isExpressionLiteral(expression)) {
    return expression.value;
  }
  if (isUnaryExpression(expression)) {
    const unaryOperator = expression.operator;
    switch (unaryOperator) {
      case 'not': {
        const innerValue = evaluateExpression(expression.expression);
        assert(typeof innerValue === 'boolean');
        return !innerValue;
      }
      default:
        assertUnreachable(unaryOperator);
    }
  }
  if (isBinaryExpression(expression)) {
    const binaryOperator = expression.operator;
    switch (binaryOperator) {
      case '==': {
        const leftValue = evaluateExpression(expression.left);
        const rightValue = evaluateExpression(expression.right);
        assert(typeof leftValue === typeof rightValue);
        return leftValue === rightValue;
      }
      case '!=': {
        const leftValue = evaluateExpression(expression.left);
        const rightValue = evaluateExpression(expression.right);
        assert(typeof leftValue === typeof rightValue);
        return leftValue !== rightValue;
      }
      case '<': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'number');
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'number');
        return leftValue < rightValue;
      }
      case '<=': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'number');
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'number');
        return leftValue <= rightValue;
      }
      case '>': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'number');
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'number');
        return leftValue > rightValue;
      }
      case '>=': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'number');
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'number');
        return leftValue >= rightValue;
      }
      case 'xor': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'boolean');
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'boolean');
        return (leftValue && !rightValue) || (!leftValue && rightValue);
      }
      case 'and': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'boolean');
        if (!leftValue) {
          return false;
        }
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'boolean');
        return rightValue;
      }
      case 'or': {
        const leftValue = evaluateExpression(expression.left);
        assert(typeof leftValue === 'boolean');
        if (leftValue) {
          return true;
        }
        const rightValue = evaluateExpression(expression.right);
        assert(typeof rightValue === 'boolean');
        return rightValue;
      }
      default:
        assertUnreachable(binaryOperator);
    }
  }
  assertUnreachable(expression);
}

export function getValuetypeName(
  valuetype: PrimitiveValuetypeKeywordLiteral | ValuetypeDefinitionReference,
): string {
  if (isValuetypeDefinitionReference(valuetype)) {
    return valuetype.reference.$refText;
  }
  return valuetype.keyword;
}

export type AstTypeGuard<T extends AstNode = AstNode> = (
  obj: unknown,
) => obj is T;
