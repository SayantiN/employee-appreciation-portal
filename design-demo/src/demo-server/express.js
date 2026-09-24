/**
 * Design demo — just enough of Express's Router for the copied route files:
 * router.use / get / post / put / patch, route-level middleware, `:param`
 * and `:param(regex)` segments, and the req/res methods the routes call.
 */
export function Router() {
  const layers = [];
  const add = (method) => (pattern, ...fns) => layers.push({ method, ...compile(pattern), fns });

  const router = {
    use(...fns) { layers.push({ method: null, fns }); return router; },
    get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE'),

    /** Runs the first matching route. Resolves true if something answered. */
    handle(req, res, path) {
      let i = 0;
      const next = (err) => {
        if (err) throw err;
        if (res.finished) return;
        const layer = layers[i++];
        if (!layer) return;
        if (layer.method === null) return chain(layer.fns, req, res, next);
        if (layer.method !== req.method) return next();
        const m = layer.re.exec(path);
        if (!m) return next();
        req.params = Object.fromEntries(layer.keys.map((k, j) => [k, decodeURIComponent(m[j + 1])]));
        return chain(layer.fns, req, res, next);
      };
      next();
      return res.finished;
    },
  };
  return router;
}

function chain(fns, req, res, done) {
  let i = 0;
  const step = (err) => {
    if (err) throw err;
    const fn = fns[i++];
    if (!fn) return done();
    return fn(req, res, step);
  };
  return step();
}

function compile(pattern) {
  const keys = [];
  const src = pattern
    .replace(/\./g, '\\.')
    .replace(/:(\w+)(\(([^)]+)\))?/g, (_, key, _g, re) => {
      keys.push(key);
      return re ? `(${re.replace(/\\\\/g, '\\')})` : '([^/]+)';
    });
  return { re: new RegExp(`^${src}/?$`), keys };
}

export default { Router };
