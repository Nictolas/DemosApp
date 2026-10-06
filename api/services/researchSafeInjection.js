const readCallableProperty = (candidate, property) => {
  if (candidate == null) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(candidate, property);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
    return typeof descriptor.value === 'function' ? descriptor.value : null;
  } catch {
    return null;
  }
};

const invokeDetachedCallable = (callable, argument) => {
  if (typeof callable !== 'function') return false;
  try {
    Reflect.apply(callable, undefined, [argument]);
    return true;
  } catch {
    return false;
  }
};

module.exports = { readCallableProperty, invokeDetachedCallable };
