export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export type SortOption =
  | 'NameAscending'
  | 'NameDescending'
  | 'RecentFirst'
  | 'OldestFirst'
  | 'StatusDateRecentFirst'
  | 'StatusDateOldestFirst';
