// Server-only handler implementations (not bundled for client)
// Full implementation in next task — stubs for typecheck
import type { z } from 'zod';
import type {
  SaveRubricSchema,
  DeleteCriterionSchema,
  DeleteLevelSchema,
  GetRubricSchema,
  SaveRubricResult,
  GetRubricResult,
  DeleteResult,
} from './rubrics';

type SaveRubricInput = z.infer<typeof SaveRubricSchema>;
type DeleteCriterionInput = z.infer<typeof DeleteCriterionSchema>;
type DeleteLevelInput = z.infer<typeof DeleteLevelSchema>;
type GetRubricInput = z.infer<typeof GetRubricSchema>;

export async function saveRubricHandler({
  data,
}: {
  data: SaveRubricInput;
}): Promise<SaveRubricResult> {
  throw new Error('saveRubricHandler not implemented');
}

export async function getRubricHandler({
  data,
}: {
  data: GetRubricInput;
}): Promise<GetRubricResult> {
  throw new Error('getRubricHandler not implemented');
}

export async function softDeleteCriterionHandler({
  data,
}: {
  data: DeleteCriterionInput;
}): Promise<DeleteResult> {
  throw new Error('softDeleteCriterionHandler not implemented');
}

export async function softDeleteLevelHandler({
  data,
}: {
  data: DeleteLevelInput;
}): Promise<DeleteResult> {
  throw new Error('softDeleteLevelHandler not implemented');
}
