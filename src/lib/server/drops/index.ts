/**
 * RW-037 — The one place the data source is chosen.
 *
 * Phase 2 (RW-120+, gated on the DB go-ahead) replaces this single export with
 * the Supabase-backed repository. No route or component changes.
 */
import type { DropRepository } from './repository';
import { mockDropRepository } from './mock-repository';

export const drops: DropRepository = mockDropRepository;
export type { DropRepository };
