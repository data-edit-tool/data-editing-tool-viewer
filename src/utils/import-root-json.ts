const ROOT_JSON_TIMESTAMP_PATTERN = '\\d{14}';

export const ROOT_JSON_TIMESTAMP_LABEL = '{YYYYMMDDHHmmss}';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getRootJsonFileNamePattern = (rootName: string) => `${rootName}_${ROOT_JSON_TIMESTAMP_LABEL}.json`;

export const isRootJsonFileName = (fileName: string, rootName: string) => {
  if (!rootName) {
    return false;
  }

  const rootJsonRegex = new RegExp(`^${escapeRegExp(rootName)}_(?:${ROOT_JSON_TIMESTAMP_PATTERN}|\\{${ROOT_JSON_TIMESTAMP_PATTERN}\\})\\.json$`, 'i');
  return rootJsonRegex.test(fileName);
};
