export const DATA_KEYS = {
  journal: "smartseek:v3:data-journal",
  importResult: "smartseek:v3:last-import",
  preview: "smartseek:import-preview",
  undoPrefix: "smartseek:undo:",
  undo: (id: string) => `smartseek:undo:${id}`,
};
