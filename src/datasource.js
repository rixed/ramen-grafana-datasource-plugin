import _ from "lodash";

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.withCredentials = instanceSettings.withCredentials;
    this.headers = {'Content-Type': 'application/json'};
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    }
  }

  query(options) {
    var query = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      interval_ms: options.intervalMs,
      max_data_points: options.maxDataPoints,
      timeseries: options.targets.filter(t =>
        !t.hide && t.node && t.time_field && t.data_field
      ).map(t => {
        return {
          id: t.node + '(' + t.time_field + '→' + t.data_field + ')',
          node: t.node,
          time_field: t.time_field,
          data_field: t.data_field,
          consolidation: avg,
        };
      })
    };

    if (query.timeseries.length <= 0) {
      return this.q.when({data: []});
    }

    return this.doRequest({
      url: this.url + '/timeseries',
      data: query,
      method: 'POST'
    }).then(response => {
      if (response.status === 200) {
        let data = response.data.map(ts => {
          return {
            target: ts.id,
            datapoints: [...ts.times.entries()]
                        .map(([i, t]) => [ts.values[i], t])
                        .sort(([_v1,t1], [_v2,t2]) => t1-t2)
          };
        });
        return { data: data };
      }
    });
  }

  testDatasource() {
    return this.doRequest({
      url: this.url + '/grafana',
      method: 'GET',
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  annotationQuery(options) {
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
    }).then(result => {
      return result.data;
    });
  }

  completeNodes(query) {
    var interpolated = {
        node_prefix: this.templateSrv.replace(query, null, 'regex')
    };

    return this.doRequest({
      url: this.url + '/complete/nodes',
      data: interpolated,
      method: 'POST',
    }).then(this.mapToTextValue);
  }

  completeFields(node, query) {
    var interpolated = {
        node: node,
        field_prefix: this.templateSrv.replace(query, null, 'regex')
    };

    return this.doRequest({
      url: this.url + '/complete/fields',
      data: interpolated,
      method: 'POST',
    }).then(this.mapToTextValue);
  }

  mapToTextValue(result) {
    return result.data.sort().map(d => ({ text: d, value: d }));
  }

  doRequest(options) {
    options.withCredentials = this.withCredentials;
    options.headers = this.headers;

    return this.backendSrv.datasourceRequest(options);
  }
}
