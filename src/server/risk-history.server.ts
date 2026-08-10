import type {
  GetAdminRiskTrendsSchema,
  GetStudentSupportStatusSchema,
  ListInstructorRiskHistorySchema,
} from './risk-history';
import type { z } from 'zod';

type InstructorHistoryInput = z.infer<typeof ListInstructorRiskHistorySchema>;
type AdminTrendsInput = z.infer<typeof GetAdminRiskTrendsSchema>;
type StudentSupportInput = z.infer<typeof GetStudentSupportStatusSchema>;

export async function listInstructorRiskHistoryHandler(_: { data: InstructorHistoryInput }) {
  throw new Error('Risk-history queries are not implemented yet');
}

export async function getAdminRiskTrendsHandler(_: { data: AdminTrendsInput }) {
  throw new Error('Risk-history queries are not implemented yet');
}

export async function getStudentSupportStatusHandler(_: { data: StudentSupportInput }) {
  throw new Error('Risk-history queries are not implemented yet');
}
