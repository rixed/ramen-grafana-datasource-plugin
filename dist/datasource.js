'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _slicedToArray, _createClass, GenericDatasource;

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _slicedToArray = function () {
        function sliceIterator(arr, i) {
          var _arr = [];
          var _n = true;
          var _d = false;
          var _e = undefined;

          try {
            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
              _arr.push(_s.value);

              if (i && _arr.length === i) break;
            }
          } catch (err) {
            _d = true;
            _e = err;
          } finally {
            try {
              if (!_n && _i["return"]) _i["return"]();
            } finally {
              if (_d) throw _e;
            }
          }

          return _arr;
        }

        return function (arr, i) {
          if (Array.isArray(arr)) {
            return arr;
          } else if (Symbol.iterator in Object(arr)) {
            return sliceIterator(arr, i);
          } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
          }
        };
      }();

      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('GenericDatasource', GenericDatasource = function () {
        function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, GenericDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.withCredentials = instanceSettings.withCredentials;
          this.headers = { 'Content-Type': 'application/json' };
          if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
          }
        }

        _createClass(GenericDatasource, [{
          key: 'query',
          value: function query(options) {
            var query = {
              from: options.range.from.valueOf(),
              to: options.range.to.valueOf(),
              interval_ms: options.intervalMs,
              max_data_points: options.maxDataPoints,
              timeseries: options.targets.filter(function (t) {
                return !t.hide && t.node && t.data_field;
              }).map(function (t) {
                return {
                  id: t.node + '(' + t.data_field + ')',
                  node: t.node,
                  data_field: t.data_field,
                  consolidation: t.consolidation
                };
              })
            };

            if (query.timeseries.length <= 0) {
              return this.q.when({ data: [] });
            }

            return this.doRequest({
              url: this.url + '/timeseries',
              data: query,
              method: 'POST'
            }).then(function (response) {
              if (response.status === 200) {
                var data = response.data.map(function (ts) {
                  return {
                    target: ts.id,
                    datapoints: [].concat(_toConsumableArray(ts.times.entries())).map(function (_ref) {
                      var _ref2 = _slicedToArray(_ref, 2),
                          i = _ref2[0],
                          t = _ref2[1];

                      return [ts.values[i], t];
                    }).sort(function (_ref3, _ref4) {
                      var _ref6 = _slicedToArray(_ref3, 2),
                          _v1 = _ref6[0],
                          t1 = _ref6[1];

                      var _ref5 = _slicedToArray(_ref4, 2),
                          _v2 = _ref5[0],
                          t2 = _ref5[1];

                      return t1 - t2;
                    })
                  };
                });
                return { data: data };
              }
            });
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            return this.doRequest({
              url: this.url + '/grafana',
              method: 'GET'
            }).then(function (response) {
              if (response.status === 200) {
                return { status: "success", message: "Data source is working", title: "Success" };
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
            var annotationQuery = {
              range: options.range,
              annotation: {
                name: options.annotation.name,
                datasource: options.annotation.datasource,
                enable: options.annotation.enable,
                iconColor: options.annotation.iconColor,
                query: query
              },
              rangeRaw: options.rangeRaw
            };

            return this.doRequest({
              url: this.url + '/grafana/annotations',
              method: 'POST',
              data: annotationQuery
            }).then(function (result) {
              return result.data;
            });
          }
        }, {
          key: 'completeNodes',
          value: function completeNodes(query) {
            var interpolated = {
              node_prefix: this.templateSrv.replace(query, null, 'regex')
            };

            return this.doRequest({
              url: this.url + '/complete/nodes',
              data: interpolated,
              method: 'POST'
            }).then(this.mapToTextValue);
          }
        }, {
          key: 'completeFields',
          value: function completeFields(node, query) {
            var interpolated = {
              node: node,
              field_prefix: this.templateSrv.replace(query, null, 'regex')
            };

            return this.doRequest({
              url: this.url + '/complete/fields',
              data: interpolated,
              method: 'POST'
            }).then(this.mapToTextValue);
          }
        }, {
          key: 'mapToTextValue',
          value: function mapToTextValue(result) {
            return result.data.sort().map(function (d) {
              return { text: d, value: d };
            });
          }
        }, {
          key: 'doRequest',
          value: function doRequest(options) {
            options.withCredentials = this.withCredentials;
            options.headers = this.headers;

            return this.backendSrv.datasourceRequest(options);
          }
        }]);

        return GenericDatasource;
      }());

      _export('GenericDatasource', GenericDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
