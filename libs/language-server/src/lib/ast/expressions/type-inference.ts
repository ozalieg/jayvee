// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import { assertUnreachable } from 'langium';

import { ValidationContext } from '../../validation/validation-context';
import {
  Expression,
  ExpressionLiteral,
  isBinaryExpression,
  isBooleanLiteral,
  isExpressionLiteral,
  isNumericLiteral,
  isTextLiteral,
  isUnaryExpression,
} from '../generated/ast';
// eslint-disable-next-line import/no-cycle
import { PropertyValuetype } from '../model-util';

import {
  binaryOperatorRegistry,
  unaryOperatorRegistry,
} from './operator-registry';

export function inferExpressionType(
  expression: Expression | undefined,
  context: ValidationContext | undefined,
): PropertyValuetype | undefined {
  if (expression === undefined) {
    return undefined;
  }
  if (isExpressionLiteral(expression)) {
    return inferTypeFromExpressionLiteral(expression);
  }
  if (isUnaryExpression(expression)) {
    const innerType = inferExpressionType(expression.expression, context);
    if (innerType === undefined) {
      return undefined;
    }

    const operator = expression.operator;
    const typeInferenceFn = unaryOperatorRegistry[operator].typeInference;
    return typeInferenceFn(innerType, expression, context);
  }
  if (isBinaryExpression(expression)) {
    const leftType = inferExpressionType(expression.left, context);
    const rightType = inferExpressionType(expression.right, context);
    if (leftType === undefined || rightType === undefined) {
      return undefined;
    }

    const operator = expression.operator;
    const typeInferenceFn = binaryOperatorRegistry[operator].typeInference;
    return typeInferenceFn(leftType, rightType, expression, context);
  }
  assertUnreachable(expression);
}

function inferTypeFromExpressionLiteral(
  expression: ExpressionLiteral,
): PropertyValuetype {
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
  assertUnreachable(expression);
}
