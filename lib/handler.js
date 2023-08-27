function createHeadersProxy(headers) {
  const _headers = {};
  const normalize = (key) => {
    const lk = key.toLowerCase();
    // need to normalize `refer(r)er` header
    if (lk === "referer") {
      return "referrer";
    }
    return lk;
  };

  for (const key of Object.keys(headers)) {
    _headers[normalize(key)] = headers[key];
  }
  const proxyHandler = {
    get(target, propKey) {
      return target[normalize(propKey)];
    },
    set(target, propKey, value) {
      return (target[normalize(propKey)] = value);
    },
  };
  return new Proxy(_headers, proxyHandler);
}

export class EventProxy {
  constructor(event) {
    const hProxy = createHeadersProxy(event.headers || {});
    const mvProxy = createHeadersProxy(event.multiValueHeaders || {});
    event.req = event.body ? JSON.parse(event.body) : undefined;
    const proxy = new Proxy(event, {
      get(target, propKey) {
        if (propKey === "headers") {
          return hProxy;
        }
        if (propKey === "multiValueHeaders") {
          return mvProxy;
        }
        return target[propKey];
      },
      set(target, propKey, value) {
        if (propKey === "headers" || propKey === "multiValueHeaders") {
          return (target[propKey] = createHeadersProxy(value));
        }
        return Reflect.set(...arguments);
      },
    });
    return proxy;
  }
}

export class Handler {
  constructor(event) {
    // use a case-insensitive proxy over `event.headers`
    this.event = new EventProxy(event);
  }

  async run(func) {
    try {
      const bound_func = func.bind(this);
      return await bound_func(this.event);
    } catch (e) {
      console.log(e);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Unexpected error. Please try again later" }),
      };
    }
  }
}
