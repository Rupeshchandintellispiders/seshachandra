/**
 * Splits a MySQL migration file into statements on `;`, ignoring semicolons
 * inside quoted strings, backtick identifiers and comments. Statements are
 * trimmed; empty ones and comment-only ones are dropped.
 */
export function splitSql(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  const push = () => {
    const text = current.trim();
    if (text && stripComments(text).trim()) statements.push(text);
    current = "";
  };
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" || ch === '"' || ch === "`") {
      // Quoted text runs to the matching quote; doubled quotes and backslash
      // escapes stay inside it.
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "\\" && ch !== "`") j += 2;
        else if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
    } else if ((ch === "-" && next === "-" && /\s/.test(sql[i + 2] ?? " ")) || ch === "#") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
    } else if (ch === ";") {
      push();
      i++;
    } else {
      current += ch;
      i++;
    }
  }
  push();
  return statements;
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*(--\s|#).*(?=\n|$)/g, "$1");
}
