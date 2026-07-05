import { Repository, SelectQueryBuilder } from 'typeorm';

export interface CursorPayload {
  createdAt: string | Date;
  id: string;
}

export interface CursorPaginationResponse<T> {
  data: T[];
  nextCursor: string | null;
  limit: number;
  hasMore: boolean;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

export const cursorPagination = async <T>(
  query: SelectQueryBuilder<T> | Repository<T>,
  options: {
    limit?: number;
    cursor?: string;
    alias?: string;
    orderDirection?: 'ASC' | 'DESC';
  },
  findManyWhere?: any
): Promise<CursorPaginationResponse<T>> => {
  const limit = options.limit || 10;
  const cursor = options.cursor;
  const orderDirection = options.orderDirection || 'DESC';
  let results: T[] = [];

  let qb: SelectQueryBuilder<T>;

  if (query instanceof SelectQueryBuilder) {
    qb = query;
  } else {
    // If it is a Repository, we create a query builder
    const defaultAlias = options.alias || query.metadata.tableName;
    qb = query.createQueryBuilder(defaultAlias);

    if (findManyWhere) {
      qb.where(findManyWhere);
    }
  }

  const alias = options.alias || qb.alias;

  // Apply Sorting: primary by created_at, secondary by id
  qb.orderBy(`${alias}.created_at`, orderDirection);
  qb.addOrderBy(`${alias}.id`, orderDirection);

  // Apply Cursor condition
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.createdAt && decoded.id) {
      const operator = orderDirection === 'DESC' ? '<' : '>';
      qb.andWhere(
        `(${alias}.created_at ${operator} :cursorCreatedAt OR (${alias}.created_at = :cursorCreatedAt AND ${alias}.id ${operator} :cursorId))`,
        { cursorCreatedAt: decoded.createdAt, cursorId: decoded.id }
      );
    }
  }

  // We take limit + 1 to check if there is a next page
  qb.take(limit + 1);
  const fetchedResults = await qb.getMany();

  let nextCursor: string | null = null;
  const hasMore = fetchedResults.length > limit;

  if (hasMore) {
    // Remove the extra item
    fetchedResults.pop();
  }

  results = fetchedResults;

  if (results.length > 0 && hasMore) {
    const lastItem = results[results.length - 1] as any;
    if (lastItem.createdAt && lastItem.id) {
      nextCursor = encodeCursor({
        createdAt: lastItem.createdAt,
        id: lastItem.id,
      });
    }
  }
  return {
    data: results,
    nextCursor,
    limit,
    hasMore,
  };
};
