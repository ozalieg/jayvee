// SPDX-FileCopyrightText: 2023 Friedrich-Alexander-Universitat Erlangen-Nurnberg
//
// SPDX-License-Identifier: AGPL-3.0-only

import { IOType } from '@jvalue/jayvee-language-server';

import { FileSystemFile } from './filesystem-node-file';
import { IOTypeImplementation } from './io-type-implementation';

export class BinaryFile
  extends FileSystemFile<ArrayBuffer>
  implements IOTypeImplementation<IOType.FILE>
{
  public readonly ioType = IOType.FILE;

  override getNodeSize(): number {
    return this.content.byteLength;
  }
}
