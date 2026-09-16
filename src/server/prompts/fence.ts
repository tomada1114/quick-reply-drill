/**
 * The per-call token and the boundary lines a prompt builder fences a
 * caller-controlled block of text with.
 *
 * @remarks
 * Shared by `buildDashboardRequest` (`src/server/prompts/dashboard.ts`) and
 * `buildScoringRequest` (`src/server/prompts/scoring.ts`): both interpolate
 * text a caller wrote into a prompt with no escaping, so both need a boundary
 * line that text could not have anticipated. Minting one token per call,
 * after the text to fence already exists, is what makes forging a matching
 * pair impractical — each builder's own instructions tell the model to trust
 * only what sits between a matching pair.
 */

/** A token source, injectable so a test can pin what a captured prompt reads. */
export type RandomUUID = () => string;

/** The real per-call token source every builder defaults to. */
export const realRandomUUID: RandomUUID = (): string => crypto.randomUUID();

/** One `<<<LABEL [n] TOKEN>>>` boundary line, indexed only when `index` is given. */
function boundaryLine(label: string, token: string, index: number | undefined): string {
  return index === undefined
    ? `<<<${label} ${token}>>>`
    : `<<<${label} ${String(index)} ${token}>>>`;
}

/**
 * Wraps `body` between a `<<<LABEL [n] TOKEN>>>` line and a matching
 * `<<<END [n] TOKEN>>>` line.
 *
 * @remarks
 * `index` distinguishes one fenced block from its neighbours when a prompt
 * carries several — the dashboard's per-record blocks — and is omitted when a
 * prompt carries exactly one, as the scoring prompt's single reply does.
 */
export function fenceBlock(
  label: string,
  token: string,
  body: string,
  index?: number,
): string {
  return [
    boundaryLine(label, token, index),
    body,
    boundaryLine("END", token, index),
  ].join("\n");
}
