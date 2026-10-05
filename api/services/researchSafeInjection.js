const readCallableProperty = (candidate, property) => {
  if (candidate == null) return null;
  try {
    const value = Reflect.get(candidate, property);
    return typeof value === 'function' ? value : null;
  } catch {
    return null;
  }
};

module.exports = { readCallableProperty };
