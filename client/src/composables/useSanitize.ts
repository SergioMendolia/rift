const STRIP_TAGS = [
  "script",
  "style",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "noscript",
  "template",
];

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const tag of STRIP_TAGS) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style") {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
}