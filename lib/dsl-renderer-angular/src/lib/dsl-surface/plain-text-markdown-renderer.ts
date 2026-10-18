import { Injectable } from '@angular/core';
import { MarkdownRenderer } from '@a2ui/angular/v0_9';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Replaces the A2UI Markdown renderer. The basic catalog `Text` puts the rendered Markdown of its
 * `body` variant into `innerHTML`; ESI shows DSL and row values as plain text only, so the text is
 * HTML-escaped and never parsed as Markdown or HTML.
 */
@Injectable()
export class PlainTextMarkdownRenderer extends MarkdownRenderer {
  override render(markdown: string): Promise<string> {
    return Promise.resolve(String(markdown).replace(/[&<>"']/g, (char) => ESCAPES[char]));
  }
}
