/*!
  * vue-router v3.4.3
  */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.VueRouter = factory());
}(this, function () { 'use strict';

  /**
   * 断言condition是否存在
   * @param {*} condition 条件
   * @param {*} message 错误信息
   */
  function assert (condition, message) {
    if (!condition) {
      throw new Error(("[vue-router] " + message))
    }
  }

  /**
   * 输出警告信息
   * @param {*} condition 条件
   * @param {*} message 错误信息
   */
  function warn (condition, message) {
    if ( !condition) {
      typeof console !== 'undefined' && console.warn(("[vue-router] " + message));
    }
  }

  /**
   * 扩展对象
   * @param {*} a 源对象
   * @param {*} b 目标对象
   * @returns 
   */
  function extend (a, b) {
    for (var key in b) {
      a[key] = b[key];
    }
    return a
  }

  // router-view组件
  var View = {
    name: 'RouterView',
    functional: true, // 函数式组件
    props: {
      name: {
        type: String,
        default: 'default'
      }
    },
    /**
     * render函数
     * @param {*} _ createElement
     * @param {*} ref context
     * @returns 
     */
    render: function render (_, ref) {
      var props = ref.props;
      var children = ref.children;
      var parent = ref.parent;
      var data = ref.data;

      // 给devtools使用的标志
      data.routerView = true;

      var h = parent.$createElement;
      var name = props.name;
      var route = parent.$route;
      var cache = parent._routerViewCache || (parent._routerViewCache = {});

      var depth = 0;
      var inactive = false;
      while (parent && parent._routerRoot !== parent) {
        // 嵌套router-view
        var vnodeData = parent.$vnode ? parent.$vnode.data : {};
        if (vnodeData.routerView) {
          depth++;
        }
        // 父组件被销毁后，缓存其子组件
        if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
          inactive = true;
        }
        parent = parent.$parent;
      }
      data.routerViewDepth = depth;

      if (inactive) {
        var cachedData = cache[name];
        var cachedComponent = cachedData && cachedData.component;
        if (cachedComponent) {
          if (cachedData.configProps) {
            fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps);
          }
          return h(cachedComponent, data, children)
        } else {
          // 渲染空标签
          return h()
        }
      }

      var matched = route.matched[depth];
      var component = matched && matched.components[name];

      // 没有匹配到路由或者匹配到的路由组件不存在，渲染空内容
      if (!matched || !component) {
        cache[name] = null;
        return h()
      }

      // 缓存组件
      cache[name] = { component: component };

      data.registerRouteInstance = function (vm, val) {
        // 注册路由实例
        var current = matched.instances[name];
        if (
          (val && current !== vm) ||
          (!val && current === vm)
        ) {
          matched.instances[name] = val;
        }
      }

      ;(data.hook || (data.hook = {})).prepatch = function (_, vnode) {
        matched.instances[name] = vnode.componentInstance;
      };

      // 当路由改变时触发
      data.hook.init = function (vnode) {
        if (vnode.data.keepAlive &&
          vnode.componentInstance &&
          vnode.componentInstance !== matched.instances[name]
        ) {
          matched.instances[name] = vnode.componentInstance;
        }
      };

      // props
      var configProps = matched.props && matched.props[name];
      if (configProps) {
        extend(cache[name], {
          route: route,
          configProps: configProps
        });
        fillPropsinData(component, data, route, configProps);
      }

      return h(component, data, children)
    }
  };

  // 填充props到data上
  function fillPropsinData (component, data, route, configProps) {
    var propsToPass = data.props = resolveProps(route, configProps);
    if (propsToPass) {
      propsToPass = data.props = extend({}, propsToPass);
      var attrs = data.attrs = data.attrs || {};
      for (var key in propsToPass) {
        if (!component.props || !(key in component.props)) {
          // 将route的props添加到component的props上
          attrs[key] = propsToPass[key];
          delete propsToPass[key];
        }
      }
    }
  }

  // 解析props
  function resolveProps (route, config) {
    switch (typeof config) {
      case 'undefined':
        return
      case 'object':
        return config
      case 'function':
        return config(route)
      case 'boolean':
        return config ? route.params : undefined
      default:
        {
          warn(
            false,
            "props in \"" + (route.path) + "\" is a " + (typeof config) + ", " +
            "expecting an object, function or boolean."
          );
        }
    }
  }

  var encodeReserveRE = /[!'()*]/g;
  var encodeReserveReplacer = function (c) { return '%' + c.charCodeAt(0).toString(16); };
  var commaRE = /%2C/g;

  var encode = function (str) { return encodeURIComponent(str)
      .replace(encodeReserveRE, encodeReserveReplacer)
      .replace(commaRE, ','); };

  var decode = decodeURIComponent;

  /**
   * 解析query请求参数
   * @param {String} query 请求参数
   * @param {Object} extraQuery 额外的请求参数
   * @param {Fn} _parseQuery 处理请求参数的方法
   * @returns 
   */
  function resolveQuery (
    query,
    extraQuery,
    _parseQuery
  ) {
    if ( extraQuery === void 0 ) extraQuery = {};

    var parse = _parseQuery || parseQuery;
    var parsedQuery;
    try {
      parsedQuery = parse(query || '');
    } catch (e) {
       warn(false, e.message);
      parsedQuery = {};
    }
    for (var key in extraQuery) {
      var value = extraQuery[key];
      parsedQuery[key] = Array.isArray(value)
        ? value.map(castQueryParamValue)
        : castQueryParamValue(value);
    }
    return parsedQuery
  }
  // 铸就请求参数的value
  // 如果value为假值，则返回true
  // 如果value为对象，则返回该对象
  // 如果value不为对象，则用包装类String包装一下返回
  var castQueryParamValue = function (value) { return (value == null || typeof value === 'object' ? value : String(value)); };

  /**
   * 处理请求参数
   * @param {String} query 请求参数
   * @returns 将字符串形式的请求转成对象形式
   * e.g.
   * input: name=fanqiewa&age=18
   * output: {name: 'fanqiewa', age: 18}
   */
  function parseQuery (query) {
    var res = {};

    query = query.trim().replace(/^(\?|#|&)/, '');

    if (!query) {
      return res
    }

    query.split('&').forEach(function (param) {
      var parts = param.replace(/\+/g, ' ').split('=');
      var key = decode(parts.shift());
      var val = parts.length > 0 ? decode(parts.join('=')) : null;

      if (res[key] === undefined) {
        res[key] = val;
      } else if (Array.isArray(res[key])) {
        res[key].push(val);
      } else {
        res[key] = [res[key], val];
      }
    });

    return res
  }

  // 将对象形式的query请求参数转成字符串形式
  function stringifyQuery (obj) {
    var res = obj
      ? Object.keys(obj)
        .map(function (key) {
          var val = obj[key];

          if (val === undefined) {
            return ''
          }

          if (val === null) {
            return encode(key)
          }

          if (Array.isArray(val)) {
            var result = [];
            val.forEach(function (val2) {
              if (val2 === undefined) {
                return
              }
              if (val2 === null) {
                result.push(encode(key));
              } else {
                result.push(encode(key) + '=' + encode(val2));
              }
            });
            return result.join('&')
          }

          return encode(key) + '=' + encode(val)
        })
        .filter(function (x) { return x.length > 0; })
        .join('&')
      : null;
    return res ? ("?" + res) : ''
  }

  // 匹配字符串的最后一个斜杠 `/`
  var trailingSlashRE = /\/?$/;

  /**
   * 创建路由
   * @param {Object} record 匹配到的路由
   * @param {Object} location 需要定位的位置信息
   * @param {*} redirectedFrom 重定向
   * @param {Object} router VueRouter实例
   * @returns 
   */
  function createRoute (
    record,
    location,
    redirectedFrom,
    router
  ) {
    // 程序员传递的stringifyQuery
    var stringifyQuery = router && router.options.stringifyQuery;

    var query = location.query || {};
    try {
      // 克隆一下query
      query = clone(query);
    } catch (e) {}

    var route = {
      name: location.name || (record && record.name),
      meta: (record && record.meta) || {},
      path: location.path || '/',
      hash: location.hash || '',
      query: query,
      params: location.params || {},
      fullPath: getFullPath(location, stringifyQuery),
      matched: record ? formatMatch(record) : []
    };
    if (redirectedFrom) {
      route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery);
    }
    return Object.freeze(route)
  }

  // 深度克隆
  function clone (value) {
    if (Array.isArray(value)) {
      return value.map(clone)
    } else if (value && typeof value === 'object') {
      var res = {};
      for (var key in value) {
        res[key] = clone(value[key]);
      }
      return res
    } else {
      return value
    }
  }

  // 表示初始状态的起始路由
  var START = createRoute(null, {
    path: '/'
  });

  // 格式化匹配内容，返回匹配数组，如果匹配的是子路由，返回的数组长度大于1
  // 即：父 -> 子
  function formatMatch (record) {
    var res = [];
    while (record) {
      res.unshift(record);
      record = record.parent;
    }
    return res
  }

  // 获取完整的路径
  function getFullPath (
    ref,
    _stringifyQuery
  ) {
    var path = ref.path;
    var query = ref.query; if ( query === void 0 ) query = {};
    var hash = ref.hash; if ( hash === void 0 ) hash = '';

    var stringify = _stringifyQuery || stringifyQuery;
    return (path || '/') + stringify(query) + hash
  }

  // 判断两个路由是否相等
  function isSameRoute (a, b) {
    if (b === START) {
      // 如果第二个参数为起始路由，则意味着第一个参数也可能为起始路由，直接用全等于判断
      // 在初始渲染router-link时，调用了此方法，a和b都可能是起始路由START
      return a === b
    } else if (!b) { // 第二个参数为undefined，不管第一个参数有没有，直接返回false
      return false
    } else if (a.path && b.path) { // 比对path
      return (
        a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
        a.hash === b.hash &&
        isObjectEqual(a.query, b.query)
      )
    } else if (a.name && b.name) { // 比对name
      return (
        a.name === b.name &&
        a.hash === b.hash &&
        isObjectEqual(a.query, b.query) &&
        // 如果route有name，则可能含有params
        isObjectEqual(a.params, b.params)
      )
    } else {
      return false
    }
  }

  // 判断两个对象是否相等
  function isObjectEqual (a, b) {
    if ( a === void 0 ) a = {};
    if ( b === void 0 ) b = {};

    if (!a || !b) { return a === b }
    var aKeys = Object.keys(a);
    var bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every(function (key) {
      var aVal = a[key];
      var bVal = b[key];
      // undefined === null => false
      if (aVal == null || bVal == null) { return aVal === bVal }
      // 如果value值为object，则递归处理
      if (typeof aVal === 'object' && typeof bVal === 'object') {
        return isObjectEqual(aVal, bVal)
      }
      return String(aVal) === String(bVal)
    })
  }

  // 判断当前路由对象是否包含目标对象（父子关系）
  function isIncludedRoute (current, target) {
    // '/foo/a'.indexOf('/foo') === 0
    return (
      // 当前路径和目标路径相等
      current.path.replace(trailingSlashRE, '/').indexOf(
        target.path.replace(trailingSlashRE, '/')
      ) === 0 &&
      (!target.hash || current.hash === target.hash) &&
      queryIncludes(current.query, target.query)
    )
  }

  // 检查target对象的属性是否都在current对象中
  function queryIncludes (current, target) {
    for (var key in target) {
      if (!(key in current)) {
        return false
      }
    }
    return true
  }

  // 解析path
  function resolvePath (
    relative, // 需要拆解的路径
    base, // 基础路径
    append // 额外的路径
  ) {
    var firstChar = relative.charAt(0);
    if (firstChar === '/') {
      return relative
    }

    if (firstChar === '?' || firstChar === '#') {
      return base + relative
    }

    var stack = base.split('/');

    if (!append || !stack[stack.length - 1]) {
      stack.pop();
    }

    // 分割relative path
    var segments = relative.replace(/^\//, '').split('/');
    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i];
      if (segment === '..' /* 匹配父级目录 */) {
        stack.pop(); // 将父级移除
      } else if (segment !== '.') {
        stack.push(segment);
      }
    }

    // 确保数组第一项是斜线
    if (stack[0] !== '') {
      stack.unshift('');
    }

    // e.g. ['', 'foo', 'abc'] => '/foo/abc'
    return stack.join('/')
  }

  // 处理路径，返回一个对象，包含路径，请求参数，hash值（锚点）
  function parsePath (path) {
    var hash = '';
    var query = '';

    // 先匹配hash值
    var hashIndex = path.indexOf('#');
    if (hashIndex >= 0) {
      hash = path.slice(hashIndex);
      path = path.slice(0, hashIndex);
    }

    // 后匹配请求参数
    var queryIndex = path.indexOf('?');
    if (queryIndex >= 0) {
      query = path.slice(queryIndex + 1);
      path = path.slice(0, queryIndex);
    }

    return {
      path: path,
      query: query,
      hash: hash
    }
  }

  function cleanPath (path) {
    return path.replace(/\/\//g, '/')
  }

  var isarray = Array.isArray || function (arr) {
    return Object.prototype.toString.call(arr) == '[object Array]';
  };

  var pathToRegexp_1 = pathToRegexp;
  var parse_1 = parse;
  var compile_1 = compile;
  var tokensToFunction_1 = tokensToFunction;
  var tokensToRegExp_1 = tokensToRegExp;

  /*
    /(\\.) | ([\/.])?   (?:(?:\:(\w+)    (?:\(((?:\\.|[^\\()])+)    \))?     |   \(((?:\\.|[^\\()])+)\))      ([+*?])?|(\*))/g
      1         2                    3               4                                    5                      6       7
  */
  var PATH_REGEXP = new RegExp([
    // 匹配转义字符，否则将出现在未来的匹配中，这使得用户可以转义那些无法转换的特殊字符
    '(\\\\.)',
    // 下面的参数匹配子表达式
    // e.g. 
    //                      2     3       4       5        6      7
    // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
    // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
    // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
    '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
  ].join('|'), 'g');

  /**
   * 处理字符串
   * 
   * @param  {string}  str
   * @param  {Object=} options
   * @return {!Array}
   */
  function parse (str, options) {
    var tokens = [];
    var key = 0;
    var index = 0;
    var path = '';
    var defaultDelimiter = options && options.delimiter || '/';
    var res;

    while ((res = PATH_REGEXP.exec(str)) != null) {
      var m = res[0];
      var escaped = res[1];
      var offset = res.index; // 匹配字符串的开始位置
      path += str.slice(index, offset);
      index = offset + m.length;

      // 忽略转义字符串 e.g. str = '\\d'
      if (escaped) {
        path += escaped[1];
        continue
      }

      var next = str[index];
      var prefix = res[2]; // 匹配前缀 e.g. /:test(\\d+)? => test
      var name = res[3]; // 匹配名称 e.g. /test:id => id
      var capture = res[4]; // 匹配捕获 e.g. /route(\\d+) => \d+
      var group = res[5]; // 匹配分组（数量） e.g. /route(\\d+) => \d+
      var modifier = res[6]; // 匹配修饰词 e.g. /:test(\\d+)? => ?
      var asterisk = res[7]; // 匹配星号 e.g. /* => *

      // 把当前的路径path添加到tokens中
      if (path) {
        tokens.push(path);
        path = '';
      }

      var partial = prefix != null && next != null && next !== prefix;
      var repeat = modifier === '+' || modifier === '*';
      var optional = modifier === '?' || modifier === '*';
      var delimiter = res[2] || defaultDelimiter;
      var pattern = capture || group; // pattern模式，正则表达式经编译后的表现模式

      tokens.push({
        name: name || key++,
        prefix: prefix || '',
        delimiter: delimiter, // 分割符
        optional: optional, // 零个或一个或多个
        repeat: repeat, // 重复
        partial: partial,
        asterisk: !!asterisk,
        pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
      });
    }

    // 匹配剩余的字符串
    if (index < str.length) {
      path += str.substr(index);
    }

    // 如果path存在，则添加到tokens中
    if (path) {
      tokens.push(path);
    }

    return tokens
  }

  /**
   * 编译正则字符串模板
   */
  function compile (str, options) {
    return tokensToFunction(parse(str, options), options)
  }

  /**
   * 将 `/?#` 字符串转成漂亮的编码
   * @param  {string}
   * @return {string}
   */
  function encodeURIComponentPretty (str) {
    // encodeURI函数将字符串进行编码
    return encodeURI(str).replace(/[\/?#]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase()
    })
  }

  /**
   * 编译 `*` 号参数，但允许斜杠不编译
   * @param  {string}
   * @return {string}
   */
  function encodeAsterisk (str) {
    return encodeURI(str).replace(/[?#]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase()
    })
  }

  /**
   * 返回一个将标记转换为路径函数的方法
   */
  function tokensToFunction (tokens, options) {
    // 存储所有编译后的正则表达式
    var matches = new Array(tokens.length);

    // 编译之前编译所有模式
    for (var i = 0; i < tokens.length; i++) {
      if (typeof tokens[i] === 'object') {
        // e.g. /^(?:\d+)$/i
        matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$', flags(options));
      }
    }

    // 回调函数
    return function (obj, opts) {
      var path = '';
      var data = obj || {};
      var options = opts || {};
      // encodeURIComponent方法可把字符串作为URI组件进行编码
      // 该方法不会对ASCII字母和数字进行编码，也不会对这些ASCII标点符号进行编码：- _ . ! ~ * ' ( )
      var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent;

      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];

        // 如果token为字符串，直接终止当前循环，并将当前标记直接设置为path的一部分
        if (typeof token === 'string') {
          path += token;

          continue
        }

        var value = data[token.name];
        var segment;

        if (value == null) {
          if (token.optional) {
            // 添加预配置部分数据段的前缀
            if (token.partial) {
              path += token.prefix;
            }

            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to be defined')
          }
        }

        // 如果value值为数组
        if (isarray(value)) {
          // 正则表达式需要有 `?` 或 `*` 修饰符
          if (!token.repeat) {
            throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
          }

          if (value.length === 0) {
            if (token.optional) {
              continue
            } else {
              throw new TypeError('Expected "' + token.name + '" to not be empty')
            }
          }

          for (var j = 0; j < value.length; j++) {
            segment = encode(value[j]);

            if (!matches[i].test(segment)) {
              throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
            }

            // 第一个值加前缀，后面的值加分割符
            path += (j === 0 ? token.prefix : token.delimiter) + segment;
          }

          continue
        }

        // params参数的value值
        segment = token.asterisk ? encodeAsterisk(value) : encode(value);

        // 如果匹配value值不存在，输出错误
        if (!matches[i].test(segment)) {
          throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
        }

        path += token.prefix + segment;
      }

      return path
    }
  }

  /**
   * 为特殊字符添加转义字符
   * @param  {string} str
   * @return {string}
   */
  function escapeString (str) {
    return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
  }

  /**
   * 为特殊字符添加转义符号
   * @param  {string} group
   * @return {string}
   */
  function escapeGroup (group) {
    return group.replace(/([=!:$\/()])/g, '\\$1')
  }

  /**
   * 将keys附加为正则的属性
   * @param  {!RegExp} re
   * @param  {Array}   keys
   * @return {!RegExp}
   */
  function attachKeys (re, keys) {
    re.keys = keys;
    return re
  }

  /**
   * 是否对大小写敏感匹配
   * i为对大小写不敏感的匹配
   * @param  {Object} options
   * @return {string}
   */
  function flags (options) {
    return options && options.sensitive ? '' : 'i'
  }

  /**
   * 从正则表达式中获取key值
   */
  function regexpToRegexp (path, keys) {
    var groups = path.source.match(/\((?!\?)/g);

    if (groups) {
      for (var i = 0; i < groups.length; i++) {
        keys.push({
          name: i,
          prefix: null,
          delimiter: null,
          optional: false,
          repeat: false,
          partial: false,
          asterisk: false,
          pattern: null
        });
      }
    }

    return attachKeys(path, keys)
  }

  /**
   * 转换数组的正则
   */
  function arrayToRegexp (path, keys, options) {
    var parts = [];

    for (var i = 0; i < path.length; i++) {
      parts.push(pathToRegexp(path[i], keys, options).source);
    }

    var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));

    return attachKeys(regexp, keys)
  }

  /**
   * 通过输入字符串创建一个路径匹配正则表达式
   */
  function stringToRegexp (path, keys, options) {
    return tokensToRegExp(parse(path, options), keys, options)
  }

  /**
   * 通过解析出来的tokens构建正则
   */
  function tokensToRegExp (tokens, keys, options) {
    if (!isarray(keys)) {
      options = /** @type {!Object} */ (keys || options);
      keys = [];
    }

    options = options || {};

    var strict = options.strict;
    var end = options.end !== false;
    var route = '';

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        route += escapeString(token);
      } else {
        // '/user/:id'
        var prefix = escapeString(token.prefix);
        var capture = '(?:' + token.pattern + ')';

        keys.push(token);

        if (token.repeat) {
          capture += '(?:' + prefix + capture + ')*';
        }

        if (token.optional) {
          if (!token.partial) {
            capture = '(?:' + prefix + '(' + capture + '))?';
          } else {
            capture = prefix + '(' + capture + ')?';
          }
        } else {
          capture = prefix + '(' + capture + ')';
        }

        route += capture;
      }
    }

    // \/
    var delimiter = escapeString(options.delimiter || '/');
    var endsWithDelimiter = route.slice(-delimiter.length) === delimiter;

    if (!strict) {
      // e.g. '\/foo(?:\/(?=$))?'
      route = (endsWithDelimiter ? route.slice(0, -delimiter.length) : route) + '(?:' + delimiter + '(?=$))?';
    }

    if (end) {
      route += '$';
    } else {
      route += strict && endsWithDelimiter ? '' : '(?=' + delimiter + '|$)';
    }

    return attachKeys(new RegExp('^' + route, flags(options)), keys)
  }

  /**
   * 根据路径构建正则
   */
  function pathToRegexp (path, keys, options) {
    if (!isarray(keys)) {
      options = /** @type {!Object} */ (keys || options);
      keys = [];
    }

    options = options || {};

    if (path instanceof RegExp) {
      return regexpToRegexp(path, /** @type {!Array} */ (keys))
    }

    if (isarray(path)) {
      return arrayToRegexp(/** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
    }

    return stringToRegexp(/** @type {string} */ (path), /** @type {!Array} */ (keys), options)
  }
  pathToRegexp_1.parse = parse_1;
  pathToRegexp_1.compile = compile_1;
  pathToRegexp_1.tokensToFunction = tokensToFunction_1;
  pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

  var regexpCompileCache = Object.create(null);

  // 添加params
  function fillParams (
    path,
    params,
    routeMsg
  ) {
    params = params || {};
    try {
      var filler =
        regexpCompileCache[path] ||
        (regexpCompileCache[path] = pathToRegexp_1.compile(path));

      if (typeof params.pathMatch === 'string') { params[0] = params.pathMatch; }

      // 执行正则编译后的回调 pretty => 漂亮的
      return filler(params, { pretty: true })
    } catch (e) {
      {
        // 找不到参数
        warn(typeof params.pathMatch === 'string', ("missing param for " + routeMsg + ": " + (e.message)));
      }
      return ''
    } finally {
      delete params[0];
    }
  }

  // 格式化Location
  function normalizeLocation (
    raw,
    current,
    append,
    router
  ) {
    var next = typeof raw === 'string' ? { path: raw } : raw;
    // _normalized标记路由已经被格式化过了
    if (next._normalized) {
      return next
    } else if (next.name) {
      next = extend({}, raw);
      var params = next.params;
      if (params && typeof params === 'object') {
        next.params = extend({}, params);
      }
      return next
    }

    // relative params
    if (!next.path && next.params && current) {
      next = extend({}, next);
      next._normalized = true;
      var params$1 = extend(extend({}, current.params), next.params);
      if (current.name) {
        next.name = current.name;
        next.params = params$1;
      } else if (current.matched.length) {
        var rawPath = current.matched[current.matched.length - 1].path;
        next.path = fillParams(rawPath, params$1, ("path " + (current.path)));
      } else {
        warn(false, "relative params navigation requires a current route.");
      }
      return next
    }

    // 处理path
    var parsedPath = parsePath(next.path || '');
    var basePath = (current && current.path) || '/';
    // 解析path
    var path = parsedPath.path
      ? resolvePath(parsedPath.path, basePath, append || next.append)
      : basePath;

    var query = resolveQuery(
      parsedPath.query,
      next.query,
      router && router.options.parseQuery
    );

    // 如果hash锚点存在，则添加 # 符号
    var hash = next.hash || parsedPath.hash;
    if (hash && hash.charAt(0) !== '#') {
      hash = "#" + hash;
    }

    return {
      _normalized: true,
      path: path,
      query: query,
      hash: hash
    }
  }

  var toTypes = [String, Object];
  var eventTypes = [String, Array];

  var noop = function () {};

  var Link = {
    name: 'RouterLink',
    props: {
      to: {
        type: toTypes,
        required: true
      },
      tag: {
        type: String,
        default: 'a'
      },
      exact: Boolean, // 是否为精确匹配
      append: Boolean, // 在当前（相对）路径前添加基路径
      replace: Boolean, // 设置为true，调用router.replace()，而不是router.push()
      activeClass: String, // 设置链接激活时使用的CSS类名
      exactActiveClass: String,
      ariaCurrentValue: { // 声明可以用来触发导航的事件
        type: String,
        default: 'page'
      },
      event: {
        type: eventTypes,
        default: 'click'
      }
    },
    render: function render (h) {
      var this$1 = this;

      var router = this.$router;
      var current = this.$route;
      var ref = router.resolve(
        this.to,
        current,
        this.append
      );
      var location = ref.location;
      var route = ref.route;
      var href = ref.href;

      var classes = {};
      // 全局配置<router-link>默认的激活的class
      var globalActiveClass = router.options.linkActiveClass;
      // 全局配置<router-link>默认的精确激活的class
      var globalExactActiveClass = router.options.linkExactActiveClass;

      var activeClassFallback =
        globalActiveClass == null ? 'router-link-active' : globalActiveClass;
      var exactActiveClassFallback =
        globalExactActiveClass == null
          ? 'router-link-exact-active'
          : globalExactActiveClass;
          
      // 设置链接激活时使用的CSS类名。默认值可以通过路由构造选项linkActiveClass来全局配置
      var activeClass =
        this.activeClass == null ? activeClassFallback : this.activeClass;
      // 配置当链接被精确匹配的时候应该激活的class。默认值可以通过路由的构造选项linkExactActiveClass来全局配置
      var exactActiveClass =
        this.exactActiveClass == null
          ? exactActiveClassFallback
          : this.exactActiveClass;

      var compareTarget = route.redirectedFrom
        // 创建重定向的路由信息
        ? createRoute(null, normalizeLocation(route.redirectedFrom), null, router)
        // 否则直接用to构建出来的路由信息
        : route;

      // 如果两个路由相等，则属于精确匹配，精确匹配样式名被激活
      /*
        e.g.
        classes = {
          router-link-exact-active: true
        }
      */
      classes[exactActiveClass] = isSameRoute(current, compareTarget);
      // 链接激活样式名
      classes[activeClass] = this.exact
        /*
          e.g. 
          classes = {
            router-link-exact-active: true
          }
        */
        ? classes[exactActiveClass]
        /*
          e.g. 
          classes = {
            router-link-active: true
          }
        */
        : isIncludedRoute(current, compareTarget);

      var ariaCurrentValue = classes[exactActiveClass] ? this.ariaCurrentValue : null;

      var handler = function (e) {
        if (guardEvent(e)) {
          if (this$1.replace) {
            router.replace(location, noop);
          } else {
            router.push(location, noop);
          }
        }
      };

      var on = { click: guardEvent };
      if (Array.isArray(this.event)) {
        this.event.forEach(function (e) {
          on[e] = handler;
        });
      } else {
        on[this.event] = handler;
      }

      var data = { class: classes };
      // e.g. <router-link to="/foo" v-slot="{href, route, navigate, isActive, isExactActive}"></router-link>
      var scopedSlot =
        !this.$scopedSlots.$hasNormal &&
        this.$scopedSlots.default &&
        this.$scopedSlots.default({
          href: href,
          route: route,
          navigate: handler,
          isActive: classes[activeClass],
          isExactActive: classes[exactActiveClass]
        });

      if (scopedSlot) {
        if (scopedSlot.length === 1) {
          return scopedSlot[0]
        } else if (scopedSlot.length > 1 || !scopedSlot.length) {
          {
            warn(
              false,
              ("RouterLink with to=\"" + (this.to) + "\" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.")
            );
          }
          return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
        }
      }

      if (this.tag === 'a') {
        data.on = on;
        data.attrs = { href: href, 'aria-current': ariaCurrentValue };
      } else {
        var a = findAnchor(this.$slots.default);
        if (a) {
          a.isStatic = false;
          var aData = (a.data = extend({}, a.data));
          aData.on = aData.on || {};
          for (var event in aData.on) {
            var handler$1 = aData.on[event];
            if (event in on) {
              aData.on[event] = Array.isArray(handler$1) ? handler$1 : [handler$1];
            }
          }
          for (var event$1 in on) {
            if (event$1 in aData.on) {
              aData.on[event$1].push(on[event$1]);
            } else {
              aData.on[event$1] = handler;
            }
          }

          var aAttrs = (a.data.attrs = extend({}, a.data.attrs));
          aAttrs.href = href;
          aAttrs['aria-current'] = ariaCurrentValue;
        } else {
          // 不存在a标签
          data.on = on;
        }
      }

      return h(this.tag, data, this.$slots.default)
    }
  };

  // 拦截事件
  function guardEvent (e) {
    // window、alt、ctrlKey、shift键
    if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }
    // 如果已经调用了preventDefault()方法，则终止函数
    if (e.defaultPrevented) { return }
    // 右键点击终止函数
    if (e.button !== undefined && e.button !== 0) { return }
    // 如果`target="_blank"`，终止函数
    if (e.currentTarget && e.currentTarget.getAttribute) {
      var target = e.currentTarget.getAttribute('target');
      if (/\b_blank\b/i.test(target)) { return }
    }
    // 取消默认事件
    if (e.preventDefault) {
      e.preventDefault();
    }
    return true
  }

  // 查找第一个锚点
  function findAnchor (children) {
    if (children) {
      var child;
      for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (child.tag === 'a') {
          return child
        }
        if (child.children && (child = findAnchor(child.children))) {
          return child
        }
      }
    }
  }

  var _Vue;

  // Vue.use入口
  function install (Vue) {
    if (install.installed && _Vue === Vue) { return }
    install.installed = true;

    _Vue = Vue;

    var isDef = function (v) { return v !== undefined; };

    // 注册实例
    var registerInstance = function (vm, callVal) {
      var i = vm.$options._parentVnode;
      // vm.$options._parentVnode.data.registerRouteInstance在render时注册
      if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
        i(vm, callVal);
      }
    };

    Vue.mixin({
      beforeCreate: function beforeCreate () {
        if (isDef(this.$options.router)) {
          this._routerRoot = this;
          this._router = this.$options.router;
          // VueRouter.prototype.init
          this._router.init(this);
          Vue.util.defineReactive(this, '_route', this._router.history.current);
        } else {
          this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
        }
        registerInstance(this, this);
      },
      destroyed: function destroyed () {
        registerInstance(this);
      }
    });

    Object.defineProperty(Vue.prototype, '$router', {
      get: function get () { return this._routerRoot._router }
    });

    Object.defineProperty(Vue.prototype, '$route', {
      get: function get () { return this._routerRoot._route }
    });

    Vue.component('RouterView', View);
    Vue.component('RouterLink', Link);

    var strats = Vue.config.optionMergeStrategies;
    // 自定义合并策略
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created;
  }

  var inBrowser = typeof window !== 'undefined';

  // 创建路由map
  function createRouteMap (
    routes,
    oldPathList,
    oldPathMap,
    oldNameMap
  ) {
    var pathList = oldPathList || [];
    var pathMap = oldPathMap || Object.create(null);
    var nameMap = oldNameMap || Object.create(null);

    routes.forEach(function (route) {
      addRouteRecord(pathList, pathMap, nameMap, route);
    });

    // 确保通配符在pathList路径数组后面
    for (var i = 0, l = pathList.length; i < l; i++) {
      if (pathList[i] === '*') {
        pathList.push(pathList.splice(i, 1)[0]);
        l--;
        i--;
      }
    }

    {
      // 路由别名必须要以 / 开头
      var found = pathList
        .filter(function (path) { return path && path.charAt(0) !== '*' && path.charAt(0) !== '/'; });

      if (found.length > 0) {
        var pathNames = found.map(function (path) { return ("- " + path); }).join('\n');
        warn(false, ("Non-nested routes must include a leading slash character. Fix the following routes: \n" + pathNames));
      }
    }

    return {
      pathList: pathList,
      pathMap: pathMap,
      nameMap: nameMap
    }
  }

  // 添加路由记录
  function addRouteRecord (
    pathList,
    pathMap,
    nameMap,
    route,
    parent,
    matchAs
  ) {
    var path = route.path;
    var name = route.name;
    {
      assert(path != null, "\"path\" is required in a route configuration.");
      assert(
        typeof route.component !== 'string',
        "route config \"component\" for path: " + (String(
          path || name
        )) + " cannot be a " + "string id. Use an actual component instead."
      );
    }

    var pathToRegexpOptions =
      route.pathToRegexpOptions || {};
    var normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict);

    // route配置，匹配规则是否大小写敏感看（默认值：false）
    if (typeof route.caseSensitive === 'boolean') {
      pathToRegexpOptions.sensitive = route.caseSensitive;
    }

    var record = {
      path: normalizedPath,
      regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
      components: route.components || { default: route.component },
      instances: {},
      name: name,
      parent: parent,
      matchAs: matchAs,
      redirect: route.redirect,
      beforeEnter: route.beforeEnter,
      meta: route.meta || {},
      props:
        route.props == null
          ? {}
          : route.components
            ? route.props
            : { default: route.props }
    };

    if (route.children) {
      {
        if (
          route.name &&
          !route.redirect &&
          route.children.some(function (child) { return /^\/?$/.test(child.path); })
        ) {
          // 有children的路由，不能设置name，否则将发出警告
          warn(
            false,
            "Named Route '" + (route.name) + "' has a default child route. " +
              "When navigating to this named route (:to=\"{name: '" + (route.name) + "'\"), " +
              "the default child route will not be rendered. Remove the name from " +
              "this route and use the name of the default child route for named " +
              "links instead."
          );
        }
      }
      route.children.forEach(function (child) {
        var childMatchAs = matchAs
          ? cleanPath((matchAs + "/" + (child.path)))
          : undefined;
        addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs);
      });
    }

    // 如果有children，则children中的path将会在当前路由的前面
    // 因为先递归children，执行addRouteRecord方法
    if (!pathMap[record.path]) {
      pathList.push(record.path);
      pathMap[record.path] = record;
    }

    // 如果路由配置设置了路由别名，push的时候必须通过path指定，不能通过name来访问
    if (route.alias !== undefined) {
      var aliases = Array.isArray(route.alias) ? route.alias : [route.alias];
      for (var i = 0; i < aliases.length; ++i) {
        var alias = aliases[i];
        if ( alias === path) {
          warn(
            false,
            ("Found an alias with the same value as the path: \"" + path + "\". You have to remove that alias. It will be ignored in development.")
          );
          continue
        }

        var aliasRoute = {
          path: alias,
          children: route.children
        };
        addRouteRecord(
          pathList,
          pathMap,
          nameMap,
          aliasRoute,
          parent,
          record.path || '/' // matchAs
        );
      }
    }

    if (name) {
      if (!nameMap[name]) {
        nameMap[name] = record;
      } else if ( !matchAs) {
        warn(
          false,
          "Duplicate named routes definition: " +
            "{ name: \"" + name + "\", path: \"" + (record.path) + "\" }"
        );
      }
    }
  }

  // 编译route路径的正则
  function compileRouteRegex (
    path,
    pathToRegexpOptions
  ) {
    var regex = pathToRegexp_1(path, [], pathToRegexpOptions);
    {
      var keys = Object.create(null);
      regex.keys.forEach(function (key) {
        warn(
          !keys[key.name],
          ("Duplicate param keys in route with path: \"" + path + "\"")
        );
        keys[key.name] = true;
      });
    }
    return regex
  }

  // 格式化路径
  function normalizePath (
    path,
    parent,
    strict
  ) {
    // e.g. /foo/info/ => /foo/info
    if (!strict) { path = path.replace(/\/$/, ''); }
    if (path[0] === '/') { return path }
    if (parent == null) { return path }
    return cleanPath(((parent.path) + "/" + path))
  }

  // 创建matcher匹配器
  function createMatcher (
    routes,
    router
  ) {
    var ref = createRouteMap(routes);
    var pathList = ref.pathList; // route定义的所有path - 数组形式
    var pathMap = ref.pathMap; // route定义的所有path - 对象形式
    var nameMap = ref.nameMap; // route定义的所有name - 对象形式

    function addRoutes (routes) {
      createRouteMap(routes, pathList, pathMap, nameMap);
    }

    // 匹配路由
    function match (
      raw,
      currentRoute,
      redirectedFrom
    ) {
      var location = normalizeLocation(raw, currentRoute, false, router);
      var name = location.name;

      if (name /* 匹配名称 */) {
        var record = nameMap[name];
        {
          warn(record, ("Route with name '" + name + "' does not exist"));
        }
        if (!record) { return _createRoute(null, location) }
        var paramNames = record.regex.keys
          .filter(function (key) { return !key.optional; })
          .map(function (key) { return key.name; });

        if (typeof location.params !== 'object') {
          location.params = {};
        }

        if (currentRoute && typeof currentRoute.params === 'object') {
          for (var key in currentRoute.params) {
            if (!(key in location.params) && paramNames.indexOf(key) > -1) {
              location.params[key] = currentRoute.params[key];
            }
          }
        }

        location.path = fillParams(record.path, location.params, ("named route \"" + name + "\""));
        return _createRoute(record, location, redirectedFrom)
      } else if (location.path /* 匹配路径 */) {
        location.params = {};
        for (var i = 0; i < pathList.length; i++) {
          var path = pathList[i];
          var record$1 = pathMap[path];
          // 匹配动态路由时，location.params用来存放匹配到的动态数据
          if (matchRoute(record$1.regex, location.path, location.params)) {
            // 匹配成功，创建路由
            return _createRoute(record$1, location, redirectedFrom)
          }
        }
      }
      // 如果既没有path也没有name，则返回根路由
      return _createRoute(null, location)
    }

    // 路由重定向
    function redirect (
      record,
      location
    ) {
      var originalRedirect = record.redirect;
      var redirect = typeof originalRedirect === 'function'
        // 如果redirect为函数，则执行该函数，传递当前匹配的路由
        ? originalRedirect(createRoute(record, location, null, router))
        : originalRedirect;

      if (typeof redirect === 'string') {
        redirect = { path: redirect };
      }

      if (!redirect || typeof redirect !== 'object') {
        {
          // 路由重定向配置参数错误
          warn(
            false, ("invalid redirect option: " + (JSON.stringify(redirect)))
          );
        }
        return _createRoute(null, location)
      }

      var re = redirect;
      var name = re.name;
      var path = re.path;
      var query = location.query;
      var hash = location.hash;
      var params = location.params;
      query = re.hasOwnProperty('query') ? re.query : query;
      hash = re.hasOwnProperty('hash') ? re.hash : hash;
      params = re.hasOwnProperty('params') ? re.params : params;

      if (name) {
        var targetRecord = nameMap[name];
        {
          // 根据路由名称来重定向出错，找不到该路由名称
          assert(targetRecord, ("redirect failed: named route \"" + name + "\" not found."));
        }
        return match({
          _normalized: true,
          name: name,
          query: query,
          hash: hash,
          params: params
        }, undefined, location)
      } else if (path) {
        // 1. 解析相对的路径
        var rawPath = resolveRecordPath(path, record);
        // 2. 解析params，构成path
        var resolvedPath = fillParams(rawPath, params, ("redirect route with path \"" + rawPath + "\""));
        // 3. 重新匹配路由
        return match({
          _normalized: true,
          path: resolvedPath,
          query: query,
          hash: hash
        }, undefined, location)
      } else {
        {
          warn(false, ("invalid redirect option: " + (JSON.stringify(redirect))));
        }
        return _createRoute(null, location)
      }
    }

    // 路由别名
    function alias (
      record,
      location,
      matchAs
    ) {
      var aliasedPath = fillParams(matchAs, location.params, ("aliased route with path \"" + matchAs + "\""));
      var aliasedMatch = match({
        _normalized: true,
        path: aliasedPath
      });
      if (aliasedMatch) {
        var matched = aliasedMatch.matched;
        var aliasedRecord = matched[matched.length - 1];
        location.params = aliasedMatch.params;
        return _createRoute(aliasedRecord, location)
      }
      return _createRoute(null, location)
    }

    // 私有方法，创建路由
    function _createRoute (
      record,
      location,
      redirectedFrom
    ) {
      if (record && record.redirect /* 重定向 */) {
        return redirect(record, redirectedFrom || location)
      }
      if (record && record.matchAs /* 匹配到路由别名 */) {
        return alias(record, location, record.matchAs)
      }
      // 创建真正的路由
      return createRoute(record, location, redirectedFrom, router)
    }

    // this.matcher
    return {
      match: match,
      addRoutes: addRoutes
    }
  }

  /**
   * 匹配程序员定义的route
   * @param {*} regex 匹配规则
   * @param {*} path 需要匹配的路径
   * @param {*} params 
   * @returns 
   */
  function matchRoute (
    regex,
    path,
    params
  ) {
    var m = path.match(regex);

    if (!m) {
      return false
    } else if (!params) {
      return true
    }

    /*
      匹配动态路由
      e.g. 
      const Foo = {
        template: '<div>Foo {{ $route.params.id }}</div>'
      }
      const routes = [
        { path: '/foo/:id', component: Foo },
      ]
      使用：
      router.resolve({
        path: "/foo/fanqiewa"
      });

      // $route.params.id === 'fanqiewa'
    */
    for (var i = 1, len = m.length; i < len; ++i) {
      // 在构建regex正则表达式时，将动态路由的一些信息暂存于此，例如：name、delimiter等
      var key = regex.keys[i - 1];
      var val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i];
      if (key) {
        params[key.name || 'pathMatch'] = val;
      }
    }

    return true
  }

  // 解析路由路径
  function resolveRecordPath (path, record) {
    return resolvePath(path, record.parent ? record.parent.path : '/', true)
  }

  var Time =
    inBrowser && window.performance && window.performance.now
      ? window.performance
      : Date;

  function genStateKey () {
    return Time.now().toFixed(3)
  }

  var _key = genStateKey();

  function getStateKey () {
    return _key
  }

  function setStateKey (key) {
    return (_key = key)
  }

  var positionStore = Object.create(null);

  // 安装滚动
  function setupScroll () {
    // 滚动恢复属性，允许web应用程序在历史导航上显示的设置默认滚动恢复行为
    // 值，auto：将恢复用户已滚动到的页面上的位置。manual：未还原页面上的位置，用户必须手动滚动到该位置。
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    // window.location.protocol => 协议
    // window.location.host => 域名
    var protocolAndPath = window.location.protocol + '//' + window.location.host;
    // 绝对地址（去掉协议和域名）
    var absolutePath = window.location.href.replace(protocolAndPath, '');
    // 保存现有的路由栈，因为用户可能会重写它
    var stateCopy = extend({}, window.history.state);
    stateCopy.key = getStateKey();
    // 保存第一个路由栈
    window.history.replaceState(stateCopy, '', absolutePath);

    window.addEventListener('popstate', handlePopState);
    // 返回一个卸载函数，当执行卸载监听时，可以卸载该事件
    return function () {
      window.removeEventListener('popstate', handlePopState);
    }
  }

  // 触发滚动
  function handleScroll (
    router,
    to,
    from,
    isPop
  ) {
    if (!router.app) {
      return
    }

    // new  VueRouter({ scrollBehavior: () => { } })
    var behavior = router.options.scrollBehavior;
    if (!behavior) {
      return
    }

    // scrollBehavior必须为一个函数
    {
      assert(typeof behavior === 'function', "scrollBehavior must be a function");
    }

    // 在页面滚动前，需要等待页面渲染完毕
    router.app.$nextTick(function () {
      var position = getScrollPosition();
      // 执行scrollBehavior函数，该函数不能返回一个falsy（falsy不是false）
      var shouldScroll = behavior.call(
        router,
        to,
        from,
        isPop ? position : null
      );

      if (!shouldScroll) {
        return
      }

      if (typeof shouldScroll.then === 'function') {
        // 如果返回的是promise对象
        shouldScroll
          .then(function (shouldScroll) {
            scrollToPosition((shouldScroll), position);
          })
          .catch(function (err) {
            {
              assert(false, err.toString());
            }
          });
      } else {
        scrollToPosition(shouldScroll, position);
      }
    });
  }

  // 保存滚动位置
  function saveScrollPosition () {
    var key = getStateKey();
    if (key) {
      positionStore[key] = {
        x: window.pageXOffset,
        y: window.pageYOffset
      };
    }
  }

  // 触发浏览器的前进或后退按钮事件
  function handlePopState (e) {
    saveScrollPosition();
    if (e.state && e.state.key) {
      setStateKey(e.state.key);
    }
  }

  // 获取滚动位置信息
  function getScrollPosition () {
    var key = getStateKey();
    if (key) {
      return positionStore[key]
    }
  }

  // 获取元素的位置信息
  function getElementPosition (el, offset) {
    var docEl = document.documentElement;
    var docRect = docEl.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    return {
      x: elRect.left - docRect.left - offset.x,
      y: elRect.top - docRect.top - offset.y
    }
  }

  // 判断位置是否有效
  // e.g. { x: 0, y: 0 } => 有效
  function isValidPosition (obj) {
    return isNumber(obj.x) || isNumber(obj.y)
  }

  function normalizePosition (obj) {
    return {
      x: isNumber(obj.x) ? obj.x : window.pageXOffset,
      y: isNumber(obj.y) ? obj.y : window.pageYOffset
    }
  }

  // 格式化offset
  function normalizeOffset (obj) {
    return {
      x: isNumber(obj.x) ? obj.x : 0,
      y: isNumber(obj.y) ? obj.y : 0
    }
  }

  function isNumber (v) {
    return typeof v === 'number'
  }

  var hashStartsWithNumberRE = /^#\d/;

  // 滚动到指定位置
  function scrollToPosition (shouldScroll, position) {
    var isObject = typeof shouldScroll === 'object';
    /*
      e.g. 
      shouldScroll = {
        selector: "#app"
      }
    */
    if (isObject && typeof shouldScroll.selector === 'string') {
      var el = hashStartsWithNumberRE.test(shouldScroll.selector) // 通过ID查询元素
        ? document.getElementById(shouldScroll.selector.slice(1)) 
        : document.querySelector(shouldScroll.selector);

      if (el) {
        // 如果shouldScroll传递了offset，直接用，否则为一个对象{}
        var offset =
          shouldScroll.offset && typeof shouldScroll.offset === 'object'
            ? shouldScroll.offset
            : {};
        offset = normalizeOffset(offset);
        position = getElementPosition(el, offset);
      } else if (isValidPosition(shouldScroll)) {
        position = normalizePosition(shouldScroll);
      }
    } else if (isObject && isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll);
    }

    if (position) {
      window.scrollTo(position.x, position.y);
    }
  }

  // 判断当前环境是否支持pushState
  var supportsPushState =
    inBrowser &&
    (function () {
      var ua = window.navigator.userAgent;

      if (
        (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
        ua.indexOf('Mobile Safari') !== -1 &&
        ua.indexOf('Chrome') === -1 &&
        ua.indexOf('Windows Phone') === -1
      ) {
        return false
      }

      return window.history && typeof window.history.pushState === 'function'
    })();

  /**
   * 浏览器页面跳转
   * @param {*} url 跳转地址 
   * @param {*} replace 是否为替换
   */
  function pushState (url, replace) {
    saveScrollPosition();
    var history = window.history;
    try {
      if (replace) {
        var stateCopy = extend({}, history.state);
        stateCopy.key = getStateKey();
        // 替换当前历史记录
        history.replaceState(stateCopy, '', url);
      } else {
        history.pushState({ key: setStateKey(genStateKey()) }, '', url);
      }
    } catch (e) {
      window.location[replace ? 'replace' : 'assign'](url);
    }
  }

  // 替换rul
  function replaceState (url) {
    pushState(url, true);
  }

  /**
   * 运行队列fn => iterator
   * @param {*} queue 队列
   * @param {*} fn 遍历队列中的每一项，执行fn回调
   * @param {*} cb 执行完队列后的cb回调，最后执行
   */
  function runQueue (queue, fn, cb) {
    var step = function (index) {
      if (index >= queue.length) {
        cb();
      } else {
        if (queue[index]) {
          fn(queue[index], function () {
            step(index + 1);
          });
        } else {
          step(index + 1);
        }
      }
    };
    step(0);
  }

  // 导航错误类型
  var NavigationFailureType = {
    redirected: 2,
    aborted: 4,
    cancelled: 8,
    duplicated: 16 // 重复导航
  };

  // 创建重定向导航错误
  function createNavigationRedirectedError (from, to) {
    return createRouterError(
      from,
      to,
      NavigationFailureType.redirected,
      ("Redirected when going from \"" + (from.fullPath) + "\" to \"" + (stringifyRoute(
        to
      )) + "\" via a navigation guard.")
    )
  }

  // 创建重复导航错误
  function createNavigationDuplicatedError (from, to) {
    var error = createRouterError(
      from,
      to,
      NavigationFailureType.duplicated,
      // 避免对当前位置的冗余导航
      ("Avoided redundant navigation to current location: \"" + (from.fullPath) + "\".")
    );
    error.name = 'NavigationDuplicated';
    return error
  }
  // 创建取消导航错误
  function createNavigationCancelledError (from, to) {
    return createRouterError(
      from,
      to,
      NavigationFailureType.cancelled,
      ("Navigation cancelled from \"" + (from.fullPath) + "\" to \"" + (to.fullPath) + "\" with a new navigation.")
    )
  }
  // 创建终止导航错误
  function createNavigationAbortedError (from, to) {
    return createRouterError(
      from,
      to,
      NavigationFailureType.aborted,
      ("Navigation aborted from \"" + (from.fullPath) + "\" to \"" + (to.fullPath) + "\" via a navigation guard.")
    )
  }
  // 创建路由错误
  function createRouterError (from, to, type, message) {
    var error = new Error(message);
    error._isRouter = true;
    error.from = from;
    error.to = to;
    error.type = type;

    return error
  }

  var propertiesToLog = ['params', 'query', 'hash'];
  // 将JSON对象转成JSON字符串
  function stringifyRoute (to) {
    if (typeof to === 'string') { return to }
    if ('path' in to) { return to.path }
    var location = {};
    propertiesToLog.forEach(function (key) {
      if (key in to) { location[key] = to[key]; }
    });
    return JSON.stringify(location, null, 2 /* 文本缩进 */)
  }
  // 判断err是否为错误类型
  function isError (err) {
    return Object.prototype.toString.call(err).indexOf('Error') > -1
  }
  // 判断多无类型是否为导航错误
  function isNavigationFailure (err, errorType) {
    return (
      isError(err) &&
      err._isRouter &&
      (errorType == null || err.type === errorType)
    )
  }

  /**
   * 解析异步路由组件
   * @param {Array} matched 匹配路由
   * @returns 
   */
  function resolveAsyncComponents (matched) {
    return function (to, from, next) {
      var hasAsync = false;
      var pending = 0;
      var error = null;

      // def => 组件
      // _ => instance
      // match => route
      // key => key 默认为default
      flatMapComponents(matched, function (def, _, match, key) {
        // 异步加载组件
        if (typeof def === 'function' && def.cid === undefined) {
          hasAsync = true;
          pending++;

          var resolve = once(function (resolvedDef) {
            if (isESModule(resolvedDef)) {
              resolvedDef = resolvedDef.default;
            }
            // 保存异步解析组件
            def.resolved = typeof resolvedDef === 'function'
              ? resolvedDef
              : _Vue.extend(resolvedDef);
              // resolvedDef为组件，添加到match中
            match.components[key] = resolvedDef;
            pending--;
            if (pending <= 0) {
              next();
            }
          });

          // 异步解析组件失败
          var reject = once(function (reason) {
            var msg = "Failed to resolve async component " + key + ": " + reason;
             warn(false, msg);
            if (!error) {
              error = isError(reason)
                ? reason
                : new Error(msg);
              next(error);
            }
          });

          var res;
          try {
            // 执行组件fn，传入resolve，reject
            res = def(resolve, reject);
          } catch (e) {
            reject(e);
          }
          if (res) {
            if (typeof res.then === 'function') {
              res.then(resolve, reject);
            } else {
              // new syntax in Vue 2.3
              var comp = res.component;
              if (comp && typeof comp.then === 'function') {
                comp.then(resolve, reject);
              }
            }
          }
        }
      });

      if (!hasAsync) { next(); }
    }
  }

  /**
   * 扁平化map数组
   * @param {*} matched 一个数组
   * @param {*} fn 遍历数组中的每一项，执行fn回调
   * @returns 
   */
  function flatMapComponents (
    matched,
    fn
  ) {
    return flatten(matched.map(function (m) {
      // key默认为default
      return Object.keys(m.components).map(function (key) { return fn(
        m.components[key],
        m.instances[key],
        m, key
      ); })
    }))
  }

  // 扁平化数组化，最多只能打平第二层
  // e.g. Array.prototype.concat.apply([], [1, 2, [3, 4, [5, 6, [7]]]]);
  // => [1, 2, 3, 4, [5, 6, [7]]]
  function flatten (arr) {
    return Array.prototype.concat.apply([], arr)
  }

  var hasSymbol =
    typeof Symbol === 'function' &&
    typeof Symbol.toStringTag === 'symbol';
    // 判断对象是否为es模块对象

  function isESModule (obj) {
    return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
  }

  // fn只执行一次
  function once (fn) {
    var called = false;
    return function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      if (called) { return }
      called = true;
      return fn.apply(this, args)
    }
  }

  var History = function History (router, base) {
    this.router = router;
    this.base = normalizeBase(base);
    this.current = START;
    this.pending = null;
    this.ready = false;
    this.readyCbs = [];
    this.readyErrorCbs = [];
    this.errorCbs = [];
    this.listeners = [];
  };

  // 添加监听
  History.prototype.listen = function listen (cb) {
    this.cb = cb;
  };

  // 注册路由完成初始化导航时调用的回调
  History.prototype.onReady = function onReady (cb, errorCb) {
    if (this.ready) {
      cb();
    } else {
      this.readyCbs.push(cb);
      if (errorCb) {
        this.readyErrorCbs.push(errorCb);
      }
    }
  };

  // 注册错误回调
  History.prototype.onError = function onError (errorCb) {
    this.errorCbs.push(errorCb);
  };

  /**
   * 路由跳转过渡
   * @param {Object} location 将要跳转的地址信息
   * @param {Function} onComplete 成功回调
   * @param {Function} onAbort 失败回调
   */
  History.prototype.transitionTo = function transitionTo (
    location,
    onComplete,
    onAbort
  ) {
      var this$1 = this;

    var route;
    try {
      route = this.router.match(location, this.current);
    } catch (e) {
      // 匹配路由失败，添加错误信息到错误信息回调队列
      this.errorCbs.forEach(function (cb) {
        cb(e);
      });
      // Exception should still be thrown
      throw e
    }
    // 确认跳转
    this.confirmTransition(
      route,
      function () {
        var prev = this$1.current;
        // 更新路由
        this$1.updateRoute(route);
        // 执行this.transitionTo的完成回调（第二个参数）
        onComplete && onComplete(route);
        this$1.ensureURL();
        // 10、全局后置钩子 ---- afterEach
        this$1.router.afterHooks.forEach(function (hook) {
          hook && hook(route, prev);
        });

      // 11、触发DOM更新
      // 触发ready回调
        if (!this$1.ready) {
          this$1.ready = true;
          this$1.readyCbs.forEach(function (cb) {
            cb(route);
          });
        }
      },
      function (err) {
        if (onAbort) {
          onAbort(err);
        }
        if (err && !this$1.ready) {
          this$1.ready = true;
          if (!isNavigationFailure(err, NavigationFailureType.redirected)) {
            this$1.readyErrorCbs.forEach(function (cb) {
              cb(err);
            });
          } else {
            this$1.readyCbs.forEach(function (cb) {
              cb(route);
            });
          }
        }
      }
    );
  };

  /**
   * 确认跳转
   * @param {Object} route 跳转路由
   * @param {Function} onComplete 成功回调
   * @param {Function} onAbort 失败回调
   * @returns 
   */
  History.prototype.confirmTransition = function confirmTransition (route, onComplete, onAbort) {
      var this$1 = this;

    var current = this.current;
    var abort = function (err) {
      // 如果不是导航跳转错误，但却是错误类型的错误
      if (!isNavigationFailure(err) && isError(err)) {
        // 如果错误回调队列不为空，则循环队列，执行回调
        if (this$1.errorCbs.length) {
          this$1.errorCbs.forEach(function (cb) {
            cb(err);
          });
        } else {
          // 在路由跳转过程中捕获的未知错误
          warn(false, 'uncaught error during route navigation:');
          console.error(err);
        }
      }
      // 如果传入了自定义的失败回调，则执行失败回调
      onAbort && onAbort(err);
    };
    var lastRouteIndex = route.matched.length - 1;
    var lastCurrentIndex = current.matched.length - 1;
    if (
      isSameRoute(route, current) &&
      // 路由对象可能是动态附加的
      lastRouteIndex === lastCurrentIndex &&
      route.matched[lastRouteIndex] === current.matched[lastCurrentIndex]
    ) {
      this.ensureURL();
      return abort(createNavigationDuplicatedError(current, route))
    }

    var ref = resolveQueue(
      this.current.matched,
      route.matched
    );
      var updated = ref.updated;
      var deactivated = ref.deactivated;
      var activated = ref.activated;
    
    // 完整的导航解析流程
    // 1、导航被触发
    var queue = [].concat(
      // 2、将要离开路由守卫（组件内的守卫） ---- beforeRouteLeave
      extractLeaveGuards(deactivated),
      // 3、全局前置守卫 ---- beforeEach
      this.router.beforeHooks,
      // 4、更新路由前置守卫 ---- beforeEach
      extractUpdateHooks(updated),
      // 5、路由独享守卫 ------ beforeEnter
      activated.map(function (m) { return m.beforeEnter; }),
      // 6、解析异步路由组件
      resolveAsyncComponents(activated)
    );

    this.pending = route;
    /**
     * queue队列中每一项都会执行的fn
     * @param {*} hook queue中的每一项（也就是queue队列中注册的hook函数）
     * @param {*} next function () { step(index + 1); } 依靠此next函数来进行循环
     */
    var iterator = function (hook, next) {
      if (this$1.pending !== route) {
        return abort(createNavigationCancelledError(current, route))
      }
      try {
        /**
         * 执行守卫钩子函数，传递to，from，next
         * @param {Object} route to
         * @param {Object} current from
         * @param {Function} fn next
         */
        hook(route, current, function (to) {
          if (to === false) {
            // next(false) => 打印出报错信息，并重新跳转到当前url
            this$1.ensureURL(true);
            abort(createNavigationAbortedError(current, route));
          } else if (isError(to)) {
            this$1.ensureURL(true);
            abort(to);
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' &&
              (typeof to.path === 'string' || typeof to.name === 'string'))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort(createNavigationRedirectedError(current, route));
            if (typeof to === 'object' && to.replace) {
              this$1.replace(to);
            } else {
              this$1.push(to);
            }
          } else {
            // 执行下一个hook
            next(to);
          }
        });
      } catch (e) {
        abort(e);
      }
    };

    runQueue(queue, iterator, function () /* 执行完全部hook后的回调 */{
      var postEnterCbs = [];
      var isValid = function () { return this$1.current === route; };

      // 7、进入路由组件守卫（组件内的守卫） ---- beforeRouteEnter
      var enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);

      // 8、全局解析守卫 ---- beforeResolve
      var queue = enterGuards.concat(this$1.router.resolveHooks);
      // 9、导航被确认
      runQueue(queue, iterator, function () {
        if (this$1.pending !== route) {
          return abort(createNavigationCancelledError(current, route))
        }
        this$1.pending = null;
        onComplete(route);
        if (this$1.router.app) {
          this$1.router.app.$nextTick(function () {
            postEnterCbs.forEach(function (cb) {
              // 11、调用beforeRouteEnter守卫中传给next的回调函数
              /*
                e.g. 
                执行next时，传递了一个回调
                beforeRouteEnter(to, from, next) {
                  next(function () {
                    // ...
                  })
                }
              */
              cb();
            });
          });
        }
      });
    });
  };

  // 更新路由
  History.prototype.updateRoute = function updateRoute (route) {
    this.current = route;
    this.cb && this.cb(route);
  };

  // 安装事件监听
  History.prototype.setupListeners = function setupListeners () {
    // Default implementation is empty
  };

  // 卸载事件监听
  History.prototype.teardownListeners = function teardownListeners () {
    this.listeners.forEach(function (cleanupListener) {
      cleanupListener();
    });
    this.listeners = [];
  };

  // 格式化options中的base路径
  function normalizeBase (base) {
    if (!base) {
      if (inBrowser) {
        var baseEl = document.querySelector('base');
        base = (baseEl && baseEl.getAttribute('href')) || '/';
        // 去掉协议和域名
        base = base.replace(/^https?:\/\/[^\/]+/, '');
      } else {
        base = '/';
      }
    }
    // 确保斜杠开头
    if (base.charAt(0) !== '/') {
      base = '/' + base;
    }
    // 去除掉最后一个斜杠
    return base.replace(/\/$/, '')
  }
  
  /**
   * 解析两个路由匹配项队列，获取相等部分
   * @param {*} current 当前路由的matched匹配项
   * @param {*} next 将要跳转的matched匹配项
   */
  function resolveQueue (
    current,
    next
  ) {
    var i;
    var max = Math.max(current.length, next.length);
    for (i = 0; i < max; i++) {
      if (current[i] !== next[i]) {
        break
      }
    }
    /*
      e.g.
      const A = { template: '<div><router-view></router-view></div>' }
      const B = {
        template: '<div>bar</div>',
        beforeRouteLeave(to, from, next) {
          console.log("beforeRouteLeave");
          next();
        }
      }
      const C = { template: '<div>c</div>' }

      const routes = [
        { path: '/a', component: A, children: [
          {
            path: "/b",
            component: B
          },
          {
            path: "/c",
            component: C
          }
        ]}
      ]
      router.push({
        path: "/b"
      });
      router.push({
        path: "c"
      });

      跳转c时：
      updated => [{ path: '/a', /.../ }]
      activated => [{ path: '/c', /.../ }]
      deactivated => [{ path: '/b', /.../ }]
    */
    return {
      updated: next.slice(0, i), // 需要更新的route（相当于父子路由中的父路由a）
      activated: next.slice(i), // 处于激活的route（相当于父子路由中将要切换的子路由c）
      deactivated: current.slice(i) // 无效的route（相当于父子路由中将要被切换的子路由b）
    }
  }

  /**
   * 提取守卫钩子数组
   * @param {Array} records 路由
   * @param {String} name 守卫名称
   * @param {Function} bind 绑定函数
   * @param {Boolean} reverse 是否反转数组
   * @returns 返回一个数组
   */
  function extractGuards (
    records,
    name,
    bind,
    reverse
  ) {
    var guards = flatMapComponents(records, function (def, instance, match, key) {
      var guard = extractGuard(def, name);
      // 如果定义了守卫钩子函数
      if (guard) {
        return Array.isArray(guard)
          ? guard.map(function (guard) { return bind(guard, instance, match, key); })
          : bind(guard, instance, match, key)
      }
    });
    return flatten(reverse ? guards.reverse() : guards)
  }
  
  // 提取组件的守卫钩子
  function extractGuard (
    def,
    key
  ) {
    if (typeof def !== 'function') {
      // 如果传递的是template，调用vue.extend生成组件
      def = _Vue.extend(def);
    }
    // 返回组件定义的钩子函数 e.g. beforeRouteLeave
    return def.options[key]
  }

  // extract => 提取
  // 提取离开守卫
  function extractLeaveGuards (deactivated) {
    // 触发beforeRouteLeave生命周期
    // 第四个参数为true，表示先触发子路由的离开守卫钩子（即子组件先卸载）
    return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
  }

  // 提取路由更新守卫
  function extractUpdateHooks (updated) {
    return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
  }
  
  // 绑定守卫钩子
  function bindGuard (guard, instance) {
    // 如果实例存在，返回一个闭包函数，guard为程序员定义的守卫函数 e.g. beforeRouteLeave
    if (instance) {
      // boundRouteGuard为queue中的hook，在执行runQueue时，会遍历queue，执行每一项hook
      return function boundRouteGuard () {
        // e.g. 如果guard为beforeRouteLeave，则arguments为to，from，next
        return guard.apply(instance, arguments)
      }
    }
  }

  // 提取进入路由组件守卫
  function extractEnterGuards (
    activated,
    cbs,
    isValid
  ) {
    return extractGuards(
      activated,
      'beforeRouteEnter',
      /**
       * 
       * @param {*} guard beforeRouteEnter守卫函数
       * @param {*} _ instance实例
       * @param {*} match 匹配路由
       * @param {*} key key值，默认为default
       * @returns 
       */
      function (guard, _, match, key) {
        return bindEnterGuard(guard, match, key, cbs, isValid)
      }
    )
  }

  // 绑定进入路由组件守卫
  function bindEnterGuard (
    guard,
    match,
    key,
    cbs,
    isValid
  ) {
    // routeEnterGuard为queue中的hook，在执行runQueue时，会遍历queue，执行每一项hook
    // hook执行传入to，from，next必须执行
    return function routeEnterGuard (to, from, next) {
      /**
        e.g. 执行beforeRouteEnter，传入三个参数，第三个参数程序员必须调用（next())
        beforeRouteEnter(to, from, next) {
          next(function () {
            // cb
          })
        }
       */
      return guard(to, from, function (cb) {
        if (typeof cb === 'function') {
          cbs.push(function () {
            poll(cb, match.instances, key, isValid);
          });
        }
        // 执行next
        next(cb);
      })
    }
  }

  function poll (
    cb, 
    instances,
    key,
    isValid
  ) {
    if (
      instances[key] &&
      !instances[key]._isBeingDestroyed // 实例不是正在销毁阶段
    ) {
      cb(instances[key]); // 执行beforeRouteEnter守卫的next传入的回调
    } else if (isValid()) { // 如果实例还没创建完成，则循环调用cb，直到cb被成功调用位置
      setTimeout(function () {
        poll(cb, instances, key, isValid);
      }, 16);
    }
  }

  var HTML5History = /*@__PURE__*/(function (History) {
    function HTML5History (router, base) {
      History.call(this, router, base);

      this._startLocation = getLocation(this.base);
    }

    if ( History ) HTML5History.__proto__ = History;
    HTML5History.prototype = Object.create( History && History.prototype );
    HTML5History.prototype.constructor = HTML5History;

    // 安装浏览器监听事件
    HTML5History.prototype.setupListeners = function setupListeners () {
      var this$1 = this;

      if (this.listeners.length > 0) {
        return
      }

      var router = this.router;
      var expectScroll = router.options.scrollBehavior;
      var supportsScroll = supportsPushState && expectScroll;

      if (supportsScroll) {
        this.listeners.push(setupScroll());
      }

      var handleRoutingEvent = function () {
        var current = this$1.current;
        var location = getLocation(this$1.base);
        if (this$1.current === START && location === this$1._startLocation) {
          return
        }

        this$1.transitionTo(location, function (route) {
          if (supportsScroll) {
            handleScroll(router, route, current, true);
          }
        });
      };
      window.addEventListener('popstate', handleRoutingEvent);
      this.listeners.push(function () {
        window.removeEventListener('popstate', handleRoutingEvent);
      });
    };

    // 前进/后退n个路由
    HTML5History.prototype.go = function go (n) {
      window.history.go(n);
    };

    // 添加路由
    HTML5History.prototype.push = function push (location, onComplete, onAbort) {
      var this$1 = this;

      var ref = this;
      var fromRoute = ref.current;
      this.transitionTo(location, function (route) {
        pushState(cleanPath(this$1.base + route.fullPath));
        handleScroll(this$1.router, route, fromRoute, false);
        onComplete && onComplete(route);
      }, onAbort);
    };

    // 替换路由
    HTML5History.prototype.replace = function replace (location, onComplete, onAbort) {
      var this$1 = this;

      var ref = this;
      var fromRoute = ref.current;
      this.transitionTo(location, function (route) {
        replaceState(cleanPath(this$1.base + route.fullPath));
        handleScroll(this$1.router, route, fromRoute, false);
        onComplete && onComplete(route);
      }, onAbort);
    };

    // 确定url，完成修改
    HTML5History.prototype.ensureURL = function ensureURL (push) {
      if (getLocation(this.base) !== this.current.fullPath) {
        var current = cleanPath(this.base + this.current.fullPath);
        push ? pushState(current) : replaceState(current);
      }
    };

    // 获取当前的location
    HTML5History.prototype.getCurrentLocation = function getCurrentLocation () {
      return getLocation(this.base)
    };

    return HTML5History;
  }(History));

  // 获取location
  function getLocation (base) {
    // decodeURI 返回一个给定编码统一资源标识符（URI）的未编码版本的字符串
    // location.pathname 返回URL的域名（域名IP）后的部分。不包括问号 `?` 后面的内容
    // e.g. 
    // http://32.114.53:10080/users/sign_in ==> /user/sign_in
    // http://localhost:8080/#/workbench?first_flag=true ==> /
    var path = decodeURI(window.location.pathname);

    // 去掉base基路径
    if (base && path.toLowerCase().indexOf(base.toLowerCase()) === 0) {
      path = path.slice(base.length);
    }
    // location.search 得到url中 `?` 号之后 # 之前的部分
    // e.g. 
    // http://localhost:8080/test?user=admin#/workbench?first_flag=true ==> ?user=admin

    // location.hash 得到 # 号之后的部分
    // e.g. 
    // http://localhost:8080/#/workbench?first_flag=true ==> #/workbennch?first_flag=true
    return (path || '/') + window.location.search + window.location.hash
  }

  var HashHistory = /*@__PURE__*/(function (History) {
    function HashHistory (router, base, fallback) {
      History.call(this, router, base);
      // 当程序员设置mode为history模式，且fallback为true或不设置时，且浏览器不支持history.pushState时，
      // fallback为true，属于回退到hash模式
      if (fallback && checkFallback(this.base)) {
        return
      }
      ensureSlash();
    }

    if ( History ) HashHistory.__proto__ = History;
    // 将HashHistory的原型指向History的原型
    HashHistory.prototype = Object.create( History && History.prototype );
    HashHistory.prototype.constructor = HashHistory;

    // 安装浏览器监听事件
    HashHistory.prototype.setupListeners = function setupListeners () {
      var this$1 = this;
      // 如果已经添加过滚动监听，直接终止函数
      if (this.listeners.length > 0) {
        return
      }

      var router = this.router;
      var expectScroll = router.options.scrollBehavior;
      var supportsScroll = supportsPushState && expectScroll;

      if (supportsScroll) {
        this.listeners.push(setupScroll());
      }

      var handleRoutingEvent = function () {
        var current = this$1.current;
        if (!ensureSlash()) {
          // 如果不是以斜杠开头的hash路径，则终止函数
          // /#admin 这种属于锚点链接，不需要路由跳转
          return
        }
        this$1.transitionTo(getHash(), function (route) {
          if (supportsScroll) {
            handleScroll(this$1.router, route, current, true);
          }
          if (!supportsPushState) {
            replaceHash(route.fullPath);
          }
        });
      };
      // 当用户点击浏览器的前进或后退按钮时，触发的事件
      var eventType = supportsPushState ? 'popstate' : 'hashchange';
      window.addEventListener(
        eventType,
        handleRoutingEvent
      );
      this.listeners.push(function () {
        window.removeEventListener(eventType, handleRoutingEvent);
      });
    };

    // 添加路由
    HashHistory.prototype.push = function push (location, onComplete, onAbort) {
      var this$1 = this;

      var ref = this;
      var fromRoute = ref.current;
      this.transitionTo(
        location,
        function (route) {
          // 添加路由（与history模式的区别在于加了个 # 号）
          pushHash(route.fullPath);
          handleScroll(this$1.router, route, fromRoute, false);
          onComplete && onComplete(route);
        },
        onAbort
      );
    };

    // 替换路由
    HashHistory.prototype.replace = function replace (location, onComplete, onAbort) {
      var this$1 = this;

      var ref = this;
      var fromRoute = ref.current;
      this.transitionTo(
        location,
        function (route) {
          // 替换路由（与history模式的区别在于加了个 # 号）
          replaceHash(route.fullPath);
          handleScroll(this$1.router, route, fromRoute, false);
          onComplete && onComplete(route);
        },
        onAbort
      );
    };

    // 前进/后退n个路由
    HashHistory.prototype.go = function go (n) {
      window.history.go(n);
    };

    // 确定url，完成修改
    HashHistory.prototype.ensureURL = function ensureURL (push) {
      var current = this.current.fullPath;
      if (getHash() !== current) {
        push ? pushHash(current) : replaceHash(current);
      }
    };

    // 获取当前的location
    HashHistory.prototype.getCurrentLocation = function getCurrentLocation () {
      return getHash()
    };

    return HashHistory;
  }(History));

  // 检查fallback
  function checkFallback (base) {
    var location = getLocation(base);
    // 如果base路径开头没含有 /# ，则添加 /# ，并替换路径
    if (!/^\/#/.test(location)) {
      // 如果base为 / 则cleanPath('//#' + location)就有用了，去掉一个 / 
      window.location.replace(cleanPath(base + '/#' + location));
      return true
    }
  }

  // 确保 # 号后面是以斜线开头 即 /#/adim
  function ensureSlash () {
    var path = getHash();
    if (path.charAt(0) === '/') {
      return true
    }
    replaceHash('/' + path);
    return false
  }

  // 获取hash路径
  function getHash () {
    // 不能直接用window.location.hash来获取hash值
    // 因为在不同的浏览器之间它们是不一致的 - Firefox会预解码它！
    var href = window.location.href;
    var index = href.indexOf('#');
    if (index < 0) { return '' }

    // 获取 # 号后面的内容
    href = href.slice(index + 1);
    // 解码hash值，但不用解码 ? 号后面的和 # 锚点后面的内容
    var searchIndex = href.indexOf('?');
    if (searchIndex < 0) {
      var hashIndex = href.indexOf('#');
      if (hashIndex > -1) {
        href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex);
      } else { href = decodeURI(href); }
    } else {
      href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex);
    }

    return href
  }

  // 获取url，包含#号
  function getUrl (path) {
    var href = window.location.href;
    var i = href.indexOf('#');
    var base = i >= 0 ? href.slice(0, i) : href;
    return (base + "#" + path)
  }

  // hash模式路由跳转（通过getUrl生成带 # 号的url）
  function pushHash (path) {
    if (supportsPushState) {
      pushState(getUrl(path));
    } else {
      window.location.hash = path;
    }
  }

  // 替换hash路径，跳转链接
  function replaceHash (path) {
    if (supportsPushState) {
      replaceState(getUrl(path));
    } else {
      // 如果不支持history.pushState
      window.location.replace(getUrl(path));
    }
  }

  var AbstractHistory = /*@__PURE__*/(function (History) {
    function AbstractHistory (router, base) {
      History.call(this, router, base);
      this.stack = []; // 路由栈
      this.index = -1; // 指向路由栈的索引
    }

    if ( History ) AbstractHistory.__proto__ = History;
    AbstractHistory.prototype = Object.create( History && History.prototype );
    AbstractHistory.prototype.constructor = AbstractHistory;

    AbstractHistory.prototype.push = function push (location, onComplete, onAbort) {
      var this$1 = this;

      this.transitionTo(
        location,
        function (route) {
          this$1.stack = this$1.stack.slice(0, this$1.index + 1).concat(route);
          this$1.index++; // 路由加1
          onComplete && onComplete(route);
        },
        onAbort
      );
    };

    AbstractHistory.prototype.replace = function replace (location, onComplete, onAbort) {
      var this$1 = this;

      this.transitionTo(
        location,
        function (route) {
          // 直接替换当前路由
          this$1.stack = this$1.stack.slice(0, this$1.index).concat(route);
          onComplete && onComplete(route);
        },
        onAbort
      );
    };

    AbstractHistory.prototype.go = function go (n) {
      var this$1 = this;

      var targetIndex = this.index + n;
      // 将要跳转的目标索引小于零或者目标索引大于路由栈长度
      if (targetIndex < 0 || targetIndex >= this.stack.length) {
        return
      }
      var route = this.stack[targetIndex];
      this.confirmTransition(
        route,
        function () {
          this$1.index = targetIndex;
          this$1.updateRoute(route);
        },
        function (err) {
          if (isNavigationFailure(err, NavigationFailureType.duplicated)) {
            this$1.index = targetIndex;
          }
        }
      );
    };

    AbstractHistory.prototype.getCurrentLocation = function getCurrentLocation () {
      var current = this.stack[this.stack.length - 1];
      return current ? current.fullPath : '/'
    };

    AbstractHistory.prototype.ensureURL = function ensureURL () {
      // noop
    };

    return AbstractHistory;
  }(History));

  /**
   * VueRouter构造函数
   * @param {Object} options router构建选项
   * e.g. 
   * new VueRouter({
   *  routers, // 路由组件
   *  mode, // 配置路由模式
   *  base, // 应用的基路径
   *  linkActiveClass, // 全局配置<router-link>默认的激活的class
   *  linkExactActiveClass, // 全局配置<router-link>默认的精确激活的class
   *  scrollBehovior, // 路由切换时，配置页面的滚动方式
   *  parseQuery/stringifyQuery, // 提供自定义查询字符串的解析/返解析函数。覆盖默认行为
   *  fallback // history模式下，当浏览器不支持history.pushState控制路由是否应该回退到hash模式。
   * })
   */
  var VueRouter = function VueRouter (options) {
    if ( options === void 0 ) options = {};

    this.app = null;
    this.apps = [];
    this.options = options;
    this.beforeHooks = [];
    this.resolveHooks = [];
    this.afterHooks = [];
    this.matcher = createMatcher(options.routes || [], this);

    var mode = options.mode || 'hash';
    this.fallback =
      mode === 'history' && !supportsPushState && options.fallback !== false;
    if (this.fallback) {
      mode = 'hash';
    }
    if (!inBrowser) {
      mode = 'abstract';
    }
    this.mode = mode;

    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base);
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback);
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base);
        break
      default:
        {
          assert(false, ("invalid mode: " + mode));
        }
    }
  };

  var prototypeAccessors = { currentRoute: { configurable: true } };

  // 匹配路由
  VueRouter.prototype.match = function match (raw, current, redirectedFrom) {
    return this.matcher.match(raw, current, redirectedFrom)
  };

  // 定义currentRoute的获取规则
  prototypeAccessors.currentRoute.get = function () {
    return this.history && this.history.current
  };

  VueRouter.prototype.init = function init (app /* Vue组件实例 */) {
      var this$1 = this;
      // 判断是否已经注册了VueRouter，即Vue.use(VueRouter)    
      assert(
        install.installed,
        "not installed. Make sure to call `Vue.use(VueRouter)` " +
          "before creating root instance."
      );

    this.apps.push(app);

    // 销毁实例
    app.$once('hook:destroyed', function () {
      var index = this$1.apps.indexOf(app);
      if (index > -1) { this$1.apps.splice(index, 1); }
      if (this$1.app === app) { this$1.app = this$1.apps[0] || null; }

      if (!this$1.app) {
        // 清除事件监听
        this$1.history.teardownListeners();
      }
    });

    // 如果当前的app已经存在，则不需要重新设置
    if (this.app) {
      return
    }

    this.app = app;

    var history = this.history;

    if (history instanceof HTML5History || history instanceof HashHistory) {
      var handleInitialScroll = function (routeOrError) {
        var from = history.current;
        var expectScroll = this$1.options.scrollBehavior;
        var supportsScroll = supportsPushState && expectScroll;

        if (supportsScroll && 'fullPath' in routeOrError) {
          handleScroll(this$1, routeOrError, from, false);
        }
      };
      var setupListeners = function (routeOrError) {
        history.setupListeners();
        handleInitialScroll(routeOrError);
      };
      history.transitionTo(
        history.getCurrentLocation(),
        setupListeners,
        setupListeners
      );
    }

    // history添加监听函数，在更新路由时有效
    history.listen(function (route) {
      // 重置每一项app的route
      this$1.apps.forEach(function (app) {
        app._route = route;
      });
    });
  };

  /**
   * 程序员调用 ---- 全局前置守卫
   * 当一个导航触发时，全局前置守卫按照创建顺序调用。
   * 守卫时异步解析执行，此时导航在所有守卫resolve完之前一直处于等待中。
   * @param {Function} fn hook钩子函数
   */
  VueRouter.prototype.beforeEach = function beforeEach (fn) {
    return registerHook(this.beforeHooks, fn)
  };

  /**
   * 程序员调用 ---- 注册全局解析守卫
   * 在导航被确认之前，同时在所有组件内守卫和异步路由组件被解析之后，解析守卫被调用
   * @param {Function} fn hook钩子函数
   */
  VueRouter.prototype.beforeResolve = function beforeResolve (fn) {
    return registerHook(this.resolveHooks, fn)
  };
  

  /**
   * 程序员调用 ---- 注册全局后置钩子
   * @param {Function} fn hook钩子函数
   */
  VueRouter.prototype.afterEach = function afterEach (fn) {
    return registerHook(this.afterHooks, fn)
  };

  /**
   * 程序员调用 ---- 注册一个回调
   * 在路由完成初始化导航时调用
   * @param {Function} cb 成功回调
   * @param {Function} errorCb 错误回调
   */
  VueRouter.prototype.onReady = function onReady (cb, errorCb) {
    this.history.onReady(cb, errorCb);
  };

  /**
   * 程序员调用 ---- 注册一个回调
   * 该回调会在路由导航过程中出错时被调用
   * @param {Function} errorCb 错误回调
   */
  VueRouter.prototype.onError = function onError (errorCb) {
    this.history.onError(errorCb);
  };

  /**
   * 程序员调用 ---- 添加路由
   * 该方法会向history栈添加一个新的记录，当用户点击浏览器后退按钮时，则回到之前的RUL
   * @param {String|Object} location 
   * @param {Function} onComplete 成功回调
   * @param {Function} onAbort 失败回调
   * @returns 
   */
  VueRouter.prototype.push = function push (location, onComplete, onAbort) {
      var this$1 = this;

    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise(function (resolve, reject) {
        this$1.history.push(location, resolve, reject);
      })
    } else {
      this.history.push(location, onComplete, onAbort);
    }
  };

  /**
   * 程序员调用 ---- 重定向路由
   * @param {String|Object} location 
   * @param {Function} onComplete 成功回调
   * @param {Function} onAbort 失败回调
   * @returns 
   */
  VueRouter.prototype.replace = function replace (location, onComplete, onAbort) {
      var this$1 = this;

    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise(function (resolve, reject) {
        this$1.history.replace(location, resolve, reject);
      })
    } else {
      this.history.replace(location, onComplete, onAbort);
    }
  };

  /**
   * 程序员调用 ---- 前进/后退n个路由
   */
  VueRouter.prototype.go = function go (n) {
    this.history.go(n);
  };


  /**
   * 程序员调用 ---- 后退一个路由
   */
  VueRouter.prototype.back = function back () {
    this.go(-1);
  };


  /**
   * 程序员调用 ---- 向前一个路由
   */
  VueRouter.prototype.forward = function forward () {
    this.go(1);
  };

  /**
   * 程序员调用 ---- 获取匹配组件数组
   * 获取目标位置或者当前路由匹配的组件数组（是数组的定义/构造类，不是实例）
   * 通常在服务端渲染数据预加载时使用。
   * @param {String|Object} to
   */
  VueRouter.prototype.getMatchedComponents = function getMatchedComponents (to) {
    var route = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute;
    if (!route) {
      return []
    }
    return [].concat.apply(
      [],
      route.matched.map(function (m) {
        return Object.keys(m.components).map(function (key) {
          return m.components[key]
        })
      })
    )
  };

  /**
   * 程序员调用 ---- 解析目标位置
   * @param {String|Object} to 
   * @param {Object} current 
   * @param {String} append 
   * @returns 
   */
  VueRouter.prototype.resolve = function resolve (
    to, // (必填)
    current, // 当前默认的路由（可选）
    append // 允许你在current路由上附加路径（可选）
  ) {
    current = current || this.history.current;
    // location表示文档地址信息
    var location = normalizeLocation(to, current, append, this);
    // 匹配路由
    var route = this.match(location, current);
    var fullPath = route.redirectedFrom || route.fullPath;
    var base = this.history.base;
    // 根据模式创建href
    var href = createHref(base, fullPath, this.mode);
    return {
      location: location,
      route: route,
      href: href,
      normalizedTo: location,
      resolved: route
    }
  };

  /**
   * 程序员调用 ---- 添加更多的路由规则
   * @param {Object} routes 
   */
  VueRouter.prototype.addRoutes = function addRoutes (routes) {
    this.matcher.addRoutes(routes);
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation());
    }
  };

  // 拦截VueRouter的原型，定义currentRoute的获取值
  Object.defineProperties( VueRouter.prototype, prototypeAccessors );

  /**
   * 注册hook
   * @param {Array} list hook暂存队列
   * @param {Function} fn hook函数
   * @returns 返回一个匿名函数，执行该函数将fn从队列移除
   */
  function registerHook (list, fn) {
    list.push(fn);
    return function () {
      var i = list.indexOf(fn);
      if (i > -1) { list.splice(i, 1); }
    }
  }

  /**
   * 创建href
   * @param {String} base 基础路径（域名）
   * @param {String} fullPath 虚拟目录（匹配路由）
   * @param {String} mode 路由模式
   * @returns 
   */
  function createHref (base, fullPath, mode) {
    var path = mode === 'hash' ? '#' + fullPath : fullPath;
    return base ? cleanPath(base + '/' + path) : path
  }

  VueRouter.install = install;
  VueRouter.version = '3.4.3';
  VueRouter.isNavigationFailure = isNavigationFailure;
  VueRouter.NavigationFailureType = NavigationFailureType;

  // 初始化Vue-router
  if (inBrowser && window.Vue) {
    window.Vue.use(VueRouter);
  }

  return VueRouter;

}));
