import * as R from '@jvalue/jayvee-execution';
import {
  AbstractBlockExecutor,
  type BlockExecutorClass,
  type ExecutionContext,
  implementsStatic, IOTypeImplementation,
} from '@jvalue/jayvee-execution';
import { IOType } from '@jvalue/jayvee-language-server';
import {None} from "fp-ts/Option";

@implementsStatic<BlockExecutorClass>()
export class TimeMeasurementExecutor extends AbstractBlockExecutor<
    IOType.NONE,
    IOType.NONE
> {
  public static readonly type = 'TimeMeasurement';

  constructor() {
    super(IOType.NONE, IOType.NONE);
  }

  protected async doExecute(input: IOTypeImplementation<IOType.NONE>, context: ExecutionContext): Promise<R.Result<IOTypeImplementation<IOType.NONE> | null>> {

    const blockType = context.getPropertyValue(
        'blockType',
        context.valueTypeProvider.Primitives.Text,
    );
    const blockLabel = `${blockType}-Execution-Time`;
    context.startTimer(blockLabel);

    // Fetch the executor for the specified block type
    const executor = await context.executionExtension.getExecutorForBlockType(blockType);
    if (executor === undefined) {
      return R.err({
        message: `No executor found for block type: ${blockType}`,
        diagnostic: { node: context.getOrFailProperty('blockType') },
      });
    }

    const executorType= executor.type;

    switch (executorType) {
      case('ArchiveInterpreter'):
    }

    const elapsedTime = context.stopTimer(blockLabel);
    if (elapsedTime !== undefined) {
      context.logger.logInfo(`Execution time for block ${blockType}: ${elapsedTime} ms`);
    }
    return null;
  }
}


