// Server-only persistence exports kept behind the academic-record module boundary.
export {
  AcademicRecordDomainError,
  persistAcademicRecordsForRelease,
  persistAcademicRecordsForReleaseInTransaction,
} from './academic-records-persistence.server';
export { persistWithdrawnAcademicRecordsForReleaseInTransaction } from './academic-records-withdrawal.server';
