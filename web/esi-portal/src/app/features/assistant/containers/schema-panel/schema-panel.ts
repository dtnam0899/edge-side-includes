import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';

import { ErdDiagram } from '../../components/erd-diagram/erd-diagram';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { layoutErd, neighbours, subsetModel } from '../../helpers/erd-layout';
import { SchemaService } from '../../services/schema.service';

/**
 * The structure of the connected database as an entity-relationship diagram, with a searchable table list that
 * carries the same content as text. The schema is read when this panel opens; no row values are read.
 */
@Component({
  selector: 'app-schema-panel',
  imports: [ButtonDirective, InputText, Skeleton, ErdDiagram, ProblemMessage],
  providers: [SchemaService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      @if (schema.problem(); as problem) {
        <app-problem-message [problem]="problem" />
        <div>
          <button
            pButton
            type="button"
            size="small"
            severity="secondary"
            [outlined]="true"
            (click)="reload()"
          >
            Try again
          </button>
        </div>
      } @else if (schema.loading()) {
        <div aria-hidden="true" class="loading">
          <p-skeleton height="1.5rem" width="24rem" />
          <p-skeleton height="24rem" />
        </div>
        <span class="visually-hidden" role="status">Reading the database structure…</span>
      } @else if (schema.model(); as model) {
        <div class="summary">
          <p>
            <strong>{{ tableCount() }}</strong> {{ tableCount() === 1 ? 'table' : 'tables' }},
            <strong>{{ viewCount() }}</strong> {{ viewCount() === 1 ? 'view' : 'views' }},
            <strong>{{ model.relations.length }}</strong>
            {{ model.relations.length === 1 ? 'relationship' : 'relationships' }} in
            <strong>{{ model.schemaCount }}</strong>
            {{ model.schemaCount === 1 ? 'schema' : 'schemas' }}; {{ model.procedureCount }} stored
            {{ model.procedureCount === 1 ? 'procedure' : 'procedures' }}.
          </p>
          <button
            pButton
            type="button"
            size="small"
            severity="secondary"
            [text]="true"
            (click)="reload()"
          >
            Refresh
          </button>
        </div>

        @if (!model.tables.length) {
          <p class="empty">
            No tables or views were found. The login may not have permission to see them (<code
              >VIEW DEFINITION</code
            >), or the database is empty.
          </p>
        } @else {
          <div class="layout">
            <aside aria-label="Tables">
              <label for="schema-search">Find a table</label>
              <input
                pInputText
                id="schema-search"
                type="search"
                autocomplete="off"
                placeholder="Name or schema"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
              />
              <label class="focus">
                <input
                  type="checkbox"
                  [checked]="focusSelected()"
                  [disabled]="!selectedId()"
                  (change)="focusSelected.set($any($event.target).checked)"
                />
                Show only the selected table and its relations
              </label>

              <ul class="tables">
                @for (table of listed(); track table.id) {
                  <li>
                    <button
                      type="button"
                      class="table-button"
                      [class.selected]="table.id === selectedId()"
                      [attr.aria-pressed]="table.id === selectedId()"
                      (click)="select(table.id === selectedId() ? null : table.id)"
                    >
                      <span>{{ table.id }}</span>
                      <small>{{
                        table.kind === 'view' ? 'view' : table.columns.length + ' columns'
                      }}</small>
                    </button>
                  </li>
                } @empty {
                  <li class="empty">No table matches “{{ query() }}”.</li>
                }
              </ul>

              @if (selected(); as table) {
                <section class="details" aria-labelledby="schema-details-heading">
                  <h4 id="schema-details-heading">{{ table.id }}</h4>
                  <table>
                    <caption class="visually-hidden">
                      Columns of
                      {{
                        table.id
                      }}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Column</th>
                        <th scope="col">Type</th>
                        <th scope="col">Key</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (column of table.columns; track column.name) {
                        <tr>
                          <td>{{ column.name }}</td>
                          <td>
                            <code>{{ column.sqlType }}</code
                            >{{ column.nullable ? '' : ' not null' }}
                          </td>
                          <td>
                            {{ column.primaryKey ? 'PK' : ''
                            }}{{ column.primaryKey && column.foreignKey ? ', ' : ''
                            }}{{ column.foreignKey ? 'FK' : '' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  @if (references().length) {
                    <h5>References</h5>
                    <ul class="relations">
                      @for (r of references(); track r.name) {
                        <li>
                          ({{ r.fromColumns.join(', ') }}) →
                          <button type="button" class="link" (click)="select(r.to)">
                            {{ r.to }}
                          </button>
                          ({{ r.toColumns.join(', ') }})
                        </li>
                      }
                    </ul>
                  }
                  @if (referencedBy().length) {
                    <h5>Referenced by</h5>
                    <ul class="relations">
                      @for (r of referencedBy(); track r.from + r.name) {
                        <li>
                          <button type="button" class="link" (click)="select(r.from)">
                            {{ r.from }}
                          </button>
                          ({{ r.fromColumns.join(', ') }})
                        </li>
                      }
                    </ul>
                  }
                </section>
              }
            </aside>

            <app-erd-diagram
              [layout]="layout()"
              [selectedId]="selectedId()"
              [related]="related()"
              (selectedIdChange)="select($event)"
            />
          </div>
        }
      }
    </div>
  `,
  styles: `
    .panel,
    .loading {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .summary p,
    .empty {
      margin: 0;
      color: var(--p-text-muted-color);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    aside {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    aside input[type='search'] {
      width: 100%;
    }
    .focus {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      font-size: 0.875rem;
    }
    .tables {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 20rem;
      overflow: auto;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .table-button {
      display: flex;
      width: 100%;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.375rem 0.625rem;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .table-button span {
      overflow-wrap: anywhere;
    }
    .table-button small {
      flex: none;
      color: var(--p-text-muted-color);
    }
    .table-button:hover {
      background: var(--p-content-hover-background);
    }
    .table-button.selected {
      background: var(--p-highlight-background);
      color: var(--p-highlight-color);
    }
    .tables .empty {
      padding: 0.5rem 0.625rem;
    }
    .details {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      overflow-x: auto;
    }
    .details h4,
    .details h5 {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .details h5 {
      margin-top: 0.375rem;
    }
    .details table {
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .details th,
    .details td {
      padding: 0.25rem 0.5rem 0.25rem 0;
      text-align: left;
      vertical-align: top;
    }
    .details th {
      color: var(--p-text-muted-color);
      font-weight: 600;
    }
    .relations {
      margin: 0;
      padding-left: 1.125rem;
      font-size: 0.875rem;
    }
    .link {
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-primary-color);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
  `,
})
export class SchemaPanel {
  readonly connectionId = input.required<string>();

  protected readonly schema = inject(SchemaService);
  protected readonly query = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly focusSelected = signal(false);

  private readonly tables = computed(() => this.schema.model()?.tables ?? []);
  protected readonly tableCount = computed(
    () => this.tables().filter((t) => t.kind === 'table').length,
  );
  protected readonly viewCount = computed(
    () => this.tables().filter((t) => t.kind === 'view').length,
  );
  protected readonly listed = computed(() => {
    const text = this.query().trim().toLowerCase();
    return text ? this.tables().filter((t) => t.id.toLowerCase().includes(text)) : this.tables();
  });
  protected readonly selected = computed(
    () => this.tables().find((t) => t.id === this.selectedId()) ?? null,
  );
  protected readonly related = computed(() => {
    const model = this.schema.model();
    const id = this.selectedId();
    return model && id ? neighbours(model, id) : new Set<string>();
  });
  protected readonly references = computed(() =>
    (this.schema.model()?.relations ?? []).filter((r) => r.from === this.selectedId()),
  );
  protected readonly referencedBy = computed(() =>
    (this.schema.model()?.relations ?? []).filter((r) => r.to === this.selectedId()),
  );
  protected readonly layout = computed(() => {
    const model = this.schema.model();
    if (!model) return { nodes: [], edges: [], width: 0, height: 0 };
    const visible =
      this.focusSelected() && this.selectedId()
        ? this.related()
        : new Set(this.listed().map((t) => t.id));
    return layoutErd(visible.size === model.tables.length ? model : subsetModel(model, visible));
  });

  constructor() {
    effect(() => {
      const connectionId = this.connectionId();
      untracked(() => {
        this.selectedId.set(null);
        this.focusSelected.set(false);
        this.query.set('');
        this.schema.load(connectionId);
      });
    });
  }

  protected select(id: string | null): void {
    this.selectedId.set(id);
    if (!id) this.focusSelected.set(false);
  }

  protected reload(): void {
    this.schema.load(this.connectionId());
  }
}
