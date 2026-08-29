// Tiny static server for the demo site used in the README GIF and in
// CI-workflow-example.yml. Serves index-v1.html or index-v2.html as `/`
// depending on the DEMO_VARIANT env var, so the same two-line workflow can
// demonstrate a real visual regression without a build step.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const variant = process.env.DEMO_VARIANT === "v2" ? "v2" : "v1";
const port = Number(process.env.PORT ?? 3000);

const html = readFileSync(join(__dirname, `index-${variant}.html`));

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}).listen(port, () => {
  console.log(`demo-site (${variant}) listening on http://localhost:${port}`);
});
