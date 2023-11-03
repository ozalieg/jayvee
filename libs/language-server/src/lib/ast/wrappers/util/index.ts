// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import { Reference, assertUnreachable, isReference } from 'langium';

import {
  BuiltinConstrainttypeDefinition,
  ReferenceableBlocktypeDefinition,
  isBuiltinConstrainttypeDefinition,
  isReferenceableBlocktypeDefinition,
} from '../../generated/ast';
// eslint-disable-next-line import/no-cycle
import { BlockMetaInformation } from '../block-meta-inf';
import { ConstraintMetaInformation } from '../constraint-meta-inf';

export * from './column-id-util';

/**
 * Creates a MetaInformation wrapper object based on the given type reference.
 */
export function getMetaInformation(
  typeRef:
    | Reference<ReferenceableBlocktypeDefinition>
    | Reference<BuiltinConstrainttypeDefinition>
    | BuiltinConstrainttypeDefinition
    | ReferenceableBlocktypeDefinition
    | undefined,
): BlockMetaInformation | ConstraintMetaInformation | undefined {
  const type = isReference(typeRef) ? typeRef.ref : typeRef;
  if (type === undefined) {
    return undefined;
  }

  if (isReferenceableBlocktypeDefinition(type)) {
    if (!BlockMetaInformation.canBeWrapped(type)) {
      return undefined;
    }
    return new BlockMetaInformation(type);
  } else if (isBuiltinConstrainttypeDefinition(type)) {
    if (!ConstraintMetaInformation.canBeWrapped(type)) {
      return undefined;
    }
    return new ConstraintMetaInformation(type);
  }
  assertUnreachable(type);
}
