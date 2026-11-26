// git archive expands the format marker before Oryx compiles the source ZIP.
const archivedCommit = '$Format:%H$';

export const releaseCommit = /^[0-9a-f]{40}$/.test(archivedCommit) ? archivedCommit : null;
