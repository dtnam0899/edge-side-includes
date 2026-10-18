/** Remembers the element that opened a dialog and gives focus back to it when the dialog closes. */
export class FocusReturn {
  private opener: HTMLElement | null = null;

  /** Call when the dialog is about to open (before it moves focus). */
  capture(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !active.closest('.p-dialog')) {
      this.opener = active;
    }
  }

  /** Call after the dialog closed. */
  restore(): void {
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) {
      setTimeout(() => opener.focus());
    }
  }
}
