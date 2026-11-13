export const getPublicAssetUrl = (assetPath: string) => {
  const baseUrl = import.meta.env.BASE_URL || './';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedAssetPath = assetPath.replace(/^\/+/, '');

  return `${normalizedBaseUrl}${normalizedAssetPath}`;
};
