export const getApiUrl = (path: string): string => {
  const baseUrl = typeof window !== 'undefined' && window.location.protocol === 'file:' 
    ? 'http://localhost:3000' 
    : '';
  return `${baseUrl}${path}`;
};
