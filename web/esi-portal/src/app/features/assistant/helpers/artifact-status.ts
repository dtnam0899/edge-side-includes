import type { DashboardItem } from '../../../core/api';

/** Short label for an artifact or dashboard item that cannot show live data. */
export function artifactStatusLabel(status: DashboardItem['status']): string {
  switch (status) {
    case 'connection-unavailable':
      return 'Connection unavailable';
    case 'migration-required':
      return 'Needs migration';
    case 'missing':
      return 'Deleted';
    default:
      return 'Available';
  }
}

/** Sentence explaining why an artifact or item shows no data. */
export function artifactStatusMessage(status: DashboardItem['status']): string {
  switch (status) {
    case 'connection-unavailable':
      return 'Its connection was deleted or its consent withdrawn, so it cannot show live data.';
    case 'migration-required':
      return 'It was saved with an older DSL version that cannot be rendered yet.';
    case 'missing':
      return 'The saved visualization of this item was deleted. Remove the item or add another one.';
    default:
      return '';
  }
}
