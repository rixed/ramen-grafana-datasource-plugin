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

  /* We must perform everything in a single query:
   * - request all the predefined timeseries
   * - create (or update) a temporary, anonymous function with the given operation
   * - add its exported time series into the result.
   *
   * It is probably easier to just send everything we have to ramen and leave
   * it to it to construct the operation etc. rather than try to do this from this
   * grafana plugin.
   * Bigger problem is: when do we delete those programs? If they are cheap to create
   * and have no (or not much) history then we can probably delete them after a few
   * minutes we haven't been requested their data.
   * Maybe we could have a longer timeout for group-bys for instance, but anything
   * more persistent must fall into the 'predefined' category.
   *
   * So, ramen will first have to name the operation, for instance according to a hash
   * of the operation+from (at least we want to avoid creating a new program each time
   * a client ask for the timeserie, esp since it involves compiling!)
   * Then it create the program and the operation, with a 'temporary' flag, and
   * record in the export table each time a timeserie is requested.
   * A distinct thread can then yank the unused temporary programs.
   */
  query(options) {
    var query = {
      since: options.range.from.valueOf() * 0.001,
      until: options.range.to.valueOf() * 0.001,
      max_data_points: options.maxDataPoints,
      timeseries: options.targets.filter(t =>
        !t.hide && (
          t.type == 'predefined' && t.node && t.data_field ||
          t.type == 'new' && t.select_y && t.from
        )
      ).map(t => {
        if (t.type == 'predefined') {
          let node = this.templateSrv.replace(t.node, null, 'regex');
          let data_field = this.templateSrv.replace(t.data_field, null, 'regex');
          return {
            // Id is used for the legend
            id: node + '(' + data_field + ')',
            consolidation: t.consolidation,
            spec: {
              Predefined: {
                operation: node,
                data_field: data_field,
              }
            },
          };
        } else {
          let select_x = this.templateSrv.replace(t.select_x, null, 'regex');
          let select_y = this.templateSrv.replace(t.select_y, null, 'regex');
          let from = this.templateSrv.replace(t.from, null, 'regex');
          let where = this.templateSrv.replace(t.where, null, 'regex');
          return {
            id: select_x + ',' + select_y + ' FROM ' + from,
            consolidation: t.consolidation,
            spec: {
              NewTempNode: {
                select_x: select_x,
                select_y: select_y,
                from: from,
                where: where || '',
              }
            },
          };
        }
      })
    };

    if (query.timeseries.length <= 0) {
      return this.q.when({data: []});
    }

    return this.doRequest({
      url: 'timeseries',
      data: query,
      method: 'POST'
    }).then(response => {
      if (response.status === 200) {
        let data = response.data.map(ts => {
          return {
            target: ts.id,
            datapoints: [...ts.times.entries()]
                        .map(([i, t]) => [ts.values[i], t * 1000])
                        .sort(([_v1,t1], [_v2,t2]) => t1-t2)
          };
        });
        return { data: data };
      }
    });
  }

  testDatasource() {
    return this.doRequest({
      url: 'grafana',
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
      url: 'grafana/annotations',
      method: 'POST',
      data: annotationQuery
    }).then(result => {
      return result.data;
    });
  }

  completeNodes(query) {
    var interpolated = {
        prefix: this.templateSrv.replace(query, null, 'regex'),
        only_exporting: true
    };

    return this.doRequest({
      url: 'complete/operations',
      data: interpolated,
      method: 'POST',
    }).then(this.mapToTextValue);
  }

  completeFields(node, query) {
    var interpolated = {
        operation: node,
        prefix: this.templateSrv.replace(query, null, 'regex')
    };

    return this.doRequest({
      url: 'complete/fields',
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

    options.url = /\/$/.test(this.url) ? this.url + options.url : this.url + '/' + options.url;

    return this.backendSrv.datasourceRequest(options);
  }
}
