import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class GenericDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector)  {
    super($scope, $injector);
    this.scope = $scope;
    this.target.consolidation = this.target.consolidation || 'avg';
    this.target.type = this.target.type || 'predefined';
    this.target.raw = false;
  }

  getOptions(what, query) {
    if (what == 'nodes') {
      return this.datasource.completeNodes(query || '');
    } else {
      if (this.target.node) {
        return this.datasource.completeFields(this.target.node, query || '');
      }
    }
    return [];
  }

  getConsolidation() {
    return this.datasource.mapToTextValue({ data: ['avg', 'max', 'min'] });
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';

