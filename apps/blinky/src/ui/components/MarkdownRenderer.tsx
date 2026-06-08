import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = parseBlocks(content);

  return (
    <div className="markdown-container">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const level = Math.min(block.level || 1, 6);
            const children = renderInline(block.text);
            switch (level) {
              case 1: return <h1 key={idx} className="md-h1">{children}</h1>;
              case 2: return <h2 key={idx} className="md-h2">{children}</h2>;
              case 3: return <h3 key={idx} className="md-h3">{children}</h3>;
              case 4: return <h4 key={idx} className="md-h4">{children}</h4>;
              case 5: return <h5 key={idx} className="md-h5">{children}</h5>;
              case 6: return <h6 key={idx} className="md-h6">{children}</h6>;
              default: return <p key={idx} className="md-p">{children}</p>;
            }
          }
          case 'code':
            return (
              <CodeBlock key={idx} code={block.text} language={block.language || 'text'} />
            );
          case 'table':
            return (
              <TableBlock key={idx} headers={block.headers || []} rows={block.rows || []} />
            );
          case 'list':
            if (block.ordered) {
              return (
                <ol key={idx} className="md-ol">
                  {block.items.map((item: string, i: number) => (
                    <li key={i}>{renderInline(item)}</li>
                  ))}
                </ol>
              );
            } else {
              return (
                <ul key={idx} className="md-ul">
                  {block.items.map((item: string, i: number) => (
                    <li key={i}>{renderInline(item)}</li>
                  ))}
                </ul>
              );
            }
          case 'paragraph':
          default:
            if (!block.text.trim()) return null;
            return (
              <p key={idx} className="md-p">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

// Subcomponent for Code Block rendering with Copy button
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  return (
    <div className="md-code-block-container">
      <div className="md-code-block-header">
        <span className="md-code-lang">{language.toUpperCase()}</span>
        <button className="md-code-copy-btn" onClick={handleCopy} type="button">
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="md-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Subcomponent for HTML Table rendering
function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="md-table-wrapper">
      <table className="md-table">
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th key={idx}>{renderInline(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Parser helper to parse block structure
function parseBlocks(markdown: string) {
  const lines = markdown.split('\n');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code block detection
    if (line.trim().startsWith('```')) {
      const match = line.trim().match(/^```(\w*)/);
      const language = match ? match[1] : 'text';
      const codeContent = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        language,
        text: codeContent.join('\n')
      });
      i++;
      continue;
    }

    // 2. Table detection
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headers = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(cell => cell.trim());

        let startIndex = 1;
        if (tableLines[1].includes('---') || tableLines[1].includes('-:-') || tableLines[1].includes(':-')) {
          startIndex = 2;
        }

        const rows = tableLines.slice(startIndex).map(rowLine =>
          rowLine
            .split('|')
            .slice(1, -1)
            .map(cell => cell.trim())
        );

        blocks.push({
          type: 'table',
          headers,
          rows
        });
      } else {
        blocks.push({
          type: 'paragraph',
          text: tableLines[0]
        });
      }
      continue;
    }

    // 3. Heading detection
    if (line.trim().startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1].length,
          text: match[2]
        });
        i++;
        continue;
      }
    }

    // 4. Unordered List detection
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().substring(2));
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: false,
        items
      });
      continue;
    }

    // 5. Ordered List detection
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^\d+\.\s+(.*)$/);
        if (match) {
          items.push(match[1]);
        }
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: true,
        items
      });
      continue;
    }

    // 6. Paragraph / Fallback
    blocks.push({
      type: 'paragraph',
      text: line
    });
    i++;
  }

  return blocks;
}

// Inline formatting parser (bold, italic, inline code)
function renderInline(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="md-inline-code">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
