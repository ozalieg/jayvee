// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
  AstNode,
  MaybePromise,
  ValidationAcceptor,
  ValidationCheck,
  ValidationRegistry,
} from 'langium';

import {
  EvaluationContext,
  ExpressionEvaluatorRegistry,
  TypeComputerRegistry,
} from '../ast';
import {
  JayveeAstType,
  PipeDefinition,
  PipelineDefinition,
  PropertyBody,
} from '../ast/generated/ast';
import type { JayveeServices } from '../jayvee-module';
import { RuntimeParameterProvider } from '../services';

import { validateBlockDefinition } from './checks/block-definition';
import { validateBlocktypeDefinition } from './checks/blocktype-definition';
import { validateColumnId } from './checks/column-id';
import { validateCompositeBlockTypeDefinition } from './checks/composite-blocktype-definition';
import { validateExpressionConstraintDefinition } from './checks/expression-constraint-definition';
import { validateJayveeModel } from './checks/jayvee-model';
import { validatePipeDefinition } from './checks/pipe-definition';
import { validatePipelineDefinition } from './checks/pipeline-definition';
import { validatePropertyBody } from './checks/property-body';
import { validateRangeLiteral } from './checks/range-literal';
import { validateRegexLiteral } from './checks/regex-literal';
import { validateTransformBody } from './checks/transform-body';
import { validateTypedConstraintDefinition } from './checks/typed-constraint-definition';
import { validateValuetypeDefinition } from './checks/valuetype-definition';
import { validateValuetypeReference } from './checks/valuetype-reference';
import { ValidationContext } from './validation-context';

/**
 * Registry for validation checks.
 */
export class JayveeValidationRegistry extends ValidationRegistry {
  private readonly runtimeParameterProvider;
  private readonly typeComputerRegistry: TypeComputerRegistry;
  private readonly expressionEvaluatorRegistry: ExpressionEvaluatorRegistry;

  constructor(services: JayveeServices) {
    super(services);

    this.runtimeParameterProvider = services.RuntimeParameterProvider;
    this.typeComputerRegistry = services.operators.TypeComputerRegistry;
    this.expressionEvaluatorRegistry =
      services.operators.ExpressionEvaluatorRegistry;

    this.registerJayveeValidationChecks({
      BuiltinBlocktypeDefinition: validateBlocktypeDefinition,
      BlockDefinition: validateBlockDefinition,
      CompositeBlocktypeDefinition: validateCompositeBlockTypeDefinition,
      ColumnId: validateColumnId,
      TypedConstraintDefinition: validateTypedConstraintDefinition,
      ExpressionConstraintDefinition: validateExpressionConstraintDefinition,
      JayveeModel: validateJayveeModel,
      PipeDefinition: (model: PipeDefinition, context: ValidationContext) =>
        validatePipeDefinition(model, context, services.WrapperFactory),
      PipelineDefinition: (
        pipeline: PipelineDefinition,
        validationContext: ValidationContext,
      ) =>
        validatePipelineDefinition(
          pipeline,
          validationContext,
          services.WrapperFactory,
        ),
      PropertyBody: (
        propertyBody: PropertyBody,
        validationContext: ValidationContext,
        evaluationContext: EvaluationContext,
      ) =>
        validatePropertyBody(
          propertyBody,
          validationContext,
          evaluationContext,
          services.WrapperFactory,
        ),
      RangeLiteral: validateRangeLiteral,
      RegexLiteral: validateRegexLiteral,
      ValuetypeDefinition: validateValuetypeDefinition,
      ValuetypeReference: validateValuetypeReference,
      TransformBody: validateTransformBody,
    });
  }

  registerJayveeValidationChecks(checksRecord: JayveeValidationChecks) {
    for (const [type, check] of Object.entries(checksRecord)) {
      const wrappedCheck = this.wrapJayveeValidationCheck(
        check as JayveeValidationCheck,
        this.runtimeParameterProvider,
        this.typeComputerRegistry,
        this.expressionEvaluatorRegistry,
      );

      this.doRegister(type, this.wrapValidationException(wrappedCheck, this));
    }
  }

  private wrapJayveeValidationCheck<T extends AstNode = AstNode>(
    check: JayveeValidationCheck<T>,
    runtimeParameterProvider: RuntimeParameterProvider,
    typeComputerRegistry: TypeComputerRegistry,
    expressionEvaluatorRegistry: ExpressionEvaluatorRegistry,
  ): ValidationCheck<T> {
    return (node: T, accept: ValidationAcceptor): MaybePromise<void> => {
      const validationContext = new ValidationContext(
        accept,
        typeComputerRegistry,
      );
      const evaluationContext = new EvaluationContext(
        runtimeParameterProvider,
        expressionEvaluatorRegistry,
      );
      return check(node, validationContext, evaluationContext);
    };
  }
}

export type JayveeValidationChecks<T = JayveeAstType> = {
  [K in keyof T]?: T[K] extends AstNode ? JayveeValidationCheck<T[K]> : never;
} & {
  AstNode?: ValidationCheck<AstNode>;
};

export type JayveeValidationCheck<T extends AstNode = AstNode> = (
  node: T,
  validationContext: ValidationContext,
  evaluationContext: EvaluationContext,
) => MaybePromise<void>;
