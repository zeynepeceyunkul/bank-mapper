import { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  canDeactivate(): boolean | Promise<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  component.canDeactivate();
