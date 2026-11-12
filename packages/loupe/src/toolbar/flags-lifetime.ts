// How long a flag preview lasts (PER-182). The override cookie's name is fixed by
// `flags/next` and cookies ignore the port, so a preview made on one localhost app
// reaches every other one, and `flags/next` throws on it in an app with no
// `FLAGS_SECRET`. Expiring keeps a preview from outliving the app that set it.
// The card states this figure, so both read it from here.

export const PREVIEW_HOURS = 8;
export const PREVIEW_SECONDS = PREVIEW_HOURS * 3600;
