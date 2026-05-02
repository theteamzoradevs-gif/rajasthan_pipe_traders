import React from "react";

/** Renders one feature line: newlines → `<br />`, `**bold**` → `<strong>`. */
export function renderKeyFeatureRichText(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => (
    <React.Fragment key={lineIdx}>
      {lineIdx > 0 ? <br /> : null}
      {renderBoldSegments(line)}
    </React.Fragment>
  ));
}

function renderBoldSegments(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
