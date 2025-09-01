// Stili personalizzati per line-clamp
export const lineClampStyles = {
  lineClamp2: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
};
