const { adaptMermaid, needsQuotedLabels } = require('../src/core/mermaidSyntax');
const { mdToStorage } = require('../src/core/mdToStorage');

const { assert, same } = require('./assert');
const adapt = (body, version) => adaptMermaid('flowchart TD\n' + body, version || '9.2.2').split('\n').slice(1).join('\n');

assert(needsQuotedLabels('9.2.2') && needsQuotedLabels('10.3.0') && needsQuotedLabels('8'), 'older versions need quoted labels');
assert(!needsQuotedLabels('10.3.1') && !needsQuotedLabels('11.4.0') && !needsQuotedLabels('12'), 'newer versions do not');
assert(!needsQuotedLabels('') && !needsQuotedLabels('latest'), 'no version means no changes');

same(adapt(' A -->|x --> y| B'), ' A -->|"x --> y"| B', 'edge label with an arrow');
same(adapt(' A-->|a; b|B[c; d]'), ' A-->|"a; b"|B["c; d"]', 'edge label without spaces around');
same(adapt(' A[a; b] --> B(c — d) --> C{e … f}'), ' A["a; b"] --> B("c — d") --> C{"e … f"}', 'basic node shapes');
same(adapt(' A([a]) --> B[[b]] --> C[(c)] --> D((d)) --> E{{e}} --> F>f]'),
  ' A(["a"]) --> B[["b"]] --> C[("c")] --> D(("d")) --> E{{"e"}} --> F>"f"]', 'compound node shapes');
same(adapt(' A[/a/] --> B[\\b\\] --> C[/c\\] --> D[\\d/]'),
  ' A[/"a"/] --> B[\\"b"\\] --> C[/"c"\\] --> D[\\"d"/]', 'parallelogram and trapezoid shapes');
same(adapt(' A -- a; b --> B\n B == c ==> C\n C -. e .-> D\n D -- g --- E'),
  ' A -->|"a; b"| B\n B ==>|"c"| C\n C -.->|"e"| D\n D ---|"g"| E', 'text on links becomes a quoted edge label');
same(adapt(' A["quoted; x"] -->|"x → y"| B'), ' A["quoted; x"] -->|"x → y"| B', 'quoted labels stay as they are');
same(adapt(' A[say "hi"] --> B'), ' A["say #quot;hi#quot;"] --> B', 'quotes inside a label are escaped');
same(adapt(' subgraph S [Tytuł; x]\n A\n end'), ' subgraph S ["Tytuł; x"]\n A\n end', 'subgraph title');
same(adapt(' subgraph S["Tytuł"]\n A\n end'), ' subgraph S["Tytuł"]\n A\n end', 'quoted subgraph title');
same(adapt(' A[a]:::c & B[b] --> C\n classDef c fill:#f00\n style C fill:#0f0\n %% a[b] -> c'),
  ' A["a"]:::c & B["b"] --> C\n classDef c fill:#f00\n style C fill:#0f0\n %% a[b] -> c', 'styles, classes and comments are kept');

const again = adapt(' A[a; b] -- c --> B{d}');
same(adapt(again), again, 'adapting twice changes nothing');

const newer = 'flowchart TD\n A[a; b] -->|x → y| B';
same(adaptMermaid(newer, '11.0.0'), newer, 'newer versions get the source unchanged');
same(adaptMermaid(newer, ''), newer, 'no version keeps the source unchanged');
const sequence = 'sequenceDiagram\n A->>B: a[b]';
same(adaptMermaid(sequence, '9.2.2'), sequence, 'other diagram types are unchanged');
same(adaptMermaid('%%{init: {"theme":"dark"}}%%\ngraph LR\n A[a; b]', '9.2.2'),
  '%%{init: {"theme":"dark"}}%%\ngraph LR\n A["a; b"]', 'init directive before the header');

const md = '```mermaid\nflowchart TD\n A[a; b] --> B\n```\n';
assert(mdToStorage(md, { mermaidMacro: 'mermaid-macro', mermaidVersion: '9.2.2' }).includes('A["a; b"] --> B'),
  'publishing adapts the diagram to the configured version');
assert(mdToStorage(md, { mermaidMacro: 'mermaid-macro', mermaidVersion: '11.0.0' }).includes('A[a; b] --> B'),
  'publishing keeps the diagram for a newer version');
assert(mdToStorage(md, { mermaidVersion: '9.2.2' }).includes('A[a; b] --> B'),
  'a mermaid code block without the macro is published unchanged');

console.log('PASS: mermaid syntax (labels quoted for older versions) ok');
